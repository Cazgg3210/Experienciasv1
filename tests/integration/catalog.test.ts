/**
 * Integración — Catálogo (experiencias, menús, add-ons, estilos, zonas, presupuestos).
 * Usa la base de pruebas (TEST_DATABASE_URL). Fixtures con valores únicos (uid); nunca trunca tablas.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import type { ExperienceFormValues, MenuFormValues } from "@/features/catalog/schemas";
import {
  addExperienceImage,
  createExperience,
  deleteExperience,
  removeExperienceImage,
  reorderExperienceImages,
  updateExperience,
} from "@/features/catalog/server/experience-service";
import {
  createMenu,
  createMenuItem,
  deleteMenu,
  deleteMenuItem,
  reorderMenuItems,
  updateMenu,
  updateMenuItem,
} from "@/features/catalog/server/menu-service";
import { createAddOn, deleteAddOn, updateAddOn } from "@/features/catalog/server/addon-service";
import { createStyle, deleteStyle, updateStyle } from "@/features/catalog/server/style-service";
import { createServiceArea, deleteServiceArea, updateServiceArea } from "@/features/catalog/server/area-service";
import { createBudgetRange, deleteBudgetRange } from "@/features/catalog/server/budget-service";
import { setCatalogActive } from "@/features/catalog/server/status-service";
import { isSlugTaken } from "@/features/catalog/server/catalog-common";
import { getExperienceEditorData, listExperiencesForAdmin } from "@/features/catalog/server/queries";
import { testOwner, testStaff, uid } from "./helpers";

/**
 * Ningún rol real tiene catalog:write sin pricing:write; para probar que el servidor exige
 * pricing:write simulamos un rol con todos los permisos de OWNER excepto precios.
 */
vi.mock("@/server/auth/permissions", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/auth/permissions")>();
  const can: typeof mod.can = (role, permission) =>
    (role as string) === "TEST_NO_PRICING"
      ? permission !== "pricing:write" && mod.can("OWNER", permission)
      : mod.can(role, permission);
  return { ...mod, can };
});

let owner: SessionUser;
let staff: SessionUser;
/** Puede editar el catálogo pero NO precios/costos. */
let editor: SessionUser;
const created = {
  experiences: [] as string[],
  menus: [] as string[],
  addOns: [] as string[],
  styles: [] as string[],
  areas: [] as string[],
  budgets: [] as string[],
  inventory: [] as string[],
  leads: [] as string[],
  media: [] as string[],
};

function menuInput(overrides: Partial<MenuFormValues> = {}): MenuFormValues {
  const s = uid("menu");
  return {
    name: `Menú ${s}`,
    slug: s,
    description: "",
    pricingType: "INCLUDED",
    priceCents: 0,
    costPerGuestCents: 190_00,
    tags: ["Clásico", "clasico", " favorito "],
    dietaryTags: ["VEGETARIAN"],
    active: true,
    sortOrder: 0,
    ...overrides,
  };
}

function experienceInput(overrides: Partial<ExperienceFormValues> = {}): ExperienceFormValues {
  const s = uid("exp");
  return {
    name: `Brunch ${s}`,
    slug: s,
    tagline: "Flores y mimosas",
    description: "Una mesa preciosa para celebrar con tus amigas en casa.",
    type: "BRUNCH",
    occasions: ["BIRTHDAY", "FRIENDS_BRUNCH"],
    durationMinutes: 180,
    active: true,
    featured: false,
    sortOrder: 0,
    baseGuests: 6,
    minGuests: 6,
    maxGuests: 12,
    basePriceCents: 11_600_00,
    extraGuestPriceCents: 1_200_00,
    extraGuestCostCents: 450_00,
    costComponents: [
      { category: "FLOWERS", description: "Flores de temporada", amountCents: 1_500_00, perGuest: false },
      { category: "STAFF", description: "Mesera", amountCents: 200_00, perGuest: true },
    ],
    includes: ["Montaje y desmontaje", "  Vajilla y cristalería  ", "montaje y desmontaje"],
    coverImageUrl: "/images/placeholders/brunch-table.svg",
    styleIds: [],
    serviceAreaIds: [],
    menuIds: [],
    addOnIds: [],
    inventoryReqs: [],
    faqs: [],
    ...overrides,
  };
}

