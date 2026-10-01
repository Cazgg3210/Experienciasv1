import "server-only";
import { prisma } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/server/auth/session";
import { deleteMedia } from "@/features/media/server/upload-service";
import {
  canonicalCostComponents,
  deactivationMessage,
  deletionDecision,
  diffPriceFields,
  hasNonZeroPricing,
  isPermutation,
  normalizeTextList,
  publicMediaPath,
} from "../domain/catalog-rules";
import type { ExperienceFormValues, ExperienceUpdateValues } from "../schemas";
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

const FAQ_CATEGORY = "experiencia";

function scalarData(v: ExperienceFormValues) {
  return {
    name: v.name.trim(),
    slug: v.slug,
    tagline: emptyToNull(v.tagline),
    description: v.description.trim(),
    type: v.type,
    occasions: [...new Set(v.occasions)],
    durationMinutes: v.durationMinutes,
    active: v.active,
    featured: v.featured,
    sortOrder: v.sortOrder,
    baseGuests: v.baseGuests,
    minGuests: v.minGuests,
    maxGuests: v.maxGuests,
    basePriceCents: v.basePriceCents,
    extraGuestPriceCents: v.extraGuestPriceCents,
    extraGuestCostCents: v.extraGuestCostCents,
    includes: normalizeTextList(v.includes),
    coverImageUrl: emptyToNull(v.coverImageUrl),
  };
}

function priceSnapshot(v: {
  basePriceCents: number;
  extraGuestPriceCents: number;
  extraGuestCostCents: number;
  costComponents: Array<{ category: string; description: string; amountCents: number; perGuest: boolean }>;
}) {
  return {
    basePriceCents: v.basePriceCents,
    extraGuestPriceCents: v.extraGuestPriceCents,
    extraGuestCostCents: v.extraGuestCostCents,
    costComponents: canonicalCostComponents(v.costComponents),
  };
}

const PRICE_KEYS = ["basePriceCents", "extraGuestPriceCents", "extraGuestCostCents", "costComponents"] as const;

async function validateRelations(v: ExperienceFormValues) {
  await Promise.all([
    assertIdsExist("style", v.styleIds),
    assertIdsExist("serviceArea", v.serviceAreaIds),
    assertIdsExist("menu", v.menuIds),
    assertIdsExist("addOn", v.addOnIds),
    assertIdsExist(
      "inventoryItem",
      v.inventoryReqs.map((r) => r.inventoryItemId),
    ),
  ]);
}

const connectIds = (ids: readonly string[]) => [...new Set(ids)].map((id) => ({ id }));

/** Crea una experiencia con relaciones, costos, inventario y FAQs. */
export async function createExperience(input: ExperienceFormValues, actor: SessionUser): Promise<{ id: string; slug: string }> {
  assertCan(actor, "catalog:write");
  const prices = priceSnapshot(input);
  if (
    hasNonZeroPricing([
      prices.basePriceCents,
      prices.extraGuestPriceCents,
      prices.extraGuestCostCents,
      ...prices.costComponents.map((c) => c.amountCents),
    ])
  ) {
    assertCanPrice(actor);
  }
  await ensureSlugAvailable("experience", input.slug);
  await validateRelations(input);

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.experience.create({
        data: {
          ...scalarData(input),
          styles: { connect: connectIds(input.styleIds) },
          serviceAreas: { connect: connectIds(input.serviceAreaIds) },
          menus: { connect: connectIds(input.menuIds) },
          addOns: { connect: connectIds(input.addOnIds) },
          costComponents: {
            create: input.costComponents.map((c, i) => ({
              category: c.category,
              description: c.description.trim(),
              amountCents: c.amountCents,
              perGuest: c.perGuest,
              sortOrder: i,
            })),
          },
          inventoryReqs: {
            create: input.inventoryReqs.map((r) => ({
              inventoryItemId: r.inventoryItemId,
              quantity: r.quantity,
              perGuest: r.perGuest,
            })),
          },
          faqs: {
            create: input.faqs.map((f, i) => ({
              question: f.question.trim(),
              answer: f.answer.trim(),
              active: f.active,
              sortOrder: i,
              category: FAQ_CATEGORY,
            })),
          },
        },
        select: { id: true, slug: true },
      });
      await auditCatalog(
        { action: "catalog.created", entityType: "Experience", entityId: created.id, after: { name: input.name, ...prices }, actor },
        tx,
      );
      return created;
    }, TX_OPTIONS);
  } catch (error) {
    rethrowSlugConflict(error, input.slug);
  }
}

