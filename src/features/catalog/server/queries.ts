import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/db";
import { getSettings } from "@/features/settings/server/settings-service";
import { toEngineSettings } from "@/features/quotes/server/pricing";
import type { EngineSettings } from "@/features/quotes/domain/quote-engine";
import { publicMediaPath } from "../domain/catalog-rules";
import { addOnUnitMarginBps, pickReferenceMenu, previewExperienceMargin, type MarginPreview } from "../domain/margin-preview";
import type {
  AddOnFormValues,
  AreaFormValues,
  BudgetFormValues,
  ExperienceFormValues,
  MenuFormValues,
  StyleFormValues,
} from "../schemas";

export async function getEngineSettings(): Promise<EngineSettings> {
  return toEngineSettings(await getSettings("pricing"));
}

// -----------------------------------------------------------------------------
// Experiencias
// -----------------------------------------------------------------------------

export type ExperienceListItem = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  type: ExperienceFormValues["type"];
  active: boolean;
  featured: boolean;
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  coverUrl: string | null;
  margin: MarginPreview | null;
  counts: { events: number; quotes: number; images: number };
};

export async function listExperiencesForAdmin(): Promise<ExperienceListItem[]> {
  const [rows, settings] = await Promise.all([
    prisma.experience.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        costComponents: { orderBy: { sortOrder: "asc" } },
        menus: {
          select: { id: true, name: true, pricingType: true, priceCents: true, costPerGuestCents: true, active: true },
          orderBy: { sortOrder: "asc" },
        },
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { mediaAssetId: true } },
        _count: { select: { events: true, quotes: true, images: true } },
      },
    }),
    getEngineSettings(),
  ]);
  return rows.map((e) => {
    const menu = pickReferenceMenu(e.menus);
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      tagline: e.tagline,
      type: e.type,
      active: e.active,
      featured: e.featured,
      basePriceCents: e.basePriceCents,
      baseGuests: e.baseGuests,
      minGuests: e.minGuests,
      maxGuests: e.maxGuests,
      coverUrl: e.coverImageUrl ?? (e.images[0] ? publicMediaPath(e.images[0].mediaAssetId) : null),
      margin: previewExperienceMargin(e, settings, menu),
      counts: { events: e._count.events, quotes: e._count.quotes, images: e._count.images },
    };
  });
}

export type ExperienceImageItem = { id: string; mediaAssetId: string; url: string; alt: string | null };

export async function getExperienceEditorData(id: string) {
  const e = await prisma.experience.findUnique({
    where: { id },
    include: {
      costComponents: { orderBy: { sortOrder: "asc" } },
      images: {
        orderBy: { sortOrder: "asc" },
        include: { mediaAsset: { select: { id: true, alt: true } } },
      },
      styles: { select: { id: true } },
      serviceAreas: { select: { id: true } },
      menus: { select: { id: true } },
      addOns: { select: { id: true } },
      inventoryReqs: { include: { inventoryItem: { select: { name: true } } } },
      faqs: { orderBy: { sortOrder: "asc" } },
      _count: { select: { events: true, quotes: true, leads: true } },
    },
  });
  if (!e) return null;
  const values: ExperienceFormValues = {
    name: e.name,
    slug: e.slug,
    tagline: e.tagline ?? "",
    description: e.description,
    type: e.type,
    occasions: e.occasions,
    durationMinutes: e.durationMinutes,
    active: e.active,
    featured: e.featured,
    sortOrder: e.sortOrder,
    baseGuests: e.baseGuests,
    minGuests: e.minGuests,
    maxGuests: e.maxGuests,
    basePriceCents: e.basePriceCents,
    extraGuestPriceCents: e.extraGuestPriceCents,
    extraGuestCostCents: e.extraGuestCostCents,
    costComponents: e.costComponents.map((c) => ({
      category: c.category,
      description: c.description,
      amountCents: c.amountCents,
      perGuest: c.perGuest,
    })),
    includes: e.includes,
    coverImageUrl: e.coverImageUrl ?? "",
    styleIds: e.styles.map((s) => s.id),
    serviceAreaIds: e.serviceAreas.map((s) => s.id),
    menuIds: e.menus.map((m) => m.id),
    addOnIds: e.addOns.map((a) => a.id),
    inventoryReqs: [...e.inventoryReqs]
      .sort((a, b) => a.inventoryItem.name.localeCompare(b.inventoryItem.name, "es"))
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity, perGuest: r.perGuest })),
    faqs: e.faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, active: f.active })),
  };
  const images: ExperienceImageItem[] = e.images.map((img) => ({
    id: img.id,
    mediaAssetId: img.mediaAssetId,
    url: publicMediaPath(img.mediaAssetId),
    alt: img.mediaAsset.alt,
  }));
  return {
    id: e.id,
    name: e.name,
    values,
    images,
    counts: e._count,
    updatedAt: e.updatedAt,
  };
}

