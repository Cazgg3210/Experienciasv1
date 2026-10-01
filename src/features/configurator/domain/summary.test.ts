import { describe, expect, it } from "vitest";
import { menuPriceLabel, occasionText, summaryRows } from "./summary";
import { emptyDraft } from "./wizard";

const catalog = {
  areas: [{ id: "a1", name: "Polanco" }],
  styles: [{ id: "s1", name: "Romántico" }],
  experiences: [{ id: "e1", name: "Birthday Table" }],
  menus: [
    { id: "m1", name: "Brunch Clásico", pricingType: "INCLUDED", priceCents: 0 },
    { id: "m2", name: "Brunch Premium", pricingType: "PER_GUEST", priceCents: 38_000 },
  ],
  addOns: [
    { id: "x1", name: "Pastel personalizado" },
    { id: "x2", name: "Mimosa bar" },
  ],
  budgetRanges: [{ id: "b1", label: "$20,000 – $30,000" }],
};

describe("summary", () => {
  it("etiqueta precios de menú", () => {
    expect(menuPriceLabel({ pricingType: "INCLUDED", priceCents: 0 })).toBe("Incluido");
    expect(menuPriceLabel({ pricingType: "PER_GUEST", priceCents: 38_000 })).toMatch(/^\+\$380 por persona$/);
    expect(menuPriceLabel({ pricingType: "FLAT", priceCents: 150_000 })).toMatch(/por evento$/);
  });

  it("describe la ocasión (incluida 'otra')", () => {
    expect(occasionText({ occasion: null, occasionOther: "" })).toBeNull();
    expect(occasionText({ occasion: "BRIDAL", occasionOther: "" })).toBe("Bridal brunch");
    expect(occasionText({ occasion: "OTHER", occasionOther: " Graduación " })).toBe("Otra: Graduación");
  });

  it("arma filas legibles con valores y pasos", () => {
    const rows = summaryRows(
      {
        ...emptyDraft(),
        occasion: "BIRTHDAY",
        eventDate: "2026-10-17",
        startTime: "12:30",
        serviceAreaId: "a1",
        guestCount: 10,
        styleId: "s1",
        experienceId: "e1",
        menuId: "m2",
        addOns: { x1: 2, x2: 1 },
        colors: ["Blush"],
        honoreeName: "Sofía",
        budgetRangeId: "b1",
      },
      catalog,
    );
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel["Fecha"]!.value).toBe("Sábado 17 de octubre de 2026 · 12:30 h");
    expect(byLabel["Zona"]!.value).toBe("Polanco");
    expect(byLabel["Menú"]!.value).toBe("Brunch Premium (+$380 por persona)");
    expect(byLabel["Extras"]!.value).toBe("Pastel personalizado ×2, Mimosa bar");
    expect(byLabel["Presupuesto"]!.value).toBe("$20,000 – $30,000");
    expect(byLabel["Notas"]!.value).toBeNull();
    expect(byLabel["Extras"]!.step).toBe(8);
  });

  it("muestra 'Otra zona' y 'Prefiero platicarlo'", () => {
    const rows = summaryRows(
      { ...emptyDraft(), zoneOther: true, zoneText: "Coyoacán", budgetUndecided: true },
      catalog,
    );
    expect(rows.find((r) => r.label === "Zona")!.value).toBe("Otra zona: Coyoacán");
    expect(rows.find((r) => r.label === "Presupuesto")!.value).toBe("Prefiero platicarlo");
    expect(rows.find((r) => r.label === "Extras")!.value).toBe("Sin extras");
  });
});
