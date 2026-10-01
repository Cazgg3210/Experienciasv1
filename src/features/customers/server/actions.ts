"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import { deleteCustomerSchema, updateCustomerSchema } from "../schemas";
import { deleteCustomer, updateCustomer } from "./customer-service";

export const updateCustomerAction = protectedAction(
  { name: "customers.update", schema: updateCustomerSchema, permission: "customers:write" },
  async (input, { user, ip }) => {
    const result = await updateCustomer(user, input, { ip });
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${input.customerId}`);
    return result;
  },
);

export const deleteCustomerAction = protectedAction(
  { name: "customers.delete", schema: deleteCustomerSchema, permission: "customers:write" },
  async (input, { user, ip }) => {
    const result = await deleteCustomer(user, input, { ip });
    revalidatePath("/admin/customers");
    revalidatePath("/admin/leads");
    return result;
  },
);
