import { describe, expect, it } from "vitest";
import { evaluateAvailability, type AvailabilityContext } from "./availability";

const base: AvailabilityContext = {
  dateKey: "2026-10-17",
  todayKey: "2026-10-01",
  rule: { isOpen: true, maxEvents: 2, earliestStart: "08:00", latestEnd: "21:00" },
  exceptions: [],
  events: [],
  settings: { bufferMinutes: 90, minLeadDays: 5, maxAdvanceDays: 365 },
};

const ev = (id: string, start: string, end: string) => ({
  id,
  startsAt: new Date(start),
  endsAt: new Date(end),
  serviceAreaId: null,
});

describe("evaluateAvailability", () => {
  it("disponible con capacidad libre", () => {
    const r = evaluateAvailability(base);
    expect(r.status).toBe("AVAILABLE");
    expect(r.available).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("último lugar cuando queda 1 de 2", () => {
    const r = evaluateAvailability({ ...base, events: [ev("e1", "2026-10-17T17:00:00Z", "2026-10-17T21:00:00Z")] });
    expect(r.status).toBe("LIMITED");
    expect(r.available).toBe(true);
  });

  it("lleno cuando se alcanza la capacidad (evita double-booking)", () => {
    const r = evaluateAvailability({
      ...base,
      events: [ev("e1", "2026-10-17T15:00:00Z", "2026-10-17T19:00:00Z"), ev("e2", "2026-10-17T22:00:00Z", "2026-10-18T01:00:00Z")],
    });
    expect(r.status).toBe("FULL");
    expect(r.available).toBe(false);
    expect(r.acceptsRequests).toBe(true);
  });

  it("al reprogramar no cuenta el propio evento", () => {
    const r = evaluateAvailability({
      ...base,
      rule: { ...base.rule!, maxEvents: 1 },
      events: [ev("e1", "2026-10-17T15:00:00Z", "2026-10-17T19:00:00Z")],
      excludeEventId: "e1",
    });
    expect(r.available).toBe(true);
  });

  it("día cerrado por regla semanal", () => {
    const r = evaluateAvailability({ ...base, rule: { ...base.rule!, isOpen: false } });
    expect(r.status).toBe("CLOSED");
  });

  it("override de capacidad abre un día cerrado", () => {
    const r = evaluateAvailability({
      ...base,
      rule: { ...base.rule!, isOpen: false },
      exceptions: [{ type: "CAPACITY_OVERRIDE", maxEvents: 3, serviceAreaId: null, reason: null }],
    });
    expect(r.available).toBe(true);
    expect(r.capacity).toBe(3);
  });

  it("bloqueos y blackouts", () => {
    expect(
      evaluateAvailability({ ...base, exceptions: [{ type: "BLOCKED", maxEvents: null, serviceAreaId: null, reason: null }] })
        .status,
    ).toBe("BLOCKED");
    const blackout = evaluateAvailability({
      ...base,
      exceptions: [{ type: "BLACKOUT", maxEvents: null, serviceAreaId: null, reason: "Navidad" }],
    });
    expect(blackout.status).toBe("BLOCKED");
    expect(blackout.reason).toContain("Navidad");
  });

  it("bloqueo de zona sólo aplica a esa zona", () => {
    const ex = [{ type: "BLOCKED" as const, maxEvents: null, serviceAreaId: "z1", reason: null }];
    expect(evaluateAvailability({ ...base, exceptions: ex, serviceAreaId: "z1" }).status).toBe("BLOCKED");
    expect(evaluateAvailability({ ...base, exceptions: ex, serviceAreaId: "z2" }).status).toBe("AVAILABLE");
  });

  it("anticipación mínima, máxima y fechas pasadas", () => {
    expect(evaluateAvailability({ ...base, dateKey: "2026-10-03" }).status).toBe("TOO_SOON");
    expect(evaluateAvailability({ ...base, dateKey: "2028-01-01" }).status).toBe("TOO_FAR");
    expect(evaluateAvailability({ ...base, dateKey: "2026-09-01" }).status).toBe("PAST");
  });

  it("horario fuera de operación", () => {
    const r = evaluateAvailability({ ...base, startTime: "19:30", durationMinutes: 240 });
    expect(r.status).toBe("OUT_OF_HOURS");
  });

  it("con capacidad 1 un traslape con buffer es conflicto", () => {
    const r = evaluateAvailability({
      ...base,
      rule: { ...base.rule!, maxEvents: 1 },
      events: [],
      requestedStartsAt: new Date("2026-10-17T17:00:00Z"),
      requestedEndsAt: new Date("2026-10-17T21:00:00Z"),
    });
    expect(r.available).toBe(true);
    const withOverlap = evaluateAvailability({
      ...base,
      rule: { ...base.rule!, maxEvents: 2 },
      events: [ev("e1", "2026-10-17T21:30:00Z", "2026-10-18T00:00:00Z")],
      requestedStartsAt: new Date("2026-10-17T17:00:00Z"),
      requestedEndsAt: new Date("2026-10-17T21:00:00Z"),
    });
    expect(withOverlap.overlaps).toEqual(["e1"]);
  });
});
