import { cn } from "@/lib/utils";
import { CHART_STROKE, sparklinePoints, type ChartColor } from "./chart-utils";

/**
 * Mini tendencia (SVG). Siempre acompañada de un valor en texto en el componente que la usa;
 * expone una descripción accesible con los valores.
 */
export function Sparkline({
  values,
  label,
  color = "chart-1",
  className,
  formatValue = (n) => String(n),
}: {
  values: number[];
  /** Descripción accesible, p. ej. "Cobrado últimos 6 meses" */
  label: string;
  color?: ChartColor;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  if (values.length === 0) return null;
  const points = sparklinePoints(values, 100, 30, 3);
  const last = points.split(" ").pop()!.split(",");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${values.map(formatValue).join(", ")}`}
      className={cn("h-8 w-24 overflow-visible", className)}
    >
      <title>{`${label}: ${values.map(formatValue).join(", ")}`}</title>
      <polyline
        points={points}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={CHART_STROKE[color]}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2.5}
        className={cn("fill-card", CHART_STROKE[color])}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
