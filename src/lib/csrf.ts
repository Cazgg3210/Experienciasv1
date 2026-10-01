import "server-only";
import { env } from "@/lib/env";

/**
 * Protección CSRF para Route Handlers con efectos (POST/PUT/DELETE) que no son Server Actions.
 * (Las Server Actions de Next ya validan Origin vs Host.)
 * Acepta el request si Origin (o Referer) coincide con el host del request o con APP_URL.
 */
export function isSameOrigin(req: Request): boolean {
  // Navegadores modernos: Fetch Metadata es la señal más confiable (no depende de Referrer-Policy)
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin") return true;
  if (site === "cross-site" || site === "same-site") return false;
  const origin = req.headers.get("origin") ?? refererOrigin(req.headers.get("referer"));
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host && o.host === host) return true;
    return o.host === new URL(env().APP_URL).host;
  } catch {
    return false;
  }
}

function refererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
