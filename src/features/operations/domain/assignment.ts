/**
 * Lógica pura de asignaciones de staff: monto por defecto, traslapes y disponibilidad.
 */
import type { StaffFunction, StaffRateType } from "@prisma/client";
import { localDateKey, localTime, weekdayOf, zonedDateTime } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/labels";

/** Minutos entre dos instantes (0 si el rango es inválido). */
export function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
}

/**
 * Monto sugerido de la asignación (centavos):
 *  - PER_EVENT: la tarifa tal cual.
 *  - PER_HOUR: tarifa × horas (proporcional a los minutos, redondeado al centavo).
 */
export function defaultAssignmentAmount(
  member: { rateCents: number; rateType: StaffRateType },
  startsAt: Date,
  endsAt: Date,
): number {
  if (member.rateType === "PER_EVENT") return member.rateCents;
  const minutes = durationMinutes(startsAt, endsAt);
  return Math.round((member.rateCents * minutes) / 60);
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export type AssignmentWarning =
  | { kind: "UNAVAILABLE_WEEKDAY"; message: string }
  | { kind: "OVERLAP"; message: string; eventId: string; eventTitle: string }
  | { kind: "INACTIVE"; message: string };

export type OtherAssignment = {
  id: string;
  eventId: string;
  eventTitle: string;
  startsAt: Date;
  endsAt: Date;
};

/** Avisos (no bloqueantes) para una asignación propuesta. */
export function assignmentWarnings(input: {
  member: { name: string; availableWeekdays: number[]; active: boolean };
  eventId: string;
  startsAt: Date;
  endsAt: Date;
  others: OtherAssignment[];
}): AssignmentWarning[] {
  const warnings: AssignmentWarning[] = [];
  if (!input.member.active) {
    warnings.push({ kind: "INACTIVE", message: `${input.member.name} está marcada como inactiva.` });
  }
  const weekday = weekdayOf(localDateKey(input.startsAt));
  if (input.member.availableWeekdays.length > 0 && !input.member.availableWeekdays.includes(weekday)) {
    warnings.push({
      kind: "UNAVAILABLE_WEEKDAY",
      message: `${input.member.name} normalmente no está disponible los ${WEEKDAY_LABELS[weekday]!.toLowerCase()}.`,
    });
  }
  const seen = new Set<string>();
  for (const o of input.others) {
    if (o.eventId === input.eventId || seen.has(o.eventId)) continue;
    if (rangesOverlap(input.startsAt, input.endsAt, o.startsAt, o.endsAt)) {
      seen.add(o.eventId);
      warnings.push({
        kind: "OVERLAP",
        eventId: o.eventId,
        eventTitle: o.eventTitle,
        message: `Ya está asignada a «${o.eventTitle}» (${localTime(o.startsAt)}–${localTime(o.endsAt)}) en un horario que se empalma.`,
      });
    }
  }
  return warnings;
}

const LOCAL_DT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/**
 * "YYYY-MM-DDTHH:mm" (input datetime-local, hora CDMX) → instante UTC.
 * Estricto: fechas imposibles ("2026-02-30T10:00", "25:00") devuelven null en vez de "rodar".
 */
export function parseLocalDateTime(value: string): Date | null {
  const trimmed = value.trim();
  const m = LOCAL_DT.exec(trimmed);
  if (!m) return null;
  const d = zonedDateTime(m[1]!, m[2]!);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalInputValue(d) === trimmed ? d : null;
}

/** Instante → "YYYY-MM-DDTHH:mm" en hora CDMX (para inputs datetime-local). */
export function toLocalInputValue(value: Date | null | undefined): string {
  if (!value) return "";
  return `${localDateKey(value)}T${localTime(value)}`;
}

/** Ventana sugerida por función respecto al evento (llegada antes, salida después). */
export function suggestedWindow(fn: StaffFunction, startsAt: Date, endsAt: Date): { startsAt: Date; endsAt: Date } {
  const before: Partial<Record<StaffFunction, number>> = {
    COORDINATOR: 150,
    SETUP: 150,
    DRIVER: 180,
    CHEF: 120,
    KITCHEN_ASSISTANT: 120,
    SERVER: 60,
    HOST: 30,
    PHOTOGRAPHER: 15,
  };
  const after: Partial<Record<StaffFunction, number>> = {
    COORDINATOR: 90,
    SETUP: 90,
    DRIVER: 120,
    CHEF: 30,
    KITCHEN_ASSISTANT: 60,
    SERVER: 60,
    HOST: 0,
    PHOTOGRAPHER: 0,
  };
  return {
    startsAt: new Date(startsAt.getTime() - (before[fn] ?? 60) * 60_000),
    endsAt: new Date(endsAt.getTime() + (after[fn] ?? 60) * 60_000),
  };
}
