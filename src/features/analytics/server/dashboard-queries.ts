import "server-only";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/db";
import { readClosingSnapshot, weightedMarginBps } from "@/features/financials/domain/event-financials";
import {
  changeBps,
  checklistProgressBps,
  computeInventoryConflicts,
  currentMonthKey,
  dateWindow,
  monthBucket,
  rateBps,
  rollingWindow,
  rsvpPendingBps,
  rsvpProgressBps,
} from "../domain/metrics";
import { toDateKey } from "@/lib/dates";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Estados con venta confirmada (anticipo pagado o más). */
const CONFIRMED_SALE: EventStatus[] = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"];
/** Eventos vivos en el calendario (no cancelados ni consulta). */
const LIVE: EventStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PLANNING", "READY", "IN_PROGRESS"];
const OPERATIONAL: EventStatus[] = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS"];

type PaymentLite = { kind: string; status: string; amountCents: number; refundedCents: number };

function netPaid(payments: PaymentLite[]): number {
  return payments
    .filter(
      (p) =>
        p.kind !== "REFUND" &&
        (p.status === "PAID" || p.status === "PARTIAL_REFUND" || p.status === "REFUNDED"),
    )
    .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
}

// ============================================================================
// KPIs
// ============================================================================

export async function getDashboardKpis(now: Date = new Date()) {
  const w30 = rollingWindow(30, now);
  const w90 = rollingWindow(90, now);
  const month = monthBucket(currentMonthKey(now));
  const next30 = dateWindow(30, now);
  const marginWindowStart = new Date(dateWindow(0, now).start.getTime() - 90 * DAY);
  const marginWindowEnd = new Date(dateWindow(0, now).start.getTime() + 91 * DAY);

  const [
    leadsCurrent,
    leadsPrevious,
    closedLeads,
    bookings30,
    upcoming,
    monthBookings,
    monthPayments,
    ticketBookings,
    marginEvents,
    closedEvents,
    balanceEvents,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: w30.from, lt: w30.to } } }),
    prisma.lead.count({ where: { createdAt: { gte: w30.prevFrom, lt: w30.prevTo } } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { createdAt: { gte: w90.from, lt: w90.to }, status: { in: ["WON", "LOST"] } },
      _count: { _all: true },
    }),
    prisma.booking.count({ where: { createdAt: { gte: w30.from, lt: w30.to }, cancelledAt: null } }),
    prisma.event.aggregate({
      where: { eventDate: { gte: next30.start, lt: next30.end }, status: { in: LIVE } },
      _count: { _all: true },
      _sum: { guestCount: true },
    }),
    prisma.booking.findMany({
      where: {
        createdAt: { gte: month.start, lt: month.end },
        cancelledAt: null,
        event: { status: { in: CONFIRMED_SALE } },
      },
      select: { totalCents: true },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: month.start, lt: month.end },
        kind: { not: "REFUND" },
        status: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] },
      },
      select: { amountCents: true, refundedCents: true },
    }),
    prisma.booking.findMany({
      where: {
        createdAt: { gte: w90.from, lt: w90.to },
        cancelledAt: null,
        event: { status: { in: CONFIRMED_SALE } },
      },
      select: { totalCents: true },
    }),
    prisma.event.findMany({
      where: {
        status: { in: CONFIRMED_SALE },
        eventDate: { gte: marginWindowStart, lt: marginWindowEnd },
        quote: { isNot: null },
      },
      select: { quote: { select: { totalCents: true, taxCents: true, estimatedMarginCents: true } } },
    }),
    prisma.event.findMany({
      where: { closedAt: { not: null, gte: new Date(now.getTime() - 365 * DAY) } },
      select: { closingSnapshot: true },
    }),
    prisma.event.findMany({
      where: { status: { in: CONFIRMED_SALE }, closedAt: null, booking: { is: { cancelledAt: null } } },
      select: {
        booking: {
          select: {
            totalCents: true,
            payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
          },
        },
      },
    }),
  ]);

  const won = closedLeads.find((g) => g.status === "WON")?._count._all ?? 0;
  const lost = closedLeads.find((g) => g.status === "LOST")?._count._all ?? 0;

  const ticketTotal = ticketBookings.reduce((s, b) => s + b.totalCents, 0);
  const closings = closedEvents.map((e) => readClosingSnapshot(e.closingSnapshot)).filter((x) => x != null);

  const balances = balanceEvents
    .map((e) => (e.booking ? Math.max(0, e.booking.totalCents - netPaid(e.booking.payments)) : 0))
    .filter((b) => b > 0);

  return {
    leads: {
      current: leadsCurrent,
      previous: leadsPrevious,
      changeBps: changeBps(leadsCurrent, leadsPrevious),
    },
    conversion: {
      won,
      lost,
      rateBps: rateBps(won, won + lost),
      bookings30: bookings30,
      bookingRateBps: rateBps(bookings30, leadsCurrent),
    },
    upcoming: { count: upcoming._count._all, guests: upcoming._sum.guestCount ?? 0 },
    revenueMonth: {
      label: month.label,
      soldCents: monthBookings.reduce((s, b) => s + b.totalCents, 0),
      soldCount: monthBookings.length,
      collectedCents: monthPayments.reduce((s, p) => s + p.amountCents - p.refundedCents, 0),
    },
    avgTicket: {
      cents: ticketBookings.length ? Math.round(ticketTotal / ticketBookings.length) : null,
      count: ticketBookings.length,
    },
    estimatedMargin: {
      bps: weightedMarginBps(
        marginEvents
          .filter((e) => e.quote)
          .map((e) => ({
            marginCents: e.quote!.estimatedMarginCents,
            revenueCents: e.quote!.totalCents - e.quote!.taxCents,
          })),
      ),
      count: marginEvents.length,
    },
    actualMargin: {
      bps: weightedMarginBps(
        closings.map((c) => ({ marginCents: c.actualMarginCents, revenueCents: c.netRevenueCents })),
      ),
      count: closings.length,
    },
    pendingBalances: { cents: balances.reduce((s, b) => s + b, 0), count: balances.length },
  };
}

