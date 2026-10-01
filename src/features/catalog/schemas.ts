/**
 * Esquemas Zod del catálogo, compartidos entre formularios (RHF + zodResolver) y Server Actions.
 * Sin transforms/defaults: el tipo de entrada = tipo de salida (formularios simples).
 * Dinero SIEMPRE en centavos (enteros).
 */
import { z } from "zod";
import type {
  AddOnCategory,
  AddOnPricingType,
  CostCategory,
  DietaryRestriction,
  ExperienceType,
  MenuCourse,
  MenuPricingType,
  Occasion,
} from "@prisma/client";
import { HEX_COLOR_RE, POSTAL_CODE_RE, isAcceptableImageUrl } from "./domain/catalog-rules";

// -----------------------------------------------------------------------------
// Enums (tuplas explícitas: no importamos @prisma/client en el bundle del cliente)
// -----------------------------------------------------------------------------
export const OCCASIONS = [
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "CORPORATE",
  "OTHER",
] as const satisfies readonly Occasion[];
export const EXPERIENCE_TYPES = ["BRUNCH", "BREAKFAST", "CELEBRATION", "THEMED"] as const satisfies readonly ExperienceType[];
export const COST_CATEGORIES = [
  "FOOD",
  "FLOWERS",
  "STAFF",
  "TRANSPORT",
  "VENDOR",
  "CONSUMABLES",
  "PAYMENT_FEE",
  "OTHER",
] as const satisfies readonly CostCategory[];
export const MENU_PRICING_TYPES = ["INCLUDED", "PER_GUEST", "FLAT"] as const satisfies readonly MenuPricingType[];
export const MENU_COURSES = ["DRINK", "STARTER", "MAIN", "SIDE", "DESSERT", "OTHER"] as const satisfies readonly MenuCourse[];
export const DIETARY_RESTRICTIONS = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "NUT_ALLERGY",
  "SEAFOOD_ALLERGY",
  "KOSHER",
  "HALAL",
  "OTHER",
] as const satisfies readonly DietaryRestriction[];
export const ADDON_CATEGORIES = [
  "DECOR",
  "FOOD",
  "DRINKS",
  "ENTERTAINMENT",
  "PHOTO",
  "PERSONALIZATION",
  "EXPERIENCE",
  "OTHER",
] as const satisfies readonly AddOnCategory[];
export const ADDON_PRICING_TYPES = ["FLAT", "PER_GUEST"] as const satisfies readonly AddOnPricingType[];

// -----------------------------------------------------------------------------
// Primitivos
// -----------------------------------------------------------------------------
export const MAX_MONEY_CENTS = 100_000_000; // $1,000,000 MXN

export const idSchema = z
  .string({ required_error: "Falta el identificador" })
  .min(1, "Falta el identificador")
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido");

const requiredText = (label: string, max: number, min = 1) =>
  z
    .string({ required_error: `${label} es obligatorio` })
    .trim()
    .min(min, min > 1 ? `${label}: mínimo ${min} caracteres` : `${label} es obligatorio`)
    .max(max, `${label}: máximo ${max} caracteres`);

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label}: máximo ${max} caracteres`);

export const slugSchema = z
  .string({ required_error: "El slug es obligatorio" })
  .trim()
  .min(2, "El slug debe tener al menos 2 caracteres")
  .max(80, "El slug admite máximo 80 caracteres")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa sólo minúsculas, números y guiones (sin espacios ni acentos)");

export const moneySchema = z
  .number({ required_error: "Ingresa un monto", invalid_type_error: "Ingresa un monto válido" })
  .int("El monto debe tener máximo 2 decimales")
  .min(0, "El monto no puede ser negativo")
  .max(MAX_MONEY_CENTS, "El monto es demasiado alto");

const intSchema = (label: string, min: number, max: number) =>
  z
    .number({ required_error: `${label} es obligatorio`, invalid_type_error: `${label}: ingresa un número` })
    .int(`${label}: usa un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);

