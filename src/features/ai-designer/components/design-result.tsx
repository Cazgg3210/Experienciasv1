"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CircleCheck,
  Flower2,
  Gift,
  Heart,
  type LucideIcon,
  MessageCircle,
  Music,
  PartyPopper,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ConvertDesignResult, DesignView } from "../types";
import { ConvertDialog } from "./convert-dialog";
import { PaletteStrip, PaletteSwatches } from "./palette-swatches";

function InfoCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-border bg-card space-y-3 rounded-3xl border p-5 sm:p-6", className)}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span className="bg-sage-soft text-olive flex size-8 items-center justify-center rounded-full">
          <Icon aria-hidden className="size-4" />
        </span>
        {title}
      </h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function PriceCard({ design }: { design: DesignView }) {
  const { estimate, budget } = design;
  return (
    <section aria-labelledby="ai-estimate-title" className="bg-sage-soft space-y-5 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="ai-estimate-title" className="eyebrow text-accent-foreground">
            Presupuesto estimado
          </h3>
          <p className="font-heading tabular mt-1 text-4xl font-semibold sm:text-5xl">
            {formatMXN(estimate.totalCents)}
          </p>
          <p className="text-accent-foreground mt-1 text-sm">
            Para {design.guestCount} personas · IVA incluido
          </p>
        </div>
        <div className="bg-card/70 rounded-2xl px-4 py-3 text-sm">
          <p className="text-muted-foreground">Anticipo para apartar tu fecha</p>
          <p className="tabular text-lg font-semibold">
            {formatMXN(estimate.depositCents)}
            {estimate.depositPercent ? (
              <span className="text-muted-foreground text-sm font-normal"> ({estimate.depositPercent}%)</span>
            ) : null}
          </p>
        </div>
      </div>

      {budget ? (
        budget.withinBudget ? (
          <p className="text-success flex items-center gap-2 text-sm font-medium">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            Dentro de tu presupuesto ({budget.label})
          </p>
        ) : (
          <div role="note" className="border-warning/30 bg-card/80 flex gap-3 rounded-2xl border p-4 text-sm">
            <TriangleAlert aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-medium">{budget.suggestion ?? "Se pasa un poco de tu presupuesto."}</span>{" "}
              <span className="text-muted-foreground">Tu rango: {budget.label}.</span>
            </p>
          </div>
        )
      ) : null}

      <details className="group bg-card/60 rounded-2xl px-4 py-3 text-sm">
        <summary className="marker:text-olive cursor-pointer font-medium">Ver desglose</summary>
        <ul className="mt-3 space-y-2">
          {estimate.lines.map((l, i) => (
            <li key={`${l.description}-${i}`} className="flex justify-between gap-4">
              <span className="min-w-0">{l.description}</span>
              <span className="tabular shrink-0">{formatMXN(l.totalPriceCents)}</span>
            </li>
          ))}
          {estimate.discountCents > 0 ? (
            <li className="flex justify-between gap-4">
              <span className="min-w-0">Descuento</span>
              <span className="tabular shrink-0">−{formatMXN(estimate.discountCents)}</span>
            </li>
          ) : null}
          {!estimate.taxIncluded && estimate.taxCents > 0 ? (
            <li className="flex justify-between gap-4">
              <span className="min-w-0">IVA</span>
              <span className="tabular shrink-0">{formatMXN(estimate.taxCents)}</span>
            </li>
          ) : null}
          <li className="border-border flex justify-between gap-4 border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular">{formatMXN(estimate.totalCents)}</span>
          </li>
          {estimate.taxIncluded && estimate.taxCents > 0 ? (
            <li className="text-muted-foreground flex justify-between gap-4 text-xs">
              <span className="min-w-0">Incluye IVA</span>
              <span className="tabular shrink-0">{formatMXN(estimate.taxCents)}</span>
            </li>
          ) : null}
        </ul>
      </details>

      {estimate.notes.length ? (
        <ul className="text-accent-foreground space-y-1 text-sm">
          {estimate.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-accent-foreground text-xs">
        Estimado con los precios reales de nuestro catálogo; sujeto a disponibilidad y a confirmación de fecha
        y detalles con nuestro equipo.
      </p>
    </section>
  );
}

/** Tarjeta de la propuesta generada + conversión. */
export function DesignResult({ design, onRestart }: { design: DesignView; onRestart: () => void }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [submitted, setSubmitted] = React.useState<ConvertDesignResult | null>(null);

  React.useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article aria-labelledby="ai-design-title" className="space-y-5">
      <div className="border-border bg-card overflow-hidden rounded-3xl border shadow-sm">
        <PaletteStrip palette={design.palette} />
        <div className="space-y-6 p-6 sm:p-10">
          <div className="space-y-3">
            <p className="eyebrow">
              Tu propuesta · {design.occasionLabel} · {design.guestCount} personas
            </p>
            <h2
              id="ai-design-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-4xl leading-[1.05] font-semibold text-balance outline-none sm:text-5xl"
            >
              {design.name}
            </h2>
            <p className="text-muted-foreground text-lg text-pretty italic sm:text-xl">{design.concept}</p>
          </div>
          <PaletteSwatches palette={design.palette} />
          <div className="max-w-3xl space-y-4 text-base leading-relaxed">
            {design.description.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard icon={Sparkles} title="Experiencia sugerida">
          <p className="font-heading text-xl font-semibold">{design.experience.name}</p>
          {design.experience.tagline ? (
            <p className="text-muted-foreground mt-1">{design.experience.tagline}</p>
          ) : null}
          {/* En otra pestaña: la propuesta vive sólo en esta página y no queremos que se pierda. */}
          <a
            href={design.experience.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-olive mt-3 inline-flex min-h-11 items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            Ver la experiencia
            <span className="sr-only"> (se abre en otra pestaña)</span>
            <ArrowUpRight aria-hidden className="size-4" />
          </a>
        </InfoCard>

        <InfoCard icon={UtensilsCrossed} title="Menú sugerido">
          {design.menu ? (
            <>
              <p className="font-heading text-xl font-semibold">{design.menu.name}</p>
              {design.menu.description ? (
                <p className="text-muted-foreground mt-1">{design.menu.description}</p>
              ) : null}
            </>
          ) : (
            <p>El menú lo definimos contigo según los gustos del grupo.</p>
          )}
          {design.dietaryNote ? (
            <p className="bg-sand-soft mt-3 rounded-xl px-3 py-2">{design.dietaryNote}</p>
          ) : null}
        </InfoCard>

        <InfoCard icon={Gift} title="Extras sugeridos">
          {design.addOns.length ? (
            <ul className="space-y-3">
              {design.addOns.map((a) => (
                <li key={a.id}>
                  <p className="font-medium">
                    {a.name}{" "}
                    <span className="text-muted-foreground text-xs font-normal">· {a.categoryLabel}</span>
                  </p>
                  {a.description ? <p className="text-muted-foreground">{a.description}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Sin extras por ahora para cuidar tu presupuesto. Siempre puedes sumarlos después.
            </p>
          )}
        </InfoCard>

        <InfoCard icon={PartyPopper} title="Actividades y dinámicas">
          <ul className="space-y-2">
            {design.activities.map((a) => (
              <li key={a} className="flex gap-2">
                <Heart aria-hidden className="text-olive mt-1 size-3.5 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </InfoCard>

        <InfoCard icon={Flower2} title="Mesa y decoración">
          {design.style ? (
            <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
              Estilo {design.style.name}
            </p>
          ) : null}
          <p>{design.tableDesign}</p>
        </InfoCard>

        <InfoCard icon={Music} title="Vibe de la playlist">
          <p>{design.playlistVibe}</p>
        </InfoCard>
      </div>

      <PriceCard design={design} />

      {submitted ? (
        <div
          role="status"
          className="border-border bg-card flex flex-col gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center"
        >
          <CircleCheck aria-hidden className="text-success size-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-xl font-semibold">¡Solicitud enviada!</p>
            <p className="text-muted-foreground text-sm">
              Folio <span className="text-foreground font-mono font-medium">{submitted.code}</span>. Te
              escribimos muy pronto por WhatsApp.
            </p>
          </div>
          <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-5">
            <a href={submitted.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              Escribirnos por WhatsApp
            </a>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col items-stretch gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
        <ConvertDialog
          designId={design.id}
          designName={design.name}
          submitted={submitted}
          onSubmitted={(r) => setSubmitted(r)}
          trigger={
            <Button size="xl" className="w-full sm:w-auto">
              {submitted ? <CircleCheck aria-hidden /> : <Heart aria-hidden />}
              {submitted ? "Solicitud enviada" : "Quiero esta experiencia"}
            </Button>
          }
        />
        <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
          <Link href={design.configuratorHref}>
            <SlidersHorizontal aria-hidden />
            Ajustar en el configurador
          </Link>
        </Button>
        <Button variant="ghost" size="lg" className="h-12 rounded-full px-6" onClick={onRestart}>
          <RotateCcw aria-hidden />
          Probar otra idea
        </Button>
      </div>
    </article>
  );
}
