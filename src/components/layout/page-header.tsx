import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Encabezado estándar de páginas del admin/staff.
 * <PageHeader title="Leads" description="..." actions={<Button/>} back={{href:"/admin", label:"Resumen"}} />
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {back ? (
          <Link
            href={back.href}
            className="text-muted-foreground hover:text-foreground mb-1 inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="font-heading text-3xl leading-tight font-semibold text-balance sm:text-4xl">{title}</h1>
        {description ? <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Sección con título dentro de una página */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {title ? <h2 className="font-heading text-2xl font-semibold">{title}</h2> : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
