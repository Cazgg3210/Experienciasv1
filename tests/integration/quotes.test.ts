import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/db";
import { dateOnly, toDateKey } from "@/lib/dates";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { generateReferralCode, generateCode } from "@/lib/codes";
import type { SessionUser } from "@/server/auth/session";
import {
  createNewVersion,
  createQuote,
  duplicateQuote,
  expireOverdueQuotes,
  markQuoteExpired,
  openPublicQuote,
  previewQuotePricing,
  rejectQuoteByToken,
  saveQuotePricing,
  sendQuote,
  updateQuoteDetails,
} from "@/features/quotes/server/quote-service";
import { createBookingFromQuote, UNAVAILABLE_MESSAGE } from "@/features/bookings/server/booking-service";
import type { CreateQuoteData, EditorLine } from "@/features/quotes/schemas";
import { CAPACITY_STATUSES } from "@/features/events/domain/event-status";
import { testOwner, testStaff, uid } from "./helpers";

type Fixtures = {
  experienceId: string;
  menuId: string;
  flatAddOnId: string;
  perGuestAddOnId: string;
  areaId: string;
  customerId: string;
};

let owner: SessionUser;
let staff: SessionUser;
let fx: Fixtures;

const usedDates = new Set<string>();
/** Fecha futura aleatoria (30–300 días) con capacidad garantizada para la zona de prueba. */
async function openDate(): Promise<string> {
  let key = "";
  for (;;) {
    const days = 30 + Math.floor(Math.random() * 270);
    key = toDateKey(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + days)));
    if (usedDates.has(key)) continue;
    // Otras suites pueden dejar bloqueos globales en la base de pruebas
    const blocked = await prisma.availabilityException.count({
      where: { date: dateOnly(key), type: { in: ["BLOCKED", "BLACKOUT"] }, OR: [{ serviceAreaId: null }, { serviceAreaId: fx.areaId }] },
    });
    if (!blocked) break;
  }
  usedDates.add(key);
  await prisma.availabilityException.create({
    data: { date: dateOnly(key), type: "CAPACITY_OVERRIDE", maxEvents: 50, serviceAreaId: fx.areaId, reason: "integration" },
  });
  return key;
}

async function createFixtures(): Promise<Fixtures> {
  const s = uid();
  const area = await prisma.serviceArea.create({
    data: { name: `Zona ${s}`, slug: `zona-${s}`, logisticsFeeCents: 50_000, logisticsCostCents: 30_000 },
  });
  const menu = await prisma.menu.create({
    data: { name: `Menú ${s}`, slug: `menu-${s}`, pricingType: "INCLUDED", priceCents: 0, costPerGuestCents: 18_000 },
  });
  const flat = await prisma.addOn.create({
    data: { name: `Karaoke ${s}`, slug: `karaoke-${s}`, pricingType: "FLAT", priceCents: 150_000, costCents: 60_000, costCategory: "VENDOR", maxQuantity: 2 },
  });
  const perGuest = await prisma.addOn.create({
    data: { name: `Mimosa bar ${s}`, slug: `mimosa-${s}`, pricingType: "PER_GUEST", priceCents: 25_000, costCents: 9_000, costCategory: "FOOD", maxQuantity: 2 },
  });
  const experience = await prisma.experience.create({
    data: {
      name: `Signature ${s}`,
      slug: `signature-${s}`,
      description: "Experiencia de prueba",
      basePriceCents: 1_200_000,
      baseGuests: 6,
      minGuests: 4,
      maxGuests: 14,
      extraGuestPriceCents: 150_000,
      extraGuestCostCents: 50_000,
      durationMinutes: 240,
      costComponents: {
        create: [
          { category: "STAFF", description: "Equipo", amountCents: 200_000, perGuest: false },
          { category: "FLOWERS", description: "Flores", amountCents: 150_000, perGuest: false },
        ],
      },
      menus: { connect: [{ id: menu.id }] },
      addOns: { connect: [{ id: flat.id }, { id: perGuest.id }] },
      serviceAreas: { connect: [{ id: area.id }] },
    },
  });
  const customer = await prisma.customer.create({
    data: {
      name: `Lucía Prueba ${s}`,
      email: `lucia.${s}@example.test`,
      phone: "5512345678",
      whatsapp: "5512345678",
      referralCode: generateReferralCode(`Lucia${s}`),
    },
  });
  return {
    experienceId: experience.id,
    menuId: menu.id,
    flatAddOnId: flat.id,
    perGuestAddOnId: perGuest.id,
    areaId: area.id,
    customerId: customer.id,
  };
}

