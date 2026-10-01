import { describe, expect, it } from "vitest";
import { parseAiDesignOutput, parseSnapshotContact, parseSnapshotData, parseSnapshotEstimate } from "./snapshot";

const seedLikeData = {
  step: "summary",
  addOns: [{ slug: "pastel-personalizado", quantity: 1 }],
  colors: ["salvia", "marfil"],
  contact: { name: "Gabriela Morales", email: "gabriela@example.com", phone: "+52 55 5102 3315" },
  menuSlug: "brunch-clasico",
  occasion: "BIRTHDAY",
  eventDate: "2026-11-07",
  startTime: "11:00",
  styleSlug: "natural",
  guestCount: 6,
  honoreeName: "Gaby",
  inspiration: null,
  budgetRangeId: "seed-budget-01",
  experienceSlug: "signature-brunch",
  serviceAreaSlug: "polanco",
};

describe("parseSnapshotData", () => {
  it("omite metadatos técnicos del diseñador IA / configurador v2", () => {
    const view = parseSnapshotData({
      design: { name: "Jardín" },
      input: { guestCount: 8 },
      aiDesignId: "abc123",
      promptVersion: "v3",
      meta: { version: 2 },
      startTime: "11:00",
    });
    expect(view.fields.map((f) => f.key)).toEqual(["startTime"]);
  });

  it("extrae referencias de catálogo y campos legibles", () => {
    const view = parseSnapshotData(seedLikeData);
    expect(view.experience).toEqual({ slug: "signature-brunch" });
    expect(view.menu).toEqual({ slug: "brunch-clasico" });
    expect(view.serviceArea).toEqual({ slug: "polanco" });
    expect(view.addOns).toEqual([{ slug: "pastel-personalizado", quantity: 1 }]);
    expect(view.guestCount).toBe(6);
    const byKey = Object.fromEntries(view.fields.map((f) => [f.key, f]));
    expect(byKey.occasion!.value).toBe("Cumpleaños");
    expect(byKey.eventDate!.value).toBe("sábado 7 de noviembre de 2026");
    expect(byKey.colors!.value).toBe("salvia, marfil");
    expect(byKey.honoreeName!.label).toBe("Homenajeada");
    // Internos u omitidos
    expect(byKey.step).toBeUndefined();
    expect(byKey.contact).toBeUndefined();
    expect(byKey.inspiration).toBeUndefined();
  });

  it("soporta ids y formas desconocidas sin lanzar", () => {
    const view = parseSnapshotData({
      experienceId: "exp_1",
      addOns: [{ addOnId: "a1", quantity: "2" }, "papeleria", { foo: 1 }],
      vibeScore: 9,
      nested: { a: 1 },
    });
    expect(view.experience).toEqual({ id: "exp_1" });
    expect(view.addOns).toEqual([
      { id: "a1", quantity: 2 },
      { slug: "papeleria", quantity: 1 },
    ]);
    expect(view.fields).toEqual([{ key: "vibeScore", label: "Vibe score", value: "9" }]);
    expect(parseSnapshotData(null).fields).toEqual([]);
    expect(parseSnapshotData([1, 2]).addOns).toEqual([]);
  });

  it("lee el contacto capturado", () => {
    expect(parseSnapshotContact(seedLikeData)).toEqual({
      name: "Gabriela Morales",
      email: "gabriela@example.com",
      phone: "+52 55 5102 3315",
    });
    expect(parseSnapshotContact({})).toBeNull();
  });
});

describe("parseSnapshotEstimate", () => {
  it("lee el estimado público", () => {
    const est = parseSnapshotEstimate({
      lines: [
        { type: "BASE_EXPERIENCE", quantity: 1, description: "Signature Brunch", unitPriceCents: 1490000, totalPriceCents: 1490000 },
        { description: "sin total" },
      ],
      taxCents: 236552,
      totalCents: 1715000,
      depositCents: 857500,
      pricesIncludeTax: true,
      warnings: ["Grupo grande", { message: "Revisar zona" }],
    });
    expect(est).not.toBeNull();
    expect(est!.lines).toHaveLength(1);
    expect(est!.totalCents).toBe(1715000);
    expect(est!.warnings).toEqual(["Grupo grande", "Revisar zona"]);
    expect(est!.internal).toBeNull();
  });

  it("expone costos internos sólo si el snapshot los trae", () => {
    const est = parseSnapshotEstimate({ totalCents: 100, estimatedCostCents: 60, estimatedMarginCents: 40, marginBps: 4000 });
    expect(est!.internal).toEqual({ estimatedCostCents: 60, estimatedMarginCents: 40, marginBps: 4000 });
  });

  it("separa avisos internos (margen) de los que vio la clienta y lee belowMinMargin", () => {
    const est = parseSnapshotEstimate({
      lines: [{ description: "Base", totalPriceCents: 100 }],
      totalCents: 100,
      estimatedCostCents: 95,
      estimatedMarginCents: 5,
      marginBps: 500,
      belowMinMargin: true,
      warnings: [
        { code: "SPECIAL_REQUEST_GUESTS", message: "Grupo grande" },
        { code: "MARGIN_BELOW_MINIMUM", message: "Margen bajo" },
        { code: "NEGATIVE_MARGIN", message: "Margen negativo" },
        "Aviso sin código",
      ],
    });
    expect(est!.warnings).toEqual(["Grupo grande", "Aviso sin código"]);
    expect(est!.internalWarnings).toEqual(["Margen bajo", "Margen negativo"]);
    expect(est!.internal).toEqual({ estimatedCostCents: 95, estimatedMarginCents: 5, marginBps: 500, belowMinMargin: true });
  });

  it("devuelve null para basura", () => {
    expect(parseSnapshotEstimate("x")).toBeNull();
    expect(parseSnapshotEstimate({ lines: [] })).toBeNull();
  });
});

describe("parseAiDesignOutput", () => {
  it("filtra la paleta a colores hex válidos", () => {
    const view = parseAiDesignOutput({
      title: "Brunch botánico",
      concept: "Mesa larga…",
      palette: ["#F7F3EC", "red; background:url(x)", "#A3B18A"],
      flowers: "Margaritas",
      addOnSlugs: ["taller-floral", "papeleria"],
      estimatedFromCents: 1690000,
    });
    expect(view!.palette).toEqual(["#F7F3EC", "#A3B18A"]);
    expect(view!.details).toEqual(
      expect.arrayContaining([
        { label: "Flores", value: "Margaritas" },
        { label: "Extras sugeridos", value: "taller-floral, papeleria" },
      ]),
    );
    expect(parseAiDesignOutput({})).toBeNull();
  });
});
