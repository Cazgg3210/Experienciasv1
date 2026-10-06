/**
 * Disponibilidad (ESTADO GLOBAL): reglas semanales y excepciones de calendario y su efecto en la
 * disponibilidad que ve el configurador público y el alta de eventos.
 * Suite aparte (E2E_SUITE=global, 1 worker, serial). Cada prueba restaura lo que cambia en `finally`.
 * Paquete 4 · carril 4 · prefijo CAL.
 */
import { expect, test, uniq } from "../fixtures";
import type { APIRequestContext } from "@playwright/test";
import {
  calendarDayLabel,
  callAction,
  describe as d,
  formatLongDate,
  pickFreeDate,
  todayKey,
  addDaysKey,
  waitHydrated,
} from "../events/_helpers";

test.describe.configure({ mode: "serial" });

/** Disponibilidad de un día tal como la pide el configurador público (/crear-experiencia). */
async function configuratorDay(api: APIRequestContext, date: string) {
  const r = await callAction<Array<{ date: string; status: string; remaining: number; acceptsRequests: boolean }>>(
    api,
    "getAvailabilityAction",
    { from: date, days: 1 },
    { path: "/crear-experiencia" },
  );
  expect(r.outcome, d(r)).toBe("accepted");
  return r.data![0]!;
}

async function adminCheck(api: APIRequestContext, date: string) {
  const r = await callAction(api, "checkEventAvailabilityAction", { date, startTime: "11:00", durationMinutes: 180, serviceAreaId: "", excludeEventId: "" }, { path: "/admin/events/new" });
  expect(r.outcome, d(r)).toBe("accepted");
  return r.data as { status: string; reason: string; capacity: number; available: boolean };
}