export type DashboardKpis = Awaited<ReturnType<typeof getDashboardKpis>>;

// ============================================================================
// Próximos 7 días
// ============================================================================

export async function getNextSevenDays(now: Date = new Date()) {
  const w = dateWindow(7, now);
  const events = await prisma.event.findMany({
    where: { eventDate: { gte: w.start, lt: w.end }, status: { in: LIVE } },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      startsAt: true,
      eventDate: true,
      guestCount: true,
      customer: { select: { name: true } },
      guests: { select: { rsvpStatus: true } },
      checklistItems: { select: { status: true } },
      _count: { select: { staffAssignments: true } },
    },
  });
  return events.map((e) => ({
    id: e.id,
    code: e.code,
    title: e.title,
    status: e.status,
    startsAt: e.startsAt,
    eventDate: e.eventDate,
    guestCount: e.guestCount,
    customerName: e.customer.name,
    guestsInvited: e.guests.length,
    rsvpBps: rsvpProgressBps(e.guests),
    checklistBps: checklistProgressBps(e.checklistItems),
    staffCount: e._count.staffAssignments,
  }));
}

// ============================================================================
// Pendientes críticos
// ============================================================================

export const CRITICAL_LIST_LIMIT = 6;

export async function getCriticalPending(now: Date = new Date()) {
  const w7 = dateWindow(7, now);
  const overdueWhere = {
    dueAt: { lt: now },
    status: { in: ["PENDING" as const, "IN_PROGRESS" as const] },
    event: { status: { in: LIVE } },
  };
  const expiringWhere = {
    status: "SENT" as const,
    validUntil: { gte: now, lt: new Date(now.getTime() + 48 * HOUR) },
  };
  const staleWhere = {
    status: "NEW" as const,
    lastContactedAt: null,
    createdAt: { lt: new Date(now.getTime() - 24 * HOUR) },
  };
  const [overdue, overdueCount, expiringQuotes, expiringCount, staleLeads, staleCount, unstaffed] =
    await Promise.all([
      prisma.eventChecklistItem.findMany({
        where: overdueWhere,
        orderBy: [{ dueAt: "asc" }],
        take: CRITICAL_LIST_LIMIT,
        select: {
          id: true,
          title: true,
          dueAt: true,
          phase: true,
          event: { select: { id: true, title: true } },
        },
      }),
      prisma.eventChecklistItem.count({ where: overdueWhere }),
      prisma.quote.findMany({
        where: expiringWhere,
        orderBy: [{ validUntil: "asc" }],
        take: CRITICAL_LIST_LIMIT,
        select: {
          id: true,
          code: true,
          title: true,
          validUntil: true,
          totalCents: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.quote.count({ where: expiringWhere }),
      // Los más recientes primero: son los que todavía se pueden rescatar con una llamada hoy.
      prisma.lead.findMany({
        where: staleWhere,
        orderBy: [{ createdAt: "desc" }],
        take: CRITICAL_LIST_LIMIT,
        select: { id: true, code: true, name: true, createdAt: true, occasion: true, source: true },
      }),
      prisma.lead.count({ where: staleWhere }),
      prisma.event.findMany({
        where: {
          eventDate: { gte: w7.start, lt: w7.end },
          status: { in: LIVE },
          staffAssignments: { none: {} },
        },
        orderBy: [{ startsAt: "asc" }],
        select: { id: true, title: true, startsAt: true, status: true },
      }),
    ]);
  return {
    overdueChecklist: { items: overdue, count: overdueCount },
    expiringQuotes: { items: expiringQuotes, count: expiringCount },
    staleLeads: { items: staleLeads, count: staleCount },
    unstaffedEvents: unstaffed,
    total: overdueCount + expiringCount + staleCount + unstaffed.length,
  };
}

// ============================================================================
// Inventario en conflicto (próximos 30 días)
// ============================================================================

export async function getInventoryConflicts(now: Date = new Date()) {
  const w = dateWindow(30, now);
  const reservations = await prisma.inventoryReservation.findMany({
    where: {
      status: { in: ["RESERVED", "CHECKED_OUT"] },
      event: { eventDate: { gte: w.start, lt: w.end }, status: { not: "CANCELLED" } },
    },
    select: {
      inventoryItemId: true,
      quantity: true,
      event: { select: { id: true, title: true, eventDate: true } },
    },
  });
  if (reservations.length === 0) return [];
  const itemIds = [...new Set(reservations.map((r) => r.inventoryItemId))];
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, sku: true, totalQuantity: true, maintenanceQuantity: true },
  });
  return computeInventoryConflicts(
    items,
    reservations.map((r) => ({
      inventoryItemId: r.inventoryItemId,
      eventId: r.event.id,
      eventTitle: r.event.title,
      dateKey: toDateKey(r.event.eventDate),
      quantity: r.quantity,
    })),
  );
}

