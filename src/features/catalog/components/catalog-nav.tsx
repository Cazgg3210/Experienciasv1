"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/catalog", label: "Experiencias", match: ["/admin/catalog/experiences"] },
  { href: "/admin/catalog/menus", label: "Menús" },
  { href: "/admin/catalog/addons", label: "Add-ons" },
  { href: "/admin/catalog/styles", label: "Estilos" },
  { href: "/admin/catalog/areas", label: "Zonas" },
  { href: "/admin/catalog/budgets", label: "Presupuestos" },
] as const;

function isActive(pathname: string, tab: (typeof TABS)[number]) {
  if (tab.href === "/admin/catalog") {
    return pathname === "/admin/catalog" || ("match" in tab && tab.match.some((m) => pathname.startsWith(m)));
  }
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/** Sub-navegación del catálogo (pestañas con aria-current). */
export function CatalogNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del catálogo" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="bg-sand-soft/70 inline-flex min-w-max gap-1 rounded-full border p-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
                  active
                    ? "bg-background text-olive font-medium shadow-xs"
                    : "text-foreground/75 hover:text-foreground hover:bg-background/60",
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
