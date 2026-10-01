"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  addOnFormSchema,
  addOnUpdateSchema,
  areaFormSchema,
  areaUpdateSchema,
  budgetFormSchema,
  budgetUpdateSchema,
  deleteSchema,
  experienceFormSchema,
  experienceImageAddSchema,
  experienceImageRemoveSchema,
  experienceImageReorderSchema,
  experienceUpdateSchema,
  menuFormSchema,
  menuItemCreateSchema,
  menuItemReorderSchema,
  menuItemUpdateSchema,
  menuUpdateSchema,
  slugCheckSchema,
  styleFormSchema,
  styleUpdateSchema,
  toggleActiveSchema,
} from "../schemas";
import { isSlugTaken } from "./catalog-common";
import {
  addExperienceImage,
  createExperience,
  deleteExperience,
  removeExperienceImage,
  reorderExperienceImages,
  updateExperience,
} from "./experience-service";
import {
  createMenu,
  createMenuItem,
  deleteMenu,
  deleteMenuItem,
  reorderMenuItems,
  updateMenu,
  updateMenuItem,
} from "./menu-service";
import { createAddOn, deleteAddOn, updateAddOn } from "./addon-service";
import { createStyle, deleteStyle, updateStyle } from "./style-service";
import { createServiceArea, deleteServiceArea, findPostalCodeOverlaps, updateServiceArea } from "./area-service";
import { createBudgetRange, deleteBudgetRange, updateBudgetRange } from "./budget-service";
import { setCatalogActive } from "./status-service";

/** Invalida sitio público (experiencias, home, configurador) y el panel del catálogo. */
function revalidateCatalog() {
  revalidateTag("catalog");
  revalidatePath("/experiencias", "layout");
  revalidatePath("/");
  revalidatePath("/crear-experiencia");
  revalidatePath("/admin/catalog", "layout");
}

const WRITE = "catalog:write" as const;

// --- Utilidades ---------------------------------------------------------------

export const checkSlugAction = protectedAction(
  { name: "catalog.checkSlug", schema: slugCheckSchema, permission: "catalog:read" },
  async ({ entity, slug, excludeId }) => ({ available: !(await isSlugTaken(entity, slug, excludeId)) }),
);

export const toggleCatalogActiveAction = protectedAction(
  { name: "catalog.toggleActive", schema: toggleActiveSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await setCatalogActive(input, user);
    revalidateCatalog();
    return res;
  },
);

// --- Experiencias -------------------------------------------------------------

export const createExperienceAction = protectedAction(
  { name: "catalog.createExperience", schema: experienceFormSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createExperience(input, user);
    revalidateCatalog();
    return res;
  },
);

export const updateExperienceAction = protectedAction(
  { name: "catalog.updateExperience", schema: experienceUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateExperience(input, user);
    revalidateCatalog();
    return res;
  },
);

export const deleteExperienceAction = protectedAction(
  { name: "catalog.deleteExperience", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteExperience(id, user);
    revalidateCatalog();
    return res;
  },
);

export const addExperienceImageAction = protectedAction(
  { name: "catalog.addExperienceImage", schema: experienceImageAddSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await addExperienceImage(input, user);
    revalidateCatalog();
    return res;
  },
);

export const removeExperienceImageAction = protectedAction(
  { name: "catalog.removeExperienceImage", schema: experienceImageRemoveSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await removeExperienceImage(input, user);
    revalidateCatalog();
    return res;
  },
);

export const reorderExperienceImagesAction = protectedAction(
  { name: "catalog.reorderExperienceImages", schema: experienceImageReorderSchema, permission: WRITE },
  async (input, { user }) => {
    await reorderExperienceImages(input, user);
    revalidateCatalog();
    return { ok: true };
  },
);

// --- Menús ---------------------------------------------------------------------

export const createMenuAction = protectedAction(
  { name: "catalog.createMenu", schema: menuFormSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createMenu(input, user);
    revalidateCatalog();
    return res;
  },
);

