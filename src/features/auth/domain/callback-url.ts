/**
 * Validación pura de `callbackUrl` (sin I/O, apta para edge y cliente).
 *
 * Sólo se aceptan rutas internas del mismo sitio. No basta con revisar el prefijo de la cadena: los
 * navegadores eliminan TAB/CR/LF de las URL (WHATWG URL) y tratan `\` como `/`, así que `/\t/evil.example`
 * o `/\evil.example` terminan siendo `//evil.example` (URL relativa al protocolo → otro origen).
 * Por eso se rechazan caracteres de control, espacios y `\`, y la ruta se normaliza con el parser de URL
 * contra un origen ficticio: si el resultado cambia de origen o empieza con `//`, se descarta.
 */

const PLACEHOLDER_ORIGIN = "http://callback.invalid";
const MAX_LENGTH = 2048;
/** C0 (incluye TAB/CR/LF/NUL), DEL, C1, cualquier espacio en blanco Unicode y la diagonal invertida. */
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\s\\]/;

/**
 * Devuelve la ruta interna normalizada (`pathname + search + hash`) o `null` si no es segura.
 * Ejemplos: `/admin/leads?status=NEW` → igual; `/\t/evil.example`, `//evil.example`, `https://…` → `null`.
 */
export function safeCallbackPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/") || UNSAFE_CHARS.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  // `/..//evil.example` se normaliza a `//evil.example`: también sería relativa al protocolo.
  if (url.pathname.startsWith("//")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Regla para el callback `redirect` de Auth.js: acepta rutas internas seguras o URLs absolutas del mismo
 * origen (re-validando su ruta); cualquier otra cosa vuelve al inicio del sitio.
 */
export function safeRedirectUrl(url: string, baseUrl: string): string {
  if (url.startsWith("/")) {
    const path = safeCallbackPath(url);
    return path ? `${baseUrl}${path}` : baseUrl;
  }
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(baseUrl);
  } catch {
    return baseUrl;
  }
  if (parsed.origin !== base.origin) return baseUrl;
  const path = safeCallbackPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  return path ? `${base.origin}${path}` : baseUrl;
}
