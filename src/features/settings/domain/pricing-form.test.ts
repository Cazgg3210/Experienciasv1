import { describe, expect, it } from "vitest";
import { bpsToPercent, describePricingChanges, formToPricing, percentToBps, pricingToForm } from "./pricing-form";
import { defaultSettings } from "./settings-schema";
import { resolveFlagState } from "./flags-meta";
import { pricingFormSchema } from "../schemas";

describe("conversión % ↔ bps", () => {
  it("convierte sin errores de punto flotante", () => {
    expect(percentToBps(16)).toBe(1600);
    expect(percentToBps(16.1)).toBe(1610);
    expect(percentToBps(3.6)).toBe(360);
    expect(percentToBps(0.29)).toBe(29);
    expect(bpsToPercent(1600)).toBe(16);
    expect(bpsToPercent(360)).toBe(3.6);
  });

  it("ida y vuelta conserva los valores", () => {
    const s = defaultSettings("pricing");
    const back = formToPricing(pricingToForm(s), s);
    expect(back).toEqual(s);
  });

  it("aplica el formulario y conserva campos desconocidos", () => {
    const s = defaultSettings("pricing");
    const form = { ...pricingToForm(s), taxRatePercent: 8, depositPercent: 40, paymentFeeFixedCents: 450 };
    const next = formToPricing(form, { ...s, extra: 1 } as typeof s);
    expect(next.taxRateBps).toBe(800);
    expect(next.depositBps).toBe(4000);
    expect(next.paymentFeeFixedCents).toBe(450);
    expect((next as unknown as { extra: number }).extra).toBe(1);
  });

  it("describe los cambios", () => {
    const s = defaultSettings("pricing");
    const changes = describePricingChanges(s, { ...s, taxRateBps: 800, pricesIncludeTax: false });
    expect(changes).toEqual(["IVA 16% → 8%", "Los precios ahora son más IVA"]);
    expect(describePricingChanges(s, s)).toEqual([]);
  });
});

describe("pricingFormSchema", () => {
  const valid = pricingToForm(defaultSettings("pricing"));
  it("acepta los defaults", () => {
    expect(pricingFormSchema.safeParse(valid).success).toBe(true);
  });
  it("rechaza máximo menor al mínimo y NaN", () => {
    const r = pricingFormSchema.safeParse({ ...valid, minStandardGuests: 10, maxStandardGuests: 6 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["maxStandardGuests"]);
    expect(pricingFormSchema.safeParse({ ...valid, taxRatePercent: Number.NaN }).success).toBe(false);
    expect(pricingFormSchema.safeParse({ ...valid, depositPercent: 120 }).success).toBe(false);
  });
});

describe("resolveFlagState", () => {
  it("el override de DB tiene prioridad sobre el entorno", () => {
    expect(resolveFlagState("PAYMENTS_ENABLED", true, false).effective).toBe(false);
    expect(resolveFlagState("PAYMENTS_ENABLED", false, true).effective).toBe(true);
    expect(resolveFlagState("PAYMENTS_ENABLED", false, undefined).effective).toBe(false);
  });
});
