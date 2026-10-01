import { describe, expect, it } from "vitest";
import { moveInList, nextSortOrder, normalizeOrder } from "./ordering";
import { faqSchema, galleryAltSchema, testimonialSchema } from "../schemas";

describe("ordenamiento manual", () => {
  const ids = ["a", "b", "c"];
  it("sube y baja", () => {
    expect(moveInList(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInList(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("no mueve fuera de los límites ni ids desconocidos", () => {
    expect(moveInList(ids, "a", "up")).toBeNull();
    expect(moveInList(ids, "c", "down")).toBeNull();
    expect(moveInList(ids, "z", "up")).toBeNull();
  });
  it("normaliza y calcula el siguiente orden", () => {
    expect(normalizeOrder(["x", "y"])).toEqual([
      { id: "x", sortOrder: 1 },
      { id: "y", sortOrder: 2 },
    ]);
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([3, 9, 1])).toBe(10);
  });
});

describe("esquemas de contenido", () => {
  it("testimonio: rating 1–5 y texto mínimo", () => {
    const base = { authorName: "Daniela", occasion: "", body: "Todo fue precioso, gracias.", rating: 5, active: true, sortOrder: 1 };
    expect(testimonialSchema.safeParse(base).success).toBe(true);
    expect(testimonialSchema.safeParse({ ...base, rating: 6 }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, rating: 0 }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, body: "corto" }).success).toBe(false);
  });
  it("FAQ: categorías válidas", () => {
    const base = { question: "¿Cuánto anticipo?", answer: "El 50% confirma tu fecha.", category: "pagos", experienceId: "", active: true, sortOrder: 0 };
    expect(faqSchema.safeParse(base).success).toBe(true);
    expect(faqSchema.safeParse({ ...base, category: "otra" }).success).toBe(false);
  });
  it("galería: texto alternativo obligatorio", () => {
    expect(galleryAltSchema.safeParse({ id: "x1", alt: "  " }).success).toBe(false);
    expect(galleryAltSchema.safeParse({ id: "x1", alt: "Mesa con flores" }).success).toBe(true);
  });
});
