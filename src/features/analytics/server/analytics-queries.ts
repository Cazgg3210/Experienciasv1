import "server-only";
import type { EventStatus, LeadSource, LeadStatus, Occasion } from "@prisma/client";
import { prisma } from "@/db";
import {
  buildFunnel,
  changeBps,
  FUNNEL_STEPS,
  rateBps,
  rollingWindow,
  uniqueFunnelCounts,
  type RangeDays,
} from "../domain/metrics";

/** Eventos con add-ons que cuentan como ingreso (activos o completados). */
const ADDON_REVENUE_STATUSES: EventStatus[] = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"];

async function countByType(from: Date, to: Date) {
  const rows = await prisma.analyticsEvent.groupBy({
    by: ["type"],
    where: { createdAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const out: Partial<Record<string, number>> = {};
  for (const r of rows) out[r.type] = r._count._all;
  return out;
}

/** Embudo con recorridos únicos (sesión / lead / cotización) en lugar de eventos crudos. */
async function uniqueFunnel(from: Date, to: Date) {
  const rows = await prisma.analyticsEvent.groupBy({
    by: ["type", "sessionId", "leadId", "quoteId", "eventId"],
    where: { createdAt: { gte: from, lt: to }, type: { in: [...FUNNEL_STEPS] } },
    _count: { _all: true },
  });
  return uniqueFunnelCounts(
    rows.map((r) => ({
      type: r.type,
      sessionId: r.sessionId,
      leadId: r.leadId,
      quoteId: r.quoteId,
      eventId: r.eventId,
      count: r._count._all,
    })),
  );
}

export async function getAnalyticsOverview(range: RangeDays, now: Date = new Date()) {
  const w = rollingWindow(range, now);
  const leadWhere = { createdAt: { gte: w.from, lt: w.to } };

  const [current, previous, funnelCounts, bySource, byStatus, byOccasion, leadsPrev] = await Promise.all([
    countByType(w.from, w.to),
    countByType(w.prevFrom, w.prevTo),
    uniqueFunnel(w.from, w.to),
    prisma.lead.groupBy({ by: ["source"], where: leadWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["status"], where: leadWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["occasion"], where: leadWhere, _count: { _all: true } }),
    prisma.lead.count({ where: { createdAt: { gte: w.prevFrom, lt: w.prevTo } } }),
  ]);

  const leadsTotal = bySource.reduce((s, r) => s + r._count._all, 0);
  const sources: Partial<Record<LeadSource, number>> = {};
  for (const r of bySource) sources[r.source] = r._count._all;
  const statuses: Partial<Record<LeadStatus, number>> = {};
  for (const r of byStatus) statuses[r.status] = r._count._all;
  const occasions: Partial<Record<Occasion, number>> = {};
  for (const r of byOccasion) occasions[r.occasion] = r._count._all;

  const funnel = buildFunnel(funnelCounts);
  const first = funnel[0]!.count;
  const last = funnel[funnel.length - 1]!.count;

  return {
    range,
    from: w.from,
    to: w.to,
    funnel,
    funnelOverallBps: rateBps(last, first),
    counters: {
      rsvp: {
        current: current.RSVP_SUBMIT ?? 0,
        changeBps: changeBps(current.RSVP_SUBMIT ?? 0, previous.RSVP_SUBMIT ?? 0),
      },
      aiDesigns: {
        current: current.AI_DESIGN_GENERATED ?? 0,
        changeBps: changeBps(current.AI_DESIGN_GENERATED ?? 0, previous.AI_DESIGN_GENERATED ?? 0),
      },
      leads: { current: leadsTotal, changeBps: changeBps(leadsTotal, leadsPrev) },
      payments: {
        current: current.PAYMENT_SUCCESS ?? 0,
        changeBps: changeBps(current.PAYMENT_SUCCESS ?? 0, previous.PAYMENT_SUCCESS ?? 0),
      },
    },
    leads: { total: leadsTotal, sources, statuses, occasions },
  };
}

export type AnalyticsOverview = Awaited<ReturnType<typeof getAnalyticsOverview>>;

/** Experiencias populares: vistas, leads y reservas en el rango. */
export async function getPopularExperiences(range: RangeDays, now: Date = new Date()) {
  const w = rollingWindow(range, now);
  const [experiences, views, leads, bookings] = await Promise.all([
    prisma.experience.findMany({
      select: { id: true, name: true, slug: true, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["experienceId"],
      where: { type: "VIEW_EXPERIENCE", createdAt: { gte: w.from, lt: w.to }, experienceId: { not: null } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["experienceId"],
      where: { createdAt: { gte: w.from, lt: w.to }, experienceId: { not: null } },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: w.from, lt: w.to }, cancelledAt: null },
      select: { totalCents: true, event: { select: { experienceId: true } } },
    }),
  ]);
  const rows = experiences.map((e) => {
    const b = bookings.filter((x) => x.event.experienceId === e.id);
    const v = views.find((x) => x.experienceId === e.id)?._count._all ?? 0;
    const l = leads.find((x) => x.experienceId === e.id)?._count._all ?? 0;
    return {
      id: e.id,
      name: e.name,
      active: e.active,
      views: v,
      leads: l,
      bookings: b.length,
      bookedCents: b.reduce((s, x) => s + x.totalCents, 0),
      leadRateBps: rateBps(l, v),
    };
  });
  return rows.sort((a, b) => b.bookings - a.bookings || b.leads - a.leads || b.views - a.views);
}

/** Ingreso por add-ons (precio × cantidad) de eventos activos y completados. */
export async function getAddOnRevenue() {
  const rows = await prisma.eventAddOn.findMany({
    where: { event: { status: { in: ADDON_REVENUE_STATUSES } } },
    select: {
      addOnId: true,
      eventId: true,
      quantity: true,
      priceCents: true,
      costCents: true,
      addOn: { select: { name: true, category: true } },
    },
  });
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      units: number;
      events: Set<string>;
      revenueCents: number;
      costCents: number;
    }
  >();
  for (const r of rows) {
    let g = map.get(r.addOnId);
    if (!g) {
      g = {
        id: r.addOnId,
        name: r.addOn.name,
        category: r.addOn.category,
        units: 0,
        events: new Set(),
        revenueCents: 0,
        costCents: 0,
      };
      map.set(r.addOnId, g);
    }
    g.units += r.quantity;
    g.events.add(r.eventId);
    g.revenueCents += r.priceCents * r.quantity;
    g.costCents += r.costCents * r.quantity;
  }
  const list = [...map.values()]
    .map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      units: g.units,
      events: g.events.size,
      revenueCents: g.revenueCents,
      costCents: g.costCents,
      marginCents: g.revenueCents - g.costCents,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
  return {
    items: list,
    totalRevenueCents: list.reduce((s, x) => s + x.revenueCents, 0),
    totalMarginCents: list.reduce((s, x) => s + x.marginCents, 0),
  };
}
