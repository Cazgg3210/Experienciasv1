/**
 * Validación de archivos subidos (pura): tipo real por "magic bytes" (no confiar en el
 * Content-Type ni en la extensión), tamaño máximo configurable y nombre de objeto seguro.
 */
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const EXTENSION_BY_MIME: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && // R
    b[1] === 0x49 && // I
    b[2] === 0x46 && // F
    b[3] === 0x46 && // F
    b[8] === 0x57 && // W
    b[9] === 0x45 && // E
    b[10] === 0x42 && // B
    b[11] === 0x50 // P
  )
    return "image/webp";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d)
    return "application/pdf"; // %PDF-
  return null;
}

export type UploadValidation =
  | { ok: true; mime: AllowedMime; extension: string; kind: "IMAGE" | "DOCUMENT" }
  | { ok: false; error: string };

export function validateUpload(
  bytes: Uint8Array,
  opts: { maxBytes: number; allow?: readonly AllowedMime[] },
): UploadValidation {
  if (bytes.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.length > opts.maxBytes) {
    return { ok: false, error: `El archivo supera el máximo de ${Math.round(opts.maxBytes / 1024 / 1024)} MB.` };
  }
  const mime = sniffMime(bytes);
  const allow = opts.allow ?? ALLOWED_MIME;
  if (!mime || !allow.includes(mime)) {
    return { ok: false, error: "Formato no permitido. Usa JPG, PNG, WEBP o PDF." };
  }
  return { ok: true, mime, extension: EXTENSION_BY_MIME[mime], kind: mime === "application/pdf" ? "DOCUMENT" : "IMAGE" };
}

/** Clave de objeto sin datos del usuario (evita path traversal y fugas de nombres). */
export function buildStorageKey(params: {
  purpose: string;
  scopeId?: string | null;
  randomId: string;
  extension: string;
  now?: Date;
}): string {
  const d = params.now ?? new Date();
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "x";
  const scope = params.scopeId ? `${safe(params.scopeId)}/` : "";
  return `${safe(params.purpose.toLowerCase())}/${scope}${ym}/${safe(params.randomId)}.${params.extension}`;
}
