import "server-only";
import { prisma } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import type { CatalogEntity } from "../schemas";
import { assertCan, auditCatalog } from "./catalog-common";

const ENTITY_TYPE: Record<CatalogEntity, string> = {
  experience: "Experience",
  menu: "Menu",
  addOn: "AddOn",
  style: "Style",
  serviceArea: "ServiceArea",
  budgetRange: "BudgetRange",
};

/** Activa/desactiva rápidamente un elemento del catálogo desde las listas (auditado). */
export async function setCatalogActive(
  input: { entity: CatalogEntity; id: string; active: boolean },
  actor: SessionUser,
): Promise<{ id: string; active: boolean }> {
  assertCan(actor, "catalog:write");
  const { entity, id, active } = input;
  const where = { id };
  const select = { id: true, active: true } as const;
  let before: { id: string; active: boolean } | null = null;
  switch (entity) {
    case "experience": {
      const exp = await prisma.experience.findUnique({ where, select: { ...select, basePriceCents: true } });
      if (exp && active && exp.basePriceCents <= 0) {
        throw new ValidationError("Define el precio base antes de activar la experiencia.");
      }
      before = exp ? { id: exp.id, active: exp.active } : null;
      if (before) await prisma.experience.update({ where, data: { active, ...(active ? {} : { featured: false }) } });
      break;
    }
    case "menu":
      before = await prisma.menu.findUnique({ where, select });
      if (before) await prisma.menu.update({ where, data: { active } });
      break;
    case "addOn":
      before = await prisma.addOn.findUnique({ where, select });
      if (before) await prisma.addOn.update({ where, data: { active } });
      break;
    case "style":
      before = await prisma.style.findUnique({ where, select });
      if (before) await prisma.style.update({ where, data: { active } });
      break;
    case "serviceArea":
      before = await prisma.serviceArea.findUnique({ where, select });
      if (before) await prisma.serviceArea.update({ where, data: { active } });
      break;
    case "budgetRange":
      before = await prisma.budgetRange.findUnique({ where, select });
      if (before) await prisma.budgetRange.update({ where, data: { active } });
      break;
  }
  if (!before) throw new NotFoundError("El elemento ya no existe.");
  if (before.active !== active) {
    await auditCatalog({
      action: "catalog.status_changed",
      entityType: ENTITY_TYPE[entity],
      entityId: id,
      before: { active: before.active },
      after: { active },
      actor,
    });
  }
  return { id, active };
}
