import { InstagramIcon } from "@/components/site/brand-icons";
import { instagramUrl } from "@/components/site/nav-config";
import { cn } from "@/lib/utils";
import { SiteImage } from "./site-image";

const TILES = [
  { src: "/images/placeholders/gallery-03.svg", alt: "Detalle de mesa con flores de temporada" },
  { src: "/images/placeholders/mimosas.svg", alt: "Barra de mimosas" },
  { src: "/images/placeholders/gallery-06.svg", alt: "Brindis entre amigas" },
  { src: "/images/placeholders/birthday-cake.svg", alt: "Pastel de cumpleaños con velitas" },
  { src: "/images/placeholders/gallery-07.svg", alt: "Centro de mesa con velas" },
  { src: "/images/placeholders/peru-mexico.svg", alt: "Sabores de Perú y México" },
];

/** Mosaico de Instagram (placeholder hasta conectar el feed) + enlace al perfil. */
export function InstagramGrid({ handle, className }: { handle: string; className?: string }) {
  const clean = handle.replace(/^@/, "");
  const href = instagramUrl(clean);
  return (
    <div className={cn("space-y-8", className)}>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {TILES.map((tile) => (
          <li key={tile.src} className="bg-sand-soft group relative aspect-square overflow-hidden rounded-xl">
            <a href={href} target="_blank" rel="noopener noreferrer" className="block size-full" aria-label={`${tile.alt} — ver en Instagram`}>
              <SiteImage
                src={tile.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 16vw, 33vw"
                className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.05]"
              />
              <span className="bg-charcoal/0 group-hover:bg-charcoal/25 absolute inset-0 flex items-center justify-center transition-colors">
                <InstagramIcon className="text-ivory size-6 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-center">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-heading text-olive hover:text-charcoal inline-flex items-center gap-2 text-2xl transition-colors"
        >
          <InstagramIcon className="size-5" />
          {`@${clean}`}
        </a>
      </p>
    </div>
  );
}
