/**
 * Vista previa de costo y margen estimado de una experiencia para su número base de personas.
 * Usa el QuoteEngine puro (mismas reglas que las cotizaciones) — sólo para el panel admin.
 */
import {
  calculateQuote,
  type CostCategory,
  type EngineMenu,
  type EngineSettings,
  type QuoteResult,
} from "@/features/quotes/domain/quote-engine";

export type MarginPreviewExperience = {
  id?: string;
  name?: string;
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  extraGuestPriceCents: number;
  extraGuestCostCents: number;
  costComponents: Array<{ category: CostCategory; description?: string; amountCents: number; perGuest: boolean }>;
};

export type MarginLevel = "healthy" | "low" | "negative";

export type MarginPreview = {
  guestCount: number;
  totalCents: number;
  netRevenueCents: number;
  taxCents: number;
  estimatedCostCents: number;
  paymentFeeCents: number;
  marginCents: number;
  marginBps: number;
  minMarginBps: number;
  level: MarginLevel;
  menuName: string | null;
  costBreakdown: Array<{ category: CostCategory; cents: number }>;
};

function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** Nivel visual del margen: rojo si negativo, ámbar si está por debajo del mínimo configurado. */
export function marginLevel(marginCents: number, marginBps: number, minMarginBps: number): MarginLevel {
  if (marginCents < 0) return "negative";
  if (marginBps < minMarginBps) return "low";
  return "healthy";
}

/**
 * Calcula la vista previa para `baseGuests`. Devuelve null si los datos están incompletos
 * (p. ej. el formulario aún tiene montos vacíos) para no romper la UI.
 */
export function previewExperienceMargin(
  experience: MarginPreviewExperience,
  settings: EngineSettings,
  menu?: EngineMenu | null,
): MarginPreview | null {
  const e = experience;
  const ints = [e.basePriceCents, e.extraGuestPriceCents, e.extraGuestCostCents];
  if (!ints.every(isNonNegInt)) return null;
  // Sin precio no hay margen que mostrar (formulario nuevo o incompleto).
  if (e.basePriceCents <= 0) return null;
  if (!Number.isInteger(e.baseGuests) || e.baseGuests < 1) return null;
  if (!e.costComponents.every((c) => isNonNegInt(c.amountCents))) return null;

  let result: QuoteResult;
  try {
    result = calculateQuote({
      experience: {
        id: e.id ?? "preview",
        name: e.name || "Experiencia",
        basePriceCents: e.basePriceCents,
        baseGuests: e.baseGuests,
        minGuests: Number.isInteger(e.minGuests) && e.minGuests > 0 ? e.minGuests : 1,
        maxGuests: Number.isInteger(e.maxGuests) && e.maxGuests > 0 ? e.maxGuests : e.baseGuests,
        extraGuestPriceCents: e.extraGuestPriceCents,
        extraGuestCostCents: e.extraGuestCostCents,
        costComponents: e.costComponents.map((c) => ({
          category: c.category,
          description: c.description,
          amountCents: c.amountCents,
          perGuest: c.perGuest,
        })),
      },
      guestCount: e.baseGuests,
      menu: menu ?? null,
      settings,
    });
  } catch {
    return null;
  }

  const costBreakdown = (Object.entries(result.costBreakdown) as Array<[CostCategory, number]>)
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, cents]) => ({ category, cents }));

  return {
    guestCount: result.guestCount,
    totalCents: result.totalCents,
    netRevenueCents: result.netRevenueCents,
    taxCents: result.taxCents,
    estimatedCostCents: result.estimatedCostCents,
    paymentFeeCents: result.paymentFeeCents,
    marginCents: result.estimatedMarginCents,
    marginBps: result.marginBps,
    minMarginBps: settings.minMarginBps,
    level: marginLevel(result.estimatedMarginCents, result.marginBps, settings.minMarginBps),
    menuName: menu?.name ?? null,
    costBreakdown,
  };
}

/** Menú de referencia para la estimación: el primer menú INCLUIDO (entra en el precio base). */
export function pickReferenceMenu<M extends { pricingType: EngineMenu["pricingType"]; active?: boolean }>(
  menus: readonly M[],
): M | null {
  return menus.find((m) => m.pricingType === "INCLUDED" && m.active !== false) ?? null;
}

/** Margen unitario de un add-on (sin impuestos ni comisiones) para la lista admin. */
export function addOnUnitMarginBps(
  priceCents: number,
  costCents: number,
  settings: Pick<EngineSettings, "pricesIncludeTax" | "taxRateBps">,
): number | null {
  if (priceCents <= 0) return null;
  const net = settings.pricesIncludeTax ? Math.round((priceCents * 10_000) / (10_000 + settings.taxRateBps)) : priceCents;
  if (net <= 0) return null;
  return Math.round(((net - costCents) / net) * 10_000);
}
