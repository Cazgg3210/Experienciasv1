import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Middleware edge: protege /admin y /staff (RBAC fino se valida de nuevo en servidor),
 * y agrega cabeceras de seguridad + noindex en zonas privadas.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  const privatePrefixes = ["/admin", "/staff", "/mi-evento", "/e/", "/memory", "/cotizacion", "/pago", "/login"];
  if (privatePrefixes.some((p) => pathname.startsWith(p))) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  // Tokens en URL: no filtrar el path completo por Referer a terceros
  if (["/mi-evento", "/e/", "/memory", "/cotizacion", "/pago"].some((p) => pathname.startsWith(p))) {
    res.headers.set("Referrer-Policy", "no-referrer");
  }
  return res;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images/|robots.txt|sitemap.xml).*)"],
};
