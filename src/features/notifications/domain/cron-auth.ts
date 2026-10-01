import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuthDecision = "ok" | "unauthorized" | "unconfigured";

/**
 * Autoriza una llamada de cron con `Authorization: Bearer <CRON_SECRET>`.
 * - Sin CRON_SECRET configurado: "unconfigured" (503) — falla cerrado.
 * - Comparación en tiempo constante (hash SHA-256 de ambos lados: misma longitud siempre).
 */
export function decideCronAuth(authorization: string | null | undefined, secret: string | null | undefined): CronAuthDecision {
  if (!secret) return "unconfigured";
  if (!authorization) return "unauthorized";
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const provided = match?.[1]?.trim() ?? "";
  if (!provided) return "unauthorized";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b) ? "ok" : "unauthorized";
}
