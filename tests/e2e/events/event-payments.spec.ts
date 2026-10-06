/**
 * Pagos manuales y reembolsos desde el evento (payments:manual): montos en centavos, saldo recalculado,
 * confirmación automática al cubrir el anticipo, auditoría, notificaciones y autorización.
 * Paquete 4 · carril 4 · prefijo EVT.
 */
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  addDaysKey,
  callAction,
  createEventFixture,
  describe as d,
  formatMXN,
  lastAudit,
  todayKey,
  waitHydrated,
} from "./_helpers";

const TOTAL = 1_250_000; // $12,500
const DEPOSIT = 625_000; // $6,250 (50 %)

async function openPayments(page: Page, id: string) {
  await page.goto(`/admin/events/${id}`);
  const panel = page.getByRole("region", { name: "Pagos" });
  await expect(panel).toBeVisible();
  return panel;
}

function manualInput(eventId: string, patch: Record<string, unknown> = {}) {
  return {
    eventId,
    amountCents: 100_000,
    kind: "BALANCE",
    method: "TRANSFER",
    paidAt: todayKey(),
    notes: "",
    receiptMediaId: "",
    ...patch,
  };
}

test.describe("Eventos · pagos manuales y reembolsos", { tag: ["@module:events"] }, () => {
  test("[EVT-025] registrar el anticipo como pago manual confirma el evento, recalcula el saldo y audita", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Evento PENDING_PAYMENT › Pagos › Registrar pago manual (transferencia)");
    const ev = await createEventFixture(db, { status: "PENDING_PAYMENT", booking: { totalCents: TOTAL, depositCents: DEPOSIT } });
    const page = await rolePage("owner");
    const panel = await openPayments(page, ev.id);
    await expect(panel).toContainText(formatMXN(TOTAL));
    await expect(panel).toContainText(`Faltan ${formatMXN(DEPOSIT)}`);
    const trigger = panel.getByRole("button", { name: "Registrar pago manual" });
    await waitHydrated(trigger);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Registrar pago manual" });
    await expect(dialog.getByLabel("Monto")).toHaveValue(String(DEPOSIT / 100));
    await dialog.getByLabel("Notas").fill("SPEI ref E2E-123");
    await dialog.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado. ¡El evento quedó confirmado!")).toBeVisible();

    const payment = await db.payment.findFirst({ where: { bookingId: ev.bookingId!, kind: "DEPOSIT" }, include: { recordedBy: true } });
    expect(payment).toMatchObject({ status: "PAID", method: "TRANSFER", provider: "manual", amountCents: DEPOSIT, feeCents: 0, notes: "SPEI ref E2E-123" });
    expect(payment?.recordedBy?.email).toBe("ivonne@ivonne-rosa.test");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.status).toBe("CONFIRMED");
    const audit = await lastAudit(db, "payment.manual_recorded", payment!.id);
    expect(audit?.after).toMatchObject({ eventId: ev.id, amountCents: DEPOSIT, method: "TRANSFER", eventConfirmed: true });
    expect(await db.auditLog.count({ where: { action: "event.confirmed_by_payment", entityId: ev.id } })).toBe(1);
    await expect.poll(() => db.notificationLog.count({ where: { eventId: ev.id, type: "PAYMENT_RECEIVED" } })).toBeGreaterThan(0);
    await expect.poll(() => db.notificationLog.count({ where: { eventId: ev.id, type: "BOOKING_CONFIRMED" } })).toBeGreaterThan(0);

    // Saldo recalculado en el panel tras recargar y en el portal de la clienta
    await page.reload();
    const p2 = page.getByRole("region", { name: "Pagos" });
    await expect(p2).toContainText("Cubierto");
    await expect(p2).toContainText(formatMXN(TOTAL - DEPOSIT));
    await expect(page.getByRole("region", { name: "Estado" })).toContainText("Confirmado");
    const client = await anonPage();
    await client.goto(ev.portalPath);
    const pago = client.getByRole("region", { name: "Pago" });
    await expect(pago).toContainText(formatMXN(DEPOSIT));
    await expect(pago).toContainText(formatMXN(TOTAL - DEPOSIT));
  });

  test("[EVT-026] un pago manual mayor al saldo pendiente se rechaza en la UI y en el backend", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Registrar pago manual por más del saldo");
    const ev = await createEventFixture(db, { status: "CONFIRMED", booking: { totalCents: TOTAL, depositCents: DEPOSIT } });
    const page = await rolePage("owner");
    const panel = await openPayments(page, ev.id);
    const trigger = panel.getByRole("button", { name: "Registrar pago manual" });
    await waitHydrated(trigger);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Registrar pago manual" });
    await dialog.getByLabel("Monto").fill(String(TOTAL / 100 + 1));
    await dialog.getByRole("button", { name: "Registrar pago" }).click();
    await expect(dialog.getByText(`El monto excede el saldo pendiente (${formatMXN(TOTAL)}).`)).toBeVisible();

    const api = await apiAs("owner");
    const r = await callAction(api, "recordManualPaymentAction", manualInput(ev.id, { amountCents: TOTAL + 1 }), { path: `/admin/events/${ev.id}` });
    expect(r.outcome, d(r)).toBe("rejected");
    expect(r.fieldErrors?.amountCents?.[0]).toBe(`El monto excede el saldo pendiente (${formatMXN(TOTAL)}).`);
    expect(await db.payment.count({ where: { bookingId: ev.bookingId! } })).toBe(0);
  });

  test("[EVT-027] pago manual: fecha futura, monto mínimo, evento cancelado y evento sin reserva se rechazan", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "recordManualPaymentAction directo con casos inválidos");
    const ev = await createEventFixture(db, { status: "CONFIRMED", booking: { totalCents: TOTAL, depositCents: DEPOSIT } });
    const cancelled = await createEventFixture(db, { status: "CANCELLED", booking: { totalCents: TOTAL, depositCents: DEPOSIT } });
    const noBooking = await createEventFixture(db, { status: "INQUIRY" });
    const api = await apiAs("owner");
    const path = `/admin/events/${ev.id}`;
    const future = await callAction(api, "recordManualPaymentAction", manualInput(ev.id, { paidAt: addDaysKey(todayKey(), 2) }), { path });
    expect(future.fieldErrors?.paidAt?.[0], d(future)).toBe("La fecha de pago no puede ser futura.");
    const tiny = await callAction(api, "recordManualPaymentAction", manualInput(ev.id, { amountCents: 99 }), { path });
    expect(tiny.fieldErrors?.amountCents?.[0], d(tiny)).toBe("El monto mínimo es $1");
    const decimals = await callAction(api, "recordManualPaymentAction", manualInput(ev.id, { amountCents: 1000.5 }), { path });
    expect(decimals.fieldErrors?.amountCents?.[0], d(decimals)).toBe("El monto debe estar en centavos");
    const badMethod = await callAction(api, "recordManualPaymentAction", manualInput(ev.id, { method: "ONLINE" }), { path });
    expect(badMethod.fieldErrors?.method?.[0], d(badMethod)).toBe("Elige el método");
    const onCancelled = await callAction(api, "recordManualPaymentAction", manualInput(cancelled.id), { path });
    expect(onCancelled.code, d(onCancelled)).toBe("EVENT_CANCELLED");
    const withoutBooking = await callAction(api, "recordManualPaymentAction", manualInput(noBooking.id), { path });
    expect(withoutBooking.code, d(withoutBooking)).toBe("NO_BOOKING");
    expect(await db.payment.count({ where: { bookingId: { in: [ev.bookingId!, cancelled.bookingId!] } } })).toBe(0);
  });

  test("[EVT-028] reembolso parcial de un pago cobrado: estado, fila REFUND, auditoría y saldo", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Pagos › Reembolsar anticipo › parcial $1,000");
    const ev = await createEventFixture(db, {
      status: "CONFIRMED",
      booking: { totalCents: TOTAL, depositCents: DEPOSIT },
      payments: [{ kind: "DEPOSIT", status: "PAID", method: "TRANSFER", provider: "manual", amountCents: DEPOSIT }],
    });
    const paymentId = ev.paymentIds[0]!;
    const page = await rolePage("owner");
    const panel = await openPayments(page, ev.id);
    const trigger = panel.getByRole("button", { name: `Reembolsar anticipo de ${formatMXN(DEPOSIT)}` });
    await waitHydrated(trigger);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Reembolsar pago" });
    await expect(dialog.getByLabel("Monto a reembolsar")).toHaveValue(String(DEPOSIT / 100));
    await dialog.getByLabel("Monto a reembolsar").fill("1000");
    await dialog.getByLabel("Motivo").fill("Ajuste de invitadas (E2E)");
    await dialog.getByRole("button", { name: `Reembolsar ${formatMXN(100_000)}` }).click();
    await expect(page.getByText("Reembolso parcial registrado")).toBeVisible();

    const original = await db.payment.findUnique({ where: { id: paymentId } });
    expect(original).toMatchObject({ status: "PARTIAL_REFUND", refundedCents: 100_000 });
    const refund = await db.payment.findFirst({ where: { refundOfId: paymentId, kind: "REFUND" }, include: { recordedBy: true } });
    expect(refund).toMatchObject({ status: "PAID", amountCents: 100_000, notes: "Ajuste de invitadas (E2E)" });
    expect(refund?.recordedBy?.email).toBe("ivonne@ivonne-rosa.test");
    const audit = await lastAudit(db, "payment.refunded", paymentId);
    expect(audit?.before).toMatchObject({ status: "PAID", refundedCents: 0 });
    expect(audit?.after).toMatchObject({ status: "PARTIAL_REFUND", refundedCents: 100_000, refundAmountCents: 100_000 });

    await page.reload();
    const p2 = page.getByRole("region", { name: "Pagos" });
    // Pagado neto = 6,250 − 1,000 = 5,250; saldo = 12,500 − 5,250
    await expect(p2).toContainText(formatMXN(DEPOSIT - 100_000));
    await expect(p2).toContainText(formatMXN(TOTAL - (DEPOSIT - 100_000)));
    await expect(p2).toContainText(`Reembolsado ${formatMXN(100_000)}`);
  });

  test("[EVT-029] reembolsos inválidos: mayor a lo disponible, pago pendiente, fila de reembolso y doble reembolso total", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "refundPaymentAction directo con montos/estados inválidos");
    const ev = await createEventFixture(db, {
      status: "CONFIRMED",
      booking: { totalCents: TOTAL, depositCents: DEPOSIT },
      payments: [
        { kind: "DEPOSIT", status: "PAID", method: "CASH", provider: "manual", amountCents: DEPOSIT },
        { kind: "BALANCE", status: "PENDING", method: "ONLINE", provider: "mock", amountCents: TOTAL - DEPOSIT },
      ],
    });
    const [paid, pendingId] = ev.paymentIds as [string, string];
    const api = await apiAs("owner");
    const path = `/admin/events/${ev.id}`;
    const tooMuch = await callAction(api, "refundPaymentAction", { paymentId: paid, amountCents: DEPOSIT + 1, reason: "Exceso" }, { path });
    expect(tooMuch.fieldErrors?.amountCents?.[0], d(tooMuch)).toBe("El monto excede lo disponible para reembolsar.");
    const pending = await callAction(api, "refundPaymentAction", { paymentId: pendingId, amountCents: 100, reason: "Pendiente" }, { path });
    expect(pending.fieldErrors?.amountCents?.[0], d(pending)).toBe("Sólo se pueden reembolsar pagos cobrados.");
    const zero = await callAction(api, "refundPaymentAction", { paymentId: paid, amountCents: 0, reason: "Cero" }, { path });
    expect(zero.code, d(zero)).toBe("VALIDATION_ERROR");
    const noReason = await callAction(api, "refundPaymentAction", { paymentId: paid, amountCents: 100, reason: "" }, { path });
    expect(noReason.fieldErrors?.reason?.[0], d(noReason)).toBe("Cuéntanos el motivo (mín. 3 caracteres)");

    const full = await callAction(api, "refundPaymentAction", { paymentId: paid, amountCents: DEPOSIT, reason: "Cancelación total" }, { path });
    expect(full.outcome, d(full)).toBe("accepted");
    expect((await db.payment.findUnique({ where: { id: paid } }))).toMatchObject({ status: "REFUNDED", refundedCents: DEPOSIT });
    const again = await callAction(api, "refundPaymentAction", { paymentId: paid, amountCents: 100, reason: "Otra vez" }, { path });
    expect(again.fieldErrors?.amountCents?.[0], d(again)).toBe("Sólo se pueden reembolsar pagos cobrados.");
    const refundRow = await db.payment.findFirst({ where: { refundOfId: paid, kind: "REFUND" } });
    const ofRefund = await callAction(api, "refundPaymentAction", { paymentId: refundRow!.id, amountCents: 100, reason: "Reembolso de reembolso" }, { path });
    expect(ofRefund.fieldErrors?.amountCents?.[0], d(ofRefund)).toBe("Un reembolso no se puede reembolsar.");
    expect(await db.payment.count({ where: { refundOfId: paid, kind: "REFUND" } }), "sólo el reembolso total válido").toBe(1);
  });

  test("[EVT-030] staff y anónimo no pueden registrar pagos ni reembolsar aunque fuercen el request", { tag: ["@P0", "@permissions"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("staff", "replay de recordManualPaymentAction / refundPaymentAction como staff y anónimo");
    const ev = await createEventFixture(db, {
      status: "CONFIRMED",
      booking: { totalCents: TOTAL, depositCents: DEPOSIT },
      payments: [{ kind: "DEPOSIT", status: "PAID", method: "CASH", provider: "manual", amountCents: DEPOSIT }],
    });
    const path = `/admin/events/${ev.id}`;
    for (const role of ["staff", null] as const) {
      const api = await apiAs(role);
      const pay = await callAction(api, "recordManualPaymentAction", manualInput(ev.id, { amountCents: 50_000 }), { path });
      expect(pay.outcome, `${role ?? "anónimo"} pago: ${d(pay)}`).toBe("denied");
      const refund = await callAction(api, "refundPaymentAction", { paymentId: ev.paymentIds[0], amountCents: 100, reason: "Forzado" }, { path });
      expect(refund.outcome, `${role ?? "anónimo"} reembolso: ${d(refund)}`).toBe("denied");
    }
    expect(await db.payment.count({ where: { bookingId: ev.bookingId! } }), "nada cambió").toBe(1);
    expect((await db.payment.findUnique({ where: { id: ev.paymentIds[0]! } }))?.refundedCents).toBe(0);
    // La UI del staff no llega al panel
    const staff = await rolePage("staff");
    await staff.goto(path);
    await expect(staff).toHaveURL(/\/staff/);
    // Control positivo: la fundadora sí puede
    const owner = await apiAs("owner");
    const ok = await callAction(owner, "recordManualPaymentAction", manualInput(ev.id, { amountCents: 50_000 }), { path });
    expect(ok.outcome, d(ok)).toBe("accepted");
  });
});
