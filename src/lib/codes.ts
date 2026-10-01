import { randomBytes } from "node:crypto";

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L)
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomChunk(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export type CodePrefix = "L" | "Q" | "B" | "EV" | "P";

/**
 * Código legible para humanos (no secuencial, no expone volumen):
 * L-2610-7KQ3 => prefijo-AAMM-aleatorio
 */
export function generateCode(prefix: CodePrefix, date: Date = new Date()): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}-${yy}${mm}-${randomChunk(4)}`;
}

/** Código de referido para clientas, ej. IR-SOFIA-7K3Q */
export function generateReferralCode(name: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 6) || "AMIGA";
  return `IR-${base}-${randomChunk(4)}`;
}
