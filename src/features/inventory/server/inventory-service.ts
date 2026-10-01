import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { StockAdjustmentError, applyStockAdjustment, signedMovementQuantity } from "../domain/stock";
import type { CreateInventoryItemData, StockAdjustmentData, UpdateInventoryItemData } from "../schemas";

const SKU_TAKEN = "Ya existe un artículo con este SKU. Usa uno diferente.";

function skuTakenError() {
  return new ValidationError(SKU_TAKEN, { sku: [SKU_TAKEN] });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function assertSkuAvailable(sku: string, exceptId?: string) {
  const existing = await prisma.inventoryItem.findFirst({
    where: { sku: { equals: sku, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw skuTakenError();
}

/** Alta de artículo. Si trae cantidad inicial se registra un movimiento ADJUSTMENT de alta. */
export async function createInventoryItem(actor: SessionUser, data: CreateInventoryItemData) {
  await assertSkuAvailable(data.sku);
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          sku: data.sku,
          name: data.name,
          category: data.category,
          unit: data.unit,
          totalQuantity: data.totalQuantity,
          maintenanceQuantity: 0,
          lowStockThreshold: data.lowStockThreshold,
          replacementCostCents: data.replacementCostCents,
          location: data.location,
          notes: data.notes,
          active: data.active,
        },
      });
      if (data.totalQuantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            type: "ADJUSTMENT",
            quantity: data.totalQuantity,
            reason: "Alta del artículo en inventario",
            actorId: actor.id,
          },
        });
      }
      await audit(
        { action: "inventory.item_created", entityType: "InventoryItem", entityId: item.id, after: item, actor },
        tx,
      );
      return item;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw skuTakenError();
    throw error;
  }
}

/** Edición de datos del artículo. Las cantidades sólo cambian con ajustes de stock (quedan en el historial). */
export async function updateInventoryItem(actor: SessionUser, data: UpdateInventoryItemData) {
  const before = await prisma.inventoryItem.findUnique({ where: { id: data.id } });
  if (!before) throw new NotFoundError("No encontramos el artículo.");
  if (before.sku.toUpperCase() !== data.sku.toUpperCase()) await assertSkuAvailable(data.sku, data.id);
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id: data.id },
        data: {
          sku: data.sku,
          name: data.name,
          category: data.category,
          unit: data.unit,
          lowStockThreshold: data.lowStockThreshold,
          replacementCostCents: data.replacementCostCents,
          location: data.location,
          notes: data.notes,
          active: data.active,
        },
      });
      const changed: Record<string, { before: unknown; after: unknown }> = {};
      for (const key of [
        "sku",
        "name",
        "category",
        "unit",
        "lowStockThreshold",
        "replacementCostCents",
        "location",
        "notes",
        "active",
      ] as const) {
        if (before[key] !== item[key]) changed[key] = { before: before[key], after: item[key] };
      }
      if (Object.keys(changed).length) {
        await audit(
          {
            action: "inventory.item_updated",
            entityType: "InventoryItem",
            entityId: item.id,
            before: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.before])),
            after: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.after])),
            actor,
          },
          tx,
        );
      }
      return item;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw skuTakenError();
    throw error;
  }
}

/**
 * Ajuste de stock (entrada por compra, pérdida, ajuste ±, mantenimiento). Actualiza
 * totalQuantity/maintenanceQuantity de forma consistente, nunca negativa, registra el
 * movimiento con el actor y audita "inventory.adjusted".
 */
export async function adjustStock(actor: SessionUser, data: StockAdjustmentData) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${data.itemId} FOR UPDATE`;
    const item = await tx.inventoryItem.findUnique({
      where: { id: data.itemId },
      select: { id: true, sku: true, totalQuantity: true, maintenanceQuantity: true },
    });
    if (!item) throw new NotFoundError("No encontramos el artículo.");
    const adjustment = {
      type: data.type,
      quantity: data.quantity,
      direction: data.type === "ADJUSTMENT" ? (data.direction === "OUT" ? -1 : 1) : undefined,
    } as const;
    let next;
    try {
      next = applyStockAdjustment(item, adjustment);
    } catch (error) {
      if (error instanceof StockAdjustmentError) {
        throw new ValidationError(error.message, { quantity: [error.message] });
      }
      throw error;
    }
    const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: next });
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: data.type,
        quantity: signedMovementQuantity(adjustment),
        reason: data.reason,
        actorId: actor.id,
      },
    });
    await audit(
      {
        action: "inventory.adjusted",
        entityType: "InventoryItem",
        entityId: item.id,
        before: { totalQuantity: item.totalQuantity, maintenanceQuantity: item.maintenanceQuantity },
        after: {
          totalQuantity: updated.totalQuantity,
          maintenanceQuantity: updated.maintenanceQuantity,
          type: data.type,
          quantity: movement.quantity,
          reason: data.reason,
        },
        actor,
      },
      tx,
    );
    return { item: updated, movementId: movement.id };
  });
}
