"use server";

import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/lib/errors";
import { isEnabled } from "@/lib/flags";
import { protectedAction, publicAction } from "@/server/action";
import {
  capsuleIdSchema,
  createCapsuleSchema,
  deleteCapsuleMediaSchema,
  guestbookActionSchema,
  setCoverSchema,
  setMediaApprovalSchema,
  setMessageHiddenSchema,
  updateCapsuleSchema,
} from "../schemas";
import {
  createCapsule,
  deleteCapsuleMedia,
  getCapsuleRefByEvent,
  rotateShareToken,
  setCover,
  setMediaApproval,
  setMessageHidden,
  updateCapsule,
} from "./capsule-service";
import { createGuestbookMessage } from "./public-service";

function revalidateCapsule(eventId: string, ...tokens: Array<string | null | undefined>) {
  revalidatePath(`/admin/events/${eventId}/memory`);
  for (const t of tokens) if (t) revalidatePath(`/memory/${t}`);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const createCapsuleAction = protectedAction(
  { name: "memory.create", schema: createCapsuleSchema, permission: "memory:write" },
  async (input, { user, ip }) => {
    const capsule = await createCapsule(user, input, { ip });
    revalidateCapsule(capsule.eventId, capsule.shareToken);
    return { id: capsule.id };
  },
);

export const updateCapsuleAction = protectedAction(
  { name: "memory.update", schema: updateCapsuleSchema, permission: "memory:write" },
  async (input, { user, ip }) => {
    const capsule = await updateCapsule(user, input, { ip });
    revalidateCapsule(capsule.eventId, capsule.shareToken);
    return { id: capsule.id, published: capsule.published };
  },
);

export const rotateShareTokenAction = protectedAction(
  { name: "memory.rotate_token", schema: capsuleIdSchema, permission: "memory:write" },
  async ({ capsuleId }, { user, ip }) => {
    const { capsule, previousToken } = await rotateShareToken(user, capsuleId, { ip });
    revalidateCapsule(capsule.eventId, capsule.shareToken, previousToken);
    return { id: capsule.id };
  },
);

export const setCoverAction = protectedAction(
  { name: "memory.set_cover", schema: setCoverSchema, permission: "memory:write" },
  async (input, { user, ip }) => {
    const capsule = await setCover(user, input, { ip });
    revalidateCapsule(capsule.eventId, capsule.shareToken);
    return { coverMediaId: capsule.coverMediaId };
  },
);

export const setMediaApprovalAction = protectedAction(
  { name: "memory.media_approval", schema: setMediaApprovalSchema, permission: "media:moderate" },
  async (input, { user, ip }) => {
    const capsule = await setMediaApproval(user, input, { ip });
    revalidateCapsule(capsule.eventId, capsule.shareToken);
    return { approved: input.approved };
  },
);

export const deleteCapsuleMediaAction = protectedAction(
  { name: "memory.media_delete", schema: deleteCapsuleMediaSchema, permission: "media:moderate" },
  async (input, { user, ip }) => {
    const capsule = await deleteCapsuleMedia(user, input, { ip });
    revalidateCapsule(capsule.eventId, capsule.shareToken);
    return { deleted: true };
  },
);

export const setMessageHiddenAction = protectedAction(
  { name: "memory.message_hidden", schema: setMessageHiddenSchema, permission: "media:moderate" },
  async (input, { user, ip }) => {
    const result = await setMessageHidden(user, input, { ip });
    const ref = await getCapsuleRefByEvent(result.eventId);
    revalidateCapsule(result.eventId, ref?.shareToken);
    return { hidden: result.hidden };
  },
);

// ---------------------------------------------------------------------------
// Público (por token)
// ---------------------------------------------------------------------------

export const submitGuestbookMessageAction = publicAction(
  { name: "memory.guestbook", schema: guestbookActionSchema, rateLimit: { limit: 8, windowMs: 10 * 60_000 } },
  async ({ token, name, body }) => {
    if (!(await isEnabled("MEMORY_CAPSULE_ENABLED"))) throw new NotFoundError("Esta Memory Capsule no está disponible.");
    const message = await createGuestbookMessage(token, { name, body });
    revalidatePath(`/memory/${token}`);
    return message;
  },
);
