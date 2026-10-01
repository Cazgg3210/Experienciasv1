/**
 * Utilidades compartidas por el seed: reloj relativo, PRNG determinista,
 * selección de fechas y cálculo de cotizaciones (centavos MXN / bps).
 *
 * IMPORTANTE: sólo imports relativos (sin alias "@/") y sin "server-only",
 * porque el seed se ejecuta con `tsx` fuera de Next.js.
 */
import type { CostCategory, DiscountType, MenuPricingType, Prisma, QuoteItemType } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { generateCode, type CodePrefix } from "../../src/lib/codes";
import { applyBps, marginBps } from "../../src/lib/money";
import { dateOnly, localDateKey, toDateKey, weekdayOf, zonedDateTime } from "../../src/lib/dates";
import { slugify } from "../../src/lib/slug";

export const PRICING_VERSION = "2026.09";
export const TERMS_VERSION = "2026-09";
export const TAX_RATE_BPS = 1600;
export const PAYMENT_FEE_BPS = 360;
export const PAYMENT_FEE_FIXED_CENTS = 300;
export const DEPOSIT_BPS = 5000;

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
// Cotizaciones: cálculo consistente (precios con IVA incluido)
// -----------------------------------------------------------------------------
export interface PricingCostComponent {
  category: CostCategory;
  amountCents: number;
  perGuest: boolean;
}

export interface PricingExperience {
  id: string;
  slug: string;
  name: string;
  basePriceCents: number;
  baseGuests: number;
  extraGuestPriceCents: number;
  extraGuestCostCents: number;
  costComponents: PricingCostComponent[];
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
}

export interface PricingArea {
  id: string;
  slug: string;
  name: string;
  logisticsFeeCents: number;
  logisticsCostCents: number;
}

export interface CustomLine {
  description: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  costCategory: CostCategory;
}

export interface QuoteCalcInput {
  experience: PricingExperience;
  guestCount: number;
  menu?: PricingMenu | null;
  /** Costo por invitada del menú incluido de referencia (los upgrades se costean de forma incremental). */
  menuCostBaselineCents: number;
  addOns: { addOn: PricingAddOn; quantity: number }[];
  area: PricingArea;
  custom?: CustomLine[];
  discount?: { type: DiscountType; value: number; reason: string } | null;
}

export interface CalcItem {
  type: QuoteItemType;
  refId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  totalPriceCents: number;
  totalCostCents: number;
  costCategory: CostCategory;
  sortOrder: number;
}

export interface QuoteCalc {
  items: CalcItem[];
  subtotalCents: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountReason: string | null;
  discountCents: number;
  logisticsCents: number;
  taxCents: number;
  totalCents: number;
  paymentFeeCents: number;
  itemsCostCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  marginBps: number;
  depositBps: number;
  depositCents: number;
  snapshot: Prisma.InputJsonValue;
}

export function experienceBaseCost(exp: PricingExperience): number {
  return exp.costComponents.reduce(
    (sum, c) => sum + (c.perGuest ? c.amountCents * exp.baseGuests : c.amountCents),
    0,
  );
}

/** IVA incluido en el precio: tax = total - total / 1.16 */
export function includedTax(totalCents: number, taxRateBps = TAX_RATE_BPS): number {
  return Math.round(totalCents - (totalCents * 10_000) / (10_000 + taxRateBps));
}

export function paymentFee(amountCents: number): number {
  return applyBps(amountCents, PAYMENT_FEE_BPS) + PAYMENT_FEE_FIXED_CENTS;
}

