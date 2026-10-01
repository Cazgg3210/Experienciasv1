/**
 * Detección de cambios para auditoría de eventos (pura).
 * Los cambios de fecha/horario/invitadas/experiencia/menú/zona afectan precio u operación
 * y se auditan como "event.updated" con before/after.
 */

/** Campos que, al cambiar, deben auditarse (afectan fecha, horario, capacidad o precio). */
export const SENSITIVE_EVENT_FIELDS = [
  "eventDate",
  "startsAt",
  "endsAt",
  "guestCount",
  "experienceId",
  "menuId",
  "serviceAreaId",
] as const;

export type SensitiveEventField = (typeof SENSITIVE_EVENT_FIELDS)[number];

type Comparable = string | number | boolean | Date | null | undefined | string[];

function normalize(value: Comparable): string | number | boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

export type FieldDiff = {
  changed: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

/** Compara dos objetos campo por campo (sólo las llaves de `after`). */
export function diffFields(before: Record<string, unknown>, after: Record<string, Comparable>): FieldDiff {
  const changed: string[] = [];
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = normalize(before[key] as Comparable);
    const next = normalize(after[key] as Comparable);
    if (prev !== next) {
      changed.push(key);
      b[key] = auditValue(before[key] as Comparable);
      a[key] = auditValue(after[key] as Comparable);
    }
  }
  return { changed, before: b, after: a };
}

/** Valor legible para la bitácora: fechas en ISO, arrays como arrays, vacío como null. */
function auditValue(value: Comparable): unknown {
  if (Array.isArray(value)) return [...value];
  return normalize(value);
}

export function hasSensitiveChange(changed: string[]): boolean {
  return changed.some((f) => (SENSITIVE_EVENT_FIELDS as readonly string[]).includes(f));
}

/** Cambios de calendario: requieren revisar disponibilidad de nuevo. */
export function needsAvailabilityCheck(changed: string[]): boolean {
  return changed.some(
    (f) => f === "eventDate" || f === "startsAt" || f === "endsAt" || f === "serviceAreaId",
  );
}

/** Lista de colores "Rosa palo, salvia" -> ["Rosa palo", "salvia"] (sin vacíos ni duplicados). */
export function parseColorList(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[,;\n]/)) {
    const c = raw.trim().slice(0, 40);
    const key = c.toLowerCase();
    if (!c || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= 10) break;
  }
  return out;
}

/** "" / espacios -> null; recorta el resto. */
export function blankToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}
