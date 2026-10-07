import { describe, expect, it } from "vitest";
import {
  CANCELLED_CHECKOUT_REASON,
  REFUND_REQUIRED_NOTE_PREFIX,
  checkoutAmountCents,
  checkoutLinkState,
  checkoutOpeningState,
  estimateFeeCents,
  isBookingCancelled,
  isCollectedPaymentStatus,
  isPaidAfterCancellation,
  isReusablePendingCheckout,
  maxManualAmountCents,
  paymentStatusView,
  planRefund,
  refundableCents,
  shouldConfirmEvent,
  summarizeBooking,
  wasCollectedAfterCancellation,
} from "./amounts";
import type { PaymentLike } from "./payment-status";
import { paymentResultPath, signPaymentResult, verifyPaymentResult } from "./result-signature";
import { paymentLinkMessage } from "./share-message";

const booking = { totalCents: 1_000_000, depositRequiredCents: 500_000 };
const paid = (amountCents: number, extra: Partial<PaymentLike> = {}): PaymentLike => ({
  kind: "DEPOSIT",
  status: "PAID",
  amountCents,
  refundedCents: 0,
  ...extra,
});

describe("checkoutAmountCents", () => {
  it("anticipo = anticipo requerido − pagado neto", () => {
    expect(checkoutAmountCents("DEPOSIT", booking, [])).toEqual({ ok: true, amountCents: 500_000 });
    expect(checkoutAmountCents("DEPOSIT", booking, [paid(200_000)])).toEqual({ ok: true, amountCents: 300_000 });
  });
  it("anticipo cubierto → bloqueo DEPOSIT_COVERED", () => {
    expect(checkoutAmountCents("DEPOSIT", booking, [paid(500_000)])).toEqual({ ok: false, reason: "DEPOSIT_COVERED" });
    expect(checkoutAmountCents("DEPOSIT", booking, [paid(700_000)])).toEqual({ ok: false, reason: "DEPOSIT_COVERED" });
  });
  it("saldo y pago completo = total − pagado neto", () => {
    expect(checkoutAmountCents("BALANCE", booking, [paid(500_000)])).toEqual({ ok: true, amountCents: 500_000 });
    expect(checkoutAmountCents("FULL", booking, [])).toEqual({ ok: true, amountCents: 1_000_000 });
  });
  it("sin saldo → NO_BALANCE", () => {
    expect(checkoutAmountCents("BALANCE", booking, [paid(1_000_000)])).toEqual({ ok: false, reason: "NO_BALANCE" });
    expect(checkoutAmountCents("FULL", booking, [paid(400_000), paid(600_000, { kind: "BALANCE" })])).toEqual({
      ok: false,
      reason: "NO_BALANCE",
    });
  });
  it("ignora pagos pendientes/fallidos y descuenta reembolsos", () => {
    const payments: PaymentLike[] = [
      paid(500_000, { status: "PARTIAL_REFUND", refundedCents: 100_000 }),
      paid(300_000, { status: "PENDING" }),
      paid(300_000, { status: "FAILED" }),
      { kind: "REFUND", status: "PAID", amountCents: 100_000, refundedCents: 0 },
    ];
    expect(checkoutAmountCents("DEPOSIT", booking, payments)).toEqual({ ok: true, amountCents: 100_000 });
    expect(checkoutAmountCents("BALANCE", booking, payments)).toEqual({ ok: true, amountCents: 600_000 });
  });
});

describe("estimateFeeCents", () => {
  it("bps + fijo, redondeado", () => {
    expect(estimateFeeCents(500_000, { paymentFeeBps: 360, paymentFeeFixedCents: 300 })).toBe(18_300);
    expect(estimateFeeCents(12_345, { paymentFeeBps: 360, paymentFeeFixedCents: 300 })).toBe(744);
  });
  it("0 para montos no positivos", () => {
    expect(estimateFeeCents(0, { paymentFeeBps: 360, paymentFeeFixedCents: 300 })).toBe(0);
    expect(estimateFeeCents(-5, { paymentFeeBps: 360, paymentFeeFixedCents: 300 })).toBe(0);
  });
});

