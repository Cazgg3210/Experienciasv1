import { AlertTriangle, TrendingDown } from "lucide-react";
import type { CostCategory, QuoteStatus } from "@prisma/client";
import { StatusBadge } from "@/components/data/status-badge";
import { COST_CATEGORY_LABELS, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "@/lib/labels";
import { formatBps, formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { isTaxIncluded, marginLevel, type MarginLevel } from "../domain/quote-lines";

/**
 * Piezas visuales de cotizaciones (server-safe: sin hooks). Se usan en admin (con costos)
 * y en el preview del formulario.
 */

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <StatusBadge tone={QUOTE_STATUS_TONES[status]} className={className}>
      {QUOTE_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function MarginText({
  marginBps,
  marginCents,
  minMarginBps,
  className,
}: {
  marginBps: number;
  marginCents: number;
  minMarginBps: number;
  className?: string;
}) {
  const level = marginLevel(marginBps, marginCents, minMarginBps);
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 font-medium",
        level !== "ok" && "text-destructive",
        level === "negative" && "font-semibold",
        className,
      )}
      title={level === "negative" ? "Margen negativo" : level === "low" ? "Margen por debajo del mínimo" : undefined}
    >
      {level === "negative" ? <TrendingDown className="size-3.5" aria-hidden /> : null}
      {formatBps(marginBps)}
      {level !== "ok" ? (
        <span className="sr-only">{level === "negative" ? " (margen negativo)" : " (debajo del mínimo)"}</span>
      ) : null}
    </span>
  );
}

/** Alerta de margen: ámbar si está debajo del mínimo, roja si es negativa. Nunca se oculta. */
export function MarginAlert({
  marginBps,
  marginCents,
  minMarginBps,
  className,
}: {
  marginBps: number;
  marginCents: number;
  minMarginBps: number;
  className?: string;
}) {
  const level: MarginLevel = marginLevel(marginBps, marginCents, minMarginBps);
  if (level === "ok") return null;
  const negative = level === "negative";
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        negative
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/10 text-warning",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{negative ? "Margen negativo" : "Margen por debajo del mínimo"}</p>
        <p className="text-foreground/80">
          {negative
            ? `Esta cotización pierde ${formatMXN(Math.abs(marginCents))} con los costos estimados. Revisa precios, descuento o conceptos antes de enviarla.`
            : `El margen estimado es ${formatBps(marginBps)} y el mínimo configurado es ${formatBps(minMarginBps, 0)}.`}
        </p>
      </div>
    </div>
  );
}

export function EngineWarnings({ warnings, className }: { warnings: Array<{ code: string; message: string }>; className?: string }) {
  const list = warnings.filter((w) => w.code !== "MARGIN_BELOW_MINIMUM" && w.code !== "NEGATIVE_MARGIN");
  if (!list.length) return null;
  return (
    <ul className={cn("border-warning/30 bg-warning/5 space-y-1 rounded-xl border px-4 py-3 text-sm", className)}>
      {list.map((w) => (
        <li key={w.code + w.message} className="flex items-start gap-2">
          <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{w.message}</span>
        </li>
      ))}
    </ul>
  );
}

export type TotalsView = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositBps: number;
  depositCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  marginBps: number;
  costBreakdown?: Partial<Record<CostCategory, number>> | null;
};

function Row({
  label,
  value,
  strong,
  muted,
  danger,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1", muted && "text-muted-foreground", strong && "text-base font-semibold")}>
      <dt>{label}</dt>
      <dd className={cn("tabular text-right", danger && "text-destructive font-semibold")}>{value}</dd>
    </div>
  );
}

/** Resumen de totales para el panel admin: precio, IVA, anticipo + costos y margen. */
export function TotalsSummary({
  totals,
  minMarginBps,
  showCosts = true,
  discountLabel,
  className,
}: {
  totals: TotalsView;
  minMarginBps: number;
  showCosts?: boolean;
  discountLabel?: string;
  className?: string;
}) {
  const level = marginLevel(totals.marginBps, totals.estimatedMarginCents, minMarginBps);
  const breakdown = Object.entries(totals.costBreakdown ?? {}).filter(([, v]) => (v ?? 0) > 0) as Array<[CostCategory, number]>;
  const taxIncluded = isTaxIncluded(totals);
  return (
    <div className={cn("space-y-4", className)}>
      <dl className="text-sm">
        <Row label="Subtotal" value={formatMXN(totals.subtotalCents)} />
        {totals.discountCents > 0 ? (
          <Row label={discountLabel ?? "Descuento"} value={`−${formatMXN(totals.discountCents)}`} />
        ) : null}
        <Row
          label={taxIncluded ? "IVA incluido" : "IVA"}
          value={taxIncluded ? formatMXN(totals.taxCents) : `+${formatMXN(totals.taxCents)}`}
          muted={taxIncluded}
        />
        <div className="my-1 border-t" />
        <Row label="Total" value={formatMXN(totals.totalCents)} strong />
        <Row label={`Anticipo (${formatBps(totals.depositBps, 0)})`} value={formatMXN(totals.depositCents)} />
        <Row label="Saldo" value={formatMXN(totals.totalCents - totals.depositCents)} muted />
      </dl>
      {showCosts ? (
        <div className="bg-sand-soft/60 rounded-xl border p-3">
          <p className="eyebrow mb-1">Rentabilidad (interno)</p>
          <dl className="text-sm">
            <Row label="Costo estimado" value={formatMXN(totals.estimatedCostCents)} />
            {breakdown.map(([cat, v]) => (
              <Row key={cat} label={<span className="pl-3">{COST_CATEGORY_LABELS[cat]}</span>} value={formatMXN(v)} muted />
            ))}
            <div className="my-1 border-t" />
            <Row
              label="Margen estimado"
              value={formatMXN(totals.estimatedMarginCents)}
              strong
              danger={level !== "ok"}
            />
            <Row
              label="Margen %"
              value={<MarginText marginBps={totals.marginBps} marginCents={totals.estimatedMarginCents} minMarginBps={minMarginBps} />}
            />
            <Row label="Margen mínimo" value={formatBps(minMarginBps, 0)} muted />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function discountLabelFor(type: "PERCENT" | "AMOUNT" | null | undefined, value: number | null | undefined): string {
  if (type === "PERCENT" && value) return `Descuento (${formatBps(value, value % 100 === 0 ? 0 : 1)})`;
  return "Descuento";
}
