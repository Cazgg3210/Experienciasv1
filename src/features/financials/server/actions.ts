"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  closeEventSchema,
  createEventCostSchema,
  deleteEventCostSchema,
  updateEventCostSchema,
} from "../schemas";
import { closeEvent, createEventCost, deleteEventCost, updateEventCost } from "./event-financials-service";

function revalidateEventFinance(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/financials`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
}

export const createEventCostAction = protectedAction(
  { name: "financials.createCost", schema: createEventCostSchema, permission: "costs:write" },
  async (input, { user }) => {
    const cost = await createEventCost(user, input);
    revalidateEventFinance(cost.eventId);
    return { id: cost.id };
  },
);

export const updateEventCostAction = protectedAction(
  { name: "financials.updateCost", schema: updateEventCostSchema, permission: "costs:write" },
  async (input, { user }) => {
    const cost = await updateEventCost(user, input);
    revalidateEventFinance(cost.eventId);
    return { id: cost.id };
  },
);

export const deleteEventCostAction = protectedAction(
  { name: "financials.deleteCost", schema: deleteEventCostSchema, permission: "costs:write" },
  async (input, { user }) => {
    const res = await deleteEventCost(user, input);
    revalidateEventFinance(res.eventId);
    return { id: res.id };
  },
);

export const closeEventAction = protectedAction(
  { name: "financials.closeEvent", schema: closeEventSchema, permission: "events:close" },
  async (input, { user }) => {
    const res = await closeEvent(user, input.eventId);
    revalidateEventFinance(input.eventId);
    revalidatePath("/admin/events");
    return { closedAt: res.closedAt.toISOString() };
  },
);
