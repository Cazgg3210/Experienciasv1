import { describe, expect, it } from "vitest";
import { baseInput, fixtureCatalog } from "./catalog.fixture";
import {
  budgetTier,
  buildUserPrompt,
  llmDesignSchema,
  LlmOutputError,
  mapLlmDesign,
  parseLlmJson,
  SYSTEM_PROMPT,
  validateLlmDesign,
  type LlmDesign,
} from "./llm";
import { buildContext, designFromContext } from "./rules-engine";
import { stripPriceMentions } from "./text";

const catalog = fixtureCatalog();

function validLlm(overrides: Partial<Record<keyof LlmDesign, unknown>> = {}) {
  return {
    name: "Brunch Jardín de Sofi",
    concept: "Un brunch entre flores para celebrar los 30 de Sofi.",
    description:
      "Primer párrafo con suficiente texto para describir la mesa y el ambiente.\n\nSegundo párrafo con el menú y las dinámicas del día.",
    palette: [
      { name: "Blush", hex: "#E9C9BE" },
      { name: "Salvia", hex: "a3b18a" },
      { name: "Marfil", hex: "#F7F3EC" },
      { name: "Dorado", hex: "#C6A15B" },
    ],
    experienceId: "exp_birthday-table",
    styleId: "style_romantico",
    menuId: "menu_brunch-garden",
    addOnIds: ["addon_upgrade-floral", "addon_pastel-personalizado"],
    activities: ["Ronda de deseos", "Brindis con cartas de cariño", "Fotos con luz natural"],
    tableDesign: "Mesa larga con lino blush, rosas de jardín y velas encendidas.",
    playlistVibe: "Bossa nova y pop suave para conversar.",
    ...overrides,
  };
}

function rulesFor(input = baseInput()) {
  const ctx = buildContext(input, catalog);
  const rules = designFromContext(ctx);
  return { ctx, rules: { selection: rules.selection, styleId: rules.styleId } };
}

describe("parseLlmJson", () => {
  it("acepta JSON plano, con fences de markdown o con texto alrededor", () => {
    const json = JSON.stringify(validLlm());
    expect(parseLlmJson(json)).toMatchObject({ name: "Brunch Jardín de Sofi" });
    expect(parseLlmJson("```json\n" + json + "\n```")).toMatchObject({ experienceId: "exp_birthday-table" });
    expect(parseLlmJson("Claro, aquí está:\n" + json + "\n¡Disfruta!")).toMatchObject({
      menuId: "menu_brunch-garden",
    });
  });

  it("lanza LlmOutputError en respuestas vacías o malformadas", () => {
    expect(() => parseLlmJson("")).toThrow(LlmOutputError);
    expect(() => parseLlmJson("no hay json aquí")).toThrow(/no contiene/);
    expect(() => parseLlmJson("{ name: 'x', }")).toThrow(/JSON inválido/);
    try {
      parseLlmJson('```json\n{"name": \n```');
    } catch (e) {
      expect((e as LlmOutputError).reason).toBe("invalid_json");
    }
  });
});

describe("validateLlmDesign (Zod)", () => {
  it("acepta la forma esperada y normaliza ids vacíos a null", () => {
    const v = validateLlmDesign(validLlm({ styleId: "", menuId: null }));
    expect(v.styleId).toBeNull();
    expect(v.menuId).toBeNull();
  });

  it("rechaza salidas incompletas o con tipos incorrectos", () => {
    expect(() => validateLlmDesign({ name: "x" })).toThrow(LlmOutputError);
    expect(() => validateLlmDesign(validLlm({ activities: "una sola" }))).toThrow(/esquema/);
    expect(() => validateLlmDesign(validLlm({ palette: [] }))).toThrow(LlmOutputError);
    expect(llmDesignSchema.safeParse(validLlm({ addOnIds: undefined })).success).toBe(true);
  });
});

