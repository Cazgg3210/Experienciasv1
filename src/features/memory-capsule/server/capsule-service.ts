import "server-only";
import type { MemoryCapsule } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/server/audit";
import { can, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { deleteMedia } from "@/features/media/server/upload-service";

/**
 * Servicios de administración de la Memory Capsule. Reciben el actor explícito para poder
 * probarse en integración; las Server Actions sólo validan, autorizan y delegan aquí.
 * Permisos: memory:write (cápsula, portada, enlace) y media:moderate (fotos y mensajes).
 */

type Actor = SessionUser;
type Ctx = { ip?: string | null };

export type CapsuleRef = Pick<MemoryCapsule, "id" | "eventId" | "shareToken">;

function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

async function findCapsuleOrThrow(capsuleId: string): Promise<MemoryCapsule> {
  const capsule = await prisma.memoryCapsule.findUnique({ where: { id: capsuleId } });
  if (!capsule) throw new NotFoundError("No encontramos esta Memory Capsule.");
  return capsule;
}

async function findCapsuleMediaOrThrow(capsuleId: string, mediaId: string) {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!media || media.memoryCapsuleId !== capsuleId) throw new NotFoundError("No encontramos esta foto en la cápsula.");
  return media;
}

// ---------------------------------------------------------------------------
// Cápsula
// ---------------------------------------------------------------------------

export async function createCapsule(
  actor: Actor,
  input: { eventId: string; title: string; message?: string | null },
  ctx: Ctx = {},
): Promise<MemoryCapsule> {
  assertCan(actor, "memory:write");
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, memoryCapsule: { select: { id: true } } },
  });
  if (!event) throw new NotFoundError("No encontramos este evento.");
  if (event.memoryCapsule) throw new ConflictError("Este evento ya tiene una Memory Capsule.");

  const title = input.title.trim();
  if (title.length < 3) throw new ValidationError("Revisa los datos marcados.", { title: ["Escribe un título."] });

  const capsule = await prisma.memoryCapsule.create({
    data: {
      eventId: event.id,
      title,
      message: emptyToNull(input.message),
      shareToken: generateToken(),
      published: false,
      allowGuestUploads: true,
    },
  });
  await audit({
    action: "memory.created",
    entityType: "MemoryCapsule",
    entityId: capsule.id,
    after: { eventId: capsule.eventId, title: capsule.title },
    actor,
    ip: ctx.ip,
  });
  return capsule;
}

export async function updateCapsule(
  actor: Actor,
  input: {
    capsuleId: string;
    title: string;
    message?: string | null;
    published: boolean;
    allowGuestUploads: boolean;
  },
  ctx: Ctx = {},
): Promise<MemoryCapsule> {
  assertCan(actor, "memory:write");
  const before = await findCapsuleOrThrow(input.capsuleId);
  const title = input.title.trim();
  if (title.length < 3) throw new ValidationError("Revisa los datos marcados.", { title: ["Escribe un título."] });

  const after = await prisma.memoryCapsule.update({
    where: { id: before.id },
    data: {
      title,
      message: emptyToNull(input.message),
      published: input.published,
      allowGuestUploads: input.allowGuestUploads,
    },
  });

  const action =
    before.published !== after.published
      ? after.published
        ? "memory.published"
        : "memory.unpublished"
      : "memory.updated";
  await audit({
    action,
    entityType: "MemoryCapsule",
    entityId: after.id,
    before: {
      title: before.title,
      message: before.message,
      published: before.published,
      allowGuestUploads: before.allowGuestUploads,
    },
    after: {
      title: after.title,
      message: after.message,
      published: after.published,
      allowGuestUploads: after.allowGuestUploads,
    },
    actor,
    ip: ctx.ip,
  });
  return after;
}

/** Genera un nuevo enlace para compartir; el anterior deja de funcionar de inmediato. */
export async function rotateShareToken(
  actor: Actor,
  capsuleId: string,
  ctx: Ctx = {},
): Promise<{ capsule: MemoryCapsule; previousToken: string }> {
  assertCan(actor, "memory:write");
  const before = await findCapsuleOrThrow(capsuleId);
  const capsule = await prisma.memoryCapsule.update({
    where: { id: before.id },
    data: { shareToken: generateToken() },
  });
  // No guardamos los tokens completos en la bitácora (son secretos de acceso).
  await audit({
    action: "memory.token_rotated",
    entityType: "MemoryCapsule",
    entityId: capsule.id,
    before: { tokenHint: `…${before.shareToken.slice(-4)}` },
    after: { tokenHint: `…${capsule.shareToken.slice(-4)}` },
    actor,
    ip: ctx.ip,
  });
  return { capsule, previousToken: before.shareToken };
}

