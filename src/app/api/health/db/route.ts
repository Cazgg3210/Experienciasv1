import { NextResponse } from "next/server";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Readiness: verifica conexión a PostgreSQL. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "up", latencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("health.db_down", { error });
    return NextResponse.json(
      { status: "error", database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
