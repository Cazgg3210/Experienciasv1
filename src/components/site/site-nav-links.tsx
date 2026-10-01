"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, SITE_NAV } from "./nav-config";

/** Enlaces principales (escritorio) con estado activo accesible (aria-current). */
export function SiteNavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {SITE_NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-full px-3 py-2 text-sm transition-colors",
                "text-foreground/75 hover:text-foreground",
                "after:bg-olive after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100",
                active && "text-foreground after:scale-x-100",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
