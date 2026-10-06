/**
 * Helpers del catálogo (paquete 3). Datos propios con slugs únicos; nunca se mutan los del seed.
 */
import type { APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { uniq } from "../fixtures";
import { callAction, mustCall } from "../quotes/_helpers";

export function uniqSlug(prefix: string): string {
  return uniq(prefix).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Payload completo y válido para createExperienceAction (inactiva por defecto). */
export function experiencePayload(over: Record<string, unknown> = {}) {
  const slug = (over.slug as string | undefined) ?? uniqSlug("exp-e2e");
  return {
    name: `Experiencia ${slug}`,
    slug,
    tagline: "Frase de prueba",
    description: "Descripción de prueba E2E con más de diez caracteres.",
    type: "BRUNCH",
    occasions: ["BIRTHDAY"],
    durationMinutes: 180,
    active: false,
    featured: false,
    sortOrder: 900,
    baseGuests: 6,
    minGuests: 6,
    maxGuests: 12,
    basePriceCents: 1_200_000,
    extraGuestPriceCents: 150_000,
    extraGuestCostCents: 50_000,
    costComponents: [{ category: "FOOD", description: "Comida base", amountCents: 300_000, perGuest: false }],
    includes: ["Mesa puesta"],
    coverImageUrl: "",
    styleIds: [],
    serviceAreaIds: [],
    menuIds: [],
    addOnIds: [],
    inventoryReqs: [],
    faqs: [],
    ...over,
  };
}

export async function createExperienceViaAction(api: APIRequestContext, over: Record<string, unknown> = {}) {
  const payload = experiencePayload(over);
  const res = await mustCall<{ id: string; slug: string }>(api, "catalog", "createExperienceAction", payload);
  return { ...res, name: payload.name as string, payload };
}

export function addOnPayload(over: Record<string, unknown> = {}) {
  const slug = (over.slug as string | undefined) ?? uniqSlug("addon-e2e");
  return {
    name: `Add-on ${slug}`,
    slug,
    description: "",
    category: "DECOR",
    pricingType: "FLAT",
    priceCents: 100_000,
    costCents: 40_000,
    costCategory: "VENDOR",
    maxQuantity: 2,
    leadTimeDays: 0,
    imageUrl: "",
    active: true,
    sortOrder: 900,
    inventoryReqs: [],
    ...over,
  };
}

export function menuPayload(over: Record<string, unknown> = {}) {
  const slug = (over.slug as string | undefined) ?? uniqSlug("menu-e2e");
  return {
    name: `Menú ${slug}`,
    slug,
    description: "",
    pricingType: "PER_GUEST",
    priceCents: 20_000,
    costPerGuestCents: 9_000,
    tags: [],
    dietaryTags: [],
    active: true,
    sortOrder: 900,
    ...over,
  };
}

export function areaPayload(over: Record<string, unknown> = {}) {
  const slug = (over.slug as string | undefined) ?? uniqSlug("zona-e2e");
  return {
    name: `Zona ${slug}`,
    slug,
    description: "",
    postalCodes: [],
    logisticsFeeCents: 30_000,
    logisticsCostCents: 20_000,
    active: true,
    sortOrder: 900,
    ...over,
  };
}

export function budgetPayload(over: Record<string, unknown> = {}) {
  return { label: uniq("Rango E2E"), minCents: 5_000_000, maxCents: 6_000_000, sortOrder: 900, active: true, ...over };
}

export function stylePayload(over: Record<string, unknown> = {}) {
  const slug = (over.slug as string | undefined) ?? uniqSlug("estilo-e2e");
  return { name: `Estilo ${slug}`, slug, description: "", palette: ["#a3b18a"], imageUrl: "", active: true, sortOrder: 900, ...over };
}

export async function createVia<T = { id: string }>(api: APIRequestContext, name: string, payload: unknown) {
  return mustCall<T>(api, "catalog", name, payload);
}

export { callAction };

/** PNG válido mínimo (1×1) para el uploader. */
export const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** PNG 8×8 de color sólido (distinto contenido = distinto archivo). */
export function pngOfColor(seed: number): Buffer {
  // Reutiliza el 1×1 válido; el contenido no importa para la validación por magic bytes.
  const copy = Buffer.from(PNG_1x1);
  return Buffer.concat([copy, Buffer.from([seed & 0xff])]);
}

export async function experienceAudit(db: PrismaClient, entityId: string, action: string) {
  return db.auditLog.findMany({ where: { entityId, action }, orderBy: { createdAt: "asc" } });
}
