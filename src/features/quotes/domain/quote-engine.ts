/**
 * QuoteEngine — servicio de dominio PURO (sin I/O) que calcula una cotización.
 * Las reglas de precio viven en el servidor: el frontend sólo muestra lo que devuelve este motor.
 *
 * Convenciones:
 *  - Todo en centavos MXN (enteros). Porcentajes en bps (1600 = 16%).
 *  - Si `pricesIncludeTax` es true (default B2C en México), el IVA ya está incluido en los precios
 *    de catálogo y se desglosa informativamente; si es false, se suma al final.
 *  - El margen se calcula sobre el ingreso NETO de impuestos.
 */

export const PRICING_VERSION = "2026.09";

export type CostCategory =
  | "FOOD"
  | "FLOWERS"
  | "STAFF"
  | "TRANSPORT"
  | "VENDOR"
  | "CONSUMABLES"
  | "PAYMENT_FEE"
  | "OTHER";

export type QuoteLineType =
  | "BASE_EXPERIENCE"
  | "EXTRA_GUEST"
  | "MENU"
  | "ADDON"
  | "LOGISTICS"
  | "CUSTOM";

export type EngineExperience = {
  id: string;
  name: string;
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  extraGuestPriceCents: number;
  extraGuestCostCents: number;
  costComponents: Array<{
    category: CostCategory;
    description?: string;
    amountCents: number;
    perGuest: boolean;
  }>;
};

export type EngineMenu = {
  id: string;
  name: string;
  pricingType: "INCLUDED" | "PER_GUEST" | "FLAT";
  priceCents: number;
  costPerGuestCents: number;
};

export type EngineAddOn = {
  id: string;
  name: string;
  pricingType: "FLAT" | "PER_GUEST";
  priceCents: number;
  costCents: number;
  costCategory: CostCategory;
  quantity: number;
  maxQuantity?: number;
};

export type EngineServiceArea = {
  id: string;
  name: string;
  logisticsFeeCents: number;
  logisticsCostCents: number;
};

export type EngineCustomItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  costCategory?: CostCategory;
};

export type EngineDiscount =
  | { type: "PERCENT"; value: number /* bps */; reason?: string }
  | { type: "AMOUNT"; value: number /* cents */; reason?: string };

export type EngineSettings = {
  taxRateBps: number;
  pricesIncludeTax: boolean;
  depositBps: number;
  paymentFeeBps: number;
  paymentFeeFixedCents: number;
  minMarginBps: number;
  maxStandardGuests: number;
};

export type QuoteEngineInput = {
  experience: EngineExperience;
  guestCount: number;
  menu?: EngineMenu | null;
  addOns?: EngineAddOn[];
  serviceArea?: EngineServiceArea | null;
  customItems?: EngineCustomItem[];
  discount?: EngineDiscount | null;
  /** Sobrescribe el depósito por cotización (bps). */
  depositBps?: number;
  settings: EngineSettings;
};

export type QuoteLine = {
  type: QuoteLineType;
  refId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  unitCostCents: number;
  totalCostCents: number;
  costCategory: CostCategory;
};

export type QuoteWarningCode =
  | "GUESTS_BELOW_MINIMUM"
  | "GUESTS_ABOVE_EXPERIENCE_MAX"
  | "SPECIAL_REQUEST_GUESTS"
  | "MARGIN_BELOW_MINIMUM"
  | "NEGATIVE_MARGIN"
  | "DISCOUNT_CAPPED"
  | "ADDON_QUANTITY_CAPPED";

export type QuoteWarning = { code: QuoteWarningCode; message: string };

