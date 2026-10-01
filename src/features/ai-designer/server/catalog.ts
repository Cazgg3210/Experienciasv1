import "server-only";
import { prisma } from "@/db";
import { getSettings } from "@/features/settings/server/settings-service";
import { toEngineSettings } from "@/features/quotes/server/pricing";
import type { DesignerCatalog } from "../domain/types";

/**
 * Carga el catálogo REAL y activo para el diseñador (experiencias con sus estilos, menús,
 * add-ons y zonas compatibles; presupuestos; reglas de precio).
 * `experienceIds` limita las experiencias (útil en pruebas de integración).
 */
export async function loadDesignerCatalog(
  filter: { experienceIds?: string[] } = {},
): Promise<DesignerCatalog> {
  const [experiences, menus, addOns, styles, areas, budgets, pricing] = await Promise.all([
    prisma.experience.findMany({
      where: { active: true, ...(filter.experienceIds ? { id: { in: filter.experienceIds } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        styles: { where: { active: true }, select: { id: true }, orderBy: { sortOrder: "asc" } },
        menus: { where: { active: true }, select: { id: true }, orderBy: { sortOrder: "asc" } },
        addOns: { where: { active: true }, select: { id: true }, orderBy: { sortOrder: "asc" } },
        serviceAreas: { where: { active: true }, select: { id: true } },
      },
    }),
    prisma.menu.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { items: { select: { name: true, description: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.addOn.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.style.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.serviceArea.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.budgetRange.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { minCents: "asc" }],
    }),
    getSettings("pricing"),
  ]);

  // Sólo lo que alguna experiencia activa puede ofrecer (prompt más corto, ids siempre válidos).
  const usedMenus = new Set(experiences.flatMap((e) => e.menus.map((m) => m.id)));
  const usedAddOns = new Set(experiences.flatMap((e) => e.addOns.map((a) => a.id)));
  const usedStyles = new Set(experiences.flatMap((e) => e.styles.map((s) => s.id)));

  return {
    experiences: experiences.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      tagline: e.tagline,
      description: e.description,
      type: e.type,
      occasions: e.occasions,
      basePriceCents: e.basePriceCents,
      baseGuests: e.baseGuests,
      minGuests: e.minGuests,
      maxGuests: e.maxGuests,
      extraGuestPriceCents: e.extraGuestPriceCents,
      includes: e.includes,
      featured: e.featured,
      sortOrder: e.sortOrder,
      styleIds: e.styles.map((s) => s.id),
      menuIds: e.menus.map((m) => m.id),
      addOnIds: e.addOns.map((a) => a.id),
      serviceAreaIds: e.serviceAreas.map((a) => a.id),
    })),
    menus: menus
      .filter((m) => usedMenus.has(m.id))
      .map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        description: m.description,
        pricingType: m.pricingType,
        priceCents: m.priceCents,
        tags: m.tags,
        dietaryTags: m.dietaryTags,
        itemNames: m.items.map((i) => (i.description ? `${i.name} (${i.description})` : i.name)),
        sortOrder: m.sortOrder,
      })),
    addOns: addOns
      .filter((a) => usedAddOns.has(a.id))
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        category: a.category,
        pricingType: a.pricingType,
        priceCents: a.priceCents,
        maxQuantity: a.maxQuantity,
        sortOrder: a.sortOrder,
      })),
    styles: styles
      .filter((s) => usedStyles.has(s.id))
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
        palette: s.palette,
        sortOrder: s.sortOrder,
      })),
    areas: areas.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      logisticsFeeCents: a.logisticsFeeCents,
    })),
    budgets: budgets.map((b) => ({ id: b.id, label: b.label, minCents: b.minCents, maxCents: b.maxCents })),
    pricing: toEngineSettings(pricing),
  };
}
