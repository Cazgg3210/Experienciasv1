import { z } from "zod";

/**
 * Esquemas Zod del módulo Cotizaciones (compartidos cliente/servidor).
 * Sin imports de @prisma/client para no arrastrar el cliente de Prisma al bundle del navegador.
 */

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
export const OCCASIONS = [
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "CORPORATE",
  "OTHER",
] as const;
export const QUOTE_ITEM_TYPES = ["BASE_EXPERIENCE", "EXTRA_GUEST", "MENU", "ADDON", "LOGISTICS", "CUSTOM"] as const;
export const COST_CATEGORIES = [
  "FOOD",
  "FLOWERS",
  "STAFF",
  "TRANSPORT",
  "VENDOR",
  "CONSUMABLES",
  "PAYMENT_FEE",
  "OTHER",
] as const;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const cuidLike = z.string().trim().min(1).max(64);
const optionalId = z.string().trim().max(64).nullable().optional();
const optionalDateKey = z
  .string()
  .trim()
  .refine((v) => v === "" || DATE_KEY.test(v), "Fecha inválida")
  .optional();
const optionalTime = z
  .string()
  .trim()
  .refine((v) => v === "" || HHMM.test(v), "Hora inválida (HH:mm)")
  .optional();
const longText = z.string().max(2000, "Máximo 2000 caracteres").optional();

// -----------------------------------------------------------------------------
// Listado
// -----------------------------------------------------------------------------
export const quoteListFiltersSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  expiring: z.enum(["1"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(1),
});
export type QuoteListFilters = z.infer<typeof quoteListFiltersSchema>;

// -----------------------------------------------------------------------------
// Selección de catálogo (preview / creación)
// -----------------------------------------------------------------------------
export const addOnSelectionSchema = z.object({
  addOnId: cuidLike,
  quantity: z.number().int().min(1, "Mínimo 1").max(50, "Máximo 50"),
});

export const quoteSelectionSchema = z.object({
  experienceId: z.string().trim().min(1, "Elige una experiencia").max(64),
  guestCount: z
    .number({ invalid_type_error: "Indica el número de invitadas", required_error: "Indica el número de invitadas" })
    .int("Número entero")
    .min(1, "Mínimo 1 invitada")
    .max(200, "Máximo 200 invitadas"),
  menuId: optionalId,
  serviceAreaId: optionalId,
  addOns: z.array(addOnSelectionSchema).max(40),
  depositBps: z.number().int().min(0, "Mínimo 0%").max(10_000, "Máximo 100%"),
});
export type QuoteSelectionInput = z.input<typeof quoteSelectionSchema>;

export const quickCustomerSchema = z
  .object({
    name: z.string({ required_error: "Escribe el nombre de la clienta" }).trim().min(2, "Escribe el nombre de la clienta").max(120),
    email: z.string().trim().max(160).email("Email inválido").or(z.literal("")).optional(),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Teléfono de 10 dígitos")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Agrega email o teléfono para poder enviarle la propuesta",
      });
    }
  });
export type QuickCustomerInput = z.input<typeof quickCustomerSchema>;

/** Campos sin validar (sólo se validan con quickCustomerSchema cuando customerMode = "new"). */
const looseCustomerSchema = z
  .object({
    name: z.string().max(200).optional(),
    email: z.string().max(200).optional(),
    phone: z.string().max(60).optional(),
  })
  .nullable()
  .optional();

export const createQuoteSchema = quoteSelectionSchema
  .extend({
    leadId: optionalId,
    customerMode: z.enum(["existing", "new"]),
    customerId: optionalId,
    newCustomer: looseCustomerSchema,
    title: z.string().trim().max(140, "Máximo 140 caracteres").optional(),
    occasion: z.enum(OCCASIONS),
    eventDate: optionalDateKey,
    startTime: optionalTime,
    styleId: optionalId,
    notesForCustomer: longText,
    internalNotes: longText,
  })
  .superRefine((v, ctx) => {
    if (v.customerMode === "existing" && !v.customerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: "Elige una clienta" });
    }
    if (v.customerMode === "new") {
      const parsed = quickCustomerSchema.safeParse(v.newCustomer ?? {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ ...issue, path: ["newCustomer", ...(issue.path.length ? issue.path : ["name"])] });
        }
      }
    }
  });