export type QuoteResult = {
  pricingVersion: string;
  guestCount: number;
  billableGuests: number;
  extraGuests: number;
  lines: QuoteLine[];
  /** Suma de líneas (antes de descuento) */
  subtotalCents: number;
  logisticsCents: number;
  discountCents: number;
  /** Subtotal - descuento (base sobre la que se calcula/desglosa el IVA) */
  discountedSubtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Ingreso neto de impuestos */
  netRevenueCents: number;
  /** Costo directo (líneas) + comisión estimada de pago */
  estimatedCostCents: number;
  paymentFeeCents: number;
  costBreakdown: Record<CostCategory, number>;
  estimatedMarginCents: number;
  marginBps: number;
  belowMinMargin: boolean;
  depositBps: number;
  depositCents: number;
  balanceCents: number;
  warnings: QuoteWarning[];
};

export class QuoteEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteEngineError";
  }
}

function round(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

function assertInt(name: string, value: number, min = 0) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min) {
    throw new QuoteEngineError(`${name} inválido: ${value}`);
  }
}

const emptyBreakdown = (): Record<CostCategory, number> => ({
  FOOD: 0,
  FLOWERS: 0,
  STAFF: 0,
  TRANSPORT: 0,
  VENDOR: 0,
  CONSUMABLES: 0,
  PAYMENT_FEE: 0,
  OTHER: 0,
});

