/**
 * Seed DEMO — fase 1: usuarios, staff, catálogo (inventario, menús, add-ons, experiencias),
 * proveedores, contenido público, excepciones de disponibilidad y clientas.
 */
import type { LeadSource, MediaPurpose, Prisma, PrismaClient, StaffFunction, StaffRateType } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { generateReferralCode } from "../../src/lib/codes";
import { dateOnly } from "../../src/lib/dates";
import { BCRYPT_COST } from "./base";
import { PLACEHOLDER, SERVICE_AREAS } from "./base-data";
import {
  ADDONS,
  DEMO_PASSWORD,
  DEMO_USERS,
  EXPERIENCES,
  GENERAL_FAQS,
  INVENTORY,
  INVENTORY_LOCATION,
  MENUS,
  MENU_COST_BASELINE_SLUG,
  STAFF,
  TESTIMONIALS,
  VENDORS,
} from "./demo-catalog";
import {
  type Clock,
  type PricingAddOn,
  type PricingArea,
  type PricingExperience,
  type PricingMenu,
  addDaysToKey,
  emailFor,
  firstDateOnOrAfter,
} from "./helpers";

export type UserKey = keyof typeof DEMO_USERS;
export type StaffKey = (typeof STAFF)[number]["key"];

export interface UserRef {
  id: string;
  email: string;
  name: string;
}

export interface StaffRef {
  id: string;
  name: string;
  userId: string | null;
  primaryFunction: StaffFunction;
  rateCents: number;
  rateType: StaffRateType;
}

export interface InventoryRef {
  id: string;
  sku: string;
  totalQuantity: number;
  replacementCostCents: number;
}

export interface CustomerRef {
  id: string;
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  referralCode: string;
}

export interface DemoRefs {
  users: Record<UserKey, UserRef>;
  staff: Record<StaffKey, StaffRef>;
  inventory: Record<string, InventoryRef>;
  experiences: Record<string, PricingExperience & { durationMinutes: number }>;
  menus: Record<string, PricingMenu>;
  addOns: Record<string, PricingAddOn>;
  areas: Record<string, PricingArea>;
  styles: Record<string, { id: string; name: string; palette: string[] }>;
  vendors: Record<string, { id: string; name: string }>;
  customers: Record<string, CustomerRef>;
  budgets: Record<string, string>;
  menuCostBaselineCents: number;
  dates: DemoDates;
}

export interface DemoDates {
  blackout: string[];
  blockedKey: string;
  capacityKey: string;
  e1: string;
  e3: string;
  e4: string;
  e5: string;
  e6: string;
  lucia: string;
}

// -----------------------------------------------------------------------------
// Media helpers (placeholders SVG servidos desde /public)
// -----------------------------------------------------------------------------
const ALT: Record<string, string> = {
  hero: "Mesa larga de brunch con flores y velas",
  "brunch-table": "Mesa de brunch vista desde arriba",
  "birthday-cake": "Pastel de cumpleaños de dos pisos con velas",
  karaoke: "Micrófono de karaoke con ondas de sonido",
  "bridal-flowers": "Ramo de flores en tonos blush",
  "peru-mexico": "Papel picado y motivos andinos",
  mimosas: "Copas de mimosa con burbujas",
  founders: "Dos tazas de café y un florero",
  "gallery-01": "Rama de olivo en línea",
  "gallery-02": "Copas brindando",
  "gallery-03": "Tres floreros con tallos",
  "gallery-04": "Mesa redonda con candelabro",
  "gallery-05": "Arco de globos orgánico",
  "gallery-06": "Croissants y café",
  "gallery-07": "Frutero con cítricos",
  "gallery-08": "Caja de regalo con moño",
};

const sizeCache = new Map<string, number>();
function fileSize(url: string): number {
  const cached = sizeCache.get(url);
  if (cached !== undefined) return cached;
  let size = 0;
  try {
    size = fs.statSync(path.join(process.cwd(), "public", url)).size;
  } catch {
    size = 0;
  }
  sizeCache.set(url, size);
  return size;
}

export interface MediaBase {
  driver: "EXTERNAL";
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt: string;
  kind: "IMAGE";
  visibility: "PUBLIC";
  purpose: MediaPurpose;
  approved: boolean;
  featured: boolean;
  sortOrder: number;
  consent: boolean;
}

