import "server-only";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { isEnabled } from "@/lib/flags";
import { logger } from "@/lib/logger";
import { formatMXN } from "@/lib/money";
import { PAYMENT_KIND_LABELS } from "@/lib/labels";
import { generateToken, isPlausibleToken } from "@/lib/tokens";
import { formatLongDate, localDateKey, zonedDateTime } from "@/lib/dates";
import { track } from "@/server/analytics";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { getPaymentProvider, getPaymentProviderByName } from "@/server/providers";
import { getSettings } from "@/features/settings/server/settings-service";
import { notify, notifyCustomer } from "@/features/notifications/server/notification-service";
import { onEventConfirmed } from "@/features/events/server/lifecycle";
import { eventStatusMachine, type EventStatus } from "@/features/events/domain/event-status";
import { netPaidCents, paymentStatusMachine, type PaymentStatus } from "../domain/payment-status";
import {
  CANCELLED_BOOKING_PAYMENT_MESSAGE,
  CANCELLED_CHECKOUT_REASON,
  CHECKOUT_BLOCK_MESSAGES,
  CHECKOUT_KINDS,
  REFUND_REQUIRED_NOTE_PREFIX,
  checkoutAmountCents,
  estimateFeeCents,
  isBookingCancelled,
  isReusablePendingCheckout,
  maxManualAmountCents,
  planRefund,
  shouldConfirmEvent,
  type CheckoutKind,
} from "../domain/amounts";
import type { ManualPaymentInput, RefundInput } from "../schemas";
import { paymentResultUrl, portalPath, quotePath } from "./payment-links";

type Tx = Prisma.TransactionClient;

export type CheckoutSource = "quote" | "portal";

export const PAYMENTS_DISABLED_MESSAGE =
  "Los pagos en línea están en pausa por el momento. Escríbenos por WhatsApp y con gusto te ayudamos a completar tu pago.";
const GENERIC_NOT_FOUND = "No encontramos esta reserva. Revisa tu enlace o escríbenos por WhatsApp.";

// -----------------------------------------------------------------------------
// Checkout
// -----------------------------------------------------------------------------

/** Resuelve un token público (cotización aceptada o portal) a su reserva. 404 genérico si no aplica. */
export async function resolveBookingFromToken(token: string, tokenType: CheckoutSource): Promise<{ bookingId: string }> {
  if (!isPlausibleToken(token)) throw new NotFoundError(GENERIC_NOT_FOUND);
  if (tokenType === "quote") {
    const quote = await prisma.quote.findUnique({
      where: { publicToken: token },
      select: { status: true, booking: { select: { id: true } } },
    });
    if (!quote || quote.status !== "ACCEPTED") throw new NotFoundError(GENERIC_NOT_FOUND);
    if (!quote.booking) throw new AppError("Tu reserva se está preparando. Intenta de nuevo en unos minutos.", "BOOKING_NOT_READY", 409);
    return { bookingId: quote.booking.id };
  }
  const event = await prisma.event.findUnique({
    where: { portalToken: token },
    select: { booking: { select: { id: true } } },
  });
  if (!event?.booking) throw new NotFoundError(GENERIC_NOT_FOUND);
  return { bookingId: event.booking.id };
}

export type StartCheckoutResult = { url: string; paymentId: string; reused: boolean };

/** Tiempo máximo para que el proveedor abra la sesión de checkout (la reserva está bloqueada mientras tanto). */
const PROVIDER_CHECKOUT_TIMEOUT_MS = 15_000;
/**
 * Duración máxima de la transacción de startCheckout. Debe cubrir la espera del candado (otra solicitud
 * de la misma reserva abriendo su sesión, hasta PROVIDER_CHECKOUT_TIMEOUT_MS) más la sesión propia.
 */
const CHECKOUT_TX_TIMEOUT_MS = 2 * PROVIDER_CHECKOUT_TIMEOUT_MS + 10_000;

/**
 * Opciones de las demás transacciones que toman el candado de la reserva (cancelación del evento,
 * webhooks, pagos manuales y reembolsos). Pueden esperar a un startCheckout que conserva el candado
 * mientras la pasarela abre la sesión (hasta PROVIDER_CHECKOUT_TIMEOUT_MS): con el límite por defecto de
 * Prisma (5 s) fallarían si la pasarela responde lento. El límite cubre esa espera más el trabajo propio.
 * Cada checkout en curso retiene una conexión del pool; ver `connection_limit` en docs/DEPLOY_DOKPLOY.md.
 */
export const BOOKING_LOCK_TX_OPTIONS = { maxWait: 10_000, timeout: PROVIDER_CHECKOUT_TIMEOUT_MS + 15_000 } as const;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: sin respuesta en ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type CheckoutTxResult =
  | { outcome: "reused"; url: string; paymentId: string }
  | { outcome: "failed"; paymentId: string }
  | { outcome: "created"; url: string; paymentId: string; amountCents: number; eventId: string; quoteId: string | null };

