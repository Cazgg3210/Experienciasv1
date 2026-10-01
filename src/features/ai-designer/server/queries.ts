import "server-only";
import { prisma } from "@/db";
import type { DesignerPageOptions } from "../types";

/** Opciones del formulario del diseñador (presupuestos y zonas activas) + disponibilidad del catálogo. */
export async function getDesignerPageData(): Promise<DesignerPageOptions & { hasCatalog: boolean }> {
  const [budgets, areas, experienceCount] = await Promise.all([
    prisma.budgetRange.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { minCents: "asc" }],
      select: { id: true, label: true },
    }),
    prisma.serviceArea.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.experience.count({ where: { active: true } }),
  ]);
  return { budgets, areas, hasCatalog: experienceCount > 0 };
}
