"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import { availabilityExceptionSchema, deleteExceptionSchema, weeklyRulesSchema } from "../schemas";
import {
  createAvailabilityException,
  deleteAvailabilityException,
  saveWeeklyRules,
} from "./availability-admin-service";

function revalidateAvailability() {
  revalidatePath("/admin/calendar");
  // El configurador público y el alta de eventos leen disponibilidad en vivo.
  revalidatePath("/", "layout");
}

export const saveWeeklyRulesAction = protectedAction(
  { name: "availability.save_rules", schema: weeklyRulesSchema, permission: "availability:write" },
  async ({ rules }, { user }) => {
    const saved = await saveWeeklyRules(rules, user);
    revalidateAvailability();
    return saved;
  },
);

export const createAvailabilityExceptionAction = protectedAction(
  {
    name: "availability.create_exception",
    schema: availabilityExceptionSchema,
    permission: "availability:write",
  },
  async (input, { user }) => {
    const created = await createAvailabilityException(input, user);
    revalidateAvailability();
    return created;
  },
);

export const deleteAvailabilityExceptionAction = protectedAction(
  { name: "availability.delete_exception", schema: deleteExceptionSchema, permission: "availability:write" },
  async ({ id }, { user }) => {
    await deleteAvailabilityException(id, user);
    revalidateAvailability();
    return { ok: true };
  },
);
