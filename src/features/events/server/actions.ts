"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/db";
import { protectedAction } from "@/server/action";
import { checkAvailability } from "@/features/bookings/server/availability-service";
import {
  adminMessageSchema,
  availabilityQuerySchema,
  cancelEventSchema,
  createEventSchema,
  customerSearchSchema,
  deleteGuestSchema,
  deleteTimelineItemSchema,
  guestSchema,
  moderateMessageSchema,
  rotateTokenSchema,
  rsvpReminderSchema,
  timelineItemSchema,
  transitionEventSchema,
  updateEventSchema,
} from "../schemas";
import {
  addAdminMessage,
  cancelEvent,
  createManualEvent,
  deleteTimelineItem,
  rotateEventToken,
  saveTimelineItem,
  transitionEventStatus,
  updateEvent,
} from "./event-service";
import { deleteGuest, saveGuest, sendRsvpReminders, setHonoreeMessageHidden } from "./guest-admin-service";
import { searchCustomers } from "./event-queries";

/** Revalida el listado, el calendario, todas las pestañas del evento y sus páginas públicas. */
async function revalidateEvent(eventId: string) {
  revalidatePath("/admin/events");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/events/${eventId}`, "layout");
  const e = await prisma.event
    .findUnique({
      where: { id: eventId },
      select: { portalToken: true, inviteToken: true, micrositeSlug: true },
    })
    .catch(() => null);
  if (e) {
    revalidatePath(`/mi-evento/${e.portalToken}`);
    revalidatePath(`/e/${e.micrositeSlug}/${e.inviteToken}`);
  }
}

// -----------------------------------------------------------------------------
// Eventos
// -----------------------------------------------------------------------------

export const createEventAction = protectedAction(
  { name: "events.create", schema: createEventSchema, permission: "events:write" },
  async (input, { user }) => {
    const result = await createManualEvent(input, user);
    if (result.status === "created") {
      revalidatePath("/admin/events");
      revalidatePath("/admin/calendar");
    }
    return result;
  },
);

export const searchCustomersAction = protectedAction(
  { name: "events.search_customers", schema: customerSearchSchema, permission: "events:write" },
  async ({ q }) => searchCustomers(q),
);

export const checkEventAvailabilityAction = protectedAction(
  { name: "events.check_availability", schema: availabilityQuerySchema, permission: "events:read_all" },
  async (input) => {
    const r = await checkAvailability({
      date: input.date,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      serviceAreaId: input.serviceAreaId || null,
      excludeEventId: input.excludeEventId || null,
    });
    return {
      status: r.status,
      reason: r.reason,
      available: r.available,
      capacity: r.capacity,
      booked: r.booked,
      remaining: r.remaining,
      overlaps: r.overlaps.length,
    };
  },
);

export const updateEventAction = protectedAction(
  { name: "events.update", schema: updateEventSchema, permission: "events:write" },
  async (input, { user }) => {
    const result = await updateEvent(input, user);
    if (result.status === "updated") await revalidateEvent(input.eventId);
    return result;
  },
);

export const transitionEventAction = protectedAction(
  { name: "events.transition", schema: transitionEventSchema, permission: "events:write" },
  async (input, { user }) => {
    const result = await transitionEventStatus(input, user);
    if (result.status === "updated") await revalidateEvent(input.eventId);
    return result;
  },
);

export const cancelEventAction = protectedAction(
  { name: "events.cancel", schema: cancelEventSchema, permission: "events:cancel" },
  async (input, { user }) => {
    const result = await cancelEvent(input, user);
    await revalidateEvent(input.eventId);
    return result;
  },
);

export const rotateEventTokenAction = protectedAction(
  { name: "events.rotate_token", schema: rotateTokenSchema, permission: "events:write" },
  async (input, { user }) => {
    const result = await rotateEventToken(input, user);
    revalidatePath(`/admin/events/${input.eventId}`, "layout");
    return result;
  },
);

// -----------------------------------------------------------------------------
// Timeline y conversación
// -----------------------------------------------------------------------------

export const saveTimelineItemAction = protectedAction(
  { name: "events.timeline_save", schema: timelineItemSchema, permission: "events:write" },
  async (input, { user }) => {
    const result = await saveTimelineItem(input, user);
    await revalidateEvent(input.eventId);
    return result;
  },
);

export const deleteTimelineItemAction = protectedAction(
  { name: "events.timeline_delete", schema: deleteTimelineItemSchema, permission: "events:write" },
  async (input, { user }) => {
    await deleteTimelineItem(input, user);
    await revalidateEvent(input.eventId);
    return { ok: true };
  },
);

export const addAdminMessageAction = protectedAction(
  { name: "events.admin_message", schema: adminMessageSchema, permission: "events:write" },
  async (input, { user }) => {
    const result = await addAdminMessage(input, user);
    await revalidateEvent(input.eventId);
    return result;
  },
);

// -----------------------------------------------------------------------------
// Invitadas
// -----------------------------------------------------------------------------

export const saveGuestAction = protectedAction(
  { name: "guests.save", schema: guestSchema, permission: "guests:write" },
  async (input, { user }) => {
    const result = await saveGuest(input, user);
    await revalidateEvent(input.eventId);
    return result;
  },
);

export const deleteGuestAction = protectedAction(
  { name: "guests.delete", schema: deleteGuestSchema, permission: "guests:write" },
  async (input, { user }) => {
    await deleteGuest(input, user);
    await revalidateEvent(input.eventId);
    return { ok: true };
  },
);

export const sendRsvpRemindersAction = protectedAction(
  {
    name: "guests.rsvp_reminders",
    schema: rsvpReminderSchema,
    permission: "guests:write",
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async ({ eventId }, { user }) => {
    const result = await sendRsvpReminders(eventId, user);
    revalidatePath(`/admin/events/${eventId}/guests`);
    return result;
  },
);

export const moderateHonoreeMessageAction = protectedAction(
  { name: "guests.moderate_message", schema: moderateMessageSchema, permission: "guests:write" },
  async (input, { user }) => {
    await setHonoreeMessageHidden(input, user);
    await revalidateEvent(input.eventId);
    return { ok: true };
  },
);
