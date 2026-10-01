import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/quotes/domain/quote-engine";
import { DIETARY_VALUES, OCCASION_VALUES, VIBE_VALUES, BUDGET_UNKNOWN, OTHER_AREA } from "../constants";
import { designerInputSchema } from "../schemas";
import { baseInput, fixtureCatalog } from "./catalog.fixture";
import {
  buildContext,
  designWithRules,
  DesignerCatalogError,
  evaluateBudget,
  fitSelectionToBudget,
  priceOf,
  rankAddOns,
  rankExperiences,
} from "./rules-engine";
import type { DesignerCatalog } from "./types";

const catalog = fixtureCatalog();

/** Precio "real" con el QuoteEngine (sin costos) para validar que el motor de reglas cuadra. */
function engineTotal(
  c: DesignerCatalog,
  sel: { experienceId: string; menuId: string | null; addOnIds: string[] },
  guests: number,
  areaId: string | null,
) {
  const e = c.experiences.find((x) => x.id === sel.experienceId)!;
  const m = sel.menuId ? c.menus.find((x) => x.id === sel.menuId)! : null;
  const area = areaId ? (c.areas.find((a) => a.id === areaId) ?? null) : null;
  return calculateQuote({
    experience: { ...e, extraGuestCostCents: 0, costComponents: [] },
    guestCount: guests,
    menu: m ? { ...m, costPerGuestCents: 0 } : null,
    addOns: sel.addOnIds.map((id) => {
      const a = c.addOns.find((x) => x.id === id)!;
      return { ...a, costCents: 0, costCategory: "OTHER" as const, quantity: 1 };
    }),
    serviceArea: area ? { ...area, logisticsCostCents: 0 } : null,
    settings: c.pricing,
  }).totalCents;
}

describe("rules engine — sólo ids reales", () => {
  it("cualquier combinación devuelve experiencia/menú/estilo/add-ons del catálogo y compatibles entre sí", () => {
    const budgets = [...catalog.budgets.map((b) => b.id), BUDGET_UNKNOWN];
    let checked = 0;
    for (const occasion of OCCASION_VALUES) {
      for (const [i, vibe] of VIBE_VALUES.entries()) {
        const input = baseInput({
          occasion,
          occasionOther: occasion === "OTHER" ? "graduación" : undefined,
          vibes: [vibe, VIBE_VALUES[(i + 3) % VIBE_VALUES.length]!],
          budgetRangeId: budgets[i % budgets.length]!,
          guestCount: 6 + ((i * 5) % 35),
          dietary: [DIETARY_VALUES[i % DIETARY_VALUES.length]!],
          serviceArea: i % 4 === 0 ? OTHER_AREA : "area_granada",
        });
        const { design } = designWithRules(input, catalog);
        const exp = catalog.experiences.find((e) => e.id === design.experienceId);
        expect(exp).toBeDefined();
        if (design.menuId) expect(exp!.menuIds).toContain(design.menuId);
        if (design.styleId) expect(exp!.styleIds).toContain(design.styleId);
        for (const id of design.addOnIds) expect(exp!.addOnIds).toContain(id);
        expect(new Set(design.addOnIds).size).toBe(design.addOnIds.length);
        expect(design.addOnIds.length).toBeLessThanOrEqual(4);
        checked++;
      }
    }
    expect(checked).toBe(OCCASION_VALUES.length * VIBE_VALUES.length);
  });

  it("ignora presupuesto/zona inexistentes sin romperse", () => {
    const { design, fit } = designWithRules(
      baseInput({ budgetRangeId: "no-existe", serviceArea: "zona-fantasma" }),
      catalog,
    );
    expect(catalog.experiences.map((e) => e.id)).toContain(design.experienceId);
    expect(fit.budget).toBeNull();
    expect(fit.overBudget).toBe(false);
  });

  it("lanza DesignerCatalogError si no hay experiencias", () => {
    expect(() => designWithRules(baseInput(), { ...catalog, experiences: [] })).toThrow(DesignerCatalogError);
  });
});

describe("rules engine — determinismo", () => {
  it("mismo input → misma propuesta (textos incluidos)", () => {
    const a = designWithRules(baseInput(), catalog);
    const b = designWithRules(baseInput(), fixtureCatalog());
    expect(a).toEqual(b);
  });

  it("inputs distintos producen nombres variados", () => {
    const names = new Set(
      VIBE_VALUES.map(
        (v) => designWithRules(baseInput({ vibes: [v], occasion: "FRIENDS_BRUNCH" }), catalog).design.name,
      ),
    );
    expect(names.size).toBeGreaterThanOrEqual(VIBE_VALUES.length - 1);
  });
});

