import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Encabezado editorial de páginas interiores del sitio (con migas de pan accesibles).
 */
export function PageIntro({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Array<{ href?: string; label: string }>;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("container-page pt-10 pb-10 sm:pt-14 sm:pb-14 lg:pt-20", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Migas de pan" className="mb-8">
          <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
            {breadcrumbs.map((b, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <li key={`${b.label}-${i}`} className="flex items-center gap-1">
                  {b.href && !last ? (
                    <Link href={b.href} className="hover:text-foreground underline-offset-4 hover:underline">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className={cn(last && "text-foreground")}>
                      {b.label}
                    </span>
                  )}
                  {!last ? <ChevronRight className="size-3" aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h1 className="font-heading text-charcoal text-4xl leading-[1.02] font-medium text-balance sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed text-pretty">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
