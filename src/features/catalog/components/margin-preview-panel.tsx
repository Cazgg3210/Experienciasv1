"use client";

import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { COST_CATEGORY_LABELS } from "@/lib/labels";
import { formatBps, formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MarginPreview } from "../domain/margin-preview";

const LEVEL_STYLES = {
  healthy: { box: "border-success/30 bg-success/5", text: "text-success", Icon: CheckCircle2, label: "Margen saludable" },
  low: { box: "border-warning/40 bg-warning/10", text: "text-warning", Icon: AlertTriangle, label: "Por debajo del mínimo" },
  negative: { box: "border-destructive/40 bg-destructive/5", text: "text-destructive", Icon: TrendingDown, label: "Margen negativo" },
} as const;

/** Panel de costo y margen estimado (QuoteEngine) para el número base de personas. */
export function MarginPreviewPanel({ preview, className }: { preview: MarginPreview | null; className?: string }) {
  if (!preview) {
    return (
      <div className={cn("text-muted-foreground rounded-xl border border-dashed p-4 text-sm", className)}>
        Completa el precio base, las personas base y los montos de costo para ver el margen estimado.
      </div>
    );
  }
  const s = LEVEL_STYLES[preview.level];
  const maxCat = Math.max(1, ...preview.costBreakdown.map((c) => c.cents));
  return (
    <div className={cn("rounded-xl border p-4", s.box, className)} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">Margen estimado · {preview.guestCount} personas</p>
          <p className={cn("tabular text-3xl font-semibold tracking-tight", s.text)}>{formatBps(preview.marginBps)}</p>
          <p className={cn("tabular text-sm font-medium", s.text)}>{formatMXN(preview.marginCents)}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", s.text)}>
          <s.Icon className="size-3.5" aria-hidden />
          {s.label}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Precio a la clienta</dt>
        <dd className="tabular text-right">{formatMXN(preview.totalCents)}</dd>
        <dt className="text-muted-foreground">IVA</dt>
        <dd className="tabular text-right">−{formatMXN(preview.taxCents)}</dd>
        <dt className="text-muted-foreground">Ingreso neto</dt>
        <dd className="tabular text-right font-medium">{formatMXN(preview.netRevenueCents)}</dd>
        <dt className="text-muted-foreground">Costo estimado</dt>
        <dd className="tabular text-right">−{formatMXN(preview.estimatedCostCents)}</dd>
      </dl>
      {preview.costBreakdown.length ? (
        <div className="mt-4 space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">Costo por categoría</p>
          <ul className="space-y-1.5">
            {preview.costBreakdown.map((c) => (
              <li key={c.category} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate">{COST_CATEGORY_LABELS[c.category]}</span>
                <span className="bg-background/80 h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <span
                    className="bg-taupe block h-full rounded-full"
                    style={{ width: `${Math.max(4, Math.round((c.cents / maxCat) * 100))}%` }}
                  />
                </span>
                <span className="tabular text-right">{formatMXN(c.cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-muted-foreground mt-3 text-xs">
        Mínimo configurado: {formatBps(preview.minMarginBps, 0)}. Incluye comisión de pago estimada
        {preview.menuName ? ` y el costo del menú "${preview.menuName}"` : " (sin menú)"}.
      </p>
    </div>
  );
}

/** Chip compacto del margen (barra de guardado / listas). */
export function MarginChip({ preview }: { preview: MarginPreview | null }) {
  if (!preview) return <span className="text-muted-foreground text-xs">Margen —</span>;
  const s = LEVEL_STYLES[preview.level];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", s.text)}>
      <s.Icon className="size-3.5" aria-hidden />
      Margen {formatBps(preview.marginBps)}
      <span className="sr-only">({s.label})</span>
    </span>
  );
}