export function calculateQuote(input: QuoteEngineInput): QuoteResult {
  const { experience: exp, settings } = input;
  const guestCount = input.guestCount;
  assertInt("guestCount", guestCount, 1);
  assertInt("basePriceCents", exp.basePriceCents);
  assertInt("baseGuests", exp.baseGuests, 1);
  assertInt("extraGuestPriceCents", exp.extraGuestPriceCents);
  assertInt("extraGuestCostCents", exp.extraGuestCostCents);

  const warnings: QuoteWarning[] = [];
  const lines: QuoteLine[] = [];

  // Se cobra mínimo el número de invitados base (precio base incluye baseGuests).
  const billableGuests = Math.max(guestCount, exp.baseGuests);
  const extraGuests = Math.max(0, guestCount - exp.baseGuests);

  if (guestCount < exp.minGuests) {
    warnings.push({
      code: "GUESTS_BELOW_MINIMUM",
      message: `La experiencia está pensada para mínimo ${exp.minGuests} personas; se cotiza el precio base.`,
    });
  }
  if (guestCount > exp.maxGuests) {
    warnings.push({
      code: "GUESTS_ABOVE_EXPERIENCE_MAX",
      message: `Más de ${exp.maxGuests} personas requiere validación del equipo.`,
    });
  }
  if (guestCount > settings.maxStandardGuests) {
    warnings.push({
      code: "SPECIAL_REQUEST_GUESTS",
      message: `Grupos de más de ${settings.maxStandardGuests} personas son consulta especial.`,
    });
  }

  // 1) Experiencia base: costo = componentes (perGuest se multiplica por invitados facturables)
  const baseCostByCategory = emptyBreakdown();
  let baseCost = 0;
  for (const c of exp.costComponents) {
    assertInt("costComponent.amountCents", c.amountCents);
    // perGuest: costo para los invitados incluidos en la base; los extra se cubren con extraGuestCost
    const amount = c.perGuest ? c.amountCents * Math.min(billableGuests, exp.baseGuests) : c.amountCents;
    baseCostByCategory[c.category] += amount;
    baseCost += amount;
  }
  lines.push({
    type: "BASE_EXPERIENCE",
    refId: exp.id,
    description: `${exp.name} (incluye ${exp.baseGuests} personas)`,
    quantity: 1,
    unitPriceCents: exp.basePriceCents,
    totalPriceCents: exp.basePriceCents,
    unitCostCents: baseCost,
    totalCostCents: baseCost,
    costCategory: dominantCategory(baseCostByCategory),
  });

  // 2) Invitados adicionales
  if (extraGuests > 0) {
    lines.push({
      type: "EXTRA_GUEST",
      refId: exp.id,
      description: `Invitada adicional (${extraGuests})`,
      quantity: extraGuests,
      unitPriceCents: exp.extraGuestPriceCents,
      totalPriceCents: exp.extraGuestPriceCents * extraGuests,
      unitCostCents: exp.extraGuestCostCents,
      totalCostCents: exp.extraGuestCostCents * extraGuests,
      costCategory: "FOOD",
    });
  }

  // 3) Menú: el costo de comida del menú se suma por invitada; el precio depende del tipo
  if (input.menu) {
    const m = input.menu;
    assertInt("menu.priceCents", m.priceCents);
    assertInt("menu.costPerGuestCents", m.costPerGuestCents);
    const qty = m.pricingType === "PER_GUEST" ? billableGuests : 1;
    const unitPrice = m.pricingType === "INCLUDED" ? 0 : m.priceCents;
    const totalCost = m.costPerGuestCents * billableGuests;
    lines.push({
      type: "MENU",
      refId: m.id,
      description:
        m.pricingType === "INCLUDED"
          ? `Menú: ${m.name} (incluido)`
          : m.pricingType === "PER_GUEST"
            ? `Menú: ${m.name} (upgrade por persona)`
            : `Menú: ${m.name} (upgrade)`,
      quantity: qty,
      unitPriceCents: unitPrice,
      totalPriceCents: unitPrice * qty,
      unitCostCents: qty > 0 ? round(totalCost / qty) : 0,
      totalCostCents: totalCost,
      costCategory: "FOOD",
    });
  }

  // 4) Add-ons
  for (const a of input.addOns ?? []) {
    assertInt("addOn.priceCents", a.priceCents);
    assertInt("addOn.costCents", a.costCents);
    assertInt("addOn.quantity", a.quantity, 1);
    let units = a.quantity;
    if (a.maxQuantity && units > a.maxQuantity) {
      units = a.maxQuantity;
      warnings.push({
        code: "ADDON_QUANTITY_CAPPED",
        message: `${a.name}: cantidad máxima ${a.maxQuantity}.`,
      });
    }
    const qty = a.pricingType === "PER_GUEST" ? billableGuests * units : units;
    lines.push({
      type: "ADDON",
      refId: a.id,
      description: a.pricingType === "PER_GUEST" ? `${a.name} (por persona)` : a.name,
      quantity: qty,
      unitPriceCents: a.priceCents,
      totalPriceCents: a.priceCents * qty,
      unitCostCents: a.costCents,
      totalCostCents: a.costCents * qty,
      costCategory: a.costCategory,
    });
  }

  // 5) Logística por zona
  let logisticsCents = 0;
  if (input.serviceArea) {
    const z = input.serviceArea;
    assertInt("logisticsFeeCents", z.logisticsFeeCents);
    assertInt("logisticsCostCents", z.logisticsCostCents);
    logisticsCents = z.logisticsFeeCents;
    if (z.logisticsFeeCents > 0 || z.logisticsCostCents > 0) {
      lines.push({
        type: "LOGISTICS",
        refId: z.id,
        description: `Logística y traslado — ${z.name}`,
        quantity: 1,
        unitPriceCents: z.logisticsFeeCents,
        totalPriceCents: z.logisticsFeeCents,
        unitCostCents: z.logisticsCostCents,
        totalCostCents: z.logisticsCostCents,
        costCategory: "TRANSPORT",
      });
    }
  }

  // 6) Conceptos personalizados (admin)
  for (const c of input.customItems ?? []) {
    assertInt("custom.quantity", c.quantity, 1);
    assertInt("custom.unitPriceCents", c.unitPriceCents);
    assertInt("custom.unitCostCents", c.unitCostCents);
    lines.push({
      type: "CUSTOM",
      refId: null,
      description: c.description,
      quantity: c.quantity,
      unitPriceCents: c.unitPriceCents,
      totalPriceCents: c.unitPriceCents * c.quantity,
      unitCostCents: c.unitCostCents,
      totalCostCents: c.unitCostCents * c.quantity,
      costCategory: c.costCategory ?? "OTHER",
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.totalPriceCents, 0);

  // 7) Descuento (nunca mayor al subtotal)
  let discountCents = 0;
  if (input.discount && input.discount.value > 0) {
    const d = input.discount;
    if (d.type === "PERCENT") {
      assertInt("discount.bps", d.value);
      const bps = Math.min(d.value, 10_000);
      discountCents = round((subtotalCents * bps) / 10_000);
    } else {
      assertInt("discount.cents", d.value);
      discountCents = d.value;
    }
    if (discountCents > subtotalCents) {
      discountCents = subtotalCents;
      warnings.push({ code: "DISCOUNT_CAPPED", message: "El descuento se limitó al subtotal." });
    }
  }
  const discountedSubtotalCents = subtotalCents - discountCents;

  // 8) Impuestos
  let taxCents: number;
  let totalCents: number;
  if (settings.pricesIncludeTax) {
    totalCents = discountedSubtotalCents;
    taxCents = round(totalCents - (totalCents * 10_000) / (10_000 + settings.taxRateBps));
  } else {
    taxCents = round((discountedSubtotalCents * settings.taxRateBps) / 10_000);
    totalCents = discountedSubtotalCents + taxCents;
  }
  const netRevenueCents = totalCents - taxCents;

  // 9) Costos: líneas + comisión de la pasarela sobre el total cobrado
  const costBreakdown = emptyBreakdown();
  for (const l of lines) {
    if (l.type === "BASE_EXPERIENCE") {
      for (const [k, v] of Object.entries(baseCostByCategory) as Array<[CostCategory, number]>) costBreakdown[k] += v;
    } else {
      costBreakdown[l.costCategory] += l.totalCostCents;
    }
  }
  const paymentFeeCents =
    totalCents > 0 ? round((totalCents * settings.paymentFeeBps) / 10_000) + settings.paymentFeeFixedCents : 0;
  costBreakdown.PAYMENT_FEE += paymentFeeCents;
  const estimatedCostCents = Object.values(costBreakdown).reduce((s, v) => s + v, 0);

  const estimatedMarginCents = netRevenueCents - estimatedCostCents;
  const marginBps = netRevenueCents > 0 ? Math.round((estimatedMarginCents / netRevenueCents) * 10_000) : 0;
  const belowMinMargin = marginBps < settings.minMarginBps;
  if (estimatedMarginCents < 0) {
    warnings.push({ code: "NEGATIVE_MARGIN", message: "El margen estimado es negativo." });
  } else if (belowMinMargin) {
    warnings.push({
      code: "MARGIN_BELOW_MINIMUM",
      message: `Margen estimado por debajo del mínimo configurado (${(settings.minMarginBps / 100).toFixed(0)}%).`,
    });
  }

  // 10) Anticipo
  const depositBps = clampBps(input.depositBps ?? settings.depositBps);
  const depositCents = round((totalCents * depositBps) / 10_000);
  const balanceCents = totalCents - depositCents;

  return {
    pricingVersion: PRICING_VERSION,
    guestCount,
    billableGuests,
    extraGuests,
    lines,
    subtotalCents,
    logisticsCents,
    discountCents,
    discountedSubtotalCents,
    taxCents,
    totalCents,
    netRevenueCents,
    estimatedCostCents,
    paymentFeeCents,
    costBreakdown,
    estimatedMarginCents,
    marginBps,
    belowMinMargin,
    depositBps,
    depositCents,
    balanceCents,
    warnings,
  };
}

function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return 5000;
  return Math.max(0, Math.min(10_000, Math.round(bps)));
}

function dominantCategory(breakdown: Record<CostCategory, number>): CostCategory {
  let best: CostCategory = "OTHER";
  let max = -1;
  for (const [k, v] of Object.entries(breakdown) as Array<[CostCategory, number]>) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

/**
 * Recalcula totales a partir de líneas editadas manualmente por el admin (agregar/eliminar
 * conceptos, cambiar cantidades). Reutiliza las mismas reglas de descuento, impuestos y margen.
 */
export function calculateFromLines(params: {
  lines: Array<Omit<QuoteLine, "totalPriceCents" | "totalCostCents"> & { totalCostCents?: number }>;
  discount?: EngineDiscount | null;
  depositBps?: number;
  settings: EngineSettings;
  guestCount: number;
}): QuoteResult {
  const lines: QuoteLine[] = params.lines.map((l) => {
    assertInt("line.quantity", l.quantity, 0);
    assertInt("line.unitPriceCents", l.unitPriceCents);
    assertInt("line.unitCostCents", l.unitCostCents);
    return {
      ...l,
      totalPriceCents: l.unitPriceCents * l.quantity,
      totalCostCents: l.totalCostCents ?? l.unitCostCents * l.quantity,
    };
  });
  const { settings } = params;
  const warnings: QuoteWarning[] = [];
  const subtotalCents = lines.reduce((s, l) => s + l.totalPriceCents, 0);
  const logisticsCents = lines.filter((l) => l.type === "LOGISTICS").reduce((s, l) => s + l.totalPriceCents, 0);
  let discountCents = 0;
  if (params.discount && params.discount.value > 0) {
    discountCents =
      params.discount.type === "PERCENT"
        ? round((subtotalCents * Math.min(params.discount.value, 10_000)) / 10_000)
        : params.discount.value;
    if (discountCents > subtotalCents) {
      discountCents = subtotalCents;
      warnings.push({ code: "DISCOUNT_CAPPED", message: "El descuento se limitó al subtotal." });
    }
  }
  const discountedSubtotalCents = subtotalCents - discountCents;
  let taxCents: number;
  let totalCents: number;
  if (settings.pricesIncludeTax) {
    totalCents = discountedSubtotalCents;
    taxCents = round(totalCents - (totalCents * 10_000) / (10_000 + settings.taxRateBps));
  } else {
    taxCents = round((discountedSubtotalCents * settings.taxRateBps) / 10_000);
    totalCents = discountedSubtotalCents + taxCents;
  }
  const netRevenueCents = totalCents - taxCents;
  const costBreakdown = emptyBreakdown();
  for (const l of lines) costBreakdown[l.costCategory] += l.totalCostCents;
  const paymentFeeCents =
    totalCents > 0 ? round((totalCents * settings.paymentFeeBps) / 10_000) + settings.paymentFeeFixedCents : 0;
  costBreakdown.PAYMENT_FEE += paymentFeeCents;
  const estimatedCostCents = Object.values(costBreakdown).reduce((s, v) => s + v, 0);
  const estimatedMarginCents = netRevenueCents - estimatedCostCents;
  const marginBps = netRevenueCents > 0 ? Math.round((estimatedMarginCents / netRevenueCents) * 10_000) : 0;
  const belowMinMargin = marginBps < settings.minMarginBps;
  if (estimatedMarginCents < 0) warnings.push({ code: "NEGATIVE_MARGIN", message: "El margen estimado es negativo." });
  else if (belowMinMargin)
    warnings.push({
      code: "MARGIN_BELOW_MINIMUM",
      message: `Margen estimado por debajo del mínimo configurado (${(settings.minMarginBps / 100).toFixed(0)}%).`,
    });
  const depositBps = clampBps(params.depositBps ?? settings.depositBps);
  const depositCents = round((totalCents * depositBps) / 10_000);
  return {
    pricingVersion: PRICING_VERSION,
    guestCount: params.guestCount,
    billableGuests: params.guestCount,
    extraGuests: lines.filter((l) => l.type === "EXTRA_GUEST").reduce((s, l) => s + l.quantity, 0),
    lines,
    subtotalCents,
    logisticsCents,
    discountCents,
    discountedSubtotalCents,
    taxCents,
    totalCents,
    netRevenueCents,
    estimatedCostCents,
    paymentFeeCents,
    costBreakdown,
    estimatedMarginCents,
    marginBps,
    belowMinMargin,
    depositBps,
    depositCents,
    balanceCents: totalCents - depositCents,
    warnings,
  };
}
