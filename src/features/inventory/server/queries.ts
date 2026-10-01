import "server-only";
import type { EventStatus, InventoryCategory, InventoryReservationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { addDaysUtc, dateOnly, localDateKey, toDateKey } from "@/lib/dates";
import {
  ACTIVE_RESERVATION_STATUSES,
  availableToday,
  detectConflicts,
  isLowStock,
  maxReservedByDate,
  usableQuantity,
} from "../domain/availability";
import type { InventoryFilters } from "../schemas";
import { computeEventShortages, loadEventRequirements, type InventoryShortage } from "./reservation-service";

const ACTIVE = [...ACTIVE_RESERVATION_STATUSES] as InventoryReservationStatus[];

function todayDate(): { key: string; date: Date } {
  const key = localDateKey();
  return { key, date: dateOnly(key) };
}

// -----------------------------------------------------------------------------
// Conflictos (para la página de conflictos y dashboards)
// -----------------------------------------------------------------------------

export type InventoryConflict = {
  /** YYYY-MM-DD */
  date: string;
  item: { id: string; sku: string; name: string; unit: string; category: InventoryCategory };
  required: number;
  available: number;
  shortBy: number;
  events: Array<{ id: string; code: string; title: string; status: EventStatus; quantity: number }>;
};

/**
 * Fechas de los próximos `days` días donde la suma de reservas activas (RESERVED/CHECKED_OUT)
 * de eventos no cancelados supera el stock utilizable (total − mantenimiento) de un artículo.
 */
export async function getInventoryConflicts({ days = 60 }: { days?: number } = {}): Promise<InventoryConflict[]> {
  const today = todayDate();
  const until = addDaysUtc(today.date, Math.max(1, Math.min(days, 366)));
  const rows = await prisma.inventoryReservation.findMany({
    where: {
      status: { in: ACTIVE },
      quantity: { gt: 0 },
      event: { status: { not: "CANCELLED" }, eventDate: { gte: today.date, lte: until } },
    },
    select: {
      inventoryItemId: true,
      eventId: true,
      quantity: true,
      status: true,
      event: { select: { id: true, code: true, title: true, status: true, eventDate: true } },
      inventoryItem: {
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          category: true,
          totalQuantity: true,
          maintenanceQuantity: true,
        },
      },
    },
  });
  const stock = new Map(rows.map((r) => [r.inventoryItemId, r.inventoryItem]));
  const events = new Map(rows.map((r) => [r.eventId, r.event]));
  const conflicts = detectConflicts(
    rows.map((r) => ({
      dateKey: toDateKey(r.event.eventDate),
      inventoryItemId: r.inventoryItemId,
      eventId: r.eventId,
      quantity: r.quantity,
      status: r.status,
      eventStatus: r.event.status,
    })),
    stock,
  );
  return conflicts.map((c) => {
    const item = stock.get(c.inventoryItemId)!;
    return {
      date: c.dateKey,
      item: { id: item.id, sku: item.sku, name: item.name, unit: item.unit, category: item.category },
      required: c.required,
      available: c.available,
      shortBy: c.shortBy,
      events: c.events.map((e) => {
        const ev = events.get(e.eventId)!;
        return { id: ev.id, code: ev.code, title: ev.title, status: ev.status, quantity: e.quantity };
      }),
    };
  });
}

// -----------------------------------------------------------------------------
// Tabla de inventario
// -----------------------------------------------------------------------------

export type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  totalQuantity: number;
  maintenanceQuantity: number;
  usable: number;
  reservedPeak: number;
  reservedPeakDate: string | null;
  availableToday: number;
  lowStockThreshold: number;
  replacementCostCents: number;
  location: string | null;
  notes: string | null;
  active: boolean;
  lowStock: boolean;
  conflictDates: string[];
};

