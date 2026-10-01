import { cn } from "@/lib/utils";
import { formatBps, formatMXN } from "@/lib/money";

/** Porcentaje de margen; negativo en rojo (nunca se oculta). null → "—". */
export function MarginPct({ bps, className }: { bps: number | null | undefined; className?: string }) {
  if (bps == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("tabular", bps < 0 && "text-destructive font-semibold", className)}>
      {bps < 0 ? "−" : ""}
      {formatBps(Math.abs(bps))}
    </span>
  );
}

/** Monto con signo explícito para negativos ("−$1,200") en rojo. */
export function Money({
  cents,
  className,
  signed = false,
}: {
  cents: number | null | undefined;
  className?: string;
  signed?: boolean;
}) {
  if (cents == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const negative = cents < 0;
  return (
    <span className={cn("tabular", negative && "text-destructive", className)}>
      {negative ? "−" : signed && cents > 0 ? "+" : ""}
      {formatMXN(Math.abs(cents))}
    </span>
  );
}

/** Variación de costo: positivo = gastamos de más (rojo), negativo = ahorro (verde). */
export function CostVariance({ cents }: { cents: number | null }) {
  if (cents == null) return <span className="text-muted-foreground text-xs italic">sin registrar</span>;
  if (cents === 0) return <span className="text-muted-foreground tabular">$0</span>;
  const over = cents > 0;
  return (
    <span className={cn("tabular font-medium", over ? "text-destructive" : "text-success")}>
      {over ? "+" : "−"}
      {formatMXN(Math.abs(cents))}
      <span className="sr-only">{over ? " por encima de lo estimado" : " por debajo de lo estimado"}</span>
    </span>
  );
}

export function formatMarginLine(cents: number, bps: number | null): string {
  const amount = `${cents < 0 ? "−" : ""}${formatMXN(Math.abs(cents))}`;
  if (bps == null) return amount;
  return `${amount} · ${bps < 0 ? "−" : ""}${formatBps(Math.abs(bps))}`;
}
