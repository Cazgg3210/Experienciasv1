import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MY_EVENT_LINK, SITE_CTA } from "./nav-config";
import { SiteMobileNav } from "./site-mobile-nav";
import { SiteNavLinks } from "./site-nav-links";

/** Encabezado del sitio público: sticky, translúcido, con menú móvil. */
export function SiteHeader({ brandName, whatsappHref }: { brandName: string; whatsappHref: string }) {
  return (
    <header className="border-border/60 bg-ivory/90 supports-[backdrop-filter]:bg-ivory/75 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <Logo name={brandName} subtitle="Experiencias íntimas · CDMX" className="text-charcoal" />
        <nav aria-label="Principal" className="hidden lg:block">
          <SiteNavLinks />
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href={MY_EVENT_LINK.href}
            className="text-muted-foreground hover:text-foreground hidden rounded-full px-3 py-2 text-sm transition-colors md:inline-flex"
          >
            {MY_EVENT_LINK.label}
          </Link>
          <Button asChild className="hidden h-10 rounded-full px-5 sm:inline-flex">
            <Link href={SITE_CTA.href}>{SITE_CTA.label}</Link>
          </Button>
          <SiteMobileNav whatsappHref={whatsappHref} className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}
