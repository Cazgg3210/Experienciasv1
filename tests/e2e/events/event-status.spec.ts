/**
 * Eventos (admin): máquina de estados (transiciones válidas/inválidas), confirmación con disponibilidad,
 * ciclo de vida al confirmar y cancelación (auditoría, notificaciones, inventario, pagos pendientes).
 * Paquete 4 · carril 4 · prefijo EVT.
 */
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  callAction,
  createEventFixture,
  describe as d,
  experienceWithInventory,
  lastAudit,
  waitHydrated,
} from "./_helpers";

async function openStatus(page: Page, id: string) {
  await page.goto(`/admin/events/${id}`);
  const panel = page.getByRole("region", { name: "Estado" });
  await expect(panel).toBeVisible();
  // El panel de enlaces (botones Copiar) es cliente en todos los estados: sirve de señal de hidratación.
  await waitHydrated(page.getByRole("region", { name: "Enlaces privados" }).getByRole("button", { name: "Copiar" }).first());
  return panel;
}

/** Abre el diálogo de confirmación de la transición y la confirma. */
async function transition(page: Page, label: string) {
  await page.getByRole("region", { name: "Estado" }).getByRole("button", { name: label }).click();
  const dialog = page.getByRole("alertdialog", { name: label });
  await dialog.getByRole("button", { name: label }).click();
  await expect(dialog).toBeHidden();
}

