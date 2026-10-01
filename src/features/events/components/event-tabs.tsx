"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type EventTab = { href: string; label: string; exact?: boolean };

/** Pestañas del evento como enlaces (aria-current en la activa; scroll horizontal en móvil). */
export function EventTabs({ tabs }: { tabs: EventTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del evento" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 -mb-px inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 sm:px-4",
                  active
                    ? "border-olive text-olive"
                    : "text-muted-foreground hover:text-foreground hover:border-sand border-transparent",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
