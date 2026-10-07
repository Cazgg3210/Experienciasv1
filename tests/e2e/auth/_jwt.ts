/**
 * JWT de sesión de Auth.js forjados con el mismo secreto que el servidor (AUTH_SECRET de .env, leído por
 * playwright.config) para probar la renovación deslizante del middleware sin esperar una hora real.
 *
 * `encode` de Auth.js siempre fija `iat` = ahora; para un token «antiguo» se corre el reloj del proceso de la
 * prueba sólo mientras se cifra (el servidor no se toca). El token es auténtico: mismo algoritmo, sal y secreto.
 */
import { decode, encode } from "next-auth/jwt";
import { SESSION_COOKIE } from "../permissions/_helpers";

const MAX_AGE = 60 * 60 * 12; // = authConfig.session.maxAge

function authSecret(): string {
  const v = process.env.AUTH_SECRET;
  if (!v) throw new Error("AUTH_SECRET no está definida en .env (necesaria para forjar el JWT)");
  return v;
}

export type SessionClaims = {
  uid: string;
  role: string;
  name: string;
  email: string;
  sessionVersion: number;
};

/** JWT cifrado (JWE) como el que emite Auth.js, con `iat` de hace `ageSeconds`. */
export async function forgeSessionToken(claims: SessionClaims, ageSeconds = 0): Promise<string> {
  const RealDate = Date;
  const shiftMs = ageSeconds * 1000;
  class ShiftedDate extends RealDate {
    constructor(value?: string | number | Date) {
      super(value === undefined ? RealDate.now() - shiftMs : value);
    }
    static override now() {
      return RealDate.now() - shiftMs;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
  try {
    return await encode({
      token: { ...claims, sub: claims.uid },
      secret: authSecret(),
      salt: SESSION_COOKIE,
      maxAge: MAX_AGE,
    });
  } finally {
    globalThis.Date = RealDate;
  }
}

/** Descifra una cookie de sesión emitida por el servidor (null si no es válida). */
export async function readSessionToken(value: string): Promise<Record<string, unknown> | null> {
  return (await decode({ token: value, secret: authSecret(), salt: SESSION_COOKIE })) as Record<
    string,
    unknown
  > | null;
}

/** Valores de `Set-Cookie` de la cookie de sesión en una respuesta ("" = borrado). */
export function sessionSetCookies(headers: Array<{ name: string; value: string }>): string[] {
  const out: string[] = [];
  for (const h of headers) {
    if (h.name.toLowerCase() !== "set-cookie") continue;
    for (const line of h.value.split("\n")) {
      const m = /^\s*(?:__Secure-)?authjs\.session-token(?:\.\d+)?=([^;]*)/i.exec(line);
      if (m) out.push(m[1]!);
    }
  }
  return out;
}