/** Define (o quita con null) la portada. Una portada siempre queda aprobada para ser visible. */
export async function setCover(
  actor: Actor,
  input: { capsuleId: string; mediaId: string | null },
  ctx: Ctx = {},
): Promise<MemoryCapsule> {
  assertCan(actor, "memory:write");
  const capsule = await findCapsuleOrThrow(input.capsuleId);
  if (input.mediaId) {
    const media = await findCapsuleMediaOrThrow(capsule.id, input.mediaId);
    if (media.kind !== "IMAGE") throw new ValidationError("La portada debe ser una imagen.");
    if (!media.approved) {
      // Elegirla como portada la hace pública: queda registrada como una aprobación más.
      await prisma.mediaAsset.update({ where: { id: media.id }, data: { approved: true } });
      await audit({
        action: "media.approved",
        entityType: "MediaAsset",
        entityId: media.id,
        before: { approved: false },
        after: { approved: true, memoryCapsuleId: capsule.id, via: "cover" },
        actor,
        ip: ctx.ip,
      });
    }
  }
  const updated = await prisma.memoryCapsule.update({
    where: { id: capsule.id },
    data: { coverMediaId: input.mediaId },
  });
  await audit({
    action: "memory.cover_changed",
    entityType: "MemoryCapsule",
    entityId: capsule.id,
    before: { coverMediaId: capsule.coverMediaId },
    after: { coverMediaId: updated.coverMediaId },
    actor,
    ip: ctx.ip,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Moderación de fotos
// ---------------------------------------------------------------------------

export async function setMediaApproval(
  actor: Actor,
  input: { capsuleId: string; mediaId: string; approved: boolean },
  ctx: Ctx = {},
): Promise<CapsuleRef> {
  assertCan(actor, "media:moderate");
  const capsule = await findCapsuleOrThrow(input.capsuleId);
  const media = await findCapsuleMediaOrThrow(capsule.id, input.mediaId);
  if (media.approved !== input.approved) {
    await prisma.mediaAsset.update({ where: { id: media.id }, data: { approved: input.approved } });
    await audit({
      action: input.approved ? "media.approved" : "media.hidden",
      entityType: "MediaAsset",
      entityId: media.id,
      before: { approved: media.approved },
      after: { approved: input.approved, memoryCapsuleId: capsule.id },
      actor,
      ip: ctx.ip,
    });
  }
  return capsule;
}

export async function deleteCapsuleMedia(
  actor: Actor,
  input: { capsuleId: string; mediaId: string },
  ctx: Ctx = {},
): Promise<CapsuleRef> {
  assertCan(actor, "media:moderate");
  const capsule = await findCapsuleOrThrow(input.capsuleId);
  const media = await findCapsuleMediaOrThrow(capsule.id, input.mediaId);
  await deleteMedia(media.id); // coverMediaId se limpia por FK (onDelete: SetNull)
  await audit({
    action: "media.deleted",
    entityType: "MediaAsset",
    entityId: media.id,
    before: {
      purpose: media.purpose,
      eventId: media.eventId,
      memoryCapsuleId: media.memoryCapsuleId,
      uploaderName: media.uploaderName,
      consent: media.consent,
      approved: media.approved,
      wasCover: capsule.coverMediaId === media.id,
    },
    actor,
    ip: ctx.ip,
  });
  return capsule;
}

// ---------------------------------------------------------------------------
// Moderación de mensajes (HONOREE + GUESTBOOK)
// ---------------------------------------------------------------------------

export async function setMessageHidden(
  actor: Actor,
  input: { eventId: string; messageId: string; hidden: boolean },
  ctx: Ctx = {},
): Promise<{ id: string; eventId: string; hidden: boolean }> {
  assertCan(actor, "media:moderate");
  const message = await prisma.eventMessage.findUnique({ where: { id: input.messageId } });
  if (!message || message.eventId !== input.eventId || message.kind === "HOST_THREAD") {
    throw new NotFoundError("No encontramos este mensaje.");
  }
  if (message.hidden === input.hidden) return { id: message.id, eventId: message.eventId, hidden: message.hidden };
  const updated = await prisma.eventMessage.update({ where: { id: message.id }, data: { hidden: input.hidden } });
  await audit({
    action: input.hidden ? "message.hidden" : "message.unhidden",
    entityType: "EventMessage",
    entityId: message.id,
    before: { hidden: message.hidden },
    after: { hidden: updated.hidden, kind: message.kind },
    actor,
    ip: ctx.ip,
  });
  return { id: updated.id, eventId: updated.eventId, hidden: updated.hidden };
}

/** Capsule (id, evento, token) de un evento — útil para revalidar rutas. */
export async function getCapsuleRefByEvent(eventId: string): Promise<CapsuleRef | null> {
  return prisma.memoryCapsule.findUnique({
    where: { eventId },
    select: { id: true, eventId: true, shareToken: true },
  });
}
