/**
 * Formatos de fecha/hora de eventos para la UI (puro; zona de negocio vía @/lib/dates).
 */
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { localTime } from "@/lib/dates";

/** Columna @db.Date -> "sáb 10 oct 2026" (sin desfase de zona). */
export function formatEventDay(eventDate: Date): string {
  return format(new TZDate(eventDate.getTime(), "UTC"), "EEE d MMM yyyy", { locale: es });
}

/** "11:00–14:00" en hora local de CDMX. */
export function formatTimeRange(startsAt: Date, endsAt: Date): string {
  return `${localTime(startsAt)}–${localTime(endsAt)}`;
}

/** Duración legible: 180 -> "3 h", 210 -> "3 h 30 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Primer nombre para saludos ("Sofía Martínez" -> "Sofía"). */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** "Hoy", "Mañana", "En 12 días", "Ayer", "Hace 3 días" a partir de una diferencia en días. */
export function relativeDayLabel(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${days} días` : `Hace ${Math.abs(days)} días`;
}