/**
 * Inicia (o reutiliza) un checkout para una reserva.
 *  - DEPOSIT = max(0, anticipo − pagado neto); BALANCE/FULL = total − pagado neto.
 *  - Reutiliza un pago PENDING del mismo tipo y monto creado hace < 1 h.
 *  - Serializado por reserva (candado de fila): dos solicitudes simultáneas (dos pestañas, doble envío,
 *    reintento de red) nunca abren dos cobros. La sesión del proveedor se crea con la reserva bloqueada,
 *    así la segunda solicitud ya ve el checkoutUrl de la primera y lo reutiliza. La cancelación del
 *    evento usa el mismo candado: nunca queda un checkout abierto de una reserva cancelada.
 *  - La confirmación del pago llega SÓLO por webhook firmado (nunca por el redirect).
 */
export async function startCheckout(
  bookingId: string,
  kind: CheckoutKind,
  opts: { source?: CheckoutSource; now?: Date } = {},
): Promise<StartCheckoutResult> {
  if (!(await isEnabled("PAYMENTS_ENABLED"))) {
    throw new AppError(PAYMENTS_DISABLED_MESSAGE, "PAYMENTS_DISABLED", 409);
  }
  const source = opts.source ?? "portal";
  const provider = getPaymentProvider();
  const decorate = (url: string) => (provider.isMock && source === "quote" ? withParam(url, "from", "quote") : url);

  const result = await prisma.$transaction<CheckoutTxResult>(
    async (tx) => {
      await lockBooking(tx, bookingId);
      // La hora se toma ya con el candado: si esperamos a otra solicitud, su pago es "más nuevo" que una
      // hora tomada antes de esperar y no se reconocería como reutilizable.
      const now = opts.now ?? new Date();
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
          quote: { select: { id: true, publicToken: true } },
          event: { select: { id: true, title: true, status: true, portalToken: true, eventDate: true } },
          payments: {
            select: {
              id: true,
              kind: true,
              status: true,
              amountCents: true,
              refundedCents: true,
              provider: true,
              checkoutUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!booking) throw new NotFoundError(GENERIC_NOT_FOUND);
      if (isBookingCancelled(booking)) throw new AppError(CANCELLED_BOOKING_PAYMENT_MESSAGE, "EVENT_CANCELLED", 409);

      const calc = checkoutAmountCents(kind, booking, booking.payments);
      if (!calc.ok) throw new AppError(CHECKOUT_BLOCK_MESSAGES[calc.reason], calc.reason, 409);

      // Dentro del candado: ve el pago pendiente que otra solicitud acaba de crear (y su checkoutUrl).
      const reusable = booking.payments.find((p) =>
        isReusablePendingCheckout(p, { kind, amountCents: calc.amountCents, provider: provider.name }, now),
      );
      if (reusable?.checkoutUrl) return { outcome: "reused", url: reusable.checkoutUrl, paymentId: reusable.id };

      const idempotencyKey = `${booking.id}:${kind}:${generateToken(12)}`;
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          kind,
          status: "PENDING",
          method: "ONLINE",
          provider: provider.name,
          amountCents: calc.amountCents,
          currency: booking.currency || "MXN",
          idempotencyKey,
        },
      });

      const cancelUrl =
        source === "quote" && booking.quote?.publicToken
          ? appUrl(quotePath(booking.quote.publicToken))
          : appUrl(portalPath(booking.event.portalToken));

      let session: Awaited<ReturnType<typeof provider.createCheckout>>;
      try {
        session = await withTimeout(
          provider.createCheckout({
            paymentId: payment.id,
            amountCents: calc.amountCents,
            currency: "MXN",
            description: `${PAYMENT_KIND_LABELS[kind]} · ${booking.event.title}`,
            customer: {
              name: booking.customer.name,
              email: booking.customer.email,
              phone: booking.customer.whatsapp ?? booking.customer.phone,
            },
            successUrl: paymentResultUrl(payment.id),
            cancelUrl,
            idempotencyKey,
            metadata: {
              paymentId: payment.id,
              bookingId: booking.id,
              bookingCode: booking.code,
              eventId: booking.event.id,
              kind,
            },
          }),
          PROVIDER_CHECKOUT_TIMEOUT_MS,
          `${provider.name}.createCheckout`,
        );
      } catch (error) {
        logger.error("payments.checkout_create_failed", { error, paymentId: payment.id, provider: provider.name });
        // Se conserva el intento como FAILED (misma transacción) y se responde con error tras el commit.
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failedAt: new Date(), failureReason: "No se pudo abrir la pasarela de pago." },
        });
        return { outcome: "failed", paymentId: payment.id };
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { providerCheckoutId: session.checkoutId, checkoutUrl: session.url },
      });
      return {
        outcome: "created",
        url: session.url,
        paymentId: payment.id,
        amountCents: calc.amountCents,
        eventId: booking.event.id,
        quoteId: booking.quote?.id ?? null,
      };
    },
    { maxWait: 10_000, timeout: CHECKOUT_TX_TIMEOUT_MS },
  );

  if (result.outcome === "failed") {
    throw new AppError(
      "No pudimos abrir la pasarela de pago. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.",
      "CHECKOUT_FAILED",
      502,
    );
  }
  if (result.outcome === "reused") return { url: decorate(result.url), paymentId: result.paymentId, reused: true };

  await track("START_PAYMENT", {
    eventId: result.eventId,
    quoteId: result.quoteId,
    path: source === "quote" ? "/cotizacion" : "/mi-evento",
    metadata: { kind, amountCents: result.amountCents, provider: provider.name, paymentId: result.paymentId },
  });

  return { url: decorate(result.url), paymentId: result.paymentId, reused: false };
}

