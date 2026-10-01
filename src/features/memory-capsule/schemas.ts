import { z } from "zod";
import {
  CAPSULE_MESSAGE_MAX,
  CAPSULE_TITLE_MAX,
  GUEST_NAME_MAX,
  GUESTBOOK_BODY_MAX,
} from "./domain/capsule";

/** Esquemas Zod compartidos cliente/servidor del módulo Memory Capsule. */

const id = z.string().min(1, "Falta el identificador.").max(40);
const token = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, "Enlace inválido.");

const title = z
  .string()
  .trim()
  .min(3, "Escribe un título de al menos 3 caracteres.")
  .max(CAPSULE_TITLE_MAX, `Máximo ${CAPSULE_TITLE_MAX} caracteres.`);

const message = z
  .string()
  .trim()
  .max(CAPSULE_MESSAGE_MAX, `Máximo ${CAPSULE_MESSAGE_MAX} caracteres.`)
  .optional()
  .or(z.literal(""));

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const createCapsuleSchema = z.object({
  eventId: id,
  title,
  message,
});
export type CreateCapsuleInput = z.input<typeof createCapsuleSchema>;

export const updateCapsuleSchema = z.object({
  capsuleId: id,
  title,
  message,
  published: z.boolean(),
  allowGuestUploads: z.boolean(),
});
export type UpdateCapsuleInput = z.input<typeof updateCapsuleSchema>;

export const capsuleIdSchema = z.object({ capsuleId: id });

export const setMediaApprovalSchema = z.object({
  capsuleId: id,
  mediaId: id,
  approved: z.boolean(),
});

export const setCoverSchema = z.object({
  capsuleId: id,
  mediaId: id.nullable(),
});

export const deleteCapsuleMediaSchema = z.object({
  capsuleId: id,
  mediaId: id,
});

export const setMessageHiddenSchema = z.object({
  eventId: id,
  messageId: id,
  hidden: z.boolean(),
});

// ---------------------------------------------------------------------------
// Público (por token)
// ---------------------------------------------------------------------------

export const guestNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe tu nombre.")
  .max(GUEST_NAME_MAX, `Máximo ${GUEST_NAME_MAX} caracteres.`);

export const guestbookFormSchema = z.object({
  name: guestNameSchema,
  body: z
    .string()
    .trim()
    .min(2, "Escribe un mensaje.")
    .max(GUESTBOOK_BODY_MAX, `Máximo ${GUESTBOOK_BODY_MAX} caracteres.`),
});
export type GuestbookFormValues = z.input<typeof guestbookFormSchema>;

export const guestbookActionSchema = guestbookFormSchema.extend({ token });

/** Campos (multipart) de la subida pública de fotos. `consent` debe ser exactamente "true". */
export const guestUploadFieldsSchema = z.object({
  name: guestNameSchema,
  consent: z.literal("true", {
    errorMap: () => ({ message: "Confirma que tienes permiso de compartir la foto." }),
  }),
});

/** Formulario del cliente (antes de subir el archivo). */
export const guestUploadFormSchema = z.object({
  name: guestNameSchema,
  consent: z.boolean().refine((v) => v === true, "Confirma que tienes permiso de compartir la foto."),
});
export type GuestUploadFormValues = z.input<typeof guestUploadFormSchema>;
