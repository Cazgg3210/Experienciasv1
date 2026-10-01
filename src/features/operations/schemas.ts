/**
 * Esquemas Zod del módulo Operaciones (compartidos cliente/servidor).
 */
import { z } from "zod";

const CHECKLIST_PHASES = ["T_MINUS_7", "T_MINUS_3", "T_MINUS_1", "SETUP", "EVENT", "TEARDOWN", "CLOSING"] as const;
const CHECKLIST_AREAS = ["FOOD", "TABLE", "FLOWERS", "ADDONS", "TRANSPORT", "STAFF", "CLIENT", "ADMIN", "GENERAL"] as const;
const CHECKLIST_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"] as const;
const STAFF_FUNCTIONS = [
  "COORDINATOR",
  "CHEF",
  "KITCHEN_ASSISTANT",
  "SERVER",
  "SETUP",
  "DRIVER",
  "HOST",
  "PHOTOGRAPHER",
  "OTHER",
] as const;

export const checklistPhaseSchema = z.enum(CHECKLIST_PHASES);
export const checklistAreaSchema = z.enum(CHECKLIST_AREAS);
export const checklistStatusSchema = z.enum(CHECKLIST_STATUSES);
export const staffFunctionSchema = z.enum(STAFF_FUNCTIONS);

/** IDs de Prisma (cuid u otros ids estables del seed). */
export const idSchema = z
  .string()
  .trim()
  .min(1, "Falta el identificador.")
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido.");

/** Valor de <input type="datetime-local"> en hora de CDMX. */
export const localDateTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indica fecha y hora.");

const optionalLocalDateTime = z
  .union([localDateTimeSchema, z.literal("")])
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/**
 * Texto opcional para PARCHES: ausente → undefined (sin cambios); "" o null → null (borrar).
 * A diferencia de `optionalText`, un campo ausente NO se convierte en null: así cambiar el
 * estado, el responsable o la evidencia de una tarea no borra sus notas.
 */
const patchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null));

// -----------------------------------------------------------------------------
// Checklist del evento
// -----------------------------------------------------------------------------

export const instantiateChecklistSchema = z.object({ eventId: idSchema });

export const updateChecklistItemSchema = z.object({
  id: idSchema,
  status: checklistStatusSchema.optional(),
  /** null = sin asignar */
  assigneeId: idSchema.nullable().optional(),
  /** ausente = sin cambios; "" o null = borrar */
  notes: patchText(2000),
  /** null = quitar evidencia */
  evidenceMediaId: idSchema.nullable().optional(),
  dueAt: z.union([localDateTimeSchema, z.literal("")]).optional(),
});
export type UpdateChecklistItemInput = z.input<typeof updateChecklistItemSchema>;

/** Lo que el staff puede cambiar desde su portal. */
export const staffChecklistUpdateSchema = z.object({
  id: idSchema,
  status: checklistStatusSchema.optional(),
  /** ausente = sin cambios; "" o null = borrar */
  notes: patchText(2000),
  evidenceMediaId: idSchema.nullable().optional(),
});
export type StaffChecklistUpdateInput = z.input<typeof staffChecklistUpdateSchema>;

