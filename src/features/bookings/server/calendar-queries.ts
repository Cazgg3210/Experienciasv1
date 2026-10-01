import "server-only";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/db";
import { dateOnly, toDateKey } from "@/lib/dates";
import { getRangeAvailability, type DayAvailability } from "./availability-service";
import { gridRange, monthGrid, type CalendarCell } from "../domain/calendar-month";

export type CalendarEvent = {
  id: string;
  code: string;
  title: string;
  status: EventStatus;
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
  guestCount: number;
  customerName: string;
  zoneName: string | null;
};

export type CalendarMonthData = {
  monthKey: string;
  weeks: CalendarCell[][];
  eventsByDay: Record<string, CalendarEvent[]>;
  availabilityByDay: Record<string, DayAvailability>;
  totals: { events: number; cancelled: number };
};

/** Eventos (sin cancelados) y disponibilidad por día de la cuadrícula del mes. */
export async function getCalendarMonth(monthKey: string): Promise<CalendarMonthData> {
  const weeks = monthGrid(monthKey);
  const range = gridRange(weeks);
  const [events, cancelled, days] = await Promise.all([
    prisma.event.findMany({
      where: {
        eventDate: { gte: dateOnly(range.fromKey), lte: dateOnly(range.toKey) },
        status: { not: "CANCELLED" },
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        eventDate: true,
        startsAt: true,
        endsAt: true,
        guestCount: true,
        customer: { select: { name: true } },
        serviceArea: { select: { name: true } },
      },
    }),
    prisma.event.count({
      where: {
        eventDate: { gte: dateOnly(`${monthKey}-01`), lte: dateOnly(lastDayKey(monthKey)) },
        status: "CANCELLED",
      },
    }),
    getRangeAvailability(range.fromKey, range.days),
  ]);

  const eventsByDay: Record<string, CalendarEvent[]> = {};
  let inMonth = 0;
  for (const e of events) {
    const key = toDateKey(e.eventDate);
    if (key.startsWith(monthKey)) inMonth += 1;
    (eventsByDay[key] ??= []).push({
      id: e.id,
      code: e.code,
      title: e.title,
      status: e.status,
      dateKey: key,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      guestCount: e.guestCount,
      customerName: e.customer.name,
      zoneName: e.serviceArea?.name ?? null,
    });
  }
  const availabilityByDay: Record<string, DayAvailability> = {};
  for (const d of days) availabilityByDay[d.date] = d;
  return { monthKey, weeks, eventsByDay, availabilityByDay, totals: { events: inMonth, cancelled } };
}

function lastDayKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return toDateKey(new Date(Date.UTC(y!, m!, 0)));
}
