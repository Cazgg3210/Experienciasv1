import "server-only";
import type { ChecklistArea, ChecklistItemStatus, ChecklistPhase, EventStatus, StaffFunction, StaffRateType } from "@prisma/client";
import { prisma } from "@/db";
import { addDaysUtc, dateOnly, formatDateTime, localDateKey, localTime, toDateKey } from "@/lib/dates";
import { mediaUrl } from "@/features/media/server/media-url";
import { computeProgress, isOverdue, OPEN_STATUSES, type Progress } from "../domain/checklist";
import { assignmentWarnings, toLocalInputValue, type AssignmentWarning, type OtherAssignment } from "../domain/assignment";
import {
  ACTIVE_RESERVATION_STATUSES,
  aggregateDietary,
  bufferPortions,
  computeHeadCount,
  computeShortagesByEvent,
  groupByCourse,
  isFloralAddOn,
  scaleFactor,
  TABLE_CATEGORIES,
} from "../domain/production";

// =============================================================================
// Vista serializable de ítems de checklist (para componentes cliente)
// =============================================================================

export type ChecklistItemView = {
  id: string;
  eventId: string;
  phase: ChecklistPhase;
  area: ChecklistArea;
  title: string;
  description: string | null;
  status: ChecklistItemStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAtLabel: string | null;
  dueAtInput: string;
  overdue: boolean;
  requiresEvidence: boolean;
  evidence: { id: string; url: string; alt: string | null } | null;
  notes: string | null;
  completedLabel: string | null;
  sortOrder: number;
  fromTemplate: boolean;
};

export const checklistItemInclude = {
  assignee: { select: { id: true, name: true } },
  completedBy: { select: { name: true } },
  evidenceMedia: { select: { id: true, driver: true, url: true, storageKey: true, visibility: true, alt: true } },
} as const;

type ChecklistRow = {
  id: string;
  eventId: string;
  phase: ChecklistPhase;
  area: ChecklistArea;
  title: string;
  description: string | null;
  status: ChecklistItemStatus;
  assigneeId: string | null;
  dueAt: Date | null;
  requiresEvidence: boolean;
  notes: string | null;
  completedAt: Date | null;
  sortOrder: number;
  templateItemId: string | null;
  assignee: { id: string; name: string } | null;
  completedBy: { name: string } | null;
  evidenceMedia: {
    id: string;
    driver: "S3" | "LOCAL" | "EXTERNAL";
    url: string | null;
    storageKey: string | null;
    visibility: "PUBLIC" | "PRIVATE";
    alt: string | null;
  } | null;
};

/** Debe llamarse sólo después de autorizar al visitante (genera URLs firmadas de evidencia). */
export function toChecklistItemView(row: ChecklistRow, now: Date = new Date()): ChecklistItemView {
  return {
    id: row.id,
    eventId: row.eventId,
    phase: row.phase,
    area: row.area,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    dueAtLabel: row.dueAt ? formatDateTime(row.dueAt) : null,
    dueAtInput: toLocalInputValue(row.dueAt),
    overdue: isOverdue(row, now),
    requiresEvidence: row.requiresEvidence,
    evidence: row.evidenceMedia
      ? { id: row.evidenceMedia.id, url: mediaUrl(row.evidenceMedia), alt: row.evidenceMedia.alt }
      : null,
    notes: row.notes,
    completedLabel:
      row.status === "DONE" && row.completedAt
        ? `${formatDateTime(row.completedAt)}${row.completedBy ? ` · ${row.completedBy.name}` : ""}`
        : null,
    sortOrder: row.sortOrder,
    fromTemplate: !!row.templateItemId,
  };
}

// =============================================================================
// Orden de producción
// =============================================================================

export type StaffOption = {
  id: string;
  name: string;
  primaryFunction: StaffFunction;
  rateType: StaffRateType;
  rateCents: number;
};

