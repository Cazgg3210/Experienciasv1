/**
 * Lógica pura del módulo Staff: días disponibles, tarifas, totales y contraseñas temporales.
 */
import type { EventStatus, StaffRateType } from "@prisma/client";
import { formatMXN } from "@/lib/money";
import { WEEKDAY_SHORT } from "@/lib/labels";

/** Orden de captura: lunes primero (más natural para operación). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function normalizeWeekdays(days: number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a as 0) - WEEKDAY_ORDER.indexOf(b as 0),
  );
}

/** "Lun, Mié, Vie" · "Todos los días" · "Sin días registrados" */
export function formatWeekdays(days: number[]): string {
  const norm = normalizeWeekdays(days);
  if (norm.length === 0) return "Sin días registrados";
  if (norm.length === 7) return "Todos los días";
  return norm.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** "$1,200 por evento" · "$120 por hora" */
export function formatRate(rateCents: number, rateType: StaffRateType): string {
  return `${formatMXN(rateCents)} ${rateType === "PER_HOUR" ? "por hora" : "por evento"}`;
}

export type AssignmentAmount = { amountCents: number; paid: boolean; eventStatus: EventStatus };

/** Totales de pago al staff (excluye eventos cancelados). */
export function summarizeAmounts(assignments: AssignmentAmount[]): {
  total: number;
  paid: number;
  pending: number;
  count: number;
} {
  let total = 0;
  let paid = 0;
  let count = 0;
  for (const a of assignments) {
    if (a.eventStatus === "CANCELLED") continue;
    count++;
    total += a.amountCents;
    if (a.paid) paid += a.amountCents;
  }
  return { total, paid, pending: total - paid, count };
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Contraseña temporal legible (sin caracteres ambiguos), ≥ 12 caracteres, con dígito. */
export function generateTempPassword(length = 12): string {
  const size = Math.max(10, length);
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
  // Garantiza al menos un dígito y una mayúscula
  if (!/\d/.test(out)) out = `${out.slice(0, -1)}7`;
  if (!/[A-Z]/.test(out)) out = `R${out.slice(1)}`;
  return out;
}

/** Iniciales para avatar */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
