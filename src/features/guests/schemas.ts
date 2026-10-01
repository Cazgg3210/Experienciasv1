import { z } from "zod";

/** Token público (base64url) — misma regla que isPlausibleToken. */
export const publicTokenSchema = z
  .string({ required_error: "Enlace inválido." })
  .regex(/^[A-Za-z0-9_-]{20,128}$/, "Enlace inválido.");

export const micrositeSlugSchema = z
  .string({ required_error: "Enlace inválido." })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Enlace inválido.")
  .max(100, "Enlace inválido.");

export const DIETARY_VALUES = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "NUT_ALLERGY",
  "SEAFOOD_ALLERGY",
  "KOSHER",
  "HALAL",
  "OTHER",
] as const;

export const RSVP_ANSWERS = ["ATTENDING", "NOT_ATTENDING", "MAYBE"] as const;

/** Formulario de RSVP del micrositio (compartido cliente/servidor). */
export const rsvpFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Escribe tu nombre (mínimo 2 letras).")
      .max(80, "Máximo 80 caracteres."),
    email: z
      .string()
      .trim()
      .max(160, "Máximo 160 caracteres.")
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Escribe un email válido."),
    rsvpStatus: z.enum(RSVP_ANSWERS, {
      required_error: "Cuéntanos si podrás acompañarnos.",
      invalid_type_error: "Cuéntanos si podrás acompañarnos.",
    }),
    plusOne: z.boolean(),
    plusOneName: z.string().trim().max(80, "Máximo 80 caracteres."),
    dietaryRestrictions: z.array(z.enum(DIETARY_VALUES)).max(DIETARY_VALUES.length),
    dietaryNotes: z.string().trim().max(300, "Máximo 300 caracteres."),
    comment: z.string().trim().max(500, "Máximo 500 caracteres."),
    honoreeMessage: z.string().trim().max(600, "Máximo 600 caracteres."),
    photoConsent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // Con "No podré ir" la sección de restricciones se oculta: no exigir un campo invisible.
    if (v.rsvpStatus !== "NOT_ATTENDING" && v.dietaryRestrictions.includes("OTHER") && v.dietaryNotes.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dietaryNotes"],
        message: "Cuéntanos cuál es tu restricción.",
      });
    }
  });

export type RsvpFormValues = z.infer<typeof rsvpFormSchema>;

export const submitRsvpSchema = z.object({
  slug: micrositeSlugSchema,
  token: publicTokenSchema,
  rsvp: rsvpFormSchema,
});
export type SubmitRsvpInput = z.infer<typeof submitRsvpSchema>;

/** Alta de invitada desde el portal de la anfitriona. */
export const hostGuestFormSchema = z.object({
  name: z.string().trim().min(2, "Escribe su nombre (mínimo 2 letras).").max(80, "Máximo 80 caracteres."),
  contact: z.string().trim().max(160, "Máximo 160 caracteres."),
});
export type HostGuestFormValues = z.infer<typeof hostGuestFormSchema>;

export const addHostGuestSchema = hostGuestFormSchema.extend({ token: publicTokenSchema });
export type AddHostGuestInput = z.infer<typeof addHostGuestSchema>;

export const removeHostGuestSchema = z.object({
  token: publicTokenSchema,
  guestId: z.string().min(1).max(64),
});
export type RemoveHostGuestInput = z.infer<typeof removeHostGuestSchema>;