export type AssignmentView = {
  id: string;
  staffMemberId: string;
  staffName: string;
  staffPhone: string | null;
  staffEmail: string | null;
  function: StaffFunction;
  startsAtInput: string;
  endsAtInput: string;
  scheduleLabel: string;
  amountCents: number;
  confirmed: boolean;
  paid: boolean;
  notes: string | null;
  warnings: AssignmentWarning[];
};

export async function listStaffOptions(): Promise<StaffOption[]> {
  return prisma.staffMember.findMany({
    where: { active: true },
    select: { id: true, name: true, primaryFunction: true, rateType: true, rateCents: true },
    orderBy: { name: "asc" },
  });
}

export async function getProductionOrder(eventId: string, now: Date = new Date()) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      customer: { select: { name: true, phone: true, whatsapp: true, email: true } },
      experience: { select: { name: true, baseGuests: true, durationMinutes: true } },
      menu: {
        select: {
          name: true,
          description: true,
          dietaryTags: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
      style: { select: { name: true, palette: true } },
      serviceArea: { select: { name: true } },
      addOns: {
        include: { addOn: { select: { name: true, slug: true, category: true, description: true, pricingType: true } } },
        orderBy: { addOn: { sortOrder: "asc" } },
      },
      guests: {
        select: {
          name: true,
          rsvpStatus: true,
          plusOne: true,
          plusOneName: true,
          dietaryRestrictions: true,
          dietaryNotes: true,
        },
        orderBy: { name: "asc" },
      },
      inventoryReservations: {
        include: { inventoryItem: { select: { name: true, sku: true, category: true, unit: true } } },
      },
      staffAssignments: {
        include: { staffMember: { select: { id: true, name: true, phone: true, email: true } } },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      },
      checklistItems: { include: checklistItemInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!event) return null;

  const headCount = computeHeadCount(event.guestCount, event.guests);
  const dietary = aggregateDietary(event.guests);
  const courses = groupByCourse(event.menu?.items ?? []);

  const reservations = [...event.inventoryReservations].sort(
    (a, b) => a.inventoryItem.category.localeCompare(b.inventoryItem.category) || a.inventoryItem.name.localeCompare(b.inventoryItem.name),
  );
  const tableReservations = reservations.filter((r) => TABLE_CATEGORIES.includes(r.inventoryItem.category));
  const otherReservations = reservations.filter((r) => !TABLE_CATEGORIES.includes(r.inventoryItem.category));

  // Avisos (disponibilidad / traslapes) en lote: pocas consultas para todo el equipo del evento.
  const memberIds = [...new Set(event.staffAssignments.map((a) => a.staffMemberId))];
  const members = memberIds.length
    ? await prisma.staffMember.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, name: true, availableWeekdays: true, active: true, primaryFunction: true, rateType: true, rateCents: true },
      })
    : [];
  const others = await otherAssignmentsFor(memberIds, event.id, event.staffAssignments);
  const assignments: AssignmentView[] = event.staffAssignments.map((a) => {
    const member = members.find((m) => m.id === a.staffMemberId);
    return {
      id: a.id,
      staffMemberId: a.staffMemberId,
      staffName: a.staffMember.name,
      staffPhone: a.staffMember.phone,
      staffEmail: a.staffMember.email,
      function: a.function,
      startsAtInput: toLocalInputValue(a.startsAt),
      endsAtInput: toLocalInputValue(a.endsAt),
      scheduleLabel: `${localTime(a.startsAt)}–${localTime(a.endsAt)}`,
      amountCents: a.amountCents,
      confirmed: a.confirmed,
      paid: a.paid,
      notes: a.notes,
      warnings: member
        ? assignmentWarnings({
            member,
            eventId: event.id,
            startsAt: a.startsAt,
            endsAt: a.endsAt,
            others: others.filter((o) => o.staffMemberId === a.staffMemberId),
          })
        : [],
    };
  });

  const checklist = event.checklistItems.map((row) => toChecklistItemView(row, now));
  const staffOptions = await listStaffOptions();
  // Incluir integrantes inactivos que ya estén asignados (para que el select muestre su nombre)
  for (const m of members) {
    if (!staffOptions.some((s) => s.id === m.id)) {
      staffOptions.push({ id: m.id, name: m.name, primaryFunction: m.primaryFunction, rateType: m.rateType, rateCents: m.rateCents });
    }
  }

  return {
    event: {
      id: event.id,
      code: event.code,
      title: event.title,
      status: event.status,
      occasion: event.occasion,
      honoreeName: event.honoreeName,
      eventDate: event.eventDate,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      departureAt: event.departureAt,
      setupStartsAt: event.setupStartsAt,
      teardownAt: event.teardownAt,
      guestCount: event.guestCount,
      addressLine: event.addressLine,
      addressNotes: event.addressNotes,
      neighborhood: event.neighborhood,
      city: event.city,
      postalCode: event.postalCode,
      mapsUrl: event.mapsUrl,
      colors: event.colors,
      inspiration: event.inspiration,
      dressCode: event.dressCode,
      customerNotes: event.customerNotes,
      internalNotes: event.internalNotes,
    },
    customer: event.customer,
    experience: event.experience,
    menu: event.menu ? { name: event.menu.name, description: event.menu.description, dietaryTags: event.menu.dietaryTags } : null,
    style: event.style,
    serviceArea: event.serviceArea,
    headCount,
    portions: {
      total: headCount.portions,
      buffer: bufferPortions(headCount.portions),
      factor: scaleFactor(headCount.portions, event.experience?.baseGuests ?? 0),
      baseGuests: event.experience?.baseGuests ?? null,
    },
    courses,
    dietary,
    addOns: event.addOns.map((a) => ({
      id: a.id,
      name: a.addOn.name,
      slug: a.addOn.slug,
      category: a.addOn.category,
      description: a.addOn.description,
      quantity: a.quantity,
      notes: a.notes,
      floral: isFloralAddOn(a.addOn),
    })),
    tableReservations,
    otherReservations,
    assignments,
    checklist,
    progress: computeProgress(event.checklistItems),
    staffOptions,
  };
}

