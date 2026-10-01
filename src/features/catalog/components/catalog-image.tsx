import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Imagen de catálogo dentro de un contenedor relativo con aspect ratio.
 * Placeholders locales (/images/...) se optimizan; assets subidos (/api/media/...) y URLs externas
 * se sirven tal cual (pueden llevar query strings o hosts no configurados).
 */
export function CatalogImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={cn("bg-sand-soft text-taupe absolute inset-0 flex items-center justify-center", className)}
        role="img"
        aria-label={alt ? `${alt} (sin imagen)` : "Sin imagen"}
      >
        <ImageIcon className="size-8 opacity-70" aria-hidden />
      </div>
    );
  }
  const optimizable = src.startsWith("/images/");
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!optimizable}
      className={cn("object-cover", className)}
    />
  );
}
