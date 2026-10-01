/**
 * Resumen de RSVP, restricciones alimentarias y exportación CSV de invitadas (puro).
 */
import type { DietaryRestriction, GuestSource, RsvpStatus } from "@prisma/client";
import { DIETARY_LABELS, RSVP_STATUS_LABELS } from "@/lib/labels";

export type GuestLike = {
  name: string;
  rsvpStatus: RsvpStatus;
  plusOne: boolean;
  plusOneName?: string | null;
  dietaryRestrictions: DietaryRestriction[];
  dietaryNotes?: string | null;
};

export type RsvpSummary = {
  /** Invitadas que confirmaron (sin acompañantes) */
  attending: number;
  /** Acompañantes de invitadas que confirmaron */
  plusOnes: number;
  /** Confirmadas incluyendo acompañantes (personas esperadas) */
  attendingTotal: number;
  pending: number;
  notAttending: number;
  maybe: number;
  /** Total de registros de invitadas */
  total: number;
};

export function summarizeRsvp(guests: GuestLike[]): RsvpSummary {
  const s: RsvpSummary = {
    attending: 0,
    plusOnes: 0,
    attendingTotal: 0,
    pending: 0,
    notAttending: 0,
    maybe: 0,
    total: 0,
  };
  for (const g of guests) {
    s.total += 1;
    switch (g.rsvpStatus) {
      case "ATTENDING":
        s.attending += 1;
        if (g.plusOne) s.plusOnes += 1;
        break;
      case "PENDING":
        s.pending += 1;
        break;
      case "NOT_ATTENDING":
        s.notAttending += 1;
        break;
      case "MAYBE":
        s.maybe += 1;
        break;
    }
  }
  s.attendingTotal = s.attending + s.plusOnes;
  return s;
}

export type DietaryAggregate = {
  restrictions: Array<{ restriction: DietaryRestriction; label: string; count: number; names: string[] }>;
  notes: Array<{ name: string; notes: string }>;
  /** Personas con al menos una restricción o nota */
  peopleWithRestrictions: number;
};

/**
 * Agrega restricciones de quienes asisten o podrían asistir (excluye "No asiste").
 * Orden: más frecuentes primero.
 */
export function aggregateDietary(guests: GuestLike[]): DietaryAggregate {
  const map = new Map<DietaryRestriction, string[]>();
  const notes: Array<{ name: string; notes: string }> = [];
  let people = 0;
  for (const g of guests) {
    if (g.rsvpStatus === "NOT_ATTENDING") continue;
    const unique = Array.from(new Set(g.dietaryRestrictions));
    const note = g.dietaryNotes?.trim();
    if (unique.length || note) people += 1;
    for (const r of unique) {
      const list = map.get(r) ?? [];
      list.push(g.name);
      map.set(r, list);
    }
    if (note) notes.push({ name: g.name, notes: note });
  }
  const restrictions = Array.from(map.entries())
    .map(([restriction, names]) => ({
      restriction,
      label: DIETARY_LABELS[restriction],
      count: names.length,
      names: [...names].sort((a, b) => a.localeCompare(b, "es")),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  return { restrictions, notes, peopleWithRestrictions: people };
}

export const GUEST_SOURCE_LABELS: Record<GuestSource, string> = {
  HOST: "Anfitriona",
  ADMIN: "Equipo",
  SELF_RSVP: "Auto-registro",
};

export type GuestCsvLike = GuestLike & {
  email?: string | null;
  phone?: string | null;
  comment?: string | null;
  source: GuestSource;
  respondedAt?: Date | null;
};

export const GUEST_CSV_HEADERS = [
  "Nombre",
  "Email",
  "Teléfono",
  "Estado",
  "Acompañante",
  "Nombre acompañante",
  "Restricciones",
  "Notas alimentarias",
  "Comentario",
  "Origen",
  "Respondió",
];

/** Filas para toCsv(); formatea la fecha de respuesta con el formateador recibido. */
export function guestCsvRows(
  guests: GuestCsvLike[],
  formatDate: (d: Date) => string,
): Array<Array<string | null>> {
  return guests.map((g) => [
    g.name,
    g.email ?? "",
    g.phone ?? "",
    RSVP_STATUS_LABELS[g.rsvpStatus],
    g.plusOne ? "Sí" : "No",
    g.plusOne ? (g.plusOneName ?? "") : "",
    g.dietaryRestrictions.map((r) => DIETARY_LABELS[r]).join("; "),
    g.dietaryNotes ?? "",
    g.comment ?? "",
    GUEST_SOURCE_LABELS[g.source],
    g.respondedAt ? formatDate(g.respondedAt) : "",
  ]);
}

/** Nombre de archivo seguro: invitadas-EV-2610-ABCD.csv */
export function guestCsvFilename(eventCode: string): string {
  const safe = eventCode.replace(/[^A-Za-z0-9-]/g, "") || "evento";
  return `invitadas-${safe}.csv`;
}
