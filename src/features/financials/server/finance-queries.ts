import "server-only";
import type { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { getSettings } from "@/features/settings/server/settings-service";
import { lastMonths, monthBucket } from "@/features/analytics/domain/metrics";
import { readClosingSnapshot, weightedMarginBps } from "../domain/event-financials";
import type { FinanceFilters } from "../schemas";
import { collectionFromRecord, financialsFromRecord, financialsSelect } from "./event-financials-service";

export const FINANCE_ROW_LIMIT = 500;
/** Tope de la exportación CSV (muy por encima del volumen esperado del negocio). */
export const FINANCE_EXPORT_LIMIT = 20_000;

/** Estados con venta confirmada (anticipo pagado o más). */
export const CONFIRMED_SALE_STATUSES: EventStatus[] = [
  "CONFIRMED",
  "PLANNING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
];

export type FinanceRow = {
  id: string;
  code: string;
  title: string;
  status: EventStatus;
  eventDate: Date;
  closed: boolean;
  saleCents: number;
  collectedCents: number;
  balanceCents: number;
  netRevenueCents: number;
  plannedNetRevenueCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  estimatedMarginBps: number | null;
  /** null = sin costos reales registrados */
  actualCostCents: number | null;
  actualMarginCents: number | null;
  actualMarginBps: number | null;
  /** true si el costo real es definitivo (evento completado, cerrado o cancelado); si no, es parcial. */
  actualIsFinal: boolean;
};

export type FinanceTotals = {
  count: number;
  saleCents: number;
  collectedCents: number;
  balanceCents: number;
  estimatedCostCents: number;
  /** Costo real registrado (definitivo + parcial) */
  actualCostCents: number;
  estimatedMarginBps: number | null;
  /** Margen real ponderado sólo de eventos con costo definitivo (completados, cerrados o cancelados) */
  actualMarginBps: number | null;
  /** Eventos con algún costo real registrado */
  withActuals: number;
  /** Eventos con costo real definitivo (base del margen real) */
  withFinalActuals: number;
};

function buildWhere(filters: FinanceFilters): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = { OR: [{ booking: { isNot: null } }, { quote: { isNot: null } }] };
  if (filters.month) {
    const b = monthBucket(filters.month);
    where.eventDate = { gte: b.startDate, lt: b.endDate };
  }
  // Las consultas (INQUIRY) todavía no son venta: no entran a finanzas.
  switch (filters.status) {
    case undefined:
    case "ALL":
      where.status = { not: "INQUIRY" };
      break;
    case "OPEN":
      where.closedAt = null;
      where.status = { notIn: ["CANCELLED", "INQUIRY"] };
      break;
    case "CLOSED":
      where.closedAt = { not: null };
      break;
    default:
      where.status = filters.status;
  }
  return where;
}

export async function getFinanceRows(
  filters: FinanceFilters,
  opts: { limit?: number } = {},
): Promise<{ rows: FinanceRow[]; truncated: boolean }> {
  const limit = opts.limit ?? FINANCE_ROW_LIMIT;
  const [records, pricing] = await Promise.all([
    prisma.event.findMany({
      where: buildWhere(filters),
      orderBy: [{ eventDate: "desc" }, { startsAt: "desc" }],
      take: limit + 1,
      select: financialsSelect,
    }),
    getSettings("pricing"),
  ]);
  const truncated = records.length > limit;
  const rows = records.slice(0, limit).map((r): FinanceRow => {
    const fin = financialsFromRecord(r, pricing);
    const col = collectionFromRecord(r);
    const closing = r.closedAt ? readClosingSnapshot(r.closingSnapshot) : null;
    // Eventos cerrados: el snapshot congelado es la fuente de verdad del costo real.
    const actualCost = closing ? closing.actualCostCents : fin.anyActuals ? fin.actualCost : null;
    const actualMargin = closing ? closing.actualMarginCents : fin.anyActuals ? fin.actualMargin : null;
    const actualBps = closing ? closing.actualMarginBps : fin.anyActuals ? fin.actualMarginBps : null;
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      eventDate: r.eventDate,
      closed: !!r.closedAt,
      saleCents: fin.sale,
      collectedCents: col.paid,
      balanceCents: col.balance,
      netRevenueCents: closing ? closing.netRevenueCents : fin.netRevenue,
      plannedNetRevenueCents: fin.plannedNetRevenue,
      estimatedCostCents: fin.estimatedCost,
      estimatedMarginCents: fin.estimatedMargin,
      estimatedMarginBps: fin.estimatedMarginBps,
      actualCostCents: actualCost,
      actualMarginCents: actualMargin,
      actualMarginBps: actualBps,
      // Completado, cerrado o cancelado: ya no se esperan más costos (en cancelados son costos hundidos).
      actualIsFinal: !!r.closedAt || r.status === "COMPLETED" || r.status === "CANCELLED",
    };
  });
  return { rows, truncated };
}

