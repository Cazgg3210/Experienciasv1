import "server-only";
import { prisma } from "@/db";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import { deactivationMessage, deletionDecision, normalizePalette } from "../domain/catalog-rules";
import type { StyleFormValues, StyleUpdateValues } from "../schemas";
import {
  assertCan,
  auditCatalog,
  emptyToNull,
  ensureSlugAvailable,
  isForeignKeyError,
  rethrowSlugConflict,
  TX_OPTIONS,
  type DeleteOutcome,
} from "./catalog-common";

function styleData(v: StyleFormValues) {
  return {
    name: v.name.trim(),
    slug: v.slug,
    description: emptyToNull(v.description),
    palette: normalizePalette(v.palette),
    imageUrl: emptyToNull(v.imageUrl),
    active: v.active,
    sortOrder: v.sortOrder,
  };
}

export async function createStyle(input: StyleFormValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const data = styleData(input);
  await ensureSlugAvailable("style", data.slug);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.style.create({ data, select: { id: true } });
      await auditCatalog(
        { action: "catalog.created", entityType: "Style", entityId: created.id, after: { name: data.name, slug: data.slug }, actor },
        tx,
      );
      return created;
    }, TX_OPTIONS);
  } catch (error) {
    rethrowSlugConflict(error, data.slug);
  }
}

export async function updateStyle(input: StyleUpdateValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const existing = await prisma.style.findUnique({ where: { id: input.id }, select: { id: true, active: true } });
  if (!existing) throw new NotFoundError("El estilo ya no existe.");
  const data = styleData(input);
  await ensureSlugAvailable("style", data.slug, input.id);
  try {
    const updated = await prisma.style.update({ where: { id: input.id }, data, select: { id: true } });
    if (existing.active !== data.active) {
      await auditCatalog({
        action: "catalog.status_changed",
        entityType: "Style",
        entityId: input.id,
        before: { active: existing.active },
        after: { active: data.active },
        actor,
      });
    }
    return updated;
  } catch (error) {
    rethrowSlugConflict(error, data.slug);
  }
}

export async function deleteStyle(id: string, actor: SessionUser): Promise<DeleteOutcome> {
  assertCan(actor, "catalog:write");
  const style = await prisma.style.findUnique({
    where: { id },
    select: { id: true, name: true, active: true, _count: { select: { experiences: true, leads: true, quotes: true, events: true } } },
  });
  if (!style) throw new NotFoundError("El estilo ya no existe.");
  const decision = deletionDecision([
    { count: style._count.experiences, one: "experiencia", many: "experiencias" },
    { count: style._count.events, one: "evento", many: "eventos" },
    { count: style._count.quotes, one: "cotización", many: "cotizaciones" },
    { count: style._count.leads, one: "lead", many: "leads" },
  ]);
  const deactivate = async (reasons: string[]): Promise<DeleteOutcome> => {
    await prisma.style.update({ where: { id }, data: { active: false } });
    await auditCatalog({
      action: "catalog.deactivated",
      entityType: "Style",
      entityId: id,
      before: { active: style.active },
      after: { active: false, reasons },
      actor,
    });
    return { outcome: "deactivated", message: deactivationMessage({ label: "el estilo", feminine: false }, reasons) };
  };
  if (decision.mode === "deactivate") return deactivate(decision.reasons);
  try {
    await prisma.style.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyError(error)) return deactivate(["registros relacionados"]);
    throw error;
  }
  await auditCatalog({ action: "catalog.deleted", entityType: "Style", entityId: id, before: { name: style.name }, actor });
  return { outcome: "deleted", message: "Estilo eliminado." };
}
