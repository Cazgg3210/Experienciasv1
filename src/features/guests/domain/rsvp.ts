/**
 * Lógica pura de RSVP e invitadas (sin I/O). Compartida por micrositio, portal y pruebas.
 */
import type { DietaryRestriction, GuestSource, RsvpStatus } from "@prisma/client";

/**
 * Techo absoluto de invitadas por evento (anti-abuso de acciones públicas). Aplica a la lista que arma la
 * anfitriona desde su portal y es también el techo del tope del link general (`selfRsvpGuestLimit`).
 */
export const MAX_GUESTS_PER_EVENT = 60;

/**
 * Margen del link general sobre las personas contratadas (`Event.guestCount`), en bps (5000 = 50 %).
 * La lista de invitadas siempre es más larga que la mesa: también quedan en ella quienes responden «No podré
 * ir», las que dicen «Tal vez» y alguna invitada que respondió por el link general en lugar de su link
 * personal (posible duplicado). Con la mitad de holgura caben esos casos sin dejar que alguien con el link
 * llene la lista con registros falsos.
 */
export const SELF_RSVP_MARGIN_BPS = 5_000;

/** Margen mínimo, en invitadas, para eventos chicos (la mitad de 4 personas no deja lugar ni para un «no»). */
export const SELF_RSVP_MIN_MARGIN = 5;

/**
 * Hasta cuántas invitadas puede llegar la lista de un evento con respuestas del link general:
 * `min(MAX_GUESTS_PER_EVENT, guestCount + max(SELF_RSVP_MIN_MARGIN, ⌈guestCount × 50 %⌉))`.
 * Cuenta la lista completa (también las que agregó la anfitriona o el equipo), porque lo que protege es que
 * la lista no crezca sin control más allá de la experiencia contratada. Sólo frena al link general: el link
 * personal actualiza a su propia invitada y la anfitriona agrega desde su portal hasta el techo de 60.
 * `guestCount` es la fuente de verdad (validado de 1 a 200 en todas las altas). `maxStandardGuests` no
 * aplica aquí: es el umbral de «consulta especial» al cotizar y un evento más grande ya fue aprobado.
 */
export function selfRsvpGuestLimit(guestCount: number): number {
  const planned = Number.isFinite(guestCount) ? Math.max(0, Math.floor(guestCount)) : 0;
  const margin = Math.max(SELF_RSVP_MIN_MARGIN, Math.ceil((planned * SELF_RSVP_MARGIN_BPS) / 10_000));
  return Math.min(MAX_GUESTS_PER_EVENT, planned + margin);
}

/** ¿Admite la lista (con `listSize` invitadas) una respuesta más por el link general? */
export function canSelfRegister(listSize: number, guestCount: number): boolean {
  return listSize < selfRsvpGuestLimit(guestCount);
}

/**
 * Lo que ve quien responde por el link general cuando la lista llegó al tope: cálido, con qué hacer, y sin
 * decir cuántas personas hay ni quiénes (la respuesta es la misma con o sin coincidencia de nombre).
 */
export const GENERAL_INVITE_FULL_MESSAGE =
  "¡Gracias por querer acompañarnos! Este enlace ya no recibe más respuestas. Pídele a la anfitriona tu link personal y confirma desde ahí.";

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
 * se envía al navegador (defensa en profundidad: un link personal reenviado no debe exponerlo).
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

export type DuplicateCandidate = { id: string; name: string; email: string | null };

/**
 * Invitadas ya registradas que podrían ser la misma persona que una respuesta hecha con el link
 * general (mismo nombre normalizado o mismo email). SÓLO sirve para marcar un posible duplicado que
 * la anfitriona o el equipo revisan: el link general nunca re-identifica, modifica ni entrega el
 * link personal de una invitada existente, porque escribir un nombre o un email no prueba que sea
 * ella (BUG-003). Quien ya tiene su link personal responde desde ese enlace.
 */
