import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { dateOnly, localDateKey, toDateKey } from "@/lib/dates";
import { phoneSearchDigits } from "@/lib/phone";
import { balanceDueCents, netPaidCents } from "@/features/payments/domain/payment-status";
import { effectiveDateRange, sortDirection, type EventFilters } from "../domain/event-filters";

const DAY_MS = 86_400_000;

export const EVENTS_PAGE_SIZE = 20;

function buildWhere(filters: EventFilters): Prisma.EventWhereInput {
  const today = localDateKey();
  const yesterday = toDateKey(new Date(dateOnly(today).getTime() - DAY_MS));
  const range = effectiveDateRange(filters, today, yesterday);
  const where: Prisma.EventWhereInput = {};
  if (filters.statuses.length) where.status = { in: filters.statuses };
  if (range.gte || range.lte) {
    where.eventDate = {
      ...(range.gte ? { gte: dateOnly(range.gte) } : {}),
      ...(range.lte ? { lte: dateOnly(range.lte) } : {}),
    };
  }
  if (filters.experienceId) where.experienceId = filters.experienceId;
  if (filters.serviceAreaId) where.serviceAreaId = filters.serviceAreaId;
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    where.OR = [
      { code: contains },
      { title: contains },
      { honoreeName: contains },
      { customer: { name: contains } },
      { customer: { email: contains } },
      { customer: { phone: { contains: filters.q } } },
    ];
  }
  return where;
}

export type EventListRow = Awaited<ReturnType<typeof listEvents>>["rows"][number];

/** Listado paginado de eventos con invitadas confirmadas y saldo pendiente. */
export async function listEvents(filters: EventFilters, page: number, pageSize = EVENTS_PAGE_SIZE) {
  const where = buildWhere(filters);
  const dir = sortDirection(filters.period);
  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: [{ startsAt: dir }, { code: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        eventDate: true,
        startsAt: true,
        endsAt: true,
        guestCount: true,
        customer: { select: { id: true, name: true } },
        experience: { select: { name: true } },
        serviceArea: { select: { name: true } },
        booking: {
          select: {
            totalCents: true,
            cancelledAt: true,
            payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
          },
        },
      },
    }),
  ]);

  const ids = events.map((e) => e.id);
  const attending = ids.length
    ? await prisma.eventGuest.groupBy({
        by: ["eventId", "plusOne"],
        where: { eventId: { in: ids }, rsvpStatus: "ATTENDING" },
        _count: { _all: true },
      })
    : [];
  const confirmed = new Map<string, number>();
  for (const row of attending) {
    const add = row._count._all * (row.plusOne ? 2 : 1);
    confirmed.set(row.eventId, (confirmed.get(row.eventId) ?? 0) + add);
  }

  const rows = events.map((e) => {
    const paid = e.booking ? netPaidCents(e.booking.payments) : 0;
    return {
      id: e.id,
      code: e.code,
      title: e.title,
      status: e.status,
      eventDate: e.eventDate,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      guestCount: e.guestCount,
      confirmedGuests: confirmed.get(e.id) ?? 0,
      customerName: e.customer.name,
      customerId: e.customer.id,
      experienceName: e.experience?.name ?? null,
      zoneName: e.serviceArea?.name ?? null,
      totalCents: e.booking?.totalCents ?? null,
      paidCents: paid,
      /** Reserva comercial cancelada (o evento cancelado): ya no hay saldo por cobrar. */
      bookingCancelled: !!e.booking && (!!e.booking.cancelledAt || e.status === "CANCELLED"),
      balanceDueCents: e.booking ? balanceDueCents(e.booking.totalCents, e.booking.payments) : null,
    };
  });
  return { rows, total };
}

/** Opciones de filtros y formularios: experiencias, menús, estilos y zonas. */
export async function getEventFormOptions() {
  const [experiences, menus, styles, serviceAreas] = await Promise.all([
    prisma.experience.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        durationMinutes: true,
        minGuests: true,
        maxGuests: true,
        baseGuests: true,
      },
    }),
    prisma.menu.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true, experiences: { select: { id: true } } },
    }),
    prisma.style.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.serviceArea.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);
  return {
    experiences,
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      active: m.active,
      experienceIds: m.experiences.map((x) => x.id),
    })),
    styles,
    serviceAreas,
  };
}
export type EventFormOptions = Awaited<ReturnType<typeof getEventFormOptions>>;

/** Encabezado del evento (layout). Cacheado por request para reutilizarse en las páginas hijas. */
export const getEventHeader = cache(async (id: string) => {
  if (!/^[a-z0-9_-]{8,40}$/i.test(id)) return null;
  return prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      eventDate: true,
      startsAt: true,
      endsAt: true,
      guestCount: true,
      micrositeSlug: true,
      micrositeEnabled: true,
      portalToken: true,
      inviteToken: true,
      honoreeName: true,
      customer: { select: { id: true, name: true, phone: true, whatsapp: true, email: true } },
      serviceArea: { select: { name: true } },
      experience: { select: { name: true } },
    },
  });
});
export type EventHeaderData = NonNullable<Awaited<ReturnType<typeof getEventHeader>>>;

/** Datos completos para la pestaña Resumen. */
export async function getEventDetail(id: string) {
  if (!/^[a-z0-9_-]{8,40}$/i.test(id)) return null;
  return prisma.event.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } },
      experience: { select: { id: true, name: true, durationMinutes: true } },
      menu: { select: { id: true, name: true } },
      style: { select: { id: true, name: true } },
      serviceArea: { select: { id: true, name: true } },
      quote: {
        select: { id: true, code: true, status: true, totalCents: true, version: true, acceptedAt: true },
      },
      booking: {
        select: {
          id: true,
          code: true,
          totalCents: true,
          depositRequiredCents: true,
          termsVersion: true,
          termsAcceptedAt: true,
          acceptedByName: true,
          balanceDueAt: true,
          cancelledAt: true,
          cancellationReason: true,
          payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
        },
      },
      timeline: { orderBy: [{ sortOrder: "asc" }, { time: "asc" }] },
      messages: {
        where: { kind: "HOST_THREAD" },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, authorType: true, authorName: true, body: true, createdAt: true, hidden: true },
      },
      _count: { select: { guests: true } },
    },
  });
}
export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

/** Búsqueda de clientas para el alta manual (nombre, email o teléfono). */
export async function searchCustomers(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = phoneSearchDigits(term);
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, name: true, email: true, phone: true, whatsapp: true },
  });
}
export type CustomerSearchResult = Awaited<ReturnType<typeof searchCustomers>>[number];
