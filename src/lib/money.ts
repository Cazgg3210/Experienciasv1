/**
 * Dinero: SIEMPRE enteros en centavos MXN. Porcentajes en basis points (bps): 1600 = 16%.
 */
export type Cents = number;

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const mxnExact = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $12,500 (sin decimales si son .00) */
export function formatMXN(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  const value = cents / 100;
  return Number.isInteger(value) ? mxn.format(value) : mxnExact.format(value);
}

/** $12,500.00 siempre con decimales */
export function formatMXNExact(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  return mxnExact.format(cents / 100);
}

export function pesosToCents(pesos: number): Cents {
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: Cents): number {
  return cents / 100;
}

/** Aplica bps a un monto en centavos con redondeo bancario simple (half away from zero). */
export function applyBps(cents: Cents, bps: number): Cents {
  return roundHalfAwayFromZero((cents * bps) / 10_000);
}

export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function formatBps(bps: number | null | undefined, fractionDigits = 1): string {
  if (bps == null || Number.isNaN(bps)) return "—";
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}

/** Margen en bps: margin / revenue. Si revenue = 0 => 0. */
export function marginBps(marginCents: Cents, revenueCents: Cents): number {
  if (revenueCents === 0) return 0;
  return Math.round((marginCents / revenueCents) * 10_000);
}
