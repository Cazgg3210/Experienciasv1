import type { AddOnPricingType, MenuPricingType } from "@prisma/client";
import { formatMXN } from "@/lib/money";

/**
 * Textos de presentación del catálogo público (lógica pura; los montos vienen del catálogo
 * en DB — aquí sólo se formatean, nunca se calculan totales).
 */

export function guestRangeLabel(min: number, max: number): string {
  return min === max ? `${min} personas` : `${min}–${max} personas`;
}

export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "desde $14,900 · 6–12 personas" (tarjetas) */
export function cardPriceLine(e: { basePriceCents: number; minGuests: number; maxGuests: number }): string {
  return `desde ${formatMXN(e.basePriceCents)} · ${guestRangeLabel(e.minGuests, e.maxGuests)}`;
}

/** "Desde $14,900 para 6 personas" */
export function fromPriceLabel(e: { basePriceCents: number; baseGuests: number }): string {
  return `Desde ${formatMXN(e.basePriceCents)} para ${e.baseGuests} personas`;
}

/** "Invitada adicional $1,500" o null si no aplica */
export function extraGuestLabel(extraGuestPriceCents: number): string | null {
  return extraGuestPriceCents > 0 ? `Invitada adicional ${formatMXN(extraGuestPriceCents)}` : null;
}

export function addOnPriceLabel(a: { priceCents: number; pricingType: AddOnPricingType }): string {
  if (a.priceCents <= 0) return "Sin costo";
  return a.pricingType === "PER_GUEST" ? `${formatMXN(a.priceCents)} por persona` : formatMXN(a.priceCents);
}

export function menuPriceLabel(m: { priceCents: number; pricingType: MenuPricingType }): string {
  if (m.pricingType === "INCLUDED" || m.priceCents <= 0) return "Incluido";
  return m.pricingType === "PER_GUEST" ? `+${formatMXN(m.priceCents)} por persona` : `+${formatMXN(m.priceCents)} por evento`;
}

/** Porcentaje legible desde bps: 5000 → "50%" */
export function percentFromBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** Recorta un texto largo para meta descriptions (sin cortar palabras). */
export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:—-]+$/, "")}…`;
}

/** Divide una descripción en párrafos (separados por línea en blanco). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
