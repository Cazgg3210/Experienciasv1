"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import { createVendorSchema, updateVendorSchema, vendorIdSchema } from "../schemas";
import { createVendor, deleteVendor, updateVendor } from "./vendor-service";

export const createVendorAction = protectedAction(
  { name: "vendors.create", schema: createVendorSchema, permission: "vendors:write" },
  async (data, { user }) => {
    const vendor = await createVendor(user, data);
    revalidatePath("/admin/vendors");
    return { id: vendor.id };
  },
);

export const updateVendorAction = protectedAction(
  { name: "vendors.update", schema: updateVendorSchema, permission: "vendors:write" },
  async (data, { user }) => {
    const vendor = await updateVendor(user, data);
    revalidatePath("/admin/vendors");
    revalidatePath(`/admin/vendors/${vendor.id}`);
    revalidatePath("/admin/purchases");
    return { id: vendor.id };
  },
);

export const deleteVendorAction = protectedAction(
  { name: "vendors.delete", schema: vendorIdSchema, permission: "vendors:write" },
  async ({ id }, { user }) => {
    await deleteVendor(user, id);
    revalidatePath("/admin/vendors");
    return { id };
  },
);