export async function listInventory(filters: InventoryFilters) {
  const today = todayDate();
  const in30 = addDaysUtc(today.date, 30);
  const where: Prisma.InventoryItemWhereInput = {
    ...(filters.inactive ? {} : { active: true }),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { sku: { contains: filters.q, mode: "insensitive" } },
            { location: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, conflicts] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        reservations: {
          where: {
            status: { in: ACTIVE },
            event: { status: { not: "CANCELLED" } },
            OR: [{ event: { eventDate: { gte: today.date, lte: in30 } } }, { status: "CHECKED_OUT" }],
          },
          select: { quantity: true, status: true, event: { select: { eventDate: true, status: true } } },
        },
      },
    }),
    getInventoryConflicts({ days: 60 }),
  ]);
  const conflictDates = new Map<string, string[]>();
  for (const c of conflicts) {
    const list = conflictDates.get(c.item.id) ?? [];
    if (!list.includes(c.date)) list.push(c.date);
    conflictDates.set(c.item.id, list);
  }

  const rows: InventoryRow[] = items.map((item) => {
    const resRows = item.reservations.map((r) => ({
      dateKey: toDateKey(r.event.eventDate),
      quantity: r.quantity,
      status: r.status,
      eventStatus: r.event.status,
    }));
    const upcoming = resRows.filter((r) => r.dateKey >= today.key);
    const peak = maxReservedByDate(upcoming);
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      totalQuantity: item.totalQuantity,
      maintenanceQuantity: item.maintenanceQuantity,
      usable: usableQuantity(item),
      reservedPeak: peak.max,
      reservedPeakDate: peak.dateKey,
      availableToday: availableToday(item, resRows, today.key),
      lowStockThreshold: item.lowStockThreshold,
      replacementCostCents: item.replacementCostCents,
      location: item.location,
      notes: item.notes,
      active: item.active,
      lowStock: isLowStock(item),
      conflictDates: conflictDates.get(item.id) ?? [],
    };
  });

  const filtered = filters.conflict ? rows.filter((r) => r.conflictDates.length > 0) : rows;
  const stats = {
    items: rows.length,
    lowStock: rows.filter((r) => r.active && r.lowStock).length,
    inConflict: rows.filter((r) => r.conflictDates.length > 0).length,
    conflictDates: new Set(conflicts.map((c) => c.date)).size,
    inMaintenance: rows.reduce((s, r) => s + r.maintenanceQuantity, 0),
    replacementValueCents: rows.reduce((s, r) => s + r.totalQuantity * r.replacementCostCents, 0),
  };
  return { rows: filtered, stats, todayKey: today.key };
}

// -----------------------------------------------------------------------------
// Detalle de artículo
// -----------------------------------------------------------------------------

export async function getInventoryItemDetail(id: string, { movementsLimit = 100 }: { movementsLimit?: number } = {}) {
  const today = todayDate();
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return null;
  const [movements, movementCount, upcoming, conflicts, requirementUse] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { inventoryItemId: id },
      orderBy: { createdAt: "desc" },
      take: movementsLimit,
      include: {
        actor: { select: { name: true } },
        event: { select: { id: true, code: true, title: true } },
      },
    }),
    prisma.inventoryMovement.count({ where: { inventoryItemId: id } }),
    prisma.inventoryReservation.findMany({
      where: {
        inventoryItemId: id,
        OR: [
          { status: { in: ACTIVE }, event: { eventDate: { gte: today.date } } },
          { status: "CHECKED_OUT" },
        ],
      },
      orderBy: { event: { eventDate: "asc" } },
      include: {
        event: { select: { id: true, code: true, title: true, status: true, eventDate: true, guestCount: true } },
      },
    }),
    getInventoryConflicts({ days: 60 }),
    Promise.all([
      prisma.experienceInventoryRequirement.findMany({
        where: { inventoryItemId: id },
        select: { quantity: true, perGuest: true, experience: { select: { id: true, name: true } } },
      }),
      prisma.addOnInventoryRequirement.findMany({
        where: { inventoryItemId: id },
        select: { quantity: true, perGuest: true, addOn: { select: { id: true, name: true } } },
      }),
    ]),
  ]);
  const itemConflicts = conflicts.filter((c) => c.item.id === id);
  const resRows = upcoming.map((r) => ({
    dateKey: toDateKey(r.event.eventDate),
    quantity: r.quantity,
    status: r.status,
    eventStatus: r.event.status,
  }));
  return {
    item,
    usable: usableQuantity(item),
    availableToday: availableToday(item, resRows, today.key),
    lowStock: isLowStock(item),
    movements,
    movementCount,
    upcoming,
    conflicts: itemConflicts,
    usedBy: { experiences: requirementUse[0], addOns: requirementUse[1] },
    todayKey: today.key,
  };
}