export const sortOrderSchema = intSchema("Orden", 0, 9999);

export const imageUrlSchema = z
  .string()
  .trim()
  .max(500, "La URL admite máximo 500 caracteres")
  .refine(isAcceptableImageUrl, "Usa una ruta local (/images/...) o una URL https://");

const idList = (max = 100) => z.array(idSchema).max(max, "Demasiados elementos seleccionados");

const inventoryReqSchema = z.object({
  inventoryItemId: idSchema,
  quantity: intSchema("Cantidad", 1, 1000),
  perGuest: z.boolean(),
});

function refineUniqueInventory(
  reqs: Array<{ inventoryItemId: string }>,
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  reqs.forEach((r, i) => {
    if (seen.has(r.inventoryItemId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inventoryReqs", i, "inventoryItemId"],
        message: "Este artículo ya está en la lista",
      });
    }
    seen.add(r.inventoryItemId);
  });
}

// -----------------------------------------------------------------------------
// Experiencias
// -----------------------------------------------------------------------------
export const costComponentSchema = z.object({
  category: z.enum(COST_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría" }) }),
  description: requiredText("Descripción", 120),
  amountCents: moneySchema,
  perGuest: z.boolean(),
});

export const experienceFaqSchema = z.object({
  id: idSchema.optional(),
  question: requiredText("Pregunta", 200, 3),
  answer: requiredText("Respuesta", 2000, 3),
  active: z.boolean(),
});

const experienceBase = z.object({
  // Básicos
  name: requiredText("Nombre", 120, 2),
  slug: slugSchema,
  tagline: optionalText("Frase corta", 160),
  description: requiredText("Descripción", 4000, 10),
  type: z.enum(EXPERIENCE_TYPES, { errorMap: () => ({ message: "Elige un tipo" }) }),
  occasions: z.array(z.enum(OCCASIONS)).max(OCCASIONS.length),
  durationMinutes: intSchema("Duración", 30, 720),
  active: z.boolean(),
  featured: z.boolean(),
  sortOrder: sortOrderSchema,
  // Personas y precio
  baseGuests: intSchema("Personas base", 1, 100),
  minGuests: intSchema("Mínimo de personas", 1, 100),
  maxGuests: intSchema("Máximo de personas", 1, 200),
  basePriceCents: moneySchema,
  extraGuestPriceCents: moneySchema,
  extraGuestCostCents: moneySchema,
  // Costos base
  costComponents: z.array(costComponentSchema).max(30, "Máximo 30 componentes de costo"),
  // Incluye
  includes: z.array(requiredText("Elemento", 160)).max(30, "Máximo 30 elementos"),
  // Imágenes
  coverImageUrl: imageUrlSchema,
  // Relaciones
  styleIds: idList(),
  serviceAreaIds: idList(),
  menuIds: idList(),
  addOnIds: idList(),
  // Inventario requerido
  inventoryReqs: z.array(inventoryReqSchema).max(80, "Máximo 80 artículos"),
  // FAQs
  faqs: z.array(experienceFaqSchema).max(30, "Máximo 30 preguntas"),
});

type ExperienceBase = z.infer<typeof experienceBase>;

function experienceRules(v: ExperienceBase, ctx: z.RefinementCtx) {
  if (v.minGuests > v.maxGuests) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minGuests"], message: "El mínimo no puede ser mayor que el máximo" });
  }
  if (v.active && v.basePriceCents <= 0) {
    // Una experiencia activa se muestra y cotiza en el sitio: nunca "desde $0".
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["basePriceCents"],
      message: "Define el precio base antes de activar la experiencia",
    });
  }
  if (v.baseGuests < v.minGuests || v.baseGuests > v.maxGuests) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["baseGuests"],
      message: "Las personas base deben estar entre el mínimo y el máximo",
    });
  }
  refineUniqueInventory(v.inventoryReqs, ctx);
}