describe("isReusablePendingCheckout", () => {
  const now = new Date("2026-10-01T18:00:00Z");
  const base = {
    kind: "DEPOSIT",
    status: "PENDING",
    amountCents: 500_000,
    provider: "mock",
    checkoutUrl: "http://x/pago/mock/mock_cs_abc",
    createdAt: new Date(now.getTime() - 10 * 60_000),
  };
  const wanted = { kind: "DEPOSIT" as const, amountCents: 500_000, provider: "mock" };
  it("reutiliza mismo tipo + monto + proveedor < 1 h", () => {
    expect(isReusablePendingCheckout(base, wanted, now)).toBe(true);
  });
  it("no reutiliza si cambió algo o es viejo", () => {
    expect(isReusablePendingCheckout({ ...base, amountCents: 1 }, wanted, now)).toBe(false);
    expect(isReusablePendingCheckout({ ...base, kind: "BALANCE" }, wanted, now)).toBe(false);
    expect(isReusablePendingCheckout({ ...base, status: "FAILED" }, wanted, now)).toBe(false);
    expect(isReusablePendingCheckout({ ...base, checkoutUrl: null }, wanted, now)).toBe(false);
    expect(isReusablePendingCheckout({ ...base, provider: "stripe" }, wanted, now)).toBe(false);
    expect(isReusablePendingCheckout({ ...base, createdAt: new Date(now.getTime() - 61 * 60_000) }, wanted, now)).toBe(false);
  });
});

describe("checkoutOpeningState (pago reservado mientras la pasarela abre la sesión)", () => {
  const now = new Date("2026-10-01T18:00:00Z");
  const WINDOW = 20_000;
  const reserved = {
    kind: "DEPOSIT",
    status: "PENDING",
    amountCents: 500_000,
    provider: "mock",
    checkoutUrl: null,
    createdAt: new Date(now.getTime() - 3_000),
  };
  const wanted = { kind: "DEPOSIT" as const, amountCents: 500_000, provider: "mock" };
  it("mismo cobro reservado hace poco y sin URL: otra solicitud lo está abriendo (esperar y reutilizar)", () => {
    expect(checkoutOpeningState(reserved, wanted, now, WINDOW)).toBe("opening");
  });
  it("sin URL más allá de la ventana: abandonado (de cualquier tipo, monto o proveedor)", () => {
    const old = { ...reserved, createdAt: new Date(now.getTime() - WINDOW) };
    expect(checkoutOpeningState(old, wanted, now, WINDOW)).toBe("abandoned");
    expect(checkoutOpeningState({ ...old, kind: "BALANCE", amountCents: 1, provider: "stripe" }, wanted, now, WINDOW)).toBe("abandoned");
  });
  it("no aplica: ya publicado, otro estado, otro cobro vigente o filas que no son de checkout", () => {
    expect(checkoutOpeningState({ ...reserved, checkoutUrl: "http://x/pago/mock/cs" }, wanted, now, WINDOW)).toBeNull();
    expect(checkoutOpeningState({ ...reserved, status: "FAILED" }, wanted, now, WINDOW)).toBeNull();
    expect(checkoutOpeningState({ ...reserved, kind: "BALANCE" }, wanted, now, WINDOW)).toBeNull();
    expect(checkoutOpeningState({ ...reserved, amountCents: 100 }, wanted, now, WINDOW)).toBeNull();
    expect(checkoutOpeningState({ ...reserved, provider: "stripe" }, wanted, now, WINDOW)).toBeNull();
    expect(checkoutOpeningState({ ...reserved, kind: "REFUND", createdAt: new Date(0) }, wanted, now, WINDOW)).toBeNull();
  });
});

describe("isBookingCancelled / isCollectedPaymentStatus", () => {
  it("una reserva está cancelada si ella o su evento lo están", () => {
    expect(isBookingCancelled({ cancelledAt: null, event: { status: "PENDING_PAYMENT" } })).toBe(false);
    expect(isBookingCancelled({ cancelledAt: null, event: { status: "CONFIRMED" } })).toBe(false);
    expect(isBookingCancelled({ cancelledAt: new Date(), event: { status: "PENDING_PAYMENT" } })).toBe(true);
    expect(isBookingCancelled({ cancelledAt: null, event: { status: "CANCELLED" } })).toBe(true);
    expect(isBookingCancelled({ cancelledAt: new Date(), event: { status: "CANCELLED" } })).toBe(true);
  });
  it("sólo PAID / PARTIAL_REFUND / REFUNDED cuentan como dinero cobrado", () => {
    expect(isCollectedPaymentStatus("PAID")).toBe(true);
    expect(isCollectedPaymentStatus("PARTIAL_REFUND")).toBe(true);
    expect(isCollectedPaymentStatus("REFUNDED")).toBe(true);
    expect(isCollectedPaymentStatus("PENDING")).toBe(false);
    expect(isCollectedPaymentStatus("FAILED")).toBe(false);
  });
});

