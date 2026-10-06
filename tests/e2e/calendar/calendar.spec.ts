/**
 * Calendario del admin (/admin/calendar): eventos en su fecha, navegación de meses, capacidad por día,
 * alta desde el día y autorización. Las pruebas que modifican reglas/excepciones (estado global)
 * están en availability.global.spec.ts.
 * Paquete 4 · carril 4 · prefijo CAL.
 */
import { expect, scanA11y, test, uniq } from "../fixtures";
import {
  addDaysKey,
  calendarDayLabel,
  callAction,
  createEventFixture,
  describe as d,
  monthLabel,
  pickFreeDate,
  todayKey,
  waitHydrated,
} from "../events/_helpers";

test.describe("Calendario", { tag: ["@module:calendar"] }, () => {
  test("[CAL-001] el calendario muestra el evento en su fecha y el chip abre el detalle", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Calendario ?month=<mes del evento> › chip del evento");
    const ev = await createEventFixture(db, { status: "CONFIRMED", title: `Cal ${uniq("E2E")}` });
    const page = await rolePage("owner");
    await page.goto(`/admin/calendar?month=${ev.dateKey.slice(0, 7)}`);
    await expect(page.getByRole("heading", { level: 2, name: monthLabel(ev.dateKey.slice(0, 7)) })).toBeVisible();
    const cell = page.getByRole("cell").filter({ hasText: calendarDayLabel(ev.dateKey) });
    const chip = cell.getByRole("link", { name: new RegExp(`${ev.title}\\s*,\\s*Confirmado`) });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText("11:00");
    // Día de capacidad 1 con el evento confirmado: «Lleno»
    await expect(cell).toContainText("Lleno");
    await waitHydrated(chip);
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`/admin/events/${ev.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
  });

  test("[CAL-002] navegación de meses con «Siguiente», «Anterior» y «Hoy»", { tag: ["@P1", "@regression"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Calendario › Siguiente › Anterior › Hoy (navegación del cliente)");
    test.info().annotations.push({ type: "regression", description: "BUG-006" });
    const current = todayKey().slice(0, 7);
    const next = addDaysKey(`${current}-15`, 31).slice(0, 7);
    // Tres sesiones nuevas: abrir el calendario y pasar al mes siguiente (navegación del cliente)
    const outcomes: string[] = [];
    let page = await rolePage("owner");
    for (let i = 0; i < 3; i++) {
      page = await rolePage("owner");
      await page.goto("/admin/calendar");
      await expect(page.getByRole("heading", { level: 2, name: monthLabel(current) })).toBeVisible();
      const nav = page.getByRole("navigation", { name: "Cambiar de mes" });
      await expect(nav.getByRole("link", { name: "Hoy" })).toHaveAttribute("aria-current", "date");
      const sig = nav.getByRole("link", { name: /^Siguiente/ });
      await waitHydrated(sig);
      await sig.click();
      const ok = await page.waitForURL(new RegExp(`month=${next}`), { timeout: 10_000 }).then(() => true).catch(() => false);
      outcomes.push(`intento ${i + 1}: ${ok ? "OK" : "sin navegar (" + page.url() + ")"}`);
    }
    test.info().annotations.push({ type: "intentos", description: outcomes.join(" · ") });
    expect(outcomes.filter((o) => !o.endsWith("OK")), outcomes.join("\n")).toEqual([]);
    // Ida y vuelta en la última sesión: Anterior → Siguiente → Hoy
    const nav = page.getByRole("navigation", { name: "Cambiar de mes" });
    await expect(page.getByRole("heading", { level: 2, name: monthLabel(next) })).toBeVisible();
    await nav.getByRole("link", { name: /^Anterior/ }).click();
    await expect(page).toHaveURL(new RegExp(`month=${current}`));
    await expect(page.getByRole("heading", { level: 2, name: monthLabel(current) })).toBeVisible();
    await nav.getByRole("link", { name: /^Siguiente/ }).click();
    await expect(page).toHaveURL(new RegExp(`month=${next}`));
    await nav.getByRole("link", { name: "Hoy" }).click();
    await expect(page).toHaveURL(/\/admin\/calendar$/);
    await expect(page.getByRole("heading", { level: 2, name: monthLabel(current) })).toBeVisible();
  });

  test("[CAL-003] el mes llega por URL; un parámetro inválido o lejano vuelve al mes actual", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Calendario ?month=2027-03 · ?month=abc · ?month=2099-01");
    const page = await rolePage("owner");
    const target = addDaysKey(todayKey(), 150).slice(0, 7);
    await page.goto(`/admin/calendar?month=${target}`);
    await expect(page.getByRole("heading", { level: 2, name: monthLabel(target) })).toBeVisible();
    for (const bad of ["abc", "2099-01", "2027-13"]) {
      await page.goto(`/admin/calendar?month=${bad}`);
      await expect(page.getByRole("heading", { level: 2, name: monthLabel(todayKey().slice(0, 7)) })).toBeVisible();
    }
  });

  test("[CAL-004] los eventos cancelados no se muestran pero se cuentan en el mes", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Calendario con un evento cancelado en el mes");
    const date = await pickFreeDate(db);
    const cancelled = await createEventFixture(db, { status: "CANCELLED", dateKey: date, title: `Cancelado ${uniq("Cal")}` });
    const active = await createEventFixture(db, { status: "INQUIRY", dateKey: date, start: "16:00", end: "18:00", title: `Consulta ${uniq("Cal")}` });
    const page = await rolePage("owner");
    await page.goto(`/admin/calendar?month=${date.slice(0, 7)}`);
    const cell = page.getByRole("cell").filter({ hasText: calendarDayLabel(date) });
    await expect(cell.getByRole("link", { name: new RegExp(active.title) })).toBeVisible();
    await expect(cell.getByRole("link", { name: new RegExp(cancelled.title) })).toHaveCount(0);
    await expect(page.getByText(/\d+ cancelados? \(no se muestran\)/)).toBeVisible();
    // Una consulta no ocupa capacidad: el día sigue con lugar
    await expect(cell).toContainText("1 libre");
  });

  test("[CAL-005] días cerrados se marcan «Cerrado» y el «+» de un día abierto precarga la fecha del alta", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Calendario › lunes (cerrado) › «Nuevo evento el …» en día abierto");
    const monday = await pickFreeDate(db, { weekdays: [1] });
    const page = await rolePage("owner");
    await page.goto(`/admin/calendar?month=${monday.slice(0, 7)}`);
    const closedCell = page.getByRole("cell").filter({ hasText: calendarDayLabel(monday) });
    await expect(closedCell).toContainText("Cerrado");
    await expect(closedCell.getByRole("link", { name: /^Nuevo evento el/ })).toHaveCount(0);
    // Día abierto vecino dentro del mismo mes (martes, o domingo si el lunes es fin de mes)
    const open = addDaysKey(monday, 1).slice(0, 7) === monday.slice(0, 7) ? addDaysKey(monday, 1) : addDaysKey(monday, -1);
    const add = page.getByRole("link", { name: `Nuevo evento el ${calendarDayLabel(open)}` });
    await expect(add).toHaveAttribute("href", `/admin/events/new?date=${open}`);
    await waitHydrated(add);
    await add.click();
    await expect(page).toHaveURL(new RegExp(`/admin/events/new\\?date=${open}`));
    await expect(page.getByRole("textbox", { name: "Fecha", exact: true })).toHaveValue(open);
  });

  test("[CAL-006] staff y anónimo no acceden al calendario ni pueden crear excepciones por request", { tag: ["@P1", "@permissions"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("staff", "UI /admin/calendar + replay createAvailabilityExceptionAction / saveWeeklyRulesAction");
    const staff = await rolePage("staff");
    await staff.goto("/admin/calendar");
    await expect(staff).toHaveURL(/\/staff/);
    const anon = await anonPage();
    await anon.goto("/admin/calendar");
    await expect(anon).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fcalendar/);
    const date = addDaysKey(todayKey(), 200);
    const before = await db.availabilityRule.findMany({ orderBy: { weekday: "asc" } });
    for (const role of ["staff", null] as const) {
      const api = await apiAs(role);
      const ex = await callAction(api, "createAvailabilityExceptionAction", { date, type: "BLOCKED", maxEvents: null, reason: "forzado", serviceAreaId: "" }, { path: "/admin/calendar" });
      expect(ex.outcome, `${role ?? "anónimo"}: ${d(ex)}`).toBe("denied");
      const rules = await callAction(
        api,
        "saveWeeklyRulesAction",
        { rules: before.map((r) => ({ weekday: r.weekday, isOpen: false, maxEvents: 0, earliestStart: r.earliestStart, latestEnd: r.latestEnd })) },
        { path: "/admin/calendar" },
      );
      expect(rules.outcome, `${role ?? "anónimo"}: ${d(rules)}`).toBe("denied");
    }
    expect(await db.availabilityException.count({ where: { reason: "forzado" } })).toBe(0);
    expect(await db.availabilityRule.findMany({ orderBy: { weekday: "asc" } })).toEqual(before);
  });

  test("[CAL-007] accesibilidad (WCAG 2.1 AA) del calendario", { tag: ["@P2", "@a11y", "@regression"] }, async ({ rolePage, evidence }, testInfo) => {
    evidence("owner", "axe en /admin/calendar");
    test.info().annotations.push({ type: "regression", description: "BUG-009" });
    const page = await rolePage("owner");
    await page.goto("/admin/calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible();
    const { blocking } = await scanA11y(page, testInfo);
    expect(blocking.map((v) => `${v.id} (${v.impact}) ${v.help}`)).toEqual([]);
  });
});
