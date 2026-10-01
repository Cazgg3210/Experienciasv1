import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, icsDate } from "./ics";

describe("ics", () => {
  it("formatea fechas en UTC básico", () => {
    expect(icsDate(new Date("2026-10-10T17:00:00.000Z"))).toBe("20261010T170000Z");
  });

  it("escapa caracteres especiales", () => {
    expect(escapeIcsText("Lope de Vega 214, depto. 5; Polanco\nPortón negro")).toBe(
      "Lope de Vega 214\\, depto. 5\\; Polanco\\nPortón negro",
    );
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });

  it("pliega líneas largas a 75 octetos sin romper caracteres", () => {
    const line = `DESCRIPTION:${"á".repeat(80)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("genera un VEVENT válido con alarma", () => {
    const ics = buildIcs({
      uid: "ev1@ivonne-rosa",
      title: "Cumpleaños de Sofía",
      startsAt: new Date("2026-10-10T17:00:00.000Z"),
      endsAt: new Date("2026-10-10T21:00:00.000Z"),
      location: "Polanco, Ciudad de México",
      description: "Tu invitación: https://example.com/e/x/y",
      url: "https://example.com/e/x/y",
      now: new Date("2026-10-01T12:00:00.000Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261010T170000Z");
    expect(ics).toContain("DTEND:20261010T210000Z");
    expect(ics).toContain("DTSTAMP:20261001T120000Z");
    expect(ics).toContain("SUMMARY:Cumpleaños de Sofía");
    expect(ics).toContain("LOCATION:Polanco\\, Ciudad de México");
    expect(ics).toContain("TRIGGER:-PT1440M");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.includes("\n") && !/[^\r]\n/.test(ics)).toBe(true);
  });

  it("permite omitir la alarma", () => {
    const ics = buildIcs({
      uid: "x",
      title: "t",
      startsAt: new Date(),
      endsAt: new Date(),
      reminderMinutes: null,
    });
    expect(ics).not.toContain("VALARM");
  });
});
