/**
 * Esquemas Zod compartidos cliente/servidor del módulo Eventos (admin) e invitadas (admin).
 * Los textos opcionales aceptan "" (formularios) y el servicio los normaliza a null.
 */
import { z } from "zod";
import { isValidDateKey } from "@/lib/dates";
import { TIME_RE } from "./domain/event-schedule";

const OCCASIONS = [
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "CORPORATE",
  "OTHER",
] as const;

const EVENT_STATUS_VALUES = [
  "INQUIRY",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PLANNING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const RSVP_VALUES = ["PENDING", "ATTENDING", "NOT_ATTENDING", "MAYBE"] as const;

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

const id = z.string().trim().min(1, "Requerido").max(40);
const optionalId = z.string().trim().max(40);
const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const dateKey = z
  .string()
  .trim()
  .refine((v) => isValidDateKey(v), "Elige una fecha válida");
const time = z.string().trim().regex(TIME_RE, "Usa el formato HH:mm");
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Escribe un enlace válido (https://…)");
const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Correo inválido");
const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Teléfono de al menos 10 dígitos");
const postalCode = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{5}$/.test(v), "Código postal de 5 dígitos");
const guestCount = z
  .number({ invalid_type_error: "Escribe un número" })
  .int("Número entero")
  .min(1, "Al menos 1 invitada")
  .max(200, "Máximo 200 invitadas");

// -----------------------------------------------------------------------------
// Alta manual de evento
// -----------------------------------------------------------------------------
export const createEventSchema = z
  .object({
    customerMode: z.enum(["existing", "new"]),
    customerId: optionalId,
    newCustomer: z.object({
      name: text(120),
      email: optionalEmail,
      phone: optionalPhone,
    }),
    title: text(120).min(3, "Escribe un título (mín. 3 caracteres)"),
    occasion: z.enum(OCCASIONS),
    honoreeName: text(80),
    date: dateKey,
    startTime: time,
    durationMinutes: z
      .number({ invalid_type_error: "Escribe la duración" })
      .int()
      .min(30, "Mínimo 30 minutos")
      .max(720, "Máximo 12 horas"),
    experienceId: optionalId,
    guestCount,
    serviceAreaId: optionalId,
    addressLine: text(200),
    neighborhood: text(120),
    postalCode,
    internalNotes: text(2000),
    confirmUnavailable: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.customerMode === "existing" && !v.customerId) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Busca y elige a la clienta" });
    }
    if (v.customerMode === "new") {
      if (v.newCustomer.name.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["newCustomer", "name"],
          message: "Escribe el nombre de la clienta",
        });
      }
      if (!v.newCustomer.email && !v.newCustomer.phone) {
        ctx.addIssue({
          code: "custom",
          path: ["newCustomer", "phone"],
          message: "Agrega WhatsApp o correo para contactarla",
        });
      }
    }
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const customerSearchSchema = z.object({ q: text(80).min(2, "Escribe al menos 2 letras") });

export const availabilityQuerySchema = z.object({
  date: dateKey,
  startTime: time,
  durationMinutes: z.number().int().min(30).max(720),
  serviceAreaId: optionalId,
  excludeEventId: optionalId,
});
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

// -----------------------------------------------------------------------------
// Edición de evento (Resumen)
// -----------------------------------------------------------------------------
export const updateEventSchema = z.object({
  eventId: id,
  title: text(120).min(3, "Escribe un título (mín. 3 caracteres)"),
  occasion: z.enum(OCCASIONS),
  date: dateKey,
  startTime: time,
  endTime: time,
  guestCount,
  experienceId: optionalId,
  menuId: optionalId,
  styleId: optionalId,
  serviceAreaId: optionalId,
  addressLine: text(200),
  neighborhood: text(120),
  postalCode,
  mapsUrl: optionalUrl,
  addressNotes: text(500),
  honoreeName: text(80),
  colors: text(300),
  dressCode: text(120),
  hostMessage: text(1500),
  playlistUrl: optionalUrl,
  customerNotes: text(2000),
  internalNotes: text(4000),
  micrositeEnabled: z.boolean(),
  confirmUnavailable: z.boolean(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// -----------------------------------------------------------------------------
// Estados, cancelación y tokens
// -----------------------------------------------------------------------------
export const transitionEventSchema = z.object({
  eventId: id,
  to: z.enum(EVENT_STATUS_VALUES),
  confirmUnavailable: z.boolean().optional(),
});
export type TransitionEventInput = z.infer<typeof transitionEventSchema>;

export const cancelEventSchema = z.object({
  eventId: id,
  reason: text(500).min(5, "Escribe el motivo de la cancelación (mín. 5 caracteres)"),
  notifyCustomer: z.boolean(),
});
export type CancelEventInput = z.infer<typeof cancelEventSchema>;

export const rotateTokenSchema = z.object({
  eventId: id,
  kind: z.enum(["portal", "invite"]),
});
export type RotateTokenInput = z.infer<typeof rotateTokenSchema>;

// -----------------------------------------------------------------------------
// Timeline y conversación con la anfitriona
// -----------------------------------------------------------------------------
export const timelineItemSchema = z.object({
  eventId: id,
  itemId: optionalId,
  time,
  title: text(120).min(2, "Escribe un título"),
  description: text(500),
  visibleToGuests: z.boolean(),
  sortOrder: z.number({ invalid_type_error: "Escribe un número" }).int().min(0).max(999),
});
export type TimelineItemInput = z.infer<typeof timelineItemSchema>;

export const deleteTimelineItemSchema = z.object({ eventId: id, itemId: id });

export const adminMessageSchema = z.object({
  eventId: id,
  body: text(2000).min(1, "Escribe un mensaje"),
  notifyCustomer: z.boolean(),
});
export type AdminMessageInput = z.infer<typeof adminMessageSchema>;

// -----------------------------------------------------------------------------
// Invitadas (admin)
// -----------------------------------------------------------------------------
export const guestSchema = z
  .object({
    eventId: id,
    guestId: optionalId,
    name: text(120).min(2, "Escribe el nombre"),
    email: optionalEmail,
    phone: optionalPhone,
    rsvpStatus: z.enum(RSVP_VALUES),
    plusOne: z.boolean(),
    plusOneName: text(120),
    dietaryRestrictions: z.array(z.enum(DIETARY_VALUES)).max(DIETARY_VALUES.length),
    dietaryNotes: text(500),
    comment: text(1000),
    /** Confirmación explícita para guardar a alguien que comparte correo/teléfono con otra invitada. */
    allowDuplicateContact: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.plusOne && v.plusOneName) {
      ctx.addIssue({
        code: "custom",
        path: ["plusOneName"],
        message: "Activa el acompañante o borra el nombre",
      });
    }
  });
export type GuestInput = z.infer<typeof guestSchema>;

export const deleteGuestSchema = z.object({ eventId: id, guestId: id });
export const rsvpReminderSchema = z.object({ eventId: id });
export const moderateMessageSchema = z.object({ eventId: id, messageId: id, hidden: z.boolean() });
