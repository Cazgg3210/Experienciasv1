import { describe, expect, it } from "vitest";
import { axisTicks, niceMax, pct, sparklinePoints } from "./chart-utils";

describe("chart-utils", () => {
  it("niceMax redondea a 1/2/2.5/5 × 10^n", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(2_100_000)).toBe(2_500_000);
    expect(niceMax(4_500_000)).toBe(5_000_000);
    expect(niceMax(1000)).toBe(1000);
  });
  it("axisTicks", () => {
    expect(axisTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
  });
  it("pct acota entre 0 y 100", () => {
    expect(pct(50, 200)).toBe(25);
    expect(pct(500, 200)).toBe(100);
    expect(pct(-1, 200)).toBe(0);
    expect(pct(10, 0)).toBe(0);
  });
  it("sparklinePoints normaliza al viewBox", () => {
    expect(sparklinePoints([])).toBe("");
    expect(sparklinePoints([5])).toBe("50,15");
    expect(sparklinePoints([0, 10], 100, 30, 0)).toBe("0,30 100,0");
    expect(sparklinePoints([3, 3, 3], 100, 30, 0)).toBe("0,15 50,15 100,15");
  });
});
