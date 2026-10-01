/**
 * Utilidades compartidas por el seed: reloj relativo, PRNG determinista,
 * selección de fechas y cálculo de cotizaciones (centavos MXN / bps).
 *
 * IMPORTANTE: sólo imports relativos (sin alias "@/") y sin "server-only",
 * porque el seed se ejecuta con `tsx` fuera de Next.js.
 */
import type { MenuPricingType, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { generateCode, type CodePrefix } from "../../src/lib/codes";
import { applyBps } from "../../src/lib/money";
import { dateOnly, localDateKey, toDateKey, weekdayOf, zonedDateTime } from "../../src/lib/dates";
import { slugify } from "../../src/lib/slug";
import { pricingSettingsSchema } from "../../src/features/settings/domain/settings-schema";
import {
  PRICING_VERSION,
  calculateQuote,
  type CostCategory,
  type EngineCustomItem,
  type EngineDiscount,
  type EngineSettings,
  type QuoteEngineInput,
  type QuoteResult,
} from "../../src/features/quotes/domain/quote-engine";

export { PRICING_VERSION };
export type { EngineCustomItem, EngineDiscount, QuoteResult };
export const TERMS_VERSION = "2026-09";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Atajo para pesos -> centavos en datos de catálogo. */
export const mx = (pesos: number): number => Math.round(pesos * 100);

export function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

// -----------------------------------------------------------------------------
// PRNG determinista (mulberry32)
// -----------------------------------------------------------------------------
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

export function pickWeighted<T>(rng: Rng, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// -----------------------------------------------------------------------------
// Fechas relativas al momento en que corre el seed (zona America/Mexico_City)
// -----------------------------------------------------------------------------
export function addDaysToKey(key: string, days: number): string {
  return toDateKey(new Date(dateOnly(key).getTime() + days * DAY_MS));
}

export class Clock {
  readonly now: Date;
  /** YYYY-MM-DD de hoy en CDMX */
  readonly todayKey: string;

  constructor(now: Date = new Date()) {
    this.now = now;
    this.todayKey = localDateKey(now);
  }

  /** YYYY-MM-DD relativo a hoy (CDMX). */
  dayKey(offsetDays: number): string {
    return addDaysToKey(this.todayKey, offsetDays);
  }

  /** Instante a una hora local (HH:mm) de un día relativo a hoy. */
  at(offsetDays: number, time: string): Date {
    return zonedDateTime(this.dayKey(offsetDays), time);
  }

  /** Instante "hace N horas" (para actividad reciente del mismo día). */
  hoursAgo(hours: number): Date {
    return new Date(this.now.getTime() - hours * HOUR_MS);
  }

  /** Días (calendario) entre hoy y una fecha YYYY-MM-DD. */
  daysFromToday(key: string): number {
    return Math.round((dateOnly(key).getTime() - dateOnly(this.todayKey).getTime()) / DAY_MS);
  }
}

/** Primera fecha >= fromKey cuyo día de la semana esté en `weekdays` y no esté en `avoid`. */
export function firstDateOnOrAfter(fromKey: string, weekdays: number[], avoid: ReadonlySet<string> = new Set()): string {
  let key = fromKey;
  for (let i = 0; i < 400; i++) {
    if (weekdays.includes(weekdayOf(key)) && !avoid.has(key)) return key;
    key = addDaysToKey(key, 1);
  }
  throw new Error(`No se encontró fecha a partir de ${fromKey}`);
}

/** Última fecha <= fromKey cuyo día de la semana esté en `weekdays` y no esté en `avoid`. */
export function lastDateOnOrBefore(fromKey: string, weekdays: number[], avoid: ReadonlySet<string> = new Set()): string {
  let key = fromKey;
  for (let i = 0; i < 400; i++) {
    if (weekdays.includes(weekdayOf(key)) && !avoid.has(key)) return key;
    key = addDaysToKey(key, -1);
  }
  throw new Error(`No se encontró fecha antes de ${fromKey}`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Nunca devuelve un instante en el futuro respecto a `now` (para actividad "pasada"). */
export function notAfter(date: Date, now: Date): Date {
  return date.getTime() > now.getTime() ? new Date(now.getTime() - 5 * MINUTE_MS) : date;
}

// -----------------------------------------------------------------------------
// Códigos / tokens / emails
// -----------------------------------------------------------------------------
const usedCodes = new Set<string>();

/** generateCode con garantía de no repetir dentro de esta corrida. */
export function uniqueCode(prefix: CodePrefix, date: Date = new Date()): string {
  for (let i = 0; i < 50; i++) {
    const code = generateCode(prefix, date);
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
  throw new Error(`No se pudo generar un código único para ${prefix}`);
}

export function shortId(bytes = 6): string {
  return randomBytes(bytes).toString("hex");
}

export function emailFor(name: string, domain = "example.com"): string {
  return `${slugify(name).replace(/-/g, ".")}@${domain}`;
}


// -----------------------------------------------------------------------------
// Cotizaciones: SIEMPRE con el motor real (src/features/quotes/domain/quote-engine).
// El input se arma igual que `buildEngineInput` en src/features/quotes/server/pricing.ts.
// -----------------------------------------------------------------------------

/** Settings del motor = defaults de la sección "pricing" (lo mismo que siembra el seed base). */
const PRICING_DEFAULTS = pricingSettingsSchema.parse({});
export const ENGINE_SETTINGS: EngineSettings = {
  taxRateBps: PRICING_DEFAULTS.taxRateBps,
  pricesIncludeTax: PRICING_DEFAULTS.pricesIncludeTax,
  depositBps: PRICING_DEFAULTS.depositBps,
  paymentFeeBps: PRICING_DEFAULTS.paymentFeeBps,
  paymentFeeFixedCents: PRICING_DEFAULTS.paymentFeeFixedCents,
  minMarginBps: PRICING_DEFAULTS.minMarginBps,
  maxStandardGuests: PRICING_DEFAULTS.maxStandardGuests,
};

export interface PricingExperience {
  id: string;
  slug: string;
  name: string;
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  extraGuestPriceCents: number;
  extraGuestCostCents: number;
  costComponents: { category: CostCategory; description: string; amountCents: number; perGuest: boolean }[];
}

export interface PricingMenu {
  id: string;
  slug: string;
  name: string;
  pricingType: MenuPricingType;
  priceCents: number;
  costPerGuestCents: number;
}

export interface PricingAddOn {
  id: string;
  slug: string;
  name: string;
  pricingType: "FLAT" | "PER_GUEST";
  priceCents: number;
  costCents: number;
  costCategory: CostCategory;
  maxQuantity: number;
}

export interface PricingArea {
  id: string;
  slug: string;
  name: string;
  logisticsFeeCents: number;
  logisticsCostCents: number;
}

export interface QuoteSelection {
  experience: PricingExperience;
  guestCount: number;
  menu?: PricingMenu | null;
  addOns?: { addOn: PricingAddOn; quantity: number }[];
  area?: PricingArea | null;
  customItems?: EngineCustomItem[];
  discount?: EngineDiscount | null;
}

export function buildEngineInput(sel: QuoteSelection): QuoteEngineInput {
  const exp = sel.experience;
  return {
    experience: {
      id: exp.id,
      name: exp.name,
      basePriceCents: exp.basePriceCents,
      baseGuests: exp.baseGuests,
      minGuests: exp.minGuests,
      maxGuests: exp.maxGuests,
      extraGuestPriceCents: exp.extraGuestPriceCents,
      extraGuestCostCents: exp.extraGuestCostCents,
      costComponents: exp.costComponents.map((c) => ({
        category: c.category,
        description: c.description,
        amountCents: c.amountCents,
        perGuest: c.perGuest,
      })),
    },
    guestCount: sel.guestCount,
    menu: sel.menu
      ? {
          id: sel.menu.id,
          name: sel.menu.name,
          pricingType: sel.menu.pricingType,
          priceCents: sel.menu.priceCents,
          costPerGuestCents: sel.menu.costPerGuestCents,
        }
      : null,
    addOns: (sel.addOns ?? []).map(({ addOn, quantity }) => ({
      id: addOn.id,
      name: addOn.name,
      pricingType: addOn.pricingType,
      priceCents: addOn.priceCents,
      costCents: addOn.costCents,
      costCategory: addOn.costCategory,
      quantity,
      maxQuantity: addOn.maxQuantity,
    })),
    serviceArea: sel.area
      ? {
          id: sel.area.id,
          name: sel.area.name,
          logisticsFeeCents: sel.area.logisticsFeeCents,
          logisticsCostCents: sel.area.logisticsCostCents,
        }
      : null,
    customItems: sel.customItems,
    discount: sel.discount ?? null,
    settings: ENGINE_SETTINGS,
  };
}

/** Cotiza con el motor real. */
export function priceQuote(sel: QuoteSelection): QuoteResult {
  return calculateQuote(buildEngineInput(sel));
}

/** Comisión de pasarela (misma fórmula que el motor) para pagos en línea individuales. */
export function paymentFee(amountCents: number): number {
  return applyBps(amountCents, ENGINE_SETTINGS.paymentFeeBps) + ENGINE_SETTINGS.paymentFeeFixedCents;
}

/** Misma forma que `publicEstimate` de src/features/quotes/server/pricing.ts (sin costos ni márgenes). */
export function publicEstimate(result: QuoteResult): Prisma.InputJsonValue {
  const publicWarnings = ["GUESTS_BELOW_MINIMUM", "GUESTS_ABOVE_EXPERIENCE_MAX", "SPECIAL_REQUEST_GUESTS", "ADDON_QUANTITY_CAPPED"];
  return json({
    pricingVersion: result.pricingVersion,
    guestCount: result.guestCount,
    extraGuests: result.extraGuests,
    lines: result.lines.map((l) => ({
      type: l.type,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      totalPriceCents: l.totalPriceCents,
    })),
    subtotalCents: result.subtotalCents,
    discountCents: result.discountCents,
    taxCents: result.taxCents,
    totalCents: result.totalCents,
    depositCents: result.depositCents,
    warnings: result.warnings.filter((w) => publicWarnings.includes(w.code)).map((w) => w.message),
  });
}
