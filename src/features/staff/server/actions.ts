"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import { staffChecklistUpdateSchema } from "@/features/operations/schemas";
import { updateChecklistItemAsStaff } from "@/features/operations/server/checklist-service";
import {
  accessActiveSchema,
  createAccessSchema,
  deleteStaffSchema,
  resetPasswordSchema,
  staffMemberSchema,
  updateStaffMemberSchema,
} from "../schemas";
import {
  createStaffAccess,
  createStaffMember,
  deleteStaffMember,
  resetStaffPassword,
  setStaffAccessActive,
  updateStaffMember,
} from "./staff-service";

// -----------------------------------------------------------------------------
// Administración de staff
// -----------------------------------------------------------------------------

export const createStaffMemberAction = protectedAction(
  { name: "staff.create", schema: staffMemberSchema, permission: "staff:write" },
  async (input, { user }) => {
    const member = await createStaffMember(user, input);
    revalidatePath("/admin/staff");
    return { id: member.id };
  },
);

export const updateStaffMemberAction = protectedAction(
  { name: "staff.update", schema: updateStaffMemberSchema, permission: "staff:write" },
  async (input, { user }) => {
    const member = await updateStaffMember(user, input);
    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${member.id}`);
    return { id: member.id };
  },
);

export const deleteStaffMemberAction = protectedAction(
  { name: "staff.delete", schema: deleteStaffSchema, permission: "staff:write" },
  async ({ id }, { user }) => {
    await deleteStaffMember(user, id);
    revalidatePath("/admin/staff");
    return { id };
  },
);

export const createStaffAccessAction = protectedAction(
  { name: "staff.createAccess", schema: createAccessSchema, permission: "users:manage" },
  async (input, { user }) => {
    const res = await createStaffAccess(user, input);
    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${input.staffMemberId}`);
    return { email: res.email };
  },
);

export const resetStaffPasswordAction = protectedAction(
  { name: "staff.resetPassword", schema: resetPasswordSchema, permission: "users:manage" },
  async (input, { user }) => {
    const res = await resetStaffPassword(user, input);
    return { email: res.email };
  },
);

export const setStaffAccessActiveAction = protectedAction(
  { name: "staff.setAccessActive", schema: accessActiveSchema, permission: "users:manage" },
  async (input, { user }) => {
    const res = await setStaffAccessActive(user, input);
    revalidatePath(`/admin/staff/${input.staffMemberId}`);
    revalidatePath("/admin/staff");
    return res;
  },
);

// -----------------------------------------------------------------------------
// Portal staff: tareas asignadas
// -----------------------------------------------------------------------------

export const staffUpdateChecklistItemAction = protectedAction(
  {
    name: "staff.updateChecklistItem",
    schema: staffChecklistUpdateSchema,
    permission: "checklists:update_assigned",
    rateLimit: { limit: 120, windowMs: 60_000 },
  },
  async (input, { user }) => {
    const item = await updateChecklistItemAsStaff(user, input);
    revalidatePath(`/staff/events/${item.eventId}`);
    revalidatePath("/staff");
    revalidatePath(`/admin/events/${item.eventId}/operations`);
    revalidatePath("/admin/operations");
    return { id: item.id, status: item.status };
  },
);
