import { formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";

/** "hace 3 días", "hace 2 horas", "justo ahora" */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (Math.abs(diffMs) < 60_000) return "justo ahora";
  return formatDistanceStrict(date, now, { addSuffix: true, locale: es });
}

/** Nombre del rango de invitadas: "8 personas" */
export function guestsLabel(count: number | null | undefined): string {
  if (count == null) return "—";
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}