/**
 * Cancelación de una reserva: los checkouts en línea abiertos (PENDING) dejan de ser pagables y pasan a
 * FAILED con motivo «Evento cancelado». Debe ejecutarse dentro de la transacción que cancela el evento,
 * ANTES de tocar el evento: toma el mismo candado de la reserva que startCheckout y los webhooks (orden
 * reserva → evento), así ningún checkout se abre ni se cobra a la mitad de la cancelación.
 * Las filas REFUND pendientes (reembolsos en proceso en la pasarela) no se tocan.
 * Devuelve los ids de los pagos anulados.
 */
export async function voidOpenCheckoutsForCancelledBooking(tx: Tx, bookingId: string, now: Date = new Date()): Promise<string[]> {
  await lockBooking(tx, bookingId);
  const open = await tx.payment.findMany({
    where: { bookingId, status: "PENDING", kind: { in: [...CHECKOUT_KINDS] } },
    select: { id: true },
  });
  if (!open.length) return [];
  paymentStatusMachine.assert("PENDING", "FAILED");
  const ids = open.map((p) => p.id);
  await tx.payment.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { status: "FAILED", failedAt: now, failureReason: CANCELLED_CHECKOUT_REASON },
  });
  return ids;
}

/** Tiempo máximo por sesión para pedirle a la pasarela que la expire (best-effort, tras la cancelación). */
const PROVIDER_EXPIRE_TIMEOUT_MS = 10_000;

/**
 * Tras confirmar la cancelación: pide a la pasarela que expire las sesiones de checkout anuladas para que
 * la clienta ya no pueda pagarlas (Stripe/Mercado Pago las mantienen pagables hasta 1 h). Best-effort: si
 * falla, el cobro tardío se registra como «Reembolso requerido» y se avisa al equipo
 * (ver applyPaymentSucceeded). Nunca lanza.
 */
export async function expireVoidedCheckouts(paymentIds: string[]): Promise<void> {
  if (!paymentIds.length) return;
  try {
    const payments = await prisma.payment.findMany({
      where: { id: { in: paymentIds }, providerCheckoutId: { not: null } },
      select: { id: true, provider: true, providerCheckoutId: true },
    });
    await Promise.all(
      payments.map(async (p) => {
        const provider = getPaymentProviderByName(p.provider);
        if (!provider?.expireCheckout || !p.providerCheckoutId) return;
        try {
          await withTimeout(provider.expireCheckout(p.providerCheckoutId), PROVIDER_EXPIRE_TIMEOUT_MS, `${provider.name}.expireCheckout`);
        } catch (error) {
          logger.warn("payments.checkout_expire_failed", { error, paymentId: p.id, provider: p.provider });
        }
      }),
    );
  } catch (error) {
    logger.error("payments.checkout_expire_lookup_failed", { error, paymentIds });
  }
}

function withParam(url: string, key: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    return url;
  }
}

// -----------------------------------------------------------------------------
// Transiciones compartidas (webhook + pagos manuales)
// -----------------------------------------------------------------------------

export type PaymentApplyOutcome = {
  applied: boolean;
  confirmed: boolean;
  paymentId: string;
  bookingId: string | null;
  eventId: string | null;
  note?: string;
};

/** Bloqueo de fila de la reserva (SELECT ... FOR UPDATE) dentro de la transacción actual. */
async function lockBooking(tx: Tx, bookingId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
}

/**
 * Si el evento está en INQUIRY/PENDING_PAYMENT y el anticipo quedó cubierto → CONFIRMED.
 * Debe ejecutarse dentro de la misma transacción que registró el pago.
 */
export async function confirmEventIfDepositSatisfied(
  tx: Tx,
  bookingId: string,
): Promise<{ confirmed: boolean; eventId: string | null }> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      depositRequiredCents: true,
      cancelledAt: true,
      event: { select: { id: true, status: true } },
      payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
    },
  });
  if (!booking) return { confirmed: false, eventId: null };
  const eventId = booking.event.id;
  if (booking.cancelledAt) return { confirmed: false, eventId };
  const from = booking.event.status as EventStatus;
  if (!shouldConfirmEvent(from, booking.depositRequiredCents, booking.payments)) return { confirmed: false, eventId };
  eventStatusMachine.assert(from, "CONFIRMED");
  const res = await tx.event.updateMany({ where: { id: eventId, status: from }, data: { status: "CONFIRMED" } });
  if (res.count === 1) {
    await audit(
      {
        action: "event.confirmed_by_payment",
        entityType: "Event",
        entityId: eventId,
        before: { status: from },
        after: { status: "CONFIRMED" },
        actor: null,
      },
      tx,
    );
  }
  return { confirmed: res.count === 1, eventId };
}

