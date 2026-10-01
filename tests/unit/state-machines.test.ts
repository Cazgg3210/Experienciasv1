import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "@/lib/state-machine";
import { leadStatusMachine } from "@/features/leads/domain/lead-status";
import { quoteStatusMachine, isQuoteEditable, isQuoteExpired } from "@/features/quotes/domain/quote-status";
import { eventStatusMachine, canCloseEvent } from "@/features/events/domain/event-status";
import {
  balanceDueCents,
  isDepositSatisfied,
  netPaidCents,
  paymentStatusMachine,
  statusAfterRefund,
  type PaymentLike,
} from "@/features/payments/domain/payment-status";
import { purchaseStatusMachine } from "@/features/purchases/domain/purchase-status";

describe("Lead state machine", () => {
  it("sigue el pipeline comercial", () => {
    expect(leadStatusMachine.can("NEW", "CONTACTED")).toBe(true);
    expect(leadStatusMachine.can("QUOTED", "WON")).toBe(true);
    expect(leadStatusMachine.can("NEW", "WON")).toBe(false);
    expect(leadStatusMachine.isTerminal("WON")).toBe(true);
  });
  it("permite reactivar un lead perdido", () => {
    expect(leadStatusMachine.can("LOST", "NEW")).toBe(true);
  });
  it("lanza error en transición inválida", () => {
    expect(() => leadStatusMachine.assert("WON", "LOST")).toThrow(InvalidTransitionError);
  });
});

describe("Quote state machine", () => {
  it("borrador → enviada → aceptada", () => {
    expect(quoteStatusMachine.can("DRAFT", "SENT")).toBe(true);
    expect(quoteStatusMachine.can("SENT", "ACCEPTED")).toBe(true);
    expect(quoteStatusMachine.can("DRAFT", "ACCEPTED")).toBe(false);
    expect(quoteStatusMachine.isTerminal("ACCEPTED")).toBe(true);
  });
  it("una aceptada no puede expirar ni rechazarse", () => {
    expect(quoteStatusMachine.can("ACCEPTED", "EXPIRED")).toBe(false);
    expect(quoteStatusMachine.can("ACCEPTED", "REJECTED")).toBe(false);
  });
  it("sólo borradores son editables y detecta expiración", () => {
    expect(isQuoteEditable("DRAFT")).toBe(true);
    expect(isQuoteEditable("SENT")).toBe(false);
    expect(isQuoteExpired(new Date("2020-01-01"), new Date("2020-01-02"))).toBe(true);
    expect(isQuoteExpired(null)).toBe(false);
  });
});

describe("Event state machine", () => {
  it("sigue el ciclo operativo", () => {
    const path = ["PENDING_PAYMENT", "CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(eventStatusMachine.can(path[i]!, path[i + 1]!)).toBe(true);
    }
  });
  it("no permite cancelar un evento en curso o completado", () => {
    expect(eventStatusMachine.can("IN_PROGRESS", "CANCELLED")).toBe(false);
    expect(eventStatusMachine.can("COMPLETED", "CANCELLED")).toBe(false);
  });
  it("sólo se cierra un evento completado y no cerrado", () => {
    expect(canCloseEvent("COMPLETED", null)).toBe(true);
    expect(canCloseEvent("COMPLETED", new Date())).toBe(false);
    expect(canCloseEvent("READY", null)).toBe(false);
  });
});

describe("Payments", () => {
  const paid = (amount: number, refunded = 0): PaymentLike => ({
    kind: "DEPOSIT",
    status: refunded ? statusAfterRefund(amount, refunded) : "PAID",
    amountCents: amount,
    refundedCents: refunded,
  });

  it("transiciones de pago", () => {
    expect(paymentStatusMachine.can("PENDING", "PAID")).toBe(true);
    expect(paymentStatusMachine.can("PAID", "PENDING")).toBe(false);
    expect(paymentStatusMachine.can("PAID", "PARTIAL_REFUND")).toBe(true);
    expect(paymentStatusMachine.isTerminal("REFUNDED")).toBe(true);
  });
  it("calcula pagado neto, saldo y anticipo", () => {
    const payments: PaymentLike[] = [
      paid(500_000),
      { kind: "BALANCE", status: "PENDING", amountCents: 500_000, refundedCents: 0 },
    ];
    expect(netPaidCents(payments)).toBe(500_000);
    expect(balanceDueCents(1_000_000, payments)).toBe(500_000);
    expect(isDepositSatisfied(500_000, payments)).toBe(true);
    expect(isDepositSatisfied(600_000, payments)).toBe(false);
  });
  it("descuenta reembolsos del pagado", () => {
    expect(netPaidCents([paid(500_000, 200_000)])).toBe(300_000);
    expect(statusAfterRefund(500_000, 200_000)).toBe("PARTIAL_REFUND");
    expect(statusAfterRefund(500_000, 500_000)).toBe("REFUNDED");
  });
  it("el saldo nunca es negativo", () => {
    expect(balanceDueCents(100, [paid(500)])).toBe(0);
  });
});

describe("Purchase state machine", () => {
  it("solicitada → ordenada → recibida", () => {
    expect(purchaseStatusMachine.can("REQUESTED", "ORDERED")).toBe(true);
    expect(purchaseStatusMachine.can("ORDERED", "RECEIVED")).toBe(true);
    expect(purchaseStatusMachine.can("RECEIVED", "CANCELLED")).toBe(false);
  });
});