describe("rules engine — presupuesto", () => {
  it("respeta el presupuesto cuando es posible (total del QuoteEngine ≤ máximo)", () => {
    for (const guestCount of [6, 7, 8]) {
      const input = baseInput({
        budgetRangeId: "budget_2",
        guestCount,
        vibes: ["fiestero", "glam"],
        occasion: "FRIENDS_BRUNCH",
      });
      const { design, fit } = designWithRules(input, catalog);
      const total = engineTotal(catalog, design, guestCount, "area_polanco");
      expect(fit.estimatedTotalCents).toBe(total);
      expect(total).toBeLessThanOrEqual(20_000_00);
      expect(fit.overBudget).toBe(false);
      expect(fit.suggestion).toBeNull();
    }
  });

  it("con más presupuesto sugiere más extras (sin pasarse)", () => {
    const tight = designWithRules(baseInput({ budgetRangeId: "budget_2", guestCount: 6 }), catalog);
    const roomy = designWithRules(baseInput({ budgetRangeId: "budget_4", guestCount: 6 }), catalog);
    expect(roomy.design.addOnIds.length).toBeGreaterThan(tight.design.addOnIds.length);
    expect(roomy.fit.estimatedTotalCents).toBeLessThanOrEqual(45_000_00);
  });

  it("baja de menú upgrade cuando sólo así entra en el presupuesto", () => {
    // glam prefiere Brunch Premium (+$380 por persona); con $20k y 8 personas no cabe.
    const input = baseInput({
      budgetRangeId: "budget_2",
      guestCount: 8,
      vibes: ["glam"],
      occasion: "FRIENDS_BRUNCH",
      tastes: "",
    });
    const { design, fit } = designWithRules(input, catalog);
    const menu = catalog.menus.find((m) => m.id === design.menuId)!;
    expect(fit.estimatedTotalCents).toBeLessThanOrEqual(20_000_00);
    expect(menu.pricingType).toBe("INCLUDED");
  });

  it("marca sobre-presupuesto con sugerencia concreta cuando no hay forma de entrar", () => {
    const input = baseInput({
      budgetRangeId: "budget_1",
      guestCount: 20,
      occasion: "BRIDAL",
      vibes: ["romantico"],
    });
    const { fit, design } = designWithRules(input, catalog);
    expect(fit.overBudget).toBe(true);
    expect(fit.suggestion).toMatch(
      /^(Se pasa un poco de tu presupuesto|Esta propuesta queda arriba de tu presupuesto): te sugerimos /,
    );
    expect(design.addOnIds).toEqual([]);
  });

  it("usa «un poco» cuando se pasa por poco (≤15%)", () => {
    // Signature Brunch 6 personas + logística Polanco = $15,250 contra tope de $15,000
    const input = baseInput({
      budgetRangeId: "budget_1",
      guestCount: 6,
      occasion: "FRIENDS_BRUNCH",
      vibes: ["relajado"],
    });
    const { fit, design } = designWithRules(input, catalog);
    expect(design.experienceId).toBe("exp_signature-brunch");
    expect(fit.overBudget).toBe(true);
    expect(fit.suggestion).toMatch(/^Se pasa un poco de tu presupuesto/);
  });

  it("fitSelectionToBudget quita primero los add-ons de menor afinidad", () => {
    const ctx = buildContext(
      baseInput({ budgetRangeId: "budget_2", guestCount: 6, vibes: ["divertido"] }),
      catalog,
    );
    const ranked = rankAddOns(ctx, catalog.experiences[1]!).map((r) => r.addOn.id);
    const all = ranked.slice(0, 5);
    const fitted = fitSelectionToBudget(ctx, {
      experienceId: "exp_birthday-table",
      menuId: "menu_brunch-clasico",
      addOnIds: all,
    });
    expect(fitted.totalCents).toBeLessThanOrEqual(20_000_00);
    // los que quedan son prefijo del ranking (los mejores)
    for (const id of fitted.addOnIds) expect(all).toContain(id);
    expect(priceOf(ctx, fitted)).toBe(fitted.totalCents);
  });

  it("evaluateBudget sin presupuesto definido nunca marca sobre-presupuesto", () => {
    const ctx = buildContext(baseInput({ budgetRangeId: BUDGET_UNKNOWN, guestCount: 30 }), catalog);
    const fit = evaluateBudget(ctx, {
      experienceId: "exp_bridal-brunch",
      menuId: "menu_brunch-premium",
      addOnIds: [],
    });
    expect(fit.overBudget).toBe(false);
    expect(fit.budget).toBeNull();
  });
});

