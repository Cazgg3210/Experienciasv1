import { z } from "zod";

export const VENDOR_CATEGORIES = ["FLOWERS", "FOOD", "PASTRY", "TRANSPORT", "FURNITURE", "PHOTO", "BEVERAGES", "OTHER"] as const;
export const VENDOR_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const phone = z
  .string()
  .trim()
  .max(30, "Máximo 30 caracteres.")
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[+()\d\s.-]{7,30}$/.test(v), "Escribe un teléfono válido (sólo números, espacios, +, guiones).")
  .refine((v) => v === null || v.replace(/\D/g, "").length >= 8, "El teléfono parece incompleto.");

export const vendorBaseSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del proveedor.").max(120, "Máximo 120 caracteres."),
  category: z.enum(VENDOR_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría." }) }),
  contactName: optionalText(120),
  phone,
  // El enlace wa.me necesita el número completo: 10 dígitos (MX) o con lada internacional.
  // (menos de 8 dígitos ya lo marca la validación de teléfono).
  whatsapp: phone.refine((v) => {
    if (v === null) return true;
    const digits = v.replace(/\D/g, "").length;
    return digits < 8 || (digits >= 10 && digits <= 15);
  }, "Escribe el WhatsApp a 10 dígitos (o con lada internacional)."),
  email: z
    .string()
    .trim()
    .max(160, "Máximo 160 caracteres.")
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Escribe un correo válido."),
  slaNotes: optionalText(1000),
  notes: optionalText(2000),
  status: z.enum(VENDOR_STATUSES, { errorMap: () => ({ message: "Elige un estado." }) }),
  rating: z
    .number({ invalid_type_error: "La calificación debe ser un número." })
    .int("Usa un número entero.")
    .min(1, "La calificación va de 1 a 5.")
    .max(5, "La calificación va de 1 a 5.")
    .nullish()
    .transform((v) => (v == null ? null : v)),
});

export const createVendorSchema = vendorBaseSchema;
export type VendorFormInput = z.input<typeof vendorBaseSchema>;
export type VendorData = z.output<typeof vendorBaseSchema>;

export const updateVendorSchema = vendorBaseSchema.extend({ id: z.string().min(1).max(64) });
export type UpdateVendorData = z.output<typeof updateVendorSchema>;

export const vendorIdSchema = z.object({ id: z.string().min(1).max(64) });

export const vendorFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(VENDOR_CATEGORIES).optional().catch(undefined),
  status: z.enum(VENDOR_STATUSES).optional().catch(undefined),
});
export type VendorFilters = z.output<typeof vendorFiltersSchema>;
