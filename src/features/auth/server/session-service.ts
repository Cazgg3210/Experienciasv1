import "server-only";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";
import { tokenSessionVersion } from "../domain/session";

/**
 * Fragmento de `data` para `user.update`: invalida TODAS las sesiones abiertas de la usuaria
 * (los JWT emitidos antes conservan la versión anterior y getCurrentUser los rechaza).
 * Se usa al restablecer la contraseña, desactivar la cuenta o cambiar su rol, en el mismo update.
 */
export const REVOKE_ALL_SESSIONS = { sessionVersion: { increment: 1 } } as const;

/**
 * Cerrar sesión (evento `signOut` de Auth.js, con el JWT ya descifrado y verificado):
 * incrementa la versión sólo si el token sigue vigente (comparar-e-incrementar atómico), así una cookie
 * vieja o ya revocada no puede usarse para cerrar las sesiones nuevas de la usuaria.
 * Devuelve si se revocó algo.
 */
export async function revokeSessionsOnSignOut(token: Record<string, unknown> | null): Promise<boolean> {
  const userId = typeof token?.uid === "string" ? token.uid : null;
  const version = tokenSessionVersion(token?.sessionVersion);
  if (!userId || version === null) return false;
  const { count } = await prisma.user.updateMany({
    where: { id: userId, sessionVersion: version },
    data: REVOKE_ALL_SESSIONS,
  });
  logger.info("auth.logout", { userId, sessionsRevoked: count > 0 });
  return count > 0;
}
