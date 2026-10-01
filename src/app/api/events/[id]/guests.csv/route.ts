import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/audit";
import { logger } from "@/lib/logger";
import { buildGuestsCsv } from "@/features/events/server/guest-admin-service";

export const dynamic = "force-dynamic";

/** GET /api/events/[id]/guests.csv — exporta la lista de invitadas (sesión + guests:read). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Necesitas iniciar sesión." }, { status: 401 });
  if (!can(user.role, "guests:read")) {
    return NextResponse.json({ error: "No tienes permiso para exportar invitadas." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const result = await buildGuestsCsv(id);
    if (!result) return NextResponse.json({ error: "No encontramos este evento." }, { status: 404 });
    await audit({
      action: "guests.exported",
      entityType: "Event",
      entityId: id,
      after: { count: result.count, format: "csv" },
      actor: user,
    });
    return new Response(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error("guests.csv_failed", { error, eventId: id });
    return NextResponse.json({ error: "No pudimos generar el archivo. Intenta de nuevo." }, { status: 500 });
  }
}
