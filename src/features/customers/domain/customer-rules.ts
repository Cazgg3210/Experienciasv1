/**
 * Reglas puras de clientas: bloqueo de eliminación, total pagado, última actividad, normalización.
 */
import { netPaidCents, type PaymentLike } from "@/features/payments/domain/payment-status";

export type CustomerRelationCounts = { quotes: number; bookings: number; events: number };

/** Motivos (en español) por los que una clienta no puede eliminarse. Vacío = se puede. */
export function customerDeletionBlockers(counts: CustomerRelationCounts): string[] {
  const reasons: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (counts.quotes > 0) reasons.push(`Tiene ${plural(counts.quotes, "cotización", "cotizaciones")}.`);
  if (counts.bookings > 0) reasons.push(`Tiene ${plural(counts.bookings, "reserva", "reservas")} con historial de pagos.`);
  if (counts.events > 0) reasons.push(`Tiene ${plural(counts.events, "evento", "eventos")}.`);
  return reasons;
}

export function canDeleteCustomer(counts: CustomerRelationCounts): boolean {
  return customerDeletionBlockers(counts).length === 0;
}

/** Suma neta cobrada por clienta (PAID / reembolsos parciales netos; los registros REFUND no suman). */
export function totalPaidByCustomer(rows: Array<PaymentLike & { customerId: string }>): Map<string, number> {
  const grouped = new Map<string, PaymentLike[]>();
  for (const row of rows) {
    const list = grouped.get(row.customerId) ?? [];
    list.push(row);
    grouped.set(row.customerId, list);
  }
  const out = new Map<string, number>();
  for (const [customerId, list] of grouped) out.set(customerId, netPaidCents(list));
  return out;
}

/** La fecha más reciente (o null). */
export function latestActivity(dates: Array<Date | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const d of dates) {
    if (d && !Number.isNaN(d.getTime()) && (!latest || d > latest)) latest = d;
  }
  return latest;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

export function normalizeOptional(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** "@sofi.brunch", "instagram.com/sofi.brunch/" → "sofi.brunch" */
export function normalizeInstagram(value: string | null | undefined): string | null {
  let v = value?.trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^instagram\.com\//i, "");
  v = v.replace(/^@+/, "").replace(/[/?#].*$/, "");
  return v || null;
}
