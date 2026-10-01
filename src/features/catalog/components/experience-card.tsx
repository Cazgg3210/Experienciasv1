import Link from "next/link";
import { Pencil, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { EXPERIENCE_TYPE_LABELS } from "@/lib/labels";
import { formatBps, formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { countLabel } from "../domain/catalog-rules";
import type { ExperienceListItem } from "../server/queries";
import { ActiveToggle } from "./catalog-actions";
import { CatalogImage } from "./catalog-image";

const MARGIN_TEXT = { healthy: "text-success", low: "text-warning", negative: "text-destructive" } as const;

/** Tarjeta de experiencia para la lista del admin. */
export function ExperienceCard({ item, canWrite, priority }: { item: ExperienceListItem; canWrite: boolean; priority?: boolean }) {
  const href = `/admin/catalog/experiences/${item.id}`;
  return (
    <article
      className={cn(
        "bg-card group flex flex-col overflow-hidden rounded-2xl border shadow-xs transition-shadow hover:shadow-md",
        !item.active && "opacity-80",
      )}
      aria-labelledby={`exp-${item.id}`}
    >
      <Link href={href} className="focus-visible:ring-ring/50 relative block aspect-[4/3] outline-none focus-visible:ring-3" tabIndex={-1} aria-hidden>
        <CatalogImage src={item.coverUrl} alt="" priority={priority} />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {item.featured ? (
            <span className="bg-olive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white">
              <Star className="size-3" aria-hidden /> Destacada
            </span>
          ) : null}
          {!item.active ? (
            <span className="bg-background/95 text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">Inactiva</span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">{EXPERIENCE_TYPE_LABELS[item.type]}</p>
          <h2 id={`exp-${item.id}`} className="font-heading text-xl leading-tight font-semibold">
            <Link href={href} className="focus-visible:ring-ring/50 rounded outline-none hover:underline focus-visible:ring-3">
              {item.name}
            </Link>
          </h2>
          {item.tagline ? <p className="text-muted-foreground line-clamp-2 text-sm">{item.tagline}</p> : null}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Precio base</dt>
            <dd className="tabular font-medium">{formatMXN(item.basePriceCents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Personas</dt>
            <dd className="tabular inline-flex items-center gap-1 font-medium whitespace-nowrap">
              <Users className="size-3.5 shrink-0" aria-hidden />
              {item.minGuests}–{item.maxGuests}
            </dd>
            <dd className="text-muted-foreground text-xs">base {item.baseGuests}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Margen est.</dt>
            <dd className={cn("tabular font-medium", item.margin ? MARGIN_TEXT[item.margin.level] : "text-muted-foreground")}>
              {item.margin ? formatBps(item.margin.marginBps) : "—"}
              {item.margin?.level === "negative" ? <span className="sr-only"> (negativo)</span> : null}
              {item.margin?.level === "low" ? <span className="sr-only"> (bajo el mínimo)</span> : null}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {item.counts.events ? <StatusBadge tone="brand">{countLabel(item.counts.events, "evento", "eventos")}</StatusBadge> : null}
          {item.counts.quotes ? <StatusBadge tone="neutral">{countLabel(item.counts.quotes, "cotización", "cotizaciones")}</StatusBadge> : null}
          {item.counts.images ? <StatusBadge tone="muted" dot={false}>{countLabel(item.counts.images, "foto", "fotos")}</StatusBadge> : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
          <ActiveToggle entity="experience" id={item.id} name={item.name} active={item.active} disabled={!canWrite} />
          <Button asChild variant="outline" size="lg">
            <Link href={href}>
              <Pencil aria-hidden />
              {canWrite ? "Editar" : "Ver"}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
