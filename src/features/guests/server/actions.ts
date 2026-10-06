"use server";

import { revalidatePath } from "next/cache";
import type { RsvpStatus } from "@prisma/client";
import { publicAction } from "@/server/action";
import { resolvePortalEvent } from "@/features/portal/server/portal-service";
import { addHostGuestSchema, removeHostGuestSchema, submitRsvpSchema } from "../schemas";
import { submitRsvp } from "./rsvp-service";
import { addGuestAsHost, removeGuestAsHost } from "./guest-service";

const TEN_MINUTES = 10 * 60_000;

/**
 * RSVP del micrositio (público, sin sesión). `personalPath` siempre es el link de la invitada que
 * respondió: con el link general es una invitada nueva, nunca el de otra (BUG-003).
 */
export const submitRsvpAction = publicAction(
  { name: "guests.submit_rsvp", schema: submitRsvpSchema, rateLimit: { limit: 10, windowMs: TEN_MINUTES } },
  async (input, { ip }): Promise<{ name: string; rsvpStatus: RsvpStatus; personalPath: string }> => {
    const result = await submitRsvp(input, { ip });
    const personalPath = `/e/${result.slug}/${result.guestToken}`;
    revalidatePath(`/e/${result.slug}/${input.token}`);
    if (personalPath !== `/e/${result.slug}/${input.token}`) revalidatePath(personalPath);
    revalidatePath(`/admin/events/${result.eventId}`);
    revalidatePath(`/mi-evento/${result.portalToken}`);
    return { name: result.name, rsvpStatus: result.rsvpStatus, personalPath };
  },
);

/** La anfitriona agrega una invitada desde su portal. */
export const addHostGuestAction = publicAction(
  { name: "portal.add_guest", schema: addHostGuestSchema, rateLimit: { limit: 40, windowMs: TEN_MINUTES } },
  async ({ token, ...values }): Promise<{ id: string; name: string }> => {
    const guest = await addGuestAsHost(token, values);
    await revalidatePortal(token);
    return { id: guest.id, name: guest.name };
  },
);

/** La anfitriona quita a una invitada que agregó y que aún no responde. */
export const removeHostGuestAction = publicAction(
  { name: "portal.remove_guest", schema: removeHostGuestSchema, rateLimit: { limit: 40, windowMs: TEN_MINUTES } },
  async ({ token, guestId }, { ip }): Promise<{ id: string }> => {
    const res = await removeGuestAsHost(token, guestId, { ip });
    await revalidatePortal(token);
    return res;
  },
);

async function revalidatePortal(token: string) {
  revalidatePath(`/mi-evento/${token}`);
  const event = await resolvePortalEvent(token);
  if (event) revalidatePath(`/admin/events/${event.id}`);
}
