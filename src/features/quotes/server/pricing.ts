import "server-only";
import { prisma } from "@/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { getSettings } from "@/features/settings/server/settings-service";
import type { PricingSettings } from "@/features/settings/domain/settings-schema";
import {
  calculateQuote,
  type EngineDiscount,
  type EngineSettings,
  type QuoteEngineInput,
  type QuoteResult,
} from "../domain/quote-engine";

/**
 * Puente catálogo (DB) → QuoteEngine (dominio puro). Toda estimación de precio del sistema
 * (configurador, IA, cotizaciones admin) pasa por aquí: las reglas viven en servidor.
 */
export type PricingSelection = {
  experienceId: string;
  guestCount: number;
  menuId?: string | null;
  addOns?: Array<{ addOnId: string; quantity: number }>;
  serviceAreaId?: string | null;
  discount?: EngineDiscount | null;
  depositBps?: number;
  customItems?: QuoteEngineInput["customItems"];
};

export function toEngineSettings(p: PricingSettings): EngineSettings {
  return {
    taxRateBps: p.taxRateBps,
    pricesIncludeTax: p.pricesIncludeTax,
    depositBps: p.depositBps,
    paymentFeeBps: p.paymentFeeBps,
    paymentFeeFixedCents: p.paymentFeeFixedCents,
    minMarginBps: p.minMarginBps,
    maxStandardGuests: p.maxStandardGuests,
  };
}

/**
 * Carga catálogo y arma el input del motor.
 * - `publicOnly`: sólo elementos activos y compatibles con la experiencia (configurador/IA).
 * - Admin puede cotizar elementos inactivos o fuera de la combinación estándar.
 */
export async function buildEngineInput(
  sel: PricingSelection,
  opts: { publicOnly?: boolean } = {},
): Promise<QuoteEngineInput> {
  const publicOnly = opts.publicOnly ?? true;
  const experience = await prisma.experience.findUnique({
    where: { id: sel.experienceId },
    include: {
      costComponents: true,
      menus: { select: { id: true } },
      addOns: { select: { id: true } },
      serviceAreas: { select: { id: true } },
    },
  });
  if (!experience || (publicOnly && !experience.active)) throw new NotFoundError("La experiencia no está disponible.");

  let menu: QuoteEngineInput["menu"] = null;
  if (sel.menuId) {
    const m = await prisma.menu.findUnique({ where: { id: sel.menuId } });
    if (!m || (publicOnly && !m.active)) throw new AppError("El menú seleccionado no está disponible.");
    if (publicOnly && !experience.menus.some((x) => x.id === m.id)) {
      throw new AppError("Ese menú no es compatible con la experiencia.");
    }
    menu = {
      id: m.id,
      name: m.name,
      pricingType: m.pricingType,
      priceCents: m.priceCents,
      costPerGuestCents: m.costPerGuestCents,
    };
  }

  const addOnSel = (sel.addOns ?? []).filter((a) => a.quantity > 0);
  const addOnRows = addOnSel.length
    ? await prisma.addOn.findMany({ where: { id: { in: addOnSel.map((a) => a.addOnId) } } })
    : [];
  const addOns: NonNullable<QuoteEngineInput["addOns"]> = [];
  for (const a of addOnSel) {
    const row = addOnRows.find((r) => r.id === a.addOnId);
    if (!row || (publicOnly && !row.active)) throw new AppError("Uno de los extras ya no está disponible.");
    if (publicOnly && !experience.addOns.some((x) => x.id === row.id)) {
      throw new AppError(`"${row.name}" no está disponible para esta experiencia.`);
    }
    addOns.push({
      id: row.id,
      name: row.name,
      pricingType: row.pricingType,
      priceCents: row.priceCents,
      costCents: row.costCents,
      costCategory: row.costCategory,
      quantity: a.quantity,
      maxQuantity: row.maxQuantity,
    });
  }

  let serviceArea: QuoteEngineInput["serviceArea"] = null;
  if (sel.serviceAreaId) {
    const z = await prisma.serviceArea.findUnique({ where: { id: sel.serviceAreaId } });
    if (z && (!publicOnly || z.active)) {
      serviceArea = {
        id: z.id,
        name: z.name,
        logisticsFeeCents: z.logisticsFeeCents,
        logisticsCostCents: z.logisticsCostCents,
      };
    }
  }

  const pricing = await getSettings("pricing");
  return {
    experience: {
      id: experience.id,
      name: experience.name,
      basePriceCents: experience.basePriceCents,
      baseGuests: experience.baseGuests,
      minGuests: experience.minGuests,
      maxGuests: experience.maxGuests,
      extraGuestPriceCents: experience.extraGuestPriceCents,
      extraGuestCostCents: experience.extraGuestCostCents,
      costComponents: experience.costComponents.map((c) => ({
        category: c.category,
        description: c.description,
        amountCents: c.amountCents,
        perGuest: c.perGuest,
      })),
    },
    guestCount: sel.guestCount,
    menu,
    addOns,
    serviceArea,
    customItems: sel.customItems,
    discount: sel.discount ?? null,
    depositBps: sel.depositBps,
    settings: toEngineSettings(pricing),
  };
}

/** Estimación completa (servidor). */
export async function estimateSelection(
  sel: PricingSelection,
  opts: { publicOnly?: boolean } = {},
): Promise<{ input: QuoteEngineInput; result: QuoteResult }> {
  const input = await buildEngineInput(sel, opts);
  return { input, result: calculateQuote(input) };
}

/** Vista pública segura del estimado (sin costos ni márgenes). */
export function publicEstimate(result: QuoteResult) {
  return {
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
    warnings: result.warnings
      .filter((w) => ["GUESTS_BELOW_MINIMUM", "GUESTS_ABOVE_EXPERIENCE_MAX", "SPECIAL_REQUEST_GUESTS", "ADDON_QUANTITY_CAPPED"].includes(w.code))
      .map((w) => w.message),
  };
}
export type PublicEstimate = ReturnType<typeof publicEstimate>;