async function fixtures() {
  const style = await createStyle(
    { name: "Jardín test", slug: uid("style"), description: "", palette: ["#A3B18A", "#fff"], imageUrl: "", active: true, sortOrder: 0 },
    owner,
  );
  created.styles.push(style.id);
  const area = await createServiceArea(
    {
      name: "Roma test",
      slug: uid("area"),
      description: "",
      postalCodes: ["06700", "06700", "06100"],
      logisticsFeeCents: 350_00,
      logisticsCostCents: 200_00,
      active: true,
      sortOrder: 0,
    },
    owner,
  );
  created.areas.push(area.id);
  const menu = await createMenu(menuInput(), owner);
  created.menus.push(menu.id);
  const addOn = await createAddOn(
    {
      name: "Karaoke test",
      slug: uid("addon"),
      description: "",
      category: "ENTERTAINMENT",
      pricingType: "FLAT",
      priceCents: 1_800_00,
      costCents: 400_00,
      costCategory: "VENDOR",
      maxQuantity: 1,
      leadTimeDays: 3,
      imageUrl: "",
      active: true,
      sortOrder: 0,
      inventoryReqs: [],
    },
    owner,
  );
  created.addOns.push(addOn.id);
  const item = await prisma.inventoryItem.create({
    data: { sku: uid("SKU-"), name: "Copa test", category: "GLASSWARE", totalQuantity: 24 },
  });
  created.inventory.push(item.id);
  return { style, area, menu, addOn, item };
}

beforeAll(async () => {
  owner = await testOwner();
  staff = await testStaff();
  editor = { ...owner, role: "TEST_NO_PRICING" as SessionUser["role"] };
});

afterAll(async () => {
  // Limpieza best-effort de lo que creamos (nunca truncamos tablas)
  await prisma.lead.deleteMany({ where: { id: { in: created.leads } } }).catch(() => undefined);
  await prisma.experience.deleteMany({ where: { id: { in: created.experiences } } }).catch(() => undefined);
  await prisma.menu.deleteMany({ where: { id: { in: created.menus } } }).catch(() => undefined);
  await prisma.addOn.deleteMany({ where: { id: { in: created.addOns } } }).catch(() => undefined);
  await prisma.style.deleteMany({ where: { id: { in: created.styles } } }).catch(() => undefined);
  await prisma.serviceArea.deleteMany({ where: { id: { in: created.areas } } }).catch(() => undefined);
  await prisma.budgetRange.deleteMany({ where: { id: { in: created.budgets } } }).catch(() => undefined);
  await prisma.inventoryItem.deleteMany({ where: { id: { in: created.inventory } } }).catch(() => undefined);
  await prisma.mediaAsset.deleteMany({ where: { id: { in: created.media } } }).catch(() => undefined);
});