test.describe("Eventos · estados", { tag: ["@module:events"] }, () => {
  test("[EVT-017] confirmar un evento en consulta lo confirma, audita y dispara el ciclo de vida (checklists e inventario)", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento INQUIRY › Estado › Confirmar evento");
    const experienceId = await experienceWithInventory(db);
    const ev = await createEventFixture(db, { status: "INQUIRY", experienceId });
    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    await expect(panel).toContainText("Consulta");
    await transition(page, "Confirmar evento");
    await expect(page.getByText("Estado actualizado: Confirmado")).toBeVisible();
    await expect(panel).toContainText("Confirmado");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CONFIRMED");
    const audit = await lastAudit(db, "event.status_changed", ev.id);
    expect(audit?.before).toMatchObject({ status: "INQUIRY" });
    expect(audit?.after).toMatchObject({ status: "CONFIRMED" });
    // onEventConfirmed: checklists instanciados desde plantillas y reservas de inventario
    await expect.poll(() => db.eventChecklistItem.count({ where: { eventId: ev.id } })).toBeGreaterThan(0);
    if (experienceId) {
      await expect.poll(() => db.inventoryReservation.count({ where: { eventId: ev.id, status: "RESERVED" } })).toBeGreaterThan(0);
    }
    await page.reload();
    await expect(page.getByRole("region", { name: "Estado" })).toContainText("Confirmado");
  });

  test("[EVT-018] recorrido completo de estados hasta «Completado» desde el panel", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "CONFIRMED → PLANNING → READY → IN_PROGRESS → COMPLETED");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    const steps: Array<[string, string, string]> = [
      ["Pasar a planeación", "En planeación", "PLANNING"],
      ["Marcar como listo", "Listo", "READY"],
      ["Iniciar evento", "En curso", "IN_PROGRESS"],
      ["Marcar como completado", "Completado", "COMPLETED"],
    ];
    for (const [action, label, status] of steps) {
      await transition(page, action);
      await expect(page.getByText(`Estado actualizado: ${label}`).last()).toBeVisible();
      await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe(status);
    }
    await expect(panel).toContainText("Este estado es final; no hay más transiciones.");
    const done = await db.event.findUnique({ where: { id: ev.id } });
    expect(done?.completedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "event.status_changed", entityId: ev.id } })).toBe(4);
    await expect(panel).toContainText("Completado el");
  });

  test("[EVT-019] transiciones inválidas: la UI sólo ofrece las válidas y el backend rechaza el resto", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "transitionEventAction directo con saltos no permitidos por eventStatusMachine");
    const inquiry = await createEventFixture(db, { status: "INQUIRY" });
    const completed = await createEventFixture(db, { status: "COMPLETED" });
    const cancelled = await createEventFixture(db, { status: "CANCELLED" });
    const page = await rolePage("owner");
    const panel = await openStatus(page, inquiry.id);
    await expect(panel.getByRole("button", { name: "Pasar a pendiente de pago" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Confirmar evento" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Cancelar evento" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Marcar como completado" })).toHaveCount(0);

    const api = await apiAs("owner");
    const path = `/admin/events/${inquiry.id}`;
    const cases: Array<[string, string, string]> = [
      [inquiry.id, "COMPLETED", 'No se puede pasar de "Consulta" a "Completado".'],
      [inquiry.id, "IN_PROGRESS", 'No se puede pasar de "Consulta" a "En curso".'],
      [completed.id, "PLANNING", 'No se puede pasar de "Completado" a "En planeación".'],
      [cancelled.id, "CONFIRMED", 'No se puede pasar de "Cancelado" a "Confirmado".'],
    ];
    for (const [eventId, to, message] of cases) {
      const r = await callAction(api, "transitionEventAction", { eventId, to, confirmUnavailable: true }, { path });
      expect(r.outcome, `${to}: ${d(r)}`).toBe("rejected");
      expect(r.code).toBe("INVALID_TRANSITION");
      expect(r.error).toBe(message);
    }
    const toCancel = await callAction(api, "transitionEventAction", { eventId: inquiry.id, to: "CANCELLED" }, { path });
    expect(toCancel.code, d(toCancel)).toBe("REASON_REQUIRED");
    const ghost = await callAction(api, "transitionEventAction", { eventId: "ckghostevent0000000000001", to: "CONFIRMED" }, { path });
    expect(ghost.code, d(ghost)).toBe("NOT_FOUND");
    expect((await db.event.findUnique({ where: { id: inquiry.id } }))?.status).toBe("INQUIRY");
    expect((await db.event.findUnique({ where: { id: completed.id } }))?.status).toBe("COMPLETED");
    expect((await db.event.findUnique({ where: { id: cancelled.id } }))?.status).toBe("CANCELLED");
    expect(await db.auditLog.count({ where: { action: "event.status_changed", entityId: { in: [inquiry.id, completed.id, cancelled.id] } } })).toBe(0);
  });

  test("[EVT-020] confirmar en una fecha llena avisa del conflicto y sólo procede con confirmación explícita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento INQUIRY en día 1/1 ocupado › Confirmar evento › Confirmar de todos modos");
    const busy = await createEventFixture(db, { status: "CONFIRMED" });
    const ev = await createEventFixture(db, { status: "INQUIRY", dateKey: busy.dateKey, start: "16:00", end: "19:00" });
    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    await transition(page, "Confirmar evento");
    const alert = panel.getByRole("alert");
    await expect(alert).toContainText("Ya no tenemos lugar ese día. (1 de 1 lugares ocupados)");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.status, "no cambia sin confirmar").toBe("INQUIRY");
    await alert.getByRole("button", { name: "Confirmar de todos modos" }).click();
    await expect(page.getByText("Estado actualizado: Confirmado")).toBeVisible();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CONFIRMED");
    const audit = await lastAudit(db, "event.status_changed", ev.id);
    expect(audit?.after).toMatchObject({ status: "CONFIRMED", overrodeAvailability: true });
  });
});

