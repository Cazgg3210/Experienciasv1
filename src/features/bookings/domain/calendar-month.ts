/**
 * Cuadrícula mensual del calendario admin (pura). Semanas de lunes a domingo (convención MX).
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Tone } from "@/lib/labels";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

/** Valida "YYYY-MM"; si no es válido devuelve el mes de `todayKey`. Limita a ±5 años. */
export function parseMonthParam(value: string | string[] | undefined, todayKey: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const fallback = todayKey.slice(0, 7);
  if (!raw) return fallback;
  const m = MONTH_RE.exec(raw);
  if (!m) return fallback;
  const year = Number(m[1]);
  const currentYear = Number(todayKey.slice(0, 4));
  if (Math.abs(year - currentYear) > 5) return fallback;
  return raw;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "octubre 2026" */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  // Fecha "local" construida con componentes: format() no cambia el día.
  return format(new Date(y!, m! - 1, 1), "MMMM yyyy", { locale: es });
}

export type CalendarCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  /** 0=domingo … 6=sábado */
  weekday: number;
};

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Semanas completas (lunes→domingo) que cubren el mes. 4 a 6 filas. */
export function monthGrid(monthKey: string): CalendarCell[][] {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const last = new Date(Date.UTC(y!, m!, 0));
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const start = new Date(first.getTime() - offset * DAY_MS);
  const weeks: CalendarCell[][] = [];
  let cursor = start;
  while (cursor.getTime() <= last.getTime() || weeks.length === 0) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        dateKey: keyOf(cursor),
        day: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === m! - 1,
        weekday: cursor.getUTCDay(),
      });
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Primer día y número de días de la cuadrícula (para consultar disponibilidad del rango). */
export function gridRange(weeks: CalendarCell[][]): { fromKey: string; toKey: string; days: number } {
  const flat = weeks.flat();
  return { fromKey: flat[0]!.dateKey, toKey: flat[flat.length - 1]!.dateKey, days: flat.length };
}

/** Encabezados de columna en orden lunes→domingo */
export const GRID_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export type DayCapacityInput = {
  status: string;
  remaining: number;
  capacity: number;
  booked: number;
};

/**
 * Badge de capacidad del día para el admin: cerrado / bloqueado / lleno / "x libres".
 * Días pasados no muestran badge.
 */
export function dayCapacityBadge(day: DayCapacityInput): { label: string; tone: Tone } | null {
  switch (day.status) {
    case "PAST":
      return null;
    case "CLOSED":
      return { label: "Cerrado", tone: "muted" };
    case "BLOCKED":
      return { label: "Bloqueado", tone: "danger" };
    case "FULL":
      return { label: "Lleno", tone: "warning" };
    default: {
      if (day.capacity > 0 && day.remaining <= 0) return { label: "Lleno", tone: "warning" };
      if (day.capacity <= 0) return { label: "Cerrado", tone: "muted" };
      return {
        label: day.remaining === 1 ? "1 libre" : `${day.remaining} libres`,
        tone: day.remaining === 1 ? "info" : "success",
      };
    }
  }
}
