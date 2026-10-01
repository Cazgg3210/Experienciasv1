import { daysUntil } from "@/lib/dates";

/**
 * Reglas puras (sin I/O) del programador de notificaciones.
 * Deciden QUÉ toca enviar y CUÁNDO; el servicio (scheduler.ts) sólo consulta la base,
 * aplica estas reglas y llama a notify() con dedupeKeys para que todo sea idempotente.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Días de anticipación para avisar del saldo pendiente. */
export const PAYMENT_DUE_DAYS_AHEAD = 3;
/** Ventana del recordatorio "falta una semana" (días naturales en CDMX). */
export const EVENT_7D_MAX_DAYS = 7;
export const EVENT_7D_MIN_DAYS = 3;
/** Ventana del recordatorio de 48 h (horas antes del inicio). */
export const EVENT_48H_HOURS = 48;
/** Post-evento: al menos 1 día después de completar; no se envía para eventos muy antiguos. */
export const POST_EVENT_MIN_DAYS = 1;
export const POST_EVENT_MAX_DAYS = 30;
/** Solicitud de reseña: al menos 3 días después de completar; no para eventos muy antiguos. */
export const REVIEW_REQUEST_MIN_DAYS = 3;
export const REVIEW_REQUEST_MAX_DAYS = 45;

export type Window = { from: Date; to: Date };

// -----------------------------------------------------------------------------
// Cotizaciones
// -----------------------------------------------------------------------------

/** Ventana [now, now + horas] para buscar cotizaciones por vencer. */
export function quoteExpiringWindow(now: Date, hoursBefore: number): Window {
  return { from: now, to: new Date(now.getTime() + hoursBefore * HOUR_MS) };
}

/** Una cotización ENVIADA vence dentro de las próximas `hoursBefore` horas (y aún no venció). */
export function isQuoteExpiringSoon(validUntil: Date | null | undefined, now: Date, hoursBefore: number): boolean {
  if (!validUntil) return false;
  const diff = validUntil.getTime() - now.getTime();
  return diff > 0 && diff <= hoursBefore * HOUR_MS;
}

/** Una cotización ENVIADA cuya vigencia ya pasó debe marcarse como EXPIRADA. */
export function isQuoteOverdue(validUntil: Date | null | undefined, now: Date): boolean {
  return !!validUntil && validUntil.getTime() <= now.getTime();
}

// -----------------------------------------------------------------------------
// Pagos
// -----------------------------------------------------------------------------

export type PaymentLike = {
  kind: "DEPOSIT" | "BALANCE" | "FULL" | "REFUND";
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";
  amountCents: number;
  refundedCents: number;
};

/** Monto cobrado neto (pagos efectivos menos reembolsos registrados en el pago original). */
export function paidNetCents(payments: readonly PaymentLike[]): number {
  let total = 0;
  for (const p of payments) {
    if (p.kind === "REFUND") continue; // los reembolsos se reflejan en refundedCents del pago original
    if (p.status === "PAID" || p.status === "PARTIAL_REFUND" || p.status === "REFUNDED") {
      total += Math.max(0, p.amountCents - p.refundedCents);
    }
  }
  return total;
}

/** Saldo pendiente de una reserva (nunca negativo). */
export function balanceCents(totalCents: number, payments: readonly PaymentLike[]): number {
  return Math.max(0, totalCents - paidNetCents(payments));
}

export type PaymentDueStage = "upcoming" | "overdue";

/**
 * Etapa del recordatorio de saldo: "upcoming" si vence en los próximos `daysAhead` días,
 * "overdue" si ya venció. null si todavía falta más tiempo.
 * Cada etapa se envía una sola vez por fecha de vencimiento (dedupeKey).
 */
