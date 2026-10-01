/**
 * Decide si una imagen puede pasar por el optimizador de next/image.
 * - Archivos estáticos locales (sin query) que no son SVG → optimizar.
 * - Rutas de la API (URLs firmadas con query) o SVG → servir tal cual.
 * - Remotas sólo si el host está permitido en next.config (remotePatterns).
 */
const OPTIMIZABLE_REMOTE_HOSTS = [/\.r2\.cloudflarestorage\.com$/i, /\.digitaloceanspaces\.com$/i, /\.amazonaws\.com$/i];

export function canOptimizeImage(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("/")) {
    if (src.startsWith("//") || src.includes("?") || src.startsWith("/api/")) return false;
    return !/\.svg$/i.test(src);
  }
  try {
    const url = new URL(src);
    if (/\.svg$/i.test(url.pathname)) return false;
    if (url.protocol === "http:" && url.hostname === "localhost") return true;
    return url.protocol === "https:" && OPTIMIZABLE_REMOTE_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export const FALLBACK_EXPERIENCE_IMAGE = "/images/placeholders/brunch-table.svg";
