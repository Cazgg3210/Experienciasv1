/**
 * Utilidades puras del calendario del configurador (fechas como claves YYYY-MM-DD, sin zonas horarias).
 */
import type { AvailabilityStatus } from "@/features/bookings/domain/availability";

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** Semana iniciando en lunes (convención en México). */
export const WEEKDAY_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
export const WEEKDAY_LONG = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

export type YearMonth = { year: number; month: number /* 0-11 */ };

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1, day: Number(key.slice(8, 10)) };
}

export function yearMonthOf(key: string): YearMonth {
  const { year, month } = parseDateKey(key);
  return { year, month };
}

export function daysInMonth(ym: YearMonth): number {
  return new Date(Date.UTC(ym.year, ym.month + 1, 0)).getUTCDate();
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const total = ym.year * 12 + ym.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthLabel(ym: YearMonth): string {
  return `${MONTH_NAMES[ym.month]} ${ym.year}`;
}

/** Índice 0=lunes … 6=domingo de una fecha. */
export function mondayIndex(key: string): number {
  const { year, month, day } = parseDateKey(key);
  const sundayBased = new Date(Date.UTC(year, month, day)).getUTCDay();
  return (sundayBased + 6) % 7;
}

/** Semanas (lunes→domingo) del mes; celdas fuera del mes son null. */
export function monthGrid(ym: YearMonth): Array<Array<string | null>> {
  const total = daysInMonth(ym);
  const first = dateKeyOf(ym.year, ym.month, 1);
  const lead = mondayIndex(first);
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) cells.push(dateKeyOf(ym.year, ym.month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function addDaysKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month, day + days));
  return dateKeyOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function diffDaysKey(fromKey: string, toKey: string): number {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  return Math.round((Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / 86_400_000);
}

/** "sábado 18 de octubre de 2026" sin depender de la zona horaria del navegador. */
export function longDateLabel(key: string): string {
  const { year, month, day } = parseDateKey(key);
  return `${WEEKDAY_LONG[mondayIndex(key)]} ${day} de ${MONTH_NAMES[month]} de ${year}`;
}

export type DayView = {
  label: string;
  selectable: boolean;
  tone: "available" | "limited" | "full" | "closed" | "review" | "past";
  note?: string;
};

/** Cómo se muestra cada estado de disponibilidad en el calendario público. */
export function dayView(status: AvailabilityStatus): DayView {
  switch (status) {
    case "AVAILABLE":
      return { label: "Disponible", selectable: true, tone: "available" };
    case "LIMITED":
      return {
        label: "Último lugar",
        selectable: true,
        tone: "limited",
        note: "¡Queda un último lugar ese día!",
      };
    case "FULL":
      return { label: "Lleno", selectable: false, tone: "full" };
    case "CLOSED":
    case "BLOCKED":
      return { label: "Cerrado", selectable: false, tone: "closed" };
    case "TOO_SOON":
      return {
        label: "Sujeto a confirmación",
        selectable: true,
        tone: "review",
        note: "Es muy pronto: tu fecha queda sujeta a confirmación del equipo.",
      };
    case "TOO_FAR":
    case "OUT_OF_HOURS":
      return {
        label: "Sujeto a confirmación",
        selectable: true,
        tone: "review",
        note: "Aún no abrimos agenda para esa fecha; la revisamos contigo (sujeto a confirmación).",
      };
    case "PAST":
    default:
      return { label: "No disponible", selectable: false, tone: "past" };
  }
}
