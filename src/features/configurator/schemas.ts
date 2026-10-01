/**
 * Esquemas Zod del configurador, compartidos entre cliente (RHF) y servidor (Server Actions).
 * Los precios NUNCA vienen del cliente: el servidor recalcula siempre el estimado.
 */
import { z } from "zod";
import { normalizeMxPhone10 } from "./domain/wizard";

export const CONFIGURATOR_OCCASIONS = [
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "OTHER",
] as const;
export type ConfiguratorOccasion = (typeof CONFIGURATOR_OCCASIONS)[number];

export const GUESTS_MIN = 2;
export const GUESTS_MAX = 40;
export const GUESTS_DEFAULT = 8;
export const START_TIME_MIN = "08:00";
export const START_TIME_MAX = "18:00";
export const MAX_COLORS = 8;

const id = z.string().trim().min(1, "Selecciona una opción.").max(64);
/** YYYY-MM-DD que existe en el calendario (rechaza 2026-02-31, 2026-13-01…). */
export function isRealDateKey(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    y >= 2000 && y <= 2100 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}
const dateKey = z.string().refine(isRealDateKey, "Elige una fecha válida.");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige un horario válido.");

export const addOnSelectionSchema = z.object({
  addOnId: id,
  quantity: z.number().int().min(1).max(20),
});
export type AddOnSelection = z.infer<typeof addOnSelectionSchema>;

/** Selección mínima para estimar precio (servidor). */
export const estimateSelectionSchema = z.object({
  experienceId: id,
  guestCount: z.number().int().min(GUESTS_MIN).max(GUESTS_MAX),
  menuId: id.nullish(),
  addOns: z.array(addOnSelectionSchema).max(30).default([]),
  serviceAreaId: id.nullish(),
});
export type EstimateSelectionInput = z.input<typeof estimateSelectionSchema>;

export const availabilityQuerySchema = z.object({
  from: dateKey,
  days: z.number().int().min(1).max(62),
  serviceAreaId: id.nullish(),
});
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

export const TRACKABLE_EVENTS = ["START_CONFIGURATOR", "COMPLETE_CONFIGURATOR"] as const;
export const trackConfiguratorSchema = z.object({
  type: z.enum(TRACKABLE_EVENTS),
  sessionId: z.string().trim().min(8).max(64),
});

const toMinutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

/** Respuestas del wizard (pasos 1–10). Objeto base sin refinamientos para poder combinarlo. */
export const selectionsObject = z.object({
  occasion: z.enum(CONFIGURATOR_OCCASIONS, { errorMap: () => ({ message: "Elige qué celebramos." }) }),
  occasionOther: z.string().trim().max(80, "Máximo 80 caracteres.").optional().default(""),
  eventDate: dateKey,
  startTime: hhmm.refine(
    (v) => toMinutes(v) >= toMinutes(START_TIME_MIN) && toMinutes(v) <= toMinutes(START_TIME_MAX),
    `Elige un horario entre ${START_TIME_MIN} y ${START_TIME_MAX}.`,
  ),
  serviceAreaId: id.nullish(),
  zoneText: z.string().trim().max(120, "Máximo 120 caracteres.").nullish(),
  guestCount: z
    .number({ invalid_type_error: "Indica cuántas personas serán." })
    .int()
    .min(GUESTS_MIN, `Mínimo ${GUESTS_MIN} personas.`)
    .max(GUESTS_MAX, `Para más de ${GUESTS_MAX} personas escríbenos por WhatsApp.`),
  /** Opcional sólo si el catálogo no tiene estilos activos (el servidor lo exige si los hay). */
  styleId: id.nullish(),
  experienceId: id,
  menuId: id.nullish(),
  addOns: z.array(addOnSelectionSchema).max(30).default([]),
  colors: z
    .array(z.string().trim().min(1).max(30))
    .max(MAX_COLORS, `Máximo ${MAX_COLORS} colores.`)
    .default([]),
  honoreeName: z.string().trim().max(80, "Máximo 80 caracteres.").optional().default(""),
  notes: z.string().trim().max(1000, "Máximo 1,000 caracteres.").optional().default(""),
  inspiration: z.string().trim().max(500, "Máximo 500 caracteres.").optional().default(""),
  budgetRangeId: id.nullish(),
  budgetUndecided: z.boolean().optional().default(false),
});

type SelectionsShape = z.output<typeof selectionsObject>;

function refineSelections(
  v: Pick<
    SelectionsShape,
    "occasion" | "occasionOther" | "serviceAreaId" | "zoneText" | "budgetRangeId" | "budgetUndecided"
  >,
  ctx: z.RefinementCtx,
) {
  if (v.occasion === "OTHER" && (v.occasionOther ?? "").trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["occasionOther"],
      message: "Cuéntanos qué celebramos.",
    });
  }
  if (!v.serviceAreaId && (v.zoneText ?? "").trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["zoneText"],
      message: "Elige una zona o escribe tu colonia.",
    });
  }
  if (!v.budgetRangeId && !v.budgetUndecided) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["budgetRangeId"],
      message: "Elige un rango de presupuesto o “Prefiero platicarlo”.",
    });
  }
}

export const configuratorSelectionsSchema = selectionsObject.superRefine(refineSelections);
export type ConfiguratorSelections = z.output<typeof configuratorSelectionsSchema>;

/** Datos de contacto del paso final (formulario RHF). */
export const contactObject = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80, "Máximo 80 caracteres."),
  phone: z
    .string()
    .trim()
    .min(1, "Escribe tu WhatsApp o teléfono.")
    .refine((v) => normalizeMxPhone10(v) !== null, "Escribe un número de 10 dígitos (ej. 55 1234 5678)."),
  email: z.union([z.literal(""), z.string().trim().max(120).email("Revisa tu correo electrónico.")]),
  consent: z.boolean().refine((v) => v === true, "Necesitamos tu autorización para contactarte."),
  marketingOptIn: z.boolean(),
});
export const contactSchema = contactObject;
export type ContactInput = z.infer<typeof contactSchema>;

/** Id de envío generado en el navegador: hace idempotente el envío (reintentos tras un corte de red). */
export const SUBMISSION_ID_PATTERN = /^[\w-]{16,64}$/;

/**
 * Envío final. `estimatedTotalCents` se acepta sólo para ignorarlo explícitamente:
 * el total que se guarda siempre se recalcula en servidor.
 */
export const submitConfiguratorSchema = selectionsObject
  .merge(contactObject)
  .extend({
    submissionId: z.string().trim().regex(SUBMISSION_ID_PATTERN, "Envío inválido.").nullish(),
    sessionId: z.string().trim().max(64).nullish(),
    utmSource: z.string().trim().max(60).nullish(),
    referredByCode: z.string().trim().max(40).nullish(),
    estimatedTotalCents: z.number().int().nullish(),
  })
  .superRefine(refineSelections);
export type SubmitConfiguratorInput = z.input<typeof submitConfiguratorSchema>;
export type SubmitConfiguratorData = z.output<typeof submitConfiguratorSchema>;