export function financeTotals(rows: FinanceRow[]): FinanceTotals {
  const withActuals = rows.filter((r) => r.actualCostCents != null);
  // El margen real agregado sólo considera eventos con costo definitivo (completados, cerrados o cancelados):
  // en eventos futuros los costos reales todavía son parciales y inflarían el margen.
  const finalActuals = withActuals.filter((r) => r.actualIsFinal);
  const withEstimate = rows.filter((r) => r.estimatedCostCents > 0);
  return {
    count: rows.length,
    saleCents: rows.reduce((s, r) => s + r.saleCents, 0),
    collectedCents: rows.reduce((s, r) => s + r.collectedCents, 0),
    balanceCents: rows.reduce((s, r) => s + r.balanceCents, 0),
    estimatedCostCents: rows.reduce((s, r) => s + r.estimatedCostCents, 0),
    actualCostCents: withActuals.reduce((s, r) => s + (r.actualCostCents ?? 0), 0),
    estimatedMarginBps: weightedMarginBps(
      withEstimate.map((r) => ({
        marginCents: r.estimatedMarginCents,
        revenueCents: r.plannedNetRevenueCents,
      })),
    ),
    actualMarginBps: weightedMarginBps(
      finalActuals.map((r) => ({ marginCents: r.actualMarginCents ?? 0, revenueCents: r.netRevenueCents })),
    ),
    withActuals: withActuals.length,
    withFinalActuals: finalActuals.length,
  };
}

// ============================================================================
// Vendido vs cobrado por mes
// ============================================================================

export type MonthlyRevenue = { key: string; label: string; soldCents: number; collectedCents: number };

export async function getRevenueByMonth(months = 6, now: Date = new Date()): Promise<MonthlyRevenue[]> {
  const buckets = lastMonths(months, now);
  const from = buckets[0]!.start;
  const to = buckets[buckets.length - 1]!.end;
  const [bookings, payments] = await Promise.all([
    prisma.booking.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        cancelledAt: null,
        event: { status: { in: CONFIRMED_SALE_STATUSES } },
      },
      select: { createdAt: true, totalCents: true },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: from, lt: to },
        kind: { not: "REFUND" },
        status: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] },
      },
      select: { paidAt: true, amountCents: true, refundedCents: true },
    }),
  ]);
  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    soldCents: bookings
      .filter((x) => x.createdAt >= b.start && x.createdAt < b.end)
      .reduce((s, x) => s + x.totalCents, 0),
    collectedCents: payments
      .filter((p) => p.paidAt && p.paidAt >= b.start && p.paidAt < b.end)
      .reduce((s, p) => s + p.amountCents - p.refundedCents, 0),
  }));
}

// ============================================================================
// Pagos recientes y saldos pendientes
// ============================================================================

export async function getRecentPayments(limit = 10) {
  return prisma.payment.findMany({
    where: { status: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] }, paidAt: { not: null } },
    orderBy: [{ paidAt: "desc" }],
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      method: true,
      amountCents: true,
      feeCents: true,
      refundedCents: true,
      paidAt: true,
      booking: {
        select: {
          code: true,
          customer: { select: { name: true } },
          event: { select: { id: true, title: true } },
        },
      },
    },
  });
}

export type OutstandingBalance = {
  eventId: string;
  code: string;
  title: string;
  status: EventStatus;
  eventDate: Date;
  customerName: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  depositPending: boolean;
  balanceDueAt: Date | null;
};

export async function getOutstandingBalances(limit = 12): Promise<OutstandingBalance[]> {
  const events = await prisma.event.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"] },
      closedAt: null,
      booking: { is: { cancelledAt: null } },
    },
    orderBy: [{ eventDate: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      eventDate: true,
      customer: { select: { name: true } },
      booking: {
        select: {
          totalCents: true,
          depositRequiredCents: true,
          balanceDueAt: true,
          payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
        },
      },
    },
  });
  const out: OutstandingBalance[] = [];
  for (const e of events) {
    if (!e.booking) continue;
    const paid = e.booking.payments
      .filter(
        (p) =>
          p.kind !== "REFUND" &&
          (p.status === "PAID" || p.status === "PARTIAL_REFUND" || p.status === "REFUNDED"),
      )
      .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
    const balance = Math.max(0, e.booking.totalCents - paid);
    if (balance <= 0) continue;
    out.push({
      eventId: e.id,
      code: e.code,
      title: e.title,
      status: e.status,
      eventDate: e.eventDate,
      customerName: e.customer.name,
      totalCents: e.booking.totalCents,
      paidCents: paid,
      balanceCents: balance,
      depositPending: paid < e.booking.depositRequiredCents,
      balanceDueAt: e.booking.balanceDueAt,
    });
  }
  return out.slice(0, limit);
}