/** Actualiza todas las secciones del editor. Cambios de precio/costo requieren pricing:write y se auditan. */
export async function updateExperience(input: ExperienceUpdateValues, actor: SessionUser): Promise<{ id: string; slug: string }> {
  assertCan(actor, "catalog:write");
  const existing = await prisma.experience.findUnique({
    where: { id: input.id },
    include: { costComponents: { orderBy: { sortOrder: "asc" } }, faqs: { select: { id: true } } },
  });
  if (!existing) throw new NotFoundError("La experiencia ya no existe.");

  const diff = diffPriceFields(priceSnapshot(existing), priceSnapshot(input), PRICE_KEYS);
  if (diff.changed) assertCanPrice(actor);

  await ensureSlugAvailable("experience", input.slug, input.id);
  await validateRelations(input);

  const existingFaqIds = new Set(existing.faqs.map((f) => f.id));
  for (const f of input.faqs) {
    if (f.id && !existingFaqIds.has(f.id)) {
      throw new ValidationError("Una de las preguntas ya no existe. Recarga la página.");
    }
  }
  const keepFaqIds = input.faqs.map((f) => f.id).filter((id): id is string => !!id);

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.experience.update({
        where: { id: input.id },
        data: {
          ...scalarData(input),
          styles: { set: connectIds(input.styleIds) },
          serviceAreas: { set: connectIds(input.serviceAreaIds) },
          menus: { set: connectIds(input.menuIds) },
          addOns: { set: connectIds(input.addOnIds) },
        },
        select: { id: true, slug: true },
      });

      // Costos base: se reemplazan en el orden del editor
      await tx.experienceCostComponent.deleteMany({ where: { experienceId: input.id } });
      if (input.costComponents.length) {
        await tx.experienceCostComponent.createMany({
          data: input.costComponents.map((c, i) => ({
            experienceId: input.id,
            category: c.category,
            description: c.description.trim(),
            amountCents: c.amountCents,
            perGuest: c.perGuest,
            sortOrder: i,
          })),
        });
      }

      // Inventario requerido
      await tx.experienceInventoryRequirement.deleteMany({ where: { experienceId: input.id } });
      if (input.inventoryReqs.length) {
        await tx.experienceInventoryRequirement.createMany({
          data: input.inventoryReqs.map((r) => ({
            experienceId: input.id,
            inventoryItemId: r.inventoryItemId,
            quantity: r.quantity,
            perGuest: r.perGuest,
          })),
        });
      }

      // FAQs: sincroniza (actualiza, crea y elimina las que se quitaron)
      await tx.faq.deleteMany({ where: { experienceId: input.id, id: { notIn: keepFaqIds } } });
      for (const [i, f] of input.faqs.entries()) {
        const data = { question: f.question.trim(), answer: f.answer.trim(), active: f.active, sortOrder: i };
        if (f.id) await tx.faq.update({ where: { id: f.id }, data });
        else await tx.faq.create({ data: { ...data, experienceId: input.id, category: FAQ_CATEGORY } });
      }

      if (diff.changed) {
        await auditPriceChange(
          { entityType: "Experience", entityId: input.id, name: input.name, before: diff.before, after: diff.after, actor },
          tx,
        );
      }
      if (existing.active !== input.active) {
        await auditCatalog(
          {
            action: "catalog.status_changed",
            entityType: "Experience",
            entityId: input.id,
            before: { active: existing.active },
            after: { active: input.active },
            actor,
          },
          tx,
        );
      }
      return updated;
    }, TX_OPTIONS);
  } catch (error) {
    rethrowSlugConflict(error, input.slug);
  }
}

/** Elimina sólo si no hay leads/cotizaciones/eventos ligados; si los hay, desactiva. */
export async function deleteExperience(id: string, actor: SessionUser): Promise<DeleteOutcome> {
  assertCan(actor, "catalog:write");
  const exp = await prisma.experience.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      images: { select: { mediaAssetId: true } },
      _count: { select: { leads: true, quotes: true, events: true, checklistTemplates: true } },
    },
  });
  if (!exp) throw new NotFoundError("La experiencia ya no existe.");

  const decision = deletionDecision([
    { count: exp._count.events, one: "evento", many: "eventos" },
    { count: exp._count.quotes, one: "cotización", many: "cotizaciones" },
    { count: exp._count.leads, one: "lead", many: "leads" },
    { count: exp._count.checklistTemplates, one: "plantilla de checklist", many: "plantillas de checklist" },
  ]);

  const deactivate = async (reasons: string[]): Promise<DeleteOutcome> => {
    await prisma.experience.update({ where: { id }, data: { active: false, featured: false } });
    await auditCatalog({
      action: "catalog.deactivated",
      entityType: "Experience",
      entityId: id,
      before: { active: exp.active },
      after: { active: false, reasons },
      actor,
    });
    return { outcome: "deactivated", message: deactivationMessage({ label: "la experiencia", feminine: true }, reasons) };
  };

  if (decision.mode === "deactivate") return deactivate(decision.reasons);

  try {
    await prisma.experience.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyError(error)) return deactivate(["registros relacionados"]);
    throw error;
  }
  await auditCatalog({ action: "catalog.deleted", entityType: "Experience", entityId: id, before: { name: exp.name }, actor });
  await cleanupOrphanMedia(exp.images.map((i) => i.mediaAssetId));
  return { outcome: "deleted", message: "Experiencia eliminada." };
}