test.describe("Disponibilidad global", { tag: ["@module:calendar"] }, () => {
  test("[CAL-008] bloquear un día desde el calendario lo cierra en el configurador y en el alta; al eliminarlo se reabre", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Calendario › Fechas especiales › Agregar excepción (Bloqueado) › Eliminar");
    const date = await pickFreeDate(db);
    const reason = `Vacaciones ${uniq("E2E")}`;
    const anon = await apiAs(null);
    const owner = await apiAs("owner");
    try {
      expect((await configuratorDay(anon, date)).status).toBe("AVAILABLE");
      const page = await rolePage("owner");
      await page.goto(`/admin/calendar?month=${date.slice(0, 7)}`);
      const form = page.getByRole("form", { name: "Agregar excepción" });
      await waitHydrated(form);
      await form.getByRole("textbox", { name: "Fecha", exact: true }).fill(date);
      await expect(form.getByRole("combobox", { name: "Tipo" })).toHaveValue("BLOCKED");
      await form.getByLabel("Motivo").fill(reason);
      await form.getByRole("button", { name: "Agregar excepción" }).click();
      await expect(page.getByText("Excepción agregada", { exact: true })).toBeVisible();
      const list = page.getByRole("list", { name: "Fechas especiales próximas" });
      await expect(list).toContainText(reason);
      const ex = await db.availabilityException.findFirst({ where: { reason } });
      expect(ex).toMatchObject({ type: "BLOCKED", maxEvents: null, serviceAreaId: null });
      expect(ex!.date.toISOString().slice(0, 10)).toBe(date);
      expect(await db.auditLog.count({ where: { action: "availability.exception_created", entityId: ex!.id } })).toBe(1);

      // Efectos: configurador público, indicador del alta y alta de evento
      expect((await configuratorDay(anon, date)).status).toBe("BLOCKED");
      const check = await adminCheck(owner, date);
      expect(check).toMatchObject({ status: "BLOCKED", available: false, reason: "No tenemos operación este día." });
      await page.reload();
      await expect(page.getByRole("cell").filter({ hasText: calendarDayLabel(date) })).toContainText("Bloqueado");

      // Eliminar desde la UI
      const label = formatLongDate(date);
      await page.getByRole("button", { name: `Eliminar excepción del ${label}` }).click();
      await page.getByRole("alertdialog", { name: "¿Eliminar esta excepción?" }).getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Excepción eliminada")).toBeVisible();
      expect(await db.availabilityException.count({ where: { id: ex!.id } })).toBe(0);
      expect(await db.auditLog.count({ where: { action: "availability.exception_deleted", entityId: ex!.id } })).toBe(1);
      expect((await configuratorDay(anon, date)).status).toBe("AVAILABLE");
    } finally {
      await db.availabilityException.deleteMany({ where: { reason } });
    }
  });

  test("[CAL-009] capacidad especial: el día admite el máximo configurado en configurador y calendario", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Calendario › Agregar excepción › Capacidad especial (3)");
    const date = await pickFreeDate(db);
    const reason = `Temporada ${uniq("E2E")}`;
    const anon = await apiAs(null);
    try {
      const page = await rolePage("owner");
      await page.goto(`/admin/calendar?month=${date.slice(0, 7)}`);
      const form = page.getByRole("form", { name: "Agregar excepción" });
      await waitHydrated(form);
      await form.getByRole("textbox", { name: "Fecha", exact: true }).fill(date);
      await form.getByRole("combobox", { name: "Tipo" }).selectOption("CAPACITY_OVERRIDE");
      await form.getByRole("spinbutton", { name: "Máx. eventos ese día" }).fill("3");
      await form.getByLabel("Motivo").fill(reason);
      await form.getByRole("button", { name: "Agregar excepción" }).click();
      await expect(page.getByText("Excepción agregada", { exact: true })).toBeVisible();
      expect(await db.availabilityException.findFirst({ where: { reason } })).toMatchObject({ type: "CAPACITY_OVERRIDE", maxEvents: 3 });
      const day = await configuratorDay(anon, date);
      expect(day).toMatchObject({ status: "AVAILABLE", remaining: 3 });
      const owner = await apiAs("owner");
      expect((await adminCheck(owner, date)).capacity).toBe(3);
      await page.reload();
      await expect(page.getByRole("cell").filter({ hasText: calendarDayLabel(date) })).toContainText("3 libres");
      await expect(page.getByRole("list", { name: "Fechas especiales próximas" })).toContainText("Capacidad especial · 3");
    } finally {
      await db.availabilityException.deleteMany({ where: { reason } });
    }
  });

  test("[CAL-010] blackout con motivo: el alta lo explica y el configurador lo bloquea", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createAvailabilityExceptionAction (BLACKOUT) + deleteAvailabilityExceptionAction");
    const date = await pickFreeDate(db);
    const reason = `Evento privado ${uniq("E2E")}`;
    const owner = await apiAs("owner");
    const anon = await apiAs(null);
    try {
      const created = await callAction<{ id: string; eventsThatDay: number }>(owner, "createAvailabilityExceptionAction", { date, type: "BLACKOUT", maxEvents: null, reason, serviceAreaId: "" }, { path: "/admin/calendar" });
      expect(created.outcome, d(created)).toBe("accepted");
      expect(created.data).toMatchObject({ eventsThatDay: 0 });
      expect((await configuratorDay(anon, date)).status).toBe("BLOCKED");
      expect((await adminCheck(owner, date)).reason).toBe(`Fecha no disponible: ${reason}.`);
      const del = await callAction(owner, "deleteAvailabilityExceptionAction", { id: created.data!.id }, { path: "/admin/calendar" });
      expect(del.outcome, d(del)).toBe("accepted");
      const again = await callAction(owner, "deleteAvailabilityExceptionAction", { id: created.data!.id }, { path: "/admin/calendar" });
      expect(again.code, d(again)).toBe("NOT_FOUND");
      expect((await configuratorDay(anon, date)).status).toBe("AVAILABLE");
    } finally {
      await db.availabilityException.deleteMany({ where: { reason } });
    }
  });

  test("[CAL-011] excepciones inválidas: duplicada, en el pasado y capacidad sin máximo", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Agregar excepción duplicada (UI) + casos inválidos por backend");
    const date = await pickFreeDate(db);
    const reason = `Dup ${uniq("E2E")}`;
    const owner = await apiAs("owner");
    try {
      const first = await callAction(owner, "createAvailabilityExceptionAction", { date, type: "BLOCKED", maxEvents: null, reason, serviceAreaId: "" }, { path: "/admin/calendar" });
      expect(first.outcome, d(first)).toBe("accepted");
      const page = await rolePage("owner");
      await page.goto("/admin/calendar");
      const form = page.getByRole("form", { name: "Agregar excepción" });
      await waitHydrated(form);
      await form.getByRole("textbox", { name: "Fecha", exact: true }).fill(date);
      await form.getByLabel("Motivo").fill(reason);
      await form.getByRole("button", { name: "Agregar excepción" }).click();
      await expect(page.getByText("Ya existe una excepción igual para esa fecha.")).toBeVisible();
      expect(await db.availabilityException.count({ where: { reason } })).toBe(1);

      const past = await callAction(owner, "createAvailabilityExceptionAction", { date: addDaysKey(todayKey(), -2), type: "BLOCKED", maxEvents: null, reason, serviceAreaId: "" }, { path: "/admin/calendar" });
      expect(past.fieldErrors?.date?.[0], d(past)).toBe("Elige hoy o una fecha futura.");
      const noMax = await callAction(owner, "createAvailabilityExceptionAction", { date: addDaysKey(date, 1), type: "CAPACITY_OVERRIDE", maxEvents: null, reason, serviceAreaId: "" }, { path: "/admin/calendar" });
      expect(noMax.fieldErrors?.maxEvents?.[0], d(noMax)).toBe("Indica cuántos eventos se permiten ese día");
      const badZone = await callAction(owner, "createAvailabilityExceptionAction", { date: addDaysKey(date, 2), type: "BLOCKED", maxEvents: null, reason, serviceAreaId: "ckzonainexistente0000001" }, { path: "/admin/calendar" });
      expect(badZone.fieldErrors?.serviceAreaId?.[0], d(badZone)).toBe("La zona ya no existe.");
      expect(await db.availabilityException.count({ where: { reason } })).toBe(1);
    } finally {
      await db.availabilityException.deleteMany({ where: { reason } });
    }
  });

  test("[CAL-012] cerrar un día de la semana desde el horario semanal lo cierra en configurador, alta y calendario", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Calendario › Horario semanal › Miércoles: abierto (off) › Guardar horario");
    const original = await db.availabilityRule.findMany({ orderBy: { weekday: "asc" } });
    const wednesday = await pickFreeDate(db, { weekdays: [3] });
    const anon = await apiAs(null);
    try {
      expect((await configuratorDay(anon, wednesday)).status).toBe("AVAILABLE");
      const page = await rolePage("owner");
      await page.goto(`/admin/calendar?month=${wednesday.slice(0, 7)}`);
      const form = page.getByRole("form", { name: "Horario semanal" });
      await waitHydrated(form);
      await form.getByRole("switch", { name: "Miércoles: abierto" }).click();
      await form.getByRole("button", { name: "Guardar horario" }).click();
      await expect(page.getByText("Horario semanal guardado")).toBeVisible();
      expect((await db.availabilityRule.findUnique({ where: { weekday: 3 } }))?.isOpen).toBe(false);
      const audit = await db.auditLog.findFirst({ where: { action: "availability.rules_changed" }, orderBy: { createdAt: "desc" } });
      expect(audit?.actorEmail).toBe("ivonne@ivonne-rosa.test");
      expect((await configuratorDay(anon, wednesday)).status).toBe("CLOSED");
      const owner = await apiAs("owner");
      expect((await adminCheck(owner, wednesday)).status).toBe("CLOSED");
      await page.reload();
      await expect(page.getByRole("cell").filter({ hasText: calendarDayLabel(wednesday) })).toContainText("Cerrado");
    } finally {
      for (const r of original) {
        await db.availabilityRule.update({
          where: { weekday: r.weekday },
          data: { isOpen: r.isOpen, maxEvents: r.maxEvents, earliestStart: r.earliestStart, latestEnd: r.latestEnd },
        });
      }
    }
  });

  test("[CAL-013] horario semanal inválido se rechaza en el formulario y en el backend", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Horario semanal con hora fin < inicio + saveWeeklyRulesAction directo inválido");
    const original = await db.availabilityRule.findMany({ orderBy: { weekday: "asc" } });
    const asInput = original.map((r) => ({ weekday: r.weekday, isOpen: r.isOpen, maxEvents: r.maxEvents, earliestStart: r.earliestStart, latestEnd: r.latestEnd }));
    try {
      const page = await rolePage("owner");
      await page.goto("/admin/calendar");
      const form = page.getByRole("form", { name: "Horario semanal" });
      await waitHydrated(form);
      await form.getByLabel("Hora fin (Martes)").fill("07:00");
      await form.getByRole("button", { name: "Guardar horario" }).click();
      await expect(form.getByText("Debe ser posterior al inicio")).toBeVisible();

      const owner = await apiAs("owner");
      const zero = await callAction(owner, "saveWeeklyRulesAction", { rules: asInput.map((r) => (r.weekday === 2 ? { ...r, isOpen: true, maxEvents: 0 } : r)) }, { path: "/admin/calendar" });
      expect(zero.outcome, d(zero)).toBe("rejected");
      expect(JSON.stringify(zero.fieldErrors)).toContain("Un día abierto necesita al menos 1");
      const six = await callAction(owner, "saveWeeklyRulesAction", { rules: asInput.slice(0, 6) }, { path: "/admin/calendar" });
      expect(JSON.stringify(six.fieldErrors), d(six)).toContain("Deben capturarse los 7 días");
      const dup = await callAction(owner, "saveWeeklyRulesAction", { rules: asInput.map((r) => (r.weekday === 6 ? { ...r, weekday: 0 } : r)) }, { path: "/admin/calendar" });
      expect(JSON.stringify(dup.fieldErrors), d(dup)).toContain("Cada día debe aparecer una sola vez");
      const badTime = await callAction(owner, "saveWeeklyRulesAction", { rules: asInput.map((r) => (r.weekday === 2 ? { ...r, earliestStart: "8am" } : r)) }, { path: "/admin/calendar" });
      expect(JSON.stringify(badTime.fieldErrors), d(badTime)).toContain("Usa el formato HH:mm");
      expect(await db.availabilityRule.findMany({ orderBy: { weekday: "asc" } })).toEqual(original);
    } finally {
      for (const r of original) {
        await db.availabilityRule.update({
          where: { weekday: r.weekday },
          data: { isOpen: r.isOpen, maxEvents: r.maxEvents, earliestStart: r.earliestStart, latestEnd: r.latestEnd },
        });
      }
    }
  });
});
