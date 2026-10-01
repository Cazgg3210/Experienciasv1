import { z } from "zod";
import { isValidDateKey } from "@/lib/dates";

export const PURCHASE_STATUSES = ["REQUESTED", "ORDERED", "RECEIVED", "CANCELLED"] as const;
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

const id = z.string().min(1).max(64);

const optionalId = z
  .string()
  .max(64)
  .nullish()
  .transform((v) => (v && v !== "none" ? v : null));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const cents = (label: string) =>
  z
    .number({ invalid_type_error: `${label}: escribe un monto.`, required_error: `${label} es obligatorio.` })
    .int(`${label} debe estar en centavos enteros.`)
    .min(0, `${label} no puede ser negativo.`)
    .max(100_000_000, `${label} es demasiado grande.`);

const optionalDateKey = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isValidDateKey(v), "Fecha inválida (AAAA-MM-DD).");

export const purchaseBaseSchema = z.object({
  eventId: optionalId,
  vendorId: optionalId,
  concept: z.string().trim().min(3, "Describe qué se compra (mín. 3 caracteres).").max(200, "Máximo 200 caracteres."),
  category: z.enum(COST_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría de costo." }) }),
  expectedAmountCents: cents("El monto esperado"),
  neededBy: optionalDateKey,
  notes: optionalText(2000),
});

export const createPurchaseSchema = purchaseBaseSchema;
export type CreatePurchaseInput = z.input<typeof createPurchaseSchema>;
export type CreatePurchaseData = z.output<typeof createPurchaseSchema>;

export const updatePurchaseSchema = purchaseBaseSchema.extend({ id });
export type UpdatePurchaseInput = z.input<typeof updatePurchaseSchema>;
export type UpdatePurchaseData = z.output<typeof updatePurchaseSchema>;

export const transitionPurchaseSchema = z.object({
  id,
  to: z.enum(PURCHASE_STATUSES),
  actualAmountCents: cents("El monto real").nullish(),
  reason: optionalText(500),
  receiptMediaId: optionalId,
});
export type TransitionPurchaseInput = z.input<typeof transitionPurchaseSchema>;
export type TransitionPurchaseData = z.output<typeof transitionPurchaseSchema>;

export const receivePurchaseSchema = z.object({
  id,
  actualAmountCents: cents("El monto real"),
  receiptMediaId: optionalId,
});
export type ReceivePurchaseInput = z.input<typeof receivePurchaseSchema>;

export const cancelPurchaseSchema = z.object({
  id,
  reason: z.string().trim().min(3, "Cuéntanos el motivo (mín. 3 caracteres).").max(500, "Máximo 500 caracteres."),
});
export type CancelPurchaseInput = z.input<typeof cancelPurchaseSchema>;

export const actualAmountSchema = z.object({
  id,
  actualAmountCents: cents("El monto real"),
  reason: z.string().trim().min(3, "Explica el motivo del cambio (mín. 3 caracteres).").max(300, "Máximo 300 caracteres."),
});
export type ActualAmountInput = z.input<typeof actualAmountSchema>;

export const attachReceiptSchema = z.object({ id, receiptMediaId: optionalId });

export const purchaseIdSchema = z.object({ id });

/** Filtros del listado (searchParams). */
const dateParam = z
  .string()
  .optional()
  .catch(undefined)
  .transform((v) => (v && isValidDateKey(v) ? v : undefined));

export const purchaseFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum(PURCHASE_STATUSES).optional().catch(undefined),
  category: z.enum(COST_CATEGORIES).optional().catch(undefined),
  event: z.string().max(64).optional().catch(undefined),
  vendor: z.string().max(64).optional().catch(undefined),
  from: dateParam,
  to: dateParam,
});
export type PurchaseFilters = z.output<typeof purchaseFiltersSchema>;