export const updateMenuAction = protectedAction(
  { name: "catalog.updateMenu", schema: menuUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateMenu(input, user);
    revalidateCatalog();
    return res;
  },
);

export const deleteMenuAction = protectedAction(
  { name: "catalog.deleteMenu", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteMenu(id, user);
    revalidateCatalog();
    return res;
  },
);

export const createMenuItemAction = protectedAction(
  { name: "catalog.createMenuItem", schema: menuItemCreateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createMenuItem(input, user);
    revalidateCatalog();
    return res;
  },
);

export const updateMenuItemAction = protectedAction(
  { name: "catalog.updateMenuItem", schema: menuItemUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateMenuItem(input, user);
    revalidateCatalog();
    return res;
  },
);

export const deleteMenuItemAction = protectedAction(
  { name: "catalog.deleteMenuItem", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteMenuItem(id, user);
    revalidateCatalog();
    return res;
  },
);

export const reorderMenuItemsAction = protectedAction(
  { name: "catalog.reorderMenuItems", schema: menuItemReorderSchema, permission: WRITE },
  async (input, { user }) => {
    await reorderMenuItems(input, user);
    revalidateCatalog();
    return { ok: true };
  },
);

// --- Add-ons -------------------------------------------------------------------

export const createAddOnAction = protectedAction(
  { name: "catalog.createAddOn", schema: addOnFormSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createAddOn(input, user);
    revalidateCatalog();
    return res;
  },
);

export const updateAddOnAction = protectedAction(
  { name: "catalog.updateAddOn", schema: addOnUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateAddOn(input, user);
    revalidateCatalog();
    return res;
  },
);

export const deleteAddOnAction = protectedAction(
  { name: "catalog.deleteAddOn", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteAddOn(id, user);
    revalidateCatalog();
    return res;
  },
);

// --- Estilos -------------------------------------------------------------------

export const createStyleAction = protectedAction(
  { name: "catalog.createStyle", schema: styleFormSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createStyle(input, user);
    revalidateCatalog();
    return res;
  },
);

export const updateStyleAction = protectedAction(
  { name: "catalog.updateStyle", schema: styleUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateStyle(input, user);
    revalidateCatalog();
    return res;
  },
);

export const deleteStyleAction = protectedAction(
  { name: "catalog.deleteStyle", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteStyle(id, user);
    revalidateCatalog();
    return res;
  },
);

// --- Zonas ---------------------------------------------------------------------

export const createServiceAreaAction = protectedAction(
  { name: "catalog.createServiceArea", schema: areaFormSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createServiceArea(input, user);
    const overlaps = await findPostalCodeOverlaps(input.postalCodes, res.id);
    revalidateCatalog();
    return { ...res, overlaps };
  },
);

export const updateServiceAreaAction = protectedAction(
  { name: "catalog.updateServiceArea", schema: areaUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateServiceArea(input, user);
    const overlaps = await findPostalCodeOverlaps(input.postalCodes, input.id);
    revalidateCatalog();
    return { ...res, overlaps };
  },
);

export const deleteServiceAreaAction = protectedAction(
  { name: "catalog.deleteServiceArea", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteServiceArea(id, user);
    revalidateCatalog();
    return res;
  },
);

// --- Rangos de presupuesto -------------------------------------------------------

export const createBudgetRangeAction = protectedAction(
  { name: "catalog.createBudgetRange", schema: budgetFormSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await createBudgetRange(input, user);
    revalidateCatalog();
    return res;
  },
);

export const updateBudgetRangeAction = protectedAction(
  { name: "catalog.updateBudgetRange", schema: budgetUpdateSchema, permission: WRITE },
  async (input, { user }) => {
    const res = await updateBudgetRange(input, user);
    revalidateCatalog();
    return res;
  },
);

export const deleteBudgetRangeAction = protectedAction(
  { name: "catalog.deleteBudgetRange", schema: deleteSchema, permission: WRITE },
  async ({ id }, { user }) => {
    const res = await deleteBudgetRange(id, user);
    revalidateCatalog();
    return res;
  },
);
