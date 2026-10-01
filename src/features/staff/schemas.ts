/**
 * Esquemas Zod del módulo Staff (compartidos cliente/servidor).
 */
import { z } from "zod";

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

export const staffIdSchema = z
  .string()
  .trim()
  .min(1, "Falta el identificador.")
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const staffMemberSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre completo.").max(120, "Máximo 120 caracteres."),
  primaryFunction: z.enum(STAFF_FUNCTIONS, { errorMap: () => ({ message: "Elige una función." }) }),
  phone: z
    .string()
    .trim()
    .max(25, "Teléfono demasiado largo.")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^[+\d\s()-]+$/.test(v) && v.replace(/\D/g, "").length >= 10), {
      message: "Escribe un teléfono de 10 dígitos.",
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, { message: "Correo inválido." }),
  rateCents: z
    .number({ invalid_type_error: "Indica la tarifa.", required_error: "Indica la tarifa." })
    .int("Monto inválido.")
    .min(0, "La tarifa no puede ser negativa.")
    .max(10_000_000, "Tarifa demasiado alta."),
  rateType: z.enum(["PER_EVENT", "PER_HOUR"]),
  availableWeekdays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  availabilityNotes: optionalText(500),
  active: z.boolean().default(true),
});
export type StaffMemberFormValues = z.input<typeof staffMemberSchema>;

export const updateStaffMemberSchema = staffMemberSchema.extend({ id: staffIdSchema });

export const passwordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres.")
  .max(72, "Máximo 72 caracteres.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { message: "Combina letras y números." });

export const createAccessSchema = z.object({
  staffMemberId: staffIdSchema,
  email: z.string().trim().toLowerCase().email("Correo inválido.").max(160),
  password: passwordSchema,
});
export type CreateAccessValues = z.input<typeof createAccessSchema>;

export const resetPasswordSchema = z.object({
  staffMemberId: staffIdSchema,
  password: passwordSchema,
});
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;

export const accessActiveSchema = z.object({
  staffMemberId: staffIdSchema,
  active: z.boolean(),
});

export const deleteStaffSchema = z.object({ id: staffIdSchema });
