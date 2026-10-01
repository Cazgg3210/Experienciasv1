import "server-only";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { formatDateTime, formatLongDate, localTime } from "@/lib/dates";
import { isEnabled } from "@/lib/flags";
import { logger } from "@/lib/logger";
import { formatMXN } from "@/lib/money";
import { audit } from "@/server/audit";
import { quoteStatusMachine } from "@/features/quotes/domain/quote-status";
import { getSettings } from "@/features/settings/server/settings-service";
import {
  DAY_MS,
  PAYMENT_DUE_DAYS_AHEAD,
  balanceCents,
  completedEventsWindow,
  daysUntilEvent,
  dedupeKeys,
  emptyCounts,
  isEvent48hDue,
  isEvent7dDue,
  isPostEventDue,
  isQuoteExpiringSoon,
  isQuoteOverdue,
  isReviewRequestDue,
  isRsvpReminderDue,
  paymentDueStage,
  quoteExpiringWindow,
  retryArchiveKey,
  retryArchivePrefix,
  shouldRetrySend,
  totalCount,
  upcomingEventsWindow,
  withChannel,
  type SchedulerCounts,
} from "../domain/schedule-rules";
import { notify, type NotifyInput } from "./notification-service";

/** Estados de eventos confirmados que aún no ocurren. */
const UPCOMING_EVENT_STATUSES = ["CONFIRMED", "PLANNING", "READY"] as const;

export type SchedulerResult = {
  ranAt: string;
  counts: SchedulerCounts;
  total: number;
  /** Reglas que fallaron (las demás sí se ejecutaron) */
  failedRules: Array<keyof SchedulerCounts>;
};

/**
 * Limita la ejecución a ciertas clientas (p. ej. "ejecutar recordatorios de este evento"
 * o pruebas aisladas). Sin scope se procesa todo.
 */
export type SchedulerOptions = { scope?: { customerIds?: string[] } };

type Scope = { customerId?: { in: string[] } };
function scopeWhere(options: SchedulerOptions): Scope {
  const ids = options.scope?.customerIds;
  return ids ? { customerId: { in: ids } } : {};
}

type Contact = { email?: string | null; phone?: string | null; whatsapp?: string | null };
type BaseInput = Omit<NotifyInput, "channel" | "to" | "dedupeKey">;

/**
 * Si el intento anterior con este dedupeKey falló (o quedó abandonado en QUEUED) y aún hay
 * intentos disponibles, lo archiva con otra clave (queda visible en la Bandeja) y libera la
 * clave para reintentar. Devuelve true si se puede volver a enviar.
 */
async function releaseForRetry(
  previous: { id: string; status: NotificationStatus; createdAt: Date },
  key: string,
  now: Date,
): Promise<boolean> {
  if (previous.status !== "FAILED" && previous.status !== "QUEUED") return false;
  const archived = await prisma.notificationLog.count({ where: { dedupeKey: { startsWith: retryArchivePrefix(key) } } });
  const attemptsSoFar = archived + 1;
  if (!shouldRetrySend(previous, attemptsSoFar, now)) return false;
  // Condicional: si otra ejecución ya lo archivó (o cambió de estado), no se duplica el reintento.
  const moved = await prisma.notificationLog.updateMany({
    where: { id: previous.id, dedupeKey: key, status: previous.status },
    data: { dedupeKey: retryArchiveKey(key, attemptsSoFar) },
  });
  return moved.count === 1;
}

/**
 * Envía por cada canal disponible (email / WhatsApp) una sola vez por dedupeKey
 * (reintenta sólo envíos fallidos, hasta MAX_SEND_ATTEMPTS).
 * Devuelve cuántos mensajes NUEVOS quedaron registrados en NotificationLog.
 */
