import { cn } from "@/lib/utils";

export type SectionLink = { id: string; label: string };

/**
 * Navegación interna del portal: chips con scroll horizontal (móvil, fija arriba)
 * y lista vertical fija en escritorio.
 */
export function SectionNav({ links, className }: { links: SectionLink[]; className?: string }) {
  return (
    <nav
      aria-label="Secciones de tu evento"
      className={cn(
        "bg-ivory/95 supports-backdrop-filter:bg-ivory/80 sticky top-0 z-30 -mx-4 border-b px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6",
        "lg:top-6 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none",
        "print:hidden",
        className,
      )}
    >
      <p className="eyebrow mb-3 hidden lg:block">En esta página</p>
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {links.map((l) => (
          <li key={l.id} className="shrink-0">
            <a
              href={`#${l.id}`}
              className={cn(
                "border-border bg-card text-foreground hover:bg-sage-soft focus-visible:ring-ring inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                "lg:h-9 lg:w-full lg:rounded-lg lg:border-transparent lg:bg-transparent lg:px-3",
              )}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