export function calculateQuote(input: QuoteCalcInput): QuoteCalc {
  const { experience: exp, guestCount, menu, area } = input;
  const items: CalcItem[] = [];
  let sort = 0;
  const push = (item: Omit<CalcItem, "totalPriceCents" | "totalCostCents" | "sortOrder">) => {
    items.push({
      ...item,
      totalPriceCents: item.unitPriceCents * item.quantity,
      totalCostCents: item.unitCostCents * item.quantity,
      sortOrder: sort++,
    });
  };

  push({
    type: "BASE_EXPERIENCE",
    refId: exp.id,
    description: `${exp.name} — experiencia base (${exp.baseGuests} invitadas)`,
    quantity: 1,
    unitPriceCents: exp.basePriceCents,
    unitCostCents: experienceBaseCost(exp),
    costCategory: "FOOD",
  });

  const extraGuests = Math.max(0, guestCount - exp.baseGuests);
  if (extraGuests > 0) {
    push({
      type: "EXTRA_GUEST",
      refId: exp.id,
      description: `Invitada adicional (${extraGuests})`,
      quantity: extraGuests,
      unitPriceCents: exp.extraGuestPriceCents,
      unitCostCents: exp.extraGuestCostCents,
      costCategory: "FOOD",
    });
  }

  if (menu && menu.pricingType !== "INCLUDED" && menu.priceCents > 0) {
    const incrementalCost = Math.max(0, menu.costPerGuestCents - input.menuCostBaselineCents);
    if (menu.pricingType === "PER_GUEST") {
      push({
        type: "MENU",
        refId: menu.id,
        description: `Menú ${menu.name} (upgrade por invitada)`,
        quantity: guestCount,
        unitPriceCents: menu.priceCents,
        unitCostCents: incrementalCost,
        costCategory: "FOOD",
      });
    } else {
      push({
        type: "MENU",
        refId: menu.id,
        description: `Menú ${menu.name} (upgrade)`,
        quantity: 1,
        unitPriceCents: menu.priceCents,
        unitCostCents: incrementalCost * guestCount,
        costCategory: "FOOD",
      });
    }
  }

  for (const { addOn, quantity } of input.addOns) {
    const perGuest = addOn.pricingType === "PER_GUEST";
    push({
      type: "ADDON",
      refId: addOn.id,
      description: perGuest ? `${addOn.name} (por invitada)` : quantity > 1 ? `${addOn.name} ×${quantity}` : addOn.name,
      quantity: perGuest ? guestCount * quantity : quantity,
      unitPriceCents: addOn.priceCents,
      unitCostCents: addOn.costCents,
      costCategory: addOn.costCategory,
    });
  }

  for (const line of input.custom ?? []) {
    push({
      type: "CUSTOM",
      refId: null,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      unitCostCents: line.unitCostCents,
      costCategory: line.costCategory,
    });
  }

  if (area.logisticsFeeCents > 0) {
    push({
      type: "LOGISTICS",
      refId: area.id,
      description: `Logística y traslado — ${area.name}`,
      quantity: 1,
      unitPriceCents: area.logisticsFeeCents,
      unitCostCents: area.logisticsCostCents,
      costCategory: "TRANSPORT",
    });
  }

  const subtotalCents = items.reduce((s, i) => s + i.totalPriceCents, 0);
  const itemsCostCents = items.reduce((s, i) => s + i.totalCostCents, 0);
  const discount = input.discount ?? null;
  const discountCents = discount
    ? discount.type === "PERCENT"
      ? applyBps(subtotalCents, discount.value)
      : Math.min(discount.value, subtotalCents)
    : 0;
  const totalCents = subtotalCents - discountCents;
  const taxCents = includedTax(totalCents);
  const paymentFeeCents = paymentFee(totalCents);
  const estimatedCostCents = itemsCostCents + paymentFeeCents;
  const netRevenue = totalCents - taxCents;
  const estimatedMarginCents = netRevenue - estimatedCostCents;
  const depositCents = Math.round((totalCents * DEPOSIT_BPS) / 10_000);
  const logisticsCents = area.logisticsFeeCents;

  const snapshot = json({
    pricingVersion: PRICING_VERSION,
    currency: "MXN",
    taxRateBps: TAX_RATE_BPS,
    pricesIncludeTax: true,
    paymentFeeBps: PAYMENT_FEE_BPS,
    paymentFeeFixedCents: PAYMENT_FEE_FIXED_CENTS,
    depositBps: DEPOSIT_BPS,
    guestCount,
    experience: {
      id: exp.id,
      slug: exp.slug,
      name: exp.name,
      basePriceCents: exp.basePriceCents,
      baseGuests: exp.baseGuests,
      extraGuestPriceCents: exp.extraGuestPriceCents,
      extraGuestCostCents: exp.extraGuestCostCents,
      baseCostCents: experienceBaseCost(exp),
    },
    menu: menu
      ? {
          id: menu.id,
          slug: menu.slug,
          name: menu.name,
          pricingType: menu.pricingType,
          priceCents: menu.priceCents,
          costPerGuestCents: menu.costPerGuestCents,
          costBasis: "incremental_vs_included_menu",
        }
      : null,
    serviceArea: {
      id: area.id,
      slug: area.slug,
      name: area.name,
      logisticsFeeCents: area.logisticsFeeCents,
      logisticsCostCents: area.logisticsCostCents,
    },
    addOns: input.addOns.map(({ addOn, quantity }) => ({
      id: addOn.id,
      slug: addOn.slug,
      name: addOn.name,
      pricingType: addOn.pricingType,
      priceCents: addOn.priceCents,
      costCents: addOn.costCents,
      quantity,
    })),
    discount,
    totals: {
      subtotalCents,
      discountCents,
      totalCents,
      taxCents,
      paymentFeeCents,
      itemsCostCents,
      estimatedCostCents,
      estimatedMarginCents,
    },
  });

  return {
    items,
    subtotalCents,
    discountType: discount?.type ?? null,
    discountValue: discount?.value ?? null,
    discountReason: discount?.reason ?? null,
    discountCents,
    logisticsCents,
    taxCents,
    totalCents,
    paymentFeeCents,
    itemsCostCents,
    estimatedCostCents,
    estimatedMarginCents,
    marginBps: marginBps(estimatedMarginCents, netRevenue),
    depositBps: DEPOSIT_BPS,
    depositCents,
    snapshot,
  };
}

/** Estimado público (sin costos) para ConfigurationSnapshot.estimate */
export function publicEstimate(calc: QuoteCalc): Prisma.InputJsonValue {
  return json({
    pricingVersion: PRICING_VERSION,
    currency: "MXN",
    lines: calc.items.map((i) => ({
      type: i.type,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      totalPriceCents: i.totalPriceCents,
    })),
    subtotalCents: calc.subtotalCents,
    discountCents: calc.discountCents,
    logisticsCents: calc.logisticsCents,
    taxCents: calc.taxCents,
    totalCents: calc.totalCents,
    depositBps: calc.depositBps,
    depositCents: calc.depositCents,
    pricesIncludeTax: true,
  });
}
