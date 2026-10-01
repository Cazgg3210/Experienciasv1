import { AlertTriangle, Lock, Palette, Sparkles, Wand2 } from "lucide-react";
import { formatBps, formatMXN } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ResolvedSnapshot } from "../server/lead-queries";
import type { AiDesignView } from "../domain/snapshot";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
    </div>
  );
}

/** Lo que la clienta configuró + el estimado que vio (y costo/margen interno para fundadoras). */
export function LeadSnapshotCard({ snapshot }: { snapshot: ResolvedSnapshot }) {
  const { data, names, addOns, estimate, internal } = snapshot;
  const selections: Array<{ label: string; value: string }> = [
    names.experience ? { label: "Experiencia", value: names.experience } : null,
    names.menu ? { label: "Menú", value: names.menu } : null,
    names.style ? { label: "Estilo", value: names.style } : null,
    names.serviceArea ? { label: "Zona", value: names.serviceArea } : null,
    ...data.fields,
  ].filter((x): x is { label: string; value: string } => x != null);

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-xs">
        Capturado el {formatDateTime(snapshot.createdAt)} · precios {snapshot.pricingVersion}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Selección</h3>
          {selections.length ? (
            <dl className="divide-y">
              {selections.map((s) => (
                <Row key={s.label} label={s.label} value={s.value} />
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">Sin selecciones registradas.</p>
          )}
          {addOns.length ? (
            <div className="mt-3">
              <h4 className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">Extras</h4>
              <ul className="flex flex-wrap gap-1.5">
                {addOns.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="bg-sage-soft text-olive rounded-full px-2.5 py-1 text-xs">
                    {a.name}
                    {a.quantity > 1 ? ` × ${a.quantity}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Estimado mostrado a la clienta</h3>
          {estimate ? (
            <div className="bg-ivory rounded-xl border p-3">
              {estimate.lines.length ? (
                <ul className="space-y-1.5 text-sm">
                  {estimate.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        {l.description}
                        {l.quantity > 1 && l.unitPriceCents != null ? (
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            ({l.quantity} × {formatMXN(l.unitPriceCents)})
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular shrink-0">{formatMXN(l.totalPriceCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="mt-3 border-t pt-2">
                {estimate.discountCents ? <Row label="Descuento" value={`− ${formatMXN(estimate.discountCents)}`} /> : null}
                {estimate.taxCents != null ? (
                  <Row label={estimate.pricesIncludeTax === false ? "IVA" : "IVA incluido"} value={formatMXN(estimate.taxCents)} />
                ) : null}
                <Row label="Total estimado" value={<span className="text-base">{formatMXN(estimate.totalCents)}</span>} />
                {estimate.depositCents != null ? <Row label="Anticipo" value={formatMXN(estimate.depositCents)} /> : null}
              </dl>
              {estimate.warnings.length ? (
                <ul className="text-warning mt-2 space-y-1 text-xs">
                  {estimate.warnings.map((w) => (
                    <li key={w} className="flex gap-1.5">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No se guardó un estimado.</p>
          )}

          {internal ? (
            <div className="mt-3 rounded-xl border border-dashed p-3">
              <p className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-medium">
                <Lock className="size-3" aria-hidden />
                Sólo equipo · {internal.source === "snapshot" ? "costo guardado" : "recalculado con precios vigentes"}
              </p>
              <dl>
                {internal.source === "recalculated" && internal.totalCents != null ? (
                  <Row label="Total con precios vigentes" value={formatMXN(internal.totalCents)} />
                ) : null}
                <Row label="Costo estimado" value={formatMXN(internal.estimatedCostCents)} />
                <Row
                  label="Margen estimado"
                  value={
                    <span className={cn((internal.estimatedMarginCents ?? 0) < 0 && "text-destructive", internal.belowMinMargin && "text-warning")}>
                      {formatMXN(internal.estimatedMarginCents)} · {formatBps(internal.marginBps)}
                    </span>
                  }
                />
              </dl>
              {internal.belowMinMargin && !internal.warnings.length ? (
                <p className="text-warning mt-1 text-xs">El margen está por debajo del mínimo configurado.</p>
              ) : null}
              {internal.warnings.length ? (
                <ul className="text-warning mt-1 space-y-1 text-xs">
                  {internal.warnings.map((w) => (
                    <li key={w} className="flex gap-1.5">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AiDesignCard({
  design,
}: {
  design: { id: string; createdAt: Date; provider: string; usedFallback: boolean; prompt: string | null; view: AiDesignView | null };
}) {
  const v = design.view;
  if (!v) return null;
  return (
    <article className="bg-ivory rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-heading inline-flex items-center gap-2 text-lg font-semibold">
          <Wand2 className="text-olive size-4" aria-hidden />
          {v.title ?? "Propuesta del diseñador IA"}
        </h3>
        <span className="text-muted-foreground text-xs">
          {formatDateTime(design.createdAt)}
          {design.usedFallback || design.provider === "mock" ? " · modo demostración" : ""}
        </span>
      </div>
      {design.prompt ? (
        <p className="text-muted-foreground mt-2 text-sm italic">“{design.prompt}”</p>
      ) : null}
      {v.concept ? <p className="mt-3 text-sm leading-relaxed">{v.concept}</p> : null}
      {v.palette.length ? (
        <div className="mt-3 flex items-center gap-2">
          <Palette className="text-muted-foreground size-4" aria-hidden />
          <ul className="flex gap-1.5" aria-label="Paleta sugerida">
            {v.palette.map((c) => (
              <li key={c}>
                <span className="block size-6 rounded-full border shadow-xs" style={{ backgroundColor: c }} title={c} />
                <span className="sr-only">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {v.details.length ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {v.details.map((d) => (
            <div key={d.label} className="text-sm">
              <dt className="text-muted-foreground text-xs">{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {v.estimatedFromCents != null ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm">
          <Sparkles className="text-olive size-4" aria-hidden />
          Desde <strong className="tabular">{formatMXN(v.estimatedFromCents)}</strong>
        </p>
      ) : null}
      {v.disclaimer ? <p className="text-muted-foreground mt-2 text-xs">{v.disclaimer}</p> : null}
    </article>
  );
}