export function placeholderMedia(
  name: string,
  purpose: MediaPurpose,
  opts: { alt?: string; sortOrder?: number; featured?: boolean; consent?: boolean; approved?: boolean } = {},
): MediaBase {
  const url = PLACEHOLDER(name);
  return {
    driver: "EXTERNAL",
    url,
    mimeType: "image/svg+xml",
    sizeBytes: fileSize(url),
    width: 1200,
    height: 800,
    alt: opts.alt ?? ALT[name] ?? "Ilustración Ivonne & Rosa",
    kind: "IMAGE",
    visibility: "PUBLIC",
    purpose,
    approved: opts.approved ?? true,
    featured: opts.featured ?? false,
    sortOrder: opts.sortOrder ?? 0,
    consent: opts.consent ?? false,
  };
}

// -----------------------------------------------------------------------------
// Fechas del demo (todas relativas a "hoy" en CDMX)
// -----------------------------------------------------------------------------
const OPEN_DAYS = [0, 2, 3, 4, 5, 6];

export function computeDemoDates(clock: Clock): DemoDates {
  const today = clock.todayKey;
  let xmasYear = Number(today.slice(0, 4));
  if (today > `${xmasYear}-12-25`) xmasYear += 1;
  const blackout = [`${xmasYear}-12-24`, `${xmasYear}-12-25`];
  const blackoutSet = new Set(blackout);
  const blockedKey = firstDateOnOrAfter(clock.dayKey(40), OPEN_DAYS, blackoutSet);
  const capacityKey = firstDateOnOrAfter(clock.dayKey(57), [6], blackoutSet);
  const avoid = new Set([...blackout, blockedKey, capacityKey]);
  const e1 = firstDateOnOrAfter(clock.dayKey(8), [6], avoid); // próximo sábado >= 8 días
  const e3 = firstDateOnOrAfter(clock.dayKey(17), [5, 6, 0], new Set([...avoid, e1]));
  const lucia = firstDateOnOrAfter(clock.dayKey(23), [6], new Set([...avoid, e3]));
  const e6 = firstDateOnOrAfter(clock.dayKey(29), [6, 0], new Set([...avoid, e3, lucia]));
  const e4 = firstDateOnOrAfter(clock.dayKey(-21), OPEN_DAYS); // ~20 días atrás
  const e5 = firstDateOnOrAfter(clock.dayKey(-9), OPEN_DAYS, new Set([e4])); // ~8 días atrás
  return { blackout, blockedKey, capacityKey, e1, e3, e4, e5, e6, lucia };
}

