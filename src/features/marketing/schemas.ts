import { z } from "zod";
import type { Occasion } from "@prisma/client";
import { OCCASION_LABELS } from "@/lib/labels";
import { isValidDateKey, localDateKey } from "@/lib/dates";
import { CLIENT_TRACKABLE_TYPES, SESSION_ID_RE } from "./domain/analytics";

/** Esquemas Zod compartidos cliente/servidor del sitio público. */

const OCCASION_VALUES = Object.keys(OCCASION_LABELS) as [Occasion, ...Occasion[]];

const digitsOf = (v: string) => v.replace(/\D/g, "");

export const contactFormSchema = z.object({
  name: z
    .string({ required_error: "Escribe tu nombre" })
    .trim()
    .min(2, "Escribe tu nombre")
    .max(120, "Máximo 120 caracteres"),
  phone: z
    .string({ required_error: "Escribe tu WhatsApp o teléfono" })
    .trim()
    .min(1, "Escribe tu WhatsApp o teléfono")
    .max(25, "Número demasiado largo")
    .refine((v) => /^[\d\s()+.-]+$/.test(v), "Usa sólo números (puedes incluir +, espacios o guiones)")
    .refine((v) => {
      const n = digitsOf(v).length;
      return n >= 10 && n <= 15;
    }, "Escribe un número de 10 dígitos (con lada)"),
  email: z
    .string({ required_error: "Escribe tu correo" })
    .trim()
    .toLowerCase()
    .min(1, "Escribe tu correo")
    .max(160, "Correo demasiado largo")
    .email("Revisa tu correo"),
  occasion: z.enum(OCCASION_VALUES, {
    errorMap: () => ({ message: "Elige qué quieres celebrar" }),
  }),
  eventDate: z
    .string()
    .trim()
    .max(10)
    .optional()
    .refine((v) => !v || isValidDateKey(v), "Fecha inválida")
    .refine((v) => !v || !isValidDateKey(v) || v >= localDateKey(), "Elige una fecha a partir de hoy"),
  message: z
    .string({ required_error: "Cuéntanos qué tienes en mente" })
    .trim()
    .min(10, "Cuéntanos un poco más (mínimo 10 caracteres)")
    .max(2000, "Máximo 2,000 caracteres"),
  consent: z.boolean().refine((v) => v === true, "Necesitamos tu autorización para contactarte"),
  /** Honeypot anti-bots: debe llegar vacío (campo oculto para personas). */
  website: z.string().max(500).optional(),
  /** Id anónimo de sesión del navegador (analítica). */
  sessionId: z.string().regex(SESSION_ID_RE).optional(),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;
export type ContactFormInput = z.output<typeof contactFormSchema>;

export const trackEventSchema = z
  .object({
    type: z.enum(CLIENT_TRACKABLE_TYPES),
    experienceId: z
      .string()
      .regex(/^[a-z0-9]{8,40}$/i, "Id inválido")
      .optional()
      .nullable(),
    path: z.string().max(2048).optional().nullable(),
    sessionId: z.string().regex(SESSION_ID_RE).optional().nullable(),
    metadata: z
      .record(z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()]))
      .refine((m) => Object.keys(m).length <= 12, "Demasiados campos")
      .optional(),
  })
  .strict();

export type TrackEventInput = z.output<typeof trackEventSchema>;
