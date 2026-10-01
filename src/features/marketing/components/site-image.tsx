import Image, { type ImageProps } from "next/image";
import { canOptimizeImage } from "../domain/images";

/**
 * next/image que decide solo si optimizar (SVG, URLs firmadas o hosts no permitidos se sirven tal cual).
 * Por defecto lazy; usa `priority` sólo en el hero.
 */
export function SiteImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  return <Image src={src} alt={alt} unoptimized={!canOptimizeImage(src)} {...props} />;
}
