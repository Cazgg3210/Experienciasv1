import { z } from "zod";
import { FLAG_KEYS } from "./domain/flags-meta";

/**
 * Esquemas de formularios de /admin/settings (compartidos cliente/servidor).
 * Los valores se guardan con los esquemas de dominio (settings-schema.ts), que aplican defaults.
 */

const num = (msg = "Escribe un número") => z.number({ invalid_type_error: msg, required_error: msg });
const int = (msg = "Escribe un número entero") => num(msg).int(msg);

export const businessFormSchema = z.object({
  brandName: z.string().trim().min(1, "Escribe el nombre de la marca").max(80, "Máximo 80 caracteres"),
  tagline: z.string().trim().max(160, "Máximo 160 caracteres"),
  contactEmail: z.string().trim().toLowerCase().email("Escribe un correo válido").max(160),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Sólo números con lada, sin espacios (10 a 15 dígitos). Ej. 5215512345678"),
  instagramHandle: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9._]{0,30}$/, "Usuario de Instagram inválido (letras, números, punto y guion bajo)"),
  city: z.string().trim().min(2, "Escribe la ciudad").max(80, "Máximo 80 caracteres"),
  cancellationPolicy: z
    .string()
    .trim()
    .min(20, "Describe la política (mínimo 20 caracteres)")
    .max(2000, "Máximo 2,000 caracteres"),
  termsVersion: z
    .string()
    .trim()
    .min(1, "Escribe la versión de términos")
    .max(40, "Máximo 40 caracteres")
    .regex(/^[\w.-]+$/, "Usa letras, números, punto o guion (ej. 2026-09)"),
});
export type BusinessFormValues = z.infer<typeof businessFormSchema>;

export const pricingFormSchema = z
  .object({
    taxRatePercent: num().min(0, "No puede ser negativo").max(50, "Máximo 50%"),
    pricesIncludeTax: z.boolean(),
    depositPercent: num().min(0, "No puede ser negativo").max(100, "Máximo 100%"),
    quoteValidityDays: int().min(1, "Mínimo 1 día").max(60, "Máximo 60 días"),
    minMarginPercent: num().min(0, "No puede ser negativo").max(100, "Máximo 100%"),
    paymentFeePercent: num().min(0, "No puede ser negativo").max(20, "Máximo 20%"),
    paymentFeeFixedCents: int("Escribe un monto").min(0, "No puede ser negativo").max(1_000_000, "Monto demasiado alto"),
    balanceDueDaysBefore: int().min(0, "No puede ser negativo").max(60, "Máximo 60 días"),
    minStandardGuests: int().min(1, "Mínimo 1 invitada").max(100, "Máximo 100"),
    maxStandardGuests: int().min(1, "Mínimo 1 invitada").max(200, "Máximo 200"),
  })
  .refine((v) => v.maxStandardGuests >= v.minStandardGuests, {
    path: ["maxStandardGuests"],
    message: "Debe ser mayor o igual al mínimo",
  });
export type PricingFormInput = z.infer<typeof pricingFormSchema>;

export const availabilityFormSchema = z
  .object({
    bufferMinutes: int().min(0, "No puede ser negativo").max(600, "Máximo 600 minutos"),
    minLeadDays: int().min(0, "No puede ser negativo").max(90, "Máximo 90 días"),
    maxAdvanceDays: int().min(7, "Mínimo 7 días").max(730, "Máximo 730 días"),
    defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm (ej. 11:00)"),
  })
  .refine((v) => v.maxAdvanceDays > v.minLeadDays, {
    path: ["maxAdvanceDays"],
    message: "Debe ser mayor que la anticipación mínima",
  });
export type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;

export const notificationsFormSchema = z.object({
  rsvpReminderDaysBefore: int().min(1, "Mínimo 1 día").max(30, "Máximo 30 días"),
  quoteExpiringHoursBefore: int().min(1, "Mínimo 1 hora").max(240, "Máximo 240 horas"),
  ownerNotificationEmail: z.string().trim().toLowerCase().email("Escribe un correo válido").max(160),
});
export type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

export const flagToggleSchema = z.object({
  flag: z.enum(FLAG_KEYS),
  enabled: z.boolean(),
});

export const flagResetSchema = z.object({ flag: z.enum(FLAG_KEYS) });

export const emptySchema = z.object({}).default({});
