/** Utilidades puras para gráficas SVG/CSS (sin librerías). */

export type ChartColor = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

/** Clases de Tailwind por color (literales para que el compilador de Tailwind las detecte). */
export const CHART_BG: Record<ChartColor, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

export const CHART_STROKE: Record<ChartColor, string> = {
  "chart-1": "stroke-chart-1",
  "chart-2": "stroke-chart-2",
  "chart-3": "stroke-chart-3",
  "chart-4": "stroke-chart-4",
  "chart-5": "stroke-chart-5",
};

export const CHART_FILL: Record<ChartColor, string> = {
  "chart-1": "fill-chart-1",
  "chart-2": "fill-chart-2",
  "chart-3": "fill-chart-3",
  "chart-4": "fill-chart-4",
  "chart-5": "fill-chart-5",
};

/** Redondea hacia arriba a un máximo "bonito" (1, 2, 2.5, 5 × 10^n) para el eje. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (value <= m * base) return m * base;
  }
  return 10 * base;
}

/** Marcas del eje (0..max) en `count` pasos. */
export function axisTicks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i * 100) / 100);
}

/** Porcentaje (0-100) acotado de un valor sobre un máximo. */
export function pct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

/** Puntos de una polilínea normalizada a un viewBox de ancho `w` y alto `h`. */
export function sparklinePoints(values: number[], w = 100, h = 30, pad = 2): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? pad + i * stepX : w / 2;
      const y = max === min ? h / 2 : h - pad - ((v - min) / span) * (h - pad * 2);
      return `${round2(x)},${round2(y)}`;
    })
    .join(" ");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