describe("wasCollectedAfterCancellation / isPaidAfterCancellation", () => {
  const note = `${REFUND_REQUIRED_NOTE_PREFIX}: la pasarela confirmó este cobro cuando el evento ya estaba cancelado.`;
  it("lo determina la nota del propio pago, no el estado del evento", () => {
    expect(wasCollectedAfterCancellation({ status: "PAID", notes: note })).toBe(true);
    expect(wasCollectedAfterCancellation({ status: "PARTIAL_REFUND", notes: `${note} · otra nota` })).toBe(true);
    expect(wasCollectedAfterCancellation({ status: "REFUNDED", notes: note })).toBe(true);
    // Un anticipo pagado normalmente (sin nota) nunca es un cobro tardío, aunque el evento se cancele después.
    expect(wasCollectedAfterCancellation({ status: "PAID", notes: null })).toBe(false);
    expect(wasCollectedAfterCancellation({ status: "PAID", notes: "Transferencia BBVA" })).toBe(false);
    expect(wasCollectedAfterCancellation({ status: "PAID", notes: `Nota previa · ${note}` })).toBe(false);
    // Sin cobro no hay nada que reembolsar.
    expect(wasCollectedAfterCancellation({ status: "PENDING", notes: note })).toBe(false);
    expect(wasCollectedAfterCancellation({ status: "FAILED", notes: note })).toBe(false);
  });
  it("detecta cobros registrados después de la cancelación (casos sin nota)", () => {
    const cancelledAt = new Date("2026-09-10T18:00:00Z");
    const after = new Date(cancelledAt.getTime() + 60_000);
    const before = new Date(cancelledAt.getTime() - 60_000);
    expect(isPaidAfterCancellation({ kind: "DEPOSIT", status: "PAID", paidAt: after }, cancelledAt)).toBe(true);
    expect(isPaidAfterCancellation({ kind: "BALANCE", status: "REFUNDED", paidAt: after }, cancelledAt)).toBe(true);
    expect(isPaidAfterCancellation({ kind: "DEPOSIT", status: "PAID", paidAt: before }, cancelledAt)).toBe(false);
    expect(isPaidAfterCancellation({ kind: "DEPOSIT", status: "PAID", paidAt: cancelledAt }, cancelledAt)).toBe(false);
    expect(isPaidAfterCancellation({ kind: "DEPOSIT", status: "FAILED", paidAt: after }, cancelledAt)).toBe(false);
    expect(isPaidAfterCancellation({ kind: "REFUND", status: "PAID", paidAt: after }, cancelledAt)).toBe(false);
    expect(isPaidAfterCancellation({ kind: "DEPOSIT", status: "PAID", paidAt: null }, cancelledAt)).toBe(false);
    expect(isPaidAfterCancellation({ kind: "DEPOSIT", status: "PAID", paidAt: after }, null)).toBe(false);
  });
});

describe("paymentStatusView", () => {
  const live = { cancelledAt: null, event: { status: "PENDING_PAYMENT" } };
  const cancelled = { cancelledAt: new Date(), event: { status: "CANCELLED" } };
  const note = `${REFUND_REQUIRED_NOTE_PREFIX}: cobro tardío`;
  it("pago pendiente de un evento vivo", () => {
    expect(paymentStatusView({ status: "PENDING", failureReason: null, notes: null }, live)).toEqual({
      status: "PENDING",
      eventConfirmed: false,
      eventCancelled: false,
      collectedAfterCancellation: false,
      failureReason: null,
    });
    expect(
      paymentStatusView({ status: "PAID", failureReason: null, notes: null }, { ...live, event: { status: "PLANNING" } }),
    ).toMatchObject({ eventConfirmed: true, eventCancelled: false });
  });
  it("cobro tardío sobre un evento cancelado vs. pago normal de un evento cancelado después", () => {
    expect(paymentStatusView({ status: "PAID", failureReason: null, notes: note }, cancelled)).toMatchObject({
      eventCancelled: true,
      collectedAfterCancellation: true,
    });
    expect(paymentStatusView({ status: "PAID", failureReason: null, notes: null }, cancelled)).toMatchObject({
      eventCancelled: true,
      collectedAfterCancellation: false,
    });
    // La cancelación de la reserva basta aunque el evento aún no lo refleje.
    expect(
      paymentStatusView({ status: "PENDING", failureReason: null, notes: null }, { ...live, cancelledAt: new Date() }).eventCancelled,
    ).toBe(true);
  });
  it("sólo expone el motivo de un pago fallido (p. ej. el checkout anulado al cancelar)", () => {
    expect(paymentStatusView({ status: "FAILED", failureReason: CANCELLED_CHECKOUT_REASON, notes: null }, cancelled)).toMatchObject({
      status: "FAILED",
      failureReason: CANCELLED_CHECKOUT_REASON,
      eventCancelled: true,
    });
    expect(paymentStatusView({ status: "PAID", failureReason: "viejo", notes: null }, live).failureReason).toBeNull();
  });
});

