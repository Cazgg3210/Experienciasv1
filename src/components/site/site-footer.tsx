import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { localDateKey } from "@/lib/dates";
import { InstagramIcon, WhatsAppIcon } from "./brand-icons";
import { instagramUrl, SERVICE_ZONES, SITE_NAV } from "./nav-config";

/** Pie del sitio público: promesa, zonas, contacto y enlaces legales. */
export function SiteFooter({
  brandName,
  tagline,
  city,
  email,
  instagramHandle,
  whatsappHref,
}: {
  brandName: string;
  tagline: string;
  city: string;
  email: string;
  instagramHandle: string;
  whatsappHref: string;
}) {
  // Año en la zona del negocio (America/Mexico_City), no la del servidor.
  const year = localDateKey().slice(0, 4);
  return (
    <footer className="bg-sand-soft border-border/70 border-t" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Información de {brandName}
      </h2>
      <div className="container-page grid gap-12 py-14 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <p className="font-heading text-3xl font-semibold">{brandName}</p>
          <p className="font-heading text-olive mt-4 max-w-sm text-2xl leading-snug italic">{tagline}</p>
          <p className="text-muted-foreground mt-6 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {SERVICE_ZONES.join(" · ")}
              <span className="block">{city}</span>
            </span>
          </p>
        </div>

        <nav aria-label="Sitio" className="md:col-span-3">
          <p className="eyebrow mb-4">Explora</p>
          <ul className="space-y-2.5 text-sm">
            {SITE_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-olive transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/crear-experiencia" className="hover:text-olive transition-colors">
                Diseña tu experiencia
              </Link>
            </li>
            <li>
              <Link href="/mi-evento" className="hover:text-olive transition-colors">
                Mi evento
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <p className="eyebrow mb-4">Platiquemos</p>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-olive inline-flex items-center gap-2 transition-colors"
              >
                <WhatsAppIcon className="size-4" />
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href={instagramUrl(instagramHandle)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-olive inline-flex items-center gap-2 transition-colors"
              >
                <InstagramIcon className="size-4" />
                {`@${instagramHandle.replace(/^@/, "")}`}
              </a>
            </li>
            <li>
              <a href={`mailto:${email}`} className="hover:text-olive inline-flex items-center gap-2 break-all transition-colors">
                <Mail className="size-4 shrink-0" aria-hidden />
                {email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-border/70 border-t">
        <div className="container-page text-muted-foreground flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brandName}. Hecho con cariño en {city}.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li>
              <Link href="/privacidad" className="hover:text-foreground transition-colors">
                Aviso de privacidad
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="hover:text-foreground transition-colors">
                Términos y condiciones
              </Link>
            </li>
            <li>
              {/* Discreto pero legible (sin opacidad: debe cumplir contraste AA 4.5:1) */}
              <Link href="/login" className="hover:text-foreground transition-colors" rel="nofollow">
                Equipo
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
