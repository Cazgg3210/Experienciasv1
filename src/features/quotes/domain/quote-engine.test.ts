import { describe, expect, it } from "vitest";
import {
  calculateFromLines,
  calculateQuote,
  QuoteEngineError,
  type EngineExperience,
  type EngineSettings,
} from "./quote-engine";

const settings: EngineSettings = {
  taxRateBps: 1600,
  pricesIncludeTax: true,
  depositBps: 5000,
  paymentFeeBps: 360,
  paymentFeeFixedCents: 300,
  minMarginBps: 3500,
  maxStandardGuests: 12,
};

const experience: EngineExperience = {
  id: "exp_1",
  name: "Signature Brunch",
  basePriceCents: 1_490_000, // $14,900 para 6
  baseGuests: 6,
  minGuests: 6,
  maxGuests: 12,
  extraGuestPriceCents: 165_000,
  extraGuestCostCents: 75_000,
  costComponents: [
    { category: "FOOD", amountCents: 45_000, perGuest: true }, // 6 x 450 = 2,700
    { category: "FLOWERS", amountCents: 120_000, perGuest: false },
    { category: "STAFF", amountCents: 180_000, perGuest: false },
    { category: "CONSUMABLES", amountCents: 8_000, perGuest: true }, // 6 x 80 = 480
    { category: "TRANSPORT", amountCents: 50_000, perGuest: false },
  ],
};