export function paymentDueStage(
  balanceDueAt: Date | null | undefined,
  now: Date,
  daysAhead: number = PAYMENT_DUE_DAYS_AHEAD,
): PaymentDueStage | null {
  if (!balanceDueAt) return null;
  const diff = balanceDueAt.getTime() - now.getTime();
  if (diff <= 0) return "overdue";
  if (diff <= daysAhead * DAY_MS) return "upcoming";
  return null;
}

// -----------------------------------------------------------------------------
// Eventos
// -----------------------------------------------------------------------------

/** Días naturales (CDMX) que faltan para el inicio del evento. */
export function daysUntilEvent(startsAt: Date, now: Date): number {
  return daysUntil(startsAt, now);
}

/** RSVP: el evento empieza en `daysBefore` días o menos (y todavía no empieza). */
export function isRsvpReminderDue(startsAt: Date, now: Date, daysBefore: number): boolean {
  if (startsAt.getTime() <= now.getTime()) return false;
  const d = daysUntilEvent(startsAt, now);
  return d >= 0 && d <= daysBefore;
}

/** "Falta una semana": entre 3 y 7 días naturales antes (el de 48 h cubre lo más cercano). */
export function isEvent7dDue(startsAt: Date, now: Date): boolean {
  if (startsAt.getTime() <= now.getTime()) return false;
  const d = daysUntilEvent(startsAt, now);
  return d >= EVENT_7D_MIN_DAYS && d <= EVENT_7D_MAX_DAYS;
}

/** "Todo listo": dentro de las 48 horas previas al inicio. */
export function isEvent48hDue(startsAt: Date, now: Date): boolean {
  const diff = startsAt.getTime() - now.getTime();
  return diff > 0 && diff <= EVENT_48H_HOURS * HOUR_MS;
}

/** Ventana de búsqueda en DB para eventos próximos (cubre RSVP, 7D y 48H). */
export function upcomingEventsWindow(now: Date, rsvpDaysBefore: number): Window {
  const days = Math.max(rsvpDaysBefore, EVENT_7D_MAX_DAYS) + 1;
  return { from: now, to: new Date(now.getTime() + days * DAY_MS) };
}

/** Post-evento: completado hace ≥ 1 día (y no hace más de 30). */
export function isPostEventDue(completedAt: Date | null | undefined, now: Date): boolean {
  if (!completedAt) return false;
  const elapsed = now.getTime() - completedAt.getTime();
  return elapsed >= POST_EVENT_MIN_DAYS * DAY_MS && elapsed <= POST_EVENT_MAX_DAYS * DAY_MS;
}

/** Reseña: completado hace ≥ 3 días (y no hace más de 45). */
export function isReviewRequestDue(completedAt: Date | null | undefined, now: Date): boolean {
  if (!completedAt) return false;
  const elapsed = now.getTime() - completedAt.getTime();
  return elapsed >= REVIEW_REQUEST_MIN_DAYS * DAY_MS && elapsed <= REVIEW_REQUEST_MAX_DAYS * DAY_MS;
}

/** Ventana de búsqueda en DB para eventos completados (post-evento y reseñas). */
export function completedEventsWindow(now: Date): Window {
  return {
    from: new Date(now.getTime() - Math.max(POST_EVENT_MAX_DAYS, REVIEW_REQUEST_MAX_DAYS) * DAY_MS),
    to: new Date(now.getTime() - POST_EVENT_MIN_DAYS * DAY_MS),
  };
}

// -----------------------------------------------------------------------------
// Claves de idempotencia
// -----------------------------------------------------------------------------

export type ChannelKey = "email" | "wa";

