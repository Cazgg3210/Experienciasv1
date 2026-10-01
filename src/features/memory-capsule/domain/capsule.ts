/**
 * Lógica pura de la Memory Capsule (sin I/O): títulos por defecto, textos para compartir,
 * reglas de visibilidad pública, elección de portada, navegación del lightbox y
 * normalización de textos escritos por invitadas.
 */

export const CAPSULE_TITLE_MAX = 120;
export const CAPSULE_MESSAGE_MAX = 1000;
export const GUESTBOOK_BODY_MAX = 500;
export const GUEST_NAME_MAX = 80;

/** Texto exacto del consentimiento obligatorio para subir fotos (público). */
export const GUEST_UPLOAD_CONSENT_TEXT =
  "Confirmo que tengo permiso de compartir esta foto y acepto que se muestre en esta cápsula";

/** Título por defecto al crear la cápsula: "Memorias de <evento>" (recortado al máximo). */
export function defaultCapsuleTitle(eventTitle: string): string {
  const base = `Memorias de ${eventTitle.trim() || "tu celebración"}`;
  return base.length > CAPSULE_TITLE_MAX ? `${base.slice(0, CAPSULE_TITLE_MAX - 1).trimEnd()}…` : base;
}

/** Mensaje por defecto (cálido) para la cápsula. */
export function defaultCapsuleMessage(honoreeName?: string | null): string {
  const who = honoreeName?.trim();
  return who
    ? `Gracias por dejarnos ser parte del día de ${who}. Aquí guardamos las fotos y los mensajes de quienes celebraron contigo para que vuelvas a ellos cuando quieras. — Ivonne & Rosa`
    : "Gracias por dejarnos ser parte de este día. Aquí guardamos las fotos y los mensajes de quienes celebraron contigo para que vuelvas a ellos cuando quieras. — Ivonne & Rosa";
}

/** Primer nombre para saludos ("Ana Paula Ríos" → "Ana"). */
export function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "";
}

/** Mensaje de WhatsApp para enviar el enlace de la cápsula a la clienta. */
export function buildCustomerShareText(params: {
  customerName?: string | null;
  capsuleTitle: string;
  url: string;
  published: boolean;
}): string {
  const name = firstName(params.customerName);
  const greeting = name ? `¡Hola, ${name}!` : "¡Hola!";
  if (!params.published) {
    return `${greeting} Estamos preparando "${params.capsuleTitle}" ✨ Muy pronto aquí podrás ver las fotos y los mensajes de tu celebración: ${params.url}`;
  }
  return `${greeting} Ya está lista "${params.capsuleTitle}" ✨ Aquí puedes ver las fotos y los mensajes de tus invitadas, y compartirla con ellas: ${params.url}`;
}

/** Texto corto para navigator.share en la página pública. */
export function buildPublicShareText(capsuleTitle: string): string {
  return `Mira "${capsuleTitle}": fotos y mensajes de nuestra celebración ✨`;
}

/** Normaliza texto libre de invitadas: recorta, colapsa espacios y quita caracteres de control. */
export function normalizeGuestText(value: string, opts: { multiline?: boolean } = {}): string {
  const withoutControl = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (opts.multiline) {
    return withoutControl
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return withoutControl.replace(/\s+/g, " ").trim();
}

export type GuestUploadGate = { ok: true } | { ok: false; reason: "NOT_PUBLISHED" | "UPLOADS_DISABLED" | "NO_CONSENT" };

/** ¿Se puede aceptar una foto de invitada en esta cápsula? */
export function canAcceptGuestUpload(
  capsule: { published: boolean; allowGuestUploads: boolean },
  consent: boolean,
): GuestUploadGate {
  if (!capsule.published) return { ok: false, reason: "NOT_PUBLISHED" };
  if (!capsule.allowGuestUploads) return { ok: false, reason: "UPLOADS_DISABLED" };
  if (consent !== true) return { ok: false, reason: "NO_CONSENT" };
  return { ok: true };
}

export const GUEST_UPLOAD_GATE_MESSAGES: Record<Exclude<GuestUploadGate, { ok: true }>["reason"], string> = {
  NOT_PUBLISHED: "Esta cápsula todavía no está abierta para recibir fotos.",
  UPLOADS_DISABLED: "Esta cápsula ya no está recibiendo fotos de invitadas.",
  NO_CONSENT: "Para subir la foto necesitamos que confirmes que tienes permiso de compartirla.",
};

type MediaForPublic = {
  id: string;
  kind: "IMAGE" | "DOCUMENT";
  approved: boolean;
  sortOrder: number;
  createdAt: Date;
};

/** Sólo fotos aprobadas (imágenes) y en orden editorial (sortOrder, luego más antiguas primero). */
export function publicMediaFilter<T extends MediaForPublic>(media: readonly T[]): T[] {
  return media
    .filter((m) => m.approved && m.kind === "IMAGE")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Portada pública: la elegida si sigue aprobada y pertenece a la galería visible;
 * si no, la primera "featured" visible; si no, la primera visible; si no, ninguna.
 */
export function pickCover<T extends { id: string; featured?: boolean }>(
  visibleMedia: readonly T[],
  coverMediaId: string | null | undefined,
): T | null {
  if (coverMediaId) {
    const chosen = visibleMedia.find((m) => m.id === coverMediaId);
    if (chosen) return chosen;
  }
  return visibleMedia.find((m) => m.featured) ?? visibleMedia[0] ?? null;
}

/** Navegación circular del lightbox. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function nextIndex(current: number, length: number): number {
  return wrapIndex(current + 1, length);
}

export function prevIndex(current: number, length: number): number {
  return wrapIndex(current - 1, length);
}

/** Texto alternativo accesible para una foto de la galería. */
export function photoAlt(params: { alt?: string | null; uploaderName?: string | null; index: number; title: string }): string {
  const alt = params.alt?.trim();
  if (alt) return alt;
  const who = params.uploaderName?.trim();
  return who
    ? `Foto ${params.index + 1} de ${params.title}, compartida por ${who}`
    : `Foto ${params.index + 1} de ${params.title}`;
}

/** Resumen de moderación para el admin. */
export function moderationSummary(media: readonly { approved: boolean }[]): {
  total: number;
  approved: number;
  pending: number;
} {
  const approved = media.filter((m) => m.approved).length;
  return { total: media.length, approved, pending: media.length - approved };
}

/** "jueves 10 de septiembre" → "Jueves 10 de septiembre" (sólo la primera letra). */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase("es-MX") + value.slice(1) : value;
}
