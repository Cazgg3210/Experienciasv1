import { isSameOrigin } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { recordClientEvent } from "@/features/marketing/server/analytics-service";
import { trackEventSchema } from "@/features/marketing/schemas";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;

function empty(status: number) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Beacon de analítica del sitio público (sendBeacon/fetch keepalive).
 * POST same-origin, rate limit por IP, cuerpo validado con Zod y lista blanca de tipos.
 * Responde 204 sin cuerpo.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return empty(403);

  const ip = await clientIp().catch(() => "unknown");
  const rl = await rateLimit(`analytics:track:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return empty(429);

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return empty(413);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return empty(413);
    body = JSON.parse(text);
  } catch {
    return empty(400);
  }

  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) return empty(400);

  try {
    const result = await recordClientEvent(parsed.data);
    if (!result.ok) return empty(422);
  } catch (error) {
    logger.warn("analytics.track_endpoint_failed", { error });
  }
  return empty(204);
}
