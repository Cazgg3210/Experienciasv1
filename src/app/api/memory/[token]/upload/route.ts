import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError, newErrorId } from "@/lib/errors";
import { isSameOrigin } from "@/lib/csrf";
import { isEnabled } from "@/lib/flags";
import { logger } from "@/lib/logger";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isPlausibleToken } from "@/lib/tokens";
import { guestUploadFieldsSchema } from "@/features/memory-capsule/schemas";
import { uploadGuestPhoto } from "@/features/memory-capsule/server/public-service";

export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "No encontramos esta Memory Capsule." };
/** Margen para los campos y separadores del multipart además del archivo. */
const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

/**
 * CSRF: Origin/Referer de la app (isSameOrigin). Como respaldo, si el navegador manda
 * `Origin: null` o nada (política "no-referrer" en las páginas por token), se acepta
 * `Sec-Fetch-Site: same-origin`, cabecera que una página de terceros no puede falsificar.
 */
function isSameOriginRequest(req: Request): boolean {
  if (isSameOrigin(req)) return true;
  const origin = req.headers.get("origin");
  const opaqueOrigin = origin === null || origin === "null";
  return opaqueOrigin && req.headers.get("sec-fetch-site") === "same-origin";
}

/**
 * Subida pública de fotos de invitadas a una Memory Capsule (multipart/form-data):
 *   file, name, consent="true"
 * Requiere misma-origen, cápsula publicada con subidas abiertas y consentimiento explícito.
 * Las fotos quedan privadas y pendientes de revisión (approved=false).
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });

    const { token } = await params;
    if (!isPlausibleToken(token)) return NextResponse.json(NOT_FOUND, { status: 404 });
    if (!(await isEnabled("MEMORY_CAPSULE_ENABLED"))) return NextResponse.json(NOT_FOUND, { status: 404 });

    const ip = await clientIp().catch(() => "unknown");
    const rl = await rateLimit(`memory-upload:${ip}`, { limit: 20, windowMs: 60 * 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Has subido muchas fotos en poco tiempo. Intenta de nuevo más tarde." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000))) } },
      );
    }

    // No leer en memoria cuerpos claramente mayores al máximo permitido (endpoint público).
    const maxMb = env().UPLOAD_MAX_MB;
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > maxMb * 1024 * 1024 + MULTIPART_OVERHEAD_BYTES) {
      return NextResponse.json({ error: `La foto supera el máximo de ${maxMb} MB.` }, { status: 413 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "No pudimos leer el archivo. Intenta de nuevo." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Elige una foto para subir." }, { status: 400 });

    const name = form.get("name");
    const consent = form.get("consent");
    const fields = guestUploadFieldsSchema.safeParse({
      name: typeof name === "string" ? name : "",
      consent: typeof consent === "string" ? consent : "",
    });
    if (!fields.success) {
      const first = fields.error.issues[0]?.message ?? "Revisa los datos.";
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const asset = await uploadGuestPhoto({
      token,
      file,
      uploaderName: fields.data.name,
      consent: fields.data.consent === "true",
    });
    return NextResponse.json({ id: asset.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.status;
      return NextResponse.json({ error: error.message }, { status });
    }
    const errorId = newErrorId();
    logger.error("memory.guest_upload_failed", { error, errorId });
    return NextResponse.json({ error: `No pudimos subir tu foto (ref ${errorId}).` }, { status: 500 });
  }
}