describe("rules engine — ocasión, vibras y menú", () => {
  it("despedida fiestera → Karaoke & Mimosas", () => {
    const { design } = designWithRules(
      baseInput({ occasion: "BACHELORETTE", vibes: ["fiestero", "divertido"], guestCount: 10 }),
      catalog,
    );
    expect(design.experienceId).toBe("exp_karaoke-mimosas");
  });

  it("bridal romántico → Bridal Brunch", () => {
    const { design } = designWithRules(
      baseInput({ occasion: "BRIDAL", vibes: ["romantico", "botanico"], budgetRangeId: "budget_4" }),
      catalog,
    );
    expect(design.experienceId).toBe("exp_bridal-brunch");
  });

  it("la experiencia elegida siempre atiende la ocasión cuando existe alguna que la atienda", () => {
    for (const occasion of OCCASION_VALUES.filter((o) => o !== "OTHER")) {
      const { design } = designWithRules(baseInput({ occasion, budgetRangeId: "budget_4" }), catalog);
      const exp = catalog.experiences.find((e) => e.id === design.experienceId)!;
      expect(exp.occasions).toContain(occasion);
    }
  });

  it("vibra divertida/fiestera sugiere entretenimiento (karaoke) si la experiencia lo ofrece", () => {
    const ctx = buildContext(
      baseInput({ vibes: ["fiestero", "divertido"], occasion: "BIRTHDAY", tastes: "" }),
      catalog,
    );
    const ranked = rankAddOns(
      ctx,
      catalog.experiences.find((e) => e.id === "exp_birthday-table")!,
    );
    expect(ranked[0]!.addOn.category).toBe("ENTERTAINMENT");
  });

  it("vibra glam prioriza decoración/personalización/foto", () => {
    const ctx = buildContext(baseInput({ vibes: ["glam"], tastes: "", occasion: "GATHERING" }), catalog);
    const top = rankAddOns(ctx, catalog.experiences[0]!)
      .slice(0, 3)
      .map((r) => r.addOn.category);
    expect(top.some((c) => ["DECOR", "PERSONALIZATION", "PHOTO"].includes(c))).toBe(true);
  });

  it("vibra botánica sugiere algo floral", () => {
    const { design } = designWithRules(
      baseInput({ vibes: ["botanico"], budgetRangeId: "budget_4", tastes: "" }),
      catalog,
    );
    expect(design.addOnIds.some((id) => id.includes("floral"))).toBe(true);
  });

  it("restricción vegetariana → menú con dietaryTags compatibles", () => {
    const { design, dietaryNote } = designWithRules(baseInput({ dietary: ["VEGETARIAN"] }), catalog);
    const menu = catalog.menus.find((m) => m.id === design.menuId)!;
    expect(menu.dietaryTags).toContain("VEGETARIAN");
    expect(dietaryNote).toMatch(/vegetarianas/);
  });

  it("sin gluten → Brunch Sin Gluten", () => {
    const { design } = designWithRules(baseInput({ dietary: ["GLUTEN_FREE"] }), catalog);
    expect(design.menuId).toBe("menu_brunch-sin-gluten");
  });

  it("alergia a mariscos evita menús con ceviche/salmón aunque la vibra sea cultural", () => {
    const input = baseInput({
      dietary: ["SEAFOOD_ALLERGY"],
      vibes: ["cultural"],
      tastes: "comida peruana",
      budgetRangeId: "budget_5",
    });
    const { design } = designWithRules(input, catalog);
    expect(design.menuId).not.toBe("menu_sabores-peru-mexico");
    expect(design.menuId).not.toBe("menu_brunch-premium");
  });

  it("vegana sin menú vegano → parte del menú vegetariano", () => {
    const { design } = designWithRules(
      baseInput({ dietary: ["VEGAN"], occasion: "BRIDAL", vibes: ["romantico"], budgetRangeId: "budget_4" }),
      catalog,
    );
    expect(design.menuId).toBe("menu_brunch-garden");
  });

  it("vegana + alergia a nueces → evita nueces y el menú con más proteína animal", () => {
    const { design } = designWithRules(
      baseInput({
        dietary: ["VEGAN", "NUT_ALLERGY"],
        occasion: "BRIDAL",
        vibes: ["romantico"],
        budgetRangeId: "budget_4",
        tastes: "",
        profile: "Bridal shower de Ana",
      }),
      catalog,
    );
    expect(design.menuId).toBe("menu_brunch-clasico");
  });

  it("restricciones no cubribles generan nota de alternativas", () => {
    const { dietaryNote } = designWithRules(baseInput({ dietary: ["VEGAN", "NUT_ALLERGY"] }), catalog);
    expect(dietaryNote).toMatch(/alternativas/);
    expect(dietaryNote).toMatch(/veganas/);
  });

  it("gustos explícitos (karaoke) empujan la experiencia y los extras", () => {
    const ranked = rankExperiences(
      buildContext(baseInput({ tastes: "nos encanta cantar karaoke", vibes: ["divertido"] }), catalog),
    );
    expect(ranked[0]!.experience.id).toBe("exp_karaoke-mimosas");
  });
});