export const dedupeKeys = {
  quoteExpiring: (quoteId: string, validUntil: Date) => `sched:quote_expiring:${quoteId}:${validUntil.getTime()}`,
  paymentDue: (bookingId: string, balanceDueAt: Date, stage: PaymentDueStage) =>
    `sched:payment_due:${bookingId}:${balanceDueAt.getTime()}:${stage}`,
  rsvpReminder: (eventId: string, guestId: string) => `sched:rsvp_reminder:${eventId}:${guestId}`,
  event7d: (eventId: string, startsAt: Date) => `sched:event_7d:${eventId}:${startsAt.getTime()}`,
  event48h: (eventId: string, startsAt: Date) => `sched:event_48h:${eventId}:${startsAt.getTime()}`,
  postEvent: (eventId: string) => `sched:post_event:${eventId}`,
  reviewRequest: (eventId: string) => `sched:review_request:${eventId}`,
} as const;

export function withChannel(base: string, channel: ChannelKey): string {
  return `${base}:${channel}`;
}

// -----------------------------------------------------------------------------
// Reintentos de envíos fallidos
// -----------------------------------------------------------------------------

/** Intentos máximos por mensaje programado (el original + reintentos). */
export const MAX_SEND_ATTEMPTS = 3;
/** Un registro QUEUED más viejo que esto quedó a medias (el proceso se cayó a mitad del envío). */
export const STALE_QUEUED_MS = 15 * 60 * 1000;

/**
 * ¿Se debe reintentar un mensaje programado cuyo dedupeKey ya existe?
 * Sólo si el intento anterior FALLÓ (o quedó QUEUED y abandonado) y no se agotaron los intentos.
 * Enviados, simulados (mock) u omitidos (WhatsApp apagado / teléfono inválido) nunca se repiten.
 */
export function shouldRetrySend(
  previous: { status: "QUEUED" | "SENT" | "MOCKED" | "FAILED" | "SKIPPED"; createdAt: Date },
  attemptsSoFar: number,
  now: Date,
): boolean {
  if (attemptsSoFar >= MAX_SEND_ATTEMPTS) return false;
  if (previous.status === "FAILED") return true;
  if (previous.status === "QUEUED") return now.getTime() - previous.createdAt.getTime() >= STALE_QUEUED_MS;
  return false;
}

/** Prefijo de los intentos archivados de un dedupeKey. */
export function retryArchivePrefix(key: string): string {
  return `${key}:attempt:`;
}

/** dedupeKey con el que se archiva un intento fallido para liberar la clave original. */
export function retryArchiveKey(key: string, attempt: number): string {
  return `${retryArchivePrefix(key)}${attempt}`;
}

// -----------------------------------------------------------------------------
// Resultado
// -----------------------------------------------------------------------------

export type SchedulerCounts = {
  quoteExpiring: number;
  quotesExpired: number;
  paymentDue: number;
  rsvpReminder: number;
  event7d: number;
  event48h: number;
  postEvent: number;
  reviewRequest: number;
};

export const SCHEDULER_RULE_LABELS: Record<keyof SchedulerCounts, string> = {
  quoteExpiring: "Cotizaciones por vencer",
  quotesExpired: "Cotizaciones expiradas",
  paymentDue: "Recordatorios de saldo",
  rsvpReminder: "Recordatorios RSVP",
  event7d: "Evento en 7 días",
  event48h: "Evento en 48 h",
  postEvent: "Post-evento",
  reviewRequest: "Solicitudes de reseña",
};

export function emptyCounts(): SchedulerCounts {
  return {
    quoteExpiring: 0,
    quotesExpired: 0,
    paymentDue: 0,
    rsvpReminder: 0,
    event7d: 0,
    event48h: 0,
    postEvent: 0,
    reviewRequest: 0,
  };
}

export function totalCount(counts: SchedulerCounts): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/** "3 recordatorios RSVP · 1 cotización expirada" (sólo reglas con actividad). */
export function summarizeCounts(counts: SchedulerCounts): string {
  const parts = (Object.keys(counts) as Array<keyof SchedulerCounts>)
    .filter((k) => counts[k] > 0)
    .map((k) => `${SCHEDULER_RULE_LABELS[k]}: ${counts[k]}`);
  return parts.length ? parts.join(" · ") : "No había recordatorios pendientes.";
}
