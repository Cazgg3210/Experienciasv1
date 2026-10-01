import { describe, expect, it } from "vitest";
import { buildFilterOptions, describeFilters } from "./filter-options";

const facets = {
  types: ["BRUNCH" as const, "THEMED" as const],
  occasions: ["BIRTHDAY" as const, "BRIDAL" as const],
  styles: [
    { slug: "natural", name: "Natural" },
    { slug: "minimal", name: "Minimal" },
  ],
};
const bounds = { minStandardGuests: 6, maxStandardGuests: 12 };

describe("buildFilterOptions", () => {
  it("sólo ofrece valores presentes en el catálogo, en orden de etiquetas", () => {
    const o = buildFilterOptions(facets, {}, bounds);
    expect(o.tipo.options).toEqual([
      { value: "brunch", label: "Brunch" },
      { value: "tematica", label: "Temática" },
    ]);
    expect(o.ocasion.options.map((x) => x.value)).toEqual(["cumpleanos", "bridal"]);
    expect(o.estilo.options.map((x) => x.value)).toEqual(["natural", "minimal"]);
    expect(o.hasActiveFilters).toBe(false);
  });

  it("personas: 6..12 + 'Más de 12'", () => {
    const o = buildFilterOptions(facets, {}, bounds);
    expect(o.personas.options.map((x) => x.value)).toEqual(["6", "7", "8", "9", "10", "11", "12", "13"]);
    expect(o.personas.options.at(-1)!.label).toBe("Más de 12");
  });

  it("refleja el valor actual aunque no esté en las opciones", () => {
    const o = buildFilterOptions(facets, { tipo: "BREAKFAST", personas: 20, estilo: "vintage" }, bounds);
    expect(o.tipo.value).toBe("desayuno");
    expect(o.tipo.options.map((x) => x.value)).toContain("desayuno");
    expect(o.personas.value).toBe("20");
    expect(o.personas.options.at(-1)).toEqual({ value: "20", label: "20 personas" });
    expect(o.estilo.options.map((x) => x.value)).toContain("vintage");
    expect(o.hasActiveFilters).toBe(true);
    const small = buildFilterOptions(facets, { personas: 4 }, bounds);
    expect(small.personas.options[0]).toEqual({ value: "4", label: "4 personas" });
  });
});

describe("describeFilters", () => {
  it("resume filtros activos en español", () => {
    expect(describeFilters({ ocasion: "BIRTHDAY", personas: 8, estilo: "natural" }, "Natural")).toBe(
      "Cumpleaños · 8 personas · Natural",
    );
    expect(describeFilters({})).toBe("");
  });
});
