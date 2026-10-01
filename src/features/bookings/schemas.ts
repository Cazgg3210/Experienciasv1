/**
 * Esquemas Zod de administración de disponibilidad (reglas semanales y excepciones).
 */
import { z } from "zod";
import { isValidDateKey } from "@/lib/dates";

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:mm");

export const weeklyRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    maxEvents: z
      .number({ invalid_type_error: "Escribe un número" })
      .int("Número entero")
      .min(0, "Mínimo 0")
      .max(20, "Máximo 20"),
    earliestStart: time,
    latestEnd: time,
  })
  .superRefine((r, ctx) => {
    if (r.latestEnd <= r.earliestStart) {
      ctx.addIssue({ code: "custom", path: ["latestEnd"], message: "Debe ser posterior al inicio" });
    }
    if (r.isOpen && r.maxEvents < 1) {
      ctx.addIssue({ code: "custom", path: ["maxEvents"], message: "Un día abierto necesita al menos 1" });
    }
  });

export const weeklyRulesSchema = z.object({
  rules: z
    .array(weeklyRuleSchema)
    .length(7, "Deben capturarse los 7 días")
    .refine(
      (rules) => new Set(rules.map((r) => r.weekday)).size === 7,
      "Cada día debe aparecer una sola vez",
    ),
});
export type WeeklyRulesInput = z.infer<typeof weeklyRulesSchema>;

export const EXCEPTION_TYPES = ["BLOCKED", "BLACKOUT", "CAPACITY_OVERRIDE"] as const;

export const availabilityExceptionSchema = z
  .object({
    date: z
      .string()
      .trim()
      .refine((v) => isValidDateKey(v), "Elige una fecha válida"),
    type: z.enum(EXCEPTION_TYPES),
    maxEvents: z.number({ invalid_type_error: "Escribe un número" }).int().min(0).max(20).nullable(),
    reason: z.string().trim().max(200, "Máximo 200 caracteres"),
    serviceAreaId: z.string().trim().max(40),
  })
  .superRefine((v, ctx) => {
    if (v.type === "CAPACITY_OVERRIDE" && (v.maxEvents == null || Number.isNaN(v.maxEvents))) {
      ctx.addIssue({
        code: "custom",
        path: ["maxEvents"],
        message: "Indica cuántos eventos se permiten ese día",
      });
    }
  });
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>;

export const deleteExceptionSchema = z.object({ id: z.string().trim().min(1).max(40) });
