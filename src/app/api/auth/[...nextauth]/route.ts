import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { withoutSessionCookieRenewal } from "@/features/auth/domain/session";

export const { POST } = handlers;

/**
 * `GET /api/auth/session` queda fuera del matcher del middleware y Auth.js vuelve a escribir la cookie de sesión
 * en cada llamada. Una llamada que estuviera en vuelo al cerrar sesión la reviviría en el navegador (mismo
 * patrón que BUG-001). La app no usa este endpoint (no hay SessionProvider/useSession): la renovación deslizante
 * la hace sólo el middleware en navegaciones GET, así que aquí nunca se re-emite. Los borrados se conservan.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const res = await handlers.GET(req);
  if (!req.nextUrl.pathname.endsWith("/session")) return res;
  const setCookies = res.headers.getSetCookie();
  const kept = withoutSessionCookieRenewal(setCookies);
  if (kept.length === setCookies.length) return res;
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  for (const cookie of kept) headers.append("set-cookie", cookie);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
