import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";
import { formatMXN } from "@/lib/money";
import { getPaymentProviderByName } from "@/server/providers";
import type { NormalizedPaymentEvent } from "@/server/providers/payments/types";
import { UNDERPAID_REVIEW_NOTE_PREFIX } from "../domain/amounts";
import {
  CANCELLED_BOOKING_PAYMENT_NOTE,
  applyPaymentFailed,
  applyPaymentSucceeded,
  applyProviderRefund,
  notifyTeamPaymentAnomaly,
  runCancelledBookingPaymentEffects,
  runPaymentSuccessEffects,
  type PaymentApplyOutcome,
} from "./payment-service";

type Tx = Prisma.TransactionClient;

const AMOUNT_MISMATCH_NOTE = "amount_mismatch";
/** Notas que se guardan en WebhookEvent.error para revisión (el evento sí se marca procesado). */
const ANOMALY_NOTES = ["payment_not_found", AMOUNT_MISMATCH_NOTE, CANCELLED_BOOKING_PAYMENT_NOTE];
const isAnomaly = (note?: string) => !!note && ANOMALY_NOTES.some((n) => note.startsWith(n));

export type WebhookResponse = { status: number; body: Record<string, unknown> };

export type ProcessedEvent = {
  type: NormalizedPaymentEvent["type"];
  outcome: PaymentApplyOutcome | null;
  note?: string;
};

/** Busca el Payment del evento: por nuestro id (metadata), por checkout o por id de pago del proveedor. */
async function locatePayment(tx: Tx, providerName: string, event: NormalizedPaymentEvent) {
  const select = { id: true, provider: true, kind: true, status: true, amountCents: true } as const;
  if (event.paymentId && /^[a-z0-9]{10,40}$/i.test(event.paymentId)) {
    const p = await tx.payment.findUnique({ where: { id: event.paymentId }, select });
    if (p && p.provider === providerName && p.kind !== "REFUND") return p;
  }
  if (event.checkoutId) {
    const p = await tx.payment.findUnique({
      where: { provider_providerCheckoutId: { provider: providerName, providerCheckoutId: event.checkoutId } },
      select,
    });
    if (p && p.kind !== "REFUND") return p;
  }
  if (event.providerPaymentId) {
    const p = await tx.payment.findFirst({
      where: { provider: providerName, providerPaymentId: event.providerPaymentId, kind: { not: "REFUND" } },
      select,
    });
    if (p) return p;
  }
  return null;
}

/**
 * Aplica un evento normalizado del proveedor dentro de una transacción.
 * Nunca confía en el navegador: sólo se llega aquí con firma verificada.
 */
