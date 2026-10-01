import { z } from "zod";
import {
  DIETARY_VALUES,
  MAX_COLORS,
  MAX_GUESTS,
  MAX_VIBES,
  MIN_GUESTS,
  OCCASION_VALUES,
  VIBE_VALUES,
} from "./constants";

/**
 * Esquemas Zod compartidos cliente/servidor del AI Experience Designer.
 * (El esquema de la salida del LLM vive en domain/llm.ts: nunca llega al cliente.)
 */

/** Hoy (YYYY-MM-DD) en la zona del negocio; igual en navegador y servidor. */
export function todayInBusinessTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
}

/** "YYYY-MM-DD" que existe en el calendario (rechaza 2026-02-30) y no está absurdamente lejos. */
function isCalendarDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    y >= 2000 &&
    y <= 2100 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido");

export const designerInputSchema = z
  .object({
    occasion: z.enum(OCCASION_VALUES, { errorMap: () => ({ message: "Elige qué vamos a celebrar." }) }),
    occasionOther: z.string().trim().max(80, "Máximo 80 caracteres.").optional(),
    profile: z
      .string({ required_error: "Cuéntanos un poquito de ella o del grupo." })
      .trim()
      .min(3, "Cuéntanos un poquito de ella o del grupo.")
      .max(240, "Máximo 240 caracteres."),
    honoreeAge: z
      .number({ invalid_type_error: "Escribe la edad en números." })
      .int("Escribe la edad en números.")
      .min(1, "Edad inválida.")
      .max(110, "Edad inválida.")
      .nullable()
      .optional(),
    guestCount: z
      .number({ invalid_type_error: "¿Cuántas personas serán?", required_error: "¿Cuántas personas serán?" })
      .int("Usa un número entero.")
      .min(MIN_GUESTS, `Diseñamos para mínimo ${MIN_GUESTS} personas.`)
      .max(MAX_GUESTS, `Para más de ${MAX_GUESTS} personas escríbenos directamente.`),
    budgetRangeId: z
      .string({ required_error: "Elige un rango de presupuesto (o «Aún no lo sé»)." })
      .min(1, "Elige un rango de presupuesto (o «Aún no lo sé»).")
      .max(64),
    tastes: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
    colors: z.array(hexColor).max(MAX_COLORS, `Elige hasta ${MAX_COLORS} colores.`),
    vibes: z
      .array(z.enum(VIBE_VALUES))
      .min(1, "Elige al menos una vibra.")
      .max(MAX_VIBES, `Elige hasta ${MAX_VIBES} vibras.`),
    serviceArea: z.string({ required_error: "Elige la zona." }).min(1, "Elige la zona.").max(64),
    zoneText: z.string().trim().max(120, "Máximo 120 caracteres.").optional(),
    dietary: z.array(z.enum(DIETARY_VALUES)).max(DIETARY_VALUES.length),
  })
  .superRefine((v, ctx) => {
    if (v.occasion === "OTHER" && !v.occasionOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["occasionOther"], message: "Cuéntanos qué celebran." });
    }
  });

export type DesignerInput = z.output<typeof designerInputSchema>;
export type DesignerFormValues = z.input<typeof designerInputSchema>;

const phoneSchema = z
  .string({ required_error: "Tu WhatsApp es necesario para contactarte." })
  .trim()
  .min(1, "Tu WhatsApp es necesario para contactarte.")
  .max(24, "Revisa tu número.")
  .refine((v) => /^[\d\s()+-]+$/.test(v), "Usa sólo números.")
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }, "Escribe tu WhatsApp a 10 dígitos.");

export const convertDesignSchema = z.object({
  designId: z
    .string()
    .min(10)
    .max(40)
    .regex(/^[a-z0-9]+$/i, "Diseño inválido"),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80, "Máximo 80 caracteres."),
  phone: phoneSchema,
  email: z
    .union([z.literal(""), z.string().trim().toLowerCase().email("Revisa tu email.").max(120)])
    .optional(),
  eventDate: z
    .union([
      z.literal(""),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
        .refine(isCalendarDate, "Fecha inválida.")
        // Aviso inmediato en el cliente (sin gastar un intento del rate limit); el servicio lo vuelve a validar.
        .refine((v) => v >= todayInBusinessTz(), "Elige una fecha a partir de hoy."),
    ])
    .optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Necesitamos tu autorización para contactarte." }),
  }),
  marketingOptIn: z.boolean().optional(),
});

export type ConvertDesignInput = z.output<typeof convertDesignSchema>;
export type ConvertDesignFormValues = z.input<typeof convertDesignSchema>;
