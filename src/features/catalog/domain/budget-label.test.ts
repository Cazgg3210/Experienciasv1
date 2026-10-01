import { describe, expect, it } from "vitest";
import { budgetRangeIssues, formatBudgetRange, suggestBudgetLabel } from "./budget-label";

const strip = (s: string) => s.replace(/\s/g, " ");

describe("suggestBudgetLabel", () => {
  it("suggests labels for open and closed ranges", () => {
    expect(strip(suggestBudgetLabel(0, 15_000_00))).toBe("Hasta $15,000");
    expect(strip(suggestBudgetLabel(15_000_00, 20_000_00))).toBe("$15,000 – $20,000");
    expect(strip(suggestBudgetLabel(45_000_00, null))).toBe("Más de $45,000");
    expect(suggestBudgetLabel(null, null)).toBe("Cualquier presupuesto");
  });
});

describe("formatBudgetRange", () => {
  it("formats ranges for admin lists", () => {
    expect(strip(formatBudgetRange(45_000_00, null))).toBe("$45,000 en adelante");
    expect(strip(formatBudgetRange(0, 15_000_00))).toBe("$0 – $15,000");
  });
});

describe("budgetRangeIssues", () => {
  const r = (id: string, min: number, max: number | null, active = true) => ({ id, label: id, minCents: min, maxCents: max, active });
  it("accepts contiguous ranges", () => {
    expect(budgetRangeIssues([r("a", 0, 100), r("b", 100, 200), r("c", 200, null)])).toEqual([]);
  });
  it("detects gaps, overlaps and open-ended ranges in the middle", () => {
    expect(budgetRangeIssues([r("a", 0, 100), r("b", 150, 200)])[0]).toContain("hueco");
    expect(budgetRangeIssues([r("a", 0, 100), r("b", 50, 200)])[0]).toContain("traslapan");
    expect(budgetRangeIssues([r("a", 0, null), r("b", 50, 200)])[0]).toContain("no tiene máximo");
  });
  it("ignores inactive ranges", () => {
    expect(budgetRangeIssues([r("a", 0, 100), r("x", 20, 30, false), r("b", 100, null)])).toEqual([]);
  });
});