async function sendOnce(contact: Contact, input: BaseInput, baseKey: string, now: Date): Promise<number> {
  const phone = contact.whatsapp || contact.phone;
  const targets: Array<{ channel: NotificationChannel; to: string; key: string }> = [];
  if (contact.email) targets.push({ channel: "EMAIL", to: contact.email, key: withChannel(baseKey, "email") });
  if (phone) targets.push({ channel: "WHATSAPP", to: phone, key: withChannel(baseKey, "wa") });
  if (!targets.length) return 0;

  const existing = await prisma.notificationLog.findMany({
    where: { dedupeKey: { in: targets.map((t) => t.key) } },
    select: { id: true, dedupeKey: true, status: true, createdAt: true },
  });
  const byKey = new Map(existing.map((e) => [e.dedupeKey, e]));
  let created = 0;
  for (const t of targets) {
    const previous = byKey.get(t.key);
    if (previous && !(await releaseForRetry(previous, t.key, now))) continue;
    const res = await notify({ ...input, channel: t.channel, to: t.to, dedupeKey: t.key });
    if (res) created += 1;
  }
  return created;
}

const portalUrl = (portalToken: string) => appUrl(`/mi-evento/${portalToken}`);

// -----------------------------------------------------------------------------
// Reglas
// -----------------------------------------------------------------------------

async function ruleQuoteExpiring(now: Date, hoursBefore: number, scope: Scope): Promise<number> {
  const w = quoteExpiringWindow(now, hoursBefore);
  const quotes = await prisma.quote.findMany({
    where: { ...scope, status: "SENT", validUntil: { gt: w.from, lte: w.to } },
    select: {
      id: true,
      code: true,
      title: true,
      publicToken: true,
      validUntil: true,
      leadId: true,
      customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
    },
  });
  let count = 0;
  for (const q of quotes) {
    if (!q.validUntil || !isQuoteExpiringSoon(q.validUntil, now, hoursBefore)) continue;
    count += await sendOnce(
      q.customer,
      {
        type: "QUOTE_EXPIRING",
        quoteId: q.id,
        leadId: q.leadId,
        data: {
          name: q.customer.name,
          quoteCode: q.code,
          eventTitle: q.title,
          validUntil: `el ${formatDateTime(q.validUntil)}`,
          url: appUrl(`/cotizacion/${q.publicToken}`),
        },
      },
      dedupeKeys.quoteExpiring(q.id, q.validUntil),
      now,
    );
  }
  return count;
}

async function ruleExpireQuotes(now: Date, scope: Scope): Promise<number> {
  const overdue = await prisma.quote.findMany({
    where: { ...scope, status: "SENT", validUntil: { lte: now } },
    select: { id: true, code: true, validUntil: true },
  });
  let count = 0;
  for (const q of overdue) {
    if (!isQuoteOverdue(q.validUntil, now)) continue;
    quoteStatusMachine.assert("SENT", "EXPIRED");
    // updateMany con condición de estado: seguro ante ejecuciones concurrentes
    const res = await prisma.quote.updateMany({
      where: { id: q.id, status: "SENT" },
      data: { status: "EXPIRED", expiredAt: now },
    });
    if (res.count > 0) {
      count += 1;
      await audit({
        action: "quote.expired",
        entityType: "Quote",
        entityId: q.id,
        before: { status: "SENT", validUntil: q.validUntil },
        after: { status: "EXPIRED", expiredAt: now, by: "scheduler" },
        actor: null,
      });
    }
  }
  return count;
}

