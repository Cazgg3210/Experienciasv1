import { Clock, Mail, MapPin } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/brand-icons";
import { instagramUrl, SERVICE_ZONES, WHATSAPP_DEFAULT_MESSAGE } from "@/components/site/nav-config";
import { Button } from "@/components/ui/button";
import { localDateKey } from "@/lib/dates";
import { ContactForm } from "@/features/marketing/components/contact-form";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { getSiteSettings } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";
import { normalizeMxPhone, whatsappLink } from "@/server/providers/whatsapp/links";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Contacto",
  description:
    "Escríbenos por WhatsApp o déjanos tu mensaje: te ayudamos a diseñar tu brunch o celebración íntima en Polanco, Granada o Irrigación.",
  path: "/contacto",
});

export default async function ContactPage() {
  const { business } = await getSiteSettings();
  const whatsappHref = whatsappLink(business.whatsappNumber, WHATSAPP_DEFAULT_MESSAGE);
  const handle = business.instagramHandle.replace(/^@/, "");

  return (
    <>
      <PageIntro
        eyebrow="Contacto"
        title="Platiquemos de tu próxima reunión."
        description="Cuéntanos qué quieres celebrar y te ayudamos a diseñarlo. La forma más rápida es WhatsApp; si prefieres, déjanos tu mensaje y te escribimos."
        breadcrumbs={[{ href: "/", label: "Inicio" }, { label: "Contacto" }]}
      />

      {/* Móvil: WhatsApp → formulario → datos de contacto. Escritorio: canales a la izquierda, formulario a la derecha. */}
      <div className="container-page grid gap-8 pb-24 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-6">
        <section aria-labelledby="canales-title" className="lg:col-span-5 lg:row-start-1">
          <div className="bg-olive text-ivory rounded-[1.75rem] p-7 sm:p-9">
            <h2 id="canales-title" className="font-heading text-3xl leading-tight font-medium">
              La forma más rápida: WhatsApp
            </h2>
            <p className="mt-3 leading-relaxed">
              Te respondemos personalmente, normalmente el mismo día. Ideal para dudas rápidas, fechas y cotizaciones.
            </p>
            <Button asChild size="xl" variant="secondary" className="bg-ivory text-charcoal hover:bg-sand-soft mt-7 w-full sm:w-auto">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-5" />
                Escríbenos por WhatsApp
              </a>
            </Button>
          </div>
        </section>

        <section aria-label="Formulario de contacto" className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <ContactForm minDate={localDateKey()} waNumber={normalizeMxPhone(business.whatsappNumber) ?? business.whatsappNumber} />
        </section>

        <aside aria-label="Otros medios de contacto" className="lg:col-span-5 lg:row-start-2 lg:self-start">
          <ul className="bg-card border-border/70 divide-border/70 divide-y rounded-[1.75rem] border">
            <li className="flex gap-4 p-6">
              <Mail className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-charcoal font-medium">Correo</p>
                <a href={`mailto:${business.contactEmail}`} className="text-muted-foreground hover:text-foreground break-all text-sm underline-offset-4 hover:underline">
                  {business.contactEmail}
                </a>
              </div>
            </li>
            <li className="flex gap-4 p-6">
              <InstagramIcon className="text-olive mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-charcoal font-medium">Instagram</p>
                <a
                  href={instagramUrl(handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                >
                  {`@${handle}`}
                </a>
              </div>
            </li>
            <li className="flex gap-4 p-6">
              <MapPin className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-charcoal font-medium">Zonas de servicio</p>
                <p className="text-muted-foreground text-sm">
                  {SERVICE_ZONES.join(" · ")}, {business.city}. Otras zonas cercanas sujetas a disponibilidad.
                </p>
              </div>
            </li>
            <li className="flex gap-4 p-6">
              <Clock className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-charcoal font-medium">Tiempo de respuesta</p>
                <p className="text-muted-foreground text-sm">Menos de 24 horas hábiles.</p>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}
