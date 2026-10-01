import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";

export const BUSINESS_TZ = process.env.APP_TIMEZONE || "America/Mexico_City";

/** Construye un instante UTC a partir de fecha local (YYYY-MM-DD) y hora local (HH:mm) en CDMX. */
export function zonedDateTime(date: string, time = "00:00", tz: string = BUSINESS_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const zoned = new TZDate(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, tz);
  return new Date(zoned.getTime());
}

/** Fecha (columna @db.Date) a partir de YYYY-MM-DD, normalizada a medianoche UTC. */
export function dateOnly(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

/** YYYY-MM-DD de una columna @db.Date (UTC) */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD del día local en CDMX para un instante dado. */
export function localDateKey(instant: Date = new Date(), tz: string = BUSINESS_TZ): string {
  return format(new TZDate(instant.getTime(), tz), "yyyy-MM-dd");
}

/** HH:mm local en CDMX */
export function localTime(instant: Date, tz: string = BUSINESS_TZ): string {
  return format(new TZDate(instant.getTime(), tz), "HH:mm");
}

/** "sábado 18 de octubre de 2026" */
export function formatLongDate(value: Date | string, tz: string = BUSINESS_TZ): string {
  const d = typeof value === "string" ? dateOnly(value) : value;
  // Las columnas @db.Date vienen a medianoche UTC; para ellas usar UTC evita cambiar de día.
  const isDateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const zoned = isDateOnly ? new TZDate(d.getTime(), "UTC") : new TZDate(d.getTime(), tz);
  return format(zoned, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

/** "18 oct 2026" */
export function formatShortDate(value: Date | string, tz: string = BUSINESS_TZ): string {
  const d = typeof value === "string" ? dateOnly(value) : value;
  const isDateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  const zoned = isDateOnly ? new TZDate(d.getTime(), "UTC") : new TZDate(d.getTime(), tz);
  return format(zoned, "d MMM yyyy", { locale: es });
}

/** "18 oct 2026, 11:00" */
export function formatDateTime(instant: Date, tz: string = BUSINESS_TZ): string {
  return format(new TZDate(instant.getTime(), tz), "d MMM yyyy, HH:mm", { locale: es });
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  return differenceInCalendarDays(
    new TZDate(target.getTime(), BUSINESS_TZ),
    new TZDate(now.getTime(), BUSINESS_TZ),
  );
}

export function addDaysUtc(date: Date, days: number): Date {
  return addDays(date, days);
}

/** Día de la semana (0=domingo) de una fecha YYYY-MM-DD */
export function weekdayOf(dateKey: string): number {
  return dateOnly(dateKey).getUTCDay();
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = dateOnly(value);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === value;
}
