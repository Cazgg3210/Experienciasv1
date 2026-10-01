import "server-only";
import type { MessageKind } from "@prisma/client";
import { prisma } from "@/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { isPlausibleToken } from "@/lib/tokens";
import { mediaUrl } from "@/features/media/server/media-url";
import { storeUpload } from "@/features/media/server/upload-service";
import { sniffMime } from "@/features/media/domain/validation";
import {
  canAcceptGuestUpload,
  GUEST_UPLOAD_GATE_MESSAGES,
  normalizeGuestText,
  photoAlt,
  pickCover,
  publicMediaFilter,
} from "../domain/capsule";
import { guestbookFormSchema, guestNameSchema } from "../schemas";

/**
 * Acceso público por token (shareToken). Nunca expone datos de la clienta, del evento
 * fuera de lo necesario ni fotos sin aprobar. Tokens inválidos → null / NotFound genérico.
 */

/** TTL de las URLs firmadas de la galería pública (~6 h). */
export const PUBLIC_MEDIA_TTL_SECONDS = 60 * 60 * 6;

export type PublicPhoto = {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  uploaderName: string | null;
};

export type PublicMessage = {
  id: string;
  kind: MessageKind;
  authorName: string;
  body: string;
  createdAt: Date;
};

export type PublicCapsuleView =
  | {
      status: "draft";
      title: string;
      honoreeName: string | null;
    }
  | {
      status: "published";
      title: string;
      message: string | null;
      eventDate: Date;
      honoreeName: string | null;
      cover: PublicPhoto | null;
      photos: PublicPhoto[];
      messages: PublicMessage[];
      allowGuestUploads: boolean;
    };

async function findCapsuleByToken(token: string) {
  if (!isPlausibleToken(token)) return null;
  return prisma.memoryCapsule.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      eventId: true,
      title: true,
      message: true,
      published: true,
      allowGuestUploads: true,
      coverMediaId: true,
    },
  });
}

/** Vista pública de la cápsula (o null si el token no existe / es inválido). */
export async function getPublicCapsule(token: string): Promise<PublicCapsuleView | null> {
  const capsule = await findCapsuleByToken(token);
  if (!capsule) return null;

  const event = await prisma.event.findUnique({
    where: { id: capsule.eventId },
    select: { eventDate: true, honoreeName: true },
  });
  if (!event) return null;

  if (!capsule.published) {
    return { status: "draft", title: capsule.title, honoreeName: event.honoreeName };
  }

  const [media, messages] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { memoryCapsuleId: capsule.id, approved: true, kind: "IMAGE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 500,
    }),
    prisma.eventMessage.findMany({
      where: { eventId: capsule.eventId, kind: { in: ["HONOREE", "GUESTBOOK"] }, hidden: false },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, kind: true, authorName: true, body: true, createdAt: true },
    }),
  ]);

  const visible = publicMediaFilter(media);
  const photos: Array<PublicPhoto & { featured: boolean }> = visible.map((m, index) => ({
    id: m.id,
    url: mediaUrl(m, PUBLIC_MEDIA_TTL_SECONDS),
    alt: photoAlt({ alt: m.alt, uploaderName: m.uploaderName, index, title: capsule.title }),
    width: m.width,
    height: m.height,
    uploaderName: m.uploaderName,
    featured: m.featured,
  }));
  const cover = pickCover(photos, capsule.coverMediaId);
  const strip = ({ featured: _featured, ...p }: PublicPhoto & { featured: boolean }): PublicPhoto => p;

  return {
    status: "published",
    title: capsule.title,
    message: capsule.message,
    eventDate: event.eventDate,
    honoreeName: event.honoreeName,
    cover: cover ? strip(cover) : null,
    photos: photos.map(strip),
    messages,
    allowGuestUploads: capsule.allowGuestUploads,
  };
}

/** Libro de visitas: crea un mensaje GUESTBOOK (visible de inmediato; el equipo puede ocultarlo). */
export async function createGuestbookMessage(
  token: string,
  input: { name: string; body: string },
): Promise<{ id: string }> {
  const capsule = await findCapsuleByToken(token);
  if (!capsule || !capsule.published) throw new NotFoundError("Esta Memory Capsule no está disponible.");

  const parsed = guestbookFormSchema.safeParse({
    name: normalizeGuestText(input.name),
    body: normalizeGuestText(input.body, { multiline: true }),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? "_form")] ??= []).push(issue.message);
    throw new ValidationError("Revisa los datos marcados.", fieldErrors);
  }

  const message = await prisma.eventMessage.create({
    data: {
      eventId: capsule.eventId,
      kind: "GUESTBOOK",
      authorType: "GUEST",
      authorName: parsed.data.name,
      body: parsed.data.body,
    },
    select: { id: true },
  });
  return message;
}

/**
 * Foto de invitada: exige cápsula publicada con subidas abiertas y consentimiento explícito.
 * Se guarda PRIVADA y sin aprobar (approved=false) hasta que el equipo la revise.
 */
export async function uploadGuestPhoto(input: {
  token: string;
  file: File;
  uploaderName: string;
  consent: boolean;
}): Promise<{ id: string }> {
  const capsule = await findCapsuleByToken(input.token);
  if (!capsule) throw new NotFoundError("Esta Memory Capsule no está disponible.");

  const gate = canAcceptGuestUpload(capsule, input.consent);
  if (!gate.ok) {
    if (gate.reason === "NO_CONSENT") {
      throw new ValidationError(GUEST_UPLOAD_GATE_MESSAGES.NO_CONSENT, {
        consent: [GUEST_UPLOAD_GATE_MESSAGES.NO_CONSENT],
      });
    }
    throw new AppError(GUEST_UPLOAD_GATE_MESSAGES[gate.reason], "UPLOADS_CLOSED", 403);
  }

  const name = guestNameSchema.safeParse(normalizeGuestText(input.uploaderName));
  if (!name.success) {
    throw new ValidationError(name.error.issues[0]?.message ?? "Escribe tu nombre.", {
      name: name.error.issues.map((i) => i.message),
    });
  }

  // Pre-chequeo barato del tipo real (sólo fotos; el pipeline común vuelve a validar todo).
  const head = new Uint8Array(await input.file.slice(0, 16).arrayBuffer());
  const sniffed = sniffMime(head);
  if (!sniffed || sniffed === "application/pdf") {
    throw new ValidationError("Sólo aceptamos fotos en formato JPG, PNG o WEBP.", {
      file: ["Sólo aceptamos fotos en formato JPG, PNG o WEBP."],
    });
  }

  const asset = await storeUpload({
    file: input.file,
    purpose: "MEMORY",
    memoryCapsuleId: capsule.id,
    eventId: capsule.eventId,
    visibility: "PRIVATE",
    allow: ["image/jpeg", "image/png", "image/webp"],
    consent: true,
    approved: false,
    uploaderName: name.data,
  });
  return { id: asset.id };
}

/** ¿Existe una cápsula con este token? (validación barata para responder 404 real antes del streaming). */
export async function capsuleTokenExists(token: string): Promise<boolean> {
  if (!isPlausibleToken(token)) return false;
  const found = await prisma.memoryCapsule.findUnique({ where: { shareToken: token }, select: { id: true } });
  return !!found;
}
