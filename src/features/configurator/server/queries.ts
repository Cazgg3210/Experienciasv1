import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/db";
import { getSettings } from "@/features/settings/server/settings-service";
import type { ConfiguratorCatalog } from "../types";

/**
 * Catálogo público del configurador. Sólo datos de venta (precios públicos), nunca costos.
 * Incluye zonas inactivas para mostrarlas como "Próximamente".
 */
export async function loadConfiguratorCatalog(): Promise<ConfiguratorCatalog> {
  const [experiences, styles, areas, menus, addOns, budgetRanges, pricing, availability] = await Promise.all([
    prisma.experience.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        type: true,
        occasions: true,
        basePriceCents: true,
        baseGuests: true,
        minGuests: true,
        maxGuests: true,
        durationMinutes: true,
        coverImageUrl: true,
        featured: true,
        sortOrder: true,
        styles: { where: { active: true }, select: { id: true } },
        menus: { where: { active: true }, select: { id: true } },
        addOns: { where: { active: true }, select: { id: true } },
        serviceAreas: { where: { active: true }, select: { id: true } },
      },
    }),
    prisma.style.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, description: true, palette: true, imageUrl: true },
    }),
    prisma.serviceArea.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, description: true, logisticsFeeCents: true, active: true },
    }),
    prisma.menu.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        pricingType: true,
        priceCents: true,
        tags: true,
        dietaryTags: true,
        items: { orderBy: { sortOrder: "asc" }, select: { name: true, course: true } },
      },
    }),
    prisma.addOn.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        pricingType: true,
        priceCents: true,
        maxQuantity: true,
        leadTimeDays: true,
        imageUrl: true,
      },
    }),
    prisma.budgetRange.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { minCents: "asc" }],
      select: { id: true, label: true, minCents: true, maxCents: true },
    }),
    getSettings("pricing"),
    getSettings("availability"),
  ]);

  return {
    experiences: experiences.map(({ styles: s, menus: m, addOns: a, serviceAreas: z, ...e }) => ({
      ...e,
      styleIds: s.map((x) => x.id),
      menuIds: m.map((x) => x.id),
      addOnIds: a.map((x) => x.id),
      areaIds: z.map((x) => x.id),
    })),
    styles,
    areas,
    menus: menus.map(({ items, ...m }) => ({
      ...m,
      items: items.slice(0, 6),
      itemCount: items.length,
    })),
    addOns,
    budgetRanges,
    settings: {
      minStandardGuests: pricing.minStandardGuests,
      maxStandardGuests: pricing.maxStandardGuests,
      pricesIncludeTax: pricing.pricesIncludeTax,
      taxRateBps: pricing.taxRateBps,
      depositBps: pricing.depositBps,
      defaultStartTime: availability.defaultStartTime,
      minLeadDays: availability.minLeadDays,
      maxAdvanceDays: availability.maxAdvanceDays,
    },
  };
}

/** Versión cacheada (60 s; etiquetas "catalog" y "configurator" para invalidar desde el admin). */
export const getConfiguratorCatalog = unstable_cache(loadConfiguratorCatalog, ["configurator-catalog-v1"], {
  revalidate: 60,
  tags: ["catalog", "configurator"],
});
