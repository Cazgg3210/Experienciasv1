import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tarjeta de sección del detalle (lead / clienta). */
export function Panel({
  title,
  icon: Icon,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  icon?: LucideIcon;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("bg-card rounded-2xl border p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="font-heading inline-flex items-center gap-2 text-xl font-semibold">
            {Icon ? <Icon className="text-olive size-4" aria-hidden /> : null}
            {title}
          </h2>
          {description ? <p className="text-muted-foreground mt-0.5 text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Lista de definición compacta (etiqueta / valor). */
export function DetailList({ items, className }: { items: Array<{ label: string; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