async function newLead(status: "NEW" | "CONTACTED" | "QUALIFIED" = "CONTACTED") {
  return prisma.lead.create({
    data: {
      code: generateCode("L"),
      customerId: fx.customerId,
      name: "Lucía Prueba",
      email: "lucia@example.test",
      phone: "5512345678",
      occasion: "BIRTHDAY",
      status,
      honoreeName: "Lucía",
      colors: ["#F2D7D9", "#A3B18A"],
      inspiration: "Mesa romántica con flores",
      source: "CONFIGURATOR",
    },
  });
}

function createInput(overrides: Partial<CreateQuoteData> = {}): CreateQuoteData {
  return {
    customerMode: "existing",
    customerId: fx.customerId,
    newCustomer: null,
    leadId: null,
    occasion: "BIRTHDAY",
    title: "",
    eventDate: "",
    startTime: "11:00",
    experienceId: fx.experienceId,
    guestCount: 8,
    menuId: fx.menuId,
    serviceAreaId: fx.areaId,
    styleId: null,
    addOns: [
      { addOnId: fx.flatAddOnId, quantity: 1 },
      { addOnId: fx.perGuestAddOnId, quantity: 1 },
    ],
    depositBps: 5000,
    notesForCustomer: "Precios con IVA incluido.",
    internalNotes: "Prueba de integración",
    ...overrides,
  };
}

async function draftQuote(overrides: Partial<CreateQuoteData> = {}) {
  const date = overrides.eventDate ?? (await openDate());
  const { id } = await createQuote(owner, createInput({ eventDate: date, ...overrides }));
  return prisma.quote.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
}

async function sentQuote(overrides: Partial<CreateQuoteData> = {}) {
  const q = await draftQuote(overrides);
  await sendQuote(owner, q.id);
  return prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
}

function editorLines(items: Array<{ id: string; type: EditorLine["type"]; refId: string | null; description: string; quantity: number; unitPriceCents: number; unitCostCents: number; costCategory: EditorLine["costCategory"] }>): EditorLine[] {
  return items.map((i) => ({
    itemId: i.id,
    type: i.type,
    refId: i.refId,
    description: i.description,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    unitCostCents: i.unitCostCents,
    costCategory: i.costCategory,
  }));
}

beforeAll(async () => {
  owner = await testOwner();
  staff = await testStaff();
  fx = await createFixtures();
});

describe("Cotizaciones — creación", () => {
  it("crea una cotización DRAFT desde un lead y lo mueve a QUOTED", async () => {
    const lead = await newLead("CONTACTED");
    const q = await draftQuote({ leadId: lead.id });

    expect(q.status).toBe("DRAFT");
    expect(q.code).toMatch(/^Q-\d{4}-[A-Z0-9]{4}$/);
    expect(q.publicToken.length).toBeGreaterThanOrEqual(40);
    expect(q.title).toBe("Cumpleaños de Lucía");
    expect(q.createdById).toBe(owner.id);
    expect(q.validUntil!.getTime()).toBeGreaterThan(Date.now());
    const types = q.items.map((i) => i.type);
    expect(types).toEqual(["BASE_EXPERIENCE", "EXTRA_GUEST", "MENU", "ADDON", "ADDON", "LOGISTICS"]);
    // 1,200,000 + 2×150,000 + 0 + 150,000 + 8×25,000 + 50,000
    expect(q.subtotalCents).toBe(1_900_000);
    expect(q.totalCents).toBe(1_900_000);
    expect(q.depositCents).toBe(950_000);
    expect(q.estimatedCostCents).toBeGreaterThan(0);
    expect(q.pricingSnapshot).toBeTruthy();

    const updatedLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updatedLead.status).toBe("QUOTED");
    const act = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, type: "QUOTE_CREATED" } });
    expect(act?.toStatus).toBe("QUOTED");
    const log = await prisma.auditLog.findFirst({ where: { entityId: q.id, action: "quote.created" } });
    expect(log?.actorId).toBe(owner.id);
  });

  it("crea clienta rápida (o reutiliza por email)", async () => {
    const email = `nueva.${uid()}@example.test`;
    const date = await openDate();
    const a = await createQuote(
      owner,
      createInput({ customerMode: "new", customerId: null, newCustomer: { name: "Ximena Nueva", email, phone: "" }, eventDate: date }),
    );
    const b = await createQuote(
      owner,
      createInput({ customerMode: "new", customerId: null, newCustomer: { name: "Ximena N.", email: email.toUpperCase(), phone: "5598765432" }, eventDate: date }),
    );
    const [qa, qb] = await Promise.all([
      prisma.quote.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.quote.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(qa.customerId).toBe(qb.customerId);
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: qa.customerId } });
    expect(c.email).toBe(email);
    expect(c.phone).toBe("+525598765432"); // forma canónica única del teléfono (BUG-008)
  });
});

