/**
 * Integración del AI Experience Designer contra la base de pruebas:
 *  - generar (proveedor mock → motor de reglas) persiste AiDesign con usedFallback y prompt "rules";
 *  - camino LLM simulado: valida, mapea ids reales, guarda prompt + modelo;
 *  - salida malformada del LLM → fallback persistido;
 *  - convertir crea un lead con source AI_DESIGNER, snapshot y liga AiDesign.leadId (idempotente).
 * Crea fixtures propios con valores únicos y los elimina al final (no asume datos de seed).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { estimateSelection } from "@/features/quotes/server/pricing";
import { PRICING_VERSION } from "@/features/quotes/domain/quote-engine";
import { MockAIProvider } from "@/server/providers/ai/mock-provider";
import type { AIProvider } from "@/server/providers/ai/types";
import { PROMPT_VERSION, BUDGET_UNKNOWN, OTHER_AREA } from "@/features/ai-designer/constants";
import type { DesignerInput } from "@/features/ai-designer/schemas";
import type { DesignerCatalog } from "@/features/ai-designer/domain/types";
import { loadDesignerCatalog } from "@/features/ai-designer/server/catalog";
import { convertDesignToLead, generateDesign } from "@/features/ai-designer/server/designer-service";
import { uid } from "./helpers";

const u = uid("aid");
const created = { designIds: [] as string[], leadIds: [] as string[], customerIds: [] as string[] };

let styleId = "";
let areaId = "";
let budgetTightId = "";
let budgetWideId = "";
let menuClassicId = "";
let menuGardenId = "";
let addOnFloralId = "";
let addOnKaraokeId = "";
let experienceId = "";
let experienceSlug = "";
let catalog: DesignerCatalog;

function phone(): string {
  return `55${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

function input(over: Partial<DesignerInput> = {}): DesignerInput {
  return {
    occasion: "BIRTHDAY",
    profile: "Mi mejor amiga cumple 35 y ama las flores, el café y cantar",
    honoreeAge: 35,
    guestCount: 8,
    budgetRangeId: budgetWideId,
    tastes: "flores, karaoke y chilaquiles",
    colors: ["#E9C9BE", "#A3B18A"],
    vibes: ["botanico", "divertido"],
    serviceArea: areaId,
    dietary: ["VEGETARIAN"],
    ...over,
  };
}

function fakeLlm(text: string): AIProvider {
  return { name: "fake-llm", isMock: false, complete: async () => ({ text, model: "fake-model-1" }) };
}

beforeAll(async () => {
  const style = await prisma.style.create({
    data: {
      name: `Natural ${u}`,
      slug: `natural-${u}`,
      palette: ["#F7F3EC", "#E8DCC8", "#A3B18A", "#5C6B4E"],
    },
  });
  const area = await prisma.serviceArea.create({
    data: {
      name: `Zona ${u}`,
      slug: `zona-${u}`,
      logisticsFeeCents: 35_000,
      logisticsCostCents: 25_000,
      active: true,
    },
  });
  const tight = await prisma.budgetRange.create({
    data: { label: `Hasta $10,000 ${u}`, minCents: 0, maxCents: 1_000_000, sortOrder: 900 },
  });
  const wide = await prisma.budgetRange.create({
    data: { label: `$30,000 – $45,000 ${u}`, minCents: 3_000_000, maxCents: 4_500_000, sortOrder: 901 },
  });
  const classic = await prisma.menu.create({
    data: {
      name: `Clásico ${u}`,
      slug: `clasico-${u}`,
      pricingType: "INCLUDED",
      priceCents: 0,
      tags: ["clásico"],
      dietaryTags: [],
    },
  });
  const garden = await prisma.menu.create({
    data: {
      name: `Garden ${u}`,
      slug: `garden-${u}`,
      pricingType: "INCLUDED",
      priceCents: 0,
      tags: ["vegetariano", "ligero"],
      dietaryTags: ["VEGETARIAN"],
      items: {
        create: [{ name: "Shakshuka con pan de masa madre", course: "MAIN", dietaryTags: ["VEGETARIAN"] }],
      },
    },
  });
  const floral = await prisma.addOn.create({
    data: {
      name: `Upgrade floral ${u}`,
      slug: `upgrade-floral-${u}`,
      category: "DECOR",
      pricingType: "FLAT",
      priceCents: 250_000,
      costCents: 130_000,
    },
  });
  const karaoke = await prisma.addOn.create({
    data: {
      name: `Mini karaoke ${u}`,
      slug: `mini-karaoke-${u}`,
      category: "ENTERTAINMENT",
      pricingType: "FLAT",
      priceCents: 280_000,
      costCents: 65_000,
    },
  });
  experienceSlug = `cumple-jardin-${u}`;
  const exp = await prisma.experience.create({
    data: {
      name: `Cumple Jardín ${u}`,
      slug: experienceSlug,
      tagline: "Una mesa de cumpleaños entre flores.",
      description: "Mesa de celebración con flores de temporada, velas y brunch a elegir.",
      type: "CELEBRATION",
      occasions: ["BIRTHDAY", "FRIENDS_BRUNCH"],
      basePriceCents: 1_500_000,
      baseGuests: 6,
      minGuests: 6,
      maxGuests: 12,
      extraGuestPriceCents: 150_000,
      extraGuestCostCents: 70_000,
      includes: ["Flores de temporada y velas"],
      styles: { connect: [{ id: style.id }] },
      menus: { connect: [{ id: classic.id }, { id: garden.id }] },
      addOns: { connect: [{ id: floral.id }, { id: karaoke.id }] },
      serviceAreas: { connect: [{ id: area.id }] },
      costComponents: {
        create: [{ category: "FOOD", description: "Insumos", amountCents: 40_000, perGuest: true }],
      },
    },
  });
  styleId = style.id;
  areaId = area.id;
  budgetTightId = tight.id;
  budgetWideId = wide.id;
  menuClassicId = classic.id;
  menuGardenId = garden.id;
  addOnFloralId = floral.id;
  addOnKaraokeId = karaoke.id;
  experienceId = exp.id;
  catalog = await loadDesignerCatalog({ experienceIds: [experienceId] });
});

afterAll(async () => {
  await prisma.aiDesign.deleteMany({ where: { id: { in: created.designIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: created.leadIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: created.customerIds }, leads: { none: {} } } });
  await prisma.experience.deleteMany({ where: { id: experienceId } });
  await prisma.menu.deleteMany({ where: { id: { in: [menuClassicId, menuGardenId] } } });
  await prisma.addOn.deleteMany({ where: { id: { in: [addOnFloralId, addOnKaraokeId] } } });
  await prisma.style.deleteMany({ where: { id: styleId } });
  await prisma.serviceArea.deleteMany({ where: { id: areaId } });
  await prisma.budgetRange.deleteMany({ where: { id: { in: [budgetTightId, budgetWideId] } } });
});

describe("AI designer: catálogo", () => {
  it("carga sólo lo activo y referenciado por la experiencia (sin exponer costos)", () => {
    expect(catalog.experiences.map((e) => e.id)).toEqual([experienceId]);
    expect(catalog.menus.map((m) => m.id).sort()).toEqual([menuClassicId, menuGardenId].sort());
    expect(catalog.addOns.map((a) => a.id).sort()).toEqual([addOnFloralId, addOnKaraokeId].sort());
    expect(catalog.styles.map((s) => s.id)).toEqual([styleId]);
    expect(JSON.stringify(catalog)).not.toMatch(/costCents|costPerGuest/);
  });
});

describe("AI designer: generar", () => {
  it("con proveedor mock usa reglas, cotiza con el motor real y persiste AiDesign (usedFallback)", async () => {
    const view = await generateDesign(input(), { catalog, provider: new MockAIProvider() });
    created.designIds.push(view.id);

    expect(view.experience.id).toBe(experienceId);
    expect(view.experience.href).toBe(`/experiencias/${experienceSlug}`);
    expect(view.menu?.id).toBe(menuGardenId); // vegetariana
    expect(view.configuratorHref).toBe(`/crear-experiencia?experiencia=${experienceSlug}&ocasion=BIRTHDAY`);
    for (const a of view.addOns) expect([addOnFloralId, addOnKaraokeId]).toContain(a.id);

    const { result } = await estimateSelection({
      experienceId,
      guestCount: 8,
      menuId: view.menu?.id ?? null,
      addOns: view.addOns.map((a) => ({ addOnId: a.id, quantity: 1 })),
      serviceAreaId: areaId,
    });
    expect(view.estimate.totalCents).toBe(result.totalCents);
    expect(view.estimate.depositCents).toBe(result.depositCents);
    expect(view.budget?.withinBudget).toBe(true);

    const row = await prisma.aiDesign.findUniqueOrThrow({ where: { id: view.id } });
    expect(row.usedFallback).toBe(true);
    expect(row.provider).toBe("mock");
    expect(row.model).toBeNull();
    expect(row.promptVersion).toBe(PROMPT_VERSION);
    expect(row.prompt).toBe("rules");
    expect(row.leadId).toBeNull();
    const output = row.output as { design: { experienceId: string }; pricing: { totalCents: number } };
    expect(output.design.experienceId).toBe(experienceId);
    expect(output.pricing.totalCents).toBe(result.totalCents);
    expect(JSON.stringify(row.output)).not.toMatch(/estimatedCostCents|marginBps/);
    expect((row.input as { profile: string }).profile).toMatch(/flores/);

    const event = await prisma.analyticsEvent.findFirst({
      where: { type: "AI_DESIGN_GENERATED", experienceId },
      orderBy: { createdAt: "desc" },
    });
    expect((event?.metadata as { aiDesignId?: string } | null)?.aiDesignId).toBe(view.id);
  });

  it("camino LLM: valida, descarta ids inventados y guarda prompt + modelo", async () => {
    const llm = JSON.stringify({
      name: "Cumple Jardín Secreto",
      concept: "Un cumpleaños entre flores, velas y canciones.",
      description: "Una mesa entre flores para celebrar sus 35.\n\nCerramos con karaoke y brindis.",
      palette: [
        { name: "Blush", hex: "#E9C9BE" },
        { name: "Salvia", hex: "#A3B18A" },
        { name: "Marfil", hex: "#F7F3EC" },
        { name: "Oliva", hex: "#5C6B4E" },
      ],
      experienceId,
      styleId,
      menuId: menuGardenId,
      addOnIds: [addOnKaraokeId, "addon-inventado"],
      activities: ["Ronda de deseos", "Karaoke por equipos", "Brindis final"],
      tableDesign: "Mesa larga con lino, follaje y velas.",
      playlistVibe: "Pop de los 2000 para cantar.",
    });
    const view = await generateDesign(input(), { catalog, provider: fakeLlm("```json\n" + llm + "\n```") });
    created.designIds.push(view.id);
    expect(view.name).toBe("Cumple Jardín Secreto");
    expect(view.addOns.map((a) => a.id)).toEqual([addOnKaraokeId]);

    const row = await prisma.aiDesign.findUniqueOrThrow({ where: { id: view.id } });
    expect(row.usedFallback).toBe(false);
    expect(row.provider).toBe("fake-llm");
    expect(row.model).toBe("fake-model-1");
    expect(row.prompt).toContain(experienceId);
    expect(row.prompt).not.toMatch(/\$\s?\d|1500000/);
    expect((row.output as { dropped: string[] }).dropped).toContain("addon:addon-inventado");
  });

  it("salida malformada del LLM → fallback a reglas persistido", async () => {
    const view = await generateDesign(input(), { catalog, provider: fakeLlm("{ esto no es json") });
    created.designIds.push(view.id);
    const row = await prisma.aiDesign.findUniqueOrThrow({ where: { id: view.id } });
    expect(row.usedFallback).toBe(true);
    expect(row.provider).toBe("fake-llm");
    expect(row.prompt).toBe("rules");
    expect((row.output as { fallbackReason: string }).fallbackReason).toBe("invalid_json");
  });

  it("presupuesto que no alcanza → badge con sugerencia y sin extras", async () => {
    const view = await generateDesign(input({ budgetRangeId: budgetTightId, guestCount: 10 }), {
      catalog,
      provider: new MockAIProvider(),
    });
    created.designIds.push(view.id);
    expect(view.budget?.withinBudget).toBe(false);
    expect(view.budget?.suggestion).toMatch(/presupuesto: te sugerimos/);
    expect(view.addOns).toEqual([]);
  });

  it("acepta «otra zona» y presupuesto sin definir", async () => {
    const view = await generateDesign(
      input({ serviceArea: OTHER_AREA, zoneText: "Coyoacán", budgetRangeId: BUDGET_UNKNOWN }),
      { catalog, provider: new MockAIProvider() },
    );
    created.designIds.push(view.id);
    expect(view.budget).toBeNull();
    expect(view.estimate.lines.some((l) => l.description.startsWith("Logística"))).toBe(false);
  });

  it("rechaza presupuesto o zona que no existen con errores por campo", async () => {
    await expect(
      generateDesign(input({ budgetRangeId: "no-existe", serviceArea: "zona-fantasma" }), {
        catalog,
        provider: new MockAIProvider(),
      }),
    ).rejects.toMatchObject({
      name: "ValidationError",
      fieldErrors: { budgetRangeId: expect.any(Array), serviceArea: expect.any(Array) },
    });
  });
});

describe("AI designer: convertir a lead", () => {
  it("crea lead AI_DESIGNER con snapshot y liga AiDesign.leadId (idempotente)", async () => {
    const view = await generateDesign(input(), { catalog, provider: new MockAIProvider() });
    created.designIds.push(view.id);
    const ph = phone();
    const email = `${uid("ai")}@example.test`;

    const res = await convertDesignToLead({
      designId: view.id,
      name: "Valeria Prueba IA",
      phone: `${ph.slice(0, 2)} ${ph.slice(2, 6)} ${ph.slice(6)}`,
      email,
      eventDate: "",
      consent: true,
      marketingOptIn: true,
    });
    expect(res.alreadySubmitted).toBe(false);
    expect(res.code).toMatch(/^L-/);
    expect(res.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { code: res.code },
      include: { snapshot: true, activities: true },
    });
    created.leadIds.push(lead.id);
    if (lead.customerId) created.customerIds.push(lead.customerId);
    expect(lead.source).toBe("AI_DESIGNER");
    expect(lead.experienceId).toBe(experienceId);
    expect(lead.styleId).toBe(view.style?.id ?? null);
    expect(lead.menuId).toBe(view.menu?.id ?? null);
    expect(lead.occasion).toBe("BIRTHDAY");
    expect(lead.guestCount).toBe(8);
    expect(lead.serviceAreaId).toBe(areaId);
    expect(lead.budgetRangeId).toBe(budgetWideId);
    expect(lead.colors).toEqual(view.palette.map((c) => c.hex));
    expect(lead.notes).toContain(view.name);
    expect(lead.notes).toContain(view.concept);
    expect(lead.notes).toContain("Actividades:");
    expect(lead.estimatedTotalCents).toBe(view.estimate.totalCents);
    expect(lead.snapshot?.pricingVersion).toBe(PRICING_VERSION);
    const snap = lead.snapshot!.data as {
      design: { experienceId: string };
      input: { profile: string };
      aiDesignId: string;
    };
    expect(snap.design.experienceId).toBe(experienceId);
    expect(snap.aiDesignId).toBe(view.id);
    expect((lead.snapshot!.estimate as { totalCents: number }).totalCents).toBe(view.estimate.totalCents);
    expect(lead.activities.some((a) => a.type === "CREATED")).toBe(true);

    const row = await prisma.aiDesign.findUniqueOrThrow({ where: { id: view.id } });
    expect(row.leadId).toBe(lead.id);

    const again = await convertDesignToLead({
      designId: view.id,
      name: "Valeria Prueba IA",
      phone: ph,
      email,
      consent: true,
    });
    expect(again).toMatchObject({ code: res.code, alreadySubmitted: true });
    expect(await prisma.lead.count({ where: { notes: { contains: view.id } } })).toBe(1);
  });

  it("doble envío simultáneo crea un solo lead y ambos reciben el mismo folio", async () => {
    const view = await generateDesign(input(), { catalog, provider: new MockAIProvider() });
    created.designIds.push(view.id);
    const ph = phone();
    const payload = { designId: view.id, name: "Doble Clic", phone: ph, consent: true as const };
    const [a, b] = await Promise.all([convertDesignToLead(payload), convertDesignToLead(payload)]);
    expect(a.code).toBe(b.code);
    expect([a.alreadySubmitted, b.alreadySubmitted].sort()).toEqual([false, true]);
    const leads = await prisma.lead.findMany({
      where: { notes: { contains: view.id } },
      select: { id: true, customerId: true },
    });
    for (const l of leads) {
      created.leadIds.push(l.id);
      if (l.customerId) created.customerIds.push(l.customerId);
    }
    expect(leads).toHaveLength(1);
    const row = await prisma.aiDesign.findUniqueOrThrow({ where: { id: view.id } });
    expect(row.leadId).toBe(leads[0]!.id);
  });

  it("el estimado público trae subtotal/IVA/anticipo coherentes con el motor", async () => {
    const view = await generateDesign(input(), { catalog, provider: new MockAIProvider() });
    created.designIds.push(view.id);
    const { result } = await estimateSelection({
      experienceId,
      guestCount: 8,
      menuId: view.menu?.id ?? null,
      addOns: view.addOns.map((a) => ({ addOnId: a.id, quantity: 1 })),
      serviceAreaId: areaId,
    });
    expect(view.estimate.subtotalCents).toBe(result.subtotalCents);
    expect(view.estimate.taxCents).toBe(result.taxCents);
    expect(view.estimate.depositPercent).toBe(result.depositBps / 100);
    const linesTotal = view.estimate.lines.reduce((s, l) => s + l.totalPriceCents, 0);
    expect(linesTotal).toBe(view.estimate.subtotalCents);
    const shown = view.estimate.taxIncluded
      ? view.estimate.subtotalCents - view.estimate.discountCents
      : view.estimate.subtotalCents - view.estimate.discountCents + view.estimate.taxCents;
    expect(shown).toBe(view.estimate.totalCents);
  });

  it("otra zona → lead marcado fuera de cobertura con la zona indicada", async () => {
    const view = await generateDesign(input({ serviceArea: OTHER_AREA, zoneText: "Coyoacán" }), {
      catalog,
      provider: new MockAIProvider(),
    });
    created.designIds.push(view.id);
    const res = await convertDesignToLead({
      designId: view.id,
      name: "Ana Fuera",
      phone: phone(),
      consent: true,
    });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { code: res.code } });
    created.leadIds.push(lead.id);
    if (lead.customerId) created.customerIds.push(lead.customerId);
    expect(lead.outOfArea).toBe(true);
    expect(lead.zoneText).toBe("Coyoacán");
    expect(lead.serviceAreaId).toBeNull();
  });

  it("rechaza fechas pasadas y diseños inexistentes", async () => {
    const view = await generateDesign(input(), { catalog, provider: new MockAIProvider() });
    created.designIds.push(view.id);
    await expect(
      convertDesignToLead({
        designId: view.id,
        name: "Pasada",
        phone: phone(),
        eventDate: "2020-01-01",
        consent: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      convertDesignToLead({
        designId: "cnoexiste0000000000000000",
        name: "Nadie",
        phone: phone(),
        consent: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
