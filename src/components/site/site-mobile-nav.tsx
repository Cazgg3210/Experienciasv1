"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CalendarHeart, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./brand-icons";
import { isActivePath, MY_EVENT_LINK, SITE_CTA, SITE_NAV } from "./nav-config";

/** Menú móvil (Sheet) del sitio público. */
export function SiteMobileNav({ whatsappHref, className }: { whatsappHref: string; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn("rounded-full", className)}
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="bg-ivory w-[88vw] max-w-sm gap-0 p-0">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <SheetTitle className="font-heading text-xl font-semibold">Menú</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Cerrar menú">
              <X className="size-5" aria-hidden />
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">Navegación del sitio Ivonne &amp; Rosa</SheetDescription>
        <nav aria-label="Principal (móvil)" className="flex-1 overflow-y-auto px-6 py-6">
          <ul className="space-y-1">
            {SITE_NAV.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "font-heading flex items-center justify-between rounded-xl px-3 py-3 text-2xl transition-colors",
                        active ? "bg-sage-soft text-olive" : "hover:bg-sand-soft",
                      )}
                    >
                      {item.label}
                      <ArrowRight className="text-taupe size-4" aria-hidden />
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 border-t pt-6">
            <SheetClose asChild>
              <Link
                href={MY_EVENT_LINK.href}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <CalendarHeart className="size-4" aria-hidden />
                {MY_EVENT_LINK.label}
              </Link>
            </SheetClose>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <WhatsAppIcon className="size-4" />
              Escríbenos por WhatsApp
            </a>
          </div>
        </nav>
        <div className="border-t p-6">
          <SheetClose asChild>
            <Button asChild size="xl" className="w-full">
              <Link href={SITE_CTA.href}>{SITE_CTA.label}</Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
