/** Imágenes del catálogo para next/image: rutas locales o URLs http(s) válidas; si no, un placeholder. */

export const PLACEHOLDER_IMAGES = {
  experience: "/images/placeholders/brunch-table.svg",
  style: "/images/placeholders/gallery-01.svg",
  addOn: "/images/placeholders/gallery-08.svg",
} as const;

/** Hosts remotos permitidos para optimizar (espejo de images.remotePatterns en next.config). */
const OPTIMIZABLE_REMOTE = [
  /\.r2\.cloudflarestorage\.com$/i,
  /\.digitaloceanspaces\.com$/i,
  /\.amazonaws\.com$/i,
];

export function isSvg(src: string): boolean {
  return /\.svg($|\?)/i.test(src);
}

/** Valida la URL guardada en el catálogo (la captura el admin) y cae al placeholder si no sirve. */
export function safeImageSrc(url: string | null | undefined, fallback: string): string {
  const v = url?.trim();
  if (!v || /\s/.test(v)) return fallback;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (/^https:\/\/[^/]+\//i.test(v) || /^http:\/\/localhost(:\d+)?\//i.test(v)) return v;
  return fallback;
}

/**
 * true si el optimizador de next/image puede procesarla. Las rutas /api/ (media firmada o con
 * redirección), las que llevan query string, los SVG y los hosts no configurados se sirven tal cual
 * (`unoptimized`), igual que en el sitio público.
 */
export function canOptimizeImage(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("/")) {
    if (src.startsWith("//") || src.startsWith("/api/") || src.includes("?")) return false;
    return !isSvg(src);
  }
  try {
    const url = new URL(src);
    if (isSvg(url.pathname)) return false;
    if (url.protocol === "http:" && url.hostname === "localhost") return true;
    return url.protocol === "https:" && OPTIMIZABLE_REMOTE.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}
