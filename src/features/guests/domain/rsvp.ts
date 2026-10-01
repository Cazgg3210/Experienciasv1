/**
 * Lógica pura de RSVP e invitadas (sin I/O). Compartida por micrositio, portal y pruebas.
 */
import type { DietaryRestriction, RsvpStatus } from "@prisma/client";

/** Límite defensivo de invitadas por evento (anti-abuso de acciones públicas). */
export const MAX_GUESTS_PER_EVENT = 60;

/** Normaliza un nombre para comparar: sin acentos, minúsculas, espacios colapsados. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v ? v : null;
}

/**
 * Email enmascarado para mostrar en el micrositio ("ca•••@gmail.com"). El email completo nunca
 * se envía al navegador: con el link genérico cualquiera que escriba un nombre recibe el link
 * personal de esa invitada, así que su email no debe quedar expuesto.
 */
export function maskEmail(email: string | null | undefined): string | null {
  const v = normalizeEmail(email);
  if (!v) return null;
  const at = v.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}•••@${domain}`;
}

/** Primer nombre para saludos cálidos ("¡Gracias, Camila!"). */
export function firstName(name: string | null | undefined): string {
  const clean = (name ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.split(" ")[0]!;
}

export type MatchableGuest = { id: string; name: string; email: string | null };

/**
 * Busca a la invitada existente que corresponde a una respuesta hecha con el link genérico:
 *  1. si dio email y alguna invitada tiene ese email → esa invitada;
 *  2. si no, por nombre normalizado (siempre que la invitada no tenga OTRO email distinto).
 */
export function findMatchingGuest<G extends MatchableGuest>(
  guests: G[],
  input: { name: string; email?: string | null },
): G | null {
  const email = normalizeEmail(input.email);
  if (email) {
    const byEmail = guests.find((g) => normalizeEmail(g.email) === email);
    if (byEmail) return byEmail;
  }
  const target = normalizeName(input.name);
  if (!target) return null;
  return (
    guests.find((g) => {
      if (normalizeName(g.name) !== target) return false;
      const gEmail = normalizeEmail(g.email);
      return !email || !gEmail || gEmail === email;
    }) ?? null
  );
}

export type RsvpStats = {
  total: number;
  attending: number;
  notAttending: number;
  maybe: number;
  pending: number;
  plusOnes: number;
  /** Personas esperadas: confirmadas + sus acompañantes */
  headcount: number;
};

export function rsvpStats(guests: Array<{ rsvpStatus: RsvpStatus; plusOne: boolean }>): RsvpStats {
  const stats: RsvpStats = { total: guests.length, attending: 0, notAttending: 0, maybe: 0, pending: 0, plusOnes: 0, headcount: 0 };
  for (const g of guests) {
    if (g.rsvpStatus === "ATTENDING") {
      stats.attending += 1;
      if (g.plusOne) stats.plusOnes += 1;
    } else if (g.rsvpStatus === "NOT_ATTENDING") stats.notAttending += 1;
    else if (g.rsvpStatus === "MAYBE") stats.maybe += 1;
    else stats.pending += 1;
  }
  stats.headcount = stats.attending + stats.plusOnes;
  return stats;
}

/** La dirección completa sólo se muestra a quien confirmó que asiste (privacidad). */
export function canSeeFullAddress(guest: { rsvpStatus: RsvpStatus } | null | undefined): boolean {
  return guest?.rsvpStatus === "ATTENDING";
}

export type RsvpAnswer = Exclude<RsvpStatus, "PENDING">;

/** Copy de la tarjeta de confirmación después de responder. */
export function confirmationCopy(status: RsvpStatus, name: string): { title: string; body: string } {
  const n = firstName(name);
  const who = n ? `, ${n}` : "";
  switch (status) {
    case "ATTENDING":
      return {
        title: `¡Gracias${who}! Te esperamos`,
        body: "Tu lugar en la mesa está apartado. Guarda la fecha en tu calendario y prepárate para disfrutar.",
      };
    case "NOT_ATTENDING":
      return {
        title: "Te vamos a extrañar",
        body: `Gracias por avisarnos${who}. Si cambian tus planes, puedes actualizar tu respuesta aquí mismo.`,
      };
    case "MAYBE":
      return {
        title: `¡Gracias${who}! Ojalá puedas acompañarnos`,
        body: "Cuando lo sepas con seguridad, vuelve a este enlace y actualiza tu respuesta.",
      };
    default:
      return { title: "Tu respuesta está pendiente", body: "Confirma tu asistencia con el formulario." };
  }
}

/** Orden estable de restricciones alimentarias para mostrar. */
export const DIETARY_ORDER: DietaryRestriction[] = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "NUT_ALLERGY",
  "SEAFOOD_ALLERGY",
  "KOSHER",
  "HALAL",
  "OTHER",
];

export function sortDietary(values: DietaryRestriction[]): DietaryRestriction[] {
  const set = new Set(values);
  return DIETARY_ORDER.filter((d) => set.has(d));
}

/**
 * Interpreta el campo "teléfono o email (opcional)" del alta de invitadas.
 * Devuelve null si está vacío, o un error legible si no es ni email ni teléfono válido.
 */
export function parseContact(
  value: string | null | undefined,
): { email: string | null; phone: string | null } | { error: string } | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.includes("@")) {
    const email = v.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
      return { error: "Escribe un email válido o un teléfono de 10 dígitos." };
    }
    return { email, phone: null };
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || /[^\d\s()+-.]/.test(v)) {
    return { error: "Escribe un teléfono de 10 dígitos o un email válido." };
  }
  return { email: null, phone: v.replace(/\s+/g, " ") };
}

/** Puede la anfitriona quitar a esta invitada desde su portal. */
export function canHostRemoveGuest(guest: { source: string; rsvpStatus: RsvpStatus }): boolean {
  return guest.source === "HOST" && guest.rsvpStatus === "PENDING";
}