describe("QuoteEngine.calculateQuote", () => {
  it("cotiza precio base para los invitados incluidos", () => {
    const r = calculateQuote({ experience, guestCount: 6, settings });
    expect(r.subtotalCents).toBe(1_490_000);
    expect(r.extraGuests).toBe(0);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.totalCostCents).toBe(270_000 + 120_000 + 180_000 + 48_000 + 50_000);
    expect(r.totalCents).toBe(1_490_000);
  });

  it("desglosa IVA incluido en el precio (16%)", () => {
    const r = calculateQuote({ experience, guestCount: 6, settings });
    // 14,900 / 1.16 = 12,844.83 => IVA 2,055.17
    expect(r.taxCents).toBe(205_517);
    expect(r.netRevenueCents).toBe(1_490_000 - 205_517);
  });

  it("suma IVA cuando los precios no lo incluyen", () => {
    const r = calculateQuote({ experience, guestCount: 6, settings: { ...settings, pricesIncludeTax: false } });
    expect(r.taxCents).toBe(238_400);
    expect(r.totalCents).toBe(1_728_400);
    expect(r.netRevenueCents).toBe(1_490_000);
  });

  it("cobra invitados adicionales sobre la base", () => {
    const r = calculateQuote({ experience, guestCount: 10, settings });
    const extra = r.lines.find((l) => l.type === "EXTRA_GUEST")!;
    expect(r.extraGuests).toBe(4);
    expect(extra.quantity).toBe(4);
    expect(extra.totalPriceCents).toBe(660_000);
    expect(extra.totalCostCents).toBe(300_000);
    expect(r.subtotalCents).toBe(1_490_000 + 660_000);
  });

  it("cobra al menos el precio base aunque vengan menos invitados y advierte", () => {
    const r = calculateQuote({ experience, guestCount: 4, settings });
    expect(r.subtotalCents).toBe(1_490_000);
    expect(r.billableGuests).toBe(6);
    expect(r.warnings.map((w) => w.code)).toContain("GUESTS_BELOW_MINIMUM");
  });

  it("marca consulta especial cuando supera el máximo estándar", () => {
    const r = calculateQuote({ experience, guestCount: 15, settings });
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain("SPECIAL_REQUEST_GUESTS");
    expect(codes).toContain("GUESTS_ABOVE_EXPERIENCE_MAX");
  });

  it("menú incluido no cambia el precio pero sí el costo", () => {
    const r = calculateQuote({
      experience,
      guestCount: 8,
      settings,
      menu: { id: "m1", name: "Clásico", pricingType: "INCLUDED", priceCents: 0, costPerGuestCents: 20_000 },
    });
    const menu = r.lines.find((l) => l.type === "MENU")!;
    expect(menu.totalPriceCents).toBe(0);
    expect(menu.totalCostCents).toBe(160_000);
  });

  it("menú upgrade por persona se multiplica por invitados facturables", () => {
    const r = calculateQuote({
      experience,
      guestCount: 8,
      settings,
      menu: { id: "m2", name: "Premium", pricingType: "PER_GUEST", priceCents: 38_000, costPerGuestCents: 30_000 },
    });
    const menu = r.lines.find((l) => l.type === "MENU")!;
    expect(menu.quantity).toBe(8);
    expect(menu.totalPriceCents).toBe(304_000);
    expect(menu.totalCostCents).toBe(240_000);
  });

  it("add-ons fijos y por persona", () => {
    const r = calculateQuote({
      experience,
      guestCount: 8,
      settings,
      addOns: [
        { id: "a1", name: "Karaoke", pricingType: "FLAT", priceCents: 250_000, costCents: 90_000, costCategory: "VENDOR", quantity: 1 },
        { id: "a2", name: "Mimosa bar", pricingType: "PER_GUEST", priceCents: 18_000, costCents: 7_000, costCategory: "FOOD", quantity: 1 },
      ],
    });
    const addOns = r.lines.filter((l) => l.type === "ADDON");
    expect(addOns[0]!.totalPriceCents).toBe(250_000);
    expect(addOns[1]!.quantity).toBe(8);
    expect(addOns[1]!.totalPriceCents).toBe(144_000);
    expect(r.costBreakdown.VENDOR).toBe(90_000);
  });

  it("limita la cantidad de un add-on a su máximo", () => {
    const r = calculateQuote({
      experience,
      guestCount: 6,
      settings,
      addOns: [{ id: "a1", name: "Pastel", pricingType: "FLAT", priceCents: 100_000, costCents: 40_000, costCategory: "VENDOR", quantity: 5, maxQuantity: 2 }],
    });
    expect(r.lines.find((l) => l.type === "ADDON")!.quantity).toBe(2);
    expect(r.warnings.map((w) => w.code)).toContain("ADDON_QUANTITY_CAPPED");
  });

  it("agrega logística de la zona como línea y costo de transporte", () => {
    const r = calculateQuote({
      experience,
      guestCount: 6,
      settings,
      serviceArea: { id: "z1", name: "Polanco", logisticsFeeCents: 35_000, logisticsCostCents: 25_000 },
    });
    expect(r.logisticsCents).toBe(35_000);
    expect(r.subtotalCents).toBe(1_525_000);
    expect(r.costBreakdown.TRANSPORT).toBe(50_000 + 25_000);
  });

  it("aplica descuento porcentual y por monto", () => {
    const pct = calculateQuote({ experience, guestCount: 6, settings, discount: { type: "PERCENT", value: 1000 } });
    expect(pct.discountCents).toBe(149_000);
    expect(pct.totalCents).toBe(1_341_000);
    const amt = calculateQuote({ experience, guestCount: 6, settings, discount: { type: "AMOUNT", value: 50_000 } });
    expect(amt.discountCents).toBe(50_000);
    expect(amt.totalCents).toBe(1_440_000);
  });

  it("nunca permite descuentos mayores al subtotal", () => {
    const r = calculateQuote({ experience, guestCount: 6, settings, discount: { type: "AMOUNT", value: 99_999_999 } });
    expect(r.discountCents).toBe(r.subtotalCents);
    expect(r.totalCents).toBe(0);
    expect(r.paymentFeeCents).toBe(0);
    expect(r.warnings.map((w) => w.code)).toContain("DISCOUNT_CAPPED");
  });

  it("calcula comisión de pago, costo total y margen sobre ingreso neto", () => {
    const r = calculateQuote({ experience, guestCount: 6, settings });
    const fee = Math.round((1_490_000 * 360) / 10_000) + 300;
    expect(r.paymentFeeCents).toBe(fee);
    expect(r.estimatedCostCents).toBe(668_000 + fee);
    expect(r.estimatedMarginCents).toBe(r.netRevenueCents - r.estimatedCostCents);
    expect(r.marginBps).toBe(Math.round((r.estimatedMarginCents / r.netRevenueCents) * 10_000));
  });

  it("alerta márgenes bajo el mínimo y negativos (sin ocultarlos)", () => {
    const low = calculateQuote({ experience, guestCount: 6, settings, discount: { type: "PERCENT", value: 3000 } });
    expect(low.belowMinMargin).toBe(true);
    expect(low.warnings.map((w) => w.code)).toContain("MARGIN_BELOW_MINIMUM");
    const negative = calculateQuote({ experience, guestCount: 6, settings, discount: { type: "PERCENT", value: 6000 } });
    expect(negative.estimatedMarginCents).toBeLessThan(0);
    expect(negative.warnings.map((w) => w.code)).toContain("NEGATIVE_MARGIN");
  });

  it("calcula anticipo y saldo; permite sobrescribir el % de anticipo", () => {
    const r = calculateQuote({ experience, guestCount: 6, settings });
    expect(r.depositCents).toBe(745_000);
    expect(r.balanceCents).toBe(745_000);
    const full = calculateQuote({ experience, guestCount: 6, settings, depositBps: 10_000 });
    expect(full.depositCents).toBe(full.totalCents);
    expect(full.balanceCents).toBe(0);
  });

  it("la suma de líneas siempre cuadra con el subtotal", () => {
    const r = calculateQuote({
      experience,
      guestCount: 11,
      settings,
      menu: { id: "m2", name: "Premium", pricingType: "PER_GUEST", priceCents: 38_000, costPerGuestCents: 30_000 },
      addOns: [{ id: "a2", name: "Mimosa bar", pricingType: "PER_GUEST", priceCents: 18_000, costCents: 7_000, costCategory: "FOOD", quantity: 1 }],
      serviceArea: { id: "z1", name: "Irrigación", logisticsFeeCents: 45_000, logisticsCostCents: 30_000 },
      customItems: [{ description: "Letrero neón", quantity: 1, unitPriceCents: 120_000, unitCostCents: 60_000 }],
    });
    expect(r.lines.reduce((s, l) => s + l.totalPriceCents, 0)).toBe(r.subtotalCents);
    expect(Object.values(r.costBreakdown).reduce((s, v) => s + v, 0)).toBe(r.estimatedCostCents);
  });

  it("rechaza entradas inválidas", () => {
    expect(() => calculateQuote({ experience, guestCount: 0, settings })).toThrow(QuoteEngineError);
    expect(() => calculateQuote({ experience: { ...experience, basePriceCents: -1 }, guestCount: 6, settings })).toThrow(QuoteEngineError);
    expect(() => calculateQuote({ experience, guestCount: 2.5, settings })).toThrow(QuoteEngineError);
  });
});

describe("QuoteEngine.calculateFromLines", () => {
  it("recalcula totales tras edición manual de líneas", () => {
    const r = calculateFromLines({
      guestCount: 8,
      settings,
      discount: { type: "AMOUNT", value: 100_000 },
      lines: [
        { type: "BASE_EXPERIENCE", refId: "exp_1", description: "Base", quantity: 1, unitPriceCents: 1_490_000, unitCostCents: 668_000, costCategory: "FOOD" },
        { type: "CUSTOM", refId: null, description: "Extra", quantity: 2, unitPriceCents: 50_000, unitCostCents: 20_000, costCategory: "OTHER" },
      ],
    });
    expect(r.subtotalCents).toBe(1_590_000);
    expect(r.totalCents).toBe(1_490_000);
    expect(r.costBreakdown.OTHER).toBe(40_000);
    expect(r.depositCents).toBe(745_000);
  });
});
