import { z } from "zod";

/**
 * Configuración de negocio editable desde /admin/settings.
 * Se persiste en la tabla Setting (una fila por sección: key = nombre de la sección).
 * Todos los campos tienen default para que el sistema funcione sin configuración previa.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm");

export const businessSettingsSchema = z.object({
  brandName: z.string().min(1).default("Ivonne & Rosa"),
  tagline: z.string().default("Tú reúne a las tuyas. Nosotras hacemos el resto."),
  contactEmail: z.string().email().default("hola@ivonne-rosa.test"),
  whatsappNumber: z.string().regex(/^\d{10,15}$/).default("5215512345678"),
  instagramHandle: z.string().default("ivonneyrosa"),
  city: z.string().default("Ciudad de México"),
  cancellationPolicy: z
    .string()
    .default(
      "El anticipo confirma tu fecha. Cancelaciones con 15+ días de anticipación: reembolso del 50% del anticipo. Con menos de 15 días el anticipo no es reembolsable; puedes reprogramar una vez sin costo sujeto a disponibilidad.",
    ),
  termsVersion: z.string().default("2026-09"),
});

export const pricingSettingsSchema = z.object({
  taxRateBps: z.number().int().min(0).max(5000).default(1600),
  pricesIncludeTax: z.boolean().default(true),
  depositBps: z.number().int().min(0).max(10000).default(5000),
  quoteValidityDays: z.number().int().min(1).max(60).default(7),
  minMarginBps: z.number().int().min(0).max(10000).default(3500),
  paymentFeeBps: z.number().int().min(0).max(2000).default(360),
  paymentFeeFixedCents: z.number().int().min(0).default(300),
  balanceDueDaysBefore: z.number().int().min(0).max(60).default(3),
  minStandardGuests: z.number().int().min(1).default(6),
  maxStandardGuests: z.number().int().min(1).default(12),
});

export const availabilitySettingsSchema = z.object({
  bufferMinutes: z.number().int().min(0).max(600).default(90),
  minLeadDays: z.number().int().min(0).max(90).default(5),
  maxAdvanceDays: z.number().int().min(7).max(730).default(365),
  defaultStartTime: hhmm.default("11:00"),
});

export const notificationSettingsSchema = z.object({
  rsvpReminderDaysBefore: z.number().int().min(1).max(30).default(5),
  quoteExpiringHoursBefore: z.number().int().min(1).max(240).default(48),
  ownerNotificationEmail: z.string().email().default("equipo@ivonne-rosa.test"),
});

export const flagSettingsSchema = z.object({
  AI_DESIGNER_ENABLED: z.boolean().optional(),
  PAYMENTS_ENABLED: z.boolean().optional(),
  WHATSAPP_ENABLED: z.boolean().optional(),
  MEMORY_CAPSULE_ENABLED: z.boolean().optional(),
});

export const settingsSchemas = {
  business: businessSettingsSchema,
  pricing: pricingSettingsSchema,
  availability: availabilitySettingsSchema,
  notifications: notificationSettingsSchema,
  flags: flagSettingsSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type SettingsMap = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };
export type BusinessSettings = SettingsMap["business"];
export type PricingSettings = SettingsMap["pricing"];
export type AvailabilitySettings = SettingsMap["availability"];
export type NotificationSettings = SettingsMap["notifications"];
export type FlagSettings = SettingsMap["flags"];

export function defaultSettings<K extends SettingsKey>(key: K): SettingsMap[K] {
  return settingsSchemas[key].parse({}) as SettingsMap[K];
}
