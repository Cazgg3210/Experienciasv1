/**
 * Reglas puras del portal de la clienta ("Mi evento"): permisos de edición por fecha/estado,
 * CTA de pago, cuenta regresiva, textos de invitación y registro de cambios.
 */
import type { EventStatus } from "@prisma/client";
import { firstName } from "@/features/guests/domain/rsvp";

/** La anfitriona puede editar la dirección hasta 48 h antes del inicio. */
export const ADDRESS_EDIT_CUTOFF_HOURS = 48;
/** Ventana para pedir el acceso por email: eventos próximos o de los últimos 60 días. */
export const PORTAL_ACCESS_LOOKBACK_DAYS = 60;

export const PORTAL_ACCESS_NEUTRAL_MESSAGE =
  "Si tu correo está registrado con un evento, en unos minutos recibirás tu enlace de acceso. Revisa también la carpeta de spam o promociones.";

const CLOSED_STATUSES: EventStatus[] = ["CANCELLED", "COMPLETED"];

/** Estados en los que la anfitriona todavía puede modificar invitadas y preferencias. */
export function isPortalEditable(status: EventStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

export function canEditAddress(status: EventStatus, startsAt: Date, now: Date = new Date()): boolean {
  if (!isPortalEditable(status) || status === "IN_PROGRESS") return false;
  return startsAt.getTime() - now.getTime() > ADDRESS_EDIT_CUTOFF_HOURS * 60 * 60 * 1000;
}

/** RSVP abierto: evento no cancelado ni completado y que no haya terminado. */
export function isRsvpOpen(status: EventStatus, endsAt: Date, now: Date = new Date()): boolean {
  return isPortalEditable(status) && endsAt.getTime() > now.getTime();
}

/** Estado del evento en palabras amables para la anfitriona. */
export const FRIENDLY_STATUS: Record<EventStatus, { title: string; description: string }> = {
  INQUIRY: {
    title: "Preparando tu propuesta",
    description: "Estamos revisando los detalles para enviarte tu propuesta.",
  },
  PENDING_PAYMENT: {
    title: "Falta tu anticipo",
    description: "Tu fecha se confirma en cuanto recibamos el anticipo.",
  },
  CONFIRMED: {
    title: "¡Fecha confirmada!",
    description: "Tu celebración está apartada. Ya puedes invitar a tus amigas.",
  },
  PLANNING: {
    title: "Afinando cada detalle",
    description: "Estamos preparando flores, menú y montaje para tu mesa.",
  },
  READY: {
    title: "Todo listo",
    description: "Cada detalle está preparado. Sólo falta que llegue el día.",
  },
  IN_PROGRESS: {
    title: "¡Hoy celebramos!",
    description: "Nuestro equipo ya está contigo. Disfruta cada momento.",
  },
  COMPLETED: {
    title: "Gracias por celebrar con nosotras",
    description: "Fue un honor ser parte de tu celebración.",
  },
  CANCELLED: {
    title: "Evento cancelado",
    description: "Este evento fue cancelado.",
  },
};

export type PaymentCta = { kind: "DEPOSIT" | "BALANCE"; label: string; amountCents: number };

/**
 * CTA de pago del portal:
 *  - PENDING_PAYMENT → "Pagar anticipo" (lo que falte del anticipo requerido)
 *  - si hay saldo > 0 en un evento activo → "Pagar saldo"
 */
export function paymentCta(input: {
  status: EventStatus;
  totalCents: number;
  paidCents: number;
  depositRequiredCents: number;
}): PaymentCta | null {
  const balance = Math.max(0, input.totalCents - input.paidCents);
  if (input.status === "CANCELLED" || input.status === "COMPLETED" || input.status === "INQUIRY") return null;
  if (input.status === "PENDING_PAYMENT") {
    const deposit = Math.max(0, input.depositRequiredCents - input.paidCents);
    const amount = deposit > 0 ? deposit : balance;
    return amount > 0 ? { kind: "DEPOSIT", label: "Pagar anticipo", amountCents: amount } : null;
  }
  return balance > 0 ? { kind: "BALANCE", label: "Pagar saldo", amountCents: balance } : null;
}

export type Countdown = { days: number; hours: number; minutes: number; state: "upcoming" | "today" | "past" };

/** Cuenta regresiva días/horas/minutos hasta el inicio. */
export function countdownParts(startsAt: Date, endsAt: Date, now: Date = new Date()): Countdown {
  const diff = startsAt.getTime() - now.getTime();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, state: now.getTime() < endsAt.getTime() ? "today" : "past" };
  }
  const totalMinutes = Math.floor(diff / 60_000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
    state: "upcoming",
  };
}