test.describe("Eventos · cancelación", { tag: ["@module:events"] }, () => {
  test("[EVT-021] cancelar con motivo y aviso: estado, reserva, auditoría, notificación y portal/micrositio cancelados", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Evento › Cancelar evento › motivo + avisar a la clienta");
    const ev = await createEventFixture(db, { status: "CONFIRMED", booking: { totalCents: 1_200_000, depositCents: 600_000 } });
    const reason = "La clienta cambió de ciudad (E2E)";
    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    await panel.getByRole("button", { name: "Cancelar evento" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancelar evento" });
    await dialog.getByLabel("Motivo de la cancelación").fill(reason);
    await dialog.getByRole("checkbox", { name: /Avisar a la clienta/ }).check();
    await dialog.getByRole("button", { name: "Cancelar evento" }).click();
    await expect(page.getByText("Evento cancelado · clienta notificada")).toBeVisible();
    await expect(panel).toContainText("Evento cancelado el");
    await expect(panel).toContainText(`Motivo: ${reason}`);

    const after = await db.event.findUnique({ where: { id: ev.id }, include: { booking: true } });
    expect(after?.status).toBe("CANCELLED");
    expect(after?.cancelledAt).not.toBeNull();
    expect(after?.cancellationReason).toBe(reason);
    expect(after?.booking?.cancelledAt).not.toBeNull();
    expect(after?.booking?.cancellationReason).toBe(reason);
    const audit = await lastAudit(db, "event.cancelled", ev.id);
    expect(audit?.before).toMatchObject({ status: "CONFIRMED" });
    expect(audit?.after).toMatchObject({ status: "CANCELLED", reason });
    const logs = await db.notificationLog.findMany({ where: { eventId: ev.id, dedupeKey: { startsWith: `event-cancelled:${ev.id}` } } });
    expect(logs.map((l) => l.channel).sort()).toEqual(["EMAIL", "WHATSAPP"]);
    expect(logs.every((l) => !l.body.includes(reason)), "el motivo no se incluye en el mensaje").toBe(true);

    const client = await anonPage();
    await client.goto(ev.portalPath);
    await expect(client.getByText("Evento cancelado", { exact: true })).toBeVisible();
    await expect(client.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await client.goto(ev.invitePath);
    await expect(client.getByRole("heading", { name: "Esta celebración fue cancelada" })).toBeVisible();
    // El evento cancelado desaparece del calendario y del panel de pagos se bloquean cobros nuevos
    await page.reload();
    await expect(page.getByRole("region", { name: "Pagos" })).toContainText("El evento está cancelado: no se aceptan nuevos pagos.");
    await expect(page.getByRole("button", { name: "Registrar pago manual" })).toHaveCount(0);
  });

  test("[EVT-022] cancelar libera las reservas de inventario del evento", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Evento confirmado con inventario reservado › Cancelar evento");
    const experienceId = await experienceWithInventory(db);
    test.skip(!experienceId, "NOT APPLICABLE: el seed no tiene experiencias con requerimientos de inventario");
    const ev = await createEventFixture(db, { status: "INQUIRY", experienceId });
    const api = await apiAs("owner");
    const confirm = await callAction(api, "transitionEventAction", { eventId: ev.id, to: "CONFIRMED" }, { path: `/admin/events/${ev.id}` });
    expect(confirm.outcome, d(confirm)).toBe("accepted");
    await expect.poll(() => db.inventoryReservation.count({ where: { eventId: ev.id, status: "RESERVED" } })).toBeGreaterThan(0);
    const reserved = await db.inventoryReservation.findMany({ where: { eventId: ev.id, status: "RESERVED" } });

    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    await panel.getByRole("button", { name: "Cancelar evento" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancelar evento" });
    await dialog.getByLabel("Motivo de la cancelación").fill("Cancelación con inventario E2E");
    await dialog.getByRole("button", { name: "Cancelar evento" }).click();
    await expect(page.getByText(`Evento cancelado · ${reserved.length} reserva(s) de inventario liberadas`)).toBeVisible();
    expect(await db.inventoryReservation.count({ where: { eventId: ev.id, status: "RESERVED" } })).toBe(0);
    expect(await db.inventoryReservation.count({ where: { eventId: ev.id, status: "CANCELLED" } })).toBe(reserved.length);
    const releases = await db.inventoryMovement.findMany({ where: { eventId: ev.id, type: "RELEASE" } });
    expect(releases).toHaveLength(reserved.length);
    expect(releases.every((m) => m.reason === "Evento cancelado")).toBe(true);
    expect((await lastAudit(db, "event.cancelled", ev.id))?.after).toMatchObject({ releasedReservations: reserved.length });
  });

  test("[EVT-023] cancelar exige motivo (UI y backend) y no aplica a eventos completados", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cancelar evento con motivo corto + cancelEventAction directo sobre COMPLETED");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const completed = await createEventFixture(db, { status: "COMPLETED" });
    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    await panel.getByRole("button", { name: "Cancelar evento" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancelar evento" });
    await dialog.getByLabel("Motivo de la cancelación").fill("no");
    await dialog.getByRole("button", { name: "Cancelar evento" }).click();
    await expect(dialog.getByText("Escribe el motivo de la cancelación (mín. 5 caracteres)")).toBeVisible();
    await dialog.getByRole("button", { name: "Volver" }).click();
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CONFIRMED");

    const api = await apiAs("owner");
    const short = await callAction(api, "cancelEventAction", { eventId: ev.id, reason: "   ab  ", notifyCustomer: false }, { path: `/admin/events/${ev.id}` });
    expect(short.code, d(short)).toBe("VALIDATION_ERROR");
    const done = await callAction(api, "cancelEventAction", { eventId: completed.id, reason: "Intento sobre evento completado", notifyCustomer: false }, { path: `/admin/events/${completed.id}` });
    expect(done.code, d(done)).toBe("INVALID_TRANSITION");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CONFIRMED");
    expect((await db.event.findUnique({ where: { id: completed.id } }))?.status).toBe("COMPLETED");
    // En un evento completado la UI no ofrece cancelar
    const p2 = await openStatus(page, completed.id);
    await expect(p2.getByRole("button", { name: "Cancelar evento" })).toHaveCount(0);
  });

  test("[EVT-024] al cancelar, un checkout de anticipo PENDIENTE no debe poder cobrarse", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Clienta abre checkout del anticipo → la fundadora cancela el evento → la clienta paga el enlace abierto");
    test.info().annotations.push({ type: "bug", description: "EVX-BUG-01" });
    const ev = await createEventFixture(db, { status: "PENDING_PAYMENT", booking: { totalCents: 1_200_000, depositCents: 600_000 } });
    // 1) La clienta inicia el pago del anticipo desde su portal (checkout del proveedor mock)
    const client = await anonPage();
    await client.goto(ev.portalPath);
    const pay = client.getByRole("button", { name: /Pagar anticipo/ }).first();
    await waitHydrated(pay);
    await pay.click();
    await client.waitForURL(/\/pago\/mock\/mock_cs_/);
    const checkoutUrl = client.url();
    const pending = await db.payment.findFirst({ where: { bookingId: ev.bookingId!, status: "PENDING", kind: "DEPOSIT" } });
    expect(pending?.providerCheckoutId).toBeTruthy();

    // 2) La fundadora cancela el evento
    const page = await rolePage("owner");
    const panel = await openStatus(page, ev.id);
    await panel.getByRole("button", { name: "Cancelar evento" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancelar evento" });
    await dialog.getByLabel("Motivo de la cancelación").fill("Cancelación con checkout abierto (E2E)");
    await dialog.getByRole("button", { name: "Cancelar evento" }).click();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CANCELLED");
    const afterCancel = await db.payment.findUnique({ where: { id: pending!.id } });
    test.info().annotations.push({ type: "estado del pago tras cancelar", description: afterCancel!.status });

    // 3) La clienta vuelve al enlace de pago que tenía abierto e intenta pagar
    await client.goto(checkoutUrl);
    const payMock = client.getByRole("button", { name: /\(simulado\)/ });
    if (await payMock.isVisible()) {
      await waitHydrated(payMock);
      await payMock.click();
      await client.waitForURL(/\/pago\/resultado|\/mi-evento\//, { timeout: 30_000 }).catch(() => undefined);
    }
    const final = await db.payment.findUnique({ where: { id: pending!.id } });
    test.info().annotations.push({ type: "estado final del pago", description: final!.status });
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CANCELLED");
    expect(final!.status, "un evento cancelado no debe cobrar el anticipo de un checkout abierto").not.toBe("PAID");
  });
});
