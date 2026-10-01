/**
 * Generador mínimo de iCalendar (RFC 5545) para "Agregar a mi calendario". Puro y testeable.
 */

export type IcsEvent = {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** Momento de generación (DTSTAMP) */
  now?: Date;
  /** Recordatorio en minutos antes del inicio (por defecto 1 día) */
  reminderMinutes?: number | null;
};

/** 20261010T170000Z */
export function icsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escapa texto según RFC 5545 (\\, ;, , y saltos de línea). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Pliega líneas largas a 75 octetos (UTF-8) con CRLF + espacio, sin partir caracteres. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = ch;
      currentBytes = bytes;
      limit = 74; // las líneas de continuación empiezan con un espacio
    } else {
      current += ch;
      currentBytes += bytes;
    }
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: IcsEvent): string {
  const now = event.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ivonne & Rosa//Eventos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  const reminder = event.reminderMinutes === undefined ? 24 * 60 : event.reminderMinutes;
  if (reminder && reminder > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.title)}`,
      `TRIGGER:-PT${Math.round(reminder)}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
