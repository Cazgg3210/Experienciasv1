import { applyBps } from "@/lib/money";
import {
  isDepositSatisfied,
  netPaidCents,
  paymentStatusMachine,
  statusAfterRefund,
  type PaymentLike,
  type PaymentStatus,
} from "./payment-status";

/**
 * Reglas puras de montos de Pagos (sin I/O). Todo en centavos MXN.
 */

export type CheckoutKind = "DEPOSIT" | "BALANCE" | "FULL";
export const CHECKOUT_KINDS: readonly CheckoutKind[] = ["DEPOSIT", "BALANCE", "FULL"] as const;

export type BookingAmounts = { totalCents: number; depositRequiredCents: number };

export type CheckoutAmountResult =
  | { ok: true; amountCents: number }
  | { ok: false; reason: "DEPOSIT_COVERED" | "NO_BALANCE" };

export const CHECKOUT_BLOCK_MESSAGES: Record<"DEPOSIT_COVERED" | "NO_BALANCE", string> = {
  DEPOSIT_COVERED: "Tu anticipo ya está cubierto",
  NO_BALANCE: "No hay saldo pendiente",
};

/**
 * Monto a cobrar en un checkout:
 *  - DEPOSIT = max(0, anticipo requerido − pagado neto)
 *  - BALANCE / FULL = total − pagado neto
 */
export function checkoutAmountCents(
  kind: CheckoutKind,
  booking: BookingAmounts,
  payments: PaymentLike[],
): CheckoutAmountResult {
  const paid = netPaidCents(payments);
  if (kind === "DEPOSIT") {
    const amount = Math.max(0, booking.depositRequiredCents - paid);
    return amount > 0 ? { ok: true, amountCents: amount } : { ok: false, reason: "DEPOSIT_COVERED" };
  }
  const amount = Math.max(0, booking.totalCents - paid);
  return amount > 0 ? { ok: true, amountCents: amount } : { ok: false, reason: "NO_BALANCE" };
}

/** Prefijo de la nota que deja un webhook cuyo cobro fue menor al esperado (el pago queda en revisión). */
export const UNDERPAID_REVIEW_NOTE_PREFIX = "Revisión manual";

/** Comisión estimada de la pasarela (cuando el proveedor no la reporta). */
export function estimateFeeCents(
  amountCents: number,
  settings: { paymentFeeBps: number; paymentFeeFixedCents: number },
): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return applyBps(amountCents, settings.paymentFeeBps) + settings.paymentFeeFixedCents;
}

/** ¿Se puede reutilizar un checkout PENDING existente (mismo tipo, monto y proveedor, < 1 h)? */
export function isReusablePendingCheckout(
  payment: {
    kind: string;
    status: string;
    amountCents: number;
    provider: string;
    checkoutUrl: string | null;
    createdAt: Date;
  },
  wanted: { kind: CheckoutKind; amountCents: number; provider: string },
  now: Date = new Date(),
  maxAgeMs = 60 * 60 * 1000,
): boolean {
  return (
    payment.status === "PENDING" &&
    payment.kind === wanted.kind &&
    payment.amountCents === wanted.amountCents &&
    payment.provider === wanted.provider &&
    !!payment.checkoutUrl &&
    now.getTime() - payment.createdAt.getTime() < maxAgeMs &&
    now.getTime() - payment.createdAt.getTime() >= 0
  );
}

export type CheckoutLinkState = "payable" | "processed" | "expired" | "stale";

/**
 * Estado de un enlace de checkout existente (usado por el checkout simulado, igual que un proveedor real):
 *  - processed: ya no está PENDING
 *  - expired: creado hace más de `ttlMs` (las sesiones del proveedor expiran en 1 h)
 *  - stale: el saldo cambió (p. ej. ya se pagó otra cosa) y el monto ya no corresponde
 */
