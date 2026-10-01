import { describe, expect, it } from "vitest";
import {
  emptyDraft,
  firstInvalidStep,
  firstName,
  joinSpanishList,
  normalizeMxPhone10,
  parseOccasionParam,
  reconcileWithExperience,
  sanitizeDraft,
  startTimeOptions,
  stepForField,
  toEstimateSelection,
  toSubmitSelections,
  validateStep,
  type ConfiguratorDraft,
  type StepContext,
} from "./wizard";
import { availabilityQuerySchema, contactSchema, isRealDateKey, submitConfiguratorSchema } from "../schemas";

const ctx: StepContext = { guestsMin: 2, guestsMax: 40, compatibleMenuIds: ["m1", "m2"] };

const complete = (): ConfiguratorDraft => ({
  ...emptyDraft(),
  occasion: "BIRTHDAY",
  eventDate: "2026-11-14",
  startTime: "11:00",
  serviceAreaId: "polanco",
  guestCount: 8,
  styleId: "romantico",
  experienceId: "birthday",
  menuId: "m1",
  addOns: { karaoke: 1 },
  budgetRangeId: "b2",
});

describe("validateStep", () => {
  it("paso 1 exige ocasión y texto si es 'otra'", () => {
    const d = emptyDraft();
    expect(validateStep(1, d, ctx)).toMatch(/Elige/);
    expect(validateStep(1, { ...d, occasion: "OTHER", occasionOther: " " }, ctx)).toMatch(/Cuéntanos/);
    expect(validateStep(1, { ...d, occasion: "OTHER", occasionOther: "Graduación" }, ctx)).toBeNull();
    expect(validateStep(1, { ...d, occasion: "BRIDAL" }, ctx)).toBeNull();
  });

  it("paso 2 exige fecha válida, no llena, y hora", () => {
    const d = complete();
    expect(validateStep(2, { ...d, eventDate: null }, ctx)).toMatch(/fecha/);
    expect(validateStep(2, d, { ...ctx, unavailableDates: new Set(["2026-11-14"]) })).toMatch(/otra fecha/);
    expect(validateStep(2, { ...d, startTime: "" }, ctx)).toMatch(/hora/);
    expect(validateStep(2, d, ctx)).toBeNull();
  });

  it("paso 3 acepta zona activa u 'otra zona' con texto", () => {
    const d = { ...complete(), serviceAreaId: null };
    expect(validateStep(3, d, ctx)).toMatch(/zona/);
    expect(validateStep(3, { ...d, zoneOther: true, zoneText: "" }, ctx)).toMatch(/colonia/);
    expect(validateStep(3, { ...d, zoneOther: true, zoneText: "Coyoacán" }, ctx)).toBeNull();
  });

  it("paso 4 respeta mínimo y máximo", () => {
    expect(validateStep(4, { ...complete(), guestCount: 1 }, ctx)).toMatch(/mínimo/);
    expect(validateStep(4, { ...complete(), guestCount: 41 }, ctx)).toMatch(/WhatsApp/);
    expect(validateStep(4, { ...complete(), guestCount: 16 }, ctx)).toBeNull();
  });

  it("paso 5 exige estilo, salvo que el catálogo no tenga estilos activos", () => {
    expect(validateStep(5, { ...complete(), styleId: null }, ctx)).toMatch(/estilo/);
    expect(validateStep(5, { ...complete(), styleId: null }, { ...ctx, hasStyles: false })).toBeNull();
    expect(validateStep(5, complete(), ctx)).toBeNull();
  });

  it("paso 7 sólo acepta menús compatibles (u omite si no hay menús)", () => {
    expect(validateStep(7, { ...complete(), menuId: null }, ctx)).toMatch(/menú/);
    expect(validateStep(7, { ...complete(), menuId: "otro" }, ctx)).toMatch(/no está disponible/);
    expect(validateStep(7, { ...complete(), menuId: null }, { ...ctx, compatibleMenuIds: [] })).toBeNull();
  });

  it("paso 10 acepta rango o 'prefiero platicarlo'", () => {
    expect(validateStep(10, { ...complete(), budgetRangeId: null }, ctx)).toMatch(/rango/);
    expect(validateStep(10, { ...complete(), budgetRangeId: null, budgetUndecided: true }, ctx)).toBeNull();
  });

  it("firstInvalidStep encuentra el primer paso pendiente", () => {
    expect(firstInvalidStep(complete(), ctx)).toBeNull();
    expect(firstInvalidStep({ ...complete(), styleId: null }, ctx)).toBe(5);
    expect(firstInvalidStep(emptyDraft(), ctx)).toBe(1);
  });
});

