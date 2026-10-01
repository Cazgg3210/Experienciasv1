import { describe, expect, it } from "vitest";
import { effectiveDateRange, hasActiveFilters, parseEventFilters, sortDirection } from "./event-filters";

describe("parseEventFilters", () => {
  it("usa próximos por defecto e ignora basura", () => {
    const f = parseEventFilters({
      status: ["CONFIRMED", "NOPE", "CONFIRMED"],
      period: "x",
      from: "2026-13-01",
      q: "  ",
    });
    expect(f).toEqual({
      statuses: ["CONFIRMED"],
      period: "upcoming",
      from: null,
      to: null,
      experienceId: null,
      serviceAreaId: null,
      q: null,
    });
    expect(hasActiveFilters(f)).toBe(true);
  });
  it("acepta estados separados por coma, periodo y rango válidos", () => {
    const f = parseEventFilters({
      status: "PLANNING,READY",
      period: "past",
      from: "2026-09-01",
      to: "2026-09-30",
      experience: "cmexp0000000001",
      zone: "bad id!",
      q: "Sofía",
    });
    expect(f.statuses).toEqual(["PLANNING", "READY"]);
    expect(f.period).toBe("past");
    expect(f.from).toBe("2026-09-01");
    expect(f.experienceId).toBe("cmexp0000000001");
    expect(f.serviceAreaId).toBeNull();
    expect(f.q).toBe("Sofía");
  });
  it("sin filtros no está activo", () => {
    expect(hasActiveFilters(parseEventFilters({}))).toBe(false);
  });
});

describe("effectiveDateRange", () => {
  const today = "2026-10-01";
  const yesterday = "2026-09-30";
  it("próximos arranca hoy (o después si el rango lo pide)", () => {
    expect(effectiveDateRange({ period: "upcoming", from: null, to: null }, today, yesterday)).toEqual({
      gte: today,
      lte: null,
    });
    expect(
      effectiveDateRange({ period: "upcoming", from: "2026-08-01", to: "2026-12-31" }, today, yesterday),
    ).toEqual({ gte: today, lte: "2026-12-31" });
    expect(
      effectiveDateRange({ period: "upcoming", from: "2026-11-01", to: null }, today, yesterday).gte,
    ).toBe("2026-11-01");
  });
  it("pasados termina ayer", () => {
    expect(effectiveDateRange({ period: "past", from: null, to: "2026-12-01" }, today, yesterday)).toEqual({
      gte: null,
      lte: yesterday,
    });
  });
  it("todos respeta el rango explícito", () => {
    expect(effectiveDateRange({ period: "all", from: "2026-01-01", to: null }, today, yesterday)).toEqual({
      gte: "2026-01-01",
      lte: null,
    });
  });
  it("orden", () => {
    expect(sortDirection("upcoming")).toBe("asc");
    expect(sortDirection("past")).toBe("desc");
  });
});
