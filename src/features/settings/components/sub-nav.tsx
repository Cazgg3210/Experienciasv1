"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Building2,
  CalendarClock,
  BellRing,
  FlaskConical,
  HelpCircle,
  Images,
  PlugZap,
  Quote,
  ScrollText,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  business: Building2,
  pricing: BadgePercent,
  availability: CalendarClock,
  notifications: BellRing,
  flags: FlaskConical,
  integrations: PlugZap,
  users: UserCog,
  audit: ScrollText,
  testimonials: Quote,
  faq: HelpCircle,
  gallery: Images,
} satisfies Record<string, LucideIcon>;

export type SubNavIcon = keyof typeof ICONS;
export type SubNavItem = { href: string; label: string; icon?: SubNavIcon; exact?: boolean };

/**
 * Sub-navegación de secciones (vertical en escritorio, scroll horizontal en móvil).
 * Los íconos se pasan por nombre porque los componentes no se serializan desde el servidor.
 */
export function SubNav({
  items,
  label,
  orientation = "responsive",
}: {
  items: SubNavItem[];
  label: string;
  /** responsive: vertical en escritorio; horizontal: siempre en fila */
  orientation?: "responsive" | "horizontal";
}) {
  const vertical = orientation === "responsive";
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("-mx-4", vertical ? "lg:mx-0" : "sm:mx-0")}>
      <ul
        className={cn(
          "flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]",
          vertical ? "lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0" : "sm:flex-wrap sm:px-0",
        )}
      >
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon ? ICONS[item.icon] : null;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                  vertical && "lg:rounded-lg lg:border-transparent",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                  active
                    ? "bg-sage-soft text-olive border-sage/40 font-medium"
                    : cn("text-muted-foreground hover:bg-muted hover:text-foreground border-border bg-card", vertical && "lg:bg-transparent"),
                )}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
