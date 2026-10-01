"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  assignLeadSchema,
  changeLeadStatusSchema,
  createLeadSchema,
  logLeadActivitySchema,
  updateLeadSchema,
} from "../schemas";
import { assignLead, changeLeadStatus, createManualLead, logLeadActivity, updateLead } from "./lead-service";

function revalidateLead(leadId: string, customerId?: string | null) {
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  if (customerId) revalidatePath(`/admin/customers/${customerId}`);
}

export const createLeadAction = protectedAction(
  { name: "leads.create", schema: createLeadSchema, permission: "leads:write" },
  async (input, { user }) => {
    const result = await createManualLead(user, input);
    revalidateLead(result.leadId, result.customerId);
    revalidatePath("/admin/customers");
    return { leadId: result.leadId, code: result.code };
  },
);

export const changeLeadStatusAction = protectedAction(
  { name: "leads.change_status", schema: changeLeadStatusSchema, permission: "leads:write" },
  async (input, { user, ip }) => {
    const result = await changeLeadStatus(user, input, { ip });
    revalidateLead(input.leadId);
    return result;
  },
);

export const assignLeadAction = protectedAction(
  { name: "leads.assign", schema: assignLeadSchema, permission: "leads:write" },
  async (input, { user, ip }) => {
    const result = await assignLead(user, input, { ip });
    revalidateLead(input.leadId);
    return result;
  },
);

export const logLeadActivityAction = protectedAction(
  { name: "leads.log_activity", schema: logLeadActivitySchema, permission: "leads:write" },
  async (input, { user }) => {
    const result = await logLeadActivity(user, input);
    revalidateLead(input.leadId);
    return result;
  },
);

export const updateLeadAction = protectedAction(
  { name: "leads.update", schema: updateLeadSchema, permission: "leads:write" },
  async (input, { user, ip }) => {
    const result = await updateLead(user, input, { ip });
    revalidateLead(input.leadId);
    return result;
  },
);
