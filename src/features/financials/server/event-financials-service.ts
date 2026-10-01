import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { isEnabled } from "@/lib/flags";
import { formatLongDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { canCloseEvent } from "@/features/events/domain/event-status";
import { getSettings } from "@/features/settings/server/settings-service";
import { notifyCustomer } from "@/features/notifications/server/notification-service";
import { dedupeKeys } from "@/features/notifications/domain/schedule-rules";
import type { PricingSettings } from "@/features/settings/domain/settings-schema";
import {
  buildClosingSnapshot,
  computeCollection,
  computeEventFinancials,
  estimatedBreakdownFromQuote,
  readClosingSnapshot,
  taxIncludedIn,
  type EventFinancials,
  type FinPayment,
} from "../domain/event-financials";
import type { CreateEventCostInput, DeleteEventCostInput, UpdateEventCostInput } from "../schemas";

// ============================================================================
// Carga y cálculo
// ============================================================================

/** Selección mínima para calcular la rentabilidad de un evento (reutilizada por finanzas). */
export const financialsSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  eventDate: true,
  startsAt: true,
  guestCount: true,
  closedAt: true,
  closingSnapshot: true,
  quote: {
    select: {
      id: true,
      totalCents: true,
      taxCents: true,
      estimatedCostCents: true,
      pricingSnapshot: true,
      items: { select: { costCategory: true, totalCostCents: true } },
    },
  },
  booking: {
    select: {
      id: true,
      totalCents: true,
      depositRequiredCents: true,
      balanceDueAt: true,
      cancelledAt: true,
      payments: {
        select: { kind: true, status: true, amountCents: true, feeCents: true, refundedCents: true },
      },
    },
  },
  purchases: { select: { category: true, status: true, expectedAmountCents: true, actualAmountCents: true } },
  staffAssignments: { select: { amountCents: true } },
  costs: { select: { category: true, amountCents: true } },
} satisfies Prisma.EventSelect;

export type FinancialsRecord = Prisma.EventGetPayload<{ select: typeof financialsSelect }>;

const CHARGED = new Set(["PAID", "PARTIAL_REFUND", "REFUNDED"]);

/** Venta del evento: total de la reserva (o cotización). En cancelados, sólo lo efectivamente cobrado. */
export function saleForEvent(record: Pick<FinancialsRecord, "status" | "quote" | "booking">): {
  saleCents: number;
  taxCents: number | null;
} {
  const payments = record.booking?.payments ?? [];
  let sale = record.booking?.totalCents ?? record.quote?.totalCents ?? 0;
  if (record.status === "CANCELLED") {
    sale = payments
      .filter((p) => p.kind !== "REFUND" && CHARGED.has(p.status))
      .reduce((s, p) => s + p.amountCents, 0);
  }
  const q = record.quote;
  const tax = q && q.totalCents > 0 ? Math.round((q.taxCents * sale) / q.totalCents) : null;
  return { saleCents: sale, taxCents: tax };
}

/** Calcula la rentabilidad a partir de un registro cargado (sin I/O adicional). */
export function financialsFromRecord(record: FinancialsRecord, pricing: PricingSettings): EventFinancials {
  const { saleCents, taxCents } = saleForEvent(record);
  const payments = (record.booking?.payments ?? []) as FinPayment[];
  const breakdown = record.quote
    ? estimatedBreakdownFromQuote(
        {
          pricingSnapshot: record.quote.pricingSnapshot,
          items: record.quote.items,
          estimatedCostCents: record.quote.estimatedCostCents,
          totalCents: record.quote.totalCents,
        },
        pricing,
      )
    : {};
  return computeEventFinancials({
    cancelled: record.status === "CANCELLED",
    salesTotalCents: saleCents,
    taxCents: taxCents ?? taxIncludedIn(saleCents, pricing.taxRateBps),
    estimated: { costBreakdown: breakdown, estimatedCostCents: record.quote?.estimatedCostCents ?? null },
    actual: {
      purchases: record.purchases,
      staffAssignments: record.staffAssignments,
      manualCosts: record.costs,
      payments,
    },
  });
}

export function collectionFromRecord(record: FinancialsRecord) {
  const { saleCents } = saleForEvent(record);
  const collection = computeCollection(saleCents, (record.booking?.payments ?? []) as FinPayment[]);
  // Un evento cancelado no tiene saldo por cobrar (lo reembolsado no se le vuelve a cobrar a la clienta).
  return record.status === "CANCELLED" ? { ...collection, balance: 0 } : collection;
}