/** Nota de resultado: la pasarela cobró un pago de una reserva ya cancelada (requiere reembolso). */
export const CANCELLED_BOOKING_PAYMENT_NOTE = "cancelled_booking";
/**
 * Nota de resultado: el pago cambió entre la lectura y la escritura y la transición NO se aplicó.
 * El webhook la trata como reintentable (no marca el evento procesado y responde 500).
 */
export const CONCURRENT_UPDATE_NOTE = "concurrent_update";

/**
 * Marca un pago como PAID (si su estado lo permite) y confirma el evento cuando el anticipo
 * queda cubierto. Idempotente: si otro proceso ya lo aplicó, devuelve applied=false.
 *
 * Regla de cobros sobre reservas canceladas: si la pasarela confirma un cobro cuando la reserva/evento
 * ya está cancelado (p. ej. la clienta pagó en una sesión del proveedor abierta antes de la cancelación),
 * el dinero existe y se registra como PAID —para que cuente en lo cobrado y se pueda reembolsar desde el
 * panel—, pero el evento NO se reconfirma, el pago queda con la nota «Reembolso requerido», se audita y se
 * devuelve note=CANCELLED_BOOKING_PAYMENT_NOTE para que el webhook avise al equipo en lugar de mandarle a
 * la clienta la confirmación normal de pago.
 *
 * El estado del pago se lee DESPUÉS de tomar el candado de la reserva: la cancelación del evento anula
 * (PENDING → FAILED) los checkouts abiertos bajo ese mismo candado, y un webhook que hubiera leído el pago
 * antes de esperar el candado vería un PENDING ya obsoleto y perdería el cobro.
 */
export async function applyPaymentSucceeded(
  tx: Tx,
  input: { paymentId: string; providerPaymentId?: string | null; feeCents?: number | null; paidAt?: Date },
): Promise<PaymentApplyOutcome> {
  const located = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { bookingId: true, kind: true } });
  if (!located) throw new NotFoundError("Pago no encontrado.");
  const base = { paymentId: input.paymentId, bookingId: located.bookingId, eventId: null };
  if (located.kind === "REFUND") return { ...base, applied: false, confirmed: false, note: "refund_row" };
  // Serializa con la cancelación, los checkouts y los demás pagos de la misma reserva (así la suma para
  // confirmar el anticipo ve todos los pagos) y después lee el estado vigente del pago.
  await lockBooking(tx, located.bookingId);
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
    select: { id: true, status: true, bookingId: true, amountCents: true, notes: true },
  });
  const from = payment.status as PaymentStatus;
  if (!paymentStatusMachine.can(from, "PAID")) {
    return { ...base, applied: false, confirmed: false, note: `already_${from.toLowerCase()}` };
  }
  paymentStatusMachine.assert(from, "PAID");
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: payment.bookingId },
    select: { cancelledAt: true, event: { select: { id: true, status: true } } },
  });
  const cancelledBooking = isBookingCancelled(booking);
  const feeCents =
    input.feeCents != null ? Math.max(0, Math.round(input.feeCents)) : estimateFeeCents(payment.amountCents, await getSettings("pricing"));
  const refundNote = `${REFUND_REQUIRED_NOTE_PREFIX}: la pasarela confirmó este cobro cuando el evento ya estaba cancelado. Reembólsalo a la clienta desde este panel.`;
  const res = await tx.payment.updateMany({
    where: { id: payment.id, status: from },
    data: {
      status: "PAID",
      paidAt: input.paidAt ?? new Date(),
      providerPaymentId: input.providerPaymentId ?? undefined,
      feeCents,
      failureReason: null,
      ...(cancelledBooking ? { notes: [refundNote, payment.notes].filter(Boolean).join(" · ").slice(0, 500) } : {}),
    },
  });
  if (res.count === 0) return { ...base, applied: false, confirmed: false, note: CONCURRENT_UPDATE_NOTE };
  if (cancelledBooking) {
    logger.error("payments.collected_after_cancellation", { paymentId: payment.id, eventId: booking.event.id });
    await audit(
      {
        action: "payment.collected_after_cancellation",
        entityType: "Payment",
        entityId: payment.id,
        before: { status: from },
        after: { status: "PAID", amountCents: payment.amountCents, eventId: booking.event.id, refundRequired: true },
        actor: null,
      },
      tx,
    );
    return { ...base, eventId: booking.event.id, applied: true, confirmed: false, note: CANCELLED_BOOKING_PAYMENT_NOTE };
  }
  const confirmation = await confirmEventIfDepositSatisfied(tx, payment.bookingId);
  return { ...base, eventId: confirmation.eventId, applied: true, confirmed: confirmation.confirmed };
}

export async function applyPaymentFailed(
  tx: Tx,
  input: { paymentId: string; failureReason?: string | null },
): Promise<PaymentApplyOutcome> {
  const located = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { bookingId: true } });
  if (!located) throw new NotFoundError("Pago no encontrado.");
  // Mismo candado que el cobro y la cancelación: las transiciones de un pago nunca se pisan entre sí.
  await lockBooking(tx, located.bookingId);
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: input.paymentId },
    select: { id: true, status: true, bookingId: true },
  });
  const base = { paymentId: payment.id, bookingId: payment.bookingId, eventId: null, confirmed: false };
  // Nunca degradar un pago cobrado por un evento de fallo tardío.
  if (payment.status !== "PENDING") return { ...base, applied: false, note: `ignored_${payment.status.toLowerCase()}` };
  paymentStatusMachine.assert("PENDING", "FAILED");
  const res = await tx.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      failureReason: (input.failureReason ?? "El pago fue rechazado.").slice(0, 300),
    },
  });
  return { ...base, applied: res.count === 1 };
}