export const experienceFormSchema = experienceBase.superRefine(experienceRules);
export const experienceUpdateSchema = experienceBase.extend({ id: idSchema }).superRefine(experienceRules);
export type ExperienceFormValues = z.infer<typeof experienceFormSchema>;
export type ExperienceUpdateValues = z.infer<typeof experienceUpdateSchema>;

export const experienceImageAddSchema = z.object({ experienceId: idSchema, mediaAssetId: idSchema });
export const experienceImageRemoveSchema = z.object({ experienceId: idSchema, imageId: idSchema });
export const experienceImageReorderSchema = z.object({
  experienceId: idSchema,
  orderedIds: z.array(idSchema).min(1).max(60),
});

// -----------------------------------------------------------------------------
// Menús
// -----------------------------------------------------------------------------
const menuBase = z.object({
  name: requiredText("Nombre", 120, 2),
  slug: slugSchema,
  description: optionalText("Descripción", 1000),
  pricingType: z.enum(MENU_PRICING_TYPES, { errorMap: () => ({ message: "Elige un tipo de precio" }) }),
  priceCents: moneySchema,
  costPerGuestCents: moneySchema,
  tags: z.array(requiredText("Etiqueta", 40)).max(15, "Máximo 15 etiquetas"),
  dietaryTags: z.array(z.enum(DIETARY_RESTRICTIONS)).max(DIETARY_RESTRICTIONS.length),
  active: z.boolean(),
  sortOrder: sortOrderSchema,
});
export const menuFormSchema = menuBase;
export const menuUpdateSchema = menuBase.extend({ id: idSchema });
export type MenuFormValues = z.infer<typeof menuFormSchema>;
export type MenuUpdateValues = z.infer<typeof menuUpdateSchema>;

export const menuItemFormSchema = z.object({
  name: requiredText("Nombre del platillo", 160, 2),
  description: optionalText("Descripción", 500),
  course: z.enum(MENU_COURSES, { errorMap: () => ({ message: "Elige un tiempo" }) }),
  dietaryTags: z.array(z.enum(DIETARY_RESTRICTIONS)).max(DIETARY_RESTRICTIONS.length),
});
export const menuItemCreateSchema = menuItemFormSchema.extend({ menuId: idSchema });
export const menuItemUpdateSchema = menuItemFormSchema.extend({ id: idSchema });
export const menuItemReorderSchema = z.object({ menuId: idSchema, orderedIds: z.array(idSchema).min(1).max(200) });
export type MenuItemFormValues = z.infer<typeof menuItemFormSchema>;
export type MenuItemCreateValues = z.infer<typeof menuItemCreateSchema>;
export type MenuItemUpdateValues = z.infer<typeof menuItemUpdateSchema>;