export async function computeFinancialsForEvent(eventId: string) {
  const [record, pricing] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: financialsSelect }),
    getSettings("pricing"),
  ]);
  if (!record) return null;
  return {
    record,
    financials: financialsFromRecord(record, pricing),
    collection: collectionFromRecord(record),
  };
}

// ============================================================================
// Datos de la página /admin/events/[id]/financials
// ============================================================================

export async function getEventFinancialsPage(eventId: string) {
  const [event, pricing] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        ...financialsSelect,
        customer: { select: { id: true, name: true } },
        closedBy: { select: { name: true } },
        purchases: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            concept: true,
            category: true,
            status: true,
            expectedAmountCents: true,
            actualAmountCents: true,
            receivedAt: true,
            vendor: { select: { name: true } },
          },
        },
        staffAssignments: {
          orderBy: [{ startsAt: "asc" }],
          select: {
            id: true,
            function: true,
            amountCents: true,
            confirmed: true,
            paid: true,
            staffMember: { select: { name: true } },
          },
        },
        costs: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            category: true,
            description: true,
            amountCents: true,
            createdAt: true,
            createdBy: { select: { name: true } },
          },
        },
        booking: {
          select: {
            id: true,
            code: true,
            totalCents: true,
            depositRequiredCents: true,
            balanceDueAt: true,
            cancelledAt: true,
            payments: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
                kind: true,
                status: true,
                method: true,
                provider: true,
                amountCents: true,
                feeCents: true,
                refundedCents: true,
                paidAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
    getSettings("pricing"),
  ]);
  if (!event) return null;
  const financials = financialsFromRecord(event, pricing);
  const collection = collectionFromRecord(event);
  const closing = event.closedAt ? readClosingSnapshot(event.closingSnapshot) : null;
  const pendingPurchases = event.purchases.filter(
    (p) => p.status === "REQUESTED" || p.status === "ORDERED",
  ).length;
  return {
    event,
    financials,
    collection,
    closing,
    pendingPurchases,
    canClose: canCloseEvent(event.status, event.closedAt),
  };
}

export type EventFinancialsPageData = NonNullable<Awaited<ReturnType<typeof getEventFinancialsPage>>>;

// ============================================================================
// Costos manuales (EventCost)
// ============================================================================

async function assertCostsEditable(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, closedAt: true },
  });
  if (!event) throw new NotFoundError("El evento no existe.");
  if (event.closedAt) throw new ConflictError("El evento ya está cerrado: sus costos quedaron congelados.");
  return event;
}

export async function createEventCost(actor: SessionUser, input: CreateEventCostInput) {
  await assertCostsEditable(input.eventId);
  const cost = await prisma.eventCost.create({
    data: {
      eventId: input.eventId,
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      createdById: actor.id,
    },
  });
  await audit({
    action: "cost.created",
    entityType: "EventCost",
    entityId: cost.id,
    after: {
      eventId: cost.eventId,
      category: cost.category,
      description: cost.description,
      amountCents: cost.amountCents,
    },
    actor,
  });
  return cost;
}

export async function updateEventCost(actor: SessionUser, input: UpdateEventCostInput) {
  const before = await prisma.eventCost.findUnique({ where: { id: input.costId } });
  if (!before) throw new NotFoundError("El costo ya no existe.");
  await assertCostsEditable(before.eventId);
  const cost = await prisma.eventCost.update({
    where: { id: before.id },
    data: { category: input.category, description: input.description, amountCents: input.amountCents },
  });
  await audit({
    action: "cost.updated",
    entityType: "EventCost",
    entityId: cost.id,
    before: {
      eventId: before.eventId,
      category: before.category,
      description: before.description,
      amountCents: before.amountCents,
    },
    after: {
      eventId: cost.eventId,
      category: cost.category,
      description: cost.description,
      amountCents: cost.amountCents,
    },
    actor,
  });
  return cost;
}

export async function deleteEventCost(actor: SessionUser, input: DeleteEventCostInput) {
  const before = await prisma.eventCost.findUnique({ where: { id: input.costId } });
  if (!before) throw new NotFoundError("El costo ya no existe.");
  await assertCostsEditable(before.eventId);
  await prisma.eventCost.delete({ where: { id: before.id } });
  await audit({
    action: "cost.deleted",
    entityType: "EventCost",
    entityId: before.id,
    before: {
      eventId: before.eventId,
      category: before.category,
      description: before.description,
      amountCents: before.amountCents,
    },
    actor,
  });
  return { id: before.id, eventId: before.eventId };
}

// ============================================================================
// Cierre de evento
// ============================================================================

