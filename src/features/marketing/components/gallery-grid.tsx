import { cn } from "@/lib/utils";
import type { SiteImage as SiteImageData } from "../server/queries";
import { SiteImage } from "./site-image";

/** Con 8 imágenes, estas posiciones ocupan dos filas: llenan exacto 4×3 (escritorio) y 2×6 (móvil). */
const MOSAIC_TALL = new Set([0, 2, 4, 5]);

/**
 * Galería editorial tipo mosaico (sin huecos con 8 imágenes; cuadrícula uniforme con otra cantidad).
 */
export function GalleryGrid({ images, className }: { images: SiteImageData[]; className?: string }) {
  if (images.length === 0) return null;
  return (
    <ul className={cn("grid grid-flow-dense auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[200px] sm:gap-4 lg:grid-cols-4", className)}>
      {images.map((img, i) => {
        const tall = images.length === 8 && MOSAIC_TALL.has(i);
        return (
          <li
            key={`${img.src}-${i}`}
            className={cn(
              "bg-sand-soft group relative overflow-hidden rounded-2xl",
              tall && "row-span-2",
            )}
          >
            <SiteImage
              src={img.src}
              alt={img.alt}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
            />
          </li>
        );
      })}
    </ul>
  );
}
