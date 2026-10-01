import "server-only";
import { prisma } from "@/db";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import {
  deactivationMessage,
  deletionDecision,
  diffPriceFields,
  hasNonZeroPricing,
  normalizePostalCodes,
} from "../domain/catalog-rules";
import type { AreaFormValues, AreaUpdateValues } from "../schemas";
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

const PRICE_KEYS = ["logisticsFeeCents", "logisticsCostCents"] as const;

function areaData(v: AreaFormValues) {
  return {
    name: v.name.trim(),
    slug: v.slug,
    description: emptyToNull(v.description),
    postalCodes: normalizePostalCodes(v.postalCodes).valid,
    logisticsFeeCents: v.logisticsFeeCents,
    logisticsCostCents: v.logisticsCostCents,
    active: v.active,
    sortOrder: v.sortOrder,
  };
}

/** Busca otra zona activa que ya cubra alguno de los códigos postales (para avisar, no bloquear). */
export async function findPostalCodeOverlaps(postalCodes: string[], excludeId?: string) {
  if (!postalCodes.length) return [];
  const rows = await prisma.serviceArea.findMany({
    where: { postalCodes: { hasSome: postalCodes }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, name: true, postalCodes: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, codes: r.postalCodes.filter((c) => postalCodes.includes(c)) }));
}

export async function createServiceArea(input: AreaFormValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const data = areaData(input);
  if (hasNonZeroPricing([data.logisticsFeeCents, data.logisticsCostCents])) assertCanPrice(actor);
  await ensureSlugAvailable("serviceArea", data.slug);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.serviceArea.create({ data, select: { id: true } });
      await auditCatalog(
        {
          action: "catalog.created",
          entityType: "ServiceArea",
          entityId: created.id,
          after: { name: data.name, logisticsFeeCents: data.logisticsFeeCents, logisticsCostCents: data.logisticsCostCents },
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

export async function updateServiceArea(input: AreaUpdateValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const existing = await prisma.serviceArea.findUnique({ where: { id: input.id } });
  if (!existing) throw new NotFoundError("La zona ya no existe.");
  const data = areaData(input);
  const diff = diffPriceFields(
    { logisticsFeeCents: existing.logisticsFeeCents, logisticsCostCents: existing.logisticsCostCents },
    { logisticsFeeCents: data.logisticsFeeCents, logisticsCostCents: data.logisticsCostCents },
    PRICE_KEYS,
  );
  if (diff.changed) assertCanPrice(actor);
  await ensureSlugAvailable("serviceArea", data.slug, input.id);
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceArea.update({ where: { id: input.id }, data, select: { id: true } });
      if (diff.changed) {
        await auditPriceChange(
          { entityType: "ServiceArea", entityId: input.id, name: data.name, before: diff.before, after: diff.after, actor },
          tx,
        );
      }
      if (existing.active !== data.active) {
        await auditCatalog(
          {
            action: "catalog.status_changed",
            entityType: "ServiceArea",
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

export async function deleteServiceArea(id: string, actor: SessionUser): Promise<DeleteOutcome> {
  assertCan(actor, "catalog:write");
  const area = await prisma.serviceArea.findUnique({
    where: { id },
    select: { id: true, name: true, active: true, _count: { select: { experiences: true, leads: true, quotes: true, events: true } } },
  });
  if (!area) throw new NotFoundError("La zona ya no existe.");
  const decision = deletionDecision([
    { count: area._count.experiences, one: "experiencia", many: "experiencias" },
    { count: area._count.events, one: "evento", many: "eventos" },
    { count: area._count.quotes, one: "cotización", many: "cotizaciones" },
    { count: area._count.leads, one: "lead", many: "leads" },
  ]);
  const deactivate = async (reasons: string[]): Promise<DeleteOutcome> => {
    await prisma.serviceArea.update({ where: { id }, data: { active: false } });
    await auditCatalog({
      action: "catalog.deactivated",
      entityType: "ServiceArea",
      entityId: id,
      before: { active: area.active },
      after: { active: false, reasons },
      actor,
    });
    return { outcome: "deactivated", message: deactivationMessage({ label: "la zona", feminine: true }, reasons) };
  };
  if (decision.mode === "deactivate") return deactivate(decision.reasons);
  try {
    await prisma.serviceArea.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyError(error)) return deactivate(["registros relacionados"]);
    throw error;
  }
  await auditCatalog({ action: "catalog.deleted", entityType: "ServiceArea", entityId: id, before: { name: area.name }, actor });
  return { outcome: "deleted", message: "Zona eliminada." };
}
