import { z } from "zod";
import { publicTokenSchema } from "@/features/guests/schemas";

export { publicTokenSchema };

const optionalUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres.")
    .refine((v) => {
      if (v === "") return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, message);

/** "Entra a tu evento": solicitud del enlace por email. */
export const portalAccessFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Escribe tu correo.")
    .max(160, "Máximo 160 caracteres.")
    .email("Escribe un correo válido."),
});
export type PortalAccessFormValues = z.infer<typeof portalAccessFormSchema>;

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const MAX_COLORS = 6;

/** Preferencias editables por la anfitriona. */
export const preferencesFormSchema = z.object({
  colors: z
    .array(z.string().regex(HEX_COLOR, "Color inválido."))
    .max(MAX_COLORS, `Elige hasta ${MAX_COLORS} colores.`),
  honoreeName: z.string().trim().max(80, "Máximo 80 caracteres."),
  dressCode: z.string().trim().max(160, "Máximo 160 caracteres."),
  hostMessage: z.string().trim().max(600, "Máximo 600 caracteres."),
  customerNotes: z.string().trim().max(1500, "Máximo 1,500 caracteres."),
  playlistUrl: optionalUrl("Pega un enlace válido (Spotify, Apple Music, YouTube…)."),
});
export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;
export const updatePreferencesSchema = preferencesFormSchema.extend({ token: publicTokenSchema });
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

/** Detalles de la dirección (editable hasta 48 h antes). */
export const addressFormSchema = z.object({
  addressLine: z.string().trim().min(5, "Escribe calle y número.").max(200, "Máximo 200 caracteres."),
  neighborhood: z.string().trim().min(2, "Escribe la colonia.").max(120, "Máximo 120 caracteres."),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}$/.test(v), "El código postal tiene 5 dígitos."),
  addressNotes: z.string().trim().max(600, "Máximo 600 caracteres."),
  mapsUrl: optionalUrl("Pega un enlace válido de Google Maps o Apple Maps."),
});
export type AddressFormValues = z.infer<typeof addressFormSchema>;
export const updateAddressSchema = addressFormSchema.extend({ token: publicTokenSchema });
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

/** Chat de la anfitriona con el equipo. */
export const hostMessageFormSchema = z.object({
  body: z.string().trim().min(1, "Escribe tu mensaje.").max(2000, "Máximo 2,000 caracteres."),
});
export type HostMessageFormValues = z.infer<typeof hostMessageFormSchema>;
export const sendHostMessageSchema = hostMessageFormSchema.extend({ token: publicTokenSchema });

/** Opinión posterior al evento. */
export const reviewFormSchema = z.object({
  rating: z
    .number({ required_error: "Elige de 1 a 5 estrellas.", invalid_type_error: "Elige de 1 a 5 estrellas." })
    .int()
    .min(1, "Elige de 1 a 5 estrellas.")
    .max(5, "Elige de 1 a 5 estrellas."),
  npsScore: z
    .number({ invalid_type_error: "Elige un número del 0 al 10." })
    .int()
    .min(0, "Elige un número del 0 al 10.")
    .max(10, "Elige un número del 0 al 10.")
    .nullable(),
  comment: z.string().trim().max(2000, "Máximo 2,000 caracteres."),
  publishable: z.boolean(),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
export const submitReviewSchema = reviewFormSchema.extend({ token: publicTokenSchema });
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
