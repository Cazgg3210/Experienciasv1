import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { WhatsAppFab } from "@/components/site/whatsapp-fab";
import { WHATSAPP_DEFAULT_MESSAGE } from "@/components/site/nav-config";
import { getSiteSettings } from "@/features/marketing/server/queries";
import { whatsappLink } from "@/server/providers/whatsapp/links";

/**
 * Layout del sitio público (marketing + configurador).
 * Genérico: header, <main id="contenido">, footer y botón flotante de WhatsApp.
 *
 * NO agregar `loading.tsx` en `(public)/` ni en `experiencias/`, ni envolver `children` en <Suspense>:
 * `experiencias/[slug]/layout.tsx` valida el slug antes de cualquier límite de carga para responder un
 * 404 real (BUG-013). Los esqueletos viven en cada segmento hoja o en los grupos `(inicio)` y `(catalogo)`.
 * Lo vigila tests/unit/route-not-found-contract.test.ts.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { business } = await getSiteSettings();
  const whatsappHref = whatsappLink(business.whatsappNumber, WHATSAPP_DEFAULT_MESSAGE);
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <SiteHeader brandName={business.brandName} whatsappHref={whatsappHref} />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
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
