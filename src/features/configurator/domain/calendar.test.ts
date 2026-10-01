import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  addMonths,
  compareYearMonth,
  dayView,
  daysInMonth,
  diffDaysKey,
  longDateLabel,
  monthGrid,
  monthLabel,
  mondayIndex,
} from "./calendar";

describe("calendar helpers", () => {
  it("calcula días del mes (incluye bisiestos)", () => {
    expect(daysInMonth({ year: 2026, month: 1 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 1 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 9 })).toBe(31);
  });

  it("suma meses cruzando años en ambos sentidos", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(compareYearMonth({ year: 2027, month: 0 }, { year: 2026, month: 11 })).toBeGreaterThan(0);
  });

  it("arma la cuadrícula iniciando en lunes", () => {
    // 1 de octubre de 2026 es jueves
    expect(mondayIndex("2026-10-01")).toBe(3);
    const weeks = monthGrid({ year: 2026, month: 9 });
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("formatea etiquetas en español sin depender de la zona horaria", () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe("octubre 2026");
    expect(longDateLabel("2026-10-18")).toBe("domingo 18 de octubre de 2026");
  });

  it("suma y resta días con claves", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDaysKey("2026-10-01", "2026-10-15")).toBe(14);
  });

  it("define qué estados se pueden elegir", () => {
    expect(dayView("AVAILABLE").selectable).toBe(true);
    expect(dayView("LIMITED").selectable).toBe(true);
    expect(dayView("TOO_SOON")).toMatchObject({ selectable: true, tone: "review" });
    expect(dayView("TOO_SOON").note).toMatch(/sujeta a confirmación/);
    expect(dayView("FULL").selectable).toBe(false);
    expect(dayView("CLOSED").selectable).toBe(false);
    expect(dayView("BLOCKED").selectable).toBe(false);
    expect(dayView("PAST").selectable).toBe(false);
  });
});
