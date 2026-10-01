import "server-only";
import { prisma } from "@/db";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import { deactivationMessage, deletionDecision } from "../domain/catalog-rules";
import type { BudgetFormValues, BudgetUpdateValues } from "../schemas";
import { assertCan, auditCatalog, isForeignKeyError, TX_OPTIONS, type DeleteOutcome } from "./catalog-common";

function budgetData(v: BudgetFormValues) {
  return {
    label: v.label.trim(),
    minCents: v.minCents,
    maxCents: v.maxCents,
    sortOrder: v.sortOrder,
    active: v.active,
  };
}

export async function createBudgetRange(input: BudgetFormValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const data = budgetData(input);
  return prisma.$transaction(async (tx) => {
    const created = await tx.budgetRange.create({ data, select: { id: true } });
    await auditCatalog(
      {
        action: "catalog.created",
        entityType: "BudgetRange",
        entityId: created.id,
        after: { label: data.label, minCents: data.minCents, maxCents: data.maxCents },
        actor,
      },
      tx,
    );
    return created;
  }, TX_OPTIONS);
}

export async function updateBudgetRange(input: BudgetUpdateValues, actor: SessionUser): Promise<{ id: string }> {
  assertCan(actor, "catalog:write");
  const existing = await prisma.budgetRange.findUnique({ where: { id: input.id }, select: { id: true, active: true } });
  if (!existing) throw new NotFoundError("El rango ya no existe.");
  const data = budgetData(input);
  const updated = await prisma.budgetRange.update({ where: { id: input.id }, data, select: { id: true } });
  if (existing.active !== data.active) {
    await auditCatalog({
      action: "catalog.status_changed",
      entityType: "BudgetRange",
      entityId: input.id,
      before: { active: existing.active },
      after: { active: data.active },
      actor,
    });
  }
  return updated;
}

export async function deleteBudgetRange(id: string, actor: SessionUser): Promise<DeleteOutcome> {
  assertCan(actor, "catalog:write");
  const range = await prisma.budgetRange.findUnique({
    where: { id },
    select: { id: true, label: true, active: true, _count: { select: { leads: true } } },
  });
  if (!range) throw new NotFoundError("El rango ya no existe.");
  const decision = deletionDecision([{ count: range._count.leads, one: "lead", many: "leads" }]);
  const deactivate = async (reasons: string[]): Promise<DeleteOutcome> => {
    await prisma.budgetRange.update({ where: { id }, data: { active: false } });
    await auditCatalog({
      action: "catalog.deactivated",
      entityType: "BudgetRange",
      entityId: id,
      before: { active: range.active },
      after: { active: false, reasons },
      actor,
    });
    return { outcome: "deactivated", message: deactivationMessage({ label: "el rango", feminine: false }, reasons) };
  };
  if (decision.mode === "deactivate") return deactivate(decision.reasons);
  try {
    await prisma.budgetRange.delete({ where: { id } });
  } catch (error) {
    if (isForeignKeyError(error)) return deactivate(["registros relacionados"]);
    throw error;
  }
  await auditCatalog({ action: "catalog.deleted", entityType: "BudgetRange", entityId: id, before: { label: range.label }, actor });
  return { outcome: "deleted", message: "Rango eliminado." };
}
