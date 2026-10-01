import { describe, expect, it } from "vitest";
import type { EngineSettings } from "@/features/quotes/domain/quote-engine";
import { addOnUnitMarginBps, marginLevel, pickReferenceMenu, previewExperienceMargin } from "./margin-preview";

const settings: EngineSettings = {
  taxRateBps: 1600,
  pricesIncludeTax: true,
  depositBps: 5000,
  paymentFeeBps: 360,
  paymentFeeFixedCents: 300,
  minMarginBps: 3500,
  maxStandardGuests: 12,
};

const experience = {
  name: "Brunch Floral",
  basePriceCents: 11_600_00, // $11,600 IVA incl. → neto $10,000
  baseGuests: 6,
  minGuests: 6,
  maxGuests: 12,
  extraGuestPriceCents: 1_200_00,
  extraGuestCostCents: 450_00,
  costComponents: [
    { category: "FLOWERS" as const, amountCents: 1_500_00, perGuest: false },
    { category: "STAFF" as const, amountCents: 200_00, perGuest: true },
  ],
};

describe("previewExperienceMargin", () => {
  it("computes cost and margin for base guests with the QuoteEngine", () => {
    const p = previewExperienceMargin(experience, settings);
    expect(p).not.toBeNull();
    expect(p!.guestCount).toBe(6);
    expect(p!.totalCents).toBe(11_600_00);
    expect(p!.netRevenueCents).toBe(10_000_00);
    // flores 1,500 + staff 200×6 = 2,700 + comisión 3.6% de 11,600 (417.60) + $3 = 420.60
    expect(p!.paymentFeeCents).toBe(420_60);
    expect(p!.estimatedCostCents).toBe(2_700_00 + 420_60);
    expect(p!.marginCents).toBe(10_000_00 - 3_120_60);
    expect(p!.level).toBe("healthy");
    expect(p!.costBreakdown[0]).toEqual({ category: "FLOWERS", cents: 1_500_00 });
  });

  it("adds the reference menu food cost per guest", () => {
    const withMenu = previewExperienceMargin(experience, settings, {
      id: "m1",
      name: "Brunch Clásico",
      pricingType: "INCLUDED",
      priceCents: 0,
      costPerGuestCents: 190_00,
    });
    const base = previewExperienceMargin(experience, settings)!;
    expect(withMenu!.estimatedCostCents - base.estimatedCostCents).toBe(190_00 * 6);
    expect(withMenu!.menuName).toBe("Brunch Clásico");
  });

  it("flags low and negative margins", () => {
    const low = previewExperienceMargin(
      { ...experience, costComponents: [{ category: "FOOD", amountCents: 6_200_00, perGuest: false }] },
      settings,
    );
    expect(low!.level).toBe("low");
    const negative = previewExperienceMargin(
      { ...experience, costComponents: [{ category: "FOOD", amountCents: 12_000_00, perGuest: false }] },
      settings,
    );
    expect(negative!.level).toBe("negative");
    expect(negative!.marginCents).toBeLessThan(0);
  });

  it("returns null with incomplete form data instead of throwing", () => {
    expect(previewExperienceMargin({ ...experience, basePriceCents: Number.NaN }, settings)).toBeNull();
    expect(previewExperienceMargin({ ...experience, baseGuests: 0 }, settings)).toBeNull();
    expect(previewExperienceMargin({ ...experience, basePriceCents: 0 }, settings)).toBeNull();
    expect(
      previewExperienceMargin({ ...experience, costComponents: [{ category: "FOOD", amountCents: -1, perGuest: false }] }, settings),
    ).toBeNull();
  });
});

describe("marginLevel", () => {
  it("classifies margins", () => {
    expect(marginLevel(-1, -10, 3500)).toBe("negative");
    expect(marginLevel(100, 3000, 3500)).toBe("low");
    expect(marginLevel(100, 3500, 3500)).toBe("healthy");
  });
});

describe("pickReferenceMenu", () => {
  it("picks the first active INCLUDED menu", () => {
    const menus = [
      { id: "a", pricingType: "PER_GUEST" as const, active: true },
      { id: "b", pricingType: "INCLUDED" as const, active: false },
      { id: "c", pricingType: "INCLUDED" as const, active: true },
    ];
    expect(pickReferenceMenu(menus)?.id).toBe("c");
    expect(pickReferenceMenu([{ id: "x", pricingType: "FLAT" as const }])).toBeNull();
  });
});

describe("addOnUnitMarginBps", () => {
  it("computes the unit margin net of VAT", () => {
    // $1,160 IVA incl. → $1,000 neto; costo $400 → 60%
    expect(addOnUnitMarginBps(1_160_00, 400_00, settings)).toBe(6000);
  });
  it("handles prices without tax and zero prices", () => {
    expect(addOnUnitMarginBps(1_000_00, 400_00, { pricesIncludeTax: false, taxRateBps: 1600 })).toBe(6000);
    expect(addOnUnitMarginBps(0, 100, settings)).toBeNull();
  });
});
