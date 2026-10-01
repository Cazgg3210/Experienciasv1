import type { PricingSettings } from "./settings-schema";

/**
 * Conversión entre lo que ve la fundadora (porcentajes y pesos) y lo que se guarda
 * (bps y centavos). Puro y testeable.
 */

/** 16 (%) -> 1600 bps. Redondea para evitar errores de punto flotante (16.1 -> 1610). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** 1600 bps -> 16 (%) */
export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

export type PricingFormValues = {
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  depositPercent: number;
  quoteValidityDays: number;
  minMarginPercent: number;
  paymentFeePercent: number;
  paymentFeeFixedCents: number;
  balanceDueDaysBefore: number;
  minStandardGuests: number;
  maxStandardGuests: number;
};

export function pricingToForm(s: PricingSettings): PricingFormValues {
  return {
    taxRatePercent: bpsToPercent(s.taxRateBps),
    pricesIncludeTax: s.pricesIncludeTax,
    depositPercent: bpsToPercent(s.depositBps),
    quoteValidityDays: s.quoteValidityDays,
    minMarginPercent: bpsToPercent(s.minMarginBps),
    paymentFeePercent: bpsToPercent(s.paymentFeeBps),
    paymentFeeFixedCents: s.paymentFeeFixedCents,
    balanceDueDaysBefore: s.balanceDueDaysBefore,
    minStandardGuests: s.minStandardGuests,
    maxStandardGuests: s.maxStandardGuests,
  };
}

/** Aplica el formulario sobre la configuración actual (conserva campos que el form no maneja). */
export function formToPricing(form: PricingFormValues, current: PricingSettings): PricingSettings {
  return {
    ...current,
    taxRateBps: percentToBps(form.taxRatePercent),
    pricesIncludeTax: form.pricesIncludeTax,
    depositBps: percentToBps(form.depositPercent),
    quoteValidityDays: Math.round(form.quoteValidityDays),
    minMarginBps: percentToBps(form.minMarginPercent),
    paymentFeeBps: percentToBps(form.paymentFeePercent),
    paymentFeeFixedCents: Math.round(form.paymentFeeFixedCents),
    balanceDueDaysBefore: Math.round(form.balanceDueDaysBefore),
    minStandardGuests: Math.round(form.minStandardGuests),
    maxStandardGuests: Math.round(form.maxStandardGuests),
  };
}

/** Lista de cambios legibles (para mostrar o auditar). */
export function describePricingChanges(before: PricingSettings, after: PricingSettings): string[] {
  const out: string[] = [];
  const pct = (bps: number) => `${bpsToPercent(bps)}%`;
  if (before.taxRateBps !== after.taxRateBps) out.push(`IVA ${pct(before.taxRateBps)} → ${pct(after.taxRateBps)}`);
  if (before.pricesIncludeTax !== after.pricesIncludeTax)
    out.push(after.pricesIncludeTax ? "Los precios ahora incluyen IVA" : "Los precios ahora son más IVA");
  if (before.depositBps !== after.depositBps) out.push(`Anticipo ${pct(before.depositBps)} → ${pct(after.depositBps)}`);
  if (before.quoteValidityDays !== after.quoteValidityDays)
    out.push(`Vigencia ${before.quoteValidityDays} → ${after.quoteValidityDays} días`);
  if (before.minMarginBps !== after.minMarginBps)
    out.push(`Margen mínimo ${pct(before.minMarginBps)} → ${pct(after.minMarginBps)}`);
  if (before.paymentFeeBps !== after.paymentFeeBps)
    out.push(`Comisión pasarela ${pct(before.paymentFeeBps)} → ${pct(after.paymentFeeBps)}`);
  if (before.paymentFeeFixedCents !== after.paymentFeeFixedCents) out.push("Cargo fijo de pasarela actualizado");
  if (before.balanceDueDaysBefore !== after.balanceDueDaysBefore)
    out.push(`Saldo ${before.balanceDueDaysBefore} → ${after.balanceDueDaysBefore} días antes`);
  if (before.minStandardGuests !== after.minStandardGuests || before.maxStandardGuests !== after.maxStandardGuests)
    out.push(
      `Invitadas estándar ${before.minStandardGuests}–${before.maxStandardGuests} → ${after.minStandardGuests}–${after.maxStandardGuests}`,
    );
  return out;
}