// -----------------------------------------------------------------------------
// Reservas por evento
// -----------------------------------------------------------------------------

export async function getEventReservations(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      eventDate: true,
      startsAt: true,
      guestCount: true,
      experience: { select: { name: true } },
      customer: { select: { name: true } },
    },
  });
  if (!event) return null;
  const [reservations, shortages, requirements, purchases] = await Promise.all([
    prisma.inventoryReservation.findMany({
      where: { eventId },
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            category: true,
            totalQuantity: true,
            maintenanceQuantity: true,
          },
        },
      },
      orderBy: [{ inventoryItem: { category: "asc" } }, { inventoryItem: { name: "asc" } }],
    }),
    computeEventShortages(prisma, eventId),
    loadEventRequirements(prisma, eventId),
    prisma.purchase.aggregate({
      where: { eventId, status: { not: "CANCELLED" } },
      _count: { _all: true },
    }),
  ]);
  const required = requirements ?? new Map<string, number>();
  const reservedIds = new Set(reservations.filter((r) => r.status !== "CANCELLED").map((r) => r.inventoryItemId));
  const missingIds = [...required.keys()].filter((id) => !reservedIds.has(id));
  const missingItems = missingIds.length
    ? await prisma.inventoryItem.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, sku: true, name: true, unit: true },
      })
    : [];
  const shortageByItem = new Map<string, InventoryShortage>(shortages.map((s) => [s.inventoryItemId, s]));
  const counts = { RESERVED: 0, CHECKED_OUT: 0, RETURNED: 0, CANCELLED: 0 } as Record<InventoryReservationStatus, number>;
  for (const r of reservations) counts[r.status] += 1;
  return {
    event,
    reservations: reservations.map((r) => ({
      ...r,
      requiredByRules: required.get(r.inventoryItemId) ?? 0,
      shortage: shortageByItem.get(r.inventoryItemId) ?? null,
    })),
    missingFromRules: missingItems.map((i) => ({ ...i, required: required.get(i.id) ?? 0 })),
    shortages,
    counts,
    purchasesCount: purchases._count._all,
  };
}

/** Eventos próximos (y recientes con piezas fuera) para el índice de reservas por evento. */
export async function listInventoryEvents({ days = 60 }: { days?: number } = {}) {
  const today = todayDate();
  const from = addDaysUtc(today.date, -14);
  const until = addDaysUtc(today.date, days);
  const [events, conflicts] = await Promise.all([
    prisma.event.findMany({
      where: {
        OR: [
          { eventDate: { gte: today.date, lte: until }, status: { not: "CANCELLED" } },
          { eventDate: { gte: from, lt: today.date }, inventoryReservations: { some: { status: "CHECKED_OUT" } } },
        ],
      },
      orderBy: [{ eventDate: "asc" }, { startsAt: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        eventDate: true,
        guestCount: true,
        experience: { select: { name: true } },
        inventoryReservations: { select: { status: true, quantity: true } },
      },
    }),
    getInventoryConflicts({ days }),
  ]);
  const conflictEvents = new Map<string, number>();
  for (const c of conflicts) for (const e of c.events) conflictEvents.set(e.id, (conflictEvents.get(e.id) ?? 0) + 1);
  return events.map((e) => {
    const counts = { RESERVED: 0, CHECKED_OUT: 0, RETURNED: 0, CANCELLED: 0 } as Record<InventoryReservationStatus, number>;
    for (const r of e.inventoryReservations) counts[r.status] += 1;
    return {
      id: e.id,
      code: e.code,
      title: e.title,
      status: e.status,
      eventDate: e.eventDate,
      guestCount: e.guestCount,
      experienceName: e.experience?.name ?? null,
      counts,
      conflictItems: conflictEvents.get(e.id) ?? 0,
    };
  });
}

/** Opciones de artículos activos para selects. */
export async function listInventoryItemOptions() {
  return prisma.inventoryItem.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, sku: true, name: true, unit: true, totalQuantity: true, maintenanceQuantity: true },
  });
}