/**
 * Aplica un reembolso reportado por el proveedor (total acumulado reembolsado).
 * Si el total supera lo registrado, crea el registro REFUND por la diferencia.
 */
export async function applyProviderRefund(
  tx: Tx,
  input: { paymentId: string; providerName: string; externalId: string; refundedCents?: number | null },
): Promise<PaymentApplyOutcome> {
  const located = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { bookingId: true, kind: true } });
  if (!located) throw new NotFoundError("Pago no encontrado.");
  if (located.kind !== "REFUND") {
    // Serializa con los reembolsos del panel (mismo candado) para no duplicar filas REFUND.
    await lockBooking(tx, located.bookingId);
  }
  const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new NotFoundError("Pago no encontrado.");
  const base = { paymentId: payment.id, bookingId: payment.bookingId, eventId: null, confirmed: false };
  if (payment.kind === "REFUND") return { ...base, applied: false, note: "refund_row" };
  if (payment.status !== "PAID" && payment.status !== "PARTIAL_REFUND" && payment.status !== "REFUNDED") {
    return { ...base, applied: false, note: `ignored_${payment.status.toLowerCase()}` };
  }
  const total = Math.min(payment.amountCents, Math.max(0, Math.round(input.refundedCents ?? payment.amountCents)));
  if (total <= payment.refundedCents) {
    // El reembolso ya estaba registrado desde el panel. Si el proveedor reporta el mismo total acumulado,
    // los reembolsos que quedaron "en proceso" en la pasarela se dan por aplicados.
    if (total === payment.refundedCents) {
      const settled = await tx.payment.updateMany({
        where: { refundOfId: payment.id, kind: "REFUND", status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (settled.count > 0) return { ...base, applied: true, note: "refund_settled" };
    }
    return { ...base, applied: false, note: "already_refunded" };
  }
  const plan = planRefund(payment, total - payment.refundedCents);
  if (!plan.ok) return { ...base, applied: false, note: "refund_not_applicable" };
  const res = await tx.payment.updateMany({
    where: { id: payment.id, refundedCents: payment.refundedCents },
    data: { refundedCents: plan.newRefundedCents, status: plan.nextStatus },
  });
  if (res.count === 0) return { ...base, applied: false, note: CONCURRENT_UPDATE_NOTE };
  await tx.payment.create({
    data: {
      bookingId: payment.bookingId,
      kind: "REFUND",
      status: "PAID",
      method: payment.method,
      provider: input.providerName,
      amountCents: total - payment.refundedCents,
      currency: payment.currency,
      idempotencyKey: `refund:${input.providerName}:${input.externalId}`.slice(0, 190),
      refundOfId: payment.id,
      paidAt: new Date(),
      notes: "Reembolso reportado por la pasarela de pago.",
    },
  });
  await audit(
    {
      action: "payment.refunded",
      entityType: "Payment",
      entityId: payment.id,
      before: { status: payment.status, refundedCents: payment.refundedCents },
      after: { status: plan.nextStatus, refundedCents: plan.newRefundedCents, source: "provider_webhook" },
      actor: null,
    },
    tx,
  );
  return { ...base, applied: true };
}

// -----------------------------------------------------------------------------
// Efectos posteriores al commit (notificaciones, ciclo de vida, analítica)
// -----------------------------------------------------------------------------

/** Tras registrar un pago cobrado: lifecycle + notificaciones (con dedupe) + analítica. Nunca lanza. */
export async function runPaymentSuccessEffects(input: { paymentId: string; confirmed: boolean }): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        kind: true,
        method: true,
        provider: true,
        amountCents: true,
        booking: {
          select: {
            quoteId: true,
            totalCents: true,
            payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
            customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
            event: { select: { id: true, title: true, eventDate: true, portalToken: true } },
          },
        },
      },
    });
    if (!payment) return;
    const { event, customer, quoteId } = payment.booking;
    const portalUrl = appUrl(portalPath(event.portalToken));
    const eventDate = formatLongDate(event.eventDate);
    // Excedente (p. ej. dos checkouts abiertos pagados, o pago manual + pago en línea simultáneos).
    const overpaidCents = netPaidCents(payment.booking.payments) - payment.booking.totalCents;
    if (overpaidCents > 0) {
      logger.warn("payments.overpaid", { paymentId: payment.id, eventId: event.id, overpaidCents });
    }

    if (input.confirmed) {
      await onEventConfirmed(event.id);
      await notifyCustomer(customer, {
        type: "BOOKING_CONFIRMED",
        data: { name: customer.name, eventTitle: event.title, eventDate, url: portalUrl },
        eventId: event.id,
        quoteId,
        dedupeKey: `booking-confirmed:${event.id}`,
      });
    }
    await notifyCustomer(customer, {
      type: "PAYMENT_RECEIVED",
      data: { name: customer.name, eventTitle: event.title, eventDate, amount: formatMXN(payment.amountCents), url: portalUrl },
      eventId: event.id,
      quoteId,
      dedupeKey: `payment-received:${payment.id}`,
    });
    const settings = await getSettings("notifications");
    await notify({
      type: "GENERIC",
      channel: "EMAIL",
      to: settings.ownerNotificationEmail,
      data: {
        name: "equipo",
        eventTitle: `Pago recibido · ${event.title}`,
        message: `Se registró un pago de ${formatMXN(payment.amountCents)} (${PAYMENT_KIND_LABELS[payment.kind]}) de ${customer.name} para ${event.title} (${eventDate}).${input.confirmed ? " El evento quedó confirmado." : ""}${overpaidCents > 0 ? ` Atención: lo cobrado excede el total del evento por ${formatMXN(overpaidCents)}; revisa si procede un reembolso.` : ""}`,
        url: appUrl(`/admin/events/${event.id}`),
      },
      eventId: event.id,
      dedupeKey: `payment-received-team:${payment.id}`,
    });
    await track("PAYMENT_SUCCESS", {
      eventId: event.id,
      quoteId,
      metadata: {
        paymentId: payment.id,
        kind: payment.kind,
        method: payment.method,
        provider: payment.provider,
        amountCents: payment.amountCents,
        confirmed: input.confirmed,
      },
    });
  } catch (error) {
    logger.error("payments.success_effects_failed", { error, paymentId: input.paymentId });
  }
}

