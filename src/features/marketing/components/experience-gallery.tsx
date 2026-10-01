import { cn } from "@/lib/utils";
import type { SiteImage as SiteImageData } from "../server/queries";
import { SiteImage } from "./site-image";

/** Galería del detalle: imagen principal + secundarias en mosaico (sin JS). */
export function ExperienceGallery({ images, name }: { images: SiteImageData[]; name: string }) {
  const [main, ...rest] = images;
  if (!main) return null;
  const secondary = rest.slice(0, 4);
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-sand-soft relative aspect-[4/3] overflow-hidden rounded-[1.75rem]">
        <SiteImage
          src={main.src}
          alt={main.alt || name}
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover"
        />
      </div>
      {secondary.length > 0 ? (
        <ul className={cn("grid gap-3 sm:gap-4", secondary.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {secondary.map((img, i) => (
            <li
              key={`${img.src}-${i}`}
              className={cn(
                "bg-sand-soft relative overflow-hidden rounded-2xl",
                secondary.length === 3 && i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-[4/3]",
              )}
            >
              <SiteImage src={img.src} alt={img.alt} fill sizes="(min-width: 1024px) 29vw, 50vw" className="object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
