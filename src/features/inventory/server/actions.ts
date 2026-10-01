"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  addReservationSchema,
  createInventoryItemSchema,
  reservationIdSchema,
  reservationQuantitySchema,
  reserveEventSchema,
  returnReservationSchema,
  stockAdjustmentSchema,
  updateInventoryItemSchema,
} from "../schemas";
import { adjustStock, createInventoryItem, updateInventoryItem } from "./inventory-service";
import {
  addReservation,
  cancelReservation,
  checkOutAllForEvent,
  checkOutReservation,
  recalculateEventReservations,
  releaseInventoryForEvent,
  returnReservation,
  updateReservationQuantity,
} from "./reservation-service";

function revalidateInventory(opts: { itemId?: string; eventId?: string } = {}) {
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/conflicts");
  revalidatePath("/admin/inventory/events");
  if (opts.itemId) revalidatePath(`/admin/inventory/${opts.itemId}`);
  if (opts.eventId) {
    revalidatePath(`/admin/inventory/events/${opts.eventId}`);
    // "layout" cubre también las subrutas del evento (operación, finanzas).
    revalidatePath(`/admin/events/${opts.eventId}`, "layout");
  }
}

export const createInventoryItemAction = protectedAction(
  { name: "inventory.createItem", schema: createInventoryItemSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const item = await createInventoryItem(user, data);
    revalidateInventory({ itemId: item.id });
    return { id: item.id };
  },
);

export const updateInventoryItemAction = protectedAction(
  { name: "inventory.updateItem", schema: updateInventoryItemSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const item = await updateInventoryItem(user, data);
    revalidateInventory({ itemId: item.id });
    return { id: item.id };
  },
);

export const adjustStockAction = protectedAction(
  { name: "inventory.adjustStock", schema: stockAdjustmentSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await adjustStock(user, data);
    revalidateInventory({ itemId: data.itemId });
    return { totalQuantity: res.item.totalQuantity, maintenanceQuantity: res.item.maintenanceQuantity };
  },
);

export const recalculateEventReservationsAction = protectedAction(
  { name: "inventory.recalculateEvent", schema: reserveEventSchema, permission: "inventory:write" },
  async ({ eventId }, { user }) => {
    const res = await recalculateEventReservations(user, eventId);
    revalidateInventory({ eventId });
    return res;
  },
);

export const releaseAllForEventAction = protectedAction(
  { name: "inventory.releaseAll", schema: reserveEventSchema, permission: "inventory:write" },
  async ({ eventId }, { user }) => {
    const res = await releaseInventoryForEvent(eventId, { actor: user, reason: "Reservas liberadas desde el panel" });
    revalidateInventory({ eventId });
    return res;
  },
);

export const updateReservationQuantityAction = protectedAction(
  { name: "inventory.updateReservation", schema: reservationQuantitySchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await updateReservationQuantity(user, data);
    revalidateInventory({ eventId: res.eventId, itemId: res.itemId });
    return { shortage: res.shortage };
  },
);

export const addReservationAction = protectedAction(
  { name: "inventory.addReservation", schema: addReservationSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await addReservation(user, data);
    revalidateInventory({ eventId: data.eventId, itemId: data.inventoryItemId });
    return res;
  },
);

export const checkOutReservationAction = protectedAction(
  { name: "inventory.checkOut", schema: reservationIdSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await checkOutReservation(user, data);
    revalidateInventory(res);
    return { ok: true };
  },
);

export const checkOutAllAction = protectedAction(
  { name: "inventory.checkOutAll", schema: reserveEventSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await checkOutAllForEvent(user, data);
    revalidateInventory({ eventId: data.eventId });
    return res;
  },
);

export const returnReservationAction = protectedAction(
  { name: "inventory.return", schema: returnReservationSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await returnReservation(user, data);
    revalidateInventory(res);
    return { ok: true };
  },
);

export const cancelReservationAction = protectedAction(
  { name: "inventory.cancelReservation", schema: reservationIdSchema, permission: "inventory:write" },
  async (data, { user }) => {
    const res = await cancelReservation(user, data);
    revalidateInventory(res);
    return { ok: true };
  },
);