export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export type InvitationTextInput = {
  hostName: string;
  title: string;
  dateLabel: string; // "sábado 10 de octubre de 2026"
  timeLabel: string; // "11:00"
  neighborhood?: string | null;
  city?: string | null;
  url: string;
};

function placeLabel(input: Pick<InvitationTextInput, "neighborhood" | "city">): string {
  const parts = [input.neighborhood, input.city].map((s) => s?.trim()).filter(Boolean);
  return parts.length ? ` en ${parts.join(", ")}` : "";
}

/** Invitación general para compartir en grupos (link del micrositio con inviteToken). */
export function buildInvitationText(input: InvitationTextInput): string {
  const host = firstName(input.hostName);
  return [
    `¡Estás invitada! ${host ? `${host} te invita` : "Te invitamos"} a celebrar «${input.title}» el ${input.dateLabel} a las ${input.timeLabel} h${placeLabel(input)}.`,
    "Confirma tu asistencia y cuéntanos si tienes alguna restricción alimentaria aquí:",
    input.url,
  ].join("\n\n");
}

/** Invitación personal para una invitada (link con su token propio). */
export function buildGuestInvitationText(input: InvitationTextInput & { guestName: string }): string {
  const guest = firstName(input.guestName);
  const host = firstName(input.hostName);
  return [
    `¡Hola${guest ? `, ${guest}` : ""}! ${host ? `${host} te invita` : "Te invitamos"} a celebrar «${input.title}» el ${input.dateLabel} a las ${input.timeLabel} h${placeLabel(input)}.`,
    "Este es tu enlace personal para confirmar tu asistencia:",
    input.url,
  ].join("\n\n");
}

export type HostPreferences = {
  colors: string[];
  honoreeName: string | null;
  customerNotes: string | null;
  dressCode: string | null;
  hostMessage: string | null;
  playlistUrl: string | null;
};

export const PREFERENCE_LABELS: Record<keyof HostPreferences, string> = {
  colors: "los colores",
  honoreeName: "el nombre de la homenajeada",
  customerNotes: "las notas para el equipo",
  dressCode: "el código de vestimenta",
  hostMessage: "el mensaje de anfitriona",
  playlistUrl: "la playlist",
};

const PREFERENCE_KEYS = Object.keys(PREFERENCE_LABELS) as Array<keyof HostPreferences>;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => String(v).toLowerCase() === String(b[i]).toLowerCase());
  }
  return (a ?? null) === (b ?? null);
}

/** Campos que cambiaron (en orden estable). */
export function changedPreferenceKeys(before: HostPreferences, after: HostPreferences): Array<keyof HostPreferences> {
  return PREFERENCE_KEYS.filter((k) => !sameValue(before[k], after[k]));
}

/** "La anfitriona actualizó los colores, la playlist y el mensaje de anfitriona." */
export function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function preferenceChangeMessage(keys: Array<keyof HostPreferences>): string | null {
  if (keys.length === 0) return null;
  return `La anfitriona actualizó ${joinSpanish(keys.map((k) => PREFERENCE_LABELS[k]))}.`;
}

/** Texto vacío → null; recorta espacios. */
export function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * Sólo URLs http(s) absolutas para enlaces externos (playlist, mapas). Defensa en profundidad:
 * estos valores también pueden capturarse desde el admin, que no necesariamente los valida.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? v : null;
  } catch {
    return null;
  }
}

/** Enlace de mapas: el guardado (si es http/https) o una búsqueda en Google Maps con la dirección. */
export function mapsLink(input: {
  mapsUrl?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): string | null {
  const saved = safeExternalUrl(input.mapsUrl);
  if (saved) return saved;
  const q = [input.addressLine, input.neighborhood, input.postalCode, input.city].filter(Boolean).join(", ");
  if (!input.addressLine) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
