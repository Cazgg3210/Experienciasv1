import "server-only";
import { prisma } from "@/db";
import { dateOnly, isValidDateKey, localDateKey, toDateKey, weekdayOf, zonedDateTime } from "@/lib/dates";
import { getSettings } from "@/features/settings/server/settings-service";
import { CAPACITY_STATUSES } from "@/features/events/domain/event-status";
import { evaluateAvailability, type AvailabilityResult } from "../domain/availability";

export type CheckAvailabilityInput = {
  date: string; // YYYY-MM-DD
  serviceAreaId?: string | null;
  startTime?: string | null; // HH:mm
  durationMinutes?: number | null;
  excludeEventId?: string | null;
};

/** Revisa disponibilidad de una fecha (y opcionalmente horario) contra reglas y eventos existentes. */
export async function checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
  if (!isValidDateKey(input.date)) {
    return {
      status: "PAST",
      available: false,
      acceptsRequests: false,
      capacity: 0,
      booked: 0,
      remaining: 0,
      reason: "Fecha inválida.",
      overlaps: [],
    };
  }
  const day = dateOnly(input.date);
  const [rule, exceptions, events, availability] = await Promise.all([
    prisma.availabilityRule.findUnique({ where: { weekday: weekdayOf(input.date) } }),
    prisma.availabilityException.findMany({ where: { date: day } }),
    prisma.event.findMany({
      where: { eventDate: day, status: { in: CAPACITY_STATUSES } },
      select: { id: true, startsAt: true, endsAt: true, serviceAreaId: true },
    }),
    getSettings("availability"),
  ]);
  const requestedStartsAt = input.startTime ? zonedDateTime(input.date, input.startTime) : null;
  const requestedEndsAt =
    requestedStartsAt && input.durationMinutes
      ? new Date(requestedStartsAt.getTime() + input.durationMinutes * 60_000)
      : null;
  return evaluateAvailability({
    dateKey: input.date,
    todayKey: localDateKey(),
    rule: rule
      ? { isOpen: rule.isOpen, maxEvents: rule.maxEvents, earliestStart: rule.earliestStart, latestEnd: rule.latestEnd }
      : null,
    exceptions: exceptions.map((e) => ({
      type: e.type,
      maxEvents: e.maxEvents,
      serviceAreaId: e.serviceAreaId,
      reason: e.reason,
    })),
    events,
    settings: availability,
    serviceAreaId: input.serviceAreaId ?? null,
    startTime: input.startTime ?? null,
    durationMinutes: input.durationMinutes ?? null,
    excludeEventId: input.excludeEventId ?? null,
    requestedStartsAt,
    requestedEndsAt,
  });
}

export type DayAvailability = { date: string } & Pick<
  AvailabilityResult,
  "status" | "available" | "acceptsRequests" | "remaining" | "capacity" | "booked" | "reason"
>;

/** Disponibilidad de un rango de días (calendarios del configurador y del admin). Máx. 62 días. */
export async function getRangeAvailability(
  fromKey: string,
  days: number,
  serviceAreaId?: string | null,
): Promise<DayAvailability[]> {
  const count = Math.min(Math.max(days, 1), 62);
  const from = dateOnly(fromKey);
  const to = new Date(from.getTime() + (count - 1) * 86_400_000);
  const [rules, exceptions, events, availability] = await Promise.all([
    prisma.availabilityRule.findMany(),
    prisma.availabilityException.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.event.findMany({
      where: { eventDate: { gte: from, lte: to }, status: { in: CAPACITY_STATUSES } },
      select: { id: true, eventDate: true, startsAt: true, endsAt: true, serviceAreaId: true },
    }),
    getSettings("availability"),
  ]);
  const todayKey = localDateKey();
  const out: DayAvailability[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    const key = toDateKey(d);
    const rule = rules.find((r) => r.weekday === d.getUTCDay()) ?? null;
    const r = evaluateAvailability({
      dateKey: key,
      todayKey,
      rule: rule
        ? { isOpen: rule.isOpen, maxEvents: rule.maxEvents, earliestStart: rule.earliestStart, latestEnd: rule.latestEnd }
        : null,
      exceptions: exceptions
        .filter((e) => toDateKey(e.date) === key)
        .map((e) => ({ type: e.type, maxEvents: e.maxEvents, serviceAreaId: e.serviceAreaId, reason: e.reason })),
      events: events.filter((e) => toDateKey(e.eventDate) === key),
      settings: availability,
      serviceAreaId: serviceAreaId ?? null,
    });
    out.push({
      date: key,
      status: r.status,
      available: r.available,
      acceptsRequests: r.acceptsRequests,
      remaining: r.remaining,
      capacity: r.capacity,
      booked: r.booked,
      reason: r.reason,
    });
  }
  return out;
}
