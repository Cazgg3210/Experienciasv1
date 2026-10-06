import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/server/auth/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      /** Versión de sesión del JWT (revocación); ver src/features/auth/domain/session.ts */
      sessionVersion?: number;
    } & DefaultSession["user"];
  }
  interface User {
    role?: AppRole;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
    /** Ausente en tokens emitidos antes de la revocación: cuenta como 0. */
    sessionVersion?: number;
  }
}
