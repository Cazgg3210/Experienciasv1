"use client";

import * as React from "react";
import { ChevronUp, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBps, formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { summaryRows } from "../domain/summary";
import type { ConfiguratorDraft } from "../domain/wizard";
import type { ConfiguratorCatalog, ConfiguratorEstimate } from "../types";

export type EstimateState = {
  status: "idle" | "loading" | "ready" | "error";
  data: ConfiguratorEstimate | null;
  error: string | null;
};

/** Líneas del estimado + total, IVA y anticipo (todo calculado en servidor). */
export function EstimateBreakdown({
  estimate,
  settings,
  outOfArea,
  className,
}: {
  estimate: ConfiguratorEstimate;
  settings: ConfiguratorCatalog["settings"];
  outOfArea?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <ul className="space-y-2 text-sm">
        {estimate.lines.map((l, i) => (
          <li key={`${l.type}-${i}`} className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground min-w-0">
              {l.description}
              {l.quantity > 1 && l.type !== "EXTRA_GUEST" ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {l.quantity} × {formatMXN(l.unitPriceCents)}
                </span>
              ) : null}
            </span>
            <span className="tabular shrink-0 font-medium">
              {l.totalPriceCents === 0 ? "Incluido" : formatMXN(l.totalPriceCents)}
            </span>
          </li>
        ))}
        {outOfArea ? (
          <li className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Logística para tu zona</span>
            <span className="text-muted-foreground shrink-0 text-xs">Por confirmar</span>
          </li>
        ) : null}
      </ul>
      <div className="border-t pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">Total estimado</span>
          <span className="font-heading text-3xl font-semibold">{formatMXN(estimate.totalCents)}</span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-right text-xs">
          {settings.pricesIncludeTax
            ? `IVA incluido (${formatMXN(estimate.taxCents)})`
            : `Incluye IVA de ${formatMXN(estimate.taxCents)}`}
        </p>
        <div className="bg-sage-soft/70 mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm">
          <span>
            Anticipo para reservar
            <span className="text-muted-foreground"> ({formatBps(settings.depositBps, 0)})</span>
          </span>
          <span className="tabular font-semibold">{formatMXN(estimate.depositCents)}</span>
        </div>
      </div>
      {estimate.warnings.length ? (
        <ul className="space-y-1.5">
          {estimate.warnings.map((w) => (
            <li key={w} className="text-warning flex gap-2 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type SummaryProps = {
  draft: ConfiguratorDraft;
  catalog: ConfiguratorCatalog;
  estimate: EstimateState;
  /** Paso actual: invitadas y extras (que tienen valor por defecto) sólo se muestran ya contestados */
  currentStep: number;
};

function SummaryBody({ draft, catalog, estimate, currentStep }: SummaryProps) {
  const rows = summaryRows(draft, catalog).filter(
    (r) => r.value && r.step <= 8 && (r.step < currentStep || (r.step !== 4 && r.step !== 8)),
  );
  return (
    <div className="space-y-5">
      {rows.length ? (
        <dl className="space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-3">
              <dt className="text-muted-foreground w-24 shrink-0">{r.label}</dt>
              <dd className="min-w-0 font-medium break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div aria-live="polite" aria-atomic="false">
        {!draft.experienceId ? (
          <p className="bg-sand-soft text-muted-foreground rounded-xl px-3 py-3 text-sm">
            Elige una experiencia para ver tu estimado al momento.
          </p>
        ) : estimate.status === "error" ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-3 py-2 text-sm"
          >
            {estimate.error}
          </p>
        ) : estimate.data ? (
          <div className={cn("transition-opacity", estimate.status === "loading" && "opacity-60")}>
            <EstimateBreakdown
              estimate={estimate.data}
              settings={catalog.settings}
              outOfArea={draft.zoneOther}
            />
          </div>
        ) : (
          <div className="space-y-2" aria-busy="true">
            <span className="sr-only">Calculando tu estimado…</span>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Precio estimado sujeto a disponibilidad y confirmación. Lo calculamos con nuestras tarifas vigentes.
      </p>
    </div>
  );
}

/** Tarjeta lateral (desktop). */
export function EstimateSideCard(props: SummaryProps) {
  return (
    <aside
      aria-labelledby="resumen-estimado"
      className="bg-card sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-3xl border p-6 shadow-[0_10px_40px_-24px_rgba(47,44,42,0.35)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="resumen-estimado" className="font-heading text-2xl font-semibold">
          Tu experiencia
        </h2>
        {props.estimate.status === "loading" ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
        ) : null}
      </div>
      <SummaryBody {...props} />
    </aside>
  );
}

/**
 * Barra inferior (móvil) que abre el detalle en una hoja. Es "sticky" dentro del wizard
 * (sangra hasta el borde del .container-page con -mx-5/-mx-8) para no tapar el footer del sitio.
 */
export function EstimateMobileBar(props: SummaryProps) {
  const { estimate, draft } = props;
  const total = draft.experienceId && estimate.data ? formatMXN(estimate.data.totalCents) : null;
  return (
    <div className="bg-card/95 supports-backdrop-filter:bg-card/85 sticky bottom-0 z-40 -mx-5 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-20px_rgba(47,44,42,0.45)] backdrop-blur sm:-mx-8 lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          <p className="text-muted-foreground text-xs">{total ? "Total estimado" : "Tu experiencia"}</p>
          <p className="font-heading truncate text-2xl leading-tight font-semibold">
            {total ?? (draft.experienceId ? "Calculando…" : "Sin estimado aún")}
          </p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-10 rounded-full px-4">
              Ver detalle <ChevronUp aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85dvh] overflow-y-auto rounded-t-3xl"
          >
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4 rounded-full"
                aria-label="Cerrar detalle"
              >
                <X aria-hidden />
              </Button>
            </SheetClose>
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="font-heading text-2xl">Tu experiencia</SheetTitle>
              <SheetDescription>Resumen de lo que llevas y estimado calculado al momento.</SheetDescription>
            </SheetHeader>
            <div className="px-5 pb-8">
              <SummaryBody {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
