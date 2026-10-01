import "server-only";
import type { MediaAsset, MediaPurpose, MediaVisibility } from "@prisma/client";
import { prisma } from "@/db";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import { getStorage } from "@/server/providers";
import { buildStorageKey, validateUpload, type AllowedMime } from "../domain/validation";
import { mediaUrl } from "./media-url";

export type StoreUploadInput = {
  file: File;
  purpose: MediaPurpose;
  visibility?: MediaVisibility;
  allow?: readonly AllowedMime[];
  eventId?: string | null;
  memoryCapsuleId?: string | null;
  guestId?: string | null;
  uploadedById?: string | null;
  uploaderName?: string | null;
  consent?: boolean;
  approved?: boolean;
  alt?: string | null;
};

/**
 * Pipeline único de subida: valida tamaño y tipo real, guarda en storage S3-compatible
 * (nunca en el filesystem efímero del contenedor en producción) y registra el MediaAsset.
 */
export async function storeUpload(input: StoreUploadInput): Promise<MediaAsset & { displayUrl: string }> {
  const maxBytes = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (input.file.size > maxBytes) {
    throw new ValidationError(`El archivo supera el máximo de ${env().UPLOAD_MAX_MB} MB.`);
  }
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const check = validateUpload(bytes, { maxBytes, allow: input.allow });
  if (!check.ok) throw new ValidationError(check.error);

  const storage = getStorage();
  const key = buildStorageKey({
    purpose: input.purpose,
    scopeId: input.eventId ?? input.memoryCapsuleId ?? null,
    randomId: generateToken(12),
    extension: check.extension,
  });
  await storage.put({ key, body: Buffer.from(bytes), contentType: check.mime });

  const asset = await prisma.mediaAsset.create({
    data: {
      driver: storage.driver,
      storageKey: key,
      mimeType: check.mime,
      sizeBytes: bytes.length,
      kind: check.kind,
      visibility: input.visibility ?? "PRIVATE",
      purpose: input.purpose,
      eventId: input.eventId ?? null,
      memoryCapsuleId: input.memoryCapsuleId ?? null,
      guestId: input.guestId ?? null,
      uploadedById: input.uploadedById ?? null,
      uploaderName: input.uploaderName ?? null,
      consent: input.consent ?? false,
      approved: input.approved ?? true,
      alt: input.alt ?? null,
    },
  });
  return { ...asset, displayUrl: mediaUrl(asset) };
}

/** Elimina un asset (registro + objeto). Llamar después de verificar permisos. */
export async function deleteMedia(id: string): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return;
  if (asset.storageKey && asset.driver !== "EXTERNAL") {
    await getStorage()
      .delete(asset.storageKey)
      .catch(() => undefined);
  }
  await prisma.mediaAsset.delete({ where: { id } });
}
