import { cn } from "@/lib/utils";
import { ChartDataTable } from "./chart-data-table";
import { axisTicks, CHART_BG, niceMax, pct, type ChartColor } from "./chart-utils";

export type BarSeries = { name: string; color: ChartColor };
export type BarDatum = { label: string; values: number[] };

/**
 * Gráfica de barras verticales (agrupadas por categoría) en CSS puro.
 * Accesible: role="img" + aria-label, leyenda con texto, tooltip nativo por barra y tabla de datos.
 */
export function BarChart({
  title,
  description,
  data,
  series,
  formatValue = (n) => String(n),
  formatAxis,
  height = 220,
  className,
}: {
  /** Texto accesible (aria-label) que describe la gráfica */
  title: string;
  description?: string;
  data: BarDatum[];
  series: BarSeries[];
  formatValue?: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
  className?: string;
}) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const ticks = axisTicks(max, 4);
  const fmtAxis = formatAxis ?? formatValue;
  const summary = data
    .map(
      (d) => `${d.label}: ${series.map((s, i) => `${s.name} ${formatValue(d.values[i] ?? 0)}`).join(", ")}`,
    )
    .join("; ");

  return (
    <figure className={cn("w-full", className)}>
      {series.length > 1 ? (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Leyenda">
          {series.map((s) => (
            <li key={s.name} className="text-muted-foreground inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2.5 rounded-[3px]", CHART_BG[s.color])} />
              {s.name}
            </li>
          ))}
        </ul>
      ) : null}
      <div role="img" aria-label={`${title}. ${summary}`} className="relative pt-2">
        <div className="flex gap-2" aria-hidden>
          {/* Eje Y */}
          <div
            className="text-muted-foreground relative w-14 shrink-0 text-right text-[10px]"
            style={{ height }}
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="tabular absolute right-0 -translate-y-1/2"
                style={{ bottom: `${pct(t, max)}%` }}
              >
                {fmtAxis(t)}
              </span>
            ))}
          </div>
          {/* Área de trazado */}
          <div className="relative min-w-0 flex-1" style={{ height }}>
            {ticks.map((t) => (
              <div
                key={t}
                className={cn(
                  "absolute inset-x-0 border-t",
                  t === 0 ? "border-border" : "border-border/50 border-dashed",
                )}
                style={{ bottom: `${pct(t, max)}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end justify-around gap-1 px-1 sm:gap-3">
              {data.map((d) => (
                <div key={d.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]">
                  {series.map((s, i) => {
                    const v = d.values[i] ?? 0;
                    return (
                      <div
                        key={s.name}
                        title={`${d.label} · ${s.name}: ${formatValue(v)}`}
                        className={cn(
                          "w-full max-w-7 rounded-t-[4px] transition-opacity hover:opacity-80 motion-reduce:transition-none",
                          CHART_BG[s.color],
                        )}
                        style={{ height: `${Math.max(v > 0 ? 1 : 0, pct(v, max))}%` }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Eje X */}
        <div className="mt-1.5 flex gap-2" aria-hidden>
          <div className="w-14 shrink-0" />
          <div className="flex min-w-0 flex-1 justify-around gap-1 px-1 sm:gap-3">
            {data.map((d) => {
              const [main, ...rest] = d.label.split(" ");
              return (
                <span
                  key={d.label}
                  className="text-muted-foreground min-w-0 flex-1 text-center text-[11px] leading-tight"
                >
                  <span className="block truncate">{main}</span>
                  {rest.length ? (
                    <span className="block truncate text-[10px] opacity-80">{rest.join(" ")}</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {description ? (
        <figcaption className="text-muted-foreground mt-2 text-xs">{description}</figcaption>
      ) : null}
      <ChartDataTable
        caption={title}
        columns={["Periodo", ...series.map((s) => s.name)]}
        rows={data.map((d) => [d.label, ...series.map((_, i) => formatValue(d.values[i] ?? 0))])}
      />
    </figure>
  );
}
