import { NextResponse } from "next/server";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";
import { getStorage } from "@/server/providers";
import { verifyMediaSignature } from "@/features/media/server/media-url";

export const dynamic = "force-dynamic";

/**
 * Sirve un MediaAsset. Públicos: libre. Privados: requieren firma vigente (?exp&sig) emitida
 * por el servidor después de autorizar al visitante. S3 → redirect a URL prefirmada corta.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("No encontrado", { status: 404 });

  const isPublic = asset.visibility === "PUBLIC";
  if (!isPublic && !verifyMediaSignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return new NextResponse("Enlace expirado o inválido", { status: 403 });
  }

  if (asset.driver === "EXTERNAL" && asset.url) {
    return NextResponse.redirect(new URL(asset.url, url.origin), 302);
  }
  if (!asset.storageKey) return new NextResponse("No encontrado", { status: 404 });

  const storage = getStorage();
  const download = url.searchParams.get("download") === "1";
  try {
    if (storage.driver === "S3") {
      const signed = await storage.signedUrl(asset.storageKey, 300, {
        downloadName: download ? `${asset.id}.${asset.mimeType.split("/")[1]}` : undefined,
      });
      return NextResponse.redirect(signed, {
        status: 302,
        headers: { "Cache-Control": isPublic ? "public, max-age=300" : "private, max-age=60" },
      });
    }
    const obj = await storage.get(asset.storageKey);
    if (!obj) return new NextResponse("No encontrado", { status: 404 });
    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": download ? `attachment; filename="${asset.id}"` : "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, max-age=300",
      },
    });
  } catch (error) {
    logger.error("media.serve_failed", { error, id });
    return new NextResponse("No disponible", { status: 502 });
  }
}