export function findPossibleDuplicates<G extends DuplicateCandidate>(
  guests: G[],
  input: { name: string; email?: string | null },
): G[] {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  return guests.filter(
    (g) => (name !== "" && normalizeName(g.name) === name) || (email !== null && normalizeEmail(g.email) === email),
  );
}

export type DuplicateFlagGuest = DuplicateCandidate & { source: GuestSource; createdAt: Date };

/**
 * Posibles duplicados de la lista (criterio para la anfitriona y el equipo):
 *  - Se marca cada invitada que se registró SOLA con el link general (SELF_RSVP) y coincide por nombre o
 *    email con OTRA invitada de la lista, registrada antes O después que ella. Nadie probó ser quien dice
 *    (BUG-003), así que el orden de llegada no decide cuál es «la original»: si alguien se registra con el
 *    nombre de una invitada antes que ella, se marcan las dos y quien revisa decide.
 *  - Las que agregó la anfitriona o el equipo (HOST/ADMIN) nunca se marcan: las capturó alguien de
 *    confianza. Pero sí cuentan como coincidencia de un auto-registro, aunque se hayan agregado después.
 * Devuelve, por cada invitada marcada, las invitadas con que coincide (en orden de alta) para mostrar
 * «Coincide con: …» y que nadie quite el registro equivocado.
 */
export function possibleDuplicateMatches<G extends DuplicateFlagGuest>(guests: G[]): Map<string, G[]> {
  const ordered = [...guests].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const matches = new Map<string, G[]>();
  for (const g of ordered) {
    if (g.source !== "SELF_RSVP") continue;
    const found = findPossibleDuplicates(
      ordered.filter((o) => o.id !== g.id),
      g,
    );
    if (found.length) matches.set(g.id, found);
  }
  return matches;
}

/** Ids de las invitadas marcadas como «Posible duplicado» (ver `possibleDuplicateMatches`). */
export function possibleDuplicateIds(guests: DuplicateFlagGuest[]): Set<string> {
  return new Set(possibleDuplicateMatches(guests).keys());
}

/** «Ana», «Bety» y «Caro»: nombres de las coincidencias para el aviso de posible duplicado. */
export function duplicateNamesLabel(names: string[]): string {
  const quoted = names.map((n) => `«${n}»`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} y ${quoted[quoted.length - 1]}`;
}

/**
 * Indicación para la anfitriona en su portal junto a un auto-registro marcado como posible duplicado.
 * Primero le pide confirmarlo con su invitada. Si coincide con alguien que agregó ella o el equipo (HOST/ADMIN),
 * ese registro es el confiable (tiene su link personal y su contacto): si el auto-registro no es de su invitada
 * se quita el AUTO-REGISTRO (lo quitamos nosotras: la anfitriona sólo puede quitar sus pendientes), y si sí es
 * suyo, que responda desde su link personal. Nunca le sugiere quitar el registro que ella agregó: si el
 * auto-registro fuera una suplantación, la invitada real perdería su link (revisión de BUG-003).
 */
export function hostDuplicateHint(matches: Array<{ name: string; source: GuestSource }>): string {
  if (!matches.length) return "";
  const who = duplicateNamesLabel(matches.map((m) => m.name));
  const several = matches.length > 1;
  const confirm = `Primero confírmalo con ${several ? "ellas" : "ella"}`;
  const trusted = matches.filter((m) => m.source !== "SELF_RSVP");
  if (trusted.length) {
    const keep = duplicateNamesLabel(trusted.map((m) => m.name));
    return (
      `Coincide con ${who} de tu lista. ${confirm}: si este registro no es ${several ? "de ninguna" : "suyo"}, ` +
      `escríbenos y lo quitamos; si ${several ? "es de alguna" : "sí es suyo"}, pídele que responda desde su link personal. ` +
      `No quites ${trusted.length === 1 ? `el registro de ${keep}` : `los registros de ${keep}`}.`
    );
  }
  return `Coincide con ${who} de tu lista. ${confirm} y, si es la misma persona, escríbenos y dejamos un solo registro.`;
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