describe("rules engine — textos y paleta", () => {
  it("propuesta completa: nombre, concepto, 3 párrafos, 4–5 colores, actividades, mesa y playlist", () => {
    const { design } = designWithRules(baseInput(), catalog);
    expect(design.name.length).toBeGreaterThan(3);
    expect(design.concept.endsWith(".")).toBe(true);
    expect(design.description).toHaveLength(3);
    expect(design.palette.length).toBeGreaterThanOrEqual(4);
    expect(design.palette.length).toBeLessThanOrEqual(5);
    for (const c of design.palette) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(design.palette[0]!.hex).toBe("#E9C9BE");
    expect(design.palette[0]!.name).toBe("Blush");
    expect(design.activities.length).toBeGreaterThanOrEqual(3);
    expect(design.tableDesign).toMatch(/tonos/);
    expect(design.playlistVibe).toMatch(/los 2000|pop/);
  });

  it("nunca menciona precios en los textos", () => {
    for (const vibe of VIBE_VALUES) {
      const { design } = designWithRules(baseInput({ vibes: [vibe] }), catalog);
      const all = [
        design.name,
        design.concept,
        ...design.description,
        ...design.activities,
        design.tableDesign,
        design.playlistVibe,
      ].join(" ");
      expect(all).not.toMatch(/\$\s?\d/);
    }
  });

  it("menciona la edad sólo en cumpleaños y cita el perfil", () => {
    const bday = designWithRules(baseInput({ honoreeAge: 40 }), catalog).design.description.join(" ");
    expect(bday).toMatch(/40 años/);
    expect(bday).toMatch(/Sofi/);
    const brunch = designWithRules(
      baseInput({ honoreeAge: 40, occasion: "FRIENDS_BRUNCH" }),
      catalog,
    ).design.description.join(" ");
    expect(brunch).not.toMatch(/40 años/);
  });

  it("actividades sin duplicados ni casi-duplicados; teaser sin dobles dos puntos", () => {
    for (const occasion of OCCASION_VALUES) {
      for (const vibe of VIBE_VALUES) {
        const { design } = designWithRules(
          baseInput({ occasion, occasionOther: "graduación", vibes: [vibe, "relajado"] }),
          catalog,
        );
        const norm = design.activities.map((a) => a.toLowerCase());
        for (const [i, a] of norm.entries()) {
          for (const [j, b] of norm.entries()) if (i !== j) expect(a.includes(b)).toBe(false);
        }
        const teaser = design.description[1]!.split("Entre plato y plato: ")[1] ?? "";
        expect(teaser.includes(":")).toBe(false);
      }
    }
  });

  it("la mesa sólo menciona extras visuales (no regalos)", () => {
    const { design } = designWithRules(
      baseInput({
        occasion: "BABY_BRUNCH",
        vibes: ["minimal", "intimo"],
        budgetRangeId: "sin-definir",
        tastes: "postres",
      }),
      catalog,
    );
    expect(design.tableDesign).not.toMatch(/Regalo/);
  });

  it("actividades no prometen extras que no se eligieron", () => {
    const { design } = designWithRules(
      baseInput({ budgetRangeId: "budget_1", guestCount: 6, occasion: "BRIDAL" }),
      catalog,
    );
    const hasTaller = design.addOnIds.includes("addon_taller-floral");
    expect(design.activities.some((a) => a.startsWith("Taller floral guiado"))).toBe(hasTaller);
  });

  it("el esquema de entrada valida el formulario", () => {
    expect(designerInputSchema.safeParse(baseInput()).success).toBe(true);
    const bad = designerInputSchema.safeParse({ ...baseInput(), guestCount: 3, vibes: [], colors: ["rojo"] });
    expect(bad.success).toBe(false);
    const other = designerInputSchema.safeParse({ ...baseInput(), occasion: "OTHER", occasionOther: "" });
    expect(other.success).toBe(false);
  });
});