// -----------------------------------------------------------------------------
// Add-ons
// -----------------------------------------------------------------------------
const addOnBase = z.object({
  name: requiredText("Nombre", 120, 2),
  slug: slugSchema,
  description: optionalText("Descripción", 1000),
  category: z.enum(ADDON_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría" }) }),
  pricingType: z.enum(ADDON_PRICING_TYPES, { errorMap: () => ({ message: "Elige un tipo de precio" }) }),
  priceCents: moneySchema,
  costCents: moneySchema,
  costCategory: z.enum(COST_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría de costo" }) }),
  maxQuantity: intSchema("Cantidad máxima", 1, 100),
  leadTimeDays: intSchema("Días de anticipación", 0, 180),
  imageUrl: imageUrlSchema,
  active: z.boolean(),
  sortOrder: sortOrderSchema,
  inventoryReqs: z.array(inventoryReqSchema).max(40, "Máximo 40 artículos"),
});
type AddOnBase = z.infer<typeof addOnBase>;
const addOnRules = (v: AddOnBase, ctx: z.RefinementCtx) => refineUniqueInventory(v.inventoryReqs, ctx);
export const addOnFormSchema = addOnBase.superRefine(addOnRules);
export const addOnUpdateSchema = addOnBase.extend({ id: idSchema }).superRefine(addOnRules);
export type AddOnFormValues = z.infer<typeof addOnFormSchema>;
export type AddOnUpdateValues = z.infer<typeof addOnUpdateSchema>;

// -----------------------------------------------------------------------------
// Estilos
// -----------------------------------------------------------------------------
const styleBase = z.object({
  name: requiredText("Nombre", 80, 2),
  slug: slugSchema,
  description: optionalText("Descripción", 500),
  palette: z
    .array(z.string().trim().regex(HEX_COLOR_RE, "Usa colores hex como #a3b18a"))
    .max(12, "Máximo 12 colores"),
  imageUrl: imageUrlSchema,
  active: z.boolean(),
  sortOrder: sortOrderSchema,
});
export const styleFormSchema = styleBase;
export const styleUpdateSchema = styleBase.extend({ id: idSchema });
export type StyleFormValues = z.infer<typeof styleFormSchema>;
export type StyleUpdateValues = z.infer<typeof styleUpdateSchema>;

// -----------------------------------------------------------------------------
// Zonas de servicio
// -----------------------------------------------------------------------------
const areaBase = z.object({
  name: requiredText("Nombre", 80, 2),
  slug: slugSchema,
  description: optionalText("Descripción", 500),
  postalCodes: z
    .array(z.string().trim().regex(POSTAL_CODE_RE, "Cada código postal debe tener 5 dígitos"))
    .max(800, "Máximo 800 códigos postales"),
  logisticsFeeCents: moneySchema,
  logisticsCostCents: moneySchema,
  active: z.boolean(),
  sortOrder: sortOrderSchema,
});
export const areaFormSchema = areaBase;
export const areaUpdateSchema = areaBase.extend({ id: idSchema });
export type AreaFormValues = z.infer<typeof areaFormSchema>;
export type AreaUpdateValues = z.infer<typeof areaUpdateSchema>;

// -----------------------------------------------------------------------------
// Rangos de presupuesto
// -----------------------------------------------------------------------------
const budgetBase = z.object({
  label: requiredText("Etiqueta", 80, 2),
  minCents: moneySchema,
  maxCents: moneySchema.nullable(),
  sortOrder: sortOrderSchema,
  active: z.boolean(),
});
type BudgetBase = z.infer<typeof budgetBase>;
const budgetRules = (v: BudgetBase, ctx: z.RefinementCtx) => {
  if (v.maxCents != null && v.maxCents <= v.minCents) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxCents"], message: "El máximo debe ser mayor que el mínimo" });
  }
};
export const budgetFormSchema = budgetBase.superRefine(budgetRules);
export const budgetUpdateSchema = budgetBase.extend({ id: idSchema }).superRefine(budgetRules);
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type BudgetUpdateValues = z.infer<typeof budgetUpdateSchema>;

// -----------------------------------------------------------------------------
// Utilidades compartidas
// -----------------------------------------------------------------------------
export const CATALOG_ENTITIES = ["experience", "menu", "addOn", "style", "serviceArea", "budgetRange"] as const;
export type CatalogEntity = (typeof CATALOG_ENTITIES)[number];
export const SLUG_ENTITIES = ["experience", "menu", "addOn", "style", "serviceArea"] as const;
export type SlugEntity = (typeof SLUG_ENTITIES)[number];

export const deleteSchema = z.object({ id: idSchema });
export const slugCheckSchema = z.object({
  entity: z.enum(SLUG_ENTITIES),
  slug: z.string().trim().max(120),
  excludeId: idSchema.optional(),
});
export const toggleActiveSchema = z.object({ entity: z.enum(CATALOG_ENTITIES), id: idSchema, active: z.boolean() });
