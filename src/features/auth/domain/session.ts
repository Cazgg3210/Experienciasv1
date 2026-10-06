/**
 * Reglas puras de la sesión del equipo (JWT de Auth.js). Sin I/O: se usan en el middleware (edge),
 * en `getCurrentUser` (servidor) y en pruebas unitarias.
 *
 * Revocación: cada usuaria tiene `User.sessionVersion`. El JWT guarda la versión vigente al iniciar sesión;
 * cerrar sesión, restablecer la contraseña, desactivar la cuenta o cambiar su rol incrementa la versión
 * en la base y todos los JWT emitidos antes dejan de autorizar (aunque alguien conserve una copia de la cookie).
 */

/** Versión que trae el token. Un token emitido antes de existir la revocación (sin versión) cuenta como 0. */
export function tokenSessionVersion(value: unknown): number | null {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  return null; // valor inesperado: nunca coincide (falla cerrado)
}

/** ¿El token sigue vigente frente a la versión guardada en la base? */
export function isSessionVersionCurrent(tokenValue: unknown, currentVersion: number): boolean {
  const version = tokenSessionVersion(tokenValue);
  return version !== null && version === currentVersion;
}

/**
 * Renovación deslizante con límite de frecuencia: la cookie de sesión sólo se vuelve a emitir cuando el JWT
 * tiene al menos `updateAgeSeconds` de antigüedad (`iat` en segundos). Sin `iat` válido se renueva.
 * Así casi ninguna respuesta re-escribe la cookie y una respuesta que estaba en vuelo al cerrar sesión no la revive.
 */
export function isSessionRenewalDue(issuedAt: unknown, nowMs: number, updateAgeSeconds: number): boolean {
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) return true;
  return Math.floor(nowMs / 1000) - issuedAt >= updateAgeSeconds;
}

/** `Set-Cookie` de la cookie de sesión de Auth.js (incluye prefijo `__Secure-` y fragmentos `.0`, `.1`…). */
const SESSION_COOKIE = /^\s*(?:__Secure-)?authjs\.session-token(?:\.\d+)?=([^;]*)/i;

/**
 * Quita de una lista de `Set-Cookie` las que vuelven a escribir la cookie de sesión con un valor.
 * Conserva las que la borran (valor vacío: token inválido o vencido) y cualquier otra cookie.
 */
export function withoutSessionCookieRenewal(setCookies: readonly string[]): string[] {
  return setCookies.filter((cookie) => {
    const match = SESSION_COOKIE.exec(cookie);
    return !match || match[1] === "";
  });
}
