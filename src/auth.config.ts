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
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 h
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as AppRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
