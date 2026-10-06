import type { NextAuthConfig } from "next-auth";
import type { AppRole } from "@/server/auth/permissions";

/**
 * Configuración edge-safe de Auth.js (usada por middleware). Sin Prisma ni bcrypt aquí.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // maxAge: inactividad máxima (12 h). updateAge: el middleware sólo re-emite la cookie de sesión cuando el JWT
  // tiene al menos 1 h (src/middleware.ts); Auth.js no lo aplica a JWT por sí mismo.
  session: { strategy: "jwt", maxAge: 60 * 60 * 12, updateAge: 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    // La autorización por ruta vive en src/middleware.ts (redirige con callbackUrl correcto).
    authorized() {
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: AppRole }).role ?? "STAFF";
        token.name = user.name;
        token.email = user.email;
        // Versión de sesión vigente al iniciar sesión (revocación: getCurrentUser la compara con la base).
        token.sessionVersion = user.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as AppRole;
        session.user.sessionVersion = token.sessionVersion as number | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