export function checkoutLinkState(
  payment: { kind: string; status: string; amountCents: number; createdAt: Date },
  booking: BookingAmounts,
  payments: PaymentLike[],
  now: Date = new Date(),
  ttlMs = 60 * 60 * 1000,
): CheckoutLinkState {
  if (payment.status !== "PENDING") return "processed";
  if (now.getTime() - payment.createdAt.getTime() > ttlMs) return "expired";
  if (payment.kind !== "DEPOSIT" && payment.kind !== "BALANCE" && payment.kind !== "FULL") return "stale";
  const calc = checkoutAmountCents(payment.kind, booking, payments);
  return calc.ok && calc.amountCents === payment.amountCents ? "payable" : "stale";
}

/** ¿El evento debe pasar a CONFIRMED tras registrar un pago? */
export function shouldConfirmEvent(
  eventStatus: string,
  depositRequiredCents: number,
  payments: PaymentLike[],
): boolean {
  return (eventStatus === "PENDING_PAYMENT" || eventStatus === "INQUIRY") && isDepositSatisfied(depositRequiredCents, payments);
}

/** Monto todavía reembolsable de un pago cobrado. */
export function refundableCents(p: Pick<PaymentLike, "kind" | "status" | "amountCents" | "refundedCents">): number {
  if (p.kind === "REFUND") return 0;
  if (p.status !== "PAID" && p.status !== "PARTIAL_REFUND") return 0;
  return Math.max(0, p.amountCents - p.refundedCents);
}

export type RefundPlan =
  | { ok: true; newRefundedCents: number; nextStatus: PaymentStatus }
  | { ok: false; message: string };

/** Valida un reembolso (parcial o total) y calcula el nuevo estado del pago original. */
export function planRefund(
  p: Pick<PaymentLike, "kind" | "status" | "amountCents" | "refundedCents">,
  amountCents: number,
): RefundPlan {
  if (p.kind === "REFUND") return { ok: false, message: "Un reembolso no se puede reembolsar." };
  if (p.status !== "PAID" && p.status !== "PARTIAL_REFUND") {
    return { ok: false, message: "Sólo se pueden reembolsar pagos cobrados." };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, message: "El monto del reembolso debe ser mayor a cero." };
  }
  const available = refundableCents(p);
  if (amountCents > available) {
    return { ok: false, message: "El monto excede lo disponible para reembolsar." };
  }
  const newRefundedCents = p.refundedCents + amountCents;
  const nextStatus = statusAfterRefund(p.amountCents, newRefundedCents);
  if (nextStatus !== p.status && !paymentStatusMachine.can(p.status, nextStatus)) {
    return { ok: false, message: "El estado del pago no permite este reembolso." };
  }
  return { ok: true, newRefundedCents, nextStatus };
}

/** Saldo máximo que se puede registrar como pago manual. */
export function maxManualAmountCents(booking: BookingAmounts, payments: PaymentLike[]): number {
  return Math.max(0, booking.totalCents - netPaidCents(payments));
}

/** Resumen de cobranza de una reserva (para paneles y finanzas). */
export function summarizeBooking(booking: BookingAmounts, payments: (PaymentLike & { feeCents?: number })[]) {
  const paid = netPaidCents(payments);
  const refunded = payments
    .filter((p) => p.kind !== "REFUND")
    .reduce((sum, p) => sum + (p.status === "PAID" || p.status === "PARTIAL_REFUND" || p.status === "REFUNDED" ? p.refundedCents : 0), 0);
  const fees = payments
    .filter((p) => p.kind !== "REFUND" && (p.status === "PAID" || p.status === "PARTIAL_REFUND" || p.status === "REFUNDED"))
    .reduce((sum, p) => sum + (p.feeCents ?? 0), 0);
  return {
    totalCents: booking.totalCents,
    depositRequiredCents: booking.depositRequiredCents,
    netPaidCents: paid,
    balanceDueCents: Math.max(0, booking.totalCents - paid),
    depositDueCents: Math.max(0, booking.depositRequiredCents - paid),
    depositSatisfied: isDepositSatisfied(booking.depositRequiredCents, payments),
    refundedCents: refunded,
    feesCents: fees,
    pendingCount: payments.filter((p) => p.status === "PENDING" && p.kind !== "REFUND").length,
  };
}

export type BookingPaymentSummary = ReturnType<typeof summarizeBooking>;