describe("helpers", () => {
  it("normaliza teléfonos MX a 10 dígitos", () => {
    expect(normalizeMxPhone10("55 1234 5678")).toBe("5512345678");
    expect(normalizeMxPhone10("+52 55 1234-5678")).toBe("5512345678");
    expect(normalizeMxPhone10("+521 55 1234 5678")).toBe("5512345678");
    expect(normalizeMxPhone10("12345")).toBeNull();
    expect(normalizeMxPhone10("")).toBeNull();
  });

  it("genera horarios de 08:00 a 18:00 cada 30 min", () => {
    const opts = startTimeOptions();
    expect(opts[0]).toBe("08:00");
    expect(opts.at(-1)).toBe("18:00");
    expect(opts).toHaveLength(21);
  });

  it("une listas en español con y/e", () => {
    expect(joinSpanishList(["Polanco", "Granada", "Irrigación"])).toBe("Polanco, Granada e Irrigación");
    expect(joinSpanishList(["Polanco", "Granada"])).toBe("Polanco y Granada");
    expect(joinSpanishList(["Polanco"])).toBe("Polanco");
    expect(joinSpanishList([])).toBe("");
  });

  it("toma el primer nombre y parsea la ocasión del query string", () => {
    expect(firstName("  Lucía  Fernández ")).toBe("Lucía");
    expect(parseOccasionParam("birthday")).toBe("BIRTHDAY");
    expect(parseOccasionParam("baby-brunch")).toBe("BABY_BRUNCH");
    expect(parseOccasionParam(["BRIDAL"])).toBe("BRIDAL");
    expect(parseOccasionParam("CORPORATE")).toBeNull();
    expect(parseOccasionParam(undefined)).toBeNull();
  });

  it("mapea campos del servidor al paso correspondiente", () => {
    expect(stepForField("eventDate")).toBe(2);
    expect(stepForField("addOns.0.quantity")).toBe(8);
    expect(stepForField("phone")).toBeNull();
  });
});

describe("reconcileWithExperience", () => {
  const catalog = {
    menus: [
      { id: "m-premium", pricingType: "PER_GUEST" },
      { id: "m-clasico", pricingType: "INCLUDED" },
    ],
    addOns: [
      { id: "a1", maxQuantity: 2 },
      { id: "a2", maxQuantity: 1 },
    ],
  };

  it("quita menú y add-ons incompatibles y preselecciona un menú incluido", () => {
    const d = { ...complete(), menuId: "m-x", addOns: { a1: 5, a2: 1, zzz: 1 } };
    const r = reconcileWithExperience(d, { menuIds: ["m-premium", "m-clasico"], addOnIds: ["a1"] }, catalog);
    expect(r.menuId).toBe("m-clasico");
    expect(r.addOns).toEqual({ a1: 2 });
  });

  it("conserva el menú si sigue siendo compatible", () => {
    const d = { ...complete(), menuId: "m-premium", addOns: {} };
    const r = reconcileWithExperience(d, { menuIds: ["m-premium", "m-clasico"], addOnIds: [] }, catalog);
    expect(r.menuId).toBe("m-premium");
  });

  it("sin experiencia limpia menú y extras", () => {
    const r = reconcileWithExperience(complete(), null, catalog);
    expect(r.menuId).toBeNull();
    expect(r.addOns).toEqual({});
  });
});

describe("sanitizeDraft", () => {
  const ids = {
    styles: new Set(["romantico"]),
    experiences: new Set(["birthday"]),
    menus: new Set(["m1"]),
    addOns: new Set(["karaoke"]),
    areas: new Set(["polanco"]),
    budgets: new Set(["b2"]),
  };
  const defaults = { guestCount: 8, startTime: "11:00", guestsMin: 2, guestsMax: 40 };

  it("restaura un borrador válido", () => {
    expect(sanitizeDraft(complete(), ids, defaults)).toEqual(complete());
  });

  it("descarta IDs que ya no existen y valores corruptos", () => {
    const r = sanitizeDraft(
      {
        occasion: "HACK",
        eventDate: "mañana",
        startTime: "99:99",
        styleId: "borrado",
        experienceId: "birthday",
        guestCount: 500,
        addOns: { karaoke: 2, borrado: 1, karaoke2: "x" },
        colors: ["Blush", 3, ""],
        notes: "x".repeat(2000),
      },
      ids,
      defaults,
    )!;
    expect(r.occasion).toBeNull();
    expect(r.eventDate).toBeNull();
    expect(r.startTime).toBe("11:00");
    expect(r.styleId).toBeNull();
    expect(r.experienceId).toBe("birthday");
    expect(r.guestCount).toBe(40);
    expect(r.addOns).toEqual({ karaoke: 2 });
    expect(r.colors).toEqual(["Blush"]);
    expect(r.notes).toHaveLength(1000);
  });

  it("descarta una fecha guardada que ya pasó", () => {
    const r = sanitizeDraft({ ...complete(), eventDate: "2026-09-01" }, ids, {
      ...defaults,
      todayKey: "2026-10-01",
    })!;
    expect(r.eventDate).toBeNull();
    const ok = sanitizeDraft(complete(), ids, { ...defaults, todayKey: "2026-10-01" })!;
    expect(ok.eventDate).toBe("2026-11-14");
  });

  it("devuelve null para basura", () => {
    expect(sanitizeDraft(null, ids, defaults)).toBeNull();
    expect(sanitizeDraft("hola", ids, defaults)).toBeNull();
  });
});

