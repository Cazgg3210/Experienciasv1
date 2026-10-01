import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { newErrorId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { decideCronAuth } from "@/features/notifications/domain/cron-auth";
import { runScheduledNotifications } from "@/features/notifications/server/scheduler";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Recordatorios programados (cotizaciones por vencer, saldos, RSVP, 7 días, 48 h, post-evento, reseñas).
 * Llamar desde un cron externo (Dokploy, GitHub Actions, cron-job.org) cada hora:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/notifications
 * Idempotente: puede ejecutarse muchas veces sin duplicar mensajes.
 */
async function handle(req: Request): Promise<NextResponse> {
  let secret: string | undefined;
  try {
    secret = env().CRON_SECRET;
  } catch {
    secret = undefined;
  }
  const decision = decideCronAuth(req.headers.get("authorization"), secret);
  if (decision === "unconfigured") {
    logger.warn("cron.notifications.unconfigured");
    return NextResponse.json(
      { ok: false, error: "El cron no está configurado (falta CRON_SECRET)." },
      { status: 503, headers: NO_STORE },
    );
  }
  if (decision === "unauthorized") {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401, headers: { ...NO_STORE, "WWW-Authenticate": 'Bearer realm="cron"' } },
    );
  }
  try {
    const result = await runScheduledNotifications();
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (error) {
    const errorId = newErrorId();
    logger.error("cron.notifications.failed", { error, errorId });
    return NextResponse.json({ ok: false, error: "No se pudieron ejecutar los recordatorios.", errorId }, { status: 500, headers: NO_STORE });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