describe("Cotizaciones — editor", () => {
  it("el descuento requiere quotes:discount y queda auditado (antes/después)", async () => {
    const q = await draftQuote();
    const input = {
      quoteId: q.id,
      lines: editorLines(q.items),
      discount: { type: "PERCENT" as const, value: 1000, reason: "Clienta frecuente" },
      depositBps: 5000,
    };
    await expect(saveQuotePricing(staff, input)).rejects.toBeInstanceOf(ForbiddenError);
    const preview = await previewQuotePricing(staff, input);
    expect(preview.needsDiscountPermission).toBe(true);

    await saveQuotePricing(owner, input);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.discountType).toBe("PERCENT");
    expect(after.discountValue).toBe(1000);
    expect(after.discountCents).toBe(190_000);
    expect(after.totalCents).toBe(1_710_000);
    expect(after.depositCents).toBe(855_000);
    const log = await prisma.auditLog.findFirst({ where: { entityId: q.id, action: "quote.discount_applied" } });
    expect(log).toBeTruthy();
    expect((log!.before as { type: string | null }).type).toBeNull();
    expect((log!.after as { value: number }).value).toBe(1000);
    expect((log!.after as { totalCents: number }).totalCents).toBe(1_710_000);
    // El desglose de costos de la experiencia base se conserva por componente (no todo a "Staff")
    const breakdown = (after.pricingSnapshot as { costBreakdown: Record<string, number> }).costBreakdown;
    const original = (q.pricingSnapshot as { costBreakdown: Record<string, number> }).costBreakdown;
    expect(breakdown.FLOWERS).toBe(150_000);
    expect(breakdown.STAFF).toBe(original.STAFF);
    expect(after.estimatedCostCents - breakdown.PAYMENT_FEE).toBe(q.estimatedCostCents - original.PAYMENT_FEE);
  });

  it("cambiar precio unitario requiere pricing:write y se audita; conceptos personalizados son libres", async () => {
    const q = await draftQuote();
    const lines = editorLines(q.items);
    const baseLine = lines.find((l) => l.type === "BASE_EXPERIENCE")!;
    baseLine.unitPriceCents = 1_100_000;
    const custom: EditorLine = {
      itemId: null,
      type: "CUSTOM",
      refId: null,
      description: "Letrero personalizado",
      quantity: 2,
      unitPriceCents: 45_000,
      unitCostCents: 20_000,
      costCategory: "VENDOR",
    };
    const input = { quoteId: q.id, lines: [...lines, custom], discount: { type: "NONE" as const, value: 0 }, depositBps: 5000 };
    await expect(saveQuotePricing(staff, input)).rejects.toBeInstanceOf(ForbiddenError);

    const res = await saveQuotePricing(owner, input);
    expect(res.totalCents).toBe(1_900_000 - 100_000 + 90_000);
    const items = await prisma.quoteItem.findMany({ where: { quoteId: q.id }, orderBy: { sortOrder: "asc" } });
    expect(items).toHaveLength(7);
    expect(items.find((i) => i.type === "CUSTOM")?.totalCostCents).toBe(40_000);
    // los IDs existentes se conservan
    expect(items.filter((i) => q.items.some((o) => o.id === i.id))).toHaveLength(6);
    const log = await prisma.auditLog.findFirst({ where: { entityId: q.id, action: "quote.price_changed" } });
    expect(log).toBeTruthy();

    // Sólo agregar un concepto personalizado no requiere permiso de precios
    const fresh = await prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    const removeCustom = { ...input, lines: editorLines(fresh.items).filter((l) => l.type !== "CUSTOM") };
    const preview = await previewQuotePricing(staff, removeCustom);
    expect(preview.needsPricingPermission).toBe(false);
  });

  it("cambiar invitadas ajusta invitadas extra, menú y add-ons por persona", async () => {
    const q = await draftQuote();
    await updateQuoteDetails(owner, {
      quoteId: q.id,
      title: "Cumpleaños de Lucía (10)",
      eventDate: toDateKey(q.eventDate!),
      startTime: "12:00",
      guestCount: 10,
      styleId: null,
      validUntil: "",
      notesForCustomer: "Nota",
      internalNotes: "",
    });
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    expect(after.guestCount).toBe(10);
    expect(after.startTime).toBe("12:00");
    expect(after.items.find((i) => i.type === "EXTRA_GUEST")?.quantity).toBe(4);
    expect(after.items.find((i) => i.refId === fx.perGuestAddOnId)?.quantity).toBe(10);
    expect(after.items.find((i) => i.type === "MENU")?.totalCostCents).toBe(10 * 18_000);
    expect(after.subtotalCents).toBe(1_200_000 + 4 * 150_000 + 150_000 + 10 * 25_000 + 50_000);
  });

  it("el editor no altera la cantidad de experiencia base, menú ni logística (aunque se manipule la petición)", async () => {
    const q = await draftQuote();
    const lines = editorLines(q.items).map((l) =>
      l.type === "BASE_EXPERIENCE" || l.type === "LOGISTICS" || l.type === "MENU" ? { ...l, quantity: 5 } : l,
    );
    const res = await saveQuotePricing(owner, { quoteId: q.id, lines, discount: { type: "NONE", value: 0 }, depositBps: 5000 });
    expect(res.totalCents).toBe(q.totalCents);
    const items = await prisma.quoteItem.findMany({ where: { quoteId: q.id } });
    for (const t of ["BASE_EXPERIENCE", "LOGISTICS", "MENU"] as const) {
      expect(items.find((i) => i.type === t)?.quantity).toBe(q.items.find((i) => i.type === t)?.quantity);
    }
  });

  it("no permite editar cotizaciones enviadas", async () => {
    const q = await sentQuote();
    await expect(
      saveQuotePricing(owner, { quoteId: q.id, lines: editorLines(q.items), discount: { type: "NONE", value: 0 }, depositBps: 5000 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("Cotizaciones — ciclo de vida", () => {
  it("enviar: SENT + sentAt + notificaciones + actividad del lead", async () => {
    const lead = await newLead("QUALIFIED");
    const q = await draftQuote({ leadId: lead.id });
    const res = await sendQuote(owner, q.id);
    expect(res.url).toContain(`/cotizacion/${q.publicToken}`);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("SENT");
    expect(after.sentAt).toBeTruthy();
    expect(after.validUntil!.getTime()).toBeGreaterThan(Date.now());
    const logs = await prisma.notificationLog.findMany({ where: { quoteId: q.id, type: "QUOTE_SENT" } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.some((l) => l.channel === "EMAIL" && l.actionUrl?.includes(q.publicToken))).toBe(true);
    const act = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, type: "QUOTE_SENT" } });
    expect(act).toBeTruthy();
    await expect(sendQuote(owner, q.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("enviar exige fecha del evento (y que no haya pasado)", async () => {
    const { id } = await createQuote(owner, createInput({ eventDate: "" }));
    await expect(sendQuote(owner, id)).rejects.toBeInstanceOf(AppError);

    const past = await createQuote(owner, createInput({ eventDate: toDateKey(new Date(Date.now() - 3 * 86_400_000)) }));
    await expect(sendQuote(owner, past.id)).rejects.toThrow(/ya pasó/);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: past.id } })).status).toBe("DRAFT");
  });

  it("aceptar crea reserva + evento PENDING_PAYMENT + add-ons y gana el lead; la doble aceptación se bloquea", async () => {
    const lead = await newLead("CONTACTED");
    const q = await sentQuote({ leadId: lead.id });
    const res = await createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba Herrera", ip: "203.0.113.5" });

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: res.bookingId } });
    expect(booking.code).toMatch(/^B-/);
    expect(booking.totalCents).toBe(q.totalCents);
    expect(booking.depositRequiredCents).toBe(q.depositCents);
    expect(booking.acceptedByName).toBe("Lucía Prueba Herrera");
    expect(booking.acceptedIp).toBe("203.0.113.5");
    expect(booking.termsVersion).toBeTruthy();
    expect(booking.balanceDueAt).toBeTruthy();

    const event = await prisma.event.findUniqueOrThrow({ where: { id: res.eventId }, include: { addOns: true } });
    expect(event.status).toBe("PENDING_PAYMENT");
    expect(event.code).toMatch(/^EV-/);
    expect(event.quoteId).toBe(q.id);
    expect(event.portalToken).toBe(res.portalToken);
    expect(event.micrositeSlug).toMatch(/^cumpleanos-de-lucia-[a-z2-9]{4}$/);
    expect(event.honoreeName).toBe("Lucía");
    expect(event.colors).toEqual(["#F2D7D9", "#A3B18A"]);
    expect(event.endsAt.getTime() - event.startsAt.getTime()).toBe(240 * 60_000);
    expect(toDateKey(event.eventDate)).toBe(toDateKey(q.eventDate!));
    expect(event.addOns).toHaveLength(2);
    const perGuest = event.addOns.find((a) => a.addOnId === fx.perGuestAddOnId)!;
    expect(perGuest.quantity).toBe(1);
    expect(perGuest.priceCents).toBe(8 * 25_000);
    expect(booking.balanceDueAt!.getTime()).toBeLessThan(event.startsAt.getTime());

    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(quote.status).toBe("ACCEPTED");
    expect(quote.acceptedAt).toBeTruthy();
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("WON");
    expect(await prisma.auditLog.findFirst({ where: { entityId: q.id, action: "quote.accepted" } })).toBeTruthy();
    expect(await prisma.notificationLog.findFirst({ where: { quoteId: q.id, type: "QUOTE_ACCEPTED" } })).toBeTruthy();
    expect(await prisma.analyticsEvent.findFirst({ where: { quoteId: q.id, type: "ACCEPT_QUOTE" } })).toBeTruthy();

    await expect(createBookingFromQuote(q.publicToken, { acceptedByName: "Otra Persona" })).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.booking.count({ where: { quoteId: q.id } })).toBe(1);
  });

  it("no acepta una versión distinta a la que la clienta tenía en pantalla", async () => {
    const q = await sentQuote();
    // El equipo crea la versión 2 y la reenvía mientras la clienta tenía abierta la versión 1
    await createNewVersion(owner, q.id);
    await sendQuote(owner, q.id);
    await expect(
      createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba", expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ConflictError);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("SENT");
    expect(after.version).toBe(2);
    expect(await prisma.event.count({ where: { quoteId: q.id } })).toBe(0);
    // Con la versión vigente sí se acepta
    const res = await createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba", expectedVersion: 2 });
    expect(res.bookingId).toBeTruthy();
  });

  it("aceptaciones concurrentes: sólo una gana", async () => {
    const q = await sentQuote();
    const results = await Promise.allSettled([
      createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Uno" }),
      createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Dos" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.event.count({ where: { quoteId: q.id } })).toBe(1);
  });

  it("no se aceptan borradores, tokens inválidos ni propuestas expiradas", async () => {
    const draft = await draftQuote();
    await expect(createBookingFromQuote(draft.publicToken, { acceptedByName: "Lucía Prueba" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createBookingFromQuote("no-es-un-token", { acceptedByName: "Lucía Prueba" })).rejects.toBeInstanceOf(NotFoundError);

    const q = await sentQuote();
    await prisma.quote.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 60_000) } });
    await expect(createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba" })).rejects.toBeInstanceOf(ConflictError);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("EXPIRED");
    expect(after.expiredAt).toBeTruthy();
    expect(await prisma.event.count({ where: { quoteId: q.id } })).toBe(0);
  });

  it("rechaza la aceptación si la fecha ya no está disponible", async () => {
    const q = await sentQuote();
    await prisma.availabilityException.create({
      data: { date: q.eventDate!, type: "BLOCKED", serviceAreaId: fx.areaId, reason: "Bloqueo de prueba" },
    });
    await expect(createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba" })).rejects.toThrow(UNAVAILABLE_MESSAGE);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("SENT"); // la transacción se revierte completa
    expect(await prisma.event.count({ where: { quoteId: q.id } })).toBe(0);
    // El equipo recibe aviso para contactar a la clienta
    expect(await prisma.notificationLog.findFirst({ where: { quoteId: q.id, type: "GENERIC", dedupeKey: { startsWith: "quote-unavailable:" } } })).toBeTruthy();
  });

  it("evita double-booking: con capacidad 1, la segunda aceptación del mismo día se rechaza", async () => {
    // La base de pruebas acumula eventos de corridas anteriores: elegir un día sin eventos que ocupen
    // capacidad ni bloqueos, si no la primera aceptación ya encontraría el día lleno.
    let key = "";
    for (let attempt = 0; attempt < 200; attempt++) {
      key = toDateKey(new Date(Date.now() + (40 + Math.floor(Math.random() * 600)) * 86_400_000));
      if (usedDates.has(key)) continue;
      const [events, exceptions] = await Promise.all([
        prisma.event.count({ where: { eventDate: dateOnly(key), status: { in: [...CAPACITY_STATUSES] } } }),
        prisma.availabilityException.count({ where: { date: dateOnly(key) } }),
      ]);
      if (events === 0 && exceptions === 0) break;
    }
    usedDates.add(key);
    await prisma.availabilityException.create({
      data: { date: dateOnly(key), type: "CAPACITY_OVERRIDE", maxEvents: 1, serviceAreaId: fx.areaId, reason: "integration-cap1" },
    });
    const a = await sentQuote({ eventDate: key });
    const b = await sentQuote({ eventDate: key });
    await createBookingFromQuote(a.publicToken, { acceptedByName: "Primera Clienta" });
    await expect(createBookingFromQuote(b.publicToken, { acceptedByName: "Segunda Clienta" })).rejects.toThrow(UNAVAILABLE_MESSAGE);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("SENT");
  });

  it("anticipación mínima no bloquea una propuesta enviada por el equipo si hay capacidad", async () => {
    // Mañana (TOO_SOON con la configuración por defecto) pero con capacidad para la zona
    const key = toDateKey(new Date(Date.now() + 2 * 86_400_000));
    await prisma.availabilityException.create({
      data: { date: dateOnly(key), type: "CAPACITY_OVERRIDE", maxEvents: 50, serviceAreaId: fx.areaId, reason: "integration-soon" },
    });
    const q = await sentQuote({ eventDate: key });
    const res = await createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba Pronto" });
    expect(res.eventId).toBeTruthy();
  });

  it("rechazo por la clienta: REJECTED + motivo + actividad del lead", async () => {
    const lead = await newLead("CONTACTED");
    const q = await sentQuote({ leadId: lead.id });
    await rejectQuoteByToken(q.publicToken, { reason: "Cambiamos de fecha", ip: "203.0.113.9" });
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("REJECTED");
    expect(after.rejectedAt).toBeTruthy();
    expect(after.rejectionReason).toBe("Cambiamos de fecha");
    const act = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, message: { contains: "rechazó" } } });
    expect(act).toBeTruthy();
    await expect(createBookingFromQuote(q.publicToken, { acceptedByName: "Lucía Prueba" })).rejects.toBeInstanceOf(ConflictError);
    // idempotente
    await expect(rejectQuoteByToken(q.publicToken, {})).resolves.toBeUndefined();
  });

  it("nueva versión: vuelve a DRAFT con versión +1 y auditoría", async () => {
    const q = await sentQuote();
    await createNewVersion(owner, q.id);
    const after = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after.status).toBe("DRAFT");
    expect(after.version).toBe(2);
    expect(await prisma.auditLog.findFirst({ where: { entityId: q.id, action: "quote.new_version" } })).toBeTruthy();
    await expect(createNewVersion(owner, q.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("marcar expirada, duplicar y expirar vencidas (cron)", async () => {
    const q = await sentQuote();
    await markQuoteExpired(owner, q.id);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("EXPIRED");

    const copy = await duplicateQuote(owner, q.id);
    const dup = await prisma.quote.findUniqueOrThrow({ where: { id: copy.id }, include: { items: true } });
    expect(dup.status).toBe("DRAFT");
    expect(dup.publicToken).not.toBe(q.publicToken);
    expect(dup.items).toHaveLength(q.items.length);
    expect(dup.totalCents).toBe(q.totalCents);

    const overdue = await sentQuote();
    await prisma.quote.update({ where: { id: overdue.id }, data: { validUntil: new Date(Date.now() - 3_600_000) } });
    const count = await expireOverdueQuotes(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const expired = await prisma.quote.findUniqueOrThrow({ where: { id: overdue.id } });
    expect(expired.status).toBe("EXPIRED");
    expect(expired.expiredAt).toBeTruthy();
  });

  it("vista pública: 404 para borradores, marca vista una vez y expira vencidas", async () => {
    const draft = await draftQuote();
    expect(await openPublicQuote(draft.publicToken)).toBeNull();
    expect(await openPublicQuote("x")).toBeNull();

    const q = await sentQuote();
    const first = await openPublicQuote(q.publicToken);
    expect(first?.status).toBe("SENT");
    const viewed = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(viewed.viewedAt).toBeTruthy();
    await openPublicQuote(q.publicToken);
    expect(await prisma.analyticsEvent.count({ where: { quoteId: q.id, type: "VIEW_QUOTE" } })).toBe(1);

    await prisma.quote.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    expect((await openPublicQuote(q.publicToken))?.status).toBe("EXPIRED");
  });
});