describe("payloads", () => {
  it("arma la selección del estimado (sin zona si es 'otra')", () => {
    expect(toEstimateSelection(emptyDraft())).toBeNull();
    const sel = toEstimateSelection({ ...complete(), zoneOther: true, zoneText: "Roma" })!;
    expect(sel).toEqual({
      experienceId: "birthday",
      guestCount: 8,
      menuId: "m1",
      addOns: [{ addOnId: "karaoke", quantity: 1 }],
      serviceAreaId: null,
    });
  });

  it("el payload final pasa la validación Zod del servidor", () => {
    const payload = {
      ...toSubmitSelections(complete()),
      name: "Lucía Fernández",
      phone: "55 1234 5678",
      email: "",
      consent: true,
      marketingOptIn: false,
    };
    expect(submitConfiguratorSchema.safeParse(payload).success).toBe(true);
  });

  it("Zod rechaza 'otra zona' sin texto y consentimiento faltante", () => {
    const payload = {
      ...toSubmitSelections({ ...complete(), zoneOther: true, zoneText: "" }),
      name: "Lucía",
      phone: "5512345678",
      email: "",
      consent: false,
      marketingOptIn: false,
    };
    const r = submitConfiguratorSchema.safeParse(payload);
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("zoneText");
    expect(paths).toContain("consent");
  });

  it("Zod exige presupuesto (rango o ‘prefiero platicarlo’) y acepta estilo nulo e id de envío", () => {
    const contact = { name: "Lucía", phone: "5512345678", email: "", consent: true, marketingOptIn: false };
    const noBudget = submitConfiguratorSchema.safeParse({
      ...toSubmitSelections({ ...complete(), budgetRangeId: null, budgetUndecided: false }),
      ...contact,
    });
    expect(noBudget.success).toBe(false);
    expect(noBudget.success ? [] : noBudget.error.issues.map((i) => i.path.join("."))).toContain(
      "budgetRangeId",
    );

    const sel = toSubmitSelections({
      ...complete(),
      styleId: null,
      budgetRangeId: null,
      budgetUndecided: true,
    });
    expect(sel.styleId).toBeNull();
    expect(sel.budgetRangeId).toBeNull();
    const ok = submitConfiguratorSchema.safeParse({
      ...sel,
      ...contact,
      submissionId: "0b6f3c1e-8f0a-4c55-9d7e-3f2a1b0c9d8e",
    });
    expect(ok.success).toBe(true);
    const badId = submitConfiguratorSchema.safeParse({ ...sel, ...contact, submissionId: "x;drop" });
    expect(badId.success).toBe(false);
  });

  it("sólo acepta fechas que existen en el calendario", () => {
    expect(isRealDateKey("2026-11-14")).toBe(true);
    expect(isRealDateKey("2028-02-29")).toBe(true);
    expect(isRealDateKey("2026-02-29")).toBe(false);
    expect(isRealDateKey("2026-13-01")).toBe(false);
    expect(isRealDateKey("2026-1-1")).toBe(false);
    expect(availabilityQuerySchema.safeParse({ from: "2026-02-31", days: 30 }).success).toBe(false);
    expect(availabilityQuerySchema.safeParse({ from: "2026-10-01", days: 31 }).success).toBe(true);
  });

  it("el formulario de contacto valida teléfono y correo", () => {
    const bad = contactSchema.safeParse({
      name: "A",
      phone: "123",
      email: "no-es-correo",
      consent: true,
      marketingOptIn: false,
    });
    expect(bad.success).toBe(false);
    const ok = contactSchema.safeParse({
      name: "Ana",
      phone: "+52 55 1234 5678",
      email: "ana@example.com",
      consent: true,
      marketingOptIn: true,
    });
    expect(ok.success).toBe(true);
  });
});
