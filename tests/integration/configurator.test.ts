/**
 * Integración del configurador: llama directamente a los servicios detrás de las Server Actions
 * (submitConfigurator / estimateConfiguration / getConfiguratorAvailability) contra la base de pruebas.
 * Crea fixtures propios con valores únicos y los elimina al final (no asume datos de seed).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/db";
import { dateOnly, localDateKey } from "@/lib/dates";
import { estimateSelection } from "@/features/quotes/server/pricing";
import { PRICING_VERSION } from "@/features/quotes/domain/quote-engine";
import { getSettings } from "@/features/settings/server/settings-service";
import { addDaysKey } from "@/features/configurator/domain/calendar";
import {
  estimateConfiguration,
  getConfiguratorAvailability,
  submitConfigurator,
} from "@/features/configurator/server/configurator-service";
import { parseSnapshotData } from "@/features/leads/domain/snapshot";
import { getLeadPrefill } from "@/features/quotes/server/quote-queries";
import { uid } from "./helpers";

const u = uid("cfg");
const created = { leadIds: [] as string[], customerIds: [] as string[], exceptionIds: [] as string[] };

let styleId = "";
let areaId = "";
let inactiveAreaId = "";
let inactiveAreaName = "";
let menuId = "";
let otherMenuId = "";
let addOnId = "";
let foreignAddOnId = "";
let experienceId = "";
let longExperienceId = "";
let budgetId = "";
let openDate = "";
let fullDate = "";

function phone(): string {
  // 10 dígitos únicos por prueba
  return `55${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

function baseInput(over: Record<string, unknown> = {}) {
  const ph = phone();
  return {
    occasion: "BIRTHDAY",
    occasionOther: "",
    eventDate: openDate,
    startTime: "11:00",
    serviceAreaId: areaId,
    zoneText: null,
    guestCount: 8,
    styleId,
    experienceId,
    menuId,
    addOns: [{ addOnId, quantity: 1 }],
    colors: ["Blush", "Salvia"],
    honoreeName: "Sofía",
    notes: "Una invitada es celiaca.",
    inspiration: "https://pin.it/ejemplo",
    budgetRangeId: budgetId,
    budgetUndecided: false,
    name: "Lucía Prueba Configurador",
    phone: `${ph.slice(0, 2)} ${ph.slice(2, 6)} ${ph.slice(6)}`,
    email: `${uid("lucia")}@example.test`,
    consent: true,
    marketingOptIn: true,
    sessionId: `sess-${u}`,
    ...over,
  };
}

async function track(result: { leadId: string; customerId: string }) {
  created.leadIds.push(result.leadId);
  created.customerIds.push(result.customerId);
}

beforeAll(async () => {
  const availability = await getSettings("availability");
  const offset = Math.max(availability.minLeadDays + 30, Math.min(200, availability.maxAdvanceDays - 20));
  const today = localDateKey();
  openDate = addDaysKey(today, offset + Math.floor(Math.random() * 10));
  fullDate = addDaysKey(openDate, 1);

  const style = await prisma.style.create({
    data: { name: `Estilo ${u}`, slug: `estilo-${u}`, palette: ["#F7F3EC", "#A3B18A"] },
  });
  const area = await prisma.serviceArea.create({
    data: {
      name: `Zona ${u}`,
      slug: `zona-${u}`,
      logisticsFeeCents: 35_000,
      logisticsCostCents: 20_000,
      active: true,
    },
  });
  const inactive = await prisma.serviceArea.create({
    data: { name: `Próxima ${u}`, slug: `proxima-${u}`, logisticsFeeCents: 60_000, active: false },
  });
  const menu = await prisma.menu.create({
    data: {
      name: `Menú ${u}`,
      slug: `menu-${u}`,
      pricingType: "PER_GUEST",
      priceCents: 20_000,
      costPerGuestCents: 15_000,
    },
  });
  const otherMenu = await prisma.menu.create({
    data: {
      name: `Otro menú ${u}`,
      slug: `otro-menu-${u}`,
      pricingType: "INCLUDED",
      priceCents: 0,
      costPerGuestCents: 9_000,
    },
  });
  const addOn = await prisma.addOn.create({
    data: {
      name: `Pastel ${u}`,
      slug: `pastel-${u}`,
      pricingType: "FLAT",
      priceCents: 50_000,
      costCents: 25_000,
      maxQuantity: 2,
      leadTimeDays: 5,
    },
  });
  const foreignAddOn = await prisma.addOn.create({
    data: {
      name: `Karaoke ${u}`,
      slug: `karaoke-${u}`,
      pricingType: "FLAT",
      priceCents: 280_000,
      costCents: 65_000,
    },
  });
  const experience = await prisma.experience.create({
    data: {
      name: `Experiencia ${u}`,
      slug: `experiencia-${u}`,
      description: "Experiencia de prueba",
      occasions: ["BIRTHDAY"],
      basePriceCents: 1_000_000,
      baseGuests: 6,
      minGuests: 6,
      maxGuests: 12,
      extraGuestPriceCents: 100_000,
      extraGuestCostCents: 50_000,
      durationMinutes: 180,
      styles: { connect: [{ id: style.id }] },
      menus: { connect: [{ id: menu.id }] },
      addOns: { connect: [{ id: addOn.id }] },
      serviceAreas: { connect: [{ id: area.id }] },
      costComponents: {
        create: [
          { category: "FOOD", description: "Insumos", amountCents: 40_000, perGuest: true },
          { category: "STAFF", description: "Staff", amountCents: 250_000, perGuest: false },
        ],
      },
    },
  });
  // Experiencia muy larga: con inicio 18:00 termina fuera del horario de cualquier regla del día
  const longExperience = await prisma.experience.create({
    data: {
      name: `Maratón ${u}`,
      slug: `maraton-${u}`,
      description: "Experiencia de prueba larga",
      occasions: ["BIRTHDAY"],
      basePriceCents: 1_000_000,
      baseGuests: 6,
      minGuests: 6,
      maxGuests: 12,
      extraGuestPriceCents: 100_000,
      durationMinutes: 600,
      styles: { connect: [{ id: style.id }] },
      menus: { connect: [{ id: menu.id }] },
      serviceAreas: { connect: [{ id: area.id }] },
    },
  });
  longExperienceId = longExperience.id;
  const budget = await prisma.budgetRange.create({
    data: { label: `Rango ${u}`, minCents: 1_000_000, maxCents: 2_000_000, sortOrder: 999 },
  });
  // Fecha abierta (sin importar reglas del TEST db) y fecha llena para la zona de prueba
  const open = await prisma.availabilityException.create({
    data: { date: dateOnly(openDate), type: "CAPACITY_OVERRIDE", maxEvents: 5, reason: `test ${u}` },
  });
  const full = await prisma.availabilityException.create({
    data: {
      date: dateOnly(fullDate),
      type: "CAPACITY_OVERRIDE",
      maxEvents: 0,
      serviceAreaId: area.id,
      reason: `test ${u}`,
    },
  });
  created.exceptionIds.push(open.id, full.id);

  styleId = style.id;
  areaId = area.id;
  inactiveAreaId = inactive.id;
  inactiveAreaName = inactive.name;
  menuId = menu.id;
  otherMenuId = otherMenu.id;
  addOnId = addOn.id;
  foreignAddOnId = foreignAddOn.id;
  experienceId = experience.id;
  budgetId = budget.id;
});

afterAll(async () => {
  await prisma.lead.deleteMany({ where: { id: { in: created.leadIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: created.customerIds }, leads: { none: {} } } });
  await prisma.availabilityException.deleteMany({ where: { id: { in: created.exceptionIds } } });
  await prisma.experience.deleteMany({ where: { id: { in: [experienceId, longExperienceId] } } });
  await prisma.menu.deleteMany({ where: { id: { in: [menuId, otherMenuId] } } });
  await prisma.addOn.deleteMany({ where: { id: { in: [addOnId, foreignAddOnId] } } });
  await prisma.style.deleteMany({ where: { id: styleId } });
  await prisma.serviceArea.deleteMany({ where: { id: { in: [areaId, inactiveAreaId] } } });
  await prisma.budgetRange.deleteMany({ where: { id: budgetId } });
});

describe("configurador: envío final", () => {
  it("crea clienta + lead + snapshot con el total calculado en servidor (ignora el precio del cliente)", async () => {
    const input = baseInput({ estimatedTotalCents: 100 });
    const result = await submitConfigurator(input);
    await track(result);

    const { result: expected } = await estimateSelection(
      { experienceId, guestCount: 8, menuId, addOns: [{ addOnId, quantity: 1 }], serviceAreaId: areaId },
      { publicOnly: true },
    );
    // 10,000 base + 2 extra x 1,000 + menú 8 x 200 + add-on 500 + logística 350 (centavos x100)
    expect(expected.subtotalCents).toBe(1_000_000 + 200_000 + 160_000 + 50_000 + 35_000);
    expect(result.totalCents).toBe(expected.totalCents);
    expect(result.totalCents).not.toBe(100);

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: result.leadId },
      include: { snapshot: true, customer: true, activities: true },
    });
    expect(lead.code).toBe(result.code);
    expect(lead.source).toBe("CONFIGURATOR");
    expect(lead.status).toBe("NEW");
    expect(lead.estimatedTotalCents).toBe(expected.totalCents);
    expect(lead.serviceAreaId).toBe(areaId);
    expect(lead.outOfArea).toBe(false);
    expect(lead.specialRequest).toBe(false);
    expect(lead.experienceId).toBe(experienceId);
    expect(lead.styleId).toBe(styleId);
    expect(lead.menuId).toBe(menuId);
    expect(lead.budgetRangeId).toBe(budgetId);
    expect(lead.guestCount).toBe(8);
    expect(lead.eventDate?.toISOString().slice(0, 10)).toBe(openDate);
    expect(lead.honoreeName).toBe("Sofía");
    expect(lead.colors).toEqual(["Blush", "Salvia"]);
    expect(lead.notes).toContain("Una invitada es celiaca.");
    expect(lead.notes).toContain("Hora de inicio preferida: 11:00");
    expect(lead.activities.some((a) => a.type === "CREATED")).toBe(true);

    expect(lead.customer).not.toBeNull();
    expect(lead.customer!.phone).toBe(`+52${(input.phone as string).replace(/\D/g, "")}`);
    expect(lead.customer!.email).toBe(input.email);
    expect(lead.customer!.marketingOptIn).toBe(true);

    const snap = lead.snapshot!;
    expect(snap.pricingVersion).toBe(PRICING_VERSION);
    const est = snap.estimate as {
      totalCents: number;
      estimatedCostCents: number;
      marginBps: number;
      lines: unknown[];
    };
    expect(est.totalCents).toBe(expected.totalCents);
    expect(est.estimatedCostCents).toBeGreaterThan(0); // incluye costos internos
    expect(typeof est.marginBps).toBe("number");
    // Forma plana: contrato con el admin de leads (parseSnapshotData) y el prellenado de cotizaciones
    const data = snap.data as {
      guestCount: number;
      startTime: string;
      experienceId: string;
      menuId: string;
      styleId: string;
      addOns: Array<{ addOnId: string; quantity: number }>;
      meta: {
        labels: { experience: string };
        clientEstimateCentsIgnored: number | null;
        availability: { status: string };
      };
    };
    expect(data.guestCount).toBe(8);
    expect(data.startTime).toBe("11:00");
    expect(data.experienceId).toBe(experienceId);
    expect(data.menuId).toBe(menuId);
    expect(data.styleId).toBe(styleId);
    expect(data.addOns).toEqual([{ addOnId, quantity: 1 }]);
    expect(data.meta.labels.experience).toBe(`Experiencia ${u}`);
    expect(data.meta.clientEstimateCentsIgnored).toBe(100);
    expect(["AVAILABLE", "LIMITED"]).toContain(data.meta.availability.status);

    // El admin de leads lee el snapshot: experiencia, menú, extras y hora sin campos "ruido"
    const view = parseSnapshotData(snap.data);
    expect(view.experience?.id).toBe(experienceId);
    expect(view.menu?.id).toBe(menuId);
    expect(view.addOns).toEqual([{ id: addOnId, quantity: 1 }]);
    expect(view.guestCount).toBe(8);
    expect(view.fields.find((f) => f.key === "startTime")?.value).toBe("11:00");
    expect(view.fields.map((f) => f.key)).not.toEqual(expect.arrayContaining(["meta", "version", "source"]));

    // Prellenado de la cotización desde el lead: conserva extras y hora de inicio
    const prefill = await getLeadPrefill(result.leadId);
    expect(prefill?.addOns).toEqual([{ addOnId, quantity: 1 }]);
    expect(prefill?.startTime).toBe("11:00");
    expect(prefill?.experienceId).toBe(experienceId);

    expect(result.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(result.whatsappUrl)).toContain(result.code);
    expect(result.firstName).toBe("Lucía");

    const analytics = await prisma.analyticsEvent.findFirst({
      where: { type: "SUBMIT_LEAD", leadId: result.leadId },
    });
    expect(analytics?.sessionId).toBe(`sess-${u}`);
  });

  it("'Otra zona' marca fuera de cobertura y no cobra logística", async () => {
    const result = await submitConfigurator(baseInput({ serviceAreaId: null, zoneText: "Coyoacán" }));
    await track(result);
    expect(result.outOfArea).toBe(true);
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: result.leadId },
      include: { snapshot: true },
    });
    expect(lead.outOfArea).toBe(true);
    expect(lead.serviceAreaId).toBeNull();
    expect(lead.zoneText).toBe("Coyoacán");
    const est = lead.snapshot!.estimate as { lines: Array<{ type: string }> };
    expect(est.lines.some((l) => l.type === "LOGISTICS")).toBe(false);
  });

  it("una zona 'Próximamente' (inactiva) también se registra como fuera de cobertura", async () => {
    const result = await submitConfigurator(baseInput({ serviceAreaId: inactiveAreaId }));
    await track(result);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.outOfArea).toBe(true);
    expect(lead.serviceAreaId).toBeNull();
    expect(lead.zoneText).toBe(inactiveAreaName);
  });

  it("más de 12 personas se marca como consulta especial", async () => {
    const result = await submitConfigurator(baseInput({ guestCount: 16 }));
    await track(result);
    expect(result.specialRequest).toBe(true);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.specialRequest).toBe(true);
    expect(lead.guestCount).toBe(16);
    expect(lead.notes).toMatch(/Consulta especial/);
  });

  it("rechaza un menú incompatible con la experiencia y no crea lead", async () => {
    const input = baseInput({ menuId: otherMenuId });
    await expect(submitConfigurator(input)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { menuId: [expect.stringMatching(/no es compatible/)] },
    });
    expect(await prisma.lead.count({ where: { email: input.email as string } })).toBe(0);
  });

  it("rechaza extras que no pertenecen a la experiencia", async () => {
    await expect(
      submitConfigurator(baseInput({ addOns: [{ addOnId: foreignAddOnId, quantity: 1 }] })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { addOns: expect.any(Array) } });
  });

  it("limita la cantidad de un extra a su máximo", async () => {
    const result = await submitConfigurator(baseInput({ addOns: [{ addOnId, quantity: 5 }] }));
    await track(result);
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: result.leadId },
      include: { snapshot: true },
    });
    const est = lead.snapshot!.estimate as {
      lines: Array<{ type: string; refId: string; quantity: number }>;
    };
    expect(est.lines.find((l) => l.type === "ADDON" && l.refId === addOnId)?.quantity).toBe(2);
  });

  it("fecha llena: acepta el lead y lo marca para ofrecer alternativa", async () => {
    const result = await submitConfigurator(baseInput({ eventDate: fullDate }));
    await track(result);
    expect(result.availabilityStatus).toBe("FULL");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.notes).toMatch(/fecha llena — ofrecer alternativa/i);
  });

  it("fecha llena aunque el horario quede fuera de rango: sigue marcada como llena", async () => {
    const result = await submitConfigurator(
      baseInput({ eventDate: fullDate, experienceId: longExperienceId, startTime: "18:00", addOns: [] }),
    );
    await track(result);
    expect(result.availabilityStatus).toBe("FULL");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.notes).toMatch(/fecha llena — ofrecer alternativa/i);
  });

  it("es idempotente: reintentar con el mismo submissionId no duplica el lead", async () => {
    const input = baseInput({ submissionId: `sub-${u}-idempotente` });
    const first = await submitConfigurator(input);
    await track(first);
    const second = await submitConfigurator(input);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.leadId).toBe(first.leadId);
    expect(second.code).toBe(first.code);
    expect(second.totalCents).toBe(first.totalCents);
    expect(await prisma.lead.count({ where: { email: input.email as string } })).toBe(1);

    // Mismo id con otro teléfono: no revela el lead ajeno, crea uno nuevo
    const other = await submitConfigurator({
      ...input,
      phone: phone(),
      email: `${uid("otra")}@example.test`,
    });
    await track(other);
    expect(other.duplicate).toBe(false);
    expect(other.leadId).not.toBe(first.leadId);
  });

  it("exige estilo (si hay estilos activos) y presupuesto en servidor", async () => {
    await expect(submitConfigurator(baseInput({ styleId: null }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { styleId: expect.any(Array) },
    });
    await expect(
      submitConfigurator(baseInput({ budgetRangeId: null, budgetUndecided: false })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { budgetRangeId: expect.any(Array) } });
  });

  it("fecha pasada: error amable y sin lead", async () => {
    const input = baseInput({ eventDate: addDaysKey(localDateKey(), -3) });
    await expect(submitConfigurator(input)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/ya pasó/),
      fieldErrors: { eventDate: expect.any(Array) },
    });
    expect(await prisma.lead.count({ where: { email: input.email as string } })).toBe(0);
  });

  it("valida contacto y consentimiento en servidor", async () => {
    await expect(submitConfigurator(baseInput({ phone: "123", consent: false }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { phone: expect.any(Array), consent: expect.any(Array) },
    });
    await expect(
      submitConfigurator(baseInput({ occasion: "OTHER", occasionOther: "" })),
    ).rejects.toMatchObject({
      fieldErrors: { occasionOther: expect.any(Array) },
    });
  });

  it("'Prefiero platicarlo' guarda nota de presupuesto sin rango", async () => {
    const result = await submitConfigurator(baseInput({ budgetRangeId: null, budgetUndecided: true }));
    await track(result);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.budgetRangeId).toBeNull();
    expect(lead.budgetNotes).toMatch(/platicar/);
  });
});

describe("configurador: estimado y disponibilidad públicos", () => {
  it("el estimado público no expone costos ni márgenes", async () => {
    const est = await estimateConfiguration({
      experienceId,
      guestCount: 8,
      menuId,
      addOns: [{ addOnId, quantity: 1 }],
      serviceAreaId: areaId,
    });
    const { result: full } = await estimateSelection(
      { experienceId, guestCount: 8, menuId, addOns: [{ addOnId, quantity: 1 }], serviceAreaId: areaId },
      { publicOnly: true },
    );
    expect(est.totalCents).toBe(full.totalCents);
    expect(est.subtotalCents).toBe(1_445_000);
    expect(est.lines.length).toBeGreaterThanOrEqual(4);
    expect(est).not.toHaveProperty("estimatedCostCents");
    expect(est).not.toHaveProperty("marginBps");
    expect(est.lines[0]).not.toHaveProperty("unitCostCents");
  });

  it("el estimado rechaza un menú incompatible", async () => {
    await expect(
      estimateConfiguration({
        experienceId,
        guestCount: 8,
        menuId: otherMenuId,
        addOns: [],
        serviceAreaId: areaId,
      }),
    ).rejects.toThrow(/no es compatible/);
  });

  it("el calendario reporta fechas llenas y abiertas por zona", async () => {
    const days = await getConfiguratorAvailability({ from: openDate, days: 2, serviceAreaId: areaId });
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ date: openDate, acceptsRequests: true });
    expect(["AVAILABLE", "LIMITED"]).toContain(days[0]!.status);
    expect(days[1]).toMatchObject({ date: fullDate, status: "FULL" });
    expect(days[0]).not.toHaveProperty("booked");
  });
});
