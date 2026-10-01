import "server-only";
import { prisma } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { deleteMedia } from "@/features/media/server/upload-service";
import { mediaUrl } from "@/features/media/server/media-url";
import { moveInList, nextSortOrder, normalizeOrder, type Direction } from "../domain/ordering";
import { faqSchema, testimonialSchema, type FaqValues, type TestimonialValues } from "../schemas";

// -----------------------------------------------------------------------------
// Lecturas
// -----------------------------------------------------------------------------

export async function listTestimonials() {
  return prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function listFaqs() {
  return prisma.faq.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { experience: { select: { id: true, name: true } } },
  });
}

export async function listExperienceOptions(): Promise<Array<{ id: string; name: string }>> {
  return prisma.experience.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export type GalleryItem = {
  id: string;
  alt: string | null;
  featured: boolean;
  sortOrder: number;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
};

export async function listGallery(): Promise<GalleryItem[]> {
  const assets = await prisma.mediaAsset.findMany({
    where: { purpose: "GALLERY" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return assets.map((a) => ({
    id: a.id,
    alt: a.alt,
    featured: a.featured,
    sortOrder: a.sortOrder,
    url: mediaUrl(a),
    mimeType: a.mimeType,
    width: a.width,
    height: a.height,
    createdAt: a.createdAt,
  }));
}

// -----------------------------------------------------------------------------
// Testimonios
// -----------------------------------------------------------------------------

export async function saveTestimonial(input: TestimonialValues, actor: SessionUser): Promise<{ id: string }> {
  const data = testimonialSchema.parse(input);
  const values = {
    authorName: data.authorName,
    occasion: data.occasion || null,
    body: data.body,
    rating: data.rating,
    active: data.active,
    sortOrder: data.sortOrder,
  };
  if (data.id) {
    const before = await prisma.testimonial.findUnique({ where: { id: data.id } });
    if (!before) throw new NotFoundError("El testimonio ya no existe.");
    const updated = await prisma.testimonial.update({ where: { id: data.id }, data: values });
    await audit({ action: "testimonial.updated", entityType: "Testimonial", entityId: updated.id, before, after: updated, actor });
    return { id: updated.id };
  }
  const created = await prisma.testimonial.create({ data: values });
  await audit({ action: "testimonial.created", entityType: "Testimonial", entityId: created.id, after: created, actor });
  return { id: created.id };
}

export async function setTestimonialActive(id: string, active: boolean, actor: SessionUser) {
  const before = await prisma.testimonial.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("El testimonio ya no existe.");
  const updated = await prisma.testimonial.update({ where: { id }, data: { active } });
  await audit({
    action: "testimonial.updated",
    entityType: "Testimonial",
    entityId: id,
    before: { active: before.active },
    after: { active: updated.active },
    actor,
  });
  return { id, active: updated.active };
}

export async function deleteTestimonial(id: string, actor: SessionUser) {
  const before = await prisma.testimonial.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("El testimonio ya no existe.");
  await prisma.testimonial.delete({ where: { id } });
  await audit({ action: "testimonial.deleted", entityType: "Testimonial", entityId: id, before, actor });
  return { id };
}

export async function moveTestimonial(id: string, direction: Direction) {
  const rows = await prisma.testimonial.findMany({
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const next = moveInList(
    rows.map((r) => r.id),
    id,
    direction,
  );
  if (!next) return { moved: false };
  await prisma.$transaction(
    normalizeOrder(next).map((o) => prisma.testimonial.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
  );
  return { moved: true };
}

// -----------------------------------------------------------------------------
// Preguntas frecuentes
// -----------------------------------------------------------------------------

export async function saveFaq(input: FaqValues, actor: SessionUser): Promise<{ id: string }> {
  const data = faqSchema.parse(input);
  const experienceId = data.experienceId || null;
  if (experienceId) {
    const exists = await prisma.experience.findUnique({ where: { id: experienceId }, select: { id: true } });
    if (!exists) throw new ValidationError("La experiencia elegida ya no existe.", { experienceId: ["Elige otra experiencia"] });
  }
  const values = {
    question: data.question,
    answer: data.answer,
    category: data.category,
    experienceId,
    active: data.active,
    sortOrder: data.sortOrder,
  };
  if (data.id) {
    const before = await prisma.faq.findUnique({ where: { id: data.id } });
    if (!before) throw new NotFoundError("La pregunta ya no existe.");
    const updated = await prisma.faq.update({ where: { id: data.id }, data: values });
    await audit({ action: "faq.updated", entityType: "Faq", entityId: updated.id, before, after: updated, actor });
    return { id: updated.id };
  }
  const created = await prisma.faq.create({ data: values });
  await audit({ action: "faq.created", entityType: "Faq", entityId: created.id, after: created, actor });
  return { id: created.id };
}

export async function setFaqActive(id: string, active: boolean, actor: SessionUser) {
  const before = await prisma.faq.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("La pregunta ya no existe.");
  const updated = await prisma.faq.update({ where: { id }, data: { active } });
  await audit({
    action: "faq.updated",
    entityType: "Faq",
    entityId: id,
    before: { active: before.active },
    after: { active: updated.active },
    actor,
  });
  return { id, active: updated.active };
}

export async function deleteFaq(id: string, actor: SessionUser) {
  const before = await prisma.faq.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("La pregunta ya no existe.");
  await prisma.faq.delete({ where: { id } });
  await audit({ action: "faq.deleted", entityType: "Faq", entityId: id, before, actor });
  return { id };
}

export async function moveFaq(id: string, direction: Direction) {
  const rows = await prisma.faq.findMany({ select: { id: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const next = moveInList(
    rows.map((r) => r.id),
    id,
    direction,
  );
  if (!next) return { moved: false };
  await prisma.$transaction(
    normalizeOrder(next).map((o) => prisma.faq.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
  );
  return { moved: true };
}

// -----------------------------------------------------------------------------
// Galería (MediaAsset purpose GALLERY)
// -----------------------------------------------------------------------------

async function getGalleryAsset(id: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.purpose !== "GALLERY") throw new NotFoundError("La imagen ya no existe en la galería.");
  return asset;
}

/** Después de subir con MediaUploader: la imagen se coloca al final de la galería y se audita. */
export async function finalizeGalleryUpload(id: string, actor: SessionUser) {
  const asset = await getGalleryAsset(id);
  const orders = await prisma.mediaAsset.findMany({
    where: { purpose: "GALLERY", id: { not: id } },
    select: { sortOrder: true },
  });
  const sortOrder = nextSortOrder(orders.map((o) => o.sortOrder));
  const updated = await prisma.mediaAsset.update({
    where: { id },
    data: { sortOrder, visibility: "PUBLIC", approved: true },
  });
  await audit({
    action: "media.uploaded",
    entityType: "MediaAsset",
    entityId: id,
    after: { purpose: "GALLERY", sortOrder: updated.sortOrder, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes },
    actor,
  });
  return { id, sortOrder };
}

export async function updateGalleryAlt(id: string, alt: string, actor: SessionUser) {
  const before = await getGalleryAsset(id);
  const clean = alt.trim();
  if (clean.length < 3) throw new ValidationError("Describe la imagen (mínimo 3 caracteres).", { alt: ["Mínimo 3 caracteres"] });
  await prisma.mediaAsset.update({ where: { id }, data: { alt: clean } });
  await audit({
    action: "media.updated",
    entityType: "MediaAsset",
    entityId: id,
    before: { alt: before.alt },
    after: { alt: clean },
    actor,
  });
  return { id, alt: clean };
}

export async function setGalleryFeatured(id: string, featured: boolean, actor: SessionUser) {
  const before = await getGalleryAsset(id);
  await prisma.mediaAsset.update({ where: { id }, data: { featured } });
  await audit({
    action: "media.updated",
    entityType: "MediaAsset",
    entityId: id,
    before: { featured: before.featured },
    after: { featured },
    actor,
  });
  return { id, featured };
}

export async function moveGalleryItem(id: string, direction: Direction) {
  await getGalleryAsset(id);
  const rows = await prisma.mediaAsset.findMany({
    where: { purpose: "GALLERY" },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const next = moveInList(
    rows.map((r) => r.id),
    id,
    direction,
  );
  if (!next) return { moved: false };
  await prisma.$transaction(
    normalizeOrder(next).map((o) => prisma.mediaAsset.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
  );
  return { moved: true };
}

/** Elimina una imagen de la galería (registro + objeto en storage) y audita "media.deleted". */
export async function deleteGalleryItem(id: string, actor: SessionUser) {
  const asset = await getGalleryAsset(id);
  await deleteMedia(id);
  await audit({
    action: "media.deleted",
    entityType: "MediaAsset",
    entityId: id,
    before: {
      purpose: asset.purpose,
      alt: asset.alt,
      driver: asset.driver,
      storageKey: asset.storageKey,
      url: asset.url,
      featured: asset.featured,
    },
    actor,
  });
  return { id };
}
