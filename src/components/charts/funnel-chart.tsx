import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartDataTable } from "./chart-data-table";
import { CHART_BG, pct, type ChartColor } from "./chart-utils";

export type FunnelDatum = {
  label: string;
  value: number;
  /** Conversión vs el paso anterior, ya formateada ("48%") o null */
  stepRate?: string | null;
  /** Conversión acumulada vs el primer paso, ya formateada */
  overallRate?: string | null;
};

/**
 * Embudo de conversión: barras centradas proporcionales + % de paso entre etapas.
 * Accesible con aria-label resumido y tabla de datos visible bajo demanda.
 */
export function FunnelChart({
  title,
  data,
  color = "chart-1",
  formatValue = (n) => n.toLocaleString("es-MX"),
  valueLabel = "Total",
  className,
}: {
  title: string;
  data: FunnelDatum[];
  color?: ChartColor;
  formatValue?: (value: number) => string;
  /** Encabezado de la columna de valores en la tabla de datos */
  valueLabel?: string;
  className?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const summary = data
    .map(
      (d) => `${d.label}: ${formatValue(d.value)}${d.stepRate ? ` (${d.stepRate} del paso anterior)` : ""}`,
    )
    .join("; ");
  return (
    <figure className={cn("w-full", className)}>
      <div role="img" aria-label={`${title}. ${summary}`}>
        <ol className="space-y-1" aria-hidden>
          {data.map((d, i) => (
            <li key={d.label}>
              {i > 0 ? (
                <div className="text-muted-foreground flex items-center justify-center gap-1 py-0.5 text-[11px]">
                  <ChevronDown className="size-3" aria-hidden />
                  <span className="tabular">{d.stepRate ?? "—"} continúa</span>
                </div>
              ) : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
                <span className="order-1 truncate text-sm">{d.label}</span>
                <span className="bg-muted/50 relative order-3 col-span-2 flex h-6 items-center justify-center overflow-hidden rounded-md sm:order-2 sm:col-span-1 sm:h-7">
                  <span
                    title={`${d.label}: ${formatValue(d.value)}`}
                    className={cn("h-full rounded-[4px]", CHART_BG[color], i > 0 && "opacity-90")}
                    style={{ width: `${Math.max(d.value > 0 ? 1.5 : 0, pct(d.value, max))}%` }}
                  />
                </span>
                <span className="order-2 text-right whitespace-nowrap sm:order-3 sm:w-24">
                  <span className="tabular block text-sm font-semibold">{formatValue(d.value)}</span>
                  {d.overallRate ? (
                    <span className="text-muted-foreground tabular block text-[11px]">
                      {d.overallRate} del total
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <ChartDataTable
        caption={title}
        columns={["Etapa", valueLabel, "Del paso anterior", "Del total"]}
        rows={data.map((d) => [d.label, formatValue(d.value), d.stepRate ?? "—", d.overallRate ?? "—"])}
      />
    </figure>
  );
}