describe("experiencias", () => {
  it("crea una experiencia con relaciones, costos, inventario y FAQs", async () => {
    const f = await fixtures();
    const input = experienceInput({
      styleIds: [f.style.id],
      serviceAreaIds: [f.area.id],
      menuIds: [f.menu.id],
      addOnIds: [f.addOn.id],
      inventoryReqs: [{ inventoryItemId: f.item.id, quantity: 1, perGuest: true }],
      faqs: [{ question: "¿Hay opción vegana?", answer: "Sí, avísanos con anticipación.", active: true }],
    });
    const res = await createExperience(input, owner);
    created.experiences.push(res.id);

    const exp = await prisma.experience.findUniqueOrThrow({
      where: { id: res.id },
      include: {
        styles: true,
        serviceAreas: true,
        menus: true,
        addOns: true,
        costComponents: { orderBy: { sortOrder: "asc" } },
        inventoryReqs: true,
        faqs: true,
      },
    });
    expect(exp.slug).toBe(input.slug);
    expect(exp.styles.map((s) => s.id)).toEqual([f.style.id]);
    expect(exp.serviceAreas.map((s) => s.id)).toEqual([f.area.id]);
    expect(exp.menus.map((s) => s.id)).toEqual([f.menu.id]);
    expect(exp.addOns.map((s) => s.id)).toEqual([f.addOn.id]);
    expect(exp.costComponents.map((c) => [c.category, c.amountCents, c.perGuest, c.sortOrder])).toEqual([
      ["FLOWERS", 1_500_00, false, 0],
      ["STAFF", 200_00, true, 1],
    ]);
    expect(exp.inventoryReqs).toHaveLength(1);
    expect(exp.faqs[0]).toMatchObject({ question: "¿Hay opción vegana?", category: "experiencia", active: true });
    // "Incluye" normalizado: sin espacios extra ni duplicados
    expect(exp.includes).toEqual(["Montaje y desmontaje", "Vajilla y cristalería"]);
    expect(exp.tagline).toBe("Flores y mimosas");

    const createdAudit = await prisma.auditLog.findFirst({ where: { action: "catalog.created", entityId: res.id } });
    expect(createdAudit).not.toBeNull();

    // La lista admin calcula el margen estimado con el menú incluido de referencia
    const list = await listExperiencesForAdmin();
    const row = list.find((r) => r.id === res.id);
    expect(row?.margin).not.toBeNull();
    const menuRow = await prisma.menu.findUniqueOrThrow({ where: { id: f.menu.id } });
    expect(row?.margin?.menuName).toBe(menuRow.name);

    // El editor devuelve los mismos valores que se guardaron
    const editor = await getExperienceEditorData(res.id);
    expect(editor?.values.menuIds).toEqual([f.menu.id]);
    expect(editor?.values.costComponents).toHaveLength(2);
  });

  it("un cambio de precio requiere pricing:write y queda auditado con antes/después", async () => {
    const input = experienceInput();
    const { id } = await createExperience(input, owner);
    created.experiences.push(id);

    // Cambio sin precio: no audita price_changed
    await updateExperience({ ...input, id, tagline: "Nuevo tagline" }, owner);
    expect(await prisma.auditLog.count({ where: { action: "catalog.price_changed", entityId: id } })).toBe(0);

    // Cambio de precio base + un costo
    const costComponents = [{ ...input.costComponents[0]!, amountCents: 1_700_00 }, input.costComponents[1]!];
    await updateExperience({ ...input, id, basePriceCents: 12_500_00, costComponents }, owner);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: "catalog.price_changed", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    expect(log.entityType).toBe("Experience");
    expect(log.actorId).toBe(owner.id);
    const before = log.before as Record<string, unknown>;
    const after = log.after as Record<string, unknown>;
    expect(before.basePriceCents).toBe(11_600_00);
    expect(after.basePriceCents).toBe(12_500_00);
    expect((before.costComponents as Array<{ amountCents: number }>)[0]!.amountCents).toBe(1_500_00);
    expect((after.costComponents as Array<{ amountCents: number }>)[0]!.amountCents).toBe(1_700_00);
    // Campos sin cambio no aparecen en el diff
    expect(after).not.toHaveProperty("extraGuestPriceCents");

    const updated = await prisma.experience.findUniqueOrThrow({ where: { id } });
    expect(updated.basePriceCents).toBe(12_500_00);
    expect(updated.tagline).toBe(input.tagline);
  });

  it("rechaza a quien no tiene permisos de catálogo", async () => {
    await expect(createExperience(experienceInput(), staff)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("un slug repetido devuelve un ConflictError amable (crear y editar)", async () => {
    const a = experienceInput();
    const { id } = await createExperience(a, owner);
    created.experiences.push(id);
    expect(await isSlugTaken("experience", a.slug)).toBe(true);
    expect(await isSlugTaken("experience", a.slug, id)).toBe(false);

    const dup = createExperience(experienceInput({ slug: a.slug }), owner);
    await expect(dup).rejects.toBeInstanceOf(ConflictError);
    await expect(createExperience(experienceInput({ slug: a.slug }), owner)).rejects.toThrow(/ya está en uso/);

    const b = experienceInput();
    const second = await createExperience(b, owner);
    created.experiences.push(second.id);
    await expect(updateExperience({ ...b, id: second.id, slug: a.slug }, owner)).rejects.toMatchObject({
      code: "CONFLICT",
      fieldErrors: { slug: [expect.stringContaining(a.slug)] },
    });
  });

  it("sincroniza FAQs: edita, agrega y elimina", async () => {
    const input = experienceInput({
      faqs: [
        { question: "¿Cuánto dura?", answer: "Tres horas.", active: true },
        { question: "¿Llevan mesa?", answer: "Sí, montamos todo.", active: true },
      ],
    });
    const { id } = await createExperience(input, owner);
    created.experiences.push(id);
    const faqs = await prisma.faq.findMany({ where: { experienceId: id }, orderBy: { sortOrder: "asc" } });
    await updateExperience(
      {
        ...input,
        id,
        faqs: [
          { id: faqs[1]!.id, question: "¿Llevan mesa y sillas?", answer: "Sí, montamos todo.", active: false },
          { question: "¿Hay estacionamiento?", answer: "Lo coordinamos contigo.", active: true },
        ],
      },
      owner,
    );
    const after = await prisma.faq.findMany({ where: { experienceId: id }, orderBy: { sortOrder: "asc" } });
    expect(after.map((f) => f.question)).toEqual(["¿Llevan mesa y sillas?", "¿Hay estacionamiento?"]);
    expect(after[0]!.id).toBe(faqs[1]!.id);
    expect(after[0]!.active).toBe(false);

    // Un id de FAQ ajeno se rechaza
    await expect(
      updateExperience({ ...input, id, faqs: [{ id: "faq-ajena", question: "¿x?", answer: "y y y", active: true }] }, owner),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("gestiona la galería: agregar, reordenar y quitar imágenes", async () => {
    const { id } = await createExperience(experienceInput(), owner);
    created.experiences.push(id);
    const mk = () =>
      prisma.mediaAsset.create({
        data: {
          driver: "EXTERNAL",
          url: `/images/placeholders/gallery-0${Math.ceil(Math.random() * 8)}.svg`,
          mimeType: "image/svg+xml",
          purpose: "EXPERIENCE",
          visibility: "PUBLIC",
        },
      });
    const [m1, m2] = await Promise.all([mk(), mk()]);
    created.media.push(m1.id, m2.id);
    const i1 = await addExperienceImage({ experienceId: id, mediaAssetId: m1.id }, owner);
    const i2 = await addExperienceImage({ experienceId: id, mediaAssetId: m2.id }, owner);
    // Idempotente
    expect((await addExperienceImage({ experienceId: id, mediaAssetId: m1.id }, owner)).id).toBe(i1.id);

    await reorderExperienceImages({ experienceId: id, orderedIds: [i2.id, i1.id] }, owner);
    const ordered = await prisma.experienceImage.findMany({ where: { experienceId: id }, orderBy: { sortOrder: "asc" } });
    expect(ordered.map((i) => i.id)).toEqual([i2.id, i1.id]);
    await expect(reorderExperienceImages({ experienceId: id, orderedIds: [i1.id] }, owner)).rejects.toBeInstanceOf(ValidationError);

    await removeExperienceImage({ experienceId: id, imageId: i2.id }, owner);
    expect(await prisma.experienceImage.count({ where: { experienceId: id } })).toBe(1);
    // El asset huérfano de experiencia se elimina
    expect(await prisma.mediaAsset.findUnique({ where: { id: m2.id } })).toBeNull();

    // Un asset privado o de otro propósito no se acepta
    const priv = await prisma.mediaAsset.create({
      data: { driver: "EXTERNAL", url: "/x.png", mimeType: "image/png", purpose: "RECEIPT", visibility: "PRIVATE" },
    });
    created.media.push(priv.id);
    await expect(addExperienceImage({ experienceId: id, mediaAssetId: priv.id }, owner)).rejects.toBeInstanceOf(ValidationError);
  });

  it("borra una experiencia sin historial y desactiva una con leads", async () => {
    const free = await createExperience(experienceInput(), owner);
    const res = await deleteExperience(free.id, owner);
    expect(res.outcome).toBe("deleted");
    expect(await prisma.experience.findUnique({ where: { id: free.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "catalog.deleted", entityId: free.id } })).toBe(1);

    const used = await createExperience(experienceInput({ featured: true }), owner);
    created.experiences.push(used.id);
    const lead = await prisma.lead.create({ data: { code: uid("L-"), name: "Lead test", experienceId: used.id } });
    created.leads.push(lead.id);
    const res2 = await deleteExperience(used.id, owner);
    expect(res2.outcome).toBe("deactivated");
    expect(res2.message).toMatch(/1 lead/);
    const after = await prisma.experience.findUniqueOrThrow({ where: { id: used.id } });
    expect(after.active).toBe(false);
    expect(after.featured).toBe(false);
  });
});

describe("menús", () => {
  it("normaliza: menú incluido sin precio y tags sin duplicados", async () => {
    const m = await createMenu(menuInput({ priceCents: 999_00 }), owner);
    created.menus.push(m.id);
    const row = await prisma.menu.findUniqueOrThrow({ where: { id: m.id } });
    expect(row.priceCents).toBe(0);
    expect(row.tags).toEqual(["clásico", "favorito"]);
  });

  it("audita cambios de precio del menú", async () => {
    const input = menuInput({ pricingType: "PER_GUEST", priceCents: 250_00, costPerGuestCents: 200_00 });
    const m = await createMenu(input, owner);
    created.menus.push(m.id);
    await updateMenu({ ...input, id: m.id, priceCents: 300_00 }, owner);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "catalog.price_changed", entityId: m.id } });
    expect(log.entityType).toBe("Menu");
    expect(log.before).toMatchObject({ priceCents: 250_00 });
    expect(log.after).toMatchObject({ priceCents: 300_00 });
  });

  it("al eliminar un menú referenciado lo desactiva en lugar de borrarlo", async () => {
    const menu = await createMenu(menuInput(), owner);
    created.menus.push(menu.id);
    const exp = await createExperience(experienceInput({ menuIds: [menu.id] }), owner);
    created.experiences.push(exp.id);

    const res = await deleteMenu(menu.id, owner);
    expect(res.outcome).toBe("deactivated");
    expect(res.message).toContain("1 experiencia");
    const row = await prisma.menu.findUnique({ where: { id: menu.id } });
    expect(row).not.toBeNull();
    expect(row!.active).toBe(false);
    // La experiencia conserva su menú
    expect(await prisma.experience.count({ where: { id: exp.id, menus: { some: { id: menu.id } } } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "catalog.deactivated", entityId: menu.id } })).toBe(1);

    // Un menú sin referencias sí se elimina
    const lonely = await createMenu(menuInput(), owner);
    expect((await deleteMenu(lonely.id, owner)).outcome).toBe("deleted");
    expect(await prisma.menu.findUnique({ where: { id: lonely.id } })).toBeNull();
  });

  it("CRUD de platillos con reordenamiento", async () => {
    const menu = await createMenu(menuInput(), owner);
    created.menus.push(menu.id);
    const a = await createMenuItem(
      { menuId: menu.id, name: "Chilaquiles verdes", description: "", course: "MAIN", dietaryTags: [] },
      owner,
    );
    const b = await createMenuItem(
      { menuId: menu.id, name: "Café de olla", description: "Con canela", course: "DRINK", dietaryTags: ["VEGAN", "VEGAN"] },
      owner,
    );
    const c = await createMenuItem({ menuId: menu.id, name: "Pan dulce", description: "", course: "STARTER", dietaryTags: [] }, owner);
    let items = await prisma.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.id)).toEqual([a.id, b.id, c.id]);
    expect(items[1]!.dietaryTags).toEqual(["VEGAN"]);
    expect(items[1]!.description).toBe("Con canela");

    await updateMenuItem({ id: a.id, name: "Chilaquiles rojos", description: "  ", course: "MAIN", dietaryTags: ["VEGETARIAN"] }, owner);
    const updated = await prisma.menuItem.findUniqueOrThrow({ where: { id: a.id } });
    expect(updated.name).toBe("Chilaquiles rojos");
    expect(updated.description).toBeNull();

    await reorderMenuItems({ menuId: menu.id, orderedIds: [b.id, c.id, a.id] }, owner);
    items = await prisma.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.id)).toEqual([b.id, c.id, a.id]);
    await expect(reorderMenuItems({ menuId: menu.id, orderedIds: [b.id, a.id] }, owner)).rejects.toBeInstanceOf(ValidationError);

    expect((await deleteMenuItem(c.id, owner)).menuId).toBe(menu.id);
    expect(await prisma.menuItem.count({ where: { menuId: menu.id } })).toBe(2);
  });
});

