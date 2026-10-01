import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  buildCatalogWhere,
  catalogCacheKey,
  catalogFiltersToQuery,
  isSmallGroup,
  isSpecialGroup,
  parseCatalogFilters,
} from "./catalog-filters";

describe("parseCatalogFilters", () => {
  it("acepta slugs en español y valores de enum (sin importar mayúsculas)", () => {
    expect(parseCatalogFilters({ tipo: "brunch", ocasion: "cumpleanos" })).toEqual({ tipo: "BRUNCH", ocasion: "BIRTHDAY" });
    expect(parseCatalogFilters({ tipo: "THEMED", ocasion: "friends_brunch" })).toEqual({ tipo: "THEMED", ocasion: "FRIENDS_BRUNCH" });
    expect(parseCatalogFilters({ tipo: "Celebracion", ocasion: "Despedida" })).toEqual({
      tipo: "CELEBRATION",
      ocasion: "BACHELORETTE",
    });
  });

  it("ignora valores inválidos en lugar de fallar", () => {
    expect(parseCatalogFilters({ tipo: "cena", ocasion: "boda", personas: "muchas", estilo: "<script>" })).toEqual({});
    expect(parseCatalogFilters({ personas: "0" })).toEqual({});
    expect(parseCatalogFilters({ personas: "-3" })).toEqual({});
    expect(parseCatalogFilters({ personas: "8.5" })).toEqual({});
    expect(parseCatalogFilters({ personas: "100000" })).toEqual({});
    expect(parseCatalogFilters({ estilo: "Natural Chic" })).toEqual({});
  });

  it("toma el primer valor si el parámetro viene repetido y recorta espacios", () => {
    expect(parseCatalogFilters({ personas: ["8", "20"], estilo: [" natural ", "minimal"] })).toEqual({
      personas: 8,
      estilo: "natural",
    });
  });

  it("parámetros vacíos no generan filtros", () => {
    expect(parseCatalogFilters({ tipo: "", ocasion: "  ", personas: "", estilo: undefined })).toEqual({});
  });
});

describe("buildCatalogWhere", () => {
  it("sin filtros sólo trae experiencias activas", () => {
    expect(buildCatalogWhere({})).toEqual({ active: true });
  });

  it("combina tipo, ocasión, estilo y rango de personas", () => {
    expect(buildCatalogWhere({ tipo: "BRUNCH", ocasion: "BIRTHDAY", personas: 8, estilo: "natural" })).toEqual({
      AND: [
        { active: true },
        { type: "BRUNCH" },
        { occasions: { has: "BIRTHDAY" } },
        { minGuests: { lte: 8 } },
        { maxGuests: { gte: 8 } },
        { styles: { some: { slug: "natural", active: true } } },
      ],
    });
  });

  it("grupo mayor al estándar (> 12): no limita por maxGuests (consulta especial)", () => {
    expect(buildCatalogWhere({ personas: 20 })).toEqual({ AND: [{ active: true }, { minGuests: { lte: 20 } }] });
  });

  it("respeta límites configurables", () => {
    const where = buildCatalogWhere({ personas: 14 }, { minStandardGuests: 4, maxStandardGuests: 16 });
    expect(where).toEqual({ AND: [{ active: true }, { minGuests: { lte: 14 } }, { maxGuests: { gte: 14 } }] });
  });

  it("en el límite exacto (12) sigue siendo estándar", () => {
    expect(isSpecialGroup(12)).toBe(false);
    expect(isSpecialGroup(13)).toBe(true);
    expect(isSpecialGroup(undefined)).toBe(false);
    expect(isSmallGroup(5)).toBe(true);
    expect(isSmallGroup(6)).toBe(false);
  });
});

describe("serialización de filtros", () => {
  it("genera query canónico con slugs en español", () => {
    expect(catalogFiltersToQuery({ tipo: "BREAKFAST", ocasion: "BABY_BRUNCH", personas: 10, estilo: "minimal" })).toBe(
      "?tipo=desayuno&ocasion=baby-brunch&personas=10&estilo=minimal",
    );
    expect(catalogFiltersToQuery({})).toBe("");
    expect(catalogCacheKey({})).toBe("all");
  });

  it("parse → query → parse es estable (ida y vuelta)", () => {
    const filters = parseCatalogFilters({ tipo: "tematica", ocasion: "corporativo", personas: "9", estilo: "colorido" });
    const qs = new URLSearchParams(catalogFiltersToQuery(filters).slice(1));
    expect(parseCatalogFilters(Object.fromEntries(qs))).toEqual(filters);
  });

  it("cuenta filtros activos", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ tipo: "BRUNCH", personas: 6 })).toBe(2);
  });
});