// ============================================================================
// Pagos pendientes
// ============================================================================

export async function getPendingPayments(now: Date = new Date()) {
  const horizon = new Date(now.getTime() + 7 * DAY);
  const [depositEvents, balanceEvents] = await Promise.all([
    prisma.event.findMany({
      where: { status: "PENDING_PAYMENT", booking: { is: { cancelledAt: null } } },
      orderBy: [{ eventDate: "asc" }],
      select: {
        id: true,
        title: true,
        eventDate: true,
        customer: { select: { name: true } },
        booking: {
          select: {
            depositRequiredCents: true,
            createdAt: true,
            payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        status: { in: [...OPERATIONAL, "COMPLETED"] },
        closedAt: null,
        booking: { is: { cancelledAt: null, balanceDueAt: { lt: horizon } } },
      },
      orderBy: [{ eventDate: "asc" }],
      select: {
        id: true,
        title: true,
        eventDate: true,
        customer: { select: { name: true } },
        booking: {
          select: {
            totalCents: true,
            balanceDueAt: true,
            payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
          },
        },
      },
    }),
  ]);

  const deposits = depositEvents
    .map((e) => {
      const paid = e.booking ? netPaid(e.booking.payments) : 0;
      const pending = Math.max(0, (e.booking?.depositRequiredCents ?? 0) - paid);
      return {
        id: e.id,
        title: e.title,
        eventDate: e.eventDate,
        customerName: e.customer.name,
        pendingCents: pending,
      };
    })
    .filter((d) => d.pendingCents > 0);

  const balances = balanceEvents
    .map((e) => {
      const total = e.booking?.totalCents ?? 0;
      const balance = Math.max(0, total - (e.booking ? netPaid(e.booking.payments) : 0));
      const dueAt = e.booking?.balanceDueAt ?? null;
      return {
        id: e.id,
        title: e.title,
        eventDate: e.eventDate,
        customerName: e.customer.name,
        balanceCents: balance,
        dueAt,
        overdue: !!dueAt && dueAt < now,
      };
    })
    .filter((b) => b.balanceCents > 0);

  return { deposits, balances };
}

// ============================================================================
// RSVP incompleto (próximos 14 días, > 30 % pendientes)
// ============================================================================

export const RSVP_PENDING_THRESHOLD_BPS = 3000;

export async function getIncompleteRsvp(now: Date = new Date()) {
  const w = dateWindow(14, now);
  const events = await prisma.event.findMany({
    where: { eventDate: { gte: w.start, lt: w.end }, status: { in: LIVE } },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      guestCount: true,
      guests: { select: { rsvpStatus: true } },
    },
  });
  return events
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      invited: e.guests.length,
      pending: e.guests.filter((g) => g.rsvpStatus === "PENDING").length,
      pendingBps: rsvpPendingBps(e.guests),
    }))
    .filter((e) => e.pendingBps != null && e.pendingBps > RSVP_PENDING_THRESHOLD_BPS);
}