export type ProductionOrder = NonNullable<Awaited<ReturnType<typeof getProductionOrder>>>;

/** Asignaciones de esas personas en OTROS eventos no cancelados que podrían empalmarse con este. */
async function otherAssignmentsFor(
  memberIds: string[],
  eventId: string,
  windows: Array<{ startsAt: Date; endsAt: Date }>,
): Promise<Array<OtherAssignment & { staffMemberId: string }>> {
  if (!memberIds.length || !windows.length) return [];
  const minStart = new Date(Math.min(...windows.map((w) => w.startsAt.getTime())));
  const maxEnd = new Date(Math.max(...windows.map((w) => w.endsAt.getTime())));
  const rows = await prisma.staffAssignment.findMany({
    where: {
      staffMemberId: { in: memberIds },
      eventId: { not: eventId },
      startsAt: { lt: maxEnd },
      endsAt: { gt: minStart },
      event: { status: { not: "CANCELLED" } },
    },
    select: { id: true, eventId: true, staffMemberId: true, startsAt: true, endsAt: true, event: { select: { title: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    staffMemberId: r.staffMemberId,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    eventTitle: r.event.title,
  }));
}

// =============================================================================
// Tablero de operaciones (próximos 14 días)
// =============================================================================

const BOARD_STATUSES: EventStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PLANNING", "READY", "IN_PROGRESS"];

export type OverviewEvent = {
  id: string;
  code: string;
  title: string;
  status: EventStatus;
  eventDate: Date;
  startsAt: Date;
  endsAt: Date;
  guestCount: number;
  neighborhood: string | null;
  customerName: string;
  experienceName: string | null;
  progress: Progress;
  overdueCount: number;
  staffCount: number;
  hasCoordinator: boolean;
  shortages: Array<{ name: string; sku: string; reserved: number; available: number }>;
};

export async function getOperationsOverview(now: Date = new Date()) {
  const todayKey = localDateKey(now);
  const from = dateOnly(todayKey);
  const to = addDaysUtc(from, 14);

  const events = await prisma.event.findMany({
    where: { eventDate: { gte: from, lte: to }, status: { in: BOARD_STATUSES } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      eventDate: true,
      startsAt: true,
      endsAt: true,
      guestCount: true,
      neighborhood: true,
      customer: { select: { name: true } },
      experience: { select: { name: true } },
      checklistItems: { select: { status: true, dueAt: true } },
      staffAssignments: { select: { function: true, staffMemberId: true } },
    },
  });

  // Faltantes: reservas activas de todos los eventos (no cancelados) en las mismas fechas
  const dates = [...new Set(events.map((e) => toDateKey(e.eventDate)))].map(dateOnly);
  const reservations = dates.length
    ? await prisma.inventoryReservation.findMany({
        where: {
          status: { in: ACTIVE_RESERVATION_STATUSES },
          event: { eventDate: { in: dates }, status: { not: "CANCELLED" } },
        },
        select: {
          eventId: true,
          inventoryItemId: true,
          quantity: true,
          status: true,
          event: { select: { eventDate: true } },
        },
      })
    : [];
  const itemIds = [...new Set(reservations.map((r) => r.inventoryItemId))];
  const stock = itemIds.length
    ? await prisma.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, sku: true, totalQuantity: true, maintenanceQuantity: true },
      })
    : [];
  const shortageMap = computeShortagesByEvent(
    reservations.map((r) => ({ ...r, dateKey: toDateKey(r.event.eventDate) })),
    stock,
  );
  const stockById = new Map(stock.map((s) => [s.id, s]));

  const board: OverviewEvent[] = events.map((e) => ({
    id: e.id,
    code: e.code,
    title: e.title,
    status: e.status,
    eventDate: e.eventDate,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    guestCount: e.guestCount,
    neighborhood: e.neighborhood,
    customerName: e.customer.name,
    experienceName: e.experience?.name ?? null,
    progress: computeProgress(e.checklistItems),
    overdueCount: e.checklistItems.filter((i) => isOverdue(i, now)).length,
    staffCount: new Set(e.staffAssignments.map((a) => a.staffMemberId)).size,
    hasCoordinator: e.staffAssignments.some((a) => a.function === "COORDINATOR"),
    shortages: (shortageMap.get(e.id) ?? []).map((s) => {
      const item = stockById.get(s.inventoryItemId);
      return { name: item?.name ?? "Artículo", sku: item?.sku ?? "", reserved: s.reserved, available: s.available };
    }),
  }));

  const overdueWhere = {
    status: { in: OPEN_STATUSES },
    dueAt: { lt: now },
    event: { status: { notIn: ["CANCELLED", "INQUIRY"] as EventStatus[] } },
  };
  const [overdueItems, overdueTotal] = await Promise.all([
    prisma.eventChecklistItem.findMany({
      where: overdueWhere,
      orderBy: { dueAt: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        phase: true,
        area: true,
        status: true,
        dueAt: true,
        requiresEvidence: true,
        assignee: { select: { name: true } },
        event: { select: { id: true, title: true, code: true, status: true } },
      },
    }),
    prisma.eventChecklistItem.count({ where: overdueWhere }),
  ]);

  return {
    board,
    overdueItems,
    overdueTotal,
    totals: {
      events: board.length,
      overdue: overdueTotal,
      withoutCoordinator: board.filter((e) => !e.hasCoordinator).length,
      withShortages: board.filter((e) => e.shortages.length > 0).length,
    },
  };
}

// =============================================================================
// Plantillas
// =============================================================================

export async function listTemplates() {
  return prisma.checklistTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      experience: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getTemplate(id: string) {
  return prisma.checklistTemplate.findUnique({
    where: { id },
    include: {
      experience: { select: { id: true, name: true } },
      items: { orderBy: [{ sortOrder: "asc" }, { offsetMinutes: "asc" }] },
    },
  });
}

export async function listExperienceOptions() {
  return prisma.experience.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