describe("add-ons, estilos, zonas y presupuestos", () => {
  it("add-on: inventario relacionado, auditoría de precio y desactivación si está ligado", async () => {
    const f = await fixtures();
    const input = {
      name: "Globos test",
      slug: uid("addon"),
      description: "",
      category: "DECOR" as const,
      pricingType: "FLAT" as const,
      priceCents: 950_00,
      costCents: 300_00,
      costCategory: "VENDOR" as const,
      maxQuantity: 2,
      leadTimeDays: 2,
      imageUrl: "/images/placeholders/hero.svg",
      active: true,
      sortOrder: 0,
      inventoryReqs: [{ inventoryItemId: f.item.id, quantity: 2, perGuest: false }],
    };
    const a = await createAddOn(input, owner);
    created.addOns.push(a.id);
    expect(await prisma.addOnInventoryRequirement.count({ where: { addOnId: a.id } })).toBe(1);

    await updateAddOn({ ...input, id: a.id, costCents: 350_00, inventoryReqs: [] }, owner);
    expect(await prisma.addOnInventoryRequirement.count({ where: { addOnId: a.id } })).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "catalog.price_changed", entityId: a.id } });
    expect(log.before).toMatchObject({ costCents: 300_00 });
    expect(log.after).toMatchObject({ costCents: 350_00 });

    const exp = await createExperience(experienceInput({ addOnIds: [a.id] }), owner);
    created.experiences.push(exp.id);
    expect((await deleteAddOn(a.id, owner)).outcome).toBe("deactivated");
    expect((await prisma.addOn.findUniqueOrThrow({ where: { id: a.id } })).active).toBe(false);
  });

  it("estilo: normaliza la paleta, valida slug y se borra si no tiene uso", async () => {
    const slug = uid("style");
    const s = await createStyle(
      { name: "Boho test", slug, description: "", palette: ["#ABC", "#aabbcc", "#5C6B4E"], imageUrl: "", active: true, sortOrder: 1 },
      owner,
    );
    created.styles.push(s.id);
    expect((await prisma.style.findUniqueOrThrow({ where: { id: s.id } })).palette).toEqual(["#aabbcc", "#5c6b4e"]);
    await expect(
      createStyle({ name: "Otro", slug, description: "", palette: [], imageUrl: "", active: true, sortOrder: 0 }, owner),
    ).rejects.toBeInstanceOf(ConflictError);
    await updateStyle({ id: s.id, name: "Boho terracota", slug, description: "Cálido", palette: [], imageUrl: "", active: false, sortOrder: 1 }, owner);
    expect(await prisma.auditLog.count({ where: { action: "catalog.status_changed", entityId: s.id } })).toBe(1);
    expect((await deleteStyle(s.id, owner)).outcome).toBe("deleted");
  });

  it("zona: códigos postales normalizados y auditoría de la tarifa de logística", async () => {
    const input = {
      name: "Coyoacán test",
      slug: uid("area"),
      description: "",
      postalCodes: ["04100", "04000", "04100"],
      logisticsFeeCents: 450_00,
      logisticsCostCents: 250_00,
      active: true,
      sortOrder: 0,
    };
    const a = await createServiceArea(input, owner);
    created.areas.push(a.id);
    expect((await prisma.serviceArea.findUniqueOrThrow({ where: { id: a.id } })).postalCodes).toEqual(["04000", "04100"]);
    await updateServiceArea({ ...input, id: a.id, logisticsFeeCents: 500_00 }, owner);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "catalog.price_changed", entityId: a.id } });
    expect(log.entityType).toBe("ServiceArea");
    expect(log.before).toMatchObject({ logisticsFeeCents: 450_00 });
    expect(log.after).toMatchObject({ logisticsFeeCents: 500_00 });
    expect((await deleteServiceArea(a.id, owner)).outcome).toBe("deleted");
  });

  it("presupuesto: se desactiva si hay leads que lo usan", async () => {
    const b = await createBudgetRange({ label: "Test $1 – $2", minCents: 100, maxCents: 200, sortOrder: 99, active: true }, owner);
    created.budgets.push(b.id);
    const lead = await prisma.lead.create({ data: { code: uid("L-"), name: "Lead budget", budgetRangeId: b.id } });
    created.leads.push(lead.id);
    const res = await deleteBudgetRange(b.id, owner);
    expect(res.outcome).toBe("deactivated");
    expect((await prisma.budgetRange.findUniqueOrThrow({ where: { id: b.id } })).active).toBe(false);

    const free = await createBudgetRange({ label: "Libre", minCents: 0, maxCents: null, sortOrder: 99, active: true }, owner);
    expect((await deleteBudgetRange(free.id, owner)).outcome).toBe("deleted");
  });

  it("activar/desactivar rápido queda auditado", async () => {
    const m = await createMenu(menuInput(), owner);
    created.menus.push(m.id);
    await setCatalogActive({ entity: "menu", id: m.id, active: false }, owner);
    expect((await prisma.menu.findUniqueOrThrow({ where: { id: m.id } })).active).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "catalog.status_changed", entityId: m.id } })).toBe(1);
    await expect(setCatalogActive({ entity: "menu", id: m.id, active: true }, staff)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("permiso de precios (pricing:write)", () => {
  it("sin pricing:write se edita el catálogo pero no precios ni costos", async () => {
    // Crear con precios distintos de cero requiere pricing:write
    await expect(createExperience(experienceInput(), editor)).rejects.toBeInstanceOf(ForbiddenError);
    // Sin precios (todo en cero) sí puede crear
    const zero = experienceInput({
      active: false,
      basePriceCents: 0,
      extraGuestPriceCents: 0,
      extraGuestCostCents: 0,
      costComponents: [],
    });
    const draft = await createExperience(zero, editor);
    created.experiences.push(draft.id);
    // Sin precio base no se puede publicar (activar rápido desde la lista)
    await expect(setCatalogActive({ entity: "experience", id: draft.id, active: true }, owner)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await prisma.experience.findUniqueOrThrow({ where: { id: draft.id } })).active).toBe(false);

    // Experiencia existente creada por la dueña
    const input = experienceInput();
    const { id } = await createExperience(input, owner);
    created.experiences.push(id);
    // Cambios que no tocan precio: permitidos
    await updateExperience({ ...input, id, tagline: "Sólo texto", includes: ["Mesa montada"] }, editor);
    expect((await prisma.experience.findUniqueOrThrow({ where: { id } })).tagline).toBe("Sólo texto");
    // Precio base, costo por invitada o componentes de costo: prohibidos y sin efecto
    await expect(updateExperience({ ...input, id, basePriceCents: 1 }, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateExperience({ ...input, id, extraGuestCostCents: 1 }, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateExperience({ ...input, id, costComponents: [{ ...input.costComponents[0]!, perGuest: true }] }, editor),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const row = await prisma.experience.findUniqueOrThrow({ where: { id }, include: { costComponents: true } });
    expect(row.basePriceCents).toBe(input.basePriceCents);
    expect(row.costComponents).toHaveLength(2);
    expect(await prisma.auditLog.count({ where: { action: "catalog.price_changed", entityId: id } })).toBe(0);

    // Menú, add-on y zona: mismo criterio
    const menuIn = menuInput({ pricingType: "PER_GUEST", priceCents: 250_00, costPerGuestCents: 100_00 });
    const menu = await createMenu(menuIn, owner);
    created.menus.push(menu.id);
    await expect(updateMenu({ ...menuIn, id: menu.id, costPerGuestCents: 120_00 }, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateMenu({ ...menuIn, id: menu.id, pricingType: "FLAT" }, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await updateMenu({ ...menuIn, id: menu.id, description: "Nuevo texto" }, editor);

    const addOnIn = {
      name: "Add-on permisos",
      slug: uid("addon"),
      description: "",
      category: "DECOR" as const,
      pricingType: "FLAT" as const,
      priceCents: 500_00,
      costCents: 200_00,
      costCategory: "VENDOR" as const,
      maxQuantity: 1,
      leadTimeDays: 0,
      imageUrl: "",
      active: true,
      sortOrder: 0,
      inventoryReqs: [],
    };
    const addOn = await createAddOn(addOnIn, owner);
    created.addOns.push(addOn.id);
    await expect(updateAddOn({ ...addOnIn, id: addOn.id, priceCents: 450_00 }, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await updateAddOn({ ...addOnIn, id: addOn.id, leadTimeDays: 5 }, editor);

    const areaIn = {
      name: "Zona permisos",
      slug: uid("area"),
      description: "",
      postalCodes: ["03100"],
      logisticsFeeCents: 300_00,
      logisticsCostCents: 100_00,
      active: true,
      sortOrder: 0,
    };
    const area = await createServiceArea(areaIn, owner);
    created.areas.push(area.id);
    await expect(updateServiceArea({ ...areaIn, id: area.id, logisticsFeeCents: 0 }, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await updateServiceArea({ ...areaIn, id: area.id, postalCodes: ["03100", "03200"] }, editor);
    await expect(createServiceArea({ ...areaIn, slug: uid("area") }, editor)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("integridad de imágenes y borrados", () => {
  it("al quitar la imagen que es portada, la portada se limpia (sin enlaces rotos)", async () => {
    const mk = (n: number) =>
      prisma.mediaAsset.create({
        data: {
          driver: "EXTERNAL",
          url: `/images/placeholders/gallery-0${n}.svg`,
          mimeType: "image/svg+xml",
          purpose: "EXPERIENCE",
          visibility: "PUBLIC",
        },
      });
    const asset = await mk(1);
    created.media.push(asset.id);
    const input = experienceInput({ coverImageUrl: `/api/media/${asset.id}` });
    const { id } = await createExperience(input, owner);
    created.experiences.push(id);
    const img = await addExperienceImage({ experienceId: id, mediaAssetId: asset.id }, owner);

    const res = await removeExperienceImage({ experienceId: id, imageId: img.id }, owner);
    expect(res.coverCleared).toBe(true);
    expect((await prisma.experience.findUniqueOrThrow({ where: { id } })).coverImageUrl).toBeNull();

    // Si la portada es otra (placeholder), no se toca
    await updateExperience({ ...input, id, coverImageUrl: "/images/placeholders/brunch-table.svg" }, owner);
    const other = await mk(2);
    created.media.push(other.id);
    const img2 = await addExperienceImage({ experienceId: id, mediaAssetId: other.id }, owner);
    expect((await removeExperienceImage({ experienceId: id, imageId: img2.id }, owner)).coverCleared).toBe(false);
    expect((await prisma.experience.findUniqueOrThrow({ where: { id } })).coverImageUrl).toBe("/images/placeholders/brunch-table.svg");
  });

  it("estilos y zonas ligados a experiencias o leads se desactivan en vez de borrarse", async () => {
    const f = await fixtures();
    const exp = await createExperience(experienceInput({ serviceAreaIds: [f.area.id] }), owner);
    created.experiences.push(exp.id);
    const areaRes = await deleteServiceArea(f.area.id, owner);
    expect(areaRes.outcome).toBe("deactivated");
    expect(areaRes.message).toContain("1 experiencia");
    expect((await prisma.serviceArea.findUniqueOrThrow({ where: { id: f.area.id } })).active).toBe(false);

    const lead = await prisma.lead.create({ data: { code: uid("L-"), name: "Lead estilo", styleId: f.style.id } });
    created.leads.push(lead.id);
    const styleRes = await deleteStyle(f.style.id, owner);
    expect(styleRes.outcome).toBe("deactivated");
    // El lead conserva su estilo (no se pierde el historial)
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).styleId).toBe(f.style.id);
  });

  it("crear estilos y rangos de presupuesto queda auditado", async () => {
    const s = await createStyle(
      { name: "Audit test", slug: uid("style"), description: "", palette: [], imageUrl: "", active: true, sortOrder: 0 },
      owner,
    );
    created.styles.push(s.id);
    const b = await createBudgetRange({ label: "Audit $1", minCents: 0, maxCents: 100_00, sortOrder: 99, active: false }, owner);
    created.budgets.push(b.id);
    expect(await prisma.auditLog.count({ where: { action: "catalog.created", entityId: { in: [s.id, b.id] } } })).toBe(2);
  });
});
