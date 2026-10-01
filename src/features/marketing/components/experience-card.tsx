import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { EXPERIENCE_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { cardPriceLine, durationLabel } from "../domain/display";
import type { ExperienceCardData } from "../server/queries";
import { SiteImage } from "./site-image";

/**
 * Tarjeta editorial de experiencia. Toda la tarjeta es clicable (enlace "estirado" en el título),
 * con elevación sutil al pasar el cursor (desactivada con prefers-reduced-motion).
 */
export function ExperienceCard({
  experience,
  headingLevel: Heading = "h3",
  showBadge = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
}: {
  experience: ExperienceCardData;
  headingLevel?: "h2" | "h3";
  showBadge?: boolean;
  sizes?: string;
  className?: string;
}) {
  const e = experience;
  return (
    <article
      className={cn(
        "group bg-card border-border/70 relative flex h-full flex-col overflow-hidden rounded-3xl border",
        "transition-[transform,box-shadow] duration-300 ease-out hover:shadow-xl hover:shadow-black/5 motion-safe:hover:-translate-y-1",
        "focus-within:ring-ring/50 focus-within:ring-3",
        className,
      )}
    >
      <div className="bg-sand-soft relative aspect-[4/3] overflow-hidden">
        <SiteImage
          src={e.cover.src}
          alt={e.cover.alt}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        {showBadge && e.featured ? (
          <span className="bg-ivory/90 text-olive absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-medium backdrop-blur">
            Favorita
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6 sm:p-7">
        <p className="eyebrow">{EXPERIENCE_TYPE_LABELS[e.type]}</p>
        <Heading className="font-heading text-charcoal text-2xl leading-tight font-medium sm:text-[1.7rem]">
          <Link
            href={`/experiencias/${e.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {e.name}
          </Link>
        </Heading>
        {e.tagline ? <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">{e.tagline}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="space-y-1">
            <p className="text-charcoal text-sm font-medium">{cardPriceLine(e)}</p>
            {e.durationMinutes > 0 ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Clock className="size-3.5" aria-hidden />
                {durationLabel(e.durationMinutes)} de experiencia
              </p>
            ) : null}
          </div>
          <span
            aria-hidden
            className="border-border text-olive group-hover:bg-olive group-hover:text-ivory flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