export const createChecklistItemSchema = z.object({
  eventId: idSchema,
  phase: checklistPhaseSchema,
  area: checklistAreaSchema,
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 caracteres).").max(160, "Máximo 160 caracteres."),
  description: optionalText(1000),
  dueAt: optionalLocalDateTime,
  assigneeId: z
    .union([idSchema, z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  requiresEvidence: z.boolean().default(false),
});
export type CreateChecklistItemInput = z.input<typeof createChecklistItemSchema>;

export const deleteByIdSchema = z.object({ id: idSchema });

// -----------------------------------------------------------------------------
// Logística y add-ons
// -----------------------------------------------------------------------------

export const logisticsSchema = z
  .object({
    eventId: idSchema,
    departureAt: optionalLocalDateTime,
    setupStartsAt: optionalLocalDateTime,
    teardownAt: optionalLocalDateTime,
  })
  .superRefine((v, ctx) => {
    if (v.departureAt && v.setupStartsAt && v.departureAt > v.setupStartsAt) {
      ctx.addIssue({ code: "custom", path: ["setupStartsAt"], message: "El montaje debe empezar después de la salida." });
    }
  });
export type LogisticsInput = z.input<typeof logisticsSchema>;

export const addOnNotesSchema = z.object({
  id: idSchema,
  notes: optionalText(1000),
});

// -----------------------------------------------------------------------------
// Asignaciones de staff
// -----------------------------------------------------------------------------

const assignmentBase = z.object({
  staffMemberId: z
    .string()
    .trim()
    .min(1, "Elige a alguien del equipo.")
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Integrante inválido."),
  function: staffFunctionSchema,
  startsAt: localDateTimeSchema,
  endsAt: localDateTimeSchema,
  /** null/undefined = calcular con la tarifa del integrante */
  amountCents: z.number().int("Monto inválido.").min(0, "El monto no puede ser negativo.").max(10_000_000).nullable().optional(),
  confirmed: z.boolean().default(false),
  paid: z.boolean().default(false),
  notes: optionalText(1000),
});

const endAfterStart = (v: { startsAt: string; endsAt: string }, ctx: z.RefinementCtx) => {
  if (v.endsAt <= v.startsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "La hora de salida debe ser posterior a la de entrada." });
  }
};

export const createAssignmentSchema = assignmentBase.extend({ eventId: idSchema }).superRefine(endAfterStart);
export type CreateAssignmentInput = z.input<typeof createAssignmentSchema>;

export const updateAssignmentSchema = assignmentBase.extend({ id: idSchema }).superRefine(endAfterStart);
export type UpdateAssignmentInput = z.input<typeof updateAssignmentSchema>;

/** Formulario (cliente): mismo shape; eventId/id se agregan al enviar. */
export const assignmentFormSchema = assignmentBase.superRefine(endAfterStart);
export type AssignmentFormValues = z.input<typeof assignmentFormSchema>;

export const assignmentFlagsSchema = z.object({
  id: idSchema,
  confirmed: z.boolean().optional(),
  paid: z.boolean().optional(),
});

// -----------------------------------------------------------------------------
// Plantillas
// -----------------------------------------------------------------------------

export const templateSchema = z.object({
  name: z.string().trim().min(3, "Escribe un nombre (mínimo 3 caracteres).").max(120, "Máximo 120 caracteres."),
  phase: checklistPhaseSchema,
  description: optionalText(500),
  experienceId: z
    .union([idSchema, z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  active: z.boolean().default(true),
  sortOrder: z
    .number({ invalid_type_error: "Indica un número." })
    .int("Usa números enteros.")
    .min(0, "Mínimo 0.")
    .max(9999, "Máximo 9999.")
    .default(0),
});
export type TemplateFormValues = z.input<typeof templateSchema>;

export const updateTemplateSchema = templateSchema.extend({ id: idSchema });

export const offsetUnitSchema = z.enum(["days", "hours", "minutes"]);
export const offsetDirectionSchema = z.enum(["before", "after"]);

export const templateItemSchema = z.object({
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 caracteres).").max(160, "Máximo 160 caracteres."),
  description: optionalText(1000),
  area: checklistAreaSchema,
  offsetAmount: z
    .number({ invalid_type_error: "Indica un número." })
    .int("Usa números enteros.")
    .min(0, "Mínimo 0.")
    .max(10_000, "Valor demasiado grande."),
  offsetUnit: offsetUnitSchema,
  offsetDirection: offsetDirectionSchema,
  defaultFunction: z
    .union([staffFunctionSchema, z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  requiresEvidence: z.boolean().default(false),
  sortOrder: z
    .number({ invalid_type_error: "Indica un número." })
    .int("Usa números enteros.")
    .min(0, "Mínimo 0.")
    .max(9999, "Máximo 9999.")
    .default(0),
});
export type TemplateItemFormValues = z.input<typeof templateItemSchema>;

export const createTemplateItemSchema = templateItemSchema.extend({ templateId: idSchema });
export const updateTemplateItemSchema = templateItemSchema.extend({ id: idSchema });