/** Aviso al equipo de una anomalía de cobro que requiere revisión manual. Nunca lanza. */
export async function notifyTeamPaymentAnomaly(paymentId: string, input: { key: string; message: string }): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { booking: { select: { event: { select: { id: true, title: true } } } } },
    });
    if (!payment) return;
    const { event } = payment.booking;
    const settings = await getSettings("notifications");
    await notify({
      type: "GENERIC",
      channel: "EMAIL",
      to: settings.ownerNotificationEmail,
      data: {
        name: "equipo",
        eventTitle: `Revisar pago · ${event.title}`,
        message: input.message,
        url: appUrl(`/admin/events/${event.id}`),
      },
      eventId: event.id,
      dedupeKey: input.key,
    });
  } catch (error) {
    logger.error("payments.anomaly_notify_failed", { error, paymentId });
  }
}

/**
 * Efectos de un cobro que la pasarela confirmó sobre una reserva ya cancelada (ver applyPaymentSucceeded):
 * sólo se avisa al equipo para reembolsar; la clienta NO recibe «Recibimos tu pago» ni se ejecuta el ciclo
 * de vida del evento. Nunca lanza.
 */
export async function runCancelledBookingPaymentEffects(input: { paymentId: string; providerName: string }): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        kind: true,
        amountCents: true,
        booking: { select: { customer: { select: { name: true } }, event: { select: { title: true, eventDate: true } } } },
      },
    });
    if (!payment) return;
    const { customer, event } = payment.booking;
    await notifyTeamPaymentAnomaly(payment.id, {
      key: `cancelled-booking-payment:${payment.id}`,
      message: `La pasarela (${input.providerName}) confirmó un cobro de ${formatMXN(payment.amountCents)} (${PAYMENT_KIND_LABELS[payment.kind]}) de ${customer.name} para ${event.title} (${formatLongDate(event.eventDate)}), pero el evento ya estaba cancelado. Se registró como pagado con la nota «${REFUND_REQUIRED_NOTE_PREFIX}», el evento sigue cancelado y no se le envió confirmación de pago a la clienta. Reembólsalo desde el panel de pagos del evento y contáctala.`,
    });
  } catch (error) {
    logger.error("payments.cancelled_booking_effects_failed", { error, paymentId: input.paymentId });
  }
}

// -----------------------------------------------------------------------------
// Pagos manuales (efectivo, transferencia, terminal)
// -----------------------------------------------------------------------------

export type ManualPaymentResult = { paymentId: string; eventId: string; confirmed: boolean };