describe("mapLlmDesign — ids reales", () => {
  it("conserva ids válidos y compatibles", () => {
    const { ctx, rules } = rulesFor(baseInput({ budgetRangeId: "budget_4" }));
    const mapped = mapLlmDesign(ctx, validateLlmDesign(validLlm()), rules);
    expect(mapped.design.experienceId).toBe("exp_birthday-table");
    expect(mapped.design.styleId).toBe("style_romantico");
    expect(mapped.design.menuId).toBe("menu_brunch-garden");
    expect(mapped.design.addOnIds).toEqual(["addon_upgrade-floral", "addon_pastel-personalizado"]);
    expect(mapped.dropped).toEqual([]);
    expect(mapped.design.palette.map((c) => c.hex)).toContain("#A3B18A");
    expect(mapped.design.description).toHaveLength(2);
  });

  it("descarta ids inventados; experiencia desconocida → la del motor de reglas", () => {
    const { ctx, rules } = rulesFor(baseInput({ budgetRangeId: "budget_4" }));
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({
          experienceId: "exp_inventada",
          styleId: "style_futurista",
          menuId: "menu_sushi",
          addOnIds: ["addon_mariachi", "addon_upgrade-floral", "addon_upgrade-floral"],
        }),
      ),
      rules,
    );
    expect(mapped.design.experienceId).toBe(rules.selection.experienceId);
    const exp = catalog.experiences.find((e) => e.id === mapped.design.experienceId)!;
    expect(exp.menuIds).toContain(mapped.design.menuId);
    if (mapped.design.styleId) expect(exp.styleIds).toContain(mapped.design.styleId);
    expect(mapped.design.addOnIds).toEqual(["addon_upgrade-floral"]);
    expect(mapped.dropped).toEqual(
      expect.arrayContaining([
        "experience:exp_inventada",
        "style:style_futurista",
        "menu:menu_sushi",
        "addon:addon_mariachi",
      ]),
    );
  });

  it("descarta add-ons/menús que existen pero no pertenecen a la experiencia elegida", () => {
    const { ctx, rules } = rulesFor(baseInput({ budgetRangeId: "budget_4", occasion: "BACHELORETTE" }));
    // Karaoke & Mimosas no ofrece "Mimosa bar" (ya incluida) ni el menú Sin Gluten
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({
          experienceId: "exp_karaoke-mimosas",
          menuId: "menu_brunch-sin-gluten",
          addOnIds: ["addon_mimosa-bar"],
          styleId: "style_elegante",
        }),
      ),
      rules,
    );
    expect(mapped.design.experienceId).toBe("exp_karaoke-mimosas");
    expect(mapped.design.addOnIds).toEqual([]);
    expect(mapped.design.menuId).not.toBe("menu_brunch-sin-gluten");
    expect(mapped.design.styleId).not.toBe("style_elegante");
  });

  it("reemplaza un menú que rompe restricciones alimentarias cuando hay uno compatible", () => {
    const { ctx, rules } = rulesFor(baseInput({ dietary: ["VEGETARIAN"], budgetRangeId: "budget_4" }));
    const mapped = mapLlmDesign(ctx, validateLlmDesign(validLlm({ menuId: "menu_brunch-premium" })), rules);
    expect(mapped.design.menuId).toBe("menu_brunch-garden");
    expect(mapped.dropped).toContain("menu:menu_brunch-premium:dietary");
  });

  it("no acepta un menú del LLM con alergias en conflicto aunque ninguno cumpla del todo", () => {
    const { ctx, rules } = rulesFor(
      baseInput({ dietary: ["VEGAN", "NUT_ALLERGY"], budgetRangeId: "budget_4" }),
    );
    // Garden tiene pan con nuez: conflicto con alergia a nueces
    const mapped = mapLlmDesign(ctx, validateLlmDesign(validLlm({ menuId: "menu_brunch-garden" })), rules);
    expect(mapped.design.menuId).not.toBe("menu_brunch-garden");
    expect(mapped.dropped).toContain("menu:menu_brunch-garden:dietary");
  });

  it("ajusta al presupuesto quitando extras y borra las frases que los mencionan", () => {
    const { ctx, rules } = rulesFor(baseInput({ budgetRangeId: "budget_2", guestCount: 7 }));
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({
          addOnIds: ["addon_fotografo-2h", "addon_video-recap", "addon_upgrade-floral"],
          description:
            "Una mesa preciosa llena de flores y luz natural para todas. Además sumamos Video recap para recordar el día.\n\nEl menú es fresco y de temporada para todas las invitadas.",
        }),
      ),
      rules,
    );
    expect(mapped.totalCents).toBeLessThanOrEqual(20_000_00);
    expect(mapped.dropped.some((d) => d.endsWith(":budget"))).toBe(true);
    if (!mapped.design.addOnIds.includes("addon_video-recap")) {
      expect(mapped.design.description.join(" ")).not.toMatch(/Video recap/);
    }
  });

  it("nunca deja pasar precios inventados en los textos", () => {
    const { ctx, rules } = rulesFor(baseInput({ budgetRangeId: "budget_4" }));
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({
          concept: "Un brunch precioso por sólo $9,999 MXN. Íntimo y elegante.",
          description:
            "Todo por $12,500 pesos. Una mesa llena de flores para celebrar a Sofi como se merece.",
        }),
      ),
      rules,
    );
    const text = [mapped.design.concept, ...mapped.design.description].join(" ");
    expect(text).not.toMatch(/\$|pesos|MXN/i);
    expect(mapped.design.concept).toMatch(/Íntimo y elegante/);
  });

  it("experiencia real que no cabe en el presupuesto (y la de reglas sí) → manda la de reglas y limpia los textos", () => {
    // 6 personas, otra zona, hasta $15,000: sólo Signature Brunch ($14,900) cabe.
    const input = baseInput({ budgetRangeId: "budget_1", guestCount: 6, serviceArea: "otra" });
    const { ctx, rules } = rulesFor(input);
    expect(rules.selection.experienceId).toBe("exp_signature-brunch");
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({
          experienceId: "exp_birthday-table",
          menuId: "menu_brunch-premium",
          addOnIds: ["addon_mini-karaoke"],
          description:
            "Una mesa preciosa para celebrar a Sofi entre flores y velas encendidas. Nuestra Birthday Table es perfecta para ella.\n\nCerramos con el Mini karaoke y un brindis.",
        }),
      ),
      rules,
    );
    expect(mapped.design.experienceId).toBe("exp_signature-brunch");
    expect(mapped.dropped).toContain("experience:exp_birthday-table:budget");
    expect(mapped.totalCents).toBeLessThanOrEqual(15_000_00);
    const exp = catalog.experiences.find((e) => e.id === "exp_signature-brunch")!;
    for (const id of mapped.design.addOnIds) expect(exp.addOnIds).toContain(id);
    if (mapped.design.menuId) expect(exp.menuIds).toContain(mapped.design.menuId);
    const text = [mapped.design.concept, ...mapped.design.description].join(" ");
    expect(text).not.toMatch(/Birthday Table|Mini karaoke|Brunch Premium/);
    expect(text).toMatch(/Una mesa preciosa/);
  });

  it("experiencia real que no atiende la ocasión (y la de reglas sí) → manda la de reglas", () => {
    const { ctx, rules } = rulesFor(baseInput({ occasion: "BRIDAL", budgetRangeId: "budget_5" }));
    expect(rules.selection.experienceId).toBe("exp_bridal-brunch");
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(validLlm({ experienceId: "exp_karaoke-mimosas" })),
      rules,
    );
    expect(mapped.design.experienceId).toBe("exp_bridal-brunch");
    expect(mapped.dropped).toContain("experience:exp_karaoke-mimosas:occasion");
  });

  it("respeta la experiencia del LLM si atiende la ocasión y cabe en el presupuesto", () => {
    const { ctx, rules } = rulesFor(baseInput({ occasion: "BIRTHDAY", budgetRangeId: "budget_4" }));
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({ experienceId: "exp_peru-x-mexico", menuId: null, styleId: null, addOnIds: [] }),
      ),
      rules,
    );
    expect(mapped.design.experienceId).toBe("exp_peru-x-mexico");
    expect(mapped.dropped.filter((d) => d.startsWith("experience:"))).toEqual([]);
  });

  it("completa la paleta a mínimo 4 colores si el modelo devuelve menos válidos", () => {
    const { ctx, rules } = rulesFor();
    const mapped = mapLlmDesign(
      ctx,
      validateLlmDesign(
        validLlm({
          palette: [
            { name: "Rosa", hex: "#E9C9BE" },
            { name: "Malo", hex: "zzz" },
            { name: "Rosa", hex: "#E9C9BF" },
          ],
        }),
      ),
      rules,
    );
    expect(mapped.design.palette.length).toBeGreaterThanOrEqual(4);
    for (const c of mapped.design.palette) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("prompt", () => {
  it("incluye el catálogo con ids y NO incluye precios", () => {
    const { ctx } = rulesFor();
    const prompt = buildUserPrompt(ctx, { maxExtras: 3, recommendedAddOnIds: ["addon_upgrade-floral"] });
    for (const e of catalog.experiences) expect(prompt).toContain(e.id);
    for (const a of catalog.addOns) expect(prompt).toContain(a.id);
    expect(prompt).not.toMatch(/priceCents|basePrice|\$\s?\d|1490000/);
    expect(prompt).toContain("Mi hermana Sofi");
    expect(SYSTEM_PROMPT).toMatch(/JSON/);
    expect(SYSTEM_PROMPT).toMatch(/NUNCA menciones precios/);
  });

  it("describe el presupuesto de forma cualitativa (sin montos)", () => {
    const tiers = ["budget_1", "budget_3", "budget_5"].map((b) =>
      budgetTier(rulesFor(baseInput({ budgetRangeId: b })).ctx),
    );
    expect(tiers).toEqual(["ajustado", "cómodo", "amplio"]);
    expect(budgetTier(rulesFor(baseInput({ budgetRangeId: "sin-definir" })).ctx)).toBe("sin definir");
  });

  it("stripPriceMentions conserva el texto sin montos", () => {
    expect(stripPriceMentions("Una mesa hermosa. Cuesta $3,000. Con flores.")).toBe(
      "Una mesa hermosa. Con flores.",
    );
    expect(stripPriceMentions("Sin montos aquí.")).toBe("Sin montos aquí.");
  });
});
