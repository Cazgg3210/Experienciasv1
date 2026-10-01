import { z } from "zod";
import { STOCK_ADJUSTMENT_TYPES } from "./domain/stock";

export const INVENTORY_CATEGORIES = [
  "DINNERWARE",
  "GLASSWARE",
  "CUTLERY",
  "LINENS",
  "DECOR",
  "AUDIO",
  "KARAOKE",
  "FURNITURE",
  "SERVING",
  "OTHER",
] as const;

const id = z.string().min(1, "Falta el identificador.").max(64);

const intField = (label: string, { min = 0, max = 100_000 }: { min?: number; max?: number } = {}) =>
  z
    .number({ invalid_type_error: `${label}: escribe un número.`, required_error: `${label} es obligatorio.` })
    .int(`${label} debe ser un número entero.`)
    .min(min, `${label} debe ser al menos ${min}.`)
    .max(max, `${label} es demasiado grande.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const inventoryItemBaseSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "El SKU debe tener al menos 2 caracteres.")
    .max(40, "Máximo 40 caracteres.")
    .regex(/^[A-Za-z0-9._-]+$/, "Usa sólo letras, números, guion, punto o guion bajo.")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Escribe el nombre del artículo.").max(120, "Máximo 120 caracteres."),
  category: z.enum(INVENTORY_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría." }) }),
  unit: z.string().trim().min(1, "Indica la unidad (p. ej. pz).").max(20, "Máximo 20 caracteres."),
  lowStockThreshold: intField("El umbral bajo"),
  replacementCostCents: intField("El costo de reposición", { max: 100_000_000 }),
  location: optionalText(120),
  notes: optionalText(1000),
  active: z.boolean(),
});

export const createInventoryItemSchema = inventoryItemBaseSchema.extend({
  totalQuantity: intField("La cantidad inicial"),
});
export type CreateInventoryItemInput = z.input<typeof createInventoryItemSchema>;
export type CreateInventoryItemData = z.output<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = inventoryItemBaseSchema.extend({ id });
export type UpdateInventoryItemInput = z.input<typeof updateInventoryItemSchema>;
export type UpdateInventoryItemData = z.output<typeof updateInventoryItemSchema>;

export const stockAdjustmentSchema = z.object({
  itemId: id,
  type: z.enum(STOCK_ADJUSTMENT_TYPES, { errorMap: () => ({ message: "Elige el tipo de movimiento." }) }),
  quantity: intField("La cantidad", { min: 1 }),
  direction: z.enum(["IN", "OUT"]).default("IN"),
  reason: z.string().trim().min(3, "Cuéntanos el motivo (mín. 3 caracteres).").max(300, "Máximo 300 caracteres."),
});
export type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>;
export type StockAdjustmentData = z.output<typeof stockAdjustmentSchema>;

export const reserveEventSchema = z.object({ eventId: id });

export const reservationQuantitySchema = z.object({
  reservationId: id,
  quantity: intField("La cantidad", { min: 1 }),
});
export type ReservationQuantityInput = z.input<typeof reservationQuantitySchema>;

export const reservationIdSchema = z.object({ reservationId: id });

export const returnReservationSchema = z.object({
  reservationId: id,
  returnedQuantity: intField("Las piezas devueltas"),
  damagedQuantity: intField("Las piezas dañadas"),
  notes: optionalText(500),
});
export type ReturnReservationInput = z.input<typeof returnReservationSchema>;

export const addReservationSchema = z.object({
  eventId: id,
  inventoryItemId: z.string().min(1, "Elige un artículo.").max(64, "Elige un artículo válido."),
  quantity: intField("La cantidad", { min: 1 }),
});
export type AddReservationInput = z.input<typeof addReservationSchema>;

/** Filtros de la tabla de inventario (searchParams). */
export const inventoryFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(INVENTORY_CATEGORIES).optional().catch(undefined),
  conflict: z
    .enum(["1"])
    .optional()
    .catch(undefined),
  inactive: z
    .enum(["1"])
    .optional()
    .catch(undefined),
});
export type InventoryFilters = z.output<typeof inventoryFiltersSchema>;
