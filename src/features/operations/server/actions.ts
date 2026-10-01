"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  addOnNotesSchema,
  assignmentFlagsSchema,
  createAssignmentSchema,
  createChecklistItemSchema,
  createTemplateItemSchema,
  deleteByIdSchema,
  instantiateChecklistSchema,
  logisticsSchema,
  templateSchema,
  updateAssignmentSchema,
  updateChecklistItemSchema,
  updateTemplateItemSchema,
  updateTemplateSchema,
} from "../schemas";
import {
  createChecklistItem,
  createTemplate,
  createTemplateItem,
  deleteChecklistItem,
  deleteTemplate,
  deleteTemplateItem,
  instantiateChecklistsAsAdmin,
  updateChecklistItem,
  updateTemplate,
  updateTemplateItem,
} from "./checklist-service";
import { createAssignment, deleteAssignment, setAssignmentFlags, updateAssignment } from "./assignment-service";
import { updateEventAddOnNotes, updateEventLogistics } from "./logistics-service";

function revalidateEventOps(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/operations`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/operations");
  revalidatePath(`/staff/events/${eventId}`);
  revalidatePath("/staff");
}

// -----------------------------------------------------------------------------
// Checklist del evento
// -----------------------------------------------------------------------------

export const instantiateChecklistAction = protectedAction(
  { name: "operations.instantiateChecklist", schema: instantiateChecklistSchema, permission: "checklists:write" },
  async ({ eventId }, { user }) => {
    const res = await instantiateChecklistsAsAdmin(user, eventId);
    revalidateEventOps(eventId);
    return res;
  },
);

export const updateChecklistItemAction = protectedAction(
  { name: "operations.updateChecklistItem", schema: updateChecklistItemSchema, permission: "checklists:write" },
  async (input, { user }) => {
    const item = await updateChecklistItem(user, input);
    revalidateEventOps(item.eventId);
    return { id: item.id, status: item.status };
  },
);

export const createChecklistItemAction = protectedAction(
  { name: "operations.createChecklistItem", schema: createChecklistItemSchema, permission: "checklists:write" },
  async (input, { user }) => {
    const item = await createChecklistItem(user, input);
    revalidateEventOps(item.eventId);
    return { id: item.id };
  },
);

export const deleteChecklistItemAction = protectedAction(
  { name: "operations.deleteChecklistItem", schema: deleteByIdSchema, permission: "checklists:write" },
  async ({ id }, { user }) => {
    const { eventId } = await deleteChecklistItem(user, id);
    revalidateEventOps(eventId);
    return { id };
  },
);

// -----------------------------------------------------------------------------
// Staff del evento
// -----------------------------------------------------------------------------

export const createAssignmentAction = protectedAction(
  { name: "operations.createAssignment", schema: createAssignmentSchema, permission: "staff:write" },
  async (input, { user }) => {
    const { assignment, warnings } = await createAssignment(user, input);
    revalidateEventOps(assignment.eventId);
    revalidatePath(`/admin/staff/${assignment.staffMemberId}`);
    return { id: assignment.id, warnings: warnings.map((w) => w.message) };
  },
);

export const updateAssignmentAction = protectedAction(
  { name: "operations.updateAssignment", schema: updateAssignmentSchema, permission: "staff:write" },
  async (input, { user }) => {
    const { assignment, warnings } = await updateAssignment(user, input);
    revalidateEventOps(assignment.eventId);
    // Puede haber cambiado de persona: refrescar el detalle de ambas.
    revalidatePath("/admin/staff", "layout");
    return { id: assignment.id, warnings: warnings.map((w) => w.message) };
  },
);

export const setAssignmentFlagsAction = protectedAction(
  { name: "operations.setAssignmentFlags", schema: assignmentFlagsSchema, permission: "staff:write" },
  async (input, { user }) => {
    const a = await setAssignmentFlags(user, input);
    revalidateEventOps(a.eventId);
    revalidatePath(`/admin/staff/${a.staffMemberId}`);
    return { id: a.id, confirmed: a.confirmed, paid: a.paid };
  },
);

export const deleteAssignmentAction = protectedAction(
  { name: "operations.deleteAssignment", schema: deleteByIdSchema, permission: "staff:write" },
  async ({ id }, { user }) => {
    const { eventId } = await deleteAssignment(user, id);
    revalidateEventOps(eventId);
    revalidatePath("/admin/staff", "layout");
    return { id };
  },
);

// -----------------------------------------------------------------------------
// Logística y add-ons
// -----------------------------------------------------------------------------

export const updateLogisticsAction = protectedAction(
  { name: "operations.updateLogistics", schema: logisticsSchema, permission: "events:write" },
  async (input, { user }) => {
    const event = await updateEventLogistics(user, input);
    revalidateEventOps(event.id);
    return { id: event.id };
  },
);

export const updateAddOnNotesAction = protectedAction(
  { name: "operations.updateAddOnNotes", schema: addOnNotesSchema, permission: "events:write" },
  async (input, { user }) => {
    const res = await updateEventAddOnNotes(user, input);
    revalidateEventOps(res.eventId);
    return { id: res.id };
  },
);

// -----------------------------------------------------------------------------
// Plantillas
// -----------------------------------------------------------------------------

export const createTemplateAction = protectedAction(
  { name: "operations.createTemplate", schema: templateSchema, permission: "checklists:write" },
  async (input, { user }) => {
    const t = await createTemplate(user, input);
    revalidatePath("/admin/operations/templates");
    return { id: t.id };
  },
);

export const updateTemplateAction = protectedAction(
  { name: "operations.updateTemplate", schema: updateTemplateSchema, permission: "checklists:write" },
  async (input, { user }) => {
    const t = await updateTemplate(user, input);
    revalidatePath("/admin/operations/templates");
    revalidatePath(`/admin/operations/templates/${t.id}`);
    return { id: t.id };
  },
);

export const deleteTemplateAction = protectedAction(
  { name: "operations.deleteTemplate", schema: deleteByIdSchema, permission: "checklists:write" },
  async ({ id }, { user }) => {
    await deleteTemplate(user, id);
    revalidatePath("/admin/operations/templates");
    return { id };
  },
);

export const createTemplateItemAction = protectedAction(
  { name: "operations.createTemplateItem", schema: createTemplateItemSchema, permission: "checklists:write" },
  async (input, { user }) => {
    const item = await createTemplateItem(user, input);
    revalidatePath(`/admin/operations/templates/${item.templateId}`);
    revalidatePath("/admin/operations/templates");
    return { id: item.id };
  },
);

export const updateTemplateItemAction = protectedAction(
  { name: "operations.updateTemplateItem", schema: updateTemplateItemSchema, permission: "checklists:write" },
  async (input, { user }) => {
    const item = await updateTemplateItem(user, input);
    revalidatePath(`/admin/operations/templates/${item.templateId}`);
    return { id: item.id };
  },
);

export const deleteTemplateItemAction = protectedAction(
  { name: "operations.deleteTemplateItem", schema: deleteByIdSchema, permission: "checklists:write" },
  async ({ id }, { user }) => {
    const { templateId } = await deleteTemplateItem(user, id);
    revalidatePath(`/admin/operations/templates/${templateId}`);
    revalidatePath("/admin/operations/templates");
    return { id };
  },
);
