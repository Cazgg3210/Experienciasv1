import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token opaco no adivinable (256 bits por defecto), apto para URLs. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Comparación en tiempo constante de strings. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Valida formato de token (base64url, longitud razonable) antes de consultar la DB. */
export function isPlausibleToken(token: string | undefined | null): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(token);
}
