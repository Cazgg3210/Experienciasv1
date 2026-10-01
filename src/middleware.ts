import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const BACKOFFICE = new Set(["SUPER_ADMIN", "OWNER"]);
const STAFF_AREA = new Set(["SUPER_ADMIN", "OWNER", "STAFF"]);
const TOKEN_PREFIXES = ["/mi-evento", "/e/", "/memory", "/cotizacion", "/pago"];
const NOINDEX_PREFIXES = ["/admin", "/staff", "/login", ...TOKEN_PREFIXES];

/**
 * Middleware edge: primera barrera para /admin y /staff (el RBAC fino se valida otra vez en servidor)
 * + cabeceras de privacidad en zonas privadas.
 */
export default auth((req) => {
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
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images/|robots.txt|sitemap.xml).*)"],
};
