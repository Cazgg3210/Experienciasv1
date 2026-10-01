/**
 * Esquemas Zod del CRM de leads (compartidos por formularios cliente y Server Actions).
 * Son idempotentes (la salida vuelve a validar como entrada): el cliente valida con
 * zodResolver y el servidor vuelve a validar lo mismo.
 */
import { z } from "zod";
import { isValidDateKey } from "@/lib/dates";
import { LEAD_SOURCE_VALUES, LEAD_STATUS_VALUES } from "./domain/lead-filters";
import { LOGGABLE_ACTIVITY_TYPES } from "./domain/lead-workflow";

export const OCCASION_VALUES = [
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "CORPORATE",
  "OTHER",
] as const;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || (typeof value === "number" && Number.isNaN(value)) ? undefined : value;

const id = z.string().trim().min(1).max(64);
const optionalId = z.preprocess(emptyToUndefined, z.string().trim().max(64).optional());
const optionalText = (max: number, message = `Máximo ${max} caracteres`) => z.string().trim().max(max, message).optional();

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: `Escribe ${label} con números` })
      .int(`Escribe ${label} sin decimales`)
      .min(min, `Mínimo ${min}`)
      .max(max, `Máximo ${max}`)
      .optional(),
  );

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isValidDateKey(v), "Elige una fecha válida");

export function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

const optionalPhone = z
  .string()
  .trim()
  .max(30, "Teléfono demasiado largo")
  .optional()
  .refine((v) => {
    if (!v) return true;
    const d = phoneDigits(v);
    return /^[+\d\s().-]+$/.test(v) && d.length >= 10 && d.length <= 15;
  }, "Escribe un teléfono de 10 dígitos (puedes incluir lada +52)");

const optionalEmail = z
  .string()
  .trim()
  .max(160, "Correo demasiado largo")
  .optional()
  .refine((v) => !v || z.string().email().safeParse(v).success, "Escribe un correo válido");

export const leadStatusSchema = z.enum(LEAD_STATUS_VALUES);
export const leadSourceSchema = z.enum(LEAD_SOURCE_VALUES);
export const occasionSchema = z.enum(OCCASION_VALUES);

const leadFieldsBase = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(120, "Máximo 120 caracteres"),
  phone: optionalPhone,
  email: optionalEmail,
  occasion: occasionSchema,
  occasionOther: optionalText(120),
  eventDate: optionalDate,
  guestCount: optionalInt(1, 500, "las invitadas"),
  budgetRangeId: optionalId,
  serviceAreaId: optionalId,
  zoneText: optionalText(120),
  experienceId: optionalId,
  notes: optionalText(4000),
});

function requireContact(value: { phone?: string; email?: string }, ctx: z.RefinementCtx) {
  if (!value.phone && !value.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Agrega al menos un teléfono o un correo" });
  }
}

/** "Nuevo lead" (captura manual desde el panel). */
export const createLeadSchema = leadFieldsBase
  .extend({ source: leadSourceSchema.default("MANUAL") })
  .superRefine(requireContact);
export type CreateLeadInput = z.output<typeof createLeadSchema>;

/** Edición de datos del lead. */
export const updateLeadSchema = leadFieldsBase
  .extend({
    leadId: id,
    styleId: optionalId,
    menuId: optionalId,
    budgetNotes: optionalText(500),
    honoreeName: optionalText(120),
    /** Colores separados por coma */
    colors: optionalText(300),
    inspiration: optionalText(2000),
  })
  .superRefine(requireContact);
export type UpdateLeadInput = z.output<typeof updateLeadSchema>;

export const changeLeadStatusSchema = z
  .object({
    leadId: id,
    toStatus: leadStatusSchema,
    lostReason: optionalText(500),
    note: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if (value.toStatus === "LOST" && !value.lostReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lostReason"], message: "Cuéntanos por qué se perdió" });
    }
  });
export type ChangeLeadStatusInput = z.output<typeof changeLeadStatusSchema>;

export const assignLeadSchema = z.object({
  leadId: id,
  assigneeId: z.string().trim().max(64).nullable(),
});
export type AssignLeadInput = z.output<typeof assignLeadSchema>;

export const logLeadActivitySchema = z.object({
  leadId: id,
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  message: z.string().trim().min(2, "Escribe un breve resumen").max(2000, "Máximo 2000 caracteres"),
});
export type LogLeadActivityInput = z.output<typeof logLeadActivitySchema>;
