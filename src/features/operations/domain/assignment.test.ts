import { describe, expect, it } from "vitest";
import {
  assignmentWarnings,
  defaultAssignmentAmount,
  durationMinutes,
  parseLocalDateTime,
  rangesOverlap,
  suggestedWindow,
  toLocalInputValue,
} from "./assignment";

describe("monto por defecto de una asignación", () => {
  const s = new Date("2026-10-10T15:00:00Z");
  const e = new Date("2026-10-10T20:30:00Z"); // 5.5 h

  it("PER_EVENT usa la tarifa tal cual", () => {
    expect(defaultAssignmentAmount({ rateCents: 120_000, rateType: "PER_EVENT" }, s, e)).toBe(120_000);
  });

  it("PER_HOUR = tarifa × horas (proporcional por minuto)", () => {
    expect(durationMinutes(s, e)).toBe(330);
    expect(defaultAssignmentAmount({ rateCents: 12_000, rateType: "PER_HOUR" }, s, e)).toBe(66_000);
    expect(defaultAssignmentAmount({ rateCents: 10_000, rateType: "PER_HOUR" }, s, new Date("2026-10-10T15:20:00Z"))).toBe(3_333);
  });

  it("rango inválido no genera monto por hora", () => {
    expect(defaultAssignmentAmount({ rateCents: 12_000, rateType: "PER_HOUR" }, e, s)).toBe(0);
  });
});

describe("traslapes y disponibilidad", () => {
  const member = { name: "Alma", availableWeekdays: [0, 5, 6], active: true };
  // 2026-10-10 es sábado; 2026-10-12 es lunes
  const sat = { startsAt: parseLocalDateTime("2026-10-10T10:00")!, endsAt: parseLocalDateTime("2026-10-10T15:00")! };
  const mon = { startsAt: parseLocalDateTime("2026-10-12T10:00")!, endsAt: parseLocalDateTime("2026-10-12T15:00")! };

  it("rangesOverlap es exclusivo en los bordes", () => {
    expect(rangesOverlap(sat.startsAt, sat.endsAt, sat.endsAt, new Date(sat.endsAt.getTime() + 1000))).toBe(false);
    expect(rangesOverlap(sat.startsAt, sat.endsAt, new Date(sat.endsAt.getTime() - 60_000), new Date(sat.endsAt.getTime() + 60_000))).toBe(true);
  });

  it("avisa si no está disponible ese día de la semana (hora CDMX)", () => {
    expect(assignmentWarnings({ member, eventId: "e1", ...sat, others: [] })).toEqual([]);
    const w = assignmentWarnings({ member, eventId: "e1", ...mon, others: [] });
    expect(w).toHaveLength(1);
    expect(w[0]!.kind).toBe("UNAVAILABLE_WEEKDAY");
    expect(w[0]!.message).toContain("lunes");
  });

  it("sin días registrados no genera aviso", () => {
    expect(assignmentWarnings({ member: { ...member, availableWeekdays: [] }, eventId: "e1", ...mon, others: [] })).toEqual([]);
  });

  it("avisa traslape con otro evento (no con el mismo evento)", () => {
    const others = [
      { id: "a1", eventId: "e1", eventTitle: "Mismo evento", startsAt: sat.startsAt, endsAt: sat.endsAt },
      { id: "a2", eventId: "e2", eventTitle: "Brunch de Ana", startsAt: parseLocalDateTime("2026-10-10T14:00")!, endsAt: parseLocalDateTime("2026-10-10T18:00")! },
      { id: "a3", eventId: "e3", eventTitle: "Más tarde", startsAt: parseLocalDateTime("2026-10-10T15:00")!, endsAt: parseLocalDateTime("2026-10-10T18:00")! },
    ];
    const w = assignmentWarnings({ member, eventId: "e1", ...sat, others });
    expect(w.map((x) => x.kind)).toEqual(["OVERLAP"]);
    expect(w[0]!.message).toContain("Brunch de Ana");
  });

  it("avisa si está inactiva", () => {
    expect(assignmentWarnings({ member: { ...member, active: false }, eventId: "e1", ...sat, others: [] })[0]!.kind).toBe("INACTIVE");
  });
});

describe("datetime-local en CDMX", () => {
  it("parsea y formatea ida y vuelta en America/Mexico_City (UTC−6)", () => {
    const d = parseLocalDateTime("2026-10-10T11:00")!;
    expect(d.toISOString()).toBe("2026-10-10T17:00:00.000Z");
    expect(toLocalInputValue(d)).toBe("2026-10-10T11:00");
    expect(toLocalInputValue(null)).toBe("");
  });

  it("rechaza formatos inválidos", () => {
    expect(parseLocalDateTime("2026-10-10 11:00")).toBeNull();
    expect(parseLocalDateTime("hoy")).toBeNull();
  });

  it("rechaza fechas u horas imposibles en vez de recorrerlas", () => {
    expect(parseLocalDateTime("2026-02-30T10:00")).toBeNull();
    expect(parseLocalDateTime("2026-13-01T10:00")).toBeNull();
    expect(parseLocalDateTime("2026-10-10T25:00")).toBeNull();
    expect(parseLocalDateTime("2026-10-10T10:60")).toBeNull();
    expect(parseLocalDateTime("2028-02-29T23:59")!.toISOString()).toBe("2028-03-01T05:59:00.000Z");
  });

  it("sugiere llegada antes y salida después según la función", () => {
    const s = new Date("2026-10-10T17:00:00Z");
    const e = new Date("2026-10-10T21:00:00Z");
    const w = suggestedWindow("COORDINATOR", s, e);
    expect(w.startsAt.toISOString()).toBe("2026-10-10T14:30:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2026-10-10T22:30:00.000Z");
  });
});