export const EMPTY_EXPERIENCE: ExperienceFormValues = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  type: "BRUNCH",
  occasions: [],
  durationMinutes: 180,
  active: false,
  featured: false,
  sortOrder: 0,
  baseGuests: 6,
  minGuests: 6,
  maxGuests: 12,
  basePriceCents: 0,
  extraGuestPriceCents: 0,
  extraGuestCostCents: 0,
  costComponents: [],
  includes: [],
  coverImageUrl: "",
  styleIds: [],
  serviceAreaIds: [],
  menuIds: [],
  addOnIds: [],
  inventoryReqs: [],
  faqs: [],
};

export type CatalogOption = { id: string; name: string; active: boolean; hint?: string };
export type MenuOption = CatalogOption & {
  pricingType: "INCLUDED" | "PER_GUEST" | "FLAT";
  priceCents: number;
  costPerGuestCents: number;
};
export type InventoryOption = { id: string; name: string; sku: string; unit: string; category: string; active: boolean };

/** Opciones para los selectores del editor: activos + los ya ligados (aunque estén inactivos). */
export async function getExperienceOptions(selected?: Pick<
  ExperienceFormValues,
  "styleIds" | "serviceAreaIds" | "menuIds" | "addOnIds" | "inventoryReqs"
>) {
  const orActive = (ids: string[] | undefined) => ({ OR: [{ active: true }, { id: { in: ids ?? [] } }] });
  const [styles, areas, menus, addOns, inventory] = await Promise.all([
    prisma.style.findMany({
      where: orActive(selected?.styleIds),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.serviceArea.findMany({
      where: orActive(selected?.serviceAreaIds),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.menu.findMany({
      where: orActive(selected?.menuIds),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true, pricingType: true, priceCents: true, costPerGuestCents: true },
    }),
    prisma.addOn.findMany({
      where: orActive(selected?.addOnIds),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    getInventoryOptions(selected?.inventoryReqs.map((r) => r.inventoryItemId)),
  ]);
  return {
    styles: styles as CatalogOption[],
    areas: areas as CatalogOption[],
    menus: menus as MenuOption[],
    addOns: addOns as CatalogOption[],
    inventory,
  };
}
export type ExperienceOptions = Awaited<ReturnType<typeof getExperienceOptions>>;

export async function getInventoryOptions(selectedIds?: string[]): Promise<InventoryOption[]> {
  return prisma.inventoryItem.findMany({
    where: { OR: [{ active: true }, { id: { in: selectedIds ?? [] } }] },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sku: true, unit: true, category: true, active: true },
  });
}

// -----------------------------------------------------------------------------
// Menús
// -----------------------------------------------------------------------------

export async function listMenusForAdmin() {
  return prisma.menu.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true, experiences: true, events: true } } },
  });
}
export type MenuListItem = Awaited<ReturnType<typeof listMenusForAdmin>>[number];