async function rulePaymentDue(now: Date, scope: Scope): Promise<number> {
  const limit = new Date(now.getTime() + PAYMENT_DUE_DAYS_AHEAD * DAY_MS);
  const bookings = await prisma.booking.findMany({
    where: {
      ...scope,
      cancelledAt: null,
      balanceDueAt: { not: null, lte: limit },
      event: { status: { in: [...UPCOMING_EVENT_STATUSES] } },
    },
    select: {
      id: true,
      totalCents: true,
      balanceDueAt: true,
      payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
      customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
      event: { select: { id: true, title: true, portalToken: true, quoteId: true, eventDate: true } },
    },
  });
  let count = 0;
  for (const b of bookings) {
    if (!b.balanceDueAt) continue;
    const balance = balanceCents(b.totalCents, b.payments);
    if (balance <= 0) continue;
    const stage = paymentDueStage(b.balanceDueAt, now);
    if (!stage) continue;
    count += await sendOnce(
      b.customer,
      {
        type: "PAYMENT_DUE",
        eventId: b.event.id,
        quoteId: b.event.quoteId,
        data: {
          name: b.customer.name,
          eventTitle: b.event.title,
          eventDate: formatLongDate(b.event.eventDate),
          amount: formatMXN(balance),
          url: portalUrl(b.event.portalToken),
        },
      },
      dedupeKeys.paymentDue(b.id, b.balanceDueAt, stage),
      now,
    );
  }
  return count;
}

async function ruleUpcomingEvents(
  now: Date,
  rsvpDaysBefore: number,
  scope: Scope,
): Promise<Pick<SchedulerCounts, "rsvpReminder" | "event7d" | "event48h">> {
  const w = upcomingEventsWindow(now, rsvpDaysBefore);
  const events = await prisma.event.findMany({
    where: { ...scope, status: { in: [...UPCOMING_EVENT_STATUSES] }, startsAt: { gt: w.from, lte: w.to } },
    select: {
      id: true,
      title: true,
      eventDate: true,
      startsAt: true,
      micrositeSlug: true,
      micrositeEnabled: true,
      portalToken: true,
      customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
      guests: {
        where: { rsvpStatus: "PENDING" },
        select: { id: true, name: true, email: true, phone: true, token: true },
      },
    },
  });
  const out = { rsvpReminder: 0, event7d: 0, event48h: 0 };
  for (const ev of events) {
    const eventDate = formatLongDate(ev.eventDate);

    if (ev.micrositeEnabled && isRsvpReminderDue(ev.startsAt, now, rsvpDaysBefore)) {
      for (const g of ev.guests) {
        if (!g.email && !g.phone) continue;
        out.rsvpReminder += await sendOnce(
          { email: g.email, phone: g.phone },
          {
            type: "RSVP_REMINDER",
            eventId: ev.id,
            data: {
              name: g.name,
              eventTitle: ev.title,
              eventDate,
              url: appUrl(`/e/${ev.micrositeSlug}/${g.token}`),
            },
          },
          dedupeKeys.rsvpReminder(ev.id, g.id),
          now,
        );
      }
    }

    if (isEvent7dDue(ev.startsAt, now)) {
      out.event7d += await sendOnce(
        ev.customer,
        {
          type: "EVENT_7D",
          eventId: ev.id,
          data: {
            name: ev.customer.name,
            eventTitle: ev.title,
            eventDate,
            daysLeft: daysUntilEvent(ev.startsAt, now),
            url: portalUrl(ev.portalToken),
          },
        },
        dedupeKeys.event7d(ev.id, ev.startsAt),
        now,
      );
    }

    if (isEvent48hDue(ev.startsAt, now)) {
      out.event48h += await sendOnce(
        ev.customer,
        {
          type: "EVENT_48H",
          eventId: ev.id,
          data: {
            name: ev.customer.name,
            eventTitle: ev.title,
            eventDate,
            eventTime: localTime(ev.startsAt),
            url: portalUrl(ev.portalToken),
          },
        },
        dedupeKeys.event48h(ev.id, ev.startsAt),
        now,
      );
    }
  }
  return out;
}