/** Borra assets de experiencia que ya no estén ligados a ninguna experiencia (best-effort). */
async function cleanupOrphanMedia(mediaAssetIds: readonly string[]) {
  for (const mediaAssetId of mediaAssetIds) {
    try {
      const stillUsed = await prisma.experienceImage.count({ where: { mediaAssetId } });
      if (stillUsed) continue;
      const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { purpose: true } });
      if (asset?.purpose === "EXPERIENCE") await deleteMedia(mediaAssetId);
    } catch (error) {
      logger.warn("catalog.media_cleanup_failed", { mediaAssetId, error });
    }
  }
}

// -----------------------------------------------------------------------------
// Imágenes
// -----------------------------------------------------------------------------

export async function addExperienceImage(
  input: { experienceId: string; mediaAssetId: string },
  actor: SessionUser,
): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const [exp, asset] = await Promise.all([
    prisma.experience.findUnique({ where: { id: input.experienceId }, select: { id: true } }),
    prisma.mediaAsset.findUnique({
      where: { id: input.mediaAssetId },
      select: { id: true, kind: true, purpose: true, visibility: true },
    }),
  ]);
  if (!exp) throw new NotFoundError("La experiencia ya no existe.");
  if (!asset || asset.kind !== "IMAGE") throw new ValidationError("La imagen no es válida. Vuelve a subirla.");
  if (asset.purpose !== "EXPERIENCE" || asset.visibility !== "PUBLIC") {
    throw new ValidationError("Sube la imagen desde este editor para que sea pública.");
  }
  const existing = await prisma.experienceImage.findUnique({
    where: { experienceId_mediaAssetId: { experienceId: input.experienceId, mediaAssetId: input.mediaAssetId } },
    select: { id: true },
  });
  if (existing) return existing;
  const last = await prisma.experienceImage.findFirst({
    where: { experienceId: input.experienceId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return prisma.experienceImage.create({
    data: { experienceId: input.experienceId, mediaAssetId: input.mediaAssetId, sortOrder: (last?.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
}

/**
 * Quita una imagen de la galería. Si era la portada (coverImageUrl apunta a ese asset), la portada
 * se limpia para que el sitio use la primera foto restante en lugar de un enlace roto.
 */
export async function removeExperienceImage(
  input: { experienceId: string; imageId: string },
  actor: SessionUser,
): Promise<{ coverCleared: boolean }> {
  assertCan(actor, "catalog:write");
  const image = await prisma.experienceImage.findFirst({
    where: { id: input.imageId, experienceId: input.experienceId },
    select: { id: true, mediaAssetId: true, experience: { select: { coverImageUrl: true } } },
  });
  if (!image) throw new NotFoundError("La imagen ya no existe.");
  const coverCleared = isCoverOf(image.experience.coverImageUrl, image.mediaAssetId);
  await prisma.$transaction([
    prisma.experienceImage.delete({ where: { id: image.id } }),
    ...(coverCleared
      ? [prisma.experience.update({ where: { id: input.experienceId }, data: { coverImageUrl: null } })]
      : []),
  ]);
  await cleanupOrphanMedia([image.mediaAssetId]);
  return { coverCleared };
}

/** ¿La URL de portada apunta a este asset (/api/media/<id>, con o sin query)? */
function isCoverOf(coverImageUrl: string | null, mediaAssetId: string): boolean {
  if (!coverImageUrl) return false;
  return coverImageUrl.split("?")[0] === publicMediaPath(mediaAssetId);
}

export async function reorderExperienceImages(
  input: { experienceId: string; orderedIds: string[] },
  actor: SessionUser,
): Promise<void> {
  assertCan(actor, "catalog:write");
  const images = await prisma.experienceImage.findMany({
    where: { experienceId: input.experienceId },
    select: { id: true },
  });
  if (!isPermutation(images.map((i) => i.id), input.orderedIds)) {
    throw new ValidationError("El orden de imágenes cambió en otra pestaña. Recarga la página.");
  }
  await prisma.$transaction(
    input.orderedIds.map((id, i) => prisma.experienceImage.update({ where: { id }, data: { sortOrder: i } })),
  );
}

