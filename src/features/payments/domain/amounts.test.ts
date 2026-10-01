import { describe, expect, it } from "vitest";
import {
  checkoutAmountCents,
  checkoutLinkState,
  estimateFeeCents,
  isReusablePendingCheckout,
  maxManualAmountCents,
  planRefund,
  refundableCents,
  shouldConfirmEvent,
  summarizeBooking,
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

describe("checkoutLinkState", () => {
  const now = new Date("2026-10-01T18:00:00Z");
  const pending = { kind: "DEPOSIT", status: "PENDING", amountCents: 500_000, createdAt: new Date(now.getTime() - 5 * 60_000) };
  it("payable si el monto sigue vigente y no expiró", () => {
    expect(checkoutLinkState(pending, booking, [], now)).toBe("payable");
  });
  it("processed / expired / stale", () => {
    expect(checkoutLinkState({ ...pending, status: "PAID" }, booking, [], now)).toBe("processed");
    expect(checkoutLinkState({ ...pending, createdAt: new Date(now.getTime() - 2 * 60 * 60_000) }, booking, [], now)).toBe("expired");
    expect(checkoutLinkState(pending, booking, [paid(100_000)], now)).toBe("stale");
    expect(checkoutLinkState({ ...pending, kind: "BALANCE", amountCents: 1_000_000 }, booking, [paid(500_000)], now)).toBe("stale");
    expect(checkoutLinkState({ ...pending, kind: "BALANCE", amountCents: 500_000 }, booking, [paid(500_000)], now)).toBe("payable");
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
