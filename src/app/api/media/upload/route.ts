import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db";
import { isSameOrigin } from "@/lib/csrf";
import { AppError, newErrorId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { can } from "@/server/auth/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { storeUpload } from "@/features/media/server/upload-service";

export const dynamic = "force-dynamic";

const fieldsSchema = z.object({
  purpose: z.enum(["EXPERIENCE", "GALLERY", "STYLE", "ADDON", "EVENT", "MEMORY", "RECEIPT", "CHECKLIST_EVIDENCE", "AVATAR", "OTHER"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  eventId: z.string().cuid().optional(),
  memoryCapsuleId: z.string().cuid().optional(),
  alt: z.string().max(200).optional(),
});

/**
 * Subida autenticada para el equipo (admin/staff). multipart/form-data con `file` + campos.
 * Las subidas de clientas/invitadas usan rutas por token propias de cada módulo.
 */
export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
    if (!can(user.role, "media:upload")) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

    const rl = await rateLimit(`upload:${user.id}`, { limit: 60, windowMs: 10 * 60_000 });
    if (!rl.ok) return NextResponse.json({ error: "Demasiadas subidas, espera un momento." }, { status: 429 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    const fields = fieldsSchema.safeParse({
      purpose: form.get("purpose") ?? undefined,
      visibility: form.get("visibility") ?? undefined,
      eventId: form.get("eventId") || undefined,
      memoryCapsuleId: form.get("memoryCapsuleId") || undefined,
      alt: form.get("alt") || undefined,
    });
    if (!fields.success) return NextResponse.json({ error: "Datos de subida inválidos." }, { status: 400 });
    const f = fields.data;

    // STAFF: sólo evidencias de checklist de eventos asignados, siempre privadas
    if (user.role === "STAFF") {
      if (f.purpose !== "CHECKLIST_EVIDENCE" || !f.eventId) {
        return NextResponse.json({ error: "Sin permiso para este tipo de archivo." }, { status: 403 });
      }
      const assigned = await prisma.staffAssignment.findFirst({
        where: { eventId: f.eventId, staffMember: { userId: user.id } },
        select: { id: true },
      });
      if (!assigned) return NextResponse.json({ error: "No estás asignada a este evento." }, { status: 403 });
      f.visibility = "PRIVATE";
    }

    const asset = await storeUpload({
      file,
      purpose: f.purpose,
      visibility: f.visibility,
      eventId: f.eventId,
      memoryCapsuleId: f.memoryCapsuleId,
      alt: f.alt,
      uploadedById: user.id,
      uploaderName: user.name,
      consent: true,
      allow: f.purpose === "RECEIPT" ? undefined : ["image/jpeg", "image/png", "image/webp"],
    });
    return NextResponse.json({
      id: asset.id,
      url: asset.displayUrl,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    const errorId = newErrorId();
    logger.error("media.upload_failed", { error, errorId });
    return NextResponse.json({ error: `No se pudo subir el archivo (ref ${errorId}).` }, { status: 500 });
  }
}