export async function recordManualPayment(
  actor: SessionUser,
  input: ManualPaymentInput,
  ctx: { ip?: string | null; now?: Date } = {},
): Promise<ManualPaymentResult> {
  const now = ctx.now ?? new Date();
  const booking = await prisma.booking.findUnique({
    where: { eventId: input.eventId },
    select: {
      id: true,
      totalCents: true,
      depositRequiredCents: true,
      currency: true,
      cancelledAt: true,
      event: { select: { id: true, status: true } },
      payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
    },
  });
  if (!booking) throw new AppError("Este evento aún no tiene una reserva; no se pueden registrar pagos.", "NO_BOOKING", 409);
  const cancelledError = () => new AppError("El evento está cancelado; no se pueden registrar pagos.", "EVENT_CANCELLED", 409);
  if (isBookingCancelled(booking)) throw cancelledError();
  const max = maxManualAmountCents(booking, booking.payments);
  if (max <= 0) throw new AppError(CHECKOUT_BLOCK_MESSAGES.NO_BALANCE, "NO_BALANCE", 409);
  if (input.amountCents > max) {
    throw new ValidationError("Revisa el monto.", {
      amountCents: [`El monto excede el saldo pendiente (${formatMXN(max)}).`],
    });
  }
  const today = localDateKey(now);
  if (input.paidAt > today) {
    throw new ValidationError("Revisa la fecha.", { paidAt: ["La fecha de pago no puede ser futura."] });
  }
  const paidAt = input.paidAt === today ? now : zonedDateTime(input.paidAt, "12:00");

  const receiptMediaId = input.receiptMediaId || null;
  if (receiptMediaId) {
    const media = await prisma.mediaAsset.findUnique({ where: { id: receiptMediaId }, select: { purpose: true } });
    if (!media || media.purpose !== "RECEIPT") {
      throw new ValidationError("Revisa el comprobante.", { receiptMediaId: ["El comprobante no es válido."] });
    }
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Re-verificar el saldo con la reserva bloqueada (evita doble registro concurrente que exceda el total).
    await lockBooking(tx, booking.id);
    // ...y que el evento no se haya cancelado mientras tanto (la cancelación toma el mismo candado).
    const current = await tx.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { cancelledAt: true, event: { select: { status: true } } },
    });
    if (isBookingCancelled(current)) throw cancelledError();
    const fresh = await tx.payment.findMany({
      where: { bookingId: booking.id },
      select: { kind: true, status: true, amountCents: true, refundedCents: true },
    });
    const freshMax = maxManualAmountCents(booking, fresh);
    if (input.amountCents > freshMax) {
      throw new ValidationError("Revisa el monto.", {
        amountCents: [`El monto excede el saldo pendiente (${formatMXN(freshMax)}).`],
      });
    }
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        kind: input.kind,
        status: "PENDING",
        method: input.method as PaymentMethod,
        provider: "manual",
        amountCents: input.amountCents,
        currency: booking.currency || "MXN",
        idempotencyKey: `manual:${generateToken(16)}`,
        notes: input.notes?.trim() || null,
        recordedById: actor.id,
        receiptMediaId,
      },
    });
    const applied = await applyPaymentSucceeded(tx, { paymentId: payment.id, feeCents: 0, paidAt });
    if (!applied.applied) throw new AppError("No se pudo registrar el pago. Intenta de nuevo.", "PAYMENT_NOT_APPLIED", 409);
    await audit(
      {
        action: "payment.manual_recorded",
        entityType: "Payment",
        entityId: payment.id,
        after: {
          eventId: booking.event.id,
          bookingId: booking.id,
          kind: input.kind,
          method: input.method,
          amountCents: input.amountCents,
          paidAt: paidAt.toISOString(),
          receiptMediaId,
          notes: input.notes || null,
          eventConfirmed: applied.confirmed,
        },
        actor,
        ip: ctx.ip ?? null,
      },
      tx,
    );
    return applied;
  }, BOOKING_LOCK_TX_OPTIONS);

  await runPaymentSuccessEffects({ paymentId: outcome.paymentId, confirmed: outcome.confirmed });
  return { paymentId: outcome.paymentId, eventId: booking.event.id, confirmed: outcome.confirmed };
}

// -----------------------------------------------------------------------------
// Reembolsos (desde el panel)
// -----------------------------------------------------------------------------

export type RefundResultSummary = {
  refundPaymentId: string;
  originalStatus: PaymentStatus;
  refundedCents: number;
  eventId: string;
  providerStatus: "succeeded" | "pending" | "manual";
};