export async function closeEvent(actor: SessionUser, eventId: string, opts: { now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const computed = await computeFinancialsForEvent(eventId);
  if (!computed) throw new NotFoundError("El evento no existe.");
  const { record, financials, collection } = computed;
  if (record.closedAt) throw new ConflictError("Este evento ya está cerrado.");
  if (!canCloseEvent(record.status, record.closedAt)) {
    throw new ConflictError("Sólo puedes cerrar eventos completados.");
  }

  const snapshot = buildClosingSnapshot(financials, {
    closedAt: now,
    guestCount: record.guestCount,
    collectedCents: collection.paid,
    balanceCents: collection.balance,
  });

  await prisma.$transaction(async (tx) => {
    // Condición atómica: evita doble cierre en solicitudes concurrentes.
    const res = await tx.event.updateMany({
      where: { id: eventId, status: "COMPLETED", closedAt: null },
      data: {
        closedAt: now,
        closedById: actor.id,
        closingSnapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      },
    });
    if (res.count === 0) throw new ConflictError("Este evento ya está cerrado.");
    await audit(
      {
        action: "event.closed",
        entityType: "Event",
        entityId: eventId,
        before: { closedAt: null },
        after: {
          closedAt: now.toISOString(),
          saleCents: financials.sale,
          netRevenueCents: financials.netRevenue,
          actualCostCents: financials.actualCost,
          actualMarginCents: financials.actualMargin,
          actualMarginBps: financials.actualMarginBps,
          balanceCents: collection.balance,
        },
        actor,
      },
      tx,
    );
  });

  await sendPostEventNotifications(eventId).catch((error) => {
    logger.error("financials.close_notify_failed", { error, eventId });
  });

  return { eventId, closedAt: now, snapshot };
}

/**
 * Agradecimiento (POST_EVENT) + solicitud de reseña (REVIEW_REQUEST) al cerrar.
 * Usa las MISMAS dedupeKeys que el programador de notificaciones (`sched:post_event:<id>`…) y
 * omite los tipos que ya se enviaron para el evento: la clienta nunca recibe dos agradecimientos
 * aunque el cron se haya adelantado al cierre (o viceversa).
 */
async function sendPostEventNotifications(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      eventDate: true,
      portalToken: true,
      customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
      memoryCapsule: { select: { shareToken: true, published: true } },
      review: { select: { id: true } },
      notifications: {
        where: { type: { in: ["POST_EVENT", "REVIEW_REQUEST"] } },
        select: { type: true },
      },
    },
  });
  if (!event) return;
  const sent = new Set(event.notifications.map((n) => n.type));
  const portalUrl = appUrl(`/mi-evento/${event.portalToken}`);
  const capsuleOn = await isEnabled("MEMORY_CAPSULE_ENABLED");
  const memoryUrl =
    capsuleOn && event.memoryCapsule?.published ? appUrl(`/memory/${event.memoryCapsule.shareToken}`) : null;
  const data = {
    name: event.customer.name,
    eventTitle: event.title,
    eventDate: formatLongDate(event.eventDate),
  };
  if (!sent.has("POST_EVENT")) {
    await notifyCustomer(event.customer, {
      type: "POST_EVENT",
      // Sin cápsula publicada el texto por defecto ("tu Memory Capsule ya está disponible") sería falso.
      data: memoryUrl
        ? { ...data, url: memoryUrl }
        : {
            ...data,
            url: portalUrl,
            message: "Muy pronto compartiremos contigo las fotos y los recuerdos del día.",
            ctaLabel: "Ver mi evento",
          },
      eventId: event.id,
      dedupeKey: dedupeKeys.postEvent(event.id),
    });
  }
  if (!sent.has("REVIEW_REQUEST") && !event.review) {
    await notifyCustomer(event.customer, {
      type: "REVIEW_REQUEST",
      data: { ...data, url: portalUrl },
      eventId: event.id,
      dedupeKey: dedupeKeys.reviewRequest(event.id),
    });
  }
}

/** Texto corto para el diálogo de cierre (saldo pendiente / compras sin recibir). */
export function closeWarnings(data: { balanceCents: number; pendingPurchases: number }): string[] {
  const out: string[] = [];
  if (data.balanceCents > 0)
    out.push(`La clienta aún tiene un saldo pendiente de ${formatMXN(data.balanceCents)}.`);
  if (data.pendingPurchases > 0) {
    out.push(
      `${data.pendingPurchases} compra(s) no están marcadas como recibidas y no contarán en el costo real congelado.`,
    );
  }
  return out;
}
