/**
 * Horario de un evento (puro, sin I/O): fecha local (YYYY-MM-DD) + horas locales (HH:mm)
 * en la zona de negocio -> instantes UTC (startsAt/endsAt) y columna @db.Date (eventDate).
 */
import { dateOnly, isValidDateKey, localTime, toDateKey, zonedDateTime } from "@/lib/dates";

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string | null | undefined): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Suma minutos a una hora HH:mm (topa en 23:59, los eventos no cruzan la medianoche). */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + minutes);
}

export type EventSchedule = {
  eventDate: Date;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
};

export class ScheduleError extends Error {
  constructor(
    message: string,
    readonly field: "date" | "startTime" | "endTime",
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

/**
 * Calcula el horario a partir de fecha + hora de inicio + hora de fin.
 * Lanza ScheduleError si los datos son inválidos o si la hora de fin no es posterior al inicio.
 */
export function buildSchedule(date: string, startTime: string, endTime: string): EventSchedule {
  if (!isValidDateKey(date)) throw new ScheduleError("Fecha inválida.", "date");
  if (!isValidTime(startTime)) throw new ScheduleError("Hora de inicio inválida.", "startTime");
  if (!isValidTime(endTime)) throw new ScheduleError("Hora de fin inválida.", "endTime");
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (duration <= 0) throw new ScheduleError("La hora de fin debe ser posterior a la de inicio.", "endTime");
  return {
    eventDate: dateOnly(date),
    startsAt: zonedDateTime(date, startTime),
    endsAt: zonedDateTime(date, endTime),
    durationMinutes: duration,
  };
}

/** Igual que buildSchedule pero con duración en minutos (alta manual de eventos). */
export function buildScheduleFromDuration(
  date: string,
  startTime: string,
  durationMinutes: number,
): EventSchedule {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new ScheduleError("Duración inválida.", "endTime");
  }
  const end = timeToMinutes(isValidTime(startTime) ? startTime : "00:00") + durationMinutes;
  if (end > 23 * 60 + 59)
    throw new ScheduleError("El evento debe terminar antes de la medianoche.", "endTime");
  return buildSchedule(date, startTime, minutesToTime(end));
}

/** Valores de formulario (fecha y horas locales) de un evento existente. */
export function scheduleToFormValues(event: { eventDate: Date; startsAt: Date; endsAt: Date }): {
  date: string;
  startTime: string;
  endTime: string;
} {
  return {
    date: toDateKey(event.eventDate),
    startTime: localTime(event.startsAt),
    endTime: localTime(event.endsAt),
  };
}

/** Desplaza un instante opcional por el mismo delta que se movió el inicio del evento. */
export function shiftInstant(value: Date | null, deltaMs: number): Date | null {
  return value ? new Date(value.getTime() + deltaMs) : null;
}
