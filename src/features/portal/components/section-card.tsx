import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tarjeta de sección del portal con ancla (para la navegación interna) y encabezado accesible. */
export function SectionCard({
  id,
  title,
  icon: Icon,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  icon?: LucideIcon;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `${id}-titulo`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("bg-card scroll-mt-24 rounded-3xl border p-5 shadow-xs sm:p-7 print:break-inside-avoid", className)}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="bg-sage-soft text-olive mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full print:hidden">
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 id={headingId} className="font-heading text-2xl leading-tight font-semibold sm:text-[1.7rem]">
              {title}
            </h2>
            {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
