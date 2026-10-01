"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  faqSchema,
  galleryAltSchema,
  galleryFeaturedSchema,
  idSchema,
  moveSchema,
  testimonialSchema,
  toggleActiveSchema,
} from "../schemas";
import {
  deleteFaq,
  deleteGalleryItem,
  deleteTestimonial,
  finalizeGalleryUpload,
  moveFaq,
  moveGalleryItem,
  moveTestimonial,
  saveFaq,
  saveTestimonial,
  setFaqActive,
  setGalleryFeatured,
  setTestimonialActive,
  updateGalleryAlt,
} from "./content-service";

/** El sitio público lee testimonios, FAQ y galería: invalidar su caché tras cada cambio. */
function revalidateContent(adminPath: string) {
  revalidatePath(adminPath);
  revalidatePath("/");
  revalidateTag("content");
}

/**
 * Las preguntas ligadas a una experiencia se muestran en su ficha pública, que se cachea
 * con la etiqueta "catalog": también hay que invalidarla.
 */
function revalidateFaqs() {
  revalidateContent("/admin/content/faq");
  revalidatePath("/experiencias", "layout");
  revalidateTag("catalog");
}

const P = "content:write" as const;

// Testimonios ------------------------------------------------------------------

export const saveTestimonialAction = protectedAction(
  { name: "content.saveTestimonial", schema: testimonialSchema, permission: P },
  async (input, { user }) => {
    const res = await saveTestimonial(input, user);
    revalidateContent("/admin/content");
    return res;
  },
);

export const setTestimonialActiveAction = protectedAction(
  { name: "content.testimonialActive", schema: toggleActiveSchema, permission: P },
  async ({ id, active }, { user }) => {
    const res = await setTestimonialActive(id, active, user);
    revalidateContent("/admin/content");
    return res;
  },
);

export const deleteTestimonialAction = protectedAction(
  { name: "content.deleteTestimonial", schema: idSchema, permission: P },
  async ({ id }, { user }) => {
    const res = await deleteTestimonial(id, user);
    revalidateContent("/admin/content");
    return res;
  },
);

export const moveTestimonialAction = protectedAction(
  { name: "content.moveTestimonial", schema: moveSchema, permission: P },
  async ({ id, direction }) => {
    const res = await moveTestimonial(id, direction);
    revalidateContent("/admin/content");
    return res;
  },
);

// FAQ ----------------------------------------------------------------------------

export const saveFaqAction = protectedAction(
  { name: "content.saveFaq", schema: faqSchema, permission: P },
  async (input, { user }) => {
    const res = await saveFaq(input, user);
    revalidateFaqs();
    return res;
  },
);

export const setFaqActiveAction = protectedAction(
  { name: "content.faqActive", schema: toggleActiveSchema, permission: P },
  async ({ id, active }, { user }) => {
    const res = await setFaqActive(id, active, user);
    revalidateFaqs();
    return res;
  },
);

export const deleteFaqAction = protectedAction(
  { name: "content.deleteFaq", schema: idSchema, permission: P },
  async ({ id }, { user }) => {
    const res = await deleteFaq(id, user);
    revalidateFaqs();
    return res;
  },
);

export const moveFaqAction = protectedAction(
  { name: "content.moveFaq", schema: moveSchema, permission: P },
  async ({ id, direction }) => {
    const res = await moveFaq(id, direction);
    revalidateFaqs();
    return res;
  },
);

// Galería ------------------------------------------------------------------------

export const finalizeGalleryUploadAction = protectedAction(
  { name: "content.galleryUploaded", schema: idSchema, permission: P },
  async ({ id }, { user }) => {
    const res = await finalizeGalleryUpload(id, user);
    revalidateContent("/admin/content/gallery");
    return res;
  },
);

export const updateGalleryAltAction = protectedAction(
  { name: "content.galleryAlt", schema: galleryAltSchema, permission: P },
  async ({ id, alt }, { user }) => {
    const res = await updateGalleryAlt(id, alt, user);
    revalidateContent("/admin/content/gallery");
    return res;
  },
);

export const setGalleryFeaturedAction = protectedAction(
  { name: "content.galleryFeatured", schema: galleryFeaturedSchema, permission: P },
  async ({ id, featured }, { user }) => {
    const res = await setGalleryFeatured(id, featured, user);
    revalidateContent("/admin/content/gallery");
    return res;
  },
);

export const moveGalleryItemAction = protectedAction(
  { name: "content.galleryMove", schema: moveSchema, permission: P },
  async ({ id, direction }) => {
    const res = await moveGalleryItem(id, direction);
    revalidateContent("/admin/content/gallery");
    return res;
  },
);

export const deleteGalleryItemAction = protectedAction(
  { name: "content.galleryDelete", schema: idSchema, permission: P },
  async ({ id }, { user }) => {
    const res = await deleteGalleryItem(id, user);
    revalidateContent("/admin/content/gallery");
    return res;
  },
);
