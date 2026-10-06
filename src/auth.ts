import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/db";
import { revokeSessionsOnSignOut } from "@/features/auth/server/session-service";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

class InvalidLogin extends CredentialsSignin {
  code = "credenciales_invalidas";
}
class TooManyAttempts extends CredentialsSignin {
  code = "demasiados_intentos";
}

// Hash dummy para igualar tiempos cuando el usuario no existe (evita enumeración por timing)
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const { email, password } = parsed.data;

        const limited = await rateLimit(`login:${email}`, { limit: 8, windowMs: 15 * 60 * 1000 });
        if (!limited.ok) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.active || !user.passwordHash || !ok) {
          logger.warn("auth.login_failed", { email });
          throw new InvalidLogin();
        }
        if (user.role === "CUSTOMER") throw new InvalidLogin();

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        logger.info("auth.login_ok", { userId: user.id, role: user.role });
        return { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  events: {
    /**
     * Revocación en servidor al cerrar sesión (POST /api/auth/signout o signOut() de servidor).
     * Borrar la cookie no basta: una copia del JWT, o una respuesta que estaba en vuelo, seguiría autorizando.
     * Si esto falla, Auth.js lo registra y de todos modos borra la cookie del navegador.
     */
    async signOut(message) {
      if ("token" in message) await revokeSessionsOnSignOut(message.token);
    },
  },
});
