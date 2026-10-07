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

/** Mensaje para la clienta cuando intenta pagar una reserva cancelada. */
export const CANCELLED_BOOKING_PAYMENT_MESSAGE =
  "Esta reserva fue cancelada, por lo que no podemos recibir pagos. Escríbenos si necesitas ayuda.";

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

/**
 * Un pago PENDING de checkout SIN checkoutUrl es el lugar que reservó una solicitud de checkout antes de
 * pedirle la sesión a la pasarela (startCheckout la pide fuera de la transacción, sin retener el candado):
 *  - "opening": mismo tipo, monto y proveedor, dentro de `openingWindowMs` → otra solicitud está abriendo
 *    esa misma sesión: hay que esperar su checkoutUrl y reutilizarlo (nunca abrir un segundo cobro).
 *  - "abandoned": lleva `openingWindowMs` o más sin URL (la solicitud murió a la mitad) → se da por fallido.
 *  - null: no aplica (ya tiene URL, no está PENDING, no es de checkout, u otro tipo/monto/proveedor vigente).
 */
export function checkoutOpeningState(
  payment: { kind: string; status: string; amountCents: number; provider: string; checkoutUrl: string | null; createdAt: Date },
  wanted: { kind: CheckoutKind; amountCents: number; provider: string },
  now: Date,
  openingWindowMs: number,
): "opening" | "abandoned" | null {
  if (payment.status !== "PENDING" || payment.checkoutUrl) return null;
  if (!(CHECKOUT_KINDS as readonly string[]).includes(payment.kind)) return null;
  if (now.getTime() - payment.createdAt.getTime() >= openingWindowMs) return "abandoned";
  return payment.kind === wanted.kind && payment.amountCents === wanted.amountCents && payment.provider === wanted.provider
    ? "opening"
    : null;
}

/** Datos mínimos para saber si una reserva sigue viva (la cancelación vive en la reserva y en su evento). */
export type BookingCancellation = { cancelledAt: Date | null; event: { status: string } };

/** ¿La reserva (o su evento) está cancelada? Una reserva cancelada nunca acepta cobros nuevos. */
export function isBookingCancelled(booking: BookingCancellation): boolean {
  return booking.cancelledAt != null || booking.event.status === "CANCELLED";
}

/** Motivo con el que se anulan los checkouts abiertos de una reserva al cancelar su evento. */
export const CANCELLED_CHECKOUT_REASON = "Evento cancelado.";

/** Prefijo de la nota de un cobro que la pasarela confirmó cuando la reserva ya estaba cancelada. */
export const REFUND_REQUIRED_NOTE_PREFIX = "Reembolso requerido";

/** Estados de un pago en los que el dinero ya se cobró (aunque después se haya reembolsado). */
export function isCollectedPaymentStatus(status: string): boolean {
  return status === "PAID" || status === "PARTIAL_REFUND" || status === "REFUNDED";
}

/**
 * ¿La pasarela confirmó este cobro cuando la reserva ya estaba cancelada? Lo determina el propio pago
 * (la nota «Reembolso requerido» que deja el webhook), no el estado actual del evento: un anticipo pagado
 * normalmente y un evento cancelado después NO es un cobro tardío.
 */
export function wasCollectedAfterCancellation(payment: { status: string; notes?: string | null }): boolean {
  return isCollectedPaymentStatus(payment.status) && !!payment.notes?.startsWith(REFUND_REQUIRED_NOTE_PREFIX);
}

/**
 * ¿Un cobro quedó registrado después de la cancelación de su reserva? Sirve para revisar casos anteriores a
 * la nota «Reembolso requerido» (ver scripts/report-cancelled-booking-payments.ts).
 */
export function isPaidAfterCancellation(
  payment: { kind: string; status: string; paidAt: Date | null },
  cancelledAt: Date | null,
): boolean {
  if (payment.kind === "REFUND" || !isCollectedPaymentStatus(payment.status)) return false;
  if (!payment.paidAt || !cancelledAt) return false;
  return payment.paidAt.getTime() > cancelledAt.getTime();
}

const CONFIRMED_EVENT_STATUSES: readonly string[] = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"];

export type PaymentResultStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";

/** Lo que ve la clienta en /pago/resultado (sin notas internas ni datos de otros pagos). */
export type PaymentStatusView = {
  status: PaymentResultStatus;
  eventConfirmed: boolean;
  /** La reserva/evento está cancelado: ya no se ofrece reintentar el pago. */
  eventCancelled: boolean;
  /** La pasarela cobró cuando el evento ya estaba cancelado: el equipo debe reembolsarlo. */
  collectedAfterCancellation: boolean;
  failureReason: string | null;
};

export function paymentStatusView(
  payment: { status: PaymentResultStatus; failureReason: string | null; notes: string | null },
  booking: BookingCancellation,
): PaymentStatusView {
  return {
    status: payment.status,
    eventConfirmed: CONFIRMED_EVENT_STATUSES.includes(booking.event.status),
    eventCancelled: isBookingCancelled(booking),
    collectedAfterCancellation: wasCollectedAfterCancellation(payment),
    failureReason: payment.status === "FAILED" ? payment.failureReason : null,
  };
}

export type CheckoutLinkState = "payable" | "processed" | "expired" | "stale" | "cancelled";

/**
 * Estado de un enlace de checkout existente (usado por el checkout simulado, igual que un proveedor real):
 *  - cancelled: la reserva/evento se canceló y el pago no se había cobrado (nunca se puede pagar)
 *  - processed: ya no está PENDING
 *  - expired: creado hace más de `ttlMs` (las sesiones del proveedor expiran en 1 h)
 *  - stale: el saldo cambió (p. ej. ya se pagó otra cosa) y el monto ya no corresponde
 */
export function checkoutLinkState(
  payment: { kind: string; status: string; amountCents: number; createdAt: Date },
  booking: BookingAmounts & BookingCancellation,
  payments: PaymentLike[],
  now: Date = new Date(),
  ttlMs = 60 * 60 * 1000,
): CheckoutLinkState {
  // Un cobro ya hecho se sigue mostrando como procesado (su resultado existe); lo demás queda anulado.
  if (isBookingCancelled(booking) && !isCollectedPaymentStatus(payment.status)) return "cancelled";
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