describe("checkoutLinkState", () => {
  const now = new Date("2026-10-01T18:00:00Z");
  const live = { ...booking, cancelledAt: null, event: { status: "PENDING_PAYMENT" } };
  const pending = { kind: "DEPOSIT", status: "PENDING", amountCents: 500_000, createdAt: new Date(now.getTime() - 5 * 60_000) };
  it("payable si el monto sigue vigente y no expiró", () => {
    expect(checkoutLinkState(pending, live, [], now)).toBe("payable");
  });
  it("processed / expired / stale", () => {
    expect(checkoutLinkState({ ...pending, status: "PAID" }, live, [], now)).toBe("processed");
    expect(checkoutLinkState({ ...pending, status: "FAILED" }, live, [], now)).toBe("processed");
    expect(checkoutLinkState({ ...pending, createdAt: new Date(now.getTime() - 2 * 60 * 60_000) }, live, [], now)).toBe("expired");
    expect(checkoutLinkState(pending, live, [paid(100_000)], now)).toBe("stale");
    expect(checkoutLinkState({ ...pending, kind: "BALANCE", amountCents: 1_000_000 }, live, [paid(500_000)], now)).toBe("stale");
    expect(checkoutLinkState({ ...pending, kind: "BALANCE", amountCents: 500_000 }, live, [paid(500_000)], now)).toBe("payable");
  });
  it("cancelled: una reserva o evento cancelado nunca se puede pagar (aunque el enlace siga vigente)", () => {
    const byBooking = { ...live, cancelledAt: new Date(now.getTime() - 60_000) };
    const byEvent = { ...live, event: { status: "CANCELLED" } };
    expect(checkoutLinkState(pending, byBooking, [], now)).toBe("cancelled");
    expect(checkoutLinkState(pending, byEvent, [], now)).toBe("cancelled");
    // El checkout anulado al cancelar (FAILED) también se muestra como cancelado, no como «procesado».
    expect(checkoutLinkState({ ...pending, status: "FAILED" }, byBooking, [], now)).toBe("cancelled");
    // La cancelación manda sobre la expiración y el saldo desactualizado.
    expect(checkoutLinkState({ ...pending, createdAt: new Date(now.getTime() - 2 * 60 * 60_000) }, byEvent, [], now)).toBe("cancelled");
    expect(checkoutLinkState(pending, byEvent, [paid(100_000)], now)).toBe("cancelled");
  });
  it("un cobro ya registrado sigue como processed aunque después se cancele el evento", () => {
    const cancelled = { ...live, cancelledAt: new Date(now.getTime() - 60_000), event: { status: "CANCELLED" } };
    expect(checkoutLinkState({ ...pending, status: "PAID" }, cancelled, [], now)).toBe("processed");
    expect(checkoutLinkState({ ...pending, status: "PARTIAL_REFUND" }, cancelled, [], now)).toBe("processed");
    expect(checkoutLinkState({ ...pending, status: "REFUNDED" }, cancelled, [], now)).toBe("processed");
  });
});

describe("shouldConfirmEvent", () => {
  it("confirma sólo desde INQUIRY/PENDING_PAYMENT con anticipo cubierto", () => {
    expect(shouldConfirmEvent("PENDING_PAYMENT", 500_000, [paid(500_000)])).toBe(true);
    expect(shouldConfirmEvent("INQUIRY", 500_000, [paid(600_000)])).toBe(true);
    expect(shouldConfirmEvent("PENDING_PAYMENT", 500_000, [paid(499_999)])).toBe(false);
    expect(shouldConfirmEvent("CONFIRMED", 500_000, [paid(500_000)])).toBe(false);
    expect(shouldConfirmEvent("CANCELLED", 500_000, [paid(500_000)])).toBe(false);
  });
});

