import { createStateMachine } from "@/lib/state-machine";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";

export const paymentStatusMachine = createStateMachine<PaymentStatus>("Payment", {
  PENDING: ["PAID", "FAILED"],
  FAILED: ["PENDING", "PAID"], // reintento
  PAID: ["PARTIAL_REFUND", "REFUNDED"],
  PARTIAL_REFUND: ["PARTIAL_REFUND", "REFUNDED"],
  REFUNDED: [],
});

export type PaymentLike = {
  kind: "DEPOSIT" | "BALANCE" | "FULL" | "REFUND";
  status: PaymentStatus;
  amountCents: number;
  refundedCents: number;
};

/** Total cobrado neto de reembolsos (los registros REFUND no suman). */
export function netPaidCents(payments: PaymentLike[]): number {
  return payments
    .filter((p) => p.kind !== "REFUND" && (p.status === "PAID" || p.status === "PARTIAL_REFUND" || p.status === "REFUNDED"))
    .reduce((sum, p) => sum + p.amountCents - p.refundedCents, 0);
}

export function balanceDueCents(totalCents: number, payments: PaymentLike[]): number {
  return Math.max(0, totalCents - netPaidCents(payments));
}

export function isDepositSatisfied(depositRequiredCents: number, payments: PaymentLike[]): boolean {
  return netPaidCents(payments) >= depositRequiredCents;
}

/** Estado tras aplicar un reembolso parcial o total */
export function statusAfterRefund(amountCents: number, refundedCents: number): PaymentStatus {
  if (refundedCents <= 0) return "PAID";
  return refundedCents >= amountCents ? "REFUNDED" : "PARTIAL_REFUND";
}
