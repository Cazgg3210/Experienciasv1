import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { addDaysUtc, dateOnly, localDateKey, toDateKey, zonedDateTime } from "@/lib/dates";
import { mediaUrl } from "@/features/media/server/media-url";
import { summarizePurchases, type PurchaseTotals } from "../domain/purchase-rules";
import type { PurchaseFilters } from "../schemas";

function nextDayKey(key: string): string {
  return toDateKey(addDaysUtc(dateOnly(key), 1));
}

export function buildPurchaseWhere(filters: PurchaseFilters): Prisma.PurchaseWhereInput {
  const and: Prisma.PurchaseWhereInput[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.category) and.push({ category: filters.category });
  if (filters.event === "none") and.push({ eventId: null });
  else if (filters.event) and.push({ eventId: filters.event });
  if (filters.vendor === "none") and.push({ vendorId: null });
  else if (filters.vendor) and.push({ vendorId: filters.vendor });
  if (filters.q) {
    and.push({
      OR: [
        { concept: { contains: filters.q, mode: "insensitive" } },
        { notes: { contains: filters.q, mode: "insensitive" } },
        { vendor: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.from || filters.to) {
    const range: Prisma.DateTimeFilter = {};
    if (filters.from) range.gte = zonedDateTime(filters.from, "00:00");
    if (filters.to) range.lt = zonedDateTime(nextDayKey(filters.to), "00:00");
    // Fecha de referencia: "necesario para" o, si no tiene, la fecha de creación.
    and.push({ OR: [{ neededBy: range }, { neededBy: null, createdAt: range }] });
  }
  return and.length ? { AND: and } : {};
}

export async function listPurchases(filters: PurchaseFilters, { page = 1, pageSize = 25 } = {}) {
  const where = buildPurchaseWhere(filters);
  const [rows, total, all] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        vendor: { select: { id: true, name: true, status: true } },
        event: { select: { id: true, code: true, title: true, eventDate: true } },
      },
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({ where, select: { status: true, expectedAmountCents: true, actualAmountCents: true } }),
  ]);
  return { rows, total, totals: summarizePurchases(all) };
}

export async function getPurchaseDetail(id: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      vendor: true,
      event: { select: { id: true, code: true, title: true, eventDate: true, status: true, closedAt: true } },
      createdBy: { select: { name: true } },
      receiptMedia: {
        select: { id: true, driver: true, url: true, storageKey: true, visibility: true, mimeType: true, sizeBytes: true },
      },
    },
  });
  if (!purchase) return null;
  const history = await prisma.auditLog.findMany({
    where: { entityType: "Purchase", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, action: true, before: true, after: true, actorEmail: true, createdAt: true, actor: { select: { name: true } } },
  });
  return {
    purchase,
    receipt: purchase.receiptMedia
      ? {
          id: purchase.receiptMedia.id,
          url: mediaUrl(purchase.receiptMedia),
          mimeType: purchase.receiptMedia.mimeType,
          sizeBytes: purchase.receiptMedia.sizeBytes,
        }
      : null,
    history,
  };
}

/** Opciones para el formulario: eventos (recientes y próximos, no cancelados) y proveedores no bloqueados. */
export async function getPurchaseFormOptions({ includeEventId, includeVendorId }: { includeEventId?: string | null; includeVendorId?: string | null } = {}) {
  const since = addDaysUtc(dateOnly(localDateKey()), -60);
  const [events, vendors] = await Promise.all([
    prisma.event.findMany({
      where: {
        OR: [
          { eventDate: { gte: since }, status: { not: "CANCELLED" } },
          ...(includeEventId ? [{ id: includeEventId }] : []),
        ],
      },
      orderBy: { eventDate: "asc" },
      select: { id: true, code: true, title: true, eventDate: true },
    }),
    prisma.vendor.findMany({
      where: {
        OR: [{ status: { not: "BLOCKED" } }, ...(includeVendorId ? [{ id: includeVendorId }] : [])],
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, status: true },
    }),
  ]);
  return {
    events: events.map((e) => ({ id: e.id, label: `${e.title} · ${e.code}`, dateKey: toDateKey(e.eventDate) })),
    vendors,
  };
}

/** Opciones de filtros del listado. */
export async function getPurchaseFilterOptions() {
  const [events, vendors] = await Promise.all([
    prisma.event.findMany({
      where: { purchases: { some: {} } },
      orderBy: { eventDate: "desc" },
      select: { id: true, code: true, title: true, eventDate: true },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    events: events.map((e) => ({ value: e.id, label: `${e.title} · ${e.code}` })),
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
  };
}

export async function getEventBrief(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, code: true, title: true, eventDate: true, status: true },
  });
}

/**
 * Resumen de compras de un evento (para el módulo de eventos/finanzas):
 * esperado (no canceladas), real (recibidas) y variación.
 */
export async function getEventPurchaseSummary(eventId: string): Promise<PurchaseTotals> {
  const purchases = await prisma.purchase.findMany({
    where: { eventId },
    select: { status: true, expectedAmountCents: true, actualAmountCents: true },
  });
  return summarizePurchases(purchases);
}
