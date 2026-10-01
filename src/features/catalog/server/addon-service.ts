import "server-only";
import { prisma } from "@/db";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import { deactivationMessage, deletionDecision, diffPriceFields, hasNonZeroPricing } from "../domain/catalog-rules";
import type { AddOnFormValues, AddOnUpdateValues } from "../schemas";
import {
  assertCan,
  assertCanPrice,
  assertIdsExist,
  auditCatalog,
  auditPriceChange,
  emptyToNull,
  ensureSlugAvailable,
  isForeignKeyError,
  rethrowSlugConflict,
  TX_OPTIONS,
  type DeleteOutcome,
} from "./catalog-common";

const PRICE_KEYS = ["pricingType", "priceCents", "costCents"] as const;

function addOnData(v: AddOnFormValues) {
  return {
    name: v.name.trim(),
    slug: v.slug,
    description: emptyToNull(v.description),
    category: v.category,
    pricingType: v.pricingType,
    priceCents: v.priceCents,
    costCents: v.costCents,
    costCategory: v.costCategory,
    maxQuantity: v.maxQuantity,
    leadTimeDays: v.leadTimeDays,
    imageUrl: emptyToNull(v.imageUrl),
    active: v.active,
    sortOrder: v.sortOrder,
  };
}

export async function createAddOn(input: AddOnFormValues, actor: SessionUser): Promise<{ id: string; slug: string }> {
  assertCan(actor, "catalog:write");
  const data = addOnData(input);
  if (hasNonZeroPricing([data.priceCents, data.costCents])) assertCanPrice(actor);
  await ensureSlugAvailable("addOn", data.slug);
  await assertIdsExist(
    "inventoryItem",
    input.inventoryReqs.map((r) => r.inventoryItemId),
  );
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.addOn.create({
        data: {
          ...data,
          inventoryReqs: {
            create: input.inventoryReqs.map((r) => ({
              inventoryItemId: r.inventoryItemId,
              quantity: r.quantity,
              perGuest: r.perGuest,
            })),
          },
        },
        select: { id: true, slug: true },
      });
      await auditCatalog(
        {
          action: "catalog.created",
          entityType: "AddOn",
          entityId: created.id,
          after: { name: data.name, pricingType: data.pricingType, priceCents: data.priceCents, costCents: data.costCents },
          actor,
        },
        tx,
      );
      return created;
    }, TX_OPTIONS);
  } catch (error) {
    rethrowSlugConflict(error, data.slug);
  }
}

export async function updateAddOn(input: AddOnUpdateValues, actor: SessionUser): Promise<{ id: string; slug: string }> {
  assertCan(actor, "catalog:write");
  const existing = await prisma.addOn.findUnique({ where: { id: input.id } });
  if (!existing) throw new NotFoundError("El add-on ya no existe.");
  const data = addOnData(input);
  const diff = diffPriceFields(
    { pricingType: existing.pricingType, priceCents: existing.priceCents, costCents: existing.costCents },
    { pricingType: data.pricingType, priceCents: data.priceCents, costCents: data.costCents },
    PRICE_KEYS,
  );
  if (diff.changed) assertCanPrice(actor);
  await ensureSlugAvailable("addOn", data.slug, input.id);
  await assertIdsExist(
    "inventoryItem",
    input.inventoryReqs.map((r) => r.inventoryItemId),
  );
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.addOn.update({ where: { id: input.id }, data, select: { id: true, slug: true } });
      await tx.addOnInventoryRequirement.deleteMany({ where: { addOnId: input.id } });
      if (input.inventoryReqs.length) {
        await tx.addOnInventoryRequirement.createMany({
          data: input.inventoryReqs.map((r) => ({
            addOnId: input.id,
            inventoryItemId: r.inventoryItemId,
            quantity: r.quantity,
            perGuest: r.perGuest,
          })),
        });
      }
      if (diff.changed) {
        await auditPriceChange(
          { entityType: "AddOn", entityId: input.id, name: data.name, before: diff.before, after: diff.after, actor },
          tx,
        );
      }
      if (existing.active !== data.active) {
        await auditCatalog(
          {
            action: "catalog.status_changed",
            entityType: "AddOn",
            entityId: input.id,
            before: { active: existing.active },
            after: { active: data.active },
            actor,
          },
          tx,
        );
      }
      return updated;
    }, TX_OPTIONS);
  } catch (error) {
    rethrowSlugConflict(error, data.slug);
  }
}

/** Add-ons usados en eventos (FK Restrict), cotizaciones o experiencias se desactivan en vez de borrarse. */
export async function deleteAddOn(id: string, actor: SessionUser): Promise<DeleteOutcome> {
  assertCan(actor, "catalog:write");
  const addOn = await prisma.addOn.findUnique({
    where: { id },
    select: { id: true, name: true, active: true, _count: { select: { experiences: true, eventAddOns: true } } },
  });
  if (!addOn) throw new NotFoundError("El add-on ya no existe.");
  const quoteItems = await prisma.quoteItem.count({ where: { type: "ADDON", refId: id } });
  const decision = deletionDecision([
    { count: addOn._count.eventAddOns, one: "evento", many: "eventos" },
    { count: quoteItems, one: "concepto de cotización", many: "conceptos de cotización" },
    { count: addOn._count.experiences, one: "experiencia", many: "experiencias" },
  ]);

  const deactivate = async (reasons: string[]): Promise<DeleteOutcome> => {
    await prisma.addOn.update({ where: { id }, data: { active: false } });
    await auditCatalog({
      action: "catalog.deactivated",
      entityType: "AddOn",
      entityId: id,
      before: { active: addOn.active },
      after: { active: false, reasons },
      actor,
    });
    return { outcome: "deactivated", message: deactivationMessage({ label: "el add-on", feminine: false }, reasons) };
  };
  if (decision.mode === "deactivate") return deactivate(decision.reasons);

  try {
    await prisma.addOn.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyError(error)) return deactivate(["registros relacionados"]);
    throw error;
  }
  await auditCatalog({ action: "catalog.deleted", entityType: "AddOn", entityId: id, before: { name: addOn.name }, actor });
  return { outcome: "deleted", message: "Add-on eliminado." };
}
