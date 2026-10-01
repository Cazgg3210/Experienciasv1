import "server-only";
import { prisma } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import {
  deactivationMessage,
  deletionDecision,
  diffPriceFields,
  hasNonZeroPricing,
  isPermutation,
  normalizeTextList,
} from "../domain/catalog-rules";
import type {
  MenuFormValues,
  MenuItemCreateValues,
  MenuItemUpdateValues,
  MenuUpdateValues,
} from "../schemas";
import {
  assertCan,
  assertCanPrice,
  auditCatalog,
  auditPriceChange,
  emptyToNull,
  ensureSlugAvailable,
  isForeignKeyError,
  rethrowSlugConflict,
  TX_OPTIONS,
  type DeleteOutcome,
} from "./catalog-common";

const PRICE_KEYS = ["pricingType", "priceCents", "costPerGuestCents"] as const;

function menuData(v: MenuFormValues) {
  return {
    name: v.name.trim(),
    slug: v.slug,
    description: emptyToNull(v.description),
    pricingType: v.pricingType,
    // Un menú incluido no suma precio: se normaliza a 0 para evitar cobros fantasma.
    priceCents: v.pricingType === "INCLUDED" ? 0 : v.priceCents,
    costPerGuestCents: v.costPerGuestCents,
    tags: normalizeTextList(v.tags, { lowercase: true }),
    dietaryTags: [...new Set(v.dietaryTags)],
    active: v.active,
    sortOrder: v.sortOrder,
  };
}

export async function createMenu(input: MenuFormValues, actor: SessionUser): Promise<{ id: string; slug: string }> {
  assertCan(actor, "catalog:write");
  const data = menuData(input);
  if (hasNonZeroPricing([data.priceCents, data.costPerGuestCents])) assertCanPrice(actor);
  await ensureSlugAvailable("menu", data.slug);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.menu.create({ data, select: { id: true, slug: true } });
      await auditCatalog(
        {
          action: "catalog.created",
          entityType: "Menu",
          entityId: created.id,
          after: { name: data.name, pricingType: data.pricingType, priceCents: data.priceCents, costPerGuestCents: data.costPerGuestCents },
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

export async function updateMenu(input: MenuUpdateValues, actor: SessionUser): Promise<{ id: string; slug: string }> {
  assertCan(actor, "catalog:write");
  const existing = await prisma.menu.findUnique({ where: { id: input.id } });
  if (!existing) throw new NotFoundError("El menú ya no existe.");
  const data = menuData(input);
  const diff = diffPriceFields(
    { pricingType: existing.pricingType, priceCents: existing.priceCents, costPerGuestCents: existing.costPerGuestCents },
    { pricingType: data.pricingType, priceCents: data.priceCents, costPerGuestCents: data.costPerGuestCents },
    PRICE_KEYS,
  );
  if (diff.changed) assertCanPrice(actor);
  await ensureSlugAvailable("menu", data.slug, input.id);
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.menu.update({ where: { id: input.id }, data, select: { id: true, slug: true } });
      if (diff.changed) {
        await auditPriceChange(
          { entityType: "Menu", entityId: input.id, name: data.name, before: diff.before, after: diff.after, actor },
          tx,
        );
      }
      if (existing.active !== data.active) {
        await auditCatalog(
          {
            action: "catalog.status_changed",
            entityType: "Menu",
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

/** Si el menú está ligado a experiencias, leads, cotizaciones o eventos se desactiva en lugar de borrarse. */
export async function deleteMenu(id: string, actor: SessionUser): Promise<DeleteOutcome> {
  assertCan(actor, "catalog:write");
  const menu = await prisma.menu.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { experiences: true, leads: true, quotes: true, events: true } },
    },
  });
  if (!menu) throw new NotFoundError("El menú ya no existe.");
  const decision = deletionDecision([
    { count: menu._count.experiences, one: "experiencia", many: "experiencias" },
    { count: menu._count.events, one: "evento", many: "eventos" },
    { count: menu._count.quotes, one: "cotización", many: "cotizaciones" },
    { count: menu._count.leads, one: "lead", many: "leads" },
  ]);

  const deactivate = async (reasons: string[]): Promise<DeleteOutcome> => {
    await prisma.menu.update({ where: { id }, data: { active: false } });
    await auditCatalog({
      action: "catalog.deactivated",
      entityType: "Menu",
      entityId: id,
      before: { active: menu.active },
      after: { active: false, reasons },
      actor,
    });
    return { outcome: "deactivated", message: deactivationMessage({ label: "el menú", feminine: false }, reasons) };
  };
  if (decision.mode === "deactivate") return deactivate(decision.reasons);

  try {
    await prisma.menu.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyError(error)) return deactivate(["registros relacionados"]);
    throw error;
  }
  await auditCatalog({ action: "catalog.deleted", entityType: "Menu", entityId: id, before: { name: menu.name }, actor });
  return { outcome: "deleted", message: "Menú eliminado." };
}

// -----------------------------------------------------------------------------
// Platillos (MenuItem)
// -----------------------------------------------------------------------------

function itemData(v: { name: string; description: string; course: MenuItemCreateValues["course"]; dietaryTags: MenuItemCreateValues["dietaryTags"] }) {
  return {
    name: v.name.trim(),
    description: emptyToNull(v.description),
    course: v.course,
    dietaryTags: [...new Set(v.dietaryTags)],
  };
}

export async function createMenuItem(input: MenuItemCreateValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const menu = await prisma.menu.findUnique({ where: { id: input.menuId }, select: { id: true } });
  if (!menu) throw new NotFoundError("El menú ya no existe.");
  const last = await prisma.menuItem.findFirst({
    where: { menuId: input.menuId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return prisma.menuItem.create({
    data: { ...itemData(input), menuId: input.menuId, sortOrder: (last?.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
}

export async function updateMenuItem(input: MenuItemUpdateValues, actor: SessionUser): Promise<{ id: string; menuId: string }> {
  assertCan(actor, "catalog:write");
  const item = await prisma.menuItem.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!item) throw new NotFoundError("El platillo ya no existe.");
  return prisma.menuItem.update({ where: { id: input.id }, data: itemData(input), select: { id: true, menuId: true } });
}

export async function deleteMenuItem(id: string, actor: SessionUser): Promise<{ menuId: string }> {
  assertCan(actor, "catalog:write");
  const item = await prisma.menuItem.findUnique({ where: { id }, select: { id: true, menuId: true } });
  if (!item) throw new NotFoundError("El platillo ya no existe.");
  await prisma.menuItem.delete({ where: { id } });
  return { menuId: item.menuId };
}

export async function reorderMenuItems(input: { menuId: string; orderedIds: string[] }, actor: SessionUser): Promise<void> {
  assertCan(actor, "catalog:write");
  const items = await prisma.menuItem.findMany({ where: { menuId: input.menuId }, select: { id: true } });
  if (!isPermutation(items.map((i) => i.id), input.orderedIds)) {
    throw new ValidationError("El menú cambió en otra pestaña. Recarga la página para ordenar los platillos.");
  }
  await prisma.$transaction(
    input.orderedIds.map((id, i) => prisma.menuItem.update({ where: { id }, data: { sortOrder: i } })),
  );
}
