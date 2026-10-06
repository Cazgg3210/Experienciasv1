import NextAuth, { type NextAuthRequest } from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { isSessionRenewalDue, withoutSessionCookieRenewal } from "@/features/auth/domain/session";

const BACKOFFICE = new Set(["SUPER_ADMIN", "OWNER"]);
const STAFF_AREA = new Set(["SUPER_ADMIN", "OWNER", "STAFF"]);
const TOKEN_PREFIXES = ["/mi-evento", "/e/", "/memory", "/cotizacion", "/pago"];
const NOINDEX_PREFIXES = ["/admin", "/staff", "/login", ...TOKEN_PREFIXES];

/**
 * Instancia de Auth.js sólo para el middleware: además de la sesión expone si el JWT ya tiene la antigüedad
 * mínima para renovarse (`session.updateAge`). No se filtra al cliente (no es la del endpoint /api/auth).
 */
const { auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    session(params) {
      const session = authConfig.callbacks.session(params);
      const issuedAt = "token" in params ? params.token?.iat : undefined;
      return Object.assign(session, {
        renewalDue: isSessionRenewalDue(issuedAt, Date.now(), authConfig.session.updateAge),
      });
    },
  },
});

/**
 * Primera barrera para /admin y /staff (el RBAC fino y la revocación de sesión se validan otra vez en servidor
 * con getCurrentUser) + cabeceras de privacidad en zonas privadas.
 */
function gate(req: NextAuthRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  const role = req.auth?.user?.role as string | undefined;

  const needsBackoffice = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsStaff = pathname === "/staff" || pathname.startsWith("/staff/");
  if (needsBackoffice || needsStaff) {
    if (!role) {
      const login = new URL("/login", req.nextUrl.origin);
      login.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
    const allowed = needsBackoffice ? BACKOFFICE.has(role) : STAFF_AREA.has(role);
    if (!allowed) {
      const target = role === "STAFF" ? "/staff" : "/sin-acceso";
      return NextResponse.redirect(new URL(target, req.nextUrl.origin));
    }
  }

  const res = NextResponse.next();
  if (NOINDEX_PREFIXES.some((p) => pathname.startsWith(p))) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  // URLs con token: nunca enviar la ruta a terceros. `same-origin` (no `no-referrer`) para que los
  // POST del mismo sitio conserven un Origin válido (Server Actions y verificación CSRF).
  if (TOKEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    res.headers.set("Referrer-Policy", "same-origin");
  }
  return res;
}

/**
 * Con sesión JWT, Auth.js re-emite la cookie de sesión en CADA respuesta del middleware (incluidos prefetch y
 * Server Actions). Una respuesta que estaba en vuelo al cerrar sesión volvía a escribir la cookie borrada y la
 * sesión revivía (BUG-001). Aquí sólo se deja pasar esa re-emisión en GET y cuando el JWT ya cumplió `updateAge`
 * (renovación deslizante, como mucho una vez por hora); los borrados de la cookie y las demás cookies se conservan.
 * Si aun así una cookie revive en esa ventana, ya está revocada en servidor (`sessionVersion`) y no autoriza.
 */
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  let renew = false;
  const run = auth((req: NextAuthRequest, _event: NextFetchEvent) => {
    renew = req.method === "GET" && (req.auth as { renewalDue?: boolean } | null)?.renewalDue === true;
    return gate(req);
  });
  const res = await run(request, event);
  if (res && !renew) {
    const setCookies = res.headers.getSetCookie();
    const kept = withoutSessionCookieRenewal(setCookies);
    if (kept.length !== setCookies.length) {
      res.headers.delete("set-cookie");
      for (const cookie of kept) res.headers.append("set-cookie", cookie);
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images/|robots.txt|sitemap.xml).*)"],
};
