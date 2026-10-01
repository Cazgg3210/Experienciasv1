import { describe, expect, it } from "vitest";
import {
  dayCapacityBadge,
  gridRange,
  monthGrid,
  monthLabel,
  parseMonthParam,
  shiftMonth,
} from "./calendar-month";
import { normalizeWeeklyRules, validateWeeklyRules } from "./weekly-rules";

describe("parseMonthParam", () => {
  it("acepta YYYY-MM válido y cae al mes actual si no", () => {
    expect(parseMonthParam("2026-11", "2026-10-01")).toBe("2026-11");
    expect(parseMonthParam(["2026-12", "2027-01"], "2026-10-01")).toBe("2026-12");
    expect(parseMonthParam("2026-13", "2026-10-01")).toBe("2026-10");
    expect(parseMonthParam("hola", "2026-10-01")).toBe("2026-10");
    expect(parseMonthParam(undefined, "2026-10-01")).toBe("2026-10");
    expect(parseMonthParam("1990-01", "2026-10-01")).toBe("2026-10");
  });
});

describe("shiftMonth / monthLabel", () => {
  it("cruza años", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("etiqueta en español", () => {
    expect(monthLabel("2026-10")).toBe("octubre 2026");
  });
});

describe("monthGrid", () => {
  it("octubre 2026 empieza en jueves: semanas lunes→domingo completas", () => {
    const weeks = monthGrid("2026-10");
    expect(weeks[0]![0]!.dateKey).toBe("2026-09-28"); // lunes
    expect(weeks[0]![3]!.dateKey).toBe("2026-10-01"); // jueves
    expect(weeks[0]![0]!.inMonth).toBe(false);
    const last = weeks[weeks.length - 1]!;
    expect(last[6]!.weekday).toBe(0); // domingo
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
  });
  it("febrero 2027 (inicia en lunes) usa 4 semanas", () => {
    const weeks = monthGrid("2027-02");
    expect(weeks[0]![0]!.dateKey).toBe("2027-02-01");
    expect(weeks).toHaveLength(4);
  });
  it("rango de la cuadrícula ≤ 42 días", () => {
    const r = gridRange(monthGrid("2026-08"));
    expect(r.days % 7).toBe(0);
    expect(r.days).toBeLessThanOrEqual(42);
    expect(r.fromKey <= "2026-08-01").toBe(true);
  });
});

describe("dayCapacityBadge", () => {
  it("cerrado / bloqueado / lleno / libres / pasado", () => {
    expect(dayCapacityBadge({ status: "CLOSED", remaining: 0, capacity: 0, booked: 0 })?.label).toBe(
      "Cerrado",
    );
    expect(dayCapacityBadge({ status: "BLOCKED", remaining: 0, capacity: 0, booked: 0 })?.label).toBe(
      "Bloqueado",
    );
    expect(dayCapacityBadge({ status: "FULL", remaining: 0, capacity: 2, booked: 2 })?.label).toBe("Lleno");
    expect(dayCapacityBadge({ status: "AVAILABLE", remaining: 2, capacity: 2, booked: 0 })?.label).toBe(
      "2 libres",
    );
    expect(dayCapacityBadge({ status: "LIMITED", remaining: 1, capacity: 2, booked: 1 })?.label).toBe(
      "1 libre",
    );
    expect(dayCapacityBadge({ status: "TOO_SOON", remaining: 0, capacity: 1, booked: 1 })?.label).toBe(
      "Lleno",
    );
    expect(dayCapacityBadge({ status: "PAST", remaining: 0, capacity: 0, booked: 0 })).toBeNull();
  });
});

describe("reglas semanales", () => {
  it("completa los 7 días en orden lunes→domingo", () => {
    const rules = normalizeWeeklyRules([
      { weekday: 6, isOpen: true, maxEvents: 3, earliestStart: "09:00", latestEnd: "20:00" },
    ]);
    expect(rules.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(rules.find((r) => r.weekday === 6)?.maxEvents).toBe(3);
    expect(rules.find((r) => r.weekday === 1)?.maxEvents).toBe(2);
  });
  it("valida horarios, capacidad de días abiertos y que estén los 7 días", () => {
    const ok = normalizeWeeklyRules([]);
    expect(validateWeeklyRules(ok)).toEqual({});
    const bad = ok.map((r) =>
      r.weekday === 2 ? { ...r, latestEnd: "07:00" } : r.weekday === 3 ? { ...r, maxEvents: 0 } : r,
    );
    const errors = validateWeeklyRules(bad);
    expect(errors[2]).toMatch(/posterior/);
    expect(errors[3]).toMatch(/al menos 1/);
    expect(validateWeeklyRules(ok.slice(0, 6))[-1]).toMatch(/7 días/);
  });
});
