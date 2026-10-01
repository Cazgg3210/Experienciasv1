import { cn } from "@/lib/utils";
import { ChartDataTable } from "./chart-data-table";
import { CHART_BG, pct, type ChartColor } from "./chart-utils";

export type HorizontalBarDatum = { label: string; value: number; hint?: string; href?: string };

/**
 * Barras horizontales (ranking) en CSS puro, una sola serie.
 * Valor visible al final de cada barra (etiqueta directa), tooltip nativo y tabla de datos.
 */
export function HorizontalBarChart({
  title,
  data,
  formatValue = (n) => String(n),
  color = "chart-1",
  valueLabel = "Valor",
  emptyText = "Sin datos en este periodo.",
  className,
}: {
  title: string;
  data: HorizontalBarDatum[];
  formatValue?: (value: number) => string;
  color?: ChartColor;
  valueLabel?: string;
  emptyText?: string;
  className?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className={cn("text-muted-foreground py-6 text-center text-sm", className)}>{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.value));
  const summary = data.map((d) => `${d.label}: ${formatValue(d.value)}`).join("; ");
  return (
    <figure className={cn("w-full", className)}>
      <div role="img" aria-label={`${title}. ${summary}`}>
        <ul className="space-y-2.5" aria-hidden>
          {data.map((d) => (
            <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
              <span className="truncate text-sm" title={d.label}>
                {d.label}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="bg-muted/60 relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
                  <span
                    title={`${d.label}: ${formatValue(d.value)}`}
                    className={cn("absolute inset-y-0 left-0 rounded-full", CHART_BG[color])}
                    style={{ width: `${Math.max(d.value > 0 ? 2 : 0, pct(d.value, max))}%` }}
                  />
                </span>
                <span className="tabular w-16 shrink-0 text-right text-sm font-medium sm:w-20">
                  {formatValue(d.value)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ChartDataTable
        caption={title}
        hidden
        columns={["Concepto", valueLabel]}
        rows={data.map((d) => [d.label, formatValue(d.value)])}
      />
    </figure>
  );
}