export async function getMenuEditorData(id: string) {
  const m = await prisma.menu.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      experiences: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      _count: { select: { events: true, quotes: true, leads: true } },
    },
  });
  if (!m) return null;
  const values: MenuFormValues = {
    name: m.name,
    slug: m.slug,
    description: m.description ?? "",
    pricingType: m.pricingType,
    priceCents: m.priceCents,
    costPerGuestCents: m.costPerGuestCents,
    tags: m.tags,
    dietaryTags: m.dietaryTags,
    active: m.active,
    sortOrder: m.sortOrder,
  };
  return {
    id: m.id,
    name: m.name,
    values,
    items: m.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description ?? "",
      course: i.course,
      dietaryTags: i.dietaryTags,
      sortOrder: i.sortOrder,
    })),
    experiences: m.experiences,
    counts: m._count,
  };
}
export type MenuItemRow = NonNullable<Awaited<ReturnType<typeof getMenuEditorData>>>["items"][number];

export const EMPTY_MENU: MenuFormValues = {
  name: "",
  slug: "",
  description: "",
  pricingType: "INCLUDED",
  priceCents: 0,
  costPerGuestCents: 0,
  tags: [],
  dietaryTags: [],
  active: true,
  sortOrder: 0,
};

// -----------------------------------------------------------------------------
// Add-ons
// -----------------------------------------------------------------------------

export async function listAddOnsForAdmin() {
  const [rows, settings] = await Promise.all([
    prisma.addOn.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { experiences: true, eventAddOns: true, inventoryReqs: true } } },
    }),
    getEngineSettings(),
  ]);
  return rows.map((a) => ({ ...a, unitMarginBps: addOnUnitMarginBps(a.priceCents, a.costCents, settings) }));
}
export type AddOnListItem = Awaited<ReturnType<typeof listAddOnsForAdmin>>[number];

export async function getAddOnEditorData(id: string) {
  const a = await prisma.addOn.findUnique({
    where: { id },
    include: {
      inventoryReqs: { include: { inventoryItem: { select: { name: true } } } },
      experiences: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      _count: { select: { eventAddOns: true } },
    },
  });
  if (!a) return null;
  const values: AddOnFormValues = {
    name: a.name,
    slug: a.slug,
    description: a.description ?? "",
    category: a.category,
    pricingType: a.pricingType,
    priceCents: a.priceCents,
    costCents: a.costCents,
    costCategory: a.costCategory,
    maxQuantity: a.maxQuantity,
    leadTimeDays: a.leadTimeDays,
    imageUrl: a.imageUrl ?? "",
    active: a.active,
    sortOrder: a.sortOrder,
    inventoryReqs: [...a.inventoryReqs]
      .sort((x, y) => x.inventoryItem.name.localeCompare(y.inventoryItem.name, "es"))
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity, perGuest: r.perGuest })),
  };
  return { id: a.id, name: a.name, values, experiences: a.experiences, counts: a._count };
}

export const EMPTY_ADDON: AddOnFormValues = {
  name: "",
  slug: "",
  description: "",
  category: "DECOR",
  pricingType: "FLAT",
  priceCents: 0,
  costCents: 0,
  costCategory: "VENDOR",
  maxQuantity: 1,
  leadTimeDays: 0,
  imageUrl: "",
  active: true,
  sortOrder: 0,
  inventoryReqs: [],
};

// -----------------------------------------------------------------------------
// Estilos, zonas, presupuestos
// -----------------------------------------------------------------------------

export async function listStylesForAdmin() {
  const rows = await prisma.style.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { experiences: true, events: true, leads: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    palette: s.palette,
    imageUrl: s.imageUrl,
    active: s.active,
    sortOrder: s.sortOrder,
    counts: s._count,
    values: {
      name: s.name,
      slug: s.slug,
      description: s.description ?? "",
      palette: s.palette,
      imageUrl: s.imageUrl ?? "",
      active: s.active,
      sortOrder: s.sortOrder,
    } satisfies StyleFormValues,
  }));
}
export type StyleListItem = Awaited<ReturnType<typeof listStylesForAdmin>>[number];

