import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialItem } from "../server/queries";

function Stars({ rating, className }: { rating: number; className?: string }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <p className={cn("flex items-center gap-0.5", className)}>
      <span className="sr-only">Calificación: {value} de 5 estrellas</span>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-4", i < value ? "fill-current" : "opacity-30")} aria-hidden />
      ))}
    </p>
  );
}

/** Testimonios administrables (Testimonial activos, en orden). */
export function Testimonials({ items, className }: { items: TestimonialItem[]; className?: string }) {
  if (items.length === 0) return null;
  const [lead, ...rest] = items;
  return (
    <div className={cn("grid gap-6 lg:grid-cols-12", className)}>
      {lead ? (
        <figure
          className={cn(
            "bg-olive text-ivory flex flex-col justify-between gap-8 rounded-3xl p-8 sm:p-10",
            rest.length > 0 ? "lg:col-span-5" : "lg:col-span-12",
          )}
        >
          <blockquote className="font-heading text-2xl leading-snug sm:text-3xl">“{lead.body}”</blockquote>
          <figcaption className="space-y-2">
            <Stars rating={lead.rating} />
            <p className="font-medium">{lead.authorName}</p>
            {lead.occasion ? <p className="text-sm italic">{lead.occasion}</p> : null}
          </figcaption>
        </figure>
      ) : null}
      {rest.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
          {rest.map((t) => (
            <figure key={t.id} className="bg-card border-border/70 flex flex-col justify-between gap-6 rounded-3xl border p-7">
              <blockquote className="text-charcoal text-base leading-relaxed">“{t.body}”</blockquote>
              <figcaption className="space-y-1.5">
                <Stars rating={t.rating} className="text-olive" />
                <p className="text-sm font-medium">{t.authorName}</p>
                {t.occasion ? <p className="text-muted-foreground text-xs">{t.occasion}</p> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
