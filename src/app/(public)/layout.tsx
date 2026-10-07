import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { WhatsAppFab } from "@/components/site/whatsapp-fab";
import { WHATSAPP_DEFAULT_MESSAGE } from "@/components/site/nav-config";
import { getSiteSettings } from "@/features/marketing/server/queries";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { SegmentChildren } from "@/components/layout/segment-children";

/**
 * Layout del sitio público (marketing + configurador).
 * Genérico: header, <main id="contenido">, footer y botón flotante de WhatsApp.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { business } = await getSiteSettings();
  const whatsappHref = whatsappLink(business.whatsappNumber, WHATSAPP_DEFAULT_MESSAGE);
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <SiteHeader brandName={business.brandName} whatsappHref={whatsappHref} />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <SegmentChildren>{children}</SegmentChildren>
      </main>
      <SiteFooter
        brandName={business.brandName}
        tagline={business.tagline}
        city={business.city}
        email={business.contactEmail}
        instagramHandle={business.instagramHandle}
        whatsappHref={whatsappHref}
      />
      <WhatsAppFab href={whatsappHref} />
    </div>
  );
}
