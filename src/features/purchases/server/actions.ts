"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  actualAmountSchema,
  attachReceiptSchema,
  cancelPurchaseSchema,
  createPurchaseSchema,
  purchaseIdSchema,
  receivePurchaseSchema,
  updatePurchaseSchema,
} from "../schemas";
import {
  attachReceipt,
  createPurchase,
  transitionPurchase,
  updateActualAmount,
  updatePurchase,
} from "./purchase-service";

function revalidatePurchase(p: { id: string; eventId: string | null; vendorId: string | null }, extra: Array<string | null> = []) {
  revalidatePath("/admin/purchases");
  revalidatePath(`/admin/purchases/${p.id}`);
  for (const eventId of new Set([p.eventId, ...extra].filter(Boolean) as string[])) {
    // "layout" incluye /admin/events/[id]/financials, que suma el costo real de las compras.
    revalidatePath(`/admin/events/${eventId}`, "layout");
    revalidatePath(`/admin/inventory/events/${eventId}`);
  }
  if (p.vendorId) revalidatePath(`/admin/vendors/${p.vendorId}`);
  revalidatePath("/admin/finance");
}

export const createPurchaseAction = protectedAction(
  { name: "purchases.create", schema: createPurchaseSchema, permission: "purchases:write" },
  async (data, { user }) => {
    const p = await createPurchase(user, data);
    revalidatePurchase(p);
    return { id: p.id };
  },
);

export const updatePurchaseAction = protectedAction(
  { name: "purchases.update", schema: updatePurchaseSchema, permission: "purchases:write" },
  async (data, { user }) => {
    const p = await updatePurchase(user, data);
    revalidatePurchase(p);
    // El evento o proveedor pudo cambiar: refresca también las páginas del anterior.
    revalidatePath("/admin/events", "layout");
    revalidatePath("/admin/vendors", "layout");
    return { id: p.id };
  },
);

export const markPurchaseOrderedAction = protectedAction(
  { name: "purchases.markOrdered", schema: purchaseIdSchema, permission: "purchases:write" },
  async ({ id }, { user }) => {
    const p = await transitionPurchase(user, { id, to: "ORDERED" });
    revalidatePurchase(p);
    return { status: p.status };
  },
);

export const reopenPurchaseAction = protectedAction(
  { name: "purchases.reopen", schema: purchaseIdSchema, permission: "purchases:write" },
  async ({ id }, { user }) => {
    const p = await transitionPurchase(user, { id, to: "REQUESTED" });
    revalidatePurchase(p);
    return { status: p.status };
  },
);

export const receivePurchaseAction = protectedAction(
  { name: "purchases.receive", schema: receivePurchaseSchema, permission: "purchases:write" },
  async (data, { user }) => {
    const p = await transitionPurchase(user, { ...data, to: "RECEIVED" });
    revalidatePurchase(p);
    return { status: p.status };
  },
);

export const cancelPurchaseAction = protectedAction(
  { name: "purchases.cancel", schema: cancelPurchaseSchema, permission: "purchases:write" },
  async (data, { user }) => {
    const p = await transitionPurchase(user, { id: data.id, to: "CANCELLED", reason: data.reason });
    revalidatePurchase(p);
    return { status: p.status };
  },
);

export const updateActualAmountAction = protectedAction(
  { name: "purchases.updateActual", schema: actualAmountSchema, permission: "purchases:write" },
  async (data, { user }) => {
    const p = await updateActualAmount(user, data);
    revalidatePurchase(p);
    return { actualAmountCents: p.actualAmountCents };
  },
);

export const attachReceiptAction = protectedAction(
  { name: "purchases.attachReceipt", schema: attachReceiptSchema, permission: "purchases:write" },
  async (data, { user }) => {
    const p = await attachReceipt(user, data);
    revalidatePurchase(p);
    return { receiptMediaId: p.receiptMediaId };
  },
);