export type CreateQuoteInput = z.input<typeof createQuoteSchema>;
export type CreateQuoteData = z.output<typeof createQuoteSchema>;

export const customerSearchSchema = z.object({ q: z.string().trim().min(2).max(80) });

// -----------------------------------------------------------------------------
// Editor de conceptos (sólo borradores)
// -----------------------------------------------------------------------------
export const editorLineSchema = z.object({
  itemId: optionalId,
  type: z.enum(QUOTE_ITEM_TYPES),
  refId: optionalId,
  description: z.string().trim().min(1, "Describe el concepto").max(200, "Máximo 200 caracteres"),
  quantity: z.number().int("Cantidad entera").min(1, "Mínimo 1").max(10_000, "Cantidad demasiado alta"),
  unitPriceCents: z.number().int().min(0, "No puede ser negativo").max(100_000_000),
  unitCostCents: z.number().int().min(0, "No puede ser negativo").max(100_000_000),
  costCategory: z.enum(COST_CATEGORIES),
});
export type EditorLine = z.infer<typeof editorLineSchema>;

export const discountInputSchema = z
  .object({
    type: z.enum(["NONE", "PERCENT", "AMOUNT"]),
    /** bps si PERCENT, centavos si AMOUNT */
    value: z.number().int().min(0, "No puede ser negativo").max(100_000_000),
    reason: z.string().trim().max(300, "Máximo 300 caracteres").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PERCENT" && v.value > 10_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Máximo 100%" });
    }
    if (v.type !== "NONE" && v.value > 0 && !v.reason?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Indica el motivo del descuento" });
    }
  });
export type DiscountInput = z.infer<typeof discountInputSchema>;

export const quotePricingSchema = z.object({
  quoteId: cuidLike,
  lines: z.array(editorLineSchema).min(1, "Agrega al menos un concepto").max(100),
  discount: discountInputSchema,
  depositBps: z.number().int().min(0, "Mínimo 0%").max(10_000, "Máximo 100%"),
});
export type QuotePricingInput = z.infer<typeof quotePricingSchema>;

/** Línea nueva desde catálogo (add-on) o invitadas adicionales: el servidor resuelve precio/costo. */
export const catalogLineRequestSchema = z.object({
  quoteId: cuidLike,
  kind: z.enum(["ADDON", "EXTRA_GUEST"]),
  addOnId: optionalId,
  units: z.number().int().min(1).max(200),
});
export type CatalogLineRequest = z.infer<typeof catalogLineRequestSchema>;

// -----------------------------------------------------------------------------
// Datos generales (sólo borradores)
// -----------------------------------------------------------------------------
export const quoteDetailsSchema = z.object({
  quoteId: cuidLike,
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(140, "Máximo 140 caracteres"),
  eventDate: optionalDateKey,
  startTime: optionalTime,
  guestCount: z
    .number({ invalid_type_error: "Indica el número de invitadas" })
    .int("Número entero")
    .min(1, "Mínimo 1 invitada")
    .max(200, "Máximo 200 invitadas"),
  styleId: optionalId,
  validUntil: optionalDateKey,
  notesForCustomer: longText,
  internalNotes: longText,
});
export type QuoteDetailsInput = z.input<typeof quoteDetailsSchema>;

export const quoteIdSchema = z.object({ quoteId: cuidLike });

// -----------------------------------------------------------------------------
// Acciones públicas (/cotizacion/[token])
// -----------------------------------------------------------------------------
const publicToken = z.string().trim().min(20).max(128);

export const acceptQuoteSchema = z.object({
  token: publicToken,
  fullName: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre completo")
    .max(120, "Máximo 120 caracteres")
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Escribe nombre y apellido"),
  acceptTerms: z.boolean().refine((v) => v, "Necesitamos tu aceptación para continuar"),
  /** Versión mostrada a la clienta (si el equipo la reemplazó, se pide recargar). */
  version: z.number().int().min(1).max(10_000).optional(),
});
export type AcceptQuoteInput = z.input<typeof acceptQuoteSchema>;

export const rejectQuoteSchema = z.object({
  token: publicToken,
  reason: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
});
export type RejectQuoteInput = z.input<typeof rejectQuoteSchema>;
