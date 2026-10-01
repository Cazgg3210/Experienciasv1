import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date };

/**
 * Rate limit de ventana fija persistido en PostgreSQL (compartido entre instancias/réplicas).
 * Si la DB falla, se degrada a un limitador en memoria del proceso.
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return { ok: true, remaining: opts.limit, resetAt: new Date(Date.now() + opts.windowMs) };
  }
  const resetCandidate = new Date(Date.now() + opts.windowMs);
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetCandidate})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" < NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" < NOW() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0]!;
    return { ok: row.count <= opts.limit, remaining: Math.max(0, opts.limit - row.count), resetAt: row.resetAt };
  } catch (error) {
    logger.warn("rate_limit.db_fallback", { error });
    return memoryLimit(key, opts);
  }
}

const memory = new Map<string, { count: number; resetAt: number }>();
function memoryLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, resetAt: new Date(now + opts.windowMs) };
  }
  entry.count += 1;
  return { ok: entry.count <= opts.limit, remaining: Math.max(0, opts.limit - entry.count), resetAt: new Date(entry.resetAt) };
}

/**
 * IP del cliente detrás del proxy. En Dokploy, Traefik fija X-Real-Ip y AGREGA la IP que ve al final de
 * X-Forwarded-For; las entradas de la izquierda las puede inventar el cliente. Por eso se usa X-Real-Ip o la
 * entrada TRUSTED_PROXY_HOPS desde la derecha (default 1), nunca la primera.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = parts[Math.max(0, parts.length - hops)];
    if (ip) return ip;
  }
  return "unknown";
}