async function ruleCompletedEvents(
  now: Date,
  scope: Scope,
): Promise<Pick<SchedulerCounts, "postEvent" | "reviewRequest">> {
  const w = completedEventsWindow(now);
  const events = await prisma.event.findMany({
    where: {
      ...scope,
      status: "COMPLETED",
      OR: [
        { completedAt: { gte: w.from, lte: w.to } },
        { completedAt: null, endsAt: { gte: w.from, lte: w.to } },
      ],
    },
    select: {
      id: true,
      title: true,
      portalToken: true,
      completedAt: true,
      endsAt: true,
      customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
      memoryCapsule: { select: { published: true, shareToken: true } },
      review: { select: { id: true } },
      // Mensajes ya entregados (p. ej. al cerrar el evento); los fallidos no cuentan para poder reintentarlos
      notifications: {
        where: { type: { in: ["POST_EVENT", "REVIEW_REQUEST"] }, status: { not: "FAILED" } },
        select: { type: true },
      },
    },
  });
  const memoryEnabled = await isEnabled("MEMORY_CAPSULE_ENABLED");
  const out = { postEvent: 0, reviewRequest: 0 };
  for (const ev of events) {
    const completedAt = ev.completedAt ?? ev.endsAt;
    const sentTypes = new Set(ev.notifications.map((n) => n.type));

    if (isPostEventDue(completedAt, now) && !sentTypes.has("POST_EVENT")) {
      const capsule = memoryEnabled && ev.memoryCapsule?.published ? ev.memoryCapsule : null;
      out.postEvent += await sendOnce(
        ev.customer,
        {
          type: "POST_EVENT",
          eventId: ev.id,
          data: capsule
            ? {
                name: ev.customer.name,
                eventTitle: ev.title,
                url: appUrl(`/memory/${capsule.shareToken}`),
              }
            : {
                name: ev.customer.name,
                eventTitle: ev.title,
                message: "Muy pronto compartiremos contigo las fotos y los recuerdos del día.",
                ctaLabel: "Ver mi evento",
                url: portalUrl(ev.portalToken),
              },
        },
        dedupeKeys.postEvent(ev.id),
        now,
      );
    }

    if (isReviewRequestDue(completedAt, now) && !ev.review && !sentTypes.has("REVIEW_REQUEST")) {
      out.reviewRequest += await sendOnce(
        ev.customer,
        {
          type: "REVIEW_REQUEST",
          eventId: ev.id,
          data: { name: ev.customer.name, eventTitle: ev.title, url: portalUrl(ev.portalToken) },
        },
        dedupeKeys.reviewRequest(ev.id),
        now,
      );
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Orquestador
// -----------------------------------------------------------------------------

/**
 * Ejecuta todas las reglas de notificaciones programadas. Idempotente: cada mensaje lleva
 * un dedupeKey único, así que correrlo varias veces no duplica envíos.
 * Una regla que falla no detiene a las demás (se reporta en `failedRules`).
 */
export async function runScheduledNotifications(
  now: Date = new Date(),
  options: SchedulerOptions = {},
): Promise<SchedulerResult> {
  const scope = scopeWhere(options);
  const counts = emptyCounts();
  const failedRules: Array<keyof SchedulerCounts> = [];
  const ns = await getSettings("notifications");

  async function step<K extends keyof SchedulerCounts>(keys: K[], fn: () => Promise<Pick<SchedulerCounts, K>>) {
    try {
      const res = await fn();
      for (const k of keys) counts[k] = res[k];
    } catch (error) {
      failedRules.push(...keys);
      logger.error("scheduler.rule_failed", { error, rules: keys });
    }
  }

  await step(["quoteExpiring"], async () => ({ quoteExpiring: await ruleQuoteExpiring(now, ns.quoteExpiringHoursBefore, scope) }));
  await step(["quotesExpired"], async () => ({ quotesExpired: await ruleExpireQuotes(now, scope) }));
  await step(["paymentDue"], async () => ({ paymentDue: await rulePaymentDue(now, scope) }));
  await step(["rsvpReminder", "event7d", "event48h"], () => ruleUpcomingEvents(now, ns.rsvpReminderDaysBefore, scope));
  await step(["postEvent", "reviewRequest"], () => ruleCompletedEvents(now, scope));

  const result: SchedulerResult = { ranAt: now.toISOString(), counts, total: totalCount(counts), failedRules };
  logger.info("scheduler.run", { ...counts, failedRules });
  return result;
}