export async function refundPayment(
  actor: SessionUser,
  input: RefundInput,
  ctx: { ip?: string | null } = {},
): Promise<RefundResultSummary> {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: { booking: { select: { eventId: true } } },
  });
  if (!payment) throw new NotFoundError("No encontramos ese pago.");
  const plan = planRefund(payment, input.amountCents);
  if (!plan.ok) {
    throw new ValidationError(plan.message, { amountCents: [plan.message] });
  }

  const isOnline = payment.provider !== "manual" && payment.method === "ONLINE";
  const startedAt = new Date();
  let providerRefundId: string | null = null;
  let providerStatus: RefundResultSummary["providerStatus"] = "manual";
  if (isOnline) {
    if (!payment.providerPaymentId) {
      throw new AppError("Este pago no tiene referencia del proveedor; regístralo como reembolso manual fuera de la pasarela.", "NO_PROVIDER_REF", 409);
    }
    const provider = getPaymentProviderByName(payment.provider);
    if (!provider) {
      throw new AppError("El proveedor de este pago no está disponible en este momento.", "PROVIDER_UNAVAILABLE", 409);
    }
    try {
      const res = await provider.refund({
        providerPaymentId: payment.providerPaymentId,
        amountCents: input.amountCents,
        idempotencyKey: `refund:${payment.id}:${payment.refundedCents}:${input.amountCents}`,
        reason: input.reason,
      });
      if (res.status === "failed") {
        throw new AppError("La pasarela rechazó el reembolso. Intenta de nuevo o revisa el panel del proveedor.", "REFUND_FAILED", 502);
      }
      providerRefundId = res.refundId;
      providerStatus = res.status;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("payments.refund_provider_failed", { error, paymentId: payment.id });
      throw new AppError("No pudimos procesar el reembolso con la pasarela. Intenta de nuevo en unos minutos.", "REFUND_FAILED", 502);
    }
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Mismo candado que los webhooks de reembolso: serializa y permite conciliar.
    await lockBooking(tx, payment.bookingId);
    const fresh = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: { kind: true, status: true, amountCents: true, refundedCents: true },
    });
    // Envío duplicado: la pasarela devolvió un reembolso que ya registramos (misma Idempotency-Key).
    if (providerRefundId) {
      const existing = await tx.payment.findFirst({
        where: { refundOfId: payment.id, kind: "REFUND", providerPaymentId: providerRefundId },
        select: { id: true },
      });
      if (existing) return { rowId: existing.id, status: fresh.status as PaymentStatus, refundedCents: fresh.refundedCents };
    }
    let effective: { newRefundedCents: number; nextStatus: PaymentStatus } = plan;
    if (fresh.refundedCents !== payment.refundedCents || fresh.status !== payment.status) {
      if (!providerRefundId) {
        throw new AppError("El pago cambió mientras lo editabas. Actualiza la página e intenta de nuevo.", "CONFLICT", 409);
      }
      // El dinero YA salió por la pasarela: conciliar en lugar de fallar (si fallara, un reintento
      // reembolsaría dos veces). Caso típico: el webhook del proveedor registró este reembolso
      // (fila REFUND sin autor) antes que nosotros. Margen de 2 min por diferencias de reloj app/BD.
      const reconciled =
        fresh.refundedCents >= plan.newRefundedCents
          ? await tx.payment.findFirst({
              where: {
                refundOfId: payment.id,
                kind: "REFUND",
                recordedById: null,
                providerPaymentId: null,
                createdAt: { gte: new Date(startedAt.getTime() - 120_000) },
              },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            })
          : null;
      if (reconciled) {
        await tx.payment.update({
          where: { id: reconciled.id },
          data: { recordedById: actor.id, notes: input.reason, providerPaymentId: providerRefundId },
        });
        await audit(
          {
            action: "payment.refunded",
            entityType: "Payment",
            entityId: payment.id,
            before: { status: payment.status, refundedCents: payment.refundedCents },
            after: {
              status: fresh.status,
              refundedCents: fresh.refundedCents,
              refundAmountCents: input.amountCents,
              refundPaymentId: reconciled.id,
              providerRefundId,
              reason: input.reason,
              reconciledWithWebhook: true,
            },
            actor,
            ip: ctx.ip ?? null,
          },
          tx,
        );
        return { rowId: reconciled.id, status: fresh.status as PaymentStatus, refundedCents: fresh.refundedCents };
      }
      const replan = planRefund(fresh, input.amountCents);
      if (!replan.ok) {
        logger.error("payments.refund_reconcile_failed", { paymentId: payment.id, providerRefundId });
        throw new AppError(
          "La pasarela aceptó el reembolso, pero el pago cambió mientras lo registrábamos. Revisa el panel del proveedor antes de volver a intentarlo.",
          "REFUND_RECONCILE",
          409,
        );
      }
      effective = replan;
    }
    const res = await tx.payment.updateMany({
      where: { id: payment.id, refundedCents: fresh.refundedCents, status: fresh.status },
      data: { refundedCents: effective.newRefundedCents, status: effective.nextStatus },
    });
    if (res.count === 0) {
      throw new AppError("El pago cambió mientras lo editabas. Actualiza la página e intenta de nuevo.", "CONFLICT", 409);
    }
    const row = await tx.payment.create({
      data: {
        bookingId: payment.bookingId,
        kind: "REFUND",
        status: providerStatus === "pending" ? "PENDING" : "PAID",
        method: payment.method,
        provider: payment.provider,
        providerPaymentId: providerRefundId,
        amountCents: input.amountCents,
        currency: payment.currency,
        idempotencyKey: providerRefundId ? `refund:${payment.provider}:${providerRefundId}` : `refund:manual:${generateToken(16)}`,
        refundOfId: payment.id,
        paidAt: new Date(),
        notes: input.reason,
        recordedById: actor.id,
      },
    });
    await audit(
      {
        action: "payment.refunded",
        entityType: "Payment",
        entityId: payment.id,
        before: { status: fresh.status, refundedCents: fresh.refundedCents },
        after: {
          status: effective.nextStatus,
          refundedCents: effective.newRefundedCents,
          refundAmountCents: input.amountCents,
          refundPaymentId: row.id,
          providerRefundId,
          reason: input.reason,
        },
        actor,
        ip: ctx.ip ?? null,
      },
      tx,
    );
    return { rowId: row.id, status: effective.nextStatus, refundedCents: effective.newRefundedCents };
  }, BOOKING_LOCK_TX_OPTIONS);

  return {
    refundPaymentId: outcome.rowId,
    originalStatus: outcome.status,
    refundedCents: outcome.refundedCents,
    eventId: payment.booking.eventId,
    providerStatus,
  };
}
