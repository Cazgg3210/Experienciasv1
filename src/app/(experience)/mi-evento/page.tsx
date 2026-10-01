import { Suspense } from "react";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getSettings } from "@/features/settings/server/settings-service";
import { defaultSettings } from "@/features/settings/domain/settings-schema";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { AccessForm } from "@/features/portal/components/access-form";
import { BrandBar } from "@/features/portal/components/brand-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entra a tu evento",
  description: "Recibe por correo tu enlace personal al portal de tu celebración.",
};

// Si la configuración no está disponible, la página sigue funcionando con los valores por defecto.
const loadBusiness = () => getSettings("business").catch(() => defaultSettings("business"));

/**
 * "Entra a tu evento". El formulario no depende de datos: se muestra de inmediato y sólo la marca y
 * el enlace de ayuda se transmiten después (Suspense). Sin loading.tsx en este segmento a propósito:
 * envolvería también /mi-evento/[token] y un token inválido dejaría de responder 404.
 */
export default function PortalAccessPage() {
  return (
    <>
      <Suspense fallback={<BrandBar />}>
        <AccessBrandBar />
      </Suspense>
      <main
        id="contenido"
        className="bg-ivory flex min-h-[calc(100dvh-3.5rem)] items-start justify-center px-4 py-10 sm:items-center sm:py-16"
      >
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl border p-6 shadow-xs sm:p-8">
            <p className="eyebrow">Mi evento</p>
            <h1 className="font-heading mt-2 text-4xl leading-tight font-semibold">Entra a tu evento</h1>
            <p className="text-muted-foreground mt-3">
              Escribe el correo con el que reservaste y te enviaremos tu enlace personal. Desde ahí puedes invitar a
              tus amigas, ver el menú, pagar y platicar con nosotras.
            </p>
            <div className="mt-6">
              <AccessForm />
            </div>
          </div>
          <Suspense fallback={<p className="mt-6 h-5" aria-hidden />}>
            <HelpLink />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function AccessBrandBar() {
  const business = await loadBusiness();
  return <BrandBar brandName={business.brandName} />;
}

async function HelpLink() {
  const business = await loadBusiness();
  const wa = whatsappLink(business.whatsappNumber, "Hola, no encuentro el enlace a mi evento. ¿Me ayudan?");
  return (
    <p className="text-muted-foreground mt-6 text-center text-sm">
      ¿No te llega el correo?{" "}
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="text-olive inline-flex items-center gap-1 font-medium underline underline-offset-4"
      >
        <MessageCircle className="size-4" aria-hidden /> Escríbenos por WhatsApp
        <span className="sr-only">(se abre en otra pestaña)</span>
      </a>
    </p>
  );
}