export async function listAreasForAdmin() {
  const rows = await prisma.serviceArea.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { experiences: true, events: true, leads: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.description,
    postalCodes: a.postalCodes,
    logisticsFeeCents: a.logisticsFeeCents,
    logisticsCostCents: a.logisticsCostCents,
    active: a.active,
    sortOrder: a.sortOrder,
    counts: a._count,
    values: {
      name: a.name,
      slug: a.slug,
      description: a.description ?? "",
      postalCodes: a.postalCodes,
      logisticsFeeCents: a.logisticsFeeCents,
      logisticsCostCents: a.logisticsCostCents,
      active: a.active,
      sortOrder: a.sortOrder,
    } satisfies AreaFormValues,
  }));
}
export type AreaListItem = Awaited<ReturnType<typeof listAreasForAdmin>>[number];

export async function listBudgetRangesForAdmin() {
  const rows = await prisma.budgetRange.findMany({
    orderBy: [{ sortOrder: "asc" }, { minCents: "asc" }],
    include: { _count: { select: { leads: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    label: b.label,
    minCents: b.minCents,
    maxCents: b.maxCents,
    sortOrder: b.sortOrder,
    active: b.active,
    leads: b._count.leads,
    values: {
      label: b.label,
      minCents: b.minCents,
      maxCents: b.maxCents,
      sortOrder: b.sortOrder,
      active: b.active,
    } satisfies BudgetFormValues,
  }));
}
export type BudgetListItem = Awaited<ReturnType<typeof listBudgetRangesForAdmin>>[number];

export const EMPTY_STYLE: StyleFormValues = {
  name: "",
  slug: "",
  description: "",
  palette: [],
  imageUrl: "",
  active: true,
  sortOrder: 0,
};

export const EMPTY_AREA: AreaFormValues = {
  name: "",
  slug: "",
  description: "",
  postalCodes: [],
  logisticsFeeCents: 0,
  logisticsCostCents: 0,
  active: true,
  sortOrder: 0,
};

export const EMPTY_BUDGET: BudgetFormValues = {
  label: "",
  minCents: 0,
  maxCents: null,
  sortOrder: 0,
  active: true,
};

/** Siguiente orden sugerido para un elemento nuevo (al final de la lista). */
export async function nextSortOrder(entity: "experience" | "menu" | "addOn" | "style" | "serviceArea" | "budgetRange") {
  const args = { _max: { sortOrder: true } } as const;
  let max: number | null = null;
  switch (entity) {
    case "experience":
      max = (await prisma.experience.aggregate(args))._max.sortOrder;
      break;
    case "menu":
      max = (await prisma.menu.aggregate(args))._max.sortOrder;
      break;
    case "addOn":
      max = (await prisma.addOn.aggregate(args))._max.sortOrder;
      break;
    case "style":
      max = (await prisma.style.aggregate(args))._max.sortOrder;
      break;
    case "serviceArea":
      max = (await prisma.serviceArea.aggregate(args))._max.sortOrder;
      break;
    case "budgetRange":
      max = (await prisma.budgetRange.aggregate(args))._max.sortOrder;
      break;
  }
  return max == null ? 0 : Math.min(max + 1, 9999);
}

/** Ilustraciones de muestra disponibles en /public/images/placeholders (para portadas de demo). */
export async function listPlaceholderImages(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), "public", "images", "placeholders");
    const files = await readdir(dir);
    return files
      .filter((f) => /\.(svg|png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((f) => `/images/placeholders/${f}`);
  } catch {
    return [];
  }
}

/** IDs de catálogo: cuid o ids legibles del seed. */
export function isPlausibleId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}
