import { describe, expect, it } from "vitest";
import {
  canonicalCostComponents,
  countLabel,
  deactivationMessage,
  deletionDecision,
  diffPriceFields,
  hasNonZeroPricing,
  isAcceptableImageUrl,
  isPermutation,
  joinSpanish,
  moveItem,
  normalizeHexColor,
  normalizePalette,
  normalizePostalCodes,
  normalizeTextList,
  publicMediaPath,
  readableTextOn,
  splitListInput,
} from "./catalog-rules";

describe("normalizeTextList", () => {
  it("trims, collapses spaces and removes empty values", () => {
    expect(normalizeTextList(["  Montaje  de mesa ", "", "   "])).toEqual(["Montaje de mesa"]);
  });
  it("dedupes ignoring case and accents, keeping the first spelling", () => {
    expect(normalizeTextList(["Café", "cafe", "CAFÉ", "Té"])).toEqual(["Café", "Té"]);
  });
  it("can lowercase values (tags)", () => {
    expect(normalizeTextList(["Clásico", "De Temporada"], { lowercase: true })).toEqual(["clásico", "de temporada"]);
  });
});

describe("splitListInput", () => {
  it("splits on commas, semicolons, tabs and new lines", () => {
    expect(splitListInput("06700, 06140;06100\n03100\t 11000")).toEqual(["06700", "06140", "06100", "03100", "11000"]);
  });
});

describe("normalizePostalCodes", () => {
  it("keeps 5-digit codes sorted and unique and reports invalid ones", () => {
    const res = normalizePostalCodes(["06700", "6700", "06100 06700", "abcde", "03100"]);
    expect(res.valid).toEqual(["03100", "06100", "06700"]);
    expect(res.invalid).toEqual(["6700", "abcde"]);
  });
});

describe("hex colors", () => {
  it("normalizes short and uppercase hex", () => {
    expect(normalizeHexColor("#ABC")).toBe("#aabbcc");
    expect(normalizeHexColor("a3b18a")).toBe("#a3b18a");
    expect(normalizeHexColor(" #5C6B4E ")).toBe("#5c6b4e");
  });
  it("rejects invalid colors", () => {
    expect(normalizeHexColor("#12")).toBeNull();
    expect(normalizeHexColor("verde")).toBeNull();
    expect(normalizeHexColor("")).toBeNull();
  });
  it("normalizes palettes dropping invalid and duplicate colors", () => {
    expect(normalizePalette(["#FFF", "#ffffff", "nope", "#5c6b4e"])).toEqual(["#ffffff", "#5c6b4e"]);
  });
  it("chooses readable text color for swatches", () => {
    expect(readableTextOn("#ffffff")).toBe("dark");
    expect(readableTextOn("#1f1f1f")).toBe("light");
  });
});

describe("ordering helpers", () => {
  it("moves items up and down without mutating", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(list, 0, 1)).toEqual(["b", "a", "c"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
  it("ignores moves out of bounds", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
  it("validates permutations", () => {
    expect(isPermutation(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isPermutation(["a", "b"], ["a", "a"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a", "b", "c"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a", "x"])).toBe(false);
  });
});

describe("diffPriceFields", () => {
  const before = { basePriceCents: 1_000_00, extraGuestPriceCents: 900_00, costComponents: [{ amountCents: 10 }] };
  it("returns only changed fields with before/after", () => {
    const after = { ...before, basePriceCents: 1_200_00 };
    const diff = diffPriceFields(before, after, ["basePriceCents", "extraGuestPriceCents", "costComponents"]);
    expect(diff.changed).toBe(true);
    expect(diff.fields).toEqual(["basePriceCents"]);
    expect(diff.before).toEqual({ basePriceCents: 1_000_00 });
    expect(diff.after).toEqual({ basePriceCents: 1_200_00 });
  });
  it("detects changes inside arrays (cost components)", () => {
    const after = { ...before, costComponents: [{ amountCents: 11 }] };
    expect(diffPriceFields(before, after, ["costComponents"]).changed).toBe(true);
  });
  it("reports no change when values are equal", () => {
    expect(diffPriceFields(before, { ...before }, ["basePriceCents", "costComponents"]).changed).toBe(false);
  });
});

describe("canonicalCostComponents / hasNonZeroPricing", () => {
  it("trims descriptions and drops extra keys", () => {
    const res = canonicalCostComponents([
      { category: "FOOD", description: " Flores ", amountCents: 100, perGuest: true, id: "x" } as never,
    ]);
    expect(res).toEqual([{ category: "FOOD", description: "Flores", amountCents: 100, perGuest: true }]);
  });
  it("detects non-zero prices", () => {
    expect(hasNonZeroPricing([0, 0, null, undefined])).toBe(false);
    expect(hasNonZeroPricing([0, 1])).toBe(true);
  });
});

describe("deletion decision", () => {
  it("deletes when there are no references", () => {
    expect(deletionDecision([{ count: 0, one: "evento", many: "eventos" }])).toEqual({ mode: "delete", reasons: [] });
  });
  it("deactivates with pluralized reasons when referenced", () => {
    const d = deletionDecision([
      { count: 1, one: "evento", many: "eventos" },
      { count: 3, one: "cotización", many: "cotizaciones" },
      { count: 0, one: "lead", many: "leads" },
    ]);
    expect(d.mode).toBe("deactivate");
    expect(d.reasons).toEqual(["1 evento", "3 cotizaciones"]);
  });
  it("joins reasons in Spanish", () => {
    expect(joinSpanish(["1 evento"])).toBe("1 evento");
    expect(joinSpanish(["1 evento", "2 leads"])).toBe("1 evento y 2 leads");
    expect(joinSpanish(["a", "b", "c"])).toBe("a, b y c");
  });
  it("builds a gendered explanation", () => {
    expect(deactivationMessage({ label: "el menú", feminine: false }, ["2 experiencias"])).toContain("está ligado a 2 experiencias");
    expect(deactivationMessage({ label: "la zona", feminine: true }, ["1 evento"])).toContain("La desactivamos");
  });
});

describe("image urls", () => {
  it("accepts local paths, https urls and empty", () => {
    expect(isAcceptableImageUrl("")).toBe(true);
    expect(isAcceptableImageUrl("/images/placeholders/hero.svg")).toBe(true);
    expect(isAcceptableImageUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(isAcceptableImageUrl(publicMediaPath("abc123"))).toBe(true);
  });
  it("rejects protocol-relative, javascript and malformed urls", () => {
    expect(isAcceptableImageUrl("//evil.com/x.png")).toBe(false);
    expect(isAcceptableImageUrl("http://cdn.example.com/a.jpg")).toBe(false);
    expect(isAcceptableImageUrl("https://")).toBe(false);
    expect(isAcceptableImageUrl("/images\\..\\x.png")).toBe(false);
    expect(isAcceptableImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAcceptableImageUrl("imagen.png")).toBe(false);
    expect(isAcceptableImageUrl("/images/con espacio.png")).toBe(false);
  });
});

describe("countLabel", () => {
  it("uses singular for one and plural otherwise", () => {
    expect(countLabel(1, "evento", "eventos")).toBe("1 evento");
    expect(countLabel(0, "evento", "eventos")).toBe("0 eventos");
    expect(countLabel(3, "cotización", "cotizaciones")).toBe("3 cotizaciones");
  });
});