describe("planRefund / refundableCents", () => {
  it("parcial → PARTIAL_REFUND, total → REFUNDED", () => {
    expect(planRefund(paid(500_000), 100_000)).toEqual({ ok: true, newRefundedCents: 100_000, nextStatus: "PARTIAL_REFUND" });
    expect(planRefund(paid(500_000), 500_000)).toEqual({ ok: true, newRefundedCents: 500_000, nextStatus: "REFUNDED" });
    expect(planRefund(paid(500_000, { status: "PARTIAL_REFUND", refundedCents: 100_000 }), 400_000)).toEqual({
      ok: true,
      newRefundedCents: 500_000,
      nextStatus: "REFUNDED",
    });
    expect(planRefund(paid(500_000, { status: "PARTIAL_REFUND", refundedCents: 100_000 }), 1_000)).toEqual({
      ok: true,
      newRefundedCents: 101_000,
      nextStatus: "PARTIAL_REFUND",
    });
  });
  it("rechaza montos inválidos o pagos no cobrados", () => {
    expect(planRefund(paid(500_000), 500_001).ok).toBe(false);
    expect(planRefund(paid(500_000), 0).ok).toBe(false);
    expect(planRefund(paid(500_000), 10.5).ok).toBe(false);
    expect(planRefund(paid(500_000, { status: "PENDING" }), 100).ok).toBe(false);
    expect(planRefund(paid(500_000, { status: "REFUNDED", refundedCents: 500_000 }), 100).ok).toBe(false);
    expect(planRefund({ kind: "REFUND", status: "PAID", amountCents: 100, refundedCents: 0 }, 50).ok).toBe(false);
  });
  it("refundableCents", () => {
    expect(refundableCents(paid(500_000, { status: "PARTIAL_REFUND", refundedCents: 200_000 }))).toBe(300_000);
    expect(refundableCents(paid(500_000, { status: "FAILED" }))).toBe(0);
  });
});

describe("summarizeBooking / maxManualAmountCents", () => {
  it("resume cobranza con comisiones y reembolsos", () => {
    const s = summarizeBooking(booking, [
      { ...paid(500_000, { status: "PARTIAL_REFUND", refundedCents: 50_000 }), feeCents: 18_300 },
      { ...paid(200_000, { kind: "BALANCE", status: "PENDING" }), feeCents: 0 },
      { kind: "REFUND", status: "PAID", amountCents: 50_000, refundedCents: 0, feeCents: 0 },
    ]);
    expect(s).toMatchObject({
      netPaidCents: 450_000,
      balanceDueCents: 550_000,
      depositDueCents: 50_000,
      depositSatisfied: false,
      refundedCents: 50_000,
      feesCents: 18_300,
      pendingCount: 1,
    });
    expect(maxManualAmountCents(booking, [paid(450_000)])).toBe(550_000);
  });
});

describe("firma del enlace de resultado", () => {
  const secret = "test-secret";
  const id = "cmabc123def456ghi789jkl0";
  it("verifica la firma correcta y rechaza alteraciones", () => {
    const sig = signPaymentResult(id, secret);
    expect(verifyPaymentResult(id, sig, secret)).toBe(true);
    expect(verifyPaymentResult(id, sig, "otro-secreto")).toBe(false);
    expect(verifyPaymentResult("cmabc123def456ghi789jkl1", sig, secret)).toBe(false);
    expect(verifyPaymentResult(id, `${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, secret)).toBe(false);
    expect(verifyPaymentResult(id, null, secret)).toBe(false);
    expect(verifyPaymentResult("../../etc", sig, secret)).toBe(false);
  });
  it("arma la ruta /pago/resultado", () => {
    expect(paymentResultPath(id, secret)).toBe(`/pago/resultado?p=${id}&s=${signPaymentResult(id, secret)}`);
  });
});

describe("paymentLinkMessage", () => {
  it("menciona anticipo pendiente o saldo con fecha", () => {
    const deposit = paymentLinkMessage({
      customerName: "Fernanda López",
      eventTitle: "Baby Brunch",
      depositLabel: "$5,000",
      balanceLabel: "$10,000",
      url: "https://x/mi-evento/t",
    });
    expect(deposit).toContain("¡Hola, Fernanda!");
    expect(deposit).toContain("anticipo de $5,000");
    expect(deposit).toContain("https://x/mi-evento/t");
    const balance = paymentLinkMessage({
      customerName: "Ana",
      eventTitle: "Brunch",
      balanceLabel: "$4,000",
      dueDateLabel: "viernes 9 de octubre de 2026",
      url: "u",
    });
    expect(balance).toContain("saldo pendiente es de $4,000 (fecha límite: viernes 9 de octubre de 2026)");
  });
});