export async function processPaymentEvent(
  tx: Tx,
  providerName: string,
  event: NormalizedPaymentEvent,
): Promise<ProcessedEvent> {
  if (event.type === "unknown") return { type: event.type, outcome: null, note: "ignored_event_type" };
  const payment = await locatePayment(tx, providerName, event);
  if (!payment) {
    logger.warn("payments.webhook_payment_not_found", { provider: providerName, externalId: event.externalId });
    return { type: event.type, outcome: null, note: "payment_not_found" };
  }
  switch (event.type) {
    case "payment.succeeded": {
      // Sólo se evalúa el monto de pagos aún no cobrados (un evento repetido de un pago PAID no toca nada).
      const awaitingPayment = payment.status === "PENDING" || payment.status === "FAILED";
      if (awaitingPayment && event.amountCents != null && event.amountCents !== payment.amountCents) {
        if (event.amountCents < payment.amountCents) {
          // Cobro MENOR al esperado: nunca marcar PAID (inflaría lo pagado y podría confirmar sin anticipo).
          // Queda PENDING con una nota visible en el panel y se avisa al equipo para revisión manual.
          logger.error("payments.webhook_underpaid", {
            paymentId: payment.id,
            expected: payment.amountCents,
            received: event.amountCents,
          });
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              notes: `${UNDERPAID_REVIEW_NOTE_PREFIX}: la pasarela reportó un cobro de ${formatMXN(event.amountCents)} pero se esperaban ${formatMXN(payment.amountCents)}${event.providerPaymentId ? ` (ref. ${event.providerPaymentId})` : ""}.`.slice(0, 500),
            },
          });
          const note = `${AMOUNT_MISMATCH_NOTE}:${payment.amountCents}/${event.amountCents}`;
          return {
            type: event.type,
            outcome: { applied: false, confirmed: false, paymentId: payment.id, bookingId: null, eventId: null, note },
            note,
          };
        }
        // Cobro mayor al esperado: se aplica (la clienta pagó al menos lo debido) y el equipo ve el excedente.
        logger.warn("payments.webhook_amount_mismatch", {
          paymentId: payment.id,
          expected: payment.amountCents,
          received: event.amountCents,
        });
      }
      const outcome = await applyPaymentSucceeded(tx, {
        paymentId: payment.id,
        providerPaymentId: event.providerPaymentId ?? null,
        feeCents: event.feeCents ?? null,
        paidAt: new Date(),
      });
      return { type: event.type, outcome, note: outcome.note };
    }
    case "payment.failed": {
      const outcome = await applyPaymentFailed(tx, { paymentId: payment.id, failureReason: event.failureReason });
      return { type: event.type, outcome, note: outcome.note };
    }
    case "refund.succeeded": {
      const outcome = await applyProviderRefund(tx, {
        paymentId: payment.id,
        providerName,
        externalId: event.externalId,
        refundedCents: event.refundedCents ?? null,
      });
      return { type: event.type, outcome, note: outcome.note };
    }
    default:
      return { type: event.type, outcome: null, note: "ignored_event_type" };
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null) ?? "null") as Prisma.InputJsonValue;
  } catch {
    return { unserializable: true };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Punto único de entrada de webhooks de pago (route handler, checkout simulado, pruebas).
 *  1. Proveedor por nombre (desconocido → 404).
 *  2. Firma verificada sobre el cuerpo crudo (inválida → 400, sin procesar).
 *  3. Idempotencia con WebhookEvent (provider + externalId): duplicado procesado → 200 { duplicate }.
 *  4. Procesamiento transaccional; falla → 500 para que el proveedor reintente.
 *  5. Efectos post-commit (lifecycle, notificaciones, analítica) sólo si hubo cambio real.
 */
export async function handlePaymentWebhook(
  providerName: string,
  rawBody: string,
  headers: Headers,
): Promise<WebhookResponse> {
  const provider = getPaymentProviderByName(providerName);
  if (!provider) return { status: 404, body: { error: "not_found" } };

  let verification: Awaited<ReturnType<typeof provider.verifyWebhook>>;
  try {
    verification = await provider.verifyWebhook(rawBody, headers);
  } catch (error) {
    logger.error("payments.webhook_verification_error", { error, provider: provider.name });
    return { status: 500, body: { error: "verification_error" } };
  }
  if (!verification.valid) {
    logger.warn("payments.webhook_invalid_signature", { provider: provider.name, reason: verification.reason });
    return { status: 400, body: { error: "invalid_signature" } };
  }
  const event = verification.event;
  if (!event.externalId) return { status: 400, body: { error: "missing_event_id" } };

  const externalId = event.externalId.slice(0, 190);
  let record: { id: string; processedAt: Date | null } | null;
  try {
    // INSERT ... ON CONFLICT DO NOTHING (atómico): la clave única provider+externalId es la idempotencia.
    await prisma.webhookEvent.createMany({
      data: [{ provider: provider.name, externalId, type: event.type, payload: toJson(event.raw), signatureValid: true }],
      skipDuplicates: true,
    });
    record = await prisma.webhookEvent.findUnique({
      where: { provider_externalId: { provider: provider.name, externalId } },
      select: { id: true, processedAt: true },
    });
  } catch (error) {
    logger.error("payments.webhook_record_failed", { error, provider: provider.name, unique: isUniqueViolation(error) });
    return { status: 500, body: { error: "record_failed" } };
  }
  if (!record) return { status: 500, body: { error: "record_failed" } };
  if (record.processedAt) return { status: 200, body: { received: true, duplicate: true } };
  // Si existía sin processedAt, un intento previo falló: se reprocesa (las transiciones son idempotentes).
  const recordId = record.id;

  let processed: ProcessedEvent;
  try {
    processed = await prisma.$transaction(async (tx) => {
      const result = await processPaymentEvent(tx, provider.name, event);
      await tx.webhookEvent.update({
        where: { id: recordId },
        data: { processedAt: new Date(), error: isAnomaly(result.note) ? result.note : null },
      });
      return result;
    });
  } catch (error) {
    logger.error("payments.webhook_processing_failed", { error, provider: provider.name, externalId: event.externalId });
    const message = error instanceof Error ? error.message : String(error);
    await prisma.webhookEvent
      .update({ where: { id: recordId }, data: { error: message.slice(0, 500) } })
      .catch(() => undefined);
    return { status: 500, body: { error: "processing_failed" } };
  }

  const outcome = processed.outcome;
  if (processed.type === "payment.succeeded" && outcome?.applied) {
    if (outcome.note === CANCELLED_BOOKING_PAYMENT_NOTE) {
      // Cobro sobre una reserva cancelada: sólo aviso al equipo para reembolsar (sin «Recibimos tu pago»).
      await runCancelledBookingPaymentEffects({ paymentId: outcome.paymentId, providerName: provider.name });
    } else {
      await runPaymentSuccessEffects({ paymentId: outcome.paymentId, confirmed: outcome.confirmed });
    }
  }
  if (outcome && processed.note?.startsWith(AMOUNT_MISMATCH_NOTE)) {
    const [expected, received] = processed.note.slice(AMOUNT_MISMATCH_NOTE.length + 1).split("/").map(Number);
    await notifyTeamPaymentAnomaly(outcome.paymentId, {
      key: `amount-mismatch:${event.externalId}`,
      message: `La pasarela (${provider.name}) confirmó un cobro de ${formatMXN(received ?? 0)}, pero el pago esperaba ${formatMXN(expected ?? 0)}. No se marcó como pagado: revísalo en el panel del proveedor y registra el ajuste manualmente.`,
    });
  }
  return {
    status: 200,
    body: {
      received: true,
      type: processed.type,
      applied: outcome?.applied ?? false,
      ...(processed.note ? { note: processed.note } : {}),
    },
  };
}