// -----------------------------------------------------------------------------
// Seed
// -----------------------------------------------------------------------------
export async function seedDemoSetup(prisma: PrismaClient, clock: Clock): Promise<DemoRefs> {
  const dates = computeDemoDates(clock);

  // --- Usuarios -------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  const users = {} as Record<UserKey, UserRef>;
  const lastLogin: Partial<Record<UserKey, Date>> = {
    superadmin: clock.hoursAgo(26),
    ivonne: clock.hoursAgo(2),
    rosa: clock.hoursAgo(5),
    lupita: clock.hoursAgo(20),
  };
  for (const key of Object.keys(DEMO_USERS) as UserKey[]) {
    const u = DEMO_USERS[key];
    const created = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone,
        passwordHash,
        active: true,
        lastLoginAt: lastLogin[key] ?? null,
        createdAt: clock.at(-120, "10:00"),
      },
      select: { id: true, email: true, name: true },
    });
    users[key] = created;
  }

  // --- Staff ------------------------------------------------------------------
  const staff = {} as Record<StaffKey, StaffRef>;
  for (const s of STAFF) {
    const created = await prisma.staffMember.create({
      data: {
        name: s.name,
        primaryFunction: s.primaryFunction,
        phone: s.phone,
        email: s.email,
        rateCents: s.rateCents,
        rateType: s.rateType,
        availableWeekdays: s.availableWeekdays,
        availabilityNotes: s.availabilityNotes ?? null,
        userId: s.userKey ? users[s.userKey].id : null,
        active: true,
        createdAt: clock.at(-110, "10:00"),
      },
    });
    staff[s.key] = {
      id: created.id,
      name: created.name,
      userId: created.userId,
      primaryFunction: created.primaryFunction,
      rateCents: created.rateCents,
      rateType: created.rateType,
    };
  }

  // --- Inventario -------------------------------------------------------------
  await prisma.inventoryItem.createMany({
    data: INVENTORY.map((i) => ({
      sku: i.sku,
      name: i.name,
      category: i.category,
      unit: i.unit ?? "pz",
      totalQuantity: i.totalQuantity,
      maintenanceQuantity: i.maintenanceQuantity ?? 0,
      lowStockThreshold: i.lowStockThreshold,
      replacementCostCents: i.replacementCostCents,
      location: INVENTORY_LOCATION,
      notes: i.notes ?? null,
      active: true,
    })),
  });
  const inventoryRows = await prisma.inventoryItem.findMany({
    select: { id: true, sku: true, totalQuantity: true, replacementCostCents: true },
  });
  const inventory: Record<string, InventoryRef> = Object.fromEntries(inventoryRows.map((r) => [r.sku, r]));
  const invId = (sku: string): string => {
    const row = inventory[sku];
    if (!row) throw new Error(`SKU desconocido: ${sku}`);
    return row.id;
  };

  // --- Menús --------------------------------------------------------------------
  const menus: Record<string, PricingMenu> = {};
  for (const [index, m] of MENUS.entries()) {
    const created = await prisma.menu.create({
      data: {
        slug: m.slug,
        name: m.name,
        description: m.description,
        pricingType: m.pricingType,
        priceCents: m.priceCents,
        costPerGuestCents: m.costPerGuestCents,
        tags: m.tags,
        dietaryTags: m.dietaryTags,
        sortOrder: index + 1,
        items: {
          create: m.items.map((item, i) => ({
            name: item.name,
            description: item.description ?? null,
            course: item.course,
            dietaryTags: item.dietaryTags ?? [],
            sortOrder: i + 1,
          })),
        },
      },
    });
    menus[m.slug] = {
      id: created.id,
      slug: created.slug,
      name: created.name,
      pricingType: created.pricingType,
      priceCents: created.priceCents,
      costPerGuestCents: created.costPerGuestCents,
    };
  }

  // --- Add-ons --------------------------------------------------------------------
  const addOns: Record<string, PricingAddOn> = {};
  for (const [index, a] of ADDONS.entries()) {
    const created = await prisma.addOn.create({
      data: {
        slug: a.slug,
        name: a.name,
        description: a.description,
        category: a.category,
        pricingType: a.pricingType,
        priceCents: a.priceCents,
        costCents: a.costCents,
        costCategory: a.costCategory,
        maxQuantity: a.maxQuantity,
        leadTimeDays: a.leadTimeDays,
        imageUrl: a.imageUrl,
        sortOrder: index + 1,
        inventoryReqs: a.inventory
          ? { create: a.inventory.map((r) => ({ inventoryItemId: invId(r.sku), quantity: r.quantity, perGuest: r.perGuest })) }
          : undefined,
      },
    });
    addOns[a.slug] = {
      id: created.id,
      slug: created.slug,
      name: created.name,
      pricingType: created.pricingType,
      priceCents: created.priceCents,
      costCents: created.costCents,
      costCategory: created.costCategory,
    };
  }

  // --- Zonas y estilos (creados por el seed base) ----------------------------------
  const areaRows = await prisma.serviceArea.findMany();
  const areas: Record<string, PricingArea> = Object.fromEntries(
    areaRows.map((a) => [
      a.slug,
      { id: a.id, slug: a.slug, name: a.name, logisticsFeeCents: a.logisticsFeeCents, logisticsCostCents: a.logisticsCostCents },
    ]),
  );
  const activeAreaSlugs = SERVICE_AREAS.filter((a) => a.active).map((a) => a.slug);
  const styleRows = await prisma.style.findMany();
  const styles = Object.fromEntries(styleRows.map((s) => [s.slug, { id: s.id, name: s.name, palette: s.palette }]));

  // --- Experiencias -----------------------------------------------------------------
  const experiences: DemoRefs["experiences"] = {};
  for (const [index, e] of EXPERIENCES.entries()) {
    const created = await prisma.experience.create({
      data: {
        slug: e.slug,
        name: e.name,
        tagline: e.tagline,
        description: e.description,
        type: e.type,
        occasions: e.occasions,
        basePriceCents: e.basePriceCents,
        baseGuests: 6,
        minGuests: 6,
        maxGuests: 12,
        extraGuestPriceCents: e.extraGuestPriceCents,
        extraGuestCostCents: e.extraGuestCostCents,
        durationMinutes: e.durationMinutes,
        includes: e.includes,
        coverImageUrl: PLACEHOLDER(e.cover),
        active: true,
        featured: e.featured,
        sortOrder: index + 1,
        styles: { connect: e.styles.map((slug) => ({ slug })) },
        serviceAreas: { connect: activeAreaSlugs.map((slug) => ({ slug })) },
        menus: { connect: e.menus.map((slug) => ({ slug })) },
        addOns: { connect: e.addOns.map((slug) => ({ slug })) },
        costComponents: { create: e.costs.map((c, i) => ({ ...c, sortOrder: i + 1 })) },
        inventoryReqs: {
          create: e.inventory.map((r) => ({ inventoryItemId: invId(r.sku), quantity: r.quantity, perGuest: r.perGuest })),
        },
        faqs: { create: e.faqs.map((f, i) => ({ ...f, sortOrder: i + 1, active: true })) },
        images: {
          create: e.images.map((img, i) => ({
            sortOrder: i + 1,
            mediaAsset: { create: placeholderMedia(img, "EXPERIENCE", { sortOrder: i + 1, featured: i === 0 }) },
          })),
        },
      },
      include: { costComponents: true },
    });
    experiences[e.slug] = {
      id: created.id,
      slug: created.slug,
      name: created.name,
      basePriceCents: created.basePriceCents,
      baseGuests: created.baseGuests,
      extraGuestPriceCents: created.extraGuestPriceCents,
      extraGuestCostCents: created.extraGuestCostCents,
      durationMinutes: created.durationMinutes,
      costComponents: created.costComponents.map((c) => ({
        category: c.category,
        amountCents: c.amountCents,
        perGuest: c.perGuest,
      })),
    };
  }

  // --- Proveedores ------------------------------------------------------------------
  const vendors: DemoRefs["vendors"] = {};
  for (const v of VENDORS) {
    const created = await prisma.vendor.create({
      data: {
        name: v.name,
        category: v.category,
        contactName: v.contactName,
        phone: v.phone,
        whatsapp: v.phone,
        email: v.email,
        slaNotes: v.slaNotes,
        notes: v.notes ?? null,
        status: v.status ?? "ACTIVE",
        rating: v.rating,
        createdAt: clock.at(-100, "12:00"),
      },
    });
    vendors[v.key] = { id: created.id, name: created.name };
  }

  // --- Disponibilidad: excepciones ----------------------------------------------------
  await prisma.availabilityException.createMany({
    data: [
      { date: dateOnly(dates.blackout[0]!), type: "BLACKOUT", reason: "Nochebuena: sin reservas públicas" },
      { date: dateOnly(dates.blackout[1]!), type: "BLACKOUT", reason: "Navidad: sin reservas públicas" },
      { date: dateOnly(dates.blockedKey), type: "BLOCKED", reason: "Vacaciones del equipo" },
      {
        date: dateOnly(dates.capacityKey),
        type: "CAPACITY_OVERRIDE",
        maxEvents: 3,
        reason: "Temporada alta: refuerzo de staff (3 eventos)",
      },
    ],
  });

  // --- Contenido público ----------------------------------------------------------------
  await prisma.testimonial.createMany({
    data: TESTIMONIALS.map((t, i) => ({ ...t, active: true, sortOrder: i + 1 })),
  });
  await prisma.faq.createMany({
    data: GENERAL_FAQS.map((f, i) => ({ ...f, sortOrder: i + 1, active: true })),
  });
  await prisma.mediaAsset.createMany({
    data: Array.from({ length: 8 }, (_, i) =>
      placeholderMedia(`gallery-0${i + 1}`, "GALLERY", { sortOrder: i + 1, featured: true }),
    ),
  });
  await prisma.mediaAsset.createMany({
    data: [
      placeholderMedia("hero", "OTHER", { featured: true, alt: "Ivonne & Rosa — mesa de brunch" }),
      placeholderMedia("founders", "OTHER", { alt: "Ivonne y Rosa, fundadoras" }),
    ],
  });

  // --- Clientas ---------------------------------------------------------------------------
  const CUSTOMERS: {
    key: string;
    name: string;
    phone: string;
    instagram?: string;
    source: LeadSource;
    marketingOptIn?: boolean;
    notes?: string;
    createdDaysAgo: number;
  }[] = [
    { key: "valeria", name: "Valeria Campos", phone: "+52 55 5102 3304", instagram: "@valecampos", source: "CONFIGURATOR", marketingOptIn: true, notes: "Mamá limeña, papá tapatío. Clienta embajadora: ya nos refirió a una amiga.", createdDaysAgo: 62 },
    { key: "paola", name: "Paola Lozano", phone: "+52 81 5102 3302", instagram: "@paolozano", source: "REFERRAL", notes: "Dama de honor de Mariana. Vive en Monterrey; coordina todo por WhatsApp.", createdDaysAgo: 41 },
    { key: "anapaula", name: "Ana Paula Ríos", phone: "+52 55 5102 3305", source: "GOOGLE", marketingOptIn: true, createdDaysAgo: 36 },
    { key: "ximena", name: "Ximena Aguilar", phone: "+52 55 5102 3309", source: "CONFIGURATOR", createdDaysAgo: 31 },
    { key: "sofia", name: "Sofía Navarro", phone: "+52 55 5102 3301", instagram: "@sofinavarro", source: "CONFIGURATOR", marketingOptIn: true, notes: "Le encantan las flores en tonos blush. Celiaca una de sus mejores amigas.", createdDaysAgo: 28 },
    { key: "daniela", name: "Daniela Ortiz", phone: "+52 55 5102 3303", instagram: "@dani.ortiz", source: "TIKTOK", createdDaysAgo: 22 },
    { key: "renata", name: "Renata Castillo", phone: "+52 55 5102 3310", source: "GOOGLE", createdDaysAgo: 19 },
    { key: "patricia", name: "Patricia Ibarra", phone: "+52 55 5102 3312", source: "CONTACT_FORM", notes: "Directora de RH en despacho de abogados de Polanco.", createdDaysAgo: 9 },
    { key: "fernanda", name: "Fernanda Salinas", phone: "+52 55 5102 3306", source: "WHATSAPP", notes: "32 semanas de embarazo; baby brunch organizado por ella misma.", createdDaysAgo: 6 },
    { key: "natalia", name: "Natalia Herrera", phone: "+52 55 5102 3311", instagram: "@nataherrera", source: "INSTAGRAM", createdDaysAgo: 5 },
    { key: "monica", name: "Mónica Treviño", phone: "+52 55 5102 3308", instagram: "@monitrevino", source: "INSTAGRAM", createdDaysAgo: 4 },
    { key: "lucia", name: "Lucía Ramírez", phone: "+52 55 5102 3307", source: "CONFIGURATOR", marketingOptIn: true, createdDaysAgo: 2 },
    { key: "claudia", name: "Claudia Benítez", phone: "+52 55 5102 3313", source: "REFERRAL", notes: "Amiga de Valeria; pidió información para diciembre.", createdDaysAgo: 15 },
    { key: "teresa", name: "Teresa Alarcón", phone: "+52 55 5102 3314", source: "MANUAL", notes: "Contacto de desayuno corporativo boutique (capturado en persona).", createdDaysAgo: 80 },
  ];
  const usedReferral = new Set<string>();
  const customers: Record<string, CustomerRef> = {};
  for (const c of CUSTOMERS) {
    let referralCode = generateReferralCode(c.name);
    while (usedReferral.has(referralCode)) referralCode = generateReferralCode(c.name);
    usedReferral.add(referralCode);
    const email = emailFor(c.name);
    const created = await prisma.customer.create({
      data: {
        name: c.name,
        email,
        phone: c.phone,
        whatsapp: c.phone,
        instagram: c.instagram ?? null,
        source: c.source,
        referralCode,
        marketingOptIn: c.marketingOptIn ?? false,
        notes: c.notes ?? null,
        createdAt: clock.at(-c.createdDaysAgo, "09:00"),
      },
    });
    customers[c.key] = {
      id: created.id,
      key: c.key,
      name: created.name,
      email: created.email,
      phone: created.phone,
      referralCode: created.referralCode,
    };
  }

  const budgetRows = await prisma.budgetRange.findMany({ orderBy: { sortOrder: "asc" } });
  const budgets = Object.fromEntries(budgetRows.map((b) => [b.id, b.id]));

  const baseline = menus[MENU_COST_BASELINE_SLUG];
  if (!baseline) throw new Error("Falta el menú de referencia");

  return {
    users,
    staff,
    inventory,
    experiences,
    menus,
    addOns,
    areas,
    styles,
    vendors,
    customers,
    budgets,
    menuCostBaselineCents: baseline.costPerGuestCents,
    dates,
  };
}

export { addDaysToKey };
