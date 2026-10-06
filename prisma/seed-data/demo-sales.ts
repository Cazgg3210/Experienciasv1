/**
 * Seed DEMO — fase 2: leads, cotizaciones, eventos y toda su operación
 * (reservas, pagos, invitadas, mensajes, checklists, staff, inventario, compras,
 * costos, memory capsule y reseña).
 */
import type {
  ChecklistItemStatus,
  CostCategory,
  DietaryRestriction,
  EventStatus,
  GuestSource,
  LeadActivityType,
  LeadSource,
  LeadStatus,
  Occasion,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  PurchaseStatus,
  QuoteStatus,
  RsvpStatus,
  StaffFunction,
} from "@prisma/client";
import { dateOnly, zonedDateTime } from "../../src/lib/dates";
import { marginBps } from "../../src/lib/money";
import { generateToken } from "../../src/lib/tokens";
import { BUDGET_RANGES } from "./base-data";
import { type DemoRefs, type StaffKey, type UserKey, placeholderMedia } from "./demo-setup";
import {
  type Clock,
  type EngineCustomItem,
  type EngineDiscount,
  type QuoteResult,
  type Rng,
  DAY_MS,
  HOUR_MS,
  TERMS_VERSION,
  addDays,
  addMinutes,
  priceQuote,
  emailFor,
  firstDateOnOrAfter,
  json,
  mx,
  notAfter,
  paymentFee,
  publicEstimate,
  randInt,
  shortId,
  uniqueCode,
} from "./helpers";

export const DEMO_TOKENS = {
  luciaQuote: "demo-quote-lucia-2026-4fq8m2zp",
  memoryValeria: "demo-memory-valeria-2026-9tk3w7hb",
  camilaGuest: "demo-guest-sofia-camila-2026",
} as const;

const BUDGET = Object.fromEntries(BUDGET_RANGES.map((b, i) => [i + 1, b.id])) as Record<1 | 2 | 3 | 4 | 5, string>;

// =============================================================================
// Tipos de salida (usados por notificaciones / analytics / auditoría)
// =============================================================================
export interface LeadRef {
  id: string;
  code: string;
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  experienceSlug: string | null;
}

export interface QuoteRef {
  id: string;
  code: string;
  publicToken: string;
  status: QuoteStatus;
  /** Resultado completo del QuoteEngine (también guardado como pricingSnapshot). */
  calc: QuoteResult;
  discount: EngineDiscount | null;
  customerKey: string;
  createdAt: Date;
  sentAt: Date | null;
  acceptedAt: Date | null;
  validUntil: Date | null;
}

export interface EventRef {
  key: EventKey;
  id: string;
  code: string;
  title: string;
  slug: string;
  portalToken: string;
  inviteToken: string;
  status: EventStatus;
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
  customerKey: string;
  quote: QuoteRef;
  bookingId: string;
  bookingCode: string;
  paymentIds: { kind: PaymentKind; id: string; status: PaymentStatus; amountCents: number; method: PaymentMethod }[];
  guests: { id: string; name: string; token: string; rsvpStatus: RsvpStatus; email: string | null; phone: string | null }[];
  experienceSlug: string;
}

export interface SalesResult {
  leads: Record<string, LeadRef>;
  quotes: Record<string, QuoteRef>;
  events: Record<EventKey, EventRef>;
  memoryShareTokens: { e4: string; e5: string };
}

type EventKey = "e1" | "e2" | "e3" | "e4" | "e5" | "e6";

// =============================================================================
// Helpers
// =============================================================================
function shiftTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const hh = Math.floor((((total % 1440) + 1440) % 1440) / 60);
  const mm = (((total % 60) + 60) % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function phoneFor(index: number): string {
  const n = String(4000 + index).padStart(4, "0");
  return `+52 55 6${n.slice(0, 3)} ${n.slice(1)}${String(index % 10)}`;
}

function mapsUrl(address: string, neighborhood: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${neighborhood}, Ciudad de México`)}`;
}

// =============================================================================
// Leads
// =============================================================================
interface LeadSeed {
  key: string;
  customerKey?: string;
  name?: string;
  phone?: string;
  email?: string;
  occasion: Occasion;
  occasionOther?: string;
  eventDateKey?: string | null;
  guestCount?: number;
  budget?: 1 | 2 | 3 | 4 | 5;
  budgetNotes?: string;
  status: LeadStatus;
  source: LeadSource;
  areaSlug?: string;
  zoneText?: string;
  outOfArea?: boolean;
  specialRequest?: boolean;
  experienceSlug?: string;
  styleSlug?: string;
  menuSlug?: string;
  honoreeName?: string;
  colors?: string[];
  inspiration?: string;
  notes?: string;
  referredByCode?: string;
  utmSource?: string;
  lostReason?: string;
  assignedTo: "ivonne" | "rosa";
  createdAt: Date;
  configurator?: { addOns: { slug: string; quantity: number }[]; startTime: string };
}

interface TimelineSpec {
  contactedAt?: Date;
  channel?: "WHATSAPP" | "CALL" | "EMAIL";
  contactNote?: string;
  qualifiedAt?: Date;
  qualifyNote?: string;
  quoteCode?: string;
  quoteCreatedAt?: Date;
  quoteSentAt?: Date;
  wonAt?: Date;
  wonNote?: string;
  lostAt?: Date;
  notes?: { at: Date; message: string; type?: LeadActivityType; actor?: UserKey | null }[];
}

const SOURCE_LABEL: Record<LeadSource, string> = {
  CONFIGURATOR: "el configurador web",
  AI_DESIGNER: "el diseñador con IA",
  CONTACT_FORM: "el formulario de contacto",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  REFERRAL: "una recomendación",
  GOOGLE: "Google",
  MANUAL: "captura manual",
  OTHER: "otro canal",
};

async function createLead(prisma: PrismaClient, refs: DemoRefs, seed: LeadSeed): Promise<LeadRef & { estimate: QuoteResult | null }> {
  const customer = seed.customerKey ? refs.customers[seed.customerKey] : undefined;
  const name = seed.name ?? customer?.name ?? "Sin nombre";
  const email = seed.email ?? customer?.email ?? null;
  const phone = seed.phone ?? customer?.phone ?? null;

  let estimate: QuoteResult | null = null;
  let snapshot: Prisma.ConfigurationSnapshotCreateWithoutLeadInput | undefined;
  if (seed.configurator && seed.experienceSlug && seed.areaSlug && seed.guestCount) {
    const exp = refs.experiences[seed.experienceSlug]!;
    const menu = seed.menuSlug ? refs.menus[seed.menuSlug] : undefined;
    estimate = priceQuote({
      experience: exp,
      guestCount: seed.guestCount,
      menu: menu ?? null,
      addOns: seed.configurator.addOns.map((a) => ({ addOn: refs.addOns[a.slug]!, quantity: a.quantity })),
      area: refs.areas[seed.areaSlug]!,
    });
    snapshot = {
      data: json({
        step: "summary",
        occasion: seed.occasion,
        honoreeName: seed.honoreeName ?? null,
        experienceSlug: seed.experienceSlug,
        guestCount: seed.guestCount,
        eventDate: seed.eventDateKey ?? null,
        startTime: seed.configurator.startTime,
        serviceAreaSlug: seed.areaSlug,
        styleSlug: seed.styleSlug ?? null,
        menuSlug: seed.menuSlug ?? null,
        addOns: seed.configurator.addOns,
        colors: seed.colors ?? [],
        inspiration: seed.inspiration ?? null,
        budgetRangeId: seed.budget ? BUDGET[seed.budget] : null,
        contact: { name, email, phone },
      }),
      estimate: publicEstimate(estimate),
      pricingVersion: estimate.pricingVersion,
      createdAt: seed.createdAt,
    };
  }

  const lead = await prisma.lead.create({
    data: {
      code: uniqueCode("L", seed.createdAt),
      customerId: customer?.id ?? null,
      name,
      phone,
      email,
      occasion: seed.occasion,
      occasionOther: seed.occasionOther ?? null,
      eventDate: seed.eventDateKey ? dateOnly(seed.eventDateKey) : null,
      guestCount: seed.guestCount ?? null,
      budgetRangeId: seed.budget ? BUDGET[seed.budget] : null,
      budgetNotes: seed.budgetNotes ?? null,
      status: seed.status,
      source: seed.source,
      serviceAreaId: seed.areaSlug ? refs.areas[seed.areaSlug]!.id : null,
      zoneText: seed.zoneText ?? (seed.areaSlug ? refs.areas[seed.areaSlug]!.name : null),
      outOfArea: seed.outOfArea ?? false,
      specialRequest: seed.specialRequest ?? false,
      experienceId: seed.experienceSlug ? refs.experiences[seed.experienceSlug]!.id : null,
      styleId: seed.styleSlug ? refs.styles[seed.styleSlug]!.id : null,
      menuId: seed.menuSlug ? refs.menus[seed.menuSlug]!.id : null,
      honoreeName: seed.honoreeName ?? null,
      colors: seed.colors ?? [],
      inspiration: seed.inspiration ?? null,
      notes: seed.notes ?? null,
      estimatedTotalCents: estimate?.totalCents ?? null,
      referredByCode: seed.referredByCode ?? null,
      utmSource: seed.utmSource ?? null,
      lostReason: seed.lostReason ?? null,
      assignedToId: refs.users[seed.assignedTo].id,
      createdAt: seed.createdAt,
      snapshot: snapshot ? { create: snapshot } : undefined,
    },
  });
  return {
    id: lead.id,
    code: lead.code,
    key: seed.key,
    name,
    email,
    phone,
    createdAt: seed.createdAt,
    experienceSlug: seed.experienceSlug ?? null,
    estimate,
  };
}

async function createLeadTimeline(
  prisma: PrismaClient,
  refs: DemoRefs,
  lead: { id: string },
  seed: LeadSeed,
  spec: TimelineSpec,
): Promise<void> {
  const owner = refs.users[seed.assignedTo];
  const rows: Prisma.LeadActivityCreateManyInput[] = [];
  const add = (
    type: LeadActivityType,
    at: Date,
    message: string | null,
    actor: UserKey | null = seed.assignedTo,
    fromStatus: LeadStatus | null = null,
    toStatus: LeadStatus | null = null,
  ) => rows.push({ leadId: lead.id, type, createdAt: at, message, actorId: actor ? refs.users[actor].id : null, fromStatus, toStatus });

  add("CREATED", seed.createdAt, `Lead recibido desde ${SOURCE_LABEL[seed.source]}.`, null);
  add("ASSIGNED", addMinutes(seed.createdAt, 14), `Asignado a ${owner.name}.`, seed.assignedTo === "ivonne" ? "rosa" : "ivonne");
  let current: LeadStatus = "NEW";
  if (spec.contactedAt) {
    add(spec.channel ?? "WHATSAPP", spec.contactedAt, spec.contactNote ?? "Primer contacto: enviamos bienvenida y opciones de fecha.");
    add("STATUS_CHANGE", addMinutes(spec.contactedAt, 1), null, seed.assignedTo, current, "CONTACTED");
    current = "CONTACTED";
  }
  if (spec.qualifiedAt) {
    add("NOTE", spec.qualifiedAt, spec.qualifyNote ?? "Fecha, zona y número de invitadas confirmados. Lista para cotizar.");
    add("STATUS_CHANGE", addMinutes(spec.qualifiedAt, 1), null, seed.assignedTo, current, "QUALIFIED");
    current = "QUALIFIED";
  }
  if (spec.quoteCreatedAt && spec.quoteCode) {
    add("QUOTE_CREATED", spec.quoteCreatedAt, `Cotización ${spec.quoteCode} creada.`);
  }
  if (spec.quoteSentAt && spec.quoteCode) {
    add("QUOTE_SENT", spec.quoteSentAt, `Cotización ${spec.quoteCode} enviada por email y WhatsApp.`);
    add("STATUS_CHANGE", addMinutes(spec.quoteSentAt, 1), null, seed.assignedTo, current, "QUOTED");
    current = "QUOTED";
  }
  for (const note of spec.notes ?? []) {
    add(note.type ?? "NOTE", note.at, note.message, note.actor === undefined ? seed.assignedTo : note.actor);
  }
  if (spec.wonAt) {
    add("STATUS_CHANGE", spec.wonAt, spec.wonNote ?? "Cotización aceptada por la clienta.", null, current, "WON");
    current = "WON";
  }
  if (spec.lostAt) {
    add("STATUS_CHANGE", spec.lostAt, seed.lostReason ?? "Lead perdido.", seed.assignedTo, current, "LOST");
  }
  rows.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  await prisma.leadActivity.createMany({ data: rows });

  const lastContact = [spec.contactedAt, spec.qualifiedAt, spec.quoteSentAt, ...(spec.notes ?? []).map((n) => n.at)]
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lastContact) {
    await prisma.lead.update({ where: { id: lead.id }, data: { lastContactedAt: lastContact } });
  }
}

// =============================================================================
// Cotizaciones
// =============================================================================
interface QuoteSeed {
  key: string;
  leadId: string | null;
  customerKey: string;
  status: QuoteStatus;
  title: string;
  occasion: Occasion;
  experienceSlug: string;
  menuSlug: string;
  styleSlug: string;
  areaSlug: string;
  guestCount: number;
  eventDateKey: string;
  startTime: string;
  addOns: { slug: string; quantity: number }[];
  customItems?: EngineCustomItem[];
  discount?: EngineDiscount & { reason: string };
  createdAt: Date;
  sentAt?: Date;
  viewedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  publicToken?: string;
  createdBy: UserKey;
  notesForCustomer?: string;
  internalNotes?: string;
}

const DEFAULT_CUSTOMER_NOTES =
  "Precios con IVA incluido. Apartas tu fecha con el 50% de anticipo; el saldo se liquida a más tardar 3 días antes del evento.";

async function createQuote(prisma: PrismaClient, refs: DemoRefs, seed: QuoteSeed): Promise<QuoteRef> {
  const discount = seed.discount ?? null;
  const calc = priceQuote({
    experience: refs.experiences[seed.experienceSlug]!,
    guestCount: seed.guestCount,
    menu: refs.menus[seed.menuSlug] ?? null,
    addOns: seed.addOns.map((a) => ({ addOn: refs.addOns[a.slug]!, quantity: a.quantity })),
    area: refs.areas[seed.areaSlug]!,
    customItems: seed.customItems,
    discount,
  });
  const validUntil = seed.sentAt ? addDays(seed.sentAt, 7) : null;
  const publicToken = seed.publicToken ?? generateToken();
  const quote = await prisma.quote.create({
    data: {
      code: uniqueCode("Q", seed.createdAt),
      publicToken,
      status: seed.status,
      leadId: seed.leadId,
      customerId: refs.customers[seed.customerKey]!.id,
      experienceId: refs.experiences[seed.experienceSlug]!.id,
      menuId: refs.menus[seed.menuSlug]!.id,
      styleId: refs.styles[seed.styleSlug]!.id,
      serviceAreaId: refs.areas[seed.areaSlug]!.id,
      occasion: seed.occasion,
      title: seed.title,
      eventDate: dateOnly(seed.eventDateKey),
      startTime: seed.startTime,
      guestCount: seed.guestCount,
      subtotalCents: calc.subtotalCents,
      discountType: discount?.type ?? null,
      discountValue: discount?.value ?? null,
      discountReason: discount?.reason ?? null,
      discountCents: calc.discountCents,
      logisticsCents: calc.logisticsCents,
      taxCents: calc.taxCents,
      totalCents: calc.totalCents,
      estimatedCostCents: calc.estimatedCostCents,
      estimatedMarginCents: calc.estimatedMarginCents,
      marginBps: calc.marginBps,
      depositBps: calc.depositBps,
      depositCents: calc.depositCents,
      pricingSnapshot: json(calc),
      notesForCustomer: seed.notesForCustomer ?? DEFAULT_CUSTOMER_NOTES,
      internalNotes: seed.internalNotes ?? null,
      validUntil,
      sentAt: seed.sentAt ?? null,
      viewedAt: seed.viewedAt ?? null,
      acceptedAt: seed.acceptedAt ?? null,
      rejectedAt: seed.rejectedAt ?? null,
      rejectionReason: seed.rejectionReason ?? null,
      expiredAt: seed.status === "EXPIRED" ? validUntil : null,
      createdById: refs.users[seed.createdBy].id,
      createdAt: seed.createdAt,
      items: {
        create: calc.lines.map((i, index) => ({
          type: i.type,
          refId: i.refId,
          description: i.description,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          unitCostCents: i.unitCostCents,
          totalPriceCents: i.totalPriceCents,
          totalCostCents: i.totalCostCents,
          costCategory: i.costCategory,
          sortOrder: index,
        })),
      },
    },
  });
  return {
    id: quote.id,
    code: quote.code,
    publicToken,
    status: seed.status,
    calc,
    discount,
    customerKey: seed.customerKey,
    createdAt: seed.createdAt,
    sentAt: seed.sentAt ?? null,
    acceptedAt: seed.acceptedAt ?? null,
    validUntil,
  };
}

// =============================================================================
// Eventos
// =============================================================================
interface GuestSeed {
  name: string;
  rsvp: RsvpStatus;
  dietary?: DietaryRestriction[];
  dietaryNotes?: string;
  comment?: string;
  token?: string;
  source?: GuestSource;
  plusOne?: string;
  noContact?: boolean;
}

interface PaymentSeed {
  kind: PaymentKind;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: "mock" | "manual";
  amount: "deposit" | "balance" | "full";
  at: Date;
  recordedBy?: UserKey;
  notes?: string;
}

interface PurchaseSeed {
  concept: string;
  category: CostCategory;
  vendor: string | null;
  expected: number;
  actual?: number;
  status: PurchaseStatus;
  neededBy?: Date;
  orderedAt?: Date;
  receivedAt?: Date;
  cancelledAt?: Date;
  notes?: string;
  createdBy: UserKey;
  createdAt: Date;
}

interface EventSeed {
  key: EventKey;
  quoteKey: string;
  title: string;
  status: EventStatus;
  dateKey: string;
  start: string;
  end: string;
  slug: string;
  portalToken: string;
  inviteToken: string;
  honoreeName: string;
  address: { line: string; notes?: string; neighborhood: string; postalCode: string };
  colors: string[];
  dressCode: string;
  hostMessage: string;
  inspiration?: string;
  customerNotes?: string;
  internalNotes?: string;
  timeline: { offset: number; title: string; description?: string; visibleToGuests?: boolean }[];
  payments: PaymentSeed[];
  guests: GuestSeed[];
  honoreeMessages?: { guest: string; body: string; at: Date }[];
  hostThread?: { author: "CUSTOMER" | UserKey; body: string; at: Date }[];
  staff: { staff: StaffKey; fn: StaffFunction; confirmed: boolean; paid: boolean; notes?: string }[];
  purchases: PurchaseSeed[];
  costs?: { category: CostCategory; description: string; amount: number; by: UserKey }[];
  checklist: "upcoming" | "completed" | "none";
  earlyDone?: number; // ítems de T-7 completados anticipadamente
  earlyInProgress?: number;
}

const STAFF_BY_FUNCTION: Partial<Record<StaffFunction, StaffKey>> = {
  COORDINATOR: "lupita",
  CHEF: "carlos",
  SETUP: "diego",
  DRIVER: "roberto",
  SERVER: "alma",
  PHOTOGRAPHER: "mariel",
};

function assignmentWindow(fn: StaffFunction, startsAt: Date, endsAt: Date): { from: Date; to: Date } {
  switch (fn) {
    case "DRIVER":
    case "SETUP":
      return { from: addMinutes(startsAt, -180), to: addMinutes(endsAt, 90) };
    case "COORDINATOR":
      return { from: addMinutes(startsAt, -180), to: addMinutes(endsAt, 60) };
    case "CHEF":
    case "KITCHEN_ASSISTANT":
      return { from: addMinutes(startsAt, -150), to: addMinutes(endsAt, 30) };
    case "PHOTOGRAPHER":
      return { from: startsAt, to: addMinutes(startsAt, 120) };
    default:
      return { from: addMinutes(startsAt, -60), to: addMinutes(endsAt, 60) };
  }
}

// =============================================================================
// Seed principal de ventas + operación
// =============================================================================
export async function seedDemoSales(prisma: PrismaClient, refs: DemoRefs, clock: Clock, rng: Rng): Promise<SalesResult> {
  const d = refs.dates;
  const now = clock.now;
  const at = (offset: number, time: string) => clock.at(offset, time);
  const eventAt = (key: string, time: string, extraDays = 0) => {
    const base = zonedDateTime(key, time);
    return new Date(base.getTime() + extraDays * DAY_MS);
  };
  const C = refs.customers;

  // ---------------------------------------------------------------------------
  // LEADS
  // ---------------------------------------------------------------------------
  const leadSeeds: LeadSeed[] = [
    {
      key: "sofia", customerKey: "sofia", occasion: "BIRTHDAY", eventDateKey: d.e1, guestCount: 10, budget: 4, status: "WON", source: "CONFIGURATOR",
      areaSlug: "polanco", experienceSlug: "birthday-table", styleSlug: "romantico", menuSlug: "brunch-clasico", honoreeName: "Sofía",
      colors: ["#E9C9BE", "#A3B18A", "#F7F3EC"], inspiration: "Rosas de jardín en blush, velas y mucho verde.", assignedTo: "ivonne", createdAt: at(-28, "21:14"),
      utmSource: "instagram", configurator: { startTime: "11:00", addOns: [{ slug: "pastel-personalizado", quantity: 1 }, { slug: "arco-globos-organico", quantity: 1 }, { slug: "papeleria-personalizada", quantity: 1 }, { slug: "memory-capsule-premium", quantity: 1 }] },
    },
    {
      key: "paola", customerKey: "paola", occasion: "BRIDAL", eventDateKey: d.e1, guestCount: 12, budget: 5, status: "WON", source: "REFERRAL",
      areaSlug: "granada", experienceSlug: "bridal-brunch", styleSlug: "elegante", menuSlug: "brunch-premium", honoreeName: "Mariana",
      colors: ["#FFFFFF", "#E8DCC8", "#C6A15B"], inspiration: "Peonías blancas, candelabros y cristalería fina.", assignedTo: "rosa", createdAt: at(-41, "10:05"),
      referredByCode: C.valeria!.referralCode, notes: "Organiza el bridal de su mejor amiga desde Monterrey.",
    },
    {
      key: "daniela", customerKey: "daniela", occasion: "BIRTHDAY", eventDateKey: d.e3, guestCount: 9, budget: 4, status: "WON", source: "TIKTOK",
      areaSlug: "irrigacion", experienceSlug: "karaoke-mimosas", styleSlug: "divertido", menuSlug: "brunch-clasico", honoreeName: "Daniela",
      colors: ["#F4B6A6", "#F6D27A", "#A8D5C2"], assignedTo: "rosa", createdAt: at(-22, "19:40"), utmSource: "tiktok", notes: "Cumple 30. Quiere karaoke sí o sí.",
    },
    {
      key: "valeria", customerKey: "valeria", occasion: "FRIENDS_BRUNCH", eventDateKey: d.e4, guestCount: 8, budget: 4, status: "WON", source: "CONFIGURATOR",
      areaSlug: "polanco", experienceSlug: "peru-x-mexico", styleSlug: "colorido", menuSlug: "sabores-peru-mexico", honoreeName: "Valeria",
      colors: ["#D6336C", "#F4A261", "#2A9D8F"], inspiration: "Textiles andinos y papel picado.", assignedTo: "ivonne", createdAt: at(-62, "12:30"),
      configurator: { startTime: "11:30", addOns: [{ slug: "pastel-personalizado", quantity: 1 }, { slug: "fotografo-2h", quantity: 1 }, { slug: "memory-capsule-premium", quantity: 1 }] },
    },
    {
      key: "anapaula", customerKey: "anapaula", occasion: "FRIENDS_BRUNCH", eventDateKey: d.e5, guestCount: 7, budget: 3, status: "WON", source: "GOOGLE",
      areaSlug: "granada", experienceSlug: "signature-brunch", styleSlug: "natural", menuSlug: "brunch-garden", honoreeName: "Ana Paula",
      assignedTo: "rosa", createdAt: at(-36, "09:20"), utmSource: "google-ads",
    },
    {
      key: "fernanda", customerKey: "fernanda", occasion: "BABY_BRUNCH", eventDateKey: d.e6, guestCount: 10, budget: 4, status: "WON", source: "WHATSAPP",
      areaSlug: "irrigacion", experienceSlug: "signature-brunch", styleSlug: "minimal", menuSlug: "brunch-garden", honoreeName: "Fernanda",
      colors: ["#F7F3EC", "#E8DCC8", "#A3B18A"], assignedTo: "ivonne", createdAt: at(-6, "17:45"),
    },
    {
      key: "lucia", customerKey: "lucia", occasion: "BIRTHDAY", eventDateKey: d.lucia, guestCount: 8, budget: 3, status: "QUOTED", source: "CONFIGURATOR",
      areaSlug: "polanco", experienceSlug: "birthday-table", styleSlug: "romantico", menuSlug: "brunch-clasico", honoreeName: "Lucía",
      colors: ["#E9C9BE", "#F7F3EC", "#A48F7E"], inspiration: "Algo romántico, con velas y flores rosas.", assignedTo: "ivonne", createdAt: at(-2, "20:10"),
      configurator: { startTime: "12:00", addOns: [{ slug: "mimosa-bar", quantity: 1 }, { slug: "pastel-personalizado", quantity: 1 }, { slug: "mini-karaoke", quantity: 1 }] },
    },
    {
      key: "monica", customerKey: "monica", occasion: "BACHELORETTE", eventDateKey: firstDateOnOrAfter(clock.dayKey(38), [6]), guestCount: 10, budget: 4, status: "QUALIFIED", source: "INSTAGRAM",
      areaSlug: "granada", experienceSlug: "karaoke-mimosas", styleSlug: "colorido", menuSlug: "brunch-clasico", honoreeName: "Mónica",
      assignedTo: "rosa", createdAt: at(-4, "13:00"), notes: "Despedida de soltera; la novia es ella misma. Quieren arco de globos.",
    },
    {
      key: "ximena", customerKey: "ximena", occasion: "FRIENDS_BRUNCH", eventDateKey: clock.dayKey(-12), guestCount: 6, budget: 1, status: "LOST", source: "CONFIGURATOR",
      areaSlug: "polanco", experienceSlug: "signature-brunch", styleSlug: "minimal", menuSlug: "brunch-clasico", assignedTo: "ivonne", createdAt: at(-31, "11:11"),
      lostReason: "Cotización vencida sin respuesta.", configurator: { startTime: "10:30", addOns: [{ slug: "papeleria-personalizada", quantity: 1 }] },
    },
    {
      key: "renata", customerKey: "renata", occasion: "BRIDAL", eventDateKey: firstDateOnOrAfter(clock.dayKey(26), [6, 0]), guestCount: 12, budget: 5, status: "LOST", source: "GOOGLE",
      areaSlug: "irrigacion", experienceSlug: "bridal-brunch", styleSlug: "romantico", menuSlug: "brunch-premium", honoreeName: "Renata",
      assignedTo: "rosa", createdAt: at(-19, "16:30"), lostReason: "Decidió celebrar en un restaurante por presupuesto.",
    },
    {
      key: "gabriela", name: "Gabriela Morales", phone: "+525551023315", email: emailFor("Gabriela Morales"), occasion: "BIRTHDAY",
      eventDateKey: firstDateOnOrAfter(clock.dayKey(35), [6, 0]), guestCount: 6, budget: 1, status: "NEW", source: "CONFIGURATOR",
      areaSlug: "polanco", experienceSlug: "signature-brunch", styleSlug: "natural", menuSlug: "brunch-clasico", honoreeName: "Gaby",
      assignedTo: "ivonne", createdAt: clock.hoursAgo(3), configurator: { startTime: "11:00", addOns: [{ slug: "pastel-personalizado", quantity: 1 }] },
    },
    {
      key: "isabel", name: "Isabel Domínguez", phone: "+525551023316", email: emailFor("Isabel Domínguez"), occasion: "FRIENDS_BRUNCH",
      eventDateKey: firstDateOnOrAfter(clock.dayKey(45), [0]), guestCount: 8, budget: 2, status: "NEW", source: "AI_DESIGNER",
      areaSlug: "granada", experienceSlug: "signature-brunch", styleSlug: "natural", menuSlug: "brunch-garden",
      colors: ["#A3B18A", "#F7F3EC", "#FFFFFF"], inspiration: "Brunch tranquilo en terraza, muy verde, con flores silvestres.",
      assignedTo: "rosa", createdAt: clock.hoursAgo(20),
    },
    {
      key: "natalia", customerKey: "natalia", occasion: "BIRTHDAY", eventDateKey: firstDateOnOrAfter(clock.dayKey(16), [0]), guestCount: 7, budget: 3, status: "CONTACTED", source: "INSTAGRAM",
      areaSlug: "polanco", experienceSlug: "birthday-table", styleSlug: "divertido", honoreeName: "Natalia", assignedTo: "ivonne", createdAt: at(-5, "22:02"),
    },
    {
      key: "carolina", name: "Carolina Vega", phone: "+525551023317", email: emailFor("Carolina Vega"), occasion: "BABY_BRUNCH",
      eventDateKey: firstDateOnOrAfter(clock.dayKey(28), [6]), guestCount: 8, budget: 2, status: "CONTACTED", source: "WHATSAPP",
      zoneText: "Coyoacán", outOfArea: true, experienceSlug: "signature-brunch", assignedTo: "rosa", createdAt: at(-3, "10:45"),
      notes: "Fuera de zona. Le ofrecimos cotizar con cargo de traslado especial o esperar a la fase 2.",
    },
    {
      key: "patricia", customerKey: "patricia", occasion: "CORPORATE", eventDateKey: firstDateOnOrAfter(clock.dayKey(50), [3, 4]), guestCount: 18, budget: 5, status: "QUALIFIED", source: "CONTACT_FORM",
      areaSlug: "polanco", specialRequest: true, experienceSlug: "peru-x-mexico", assignedTo: "ivonne", createdAt: at(-9, "09:30"),
      notes: "Desayuno de equipo directivo (18 personas). Requiere propuesta especial en dos mesas y factura.", budgetNotes: "Presupuesto aprobado por dirección: hasta $60,000.",
    },
    {
      key: "alejandra", name: "Alejandra Ruiz", phone: "+525551023318", email: emailFor("Alejandra Ruiz"), occasion: "BIRTHDAY",
      eventDateKey: firstDateOnOrAfter(clock.dayKey(12), [6]), guestCount: 10, budget: 3, status: "LOST", source: "GOOGLE",
      zoneText: "Santa Fe", outOfArea: true, experienceSlug: "birthday-table", assignedTo: "rosa", createdAt: at(-14, "18:00"),
      lostReason: "Fuera de zona de cobertura (Santa Fe).",
    },
    {
      key: "lorena", name: "Lorena Paredes", phone: "+525551023319", email: emailFor("Lorena Paredes"), occasion: "OTHER", occasionOther: "Reencuentro de generación",
      guestCount: 6, status: "NEW", source: "MANUAL", areaSlug: "irrigacion", assignedTo: "ivonne", createdAt: clock.hoursAgo(30),
      referredByCode: C.sofia!.referralCode, notes: "Llamó por recomendación de Sofía Navarro. Aún sin fecha.",
    },
  ];

  const leads: Record<string, LeadRef> = {};
  const leadSeedByKey: Record<string, LeadSeed> = {};
  for (const seed of leadSeeds) {
    const lead = await createLead(prisma, refs, seed);
    leads[seed.key] = lead;
    leadSeedByKey[seed.key] = seed;
  }

  // ---------------------------------------------------------------------------
  // COTIZACIONES
  // ---------------------------------------------------------------------------
  const quoteSeeds: QuoteSeed[] = [
    {
      key: "e1", leadId: leads.sofia!.id, customerKey: "sofia", status: "ACCEPTED", title: "Cumpleaños de Sofía", occasion: "BIRTHDAY",
      experienceSlug: "birthday-table", menuSlug: "brunch-clasico", styleSlug: "romantico", areaSlug: "polanco", guestCount: 10, eventDateKey: d.e1, startTime: "11:00",
      addOns: [{ slug: "pastel-personalizado", quantity: 1 }, { slug: "arco-globos-organico", quantity: 1 }, { slug: "papeleria-personalizada", quantity: 1 }, { slug: "memory-capsule-premium", quantity: 1 }],
      createdAt: at(-26, "11:00"), sentAt: at(-26, "11:30"), viewedAt: at(-26, "14:02"), acceptedAt: at(-25, "20:15"), createdBy: "ivonne",
    },
    {
      key: "e2", leadId: leads.paola!.id, customerKey: "paola", status: "ACCEPTED", title: "Bridal Brunch de Mariana", occasion: "BRIDAL",
      experienceSlug: "bridal-brunch", menuSlug: "brunch-premium", styleSlug: "elegante", areaSlug: "granada", guestCount: 12, eventDateKey: d.e1, startTime: "12:00",
      addOns: [{ slug: "mimosa-bar", quantity: 1 }, { slug: "fotografo-2h", quantity: 1 }, { slug: "upgrade-floral", quantity: 1 }, { slug: "regalo-homenajeada", quantity: 1 }],
      discount: { type: "PERCENT", value: 500, reason: "Clienta referida por Valeria Campos (5%)." },
      createdAt: at(-39, "10:00"), sentAt: at(-39, "10:30"), viewedAt: at(-39, "21:40"), acceptedAt: at(-37, "09:12"), createdBy: "rosa",
      internalNotes: "Descuento por referido aplicado por Ivonne.",
    },
    {
      key: "e3", leadId: leads.daniela!.id, customerKey: "daniela", status: "ACCEPTED", title: "Karaoke & Mimosas de Daniela", occasion: "BIRTHDAY",
      experienceSlug: "karaoke-mimosas", menuSlug: "brunch-clasico", styleSlug: "divertido", areaSlug: "irrigacion", guestCount: 9, eventDateKey: d.e3, startTime: "13:00",
      addOns: [{ slug: "pastel-personalizado", quantity: 1 }, { slug: "regalo-homenajeada", quantity: 1 }],
      customItems: [{ description: "Pantalla adicional para letras en la terraza", quantity: 1, unitPriceCents: mx(1_200), unitCostCents: mx(500), costCategory: "VENDOR" }],
      createdAt: at(-20, "10:00"), sentAt: at(-20, "10:15"), viewedAt: at(-20, "12:00"), acceptedAt: at(-18, "16:45"), createdBy: "rosa",
    },
    {
      key: "e4", leadId: leads.valeria!.id, customerKey: "valeria", status: "ACCEPTED", title: "Perú x México de Valeria", occasion: "FRIENDS_BRUNCH",
      experienceSlug: "peru-x-mexico", menuSlug: "sabores-peru-mexico", styleSlug: "colorido", areaSlug: "polanco", guestCount: 8, eventDateKey: d.e4, startTime: "11:30",
      addOns: [{ slug: "pastel-personalizado", quantity: 1 }, { slug: "fotografo-2h", quantity: 1 }, { slug: "memory-capsule-premium", quantity: 1 }],
      createdAt: at(-60, "11:00"), sentAt: at(-60, "11:20"), viewedAt: at(-60, "19:00"), acceptedAt: at(-58, "10:00"), createdBy: "ivonne",
    },
    {
      key: "e5", leadId: leads.anapaula!.id, customerKey: "anapaula", status: "ACCEPTED", title: "Signature Brunch de Ana Paula", occasion: "FRIENDS_BRUNCH",
      experienceSlug: "signature-brunch", menuSlug: "brunch-garden", styleSlug: "natural", areaSlug: "granada", guestCount: 7, eventDateKey: d.e5, startTime: "10:30",
      addOns: [{ slug: "mimosa-bar", quantity: 1 }, { slug: "upgrade-floral", quantity: 1 }],
      discount: { type: "AMOUNT", value: mx(500), reason: "Cortesía por cambio de fecha solicitado por nosotras." },
      createdAt: at(-34, "12:00"), sentAt: at(-34, "12:30"), viewedAt: at(-34, "18:00"), acceptedAt: at(-33, "10:30"), createdBy: "rosa",
    },
    {
      key: "e6", leadId: leads.fernanda!.id, customerKey: "fernanda", status: "ACCEPTED", title: "Baby Brunch de Fernanda", occasion: "BABY_BRUNCH",
      experienceSlug: "signature-brunch", menuSlug: "brunch-garden", styleSlug: "minimal", areaSlug: "irrigacion", guestCount: 10, eventDateKey: d.e6, startTime: "11:00",
      addOns: [{ slug: "pastel-personalizado", quantity: 1 }, { slug: "taller-floral", quantity: 1 }, { slug: "papeleria-personalizada", quantity: 1 }],
      createdAt: at(-4, "10:00"), sentAt: at(-4, "10:30"), viewedAt: at(-3, "09:00"), acceptedAt: at(-1, "21:30"), createdBy: "ivonne",
    },
    {
      key: "lucia", leadId: leads.lucia!.id, customerKey: "lucia", status: "SENT", title: "Cumpleaños de Lucía", occasion: "BIRTHDAY",
      experienceSlug: "birthday-table", menuSlug: "brunch-clasico", styleSlug: "romantico", areaSlug: "polanco", guestCount: 8, eventDateKey: d.lucia, startTime: "12:00",
      addOns: [{ slug: "mimosa-bar", quantity: 1 }, { slug: "pastel-personalizado", quantity: 1 }, { slug: "mini-karaoke", quantity: 1 }],
      createdAt: at(-1, "12:00"), sentAt: at(-1, "12:30"), publicToken: DEMO_TOKENS.luciaQuote, createdBy: "ivonne",
      notesForCustomer: `${DEFAULT_CUSTOMER_NOTES} ¡Nos encantaría celebrar contigo, Lucía!`,
    },
    {
      key: "monica", leadId: leads.monica!.id, customerKey: "monica", status: "DRAFT", title: "Despedida de Mónica", occasion: "BACHELORETTE",
      experienceSlug: "karaoke-mimosas", menuSlug: "brunch-clasico", styleSlug: "colorido", areaSlug: "granada", guestCount: 10,
      eventDateKey: leadSeedByKey.monica!.eventDateKey!, startTime: "13:00",
      addOns: [{ slug: "arco-globos-organico", quantity: 1 }, { slug: "video-recap", quantity: 1 }, { slug: "regalo-homenajeada", quantity: 1 }],
      createdAt: at(-1, "17:00"), createdBy: "rosa", internalNotes: "Confirmar si quieren menú premium antes de enviar.",
    },
    {
      key: "ximena", leadId: leads.ximena!.id, customerKey: "ximena", status: "EXPIRED", title: "Brunch de amigas de Ximena", occasion: "FRIENDS_BRUNCH",
      experienceSlug: "signature-brunch", menuSlug: "brunch-clasico", styleSlug: "minimal", areaSlug: "polanco", guestCount: 6, eventDateKey: clock.dayKey(-12), startTime: "10:30",
      addOns: [{ slug: "papeleria-personalizada", quantity: 1 }],
      createdAt: at(-30, "12:00"), sentAt: at(-30, "12:30"), viewedAt: at(-29, "09:10"), createdBy: "ivonne",
    },
    {
      key: "renata", leadId: leads.renata!.id, customerKey: "renata", status: "REJECTED", title: "Bridal Brunch de Renata", occasion: "BRIDAL",
      experienceSlug: "bridal-brunch", menuSlug: "brunch-premium", styleSlug: "romantico", areaSlug: "irrigacion", guestCount: 12,
      eventDateKey: leadSeedByKey.renata!.eventDateKey!, startTime: "12:00",
      addOns: [{ slug: "fotografo-2h", quantity: 1 }, { slug: "video-recap", quantity: 1 }, { slug: "arco-globos-organico", quantity: 1 }, { slug: "taller-floral", quantity: 1 }],
      createdAt: at(-17, "10:40"), sentAt: at(-17, "11:00"), viewedAt: at(-17, "20:00"), rejectedAt: at(-14, "13:10"),
      rejectionReason: "Decidió celebrar en un restaurante por presupuesto.", createdBy: "rosa",
    },
  ];

  const quotes: Record<string, QuoteRef> = {};
  for (const seed of quoteSeeds) quotes[seed.key] = await createQuote(prisma, refs, seed);

  // Timelines de leads (después de las cotizaciones para referenciar códigos)
  const q = (key: string) => quotes[key]!;
  const timelines: Record<string, TimelineSpec> = {
    sofia: { contactedAt: at(-27, "10:20"), contactNote: "Le escribimos por WhatsApp: confirmó 10 invitadas y fecha.", qualifiedAt: at(-27, "12:00"), quoteCode: q("e1").code, quoteCreatedAt: at(-26, "11:00"), quoteSentAt: at(-26, "11:30"), wonAt: at(-25, "20:15") },
    paola: { contactedAt: at(-41, "12:30"), channel: "CALL", contactNote: "Llamada de 20 min: bridal sorpresa para Mariana, 12 invitadas.", qualifiedAt: at(-40, "18:00"), quoteCode: q("e2").code, quoteCreatedAt: at(-39, "10:00"), quoteSentAt: at(-39, "10:30"), wonAt: at(-37, "09:12"), notes: [{ at: at(-39, "10:20"), message: "Descuento de referida (5%) aprobado por Ivonne.", actor: "ivonne" }] },
    daniela: { contactedAt: at(-21, "11:00"), qualifiedAt: at(-21, "13:00"), quoteCode: q("e3").code, quoteCreatedAt: at(-20, "10:00"), quoteSentAt: at(-20, "10:15"), wonAt: at(-18, "16:45"), notes: [{ at: at(-19, "18:00"), message: "Pidió agregar pantalla para la terraza; se agregó como cargo personalizado.", type: "WHATSAPP" }] },
    valeria: { contactedAt: at(-62, "16:00"), qualifiedAt: at(-61, "10:00"), quoteCode: q("e4").code, quoteCreatedAt: at(-60, "11:00"), quoteSentAt: at(-60, "11:20"), wonAt: at(-58, "10:00") },
    anapaula: { contactedAt: at(-36, "11:00"), channel: "EMAIL", qualifiedAt: at(-35, "10:00"), quoteCode: q("e5").code, quoteCreatedAt: at(-34, "12:00"), quoteSentAt: at(-34, "12:30"), wonAt: at(-33, "10:30") },
    fernanda: { contactedAt: at(-6, "19:00"), qualifiedAt: at(-5, "10:00"), quoteCode: q("e6").code, quoteCreatedAt: at(-4, "10:00"), quoteSentAt: at(-4, "10:30"), wonAt: at(-1, "21:30"), wonNote: "Aceptó la cotización; anticipo pendiente de pago." },
    lucia: { contactedAt: at(-1, "10:00"), contactNote: "Confirmó 8 invitadas; le interesa el karaoke.", qualifiedAt: at(-1, "10:30"), quoteCode: q("lucia").code, quoteCreatedAt: at(-1, "12:00"), quoteSentAt: at(-1, "12:30") },
    monica: { contactedAt: at(-4, "16:30"), contactNote: "Respondimos su DM de Instagram y pasamos a WhatsApp.", qualifiedAt: at(-3, "11:00"), quoteCode: q("monica").code, quoteCreatedAt: at(-1, "17:00") },
    ximena: { contactedAt: at(-30, "10:00"), qualifiedAt: at(-30, "10:30"), quoteCode: q("ximena").code, quoteCreatedAt: at(-30, "12:00"), quoteSentAt: at(-30, "12:30"), lostAt: at(-22, "09:00"), notes: [{ at: at(-25, "12:30"), message: "Recordatorio automático: la cotización vence en 48 h.", type: "SYSTEM", actor: null }] },
    renata: { contactedAt: at(-19, "18:00"), channel: "CALL", qualifiedAt: at(-18, "10:00"), quoteCode: q("renata").code, quoteCreatedAt: at(-17, "10:40"), quoteSentAt: at(-17, "11:00"), lostAt: at(-14, "13:10") },
    gabriela: {},
    isabel: { notes: [{ at: clock.hoursAgo(19.5), message: "Propuesta generada con el diseñador IA (modo demo / fallback).", type: "SYSTEM", actor: null }] },
    natalia: { contactedAt: at(-4, "11:15"), contactNote: "Le mandamos opciones de fecha y el link del configurador." },
    carolina: { contactedAt: at(-3, "12:00"), contactNote: "Le explicamos que Coyoacán está fuera de zona; evaluará cargo especial." },
    patricia: { contactedAt: at(-8, "10:00"), channel: "EMAIL", contactNote: "Enviamos presentación corporativa y opciones para 18 personas.", qualifiedAt: at(-6, "16:00"), qualifyNote: "Solicitud especial (18 invitadas): armar propuesta a dos mesas con 2 meseras extra." },
    alejandra: { contactedAt: at(-14, "19:00"), lostAt: at(-13, "10:00") },
    lorena: { notes: [{ at: clock.hoursAgo(29), message: "Llamada entrante: reencuentro de generación, 6 personas, sin fecha aún.", type: "CALL" }] },
  };
  for (const seed of leadSeeds) {
    await createLeadTimeline(prisma, refs, leads[seed.key]!, seed, timelines[seed.key] ?? {});
  }

  // ---------------------------------------------------------------------------
  // EVENTOS
  // ---------------------------------------------------------------------------
  const e1Start = eventAt(d.e1, "11:00");
  const e2Start = eventAt(d.e1, "12:00");
  const e4Start = eventAt(d.e4, "11:30");
  const e5Start = eventAt(d.e5, "10:30");

  const eventSeeds: EventSeed[] = [
    {
      key: "e1", quoteKey: "e1", title: "Cumpleaños de Sofía", status: "CONFIRMED", dateKey: d.e1, start: "11:00", end: "15:00",
      slug: "cumple-sofia", portalToken: "demo-portal-cumple-sofia-2026", inviteToken: "demo-invite-cumple-sofia-2026", honoreeName: "Sofía",
      address: { line: "Lope de Vega 214, depto. 5", notes: "Portón negro. Proveedores estacionan sobre Calderón de la Barca.", neighborhood: "Polanco V Sección", postalCode: "11560" },
      colors: ["#E9C9BE", "#A3B18A", "#F7F3EC"], dressCode: "Casual chic en tonos pastel",
      hostMessage: "¡Gracias por venir a celebrar conmigo! Prepárense para un brunch largo, muchas risas y pastel. Las quiero. — Sofi",
      inspiration: "Mesa romántica con rosas de jardín en blush, velas y mucho verde.",
      customerNotes: "Una invitada es celiaca (Valentina). Nos gustaría que el pastel sea de zanahoria.",
      internalNotes: "Mismo día que el Bridal de Mariana: revisar copas de champaña (conflicto de inventario).",
      timeline: [
        { offset: -180, title: "Salida de bodega", visibleToGuests: false },
        { offset: -150, title: "Montaje de mesa y flores", visibleToGuests: false },
        { offset: 0, title: "Bienvenida y bebidas", description: "Café de especialidad, jugos y mocktail de bienvenida." },
        { offset: 30, title: "Brunch servido", description: "Menú Brunch Clásico preparado en sitio." },
        { offset: 150, title: "Pastel y brindis", description: "Las mañanitas, velitas y brindis con espumoso." },
        { offset: 180, title: "Sobremesa y fotos" },
        { offset: 240, title: "Despedida", description: "Nosotras recogemos todo; ustedes sólo se llevan los recuerdos." },
      ],
      payments: [{ kind: "DEPOSIT", status: "PAID", method: "ONLINE", provider: "mock", amount: "deposit", at: at(-25, "20:24") }],
      guests: [
        { name: "Mariana Gil", rsvp: "ATTENDING", comment: "¡No me lo pierdo!" },
        { name: "Andrea Solís", rsvp: "ATTENDING", dietary: ["VEGETARIAN"] },
        { name: "Fernanda Ruiz", rsvp: "ATTENDING" },
        { name: "Camila Torres", rsvp: "PENDING", token: DEMO_TOKENS.camilaGuest },
        { name: "Valentina Ortega", rsvp: "ATTENDING", dietary: ["GLUTEN_FREE"], dietaryNotes: "Celiaca: por favor sin contaminación cruzada." },
        { name: "Regina Lara", rsvp: "NOT_ATTENDING", comment: "¡Lo siento muchísimo! Estaré de viaje, pero las acompaño en espíritu." },
        { name: "Daniela Pineda", rsvp: "PENDING" },
        { name: "Paulina Cárdenas", rsvp: "ATTENDING", source: "SELF_RSVP" },
        { name: "Ximena Robles", rsvp: "PENDING", noContact: true },
        { name: "Lorena Beltrán", rsvp: "ATTENDING", dietary: ["LACTOSE_FREE"] },
      ],
      honoreeMessages: [
        { guest: "Mariana Gil", body: "Sofi: gracias por ser la amiga que siempre llega con flores y abrazos. Que este año sea tan bonito como tú.", at: at(-6, "22:10") },
        { guest: "Andrea Solís", body: "Feliz cumple, amiga. Brindo por más brunches largos y conversaciones que no se acaban.", at: at(-4, "08:45") },
        { guest: "Valentina Ortega", body: "Te quiero muchísimo. ¡Gracias por pensar en mi menú sin gluten!", at: at(-2, "19:30") },
      ],
      hostThread: [
        { author: "CUSTOMER", body: "¡Hola! ¿Podemos hacer las flores más rosadas? Vi unas rosas de jardín en su Instagram que me encantaron.", at: at(-20, "18:05") },
        { author: "ivonne", body: "¡Claro, Sofía! Usaremos rosas de jardín y astromelias en blush. Te mandamos foto de muestra unos días antes.", at: at(-20, "19:12") },
        { author: "CUSTOMER", body: "¡Perfecto, gracias! Y el pastel de zanahoria, por fa.", at: at(-20, "19:40") },
        { author: "ivonne", body: "Anotado: pastel de zanahoria con betún de queso crema.", at: at(-19, "09:15") },
      ],
      staff: [
        { staff: "lupita", fn: "COORDINATOR", confirmed: true, paid: false },
        { staff: "carlos", fn: "CHEF", confirmed: true, paid: false },
        { staff: "roberto", fn: "DRIVER", confirmed: true, paid: false },
      ],
      purchases: [
        { concept: "Rosas de jardín y astromelias blush", category: "FLOWERS", vendor: "flores", expected: mx(1_500), status: "ORDERED", neededBy: addDays(e1Start, -1), orderedAt: notAfter(addDays(e1Start, -7), now), createdBy: "ivonne", createdAt: at(-15, "10:00") },
        { concept: "Pastel de zanahoria personalizado (10–12 porciones)", category: "VENDOR", vendor: "pasteleria", expected: mx(950), status: "ORDERED", neededBy: addMinutes(e1Start, -240), orderedAt: at(-12, "12:00"), createdBy: "ivonne", createdAt: at(-15, "10:05") },
        { concept: "Arco de globos orgánico blush y salvia", category: "VENDOR", vendor: "globos", expected: mx(1_400), status: "REQUESTED", neededBy: addMinutes(e1Start, -180), createdBy: "ivonne", createdAt: at(-15, "10:10") },
        { concept: "Papelería personalizada (menú y letrero)", category: "VENDOR", vendor: null, expected: mx(450), status: "REQUESTED", neededBy: addDays(e1Start, -2), notes: "Buscar imprenta alterna: Papel Algodón está en pausa.", createdBy: "ivonne", createdAt: at(-15, "10:12") },
      ],
      checklist: "upcoming", earlyDone: 3, earlyInProgress: 1,
    },
    {
      key: "e2", quoteKey: "e2", title: "Bridal Brunch de Mariana", status: "CONFIRMED", dateKey: d.e1, start: "12:00", end: "16:00",
      slug: "bridal-mariana", portalToken: "demo-portal-bridal-mariana-2026", inviteToken: "demo-invite-bridal-mariana-2026", honoreeName: "Mariana",
      address: { line: "Lago Alberto 320, torre B, depto. 1204", notes: "Registrar al staff en recepción con INE. Elevador de servicio al fondo.", neighborhood: "Granada", postalCode: "11520" },
      colors: ["#FFFFFF", "#E8DCC8", "#C6A15B"], dressCode: "Blanco y nude — la novia va de color",
      hostMessage: "Mariana: hoy es para ti. Gracias por dejarnos celebrarte antes del gran día. — Paola y tus amigas",
      inspiration: "Mesa nupcial con peonías blancas, candelabros de latón y cristalería fina.",
      customerNotes: "Mariana no sabe del regalo: entregarlo después del brindis. Una invitada es alérgica a las nueces.",
      internalNotes: "Rosa coordina en sitio. Saldo pendiente (Paola paga desde Monterrey). Flores premium con Botánica Roma.",
      timeline: [
        { offset: -180, title: "Salida de bodega", visibleToGuests: false },
        { offset: -120, title: "Montaje nupcial y flores", visibleToGuests: false },
        { offset: 0, title: "Llegada de invitadas y brindis de bienvenida" },
        { offset: 20, title: "Llegada de la novia", description: "¡Sorpresa! Todas listas en la mesa." },
        { offset: 45, title: "Brunch Premium servido" },
        { offset: 150, title: "Dinámica de consejos y buenos deseos" },
        { offset: 200, title: "Entrega del regalo y fotos" },
      ],
      payments: [
        { kind: "DEPOSIT", status: "PAID", method: "ONLINE", provider: "mock", amount: "deposit", at: at(-37, "09:30") },
        { kind: "BALANCE", status: "PENDING", method: "ONLINE", provider: "mock", amount: "balance", at: at(-2, "10:00"), notes: "Saldo: vence 3 días antes del evento." },
      ],
      guests: [
        { name: "Lucía Fernández", rsvp: "ATTENDING" },
        { name: "Paulina Garza", rsvp: "ATTENDING", dietary: ["VEGAN"] },
        { name: "Sofía Mendoza", rsvp: "ATTENDING" },
        { name: "Andrea Villarreal", rsvp: "PENDING" },
        { name: "Natalia Rivas", rsvp: "ATTENDING", dietary: ["NUT_ALLERGY"], dietaryNotes: "Alergia severa a nueces." },
        { name: "Isabela Treviño", rsvp: "NOT_ATTENDING", comment: "Estaré en Madrid, ¡las extraño!" },
        { name: "Carla Benavides", rsvp: "ATTENDING" },
        { name: "Renata Sáenz", rsvp: "MAYBE" },
      ],
      honoreeMessages: [
        { guest: "Lucía Fernández", body: "Mariana, verte tan feliz es el mejor regalo. ¡Que vivan los novios!", at: at(-5, "21:00") },
        { guest: "Carla Benavides", body: "Consejo de casada: nunca se vayan a dormir enojados… y siempre compartan el postre.", at: at(-3, "13:20") },
      ],
      hostThread: [
        { author: "CUSTOMER", body: "Hola, ¿pueden entregar el regalo a Mariana después del brindis? Es sorpresa.", at: at(-30, "20:00") },
        { author: "rosa", body: "Sí, Paola. Lo entregamos justo después del brindis y avisamos a la fotógrafa para que capture el momento.", at: at(-30, "20:35") },
      ],
      staff: [
        { staff: "alma", fn: "SERVER", confirmed: true, paid: false },
        { staff: "diego", fn: "SETUP", confirmed: true, paid: false },
      ],
      purchases: [
        { concept: "Peonías y rosas blancas premium + upgrade floral", category: "FLOWERS", vendor: "botanica", expected: mx(3_900), status: "ORDERED", neededBy: addDays(e2Start, -1), orderedAt: at(-10, "11:00"), createdBy: "rosa", createdAt: at(-12, "10:00") },
        { concept: "Espumoso mexicano para brindis y mimosa bar (12 botellas)", category: "FOOD", vendor: "cava", expected: mx(2_100), status: "ORDERED", neededBy: addDays(e2Start, -1), orderedAt: at(-9, "12:00"), createdBy: "rosa", createdAt: at(-12, "10:05") },
        { concept: "Fotógrafa 2 h — Luz de Domingo", category: "VENDOR", vendor: "foto", expected: mx(2_800), status: "ORDERED", neededBy: e2Start, orderedAt: at(-30, "10:00"), createdBy: "rosa", createdAt: at(-31, "10:00") },
        { concept: "Caja de regalo para la novia", category: "VENDOR", vendor: null, expected: mx(520), status: "REQUESTED", neededBy: addDays(e2Start, -2), createdBy: "rosa", createdAt: at(-12, "10:10") },
      ],
      checklist: "upcoming", earlyDone: 2,
    },
    {
      key: "e3", quoteKey: "e3", title: "Karaoke & Mimosas de Daniela", status: "PLANNING", dateKey: d.e3, start: "13:00", end: "17:00",
      slug: "karaoke-daniela", portalToken: "demo-portal-karaoke-daniela-2026", inviteToken: "demo-invite-karaoke-daniela-2026", honoreeName: "Daniela",
      address: { line: "Presa Falcón 45, casa 2", notes: "Terraza techada en el segundo piso; subir equipo por escalera exterior.", neighborhood: "Irrigación", postalCode: "11500" },
      colors: ["#F4B6A6", "#F6D27A", "#A8D5C2", "#8FB3E0"], dressCode: "Brillos y lentejuelas: ¡ven lista para cantar!",
      hostMessage: "¡30 y cantando! Las espero con la garganta lista y muchas ganas de bailar. — Dani",
      customerNotes: "Queremos canciones de Paquita la del Barrio, Shakira y Bad Bunny. La terraza es techada.",
      internalNotes: "Anticipo por transferencia (registrado por Rosa). Pantalla extra para terraza como cargo personalizado.",
      timeline: [
        { offset: -180, title: "Salida de bodega con equipo de karaoke", visibleToGuests: false },
        { offset: -60, title: "Prueba de sonido", visibleToGuests: false },
        { offset: 0, title: "Bienvenida con mimosas" },
        { offset: 30, title: "Brunch servido" },
        { offset: 90, title: "¡Micrófono abierto!", description: "Primera ronda de karaoke." },
        { offset: 180, title: "Pastel y brindis por los 30" },
        { offset: 240, title: "Última canción y despedida" },
      ],
      payments: [{ kind: "DEPOSIT", status: "PAID", method: "TRANSFER", provider: "manual", amount: "deposit", at: at(-17, "11:20"), recordedBy: "rosa", notes: "Transferencia SPEI — ref. 0849321 (BBVA)." }],
      guests: [
        { name: "Karla Méndez", rsvp: "ATTENDING" },
        { name: "Brenda Ochoa", rsvp: "ATTENDING" },
        { name: "Itzel Ramos", rsvp: "PENDING" },
        { name: "Mónica Paredes", rsvp: "ATTENDING", dietary: ["VEGETARIAN"] },
        { name: "Alejandra Cruz", rsvp: "NOT_ATTENDING", comment: "¡Canten una por mí!" },
      ],
      honoreeMessages: [
        { guest: "Karla Méndez", body: "Dani, prometo no cantar 'Rata de dos patas' más de tres veces. ¡Feliz cumple!", at: at(-2, "23:05") },
      ],
      hostThread: [
        { author: "CUSTOMER", body: "¿Podemos poner la pantalla en la terraza? Está techada.", at: at(-19, "17:30") },
        { author: "rosa", body: "Sí, Dani. Agregamos una pantalla extra para que todas vean las letras (ya está en tu cotización).", at: at(-19, "18:05") },
      ],
      staff: [
        { staff: "lupita", fn: "COORDINATOR", confirmed: true, paid: false },
        { staff: "carlos", fn: "CHEF", confirmed: true, paid: false },
        { staff: "alma", fn: "SERVER", confirmed: false, paid: false, notes: "Por confirmar disponibilidad." },
      ],
      purchases: [
        { concept: "Flores de colores y follaje", category: "FLOWERS", vendor: "flores", expected: mx(1_100), status: "REQUESTED", createdBy: "rosa", createdAt: at(-8, "10:00") },
        { concept: "Espumoso y jugos para mimosas (9 invitadas)", category: "FOOD", vendor: "cava", expected: mx(1_200), status: "REQUESTED", createdBy: "rosa", createdAt: at(-8, "10:05") },
        { concept: "Renta de pantalla adicional 50\"", category: "VENDOR", vendor: "mobiliario", expected: mx(500), status: "REQUESTED", createdBy: "rosa", createdAt: at(-8, "10:10") },
        { concept: "Renta de carpa para terraza", category: "VENDOR", vendor: "mobiliario", expected: mx(1_800), status: "CANCELLED", cancelledAt: at(-3, "12:00"), notes: "La terraza es techada; ya no se requiere.", createdBy: "rosa", createdAt: at(-10, "10:00") },
      ],
      checklist: "upcoming", earlyInProgress: 1,
    },
    {
      key: "e4", quoteKey: "e4", title: "Perú x México de Valeria", status: "COMPLETED", dateKey: d.e4, start: "11:30", end: "15:00",
      slug: "peru-mexico-valeria", portalToken: "demo-portal-peru-valeria-2026", inviteToken: "demo-invite-peru-valeria-2026", honoreeName: "Valeria",
      address: { line: "Aristóteles 118, PH", notes: "Acceso por estacionamiento; avisar a vigilancia.", neighborhood: "Polanco III Sección", postalCode: "11540" },
      colors: ["#D6336C", "#F4A261", "#2A9D8F", "#E9C46A"], dressCode: "Smart casual con un toque de color",
      hostMessage: "Gracias por compartir mis dos mundos en una sola mesa. ¡Salud con chilcano! — Vale",
      inspiration: "Textiles andinos, papel picado y flores de colores.",
      customerNotes: "Una invitada es alérgica a mariscos: ceviche de palmito para ella.",
      internalNotes: "Evento cerrado. El pescado salió más caro por temporada.",
      timeline: [
        { offset: -180, title: "Salida de bodega", visibleToGuests: false },
        { offset: 0, title: "Bienvenida con chicha morada y chilcano" },
        { offset: 30, title: "Barra de ceviche en vivo" },
        { offset: 75, title: "Brunch Sabores Perú x México" },
        { offset: 165, title: "Suspiro limeño, churros y pastel" },
        { offset: 210, title: "Despedida" },
      ],
      payments: [
        { kind: "DEPOSIT", status: "PAID", method: "ONLINE", provider: "mock", amount: "deposit", at: at(-58, "10:12") },
        { kind: "BALANCE", status: "PAID", method: "TRANSFER", provider: "manual", amount: "balance", at: addDays(e4Start, -4), recordedBy: "rosa", notes: "Transferencia SPEI — ref. 7712045 (Santander)." },
      ],
      guests: [
        { name: "Rocío Paz", rsvp: "ATTENDING" },
        { name: "Milagros Quispe", rsvp: "ATTENDING" },
        { name: "Gabriela Soto", rsvp: "ATTENDING" },
        { name: "Luciana Vargas", rsvp: "ATTENDING" },
        { name: "Diana Herrera", rsvp: "ATTENDING" },
        { name: "Elena Castro", rsvp: "ATTENDING" },
        { name: "Mariela Chávez", rsvp: "ATTENDING", dietary: ["SEAFOOD_ALLERGY"], dietaryNotes: "Alergia a mariscos y pescado." },
        { name: "Adriana Peña", rsvp: "ATTENDING" },
      ],
      honoreeMessages: [
        { guest: "Rocío Paz", body: "Vale, qué manera tan bonita de juntar tus dos países. ¡Gracias por invitarme!", at: addDays(e4Start, -2) },
      ],
      hostThread: [
        { author: "CUSTOMER", body: "¡Gracias por todo! Mis amigas no paran de hablar del ceviche.", at: addDays(e4Start, 1) },
        { author: "ivonne", body: "¡Gracias a ti, Vale! Ya está lista tu Memory Capsule con las fotos de todas.", at: addDays(e4Start, 2) },
      ],
      staff: [
        { staff: "lupita", fn: "COORDINATOR", confirmed: true, paid: true },
        { staff: "carlos", fn: "CHEF", confirmed: true, paid: true },
        { staff: "alma", fn: "SERVER", confirmed: true, paid: true },
        { staff: "roberto", fn: "DRIVER", confirmed: true, paid: true },
      ],
      purchases: [
        { concept: "Pescado fresco para ceviche y tiradito", category: "FOOD", vendor: "pescados", expected: mx(1_800), actual: mx(2_050), status: "RECEIVED", orderedAt: addDays(e4Start, -2), receivedAt: addMinutes(e4Start, -300), notes: "Subió el precio por temporada.", createdBy: "ivonne", createdAt: addDays(e4Start, -6) },
        { concept: "Insumos de cocina (abarrotes, lácteos, fruta y pan)", category: "FOOD", vendor: "panaderia", expected: mx(2_600), actual: mx(2_480), status: "RECEIVED", orderedAt: addDays(e4Start, -3), receivedAt: addDays(e4Start, -1), createdBy: "ivonne", createdAt: addDays(e4Start, -6) },
        { concept: "Flores de color y follaje", category: "FLOWERS", vendor: "flores", expected: mx(1_300), actual: mx(1_250), status: "RECEIVED", orderedAt: addDays(e4Start, -7), receivedAt: addDays(e4Start, -1), createdBy: "ivonne", createdAt: addDays(e4Start, -8) },
        { concept: "Pastel personalizado — Dulce Alondra", category: "VENDOR", vendor: "pasteleria", expected: mx(950), actual: mx(950), status: "RECEIVED", orderedAt: addDays(e4Start, -6), receivedAt: addMinutes(e4Start, -120), createdBy: "ivonne", createdAt: addDays(e4Start, -8) },
        { concept: "Fotógrafa 2 h — Luz de Domingo", category: "VENDOR", vendor: "foto", expected: mx(2_800), actual: mx(2_800), status: "RECEIVED", orderedAt: addDays(e4Start, -20), receivedAt: addDays(e4Start, 3), createdBy: "ivonne", createdAt: addDays(e4Start, -21) },
        { concept: "Desechables, hielo y especias", category: "CONSUMABLES", vendor: null, expected: mx(1_040), actual: mx(980), status: "RECEIVED", receivedAt: addDays(e4Start, -1), createdBy: "ivonne", createdAt: addDays(e4Start, -3) },
      ],
      costs: [
        { category: "OTHER", description: "Hielo y propinas", amount: mx(450), by: "ivonne" },
        { category: "TRANSPORT", description: "Estacionamiento", amount: mx(180), by: "ivonne" },
        { category: "TRANSPORT", description: "Gasolina", amount: mx(320), by: "ivonne" },
      ],
      checklist: "completed",
    },
    {
      key: "e5", quoteKey: "e5", title: "Signature Brunch de Ana Paula", status: "COMPLETED", dateKey: d.e5, start: "10:30", end: "13:30",
      slug: "brunch-ana-paula", portalToken: "demo-portal-brunch-anapaula-2026", inviteToken: "demo-invite-brunch-anapaula-2026", honoreeName: "Ana Paula",
      address: { line: "Lago Andrómaco 77, depto. 802", notes: "Terraza con sol de mañana: llevar sombrillas.", neighborhood: "Ampliación Granada", postalCode: "11529" },
      colors: ["#F7F3EC", "#E8DCC8", "#A3B18A", "#5C6B4E"], dressCode: "Lino y tonos tierra",
      hostMessage: "Un brunch sin pretexto, sólo para estar juntas. Gracias por venir. — Ana Pau",
      customerNotes: "Más verde y menos flor. Terraza con sol de mañana.",
      internalNotes: "Pendiente de cierre: costos reales arriba de lo estimado (flores y cocina).",
      timeline: [
        { offset: -180, title: "Salida de bodega", visibleToGuests: false },
        { offset: 0, title: "Bienvenida con mimosas" },
        { offset: 30, title: "Brunch Garden servido" },
        { offset: 120, title: "Postre y café" },
        { offset: 180, title: "Despedida" },
      ],
      payments: [{ kind: "FULL", status: "PAID", method: "ONLINE", provider: "mock", amount: "full", at: at(-33, "10:41") }],
      guests: [
        { name: "Teresa Gómez", rsvp: "ATTENDING" },
        { name: "Mónica Salas", rsvp: "ATTENDING" },
        { name: "Claudia Rivera", rsvp: "ATTENDING", dietary: ["VEGAN"] },
        { name: "Patricia León", rsvp: "ATTENDING" },
        { name: "Verónica Ávila", rsvp: "ATTENDING" },
        { name: "Silvia Montes", rsvp: "ATTENDING" },
        { name: "Beatriz Ocampo", rsvp: "ATTENDING" },
      ],
      staff: [
        { staff: "lupita", fn: "COORDINATOR", confirmed: true, paid: false },
        { staff: "carlos", fn: "CHEF", confirmed: true, paid: false },
        { staff: "alma", fn: "SERVER", confirmed: true, paid: false },
        { staff: "diego", fn: "SETUP", confirmed: true, paid: false },
      ],
      purchases: [
        { concept: "Insumos de cocina Brunch Garden", category: "FOOD", vendor: "panaderia", expected: mx(2_500), actual: mx(3_350), status: "RECEIVED", orderedAt: addDays(e5Start, -3), receivedAt: addDays(e5Start, -1), notes: "Aguacate y frutos rojos muy por encima de lo presupuestado.", createdBy: "rosa", createdAt: addDays(e5Start, -6) },
        { concept: "Flores de temporada + upgrade floral", category: "FLOWERS", vendor: "botanica", expected: mx(2_500), actual: mx(3_300), status: "RECEIVED", orderedAt: addDays(e5Start, -6), receivedAt: addDays(e5Start, -1), notes: "Sustitución de peonías por temporada.", createdBy: "rosa", createdAt: addDays(e5Start, -8) },
        { concept: "Espumoso y jugos para mimosa bar", category: "FOOD", vendor: "cava", expected: mx(900), actual: mx(1_050), status: "RECEIVED", orderedAt: addDays(e5Start, -4), receivedAt: addDays(e5Start, -1), createdBy: "rosa", createdAt: addDays(e5Start, -6) },
        { concept: "Renta de 4 sillas adicionales", category: "VENDOR", vendor: "mobiliario", expected: mx(400), actual: mx(650), status: "RECEIVED", orderedAt: addDays(e5Start, -2), receivedAt: addMinutes(e5Start, -200), createdBy: "rosa", createdAt: addDays(e5Start, -3) },
        { concept: "Desechables, hielo y velas", category: "CONSUMABLES", vendor: null, expected: mx(770), actual: mx(820), status: "RECEIVED", receivedAt: addDays(e5Start, -1), createdBy: "rosa", createdAt: addDays(e5Start, -3) },
      ],
      costs: [
        { category: "OTHER", description: "Hielo extra y propinas", amount: mx(500), by: "rosa" },
        { category: "TRANSPORT", description: "Estacionamiento", amount: mx(250), by: "rosa" },
        { category: "TRANSPORT", description: "Uber por insumo olvidado (hielo y limones)", amount: mx(320), by: "rosa" },
      ],
      checklist: "completed",
    },
    {
      key: "e6", quoteKey: "e6", title: "Baby Brunch de Fernanda", status: "PENDING_PAYMENT", dateKey: d.e6, start: "11:00", end: "14:00",
      slug: "baby-brunch-fernanda", portalToken: "demo-portal-baby-fernanda-2026", inviteToken: "demo-invite-baby-fernanda-2026", honoreeName: "Fernanda",
      address: { line: "Presa Salinillas 210", notes: "Casa con jardín; acceso por la cochera.", neighborhood: "Irrigación", postalCode: "11500" },
      colors: ["#F7F3EC", "#E8DCC8", "#A3B18A"], dressCode: "Tonos neutros y verde salvia",
      hostMessage: "¡Ya casi llega! Gracias por acompañarme en esta etapa tan bonita. — Fer",
      customerNotes: "Sin alcohol para la festejada; mocktails para todas.",
      internalNotes: "Anticipo pendiente: enviar recordatorio si no paga en 48 h.",
      timeline: [
        { offset: 0, title: "Bienvenida con mocktails" },
        { offset: 30, title: "Brunch Garden servido" },
        { offset: 90, title: "Taller floral" },
        { offset: 150, title: "Pastel y buenos deseos para el bebé" },
        { offset: 180, title: "Despedida" },
      ],
      payments: [{ kind: "DEPOSIT", status: "PENDING", method: "ONLINE", provider: "mock", amount: "deposit", at: at(-1, "21:31") }],
      guests: [],
      hostThread: [
        { author: "CUSTOMER", body: "Hola, ¿el anticipo lo puedo pagar con tarjeta?", at: notAfter(at(0, "09:10"), now) },
        { author: "ivonne", body: "¡Hola, Fer! Sí, desde tu portal puedes pagar con tarjeta en línea. Cualquier duda aquí estamos.", at: notAfter(at(0, "09:25"), now) },
      ],
      staff: [],
      purchases: [],
      checklist: "none",
    },
  ];

  // Plantillas de checklist (creadas por el seed base)
  const templateItems = await prisma.checklistTemplateItem.findMany({
    include: { template: true },
    orderBy: [{ template: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  const events = {} as Record<EventKey, EventRef>;
  const memoryShareTokens = { e4: DEMO_TOKENS.memoryValeria, e5: generateToken(24) };
  let guestPhoneIndex = 0;

  for (const seed of eventSeeds) {
    const quote = quotes[seed.quoteKey]!;
    const quoteSeed = quoteSeeds.find((qs) => qs.key === seed.quoteKey)!;
    const customer = refs.customers[quoteSeed.customerKey]!;
    const acceptedAt = quote.acceptedAt!;
    const startsAt = zonedDateTime(seed.dateKey, seed.start);
    const endsAt = zonedDateTime(seed.dateKey, seed.end);
    const departureAt = addMinutes(startsAt, -180);
    const setupStartsAt = addMinutes(startsAt, -150);
    const teardownAt = endsAt;
    const completed = seed.status === "COMPLETED";

    // --- Evento --------------------------------------------------------------
    const event = await prisma.event.create({
      data: {
        code: uniqueCode("EV", acceptedAt),
        title: seed.title,
        status: seed.status,
        customerId: customer.id,
        quoteId: quote.id,
        experienceId: refs.experiences[quoteSeed.experienceSlug]!.id,
        menuId: refs.menus[quoteSeed.menuSlug]!.id,
        styleId: refs.styles[quoteSeed.styleSlug]!.id,
        serviceAreaId: refs.areas[quoteSeed.areaSlug]!.id,
        occasion: quoteSeed.occasion,
        honoreeName: seed.honoreeName,
        eventDate: dateOnly(seed.dateKey),
        startsAt,
        endsAt,
        guestCount: quoteSeed.guestCount,
        addressLine: seed.address.line,
        addressNotes: seed.address.notes ?? null,
        neighborhood: seed.address.neighborhood,
        city: "Ciudad de México",
        postalCode: seed.address.postalCode,
        mapsUrl: mapsUrl(seed.address.line, seed.address.neighborhood),
        colors: seed.colors,
        inspiration: seed.inspiration ?? null,
        dressCode: seed.dressCode,
        hostMessage: seed.hostMessage,
        playlistUrl: "https://open.spotify.com/playlist/demo",
        customerNotes: seed.customerNotes ?? null,
        internalNotes: seed.internalNotes ?? null,
        micrositeSlug: seed.slug,
        micrositeEnabled: true,
        inviteToken: seed.inviteToken,
        portalToken: seed.portalToken,
        departureAt,
        setupStartsAt,
        teardownAt,
        completedAt: completed ? endsAt : null,
        createdAt: acceptedAt,
        timeline: {
          create: seed.timeline.map((t, i) => ({
            time: shiftTime(seed.start, t.offset),
            title: t.title,
            description: t.description ?? null,
            visibleToGuests: t.visibleToGuests ?? true,
            sortOrder: i + 1,
          })),
        },
      },
    });

    // --- Add-ons (copiados de la cotización) ----------------------------------
    const addOnItems = quote.calc.lines.filter((i) => i.type === "ADDON");
    for (const sel of quoteSeed.addOns) {
      const addOn = refs.addOns[sel.slug]!;
      const item = addOnItems.find((i) => i.refId === addOn.id)!;
      await prisma.eventAddOn.create({
        data: {
          eventId: event.id,
          addOnId: addOn.id,
          quantity: sel.quantity,
          priceCents: item.totalPriceCents,
          costCents: item.totalCostCents,
          notes: addOn.pricingType === "PER_GUEST" ? `${quoteSeed.guestCount} invitadas × precio por invitada` : null,
        },
      });
    }

    // --- Booking ----------------------------------------------------------------
    const booking = await prisma.booking.create({
      data: {
        code: uniqueCode("B", acceptedAt),
        quoteId: quote.id,
        customerId: customer.id,
        eventId: event.id,
        totalCents: quote.calc.totalCents,
        depositRequiredCents: quote.calc.depositCents,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: acceptedAt,
        acceptedByName: customer.name,
        acceptedIp: `203.0.113.${randInt(rng, 10, 250)}`,
        balanceDueAt: addDays(startsAt, -3),
        createdAt: acceptedAt,
      },
    });

    // --- Pagos -------------------------------------------------------------------
    const paymentIds: EventRef["paymentIds"] = [];
    for (const p of seed.payments) {
      const amountCents =
        p.amount === "deposit"
          ? quote.calc.depositCents
          : p.amount === "balance"
            ? quote.calc.totalCents - quote.calc.depositCents
            : quote.calc.totalCents;
      const isPaid = p.status === "PAID";
      const isOnline = p.method === "ONLINE";
      const suffix = p.kind.toLowerCase();
      const hasCheckout = isOnline && (isPaid || seed.status === "PENDING_PAYMENT");
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          kind: p.kind,
          status: p.status,
          method: p.method,
          provider: p.provider,
          providerCheckoutId: hasCheckout ? `mock_cs_${booking.code.toLowerCase()}_${suffix}` : null,
          providerPaymentId: isOnline && isPaid ? `mock_pi_${shortId(8)}` : null,
          amountCents,
          feeCents: isOnline && isPaid ? paymentFee(amountCents) : 0,
          idempotencyKey: `seed-${booking.code}-${suffix}`,
          paidAt: isPaid ? p.at : null,
          notes: p.notes ?? null,
          recordedById: p.recordedBy ? refs.users[p.recordedBy].id : null,
          createdAt: isPaid ? addMinutes(p.at, -6) : p.at,
        },
      });
      paymentIds.push({ kind: p.kind, id: payment.id, status: p.status, amountCents, method: p.method });
    }

    // --- Invitadas ----------------------------------------------------------------
    const invitedAt = notAfter(addDays(acceptedAt, 2), now);
    const guestRows: EventRef["guests"] = [];
    for (const [gi, g] of seed.guests.entries()) {
      guestPhoneIndex++;
      const responded = g.rsvp !== "PENDING";
      const respondedAt = responded
        ? new Date(invitedAt.getTime() + Math.floor(rng() * Math.max(HOUR_MS, Math.min(now.getTime(), startsAt.getTime()) - invitedAt.getTime()) * 0.8))
        : null;
      const token = g.token ?? generateToken();
      const guest = await prisma.eventGuest.create({
        data: {
          eventId: event.id,
          name: g.name,
          email: g.noContact ? null : emailFor(g.name),
          phone: g.noContact || gi % 3 === 2 ? null : phoneFor(guestPhoneIndex),
          token,
          rsvpStatus: g.rsvp,
          plusOne: !!g.plusOne,
          plusOneName: g.plusOne ?? null,
          dietaryRestrictions: g.dietary ?? [],
          dietaryNotes: g.dietaryNotes ?? null,
          comment: g.comment ?? null,
          source: g.source ?? "HOST",
          photoConsent: completed || (responded && g.rsvp === "ATTENDING" && gi % 4 !== 1),
          respondedAt: respondedAt ? notAfter(respondedAt, now) : null,
          invitedAt: g.source === "SELF_RSVP" ? null : invitedAt,
          createdAt: g.source === "SELF_RSVP" && respondedAt ? notAfter(respondedAt, now) : invitedAt,
        },
      });
      guestRows.push({ id: guest.id, name: g.name, token, rsvpStatus: g.rsvp, email: guest.email, phone: guest.phone });
    }
    const guestId = (name: string) => guestRows.find((g) => g.name === name)?.id ?? null;

    // --- Mensajes -------------------------------------------------------------------
    const messages: Prisma.EventMessageCreateManyInput[] = [];
    for (const m of seed.honoreeMessages ?? []) {
      messages.push({ eventId: event.id, kind: "HONOREE", authorType: "GUEST", authorName: m.guest, guestId: guestId(m.guest), body: m.body, createdAt: notAfter(m.at, now) });
    }
    for (const m of seed.hostThread ?? []) {
      const isCustomer = m.author === "CUSTOMER";
      messages.push({
        eventId: event.id,
        kind: "HOST_THREAD",
        authorType: isCustomer ? "CUSTOMER" : "ADMIN",
        authorName: isCustomer ? customer.name : refs.users[m.author as UserKey].name,
        body: m.body,
        createdAt: notAfter(m.at, now),
      });
    }
    if (messages.length) await prisma.eventMessage.createMany({ data: messages });

    // --- Checklist ---------------------------------------------------------------------
    if (seed.checklist !== "none") {
      const rows: Prisma.EventChecklistItemCreateManyInput[] = [];
      let t7Index = 0;
      for (const [idx, ti] of templateItems.entries()) {
        const dueAt = addMinutes(startsAt, ti.offsetMinutes);
        const staffKey = ti.defaultFunction ? STAFF_BY_FUNCTION[ti.defaultFunction] : undefined;
        const assignee = staffKey ? refs.staff[staffKey] : null;
        let status: ChecklistItemStatus = "PENDING";
        let completedAt: Date | null = null;
        if (seed.checklist === "completed") {
          const isFinalClose = ti.template.phase === "CLOSING" && idx === templateItems.length - 1;
          if (seed.key === "e5" && isFinalClose) {
            status = "PENDING"; // E5 aún sin cerrar
          } else {
            status = "DONE";
            completedAt = notAfter(addMinutes(dueAt, randInt(rng, 5, 45)), now);
          }
        } else if (dueAt.getTime() <= now.getTime()) {
          status = "DONE";
          completedAt = addMinutes(dueAt, randInt(rng, 5, 45));
        } else if (ti.template.phase === "T_MINUS_7") {
          if (t7Index < (seed.earlyDone ?? 0)) {
            status = "DONE";
            completedAt = notAfter(addDays(acceptedAt, 2 + t7Index), now);
          } else if (t7Index < (seed.earlyDone ?? 0) + (seed.earlyInProgress ?? 0)) {
            status = "IN_PROGRESS";
          }
          t7Index++;
        }
        let evidenceMediaId: string | null = null;
        if (status === "DONE" && ti.requiresEvidence && completed && (ti.template.phase === "SETUP" || ti.template.phase === "T_MINUS_1")) {
          const media = await prisma.mediaAsset.create({
            data: {
              ...placeholderMedia(ti.template.phase === "SETUP" ? "gallery-04" : "brunch-table", "CHECKLIST_EVIDENCE", {
                alt: `Evidencia: ${ti.title}`,
              }),
              eventId: event.id,
              uploadedById: assignee?.userId ?? refs.users.ivonne.id,
              uploaderName: assignee?.name ?? "Ivonne",
              createdAt: completedAt ?? dueAt,
            },
          });
          evidenceMediaId = media.id;
        }
        rows.push({
          eventId: event.id,
          templateItemId: ti.id,
          phase: ti.template.phase,
          area: ti.area,
          title: ti.title,
          description: ti.description,
          status,
          assigneeId: assignee?.id ?? null,
          dueAt,
          requiresEvidence: ti.requiresEvidence,
          evidenceMediaId,
          completedAt,
          completedById: status === "DONE" ? (assignee?.userId ?? refs.users.ivonne.id) : null,
          sortOrder: idx + 1,
          createdAt: acceptedAt,
        });
      }
      await prisma.eventChecklistItem.createMany({ data: rows });
    }

    // --- Staff --------------------------------------------------------------------------
    for (const s of seed.staff) {
      const member = refs.staff[s.staff];
      const win = assignmentWindow(s.fn, startsAt, endsAt);
      const hours = Math.ceil((win.to.getTime() - win.from.getTime()) / HOUR_MS);
      await prisma.staffAssignment.create({
        data: {
          eventId: event.id,
          staffMemberId: member.id,
          function: s.fn,
          startsAt: win.from,
          endsAt: win.to,
          amountCents: member.rateType === "PER_HOUR" ? member.rateCents * hours : member.rateCents,
          confirmed: s.confirmed,
          paid: s.paid,
          notes: s.notes ?? null,
          createdAt: notAfter(addDays(acceptedAt, 1), now),
        },
      });
    }

    // --- Compras y costos ----------------------------------------------------------------
    for (const p of seed.purchases) {
      await prisma.purchase.create({
        data: {
          eventId: event.id,
          vendorId: p.vendor ? refs.vendors[p.vendor]!.id : null,
          concept: p.concept,
          category: p.category,
          expectedAmountCents: p.expected,
          actualAmountCents: p.actual ?? null,
          status: p.status,
          neededBy: p.neededBy ?? addDays(startsAt, -1),
          orderedAt: p.orderedAt ? notAfter(p.orderedAt, now) : null,
          receivedAt: p.receivedAt ? notAfter(p.receivedAt, now) : null,
          cancelledAt: p.cancelledAt ? notAfter(p.cancelledAt, now) : null,
          notes: p.notes ?? null,
          createdById: refs.users[p.createdBy].id,
          createdAt: notAfter(p.createdAt, now),
        },
      });
    }
    for (const c of seed.costs ?? []) {
      await prisma.eventCost.create({
        data: {
          eventId: event.id,
          category: c.category,
          description: c.description,
          amountCents: c.amount,
          createdById: refs.users[c.by].id,
          createdAt: addMinutes(endsAt, 240),
        },
      });
    }

    events[seed.key] = {
      key: seed.key,
      id: event.id,
      code: event.code,
      title: seed.title,
      slug: seed.slug,
      portalToken: seed.portalToken,
      inviteToken: seed.inviteToken,
      status: seed.status,
      dateKey: seed.dateKey,
      startsAt,
      endsAt,
      customerKey: quoteSeed.customerKey,
      quote,
      bookingId: booking.id,
      bookingCode: booking.code,
      paymentIds,
      guests: guestRows,
      experienceSlug: quoteSeed.experienceSlug,
    };
  }

  // ---------------------------------------------------------------------------
  // INVENTARIO: reservas y movimientos
  // ---------------------------------------------------------------------------
  const invById = Object.fromEntries(Object.values(refs.inventory).map((i) => [i.id, i]));
  const movementRows: Prisma.InventoryMovementCreateManyInput[] = [];
  let lossCentsE4 = 0;
  for (const key of ["e1", "e2", "e3", "e4", "e5"] as const) {
    const ev = events[key];
    const quoteSeed = quoteSeeds.find((qs) => qs.key === key)!;
    const guests = quoteSeed.guestCount;
    const totals = new Map<string, number>();
    const expReqs = await prisma.experienceInventoryRequirement.findMany({ where: { experienceId: refs.experiences[quoteSeed.experienceSlug]!.id } });
    for (const r of expReqs) totals.set(r.inventoryItemId, (totals.get(r.inventoryItemId) ?? 0) + (r.perGuest ? r.quantity * guests : r.quantity));
    for (const sel of quoteSeed.addOns) {
      const reqs = await prisma.addOnInventoryRequirement.findMany({ where: { addOnId: refs.addOns[sel.slug]!.id } });
      for (const r of reqs) totals.set(r.inventoryItemId, (totals.get(r.inventoryItemId) ?? 0) + (r.perGuest ? r.quantity * guests : r.quantity * sel.quantity));
    }
    const completed = key === "e4" || key === "e5";
    const reservedAt = ev.quote.acceptedAt!;
    const checkOutAt = addMinutes(ev.startsAt, -190);
    const returnAt = addMinutes(ev.endsAt, 150);
    for (const [itemId, quantity] of totals) {
      const item = invById[itemId]!;
      const damaged = key === "e4" && item.sku === "COP-AGU-01" ? 1 : 0;
      await prisma.inventoryReservation.create({
        data: {
          inventoryItemId: itemId,
          eventId: ev.id,
          quantity,
          status: completed ? "RETURNED" : "RESERVED",
          returnedQuantity: completed ? quantity - damaged : null,
          damagedQuantity: completed ? damaged : null,
          notes: damaged ? "1 copa rota durante el servicio." : null,
          createdAt: reservedAt,
        },
      });
      movementRows.push({ inventoryItemId: itemId, eventId: ev.id, type: "RESERVE", quantity, reason: `Reserva para ${ev.code}`, actorId: null, createdAt: reservedAt });
      if (completed) {
        const lupita = refs.users.lupita.id;
        movementRows.push({ inventoryItemId: itemId, eventId: ev.id, type: "CHECK_OUT", quantity, reason: `Salida a ${ev.title}`, actorId: lupita, createdAt: checkOutAt });
        movementRows.push({ inventoryItemId: itemId, eventId: ev.id, type: "RETURN", quantity: quantity - damaged, reason: `Regreso de ${ev.title}`, actorId: lupita, createdAt: returnAt });
        if (damaged) {
          movementRows.push({ inventoryItemId: itemId, eventId: ev.id, type: "LOSS", quantity: damaged, reason: "Copa rota durante el servicio.", actorId: lupita, createdAt: addMinutes(returnAt, 5) });
          lossCentsE4 += damaged * item.replacementCostCents;
        }
      }
    }
  }
  const inv = (sku: string) => refs.inventory[sku]!.id;
  movementRows.push(
    { inventoryItemId: inv("SER-01"), type: "PURCHASE_IN", quantity: 24, reason: "Compra de 24 servilletas de lino arena.", actorId: refs.users.ivonne.id, createdAt: at(-75, "13:00") },
    { inventoryItemId: inv("COP-CHA-01"), type: "MAINTENANCE_OUT", quantity: 2, reason: "Copas despostilladas: a revisión.", actorId: refs.users.lupita.id, createdAt: at(-12, "10:30") },
    { inventoryItemId: inv("PLT-DIN-01"), type: "MAINTENANCE_OUT", quantity: 2, reason: "Platos con despostilladura en el borde.", actorId: refs.users.lupita.id, createdAt: at(-12, "10:35") },
    { inventoryItemId: inv("MAN-LIN-01"), type: "MAINTENANCE_OUT", quantity: 1, reason: "Mancha de vino: a tintorería.", actorId: refs.users.lupita.id, createdAt: notAfter(addDays(events.e5.endsAt, 1), now) },
    { inventoryItemId: inv("MIC-01"), type: "MAINTENANCE_OUT", quantity: 1, reason: "Falla intermitente de batería.", actorId: refs.users.lupita.id, createdAt: at(-30, "12:00") },
  );
  await prisma.inventoryMovement.createMany({ data: movementRows });

  // Compra general (inventario) — recibida
  await prisma.purchase.create({
    data: {
      vendorId: null,
      concept: "Servilletas de lino arena (24 pzas) para inventario",
      category: "OTHER",
      expectedAmountCents: mx(1_560),
      actualAmountCents: mx(1_560),
      status: "RECEIVED",
      orderedAt: at(-82, "11:00"),
      receivedAt: at(-75, "13:00"),
      createdById: refs.users.ivonne.id,
      createdAt: at(-82, "11:00"),
    },
  });

  // ---------------------------------------------------------------------------
  // MEMORY CAPSULES, RESEÑA Y CIERRE DE E4
  // ---------------------------------------------------------------------------
  const e4 = events.e4;
  const e5 = events.e5;
  const capsule4 = await prisma.memoryCapsule.create({
    data: {
      eventId: e4.id,
      title: "Perú x México de Valeria",
      message:
        "Gracias por dejarnos ser parte de este día. Aquí guardamos las fotos y los mensajes de tus invitadas para que vuelvas a ellos cuando quieras. — Ivonne & Rosa",
      shareToken: memoryShareTokens.e4,
      published: true,
      allowGuestUploads: true,
      createdAt: addDays(e4.endsAt, 1),
    },
  });
  const memoryImages = ["peru-mexico", "gallery-07", "brunch-table", "mimosas", "gallery-02", "gallery-01"];
  const uploaders = [null, "Milagros Quispe", "Gabriela Soto", null, "Diana Herrera", "Adriana Peña"];
  const memoryMediaIds: string[] = [];
  for (const [i, img] of memoryImages.entries()) {
    const uploader = uploaders[i] ?? null;
    const media = await prisma.mediaAsset.create({
      data: {
        ...placeholderMedia(img, "MEMORY", { sortOrder: i + 1, consent: true, approved: true, featured: i === 0 }),
        eventId: e4.id,
        memoryCapsuleId: capsule4.id,
        guestId: uploader ? (e4.guests.find((g) => g.name === uploader)?.id ?? null) : null,
        uploaderName: uploader ?? "Ivonne & Rosa",
        uploadedById: uploader ? null : refs.users.ivonne.id,
        createdAt: addDays(e4.endsAt, 1 + (i % 2)),
      },
    });
    memoryMediaIds.push(media.id);
  }
  await prisma.memoryCapsule.update({ where: { id: capsule4.id }, data: { coverMediaId: memoryMediaIds[0]! } });
  const e4Guest = (name: string) => e4.guests.find((g) => g.name === name)?.id ?? null;
  await prisma.eventMessage.createMany({
    data: [
      { eventId: e4.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Milagros Quispe", guestId: e4Guest("Milagros Quispe"), body: "Me sentí en Lima y en Guadalajara al mismo tiempo. ¡Gracias, Vale!", createdAt: addDays(e4.endsAt, 1) },
      { eventId: e4.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Gabriela Soto", guestId: e4Guest("Gabriela Soto"), body: "El ceviche, la música y ustedes. Día perfecto.", createdAt: addMinutes(addDays(e4.endsAt, 1), 40) },
      { eventId: e4.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Diana Herrera", guestId: e4Guest("Diana Herrera"), body: "Qué bonito detalle el papel picado. Me llevo la idea para mi cumple.", createdAt: addDays(e4.endsAt, 2) },
      { eventId: e4.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Adriana Peña", guestId: e4Guest("Adriana Peña"), body: "Gracias por juntarnos. ¡Repetimos pronto!", createdAt: addDays(e4.endsAt, 3) },
    ],
  });

  const capsule5 = await prisma.memoryCapsule.create({
    data: {
      eventId: e5.id,
      title: "Signature Brunch de Ana Paula",
      message: "Estamos terminando de curar las fotos. ¡Muy pronto podrás compartir tu Memory Capsule!",
      shareToken: memoryShareTokens.e5,
      published: false,
      allowGuestUploads: true,
      createdAt: addDays(e5.endsAt, 1),
    },
  });
  for (const [i, img] of ["gallery-03", "gallery-06"].entries()) {
    await prisma.mediaAsset.create({
      data: {
        ...placeholderMedia(img, "MEMORY", { sortOrder: i + 1, consent: true, approved: i === 0 }),
        eventId: e5.id,
        memoryCapsuleId: capsule5.id,
        guestId: i === 1 ? (e5.guests[0]?.id ?? null) : null,
        uploaderName: i === 1 ? (e5.guests[0]?.name ?? null) : "Ivonne & Rosa",
        uploadedById: i === 0 ? refs.users.rosa.id : null,
        createdAt: notAfter(addDays(e5.endsAt, 1), now),
      },
    });
  }
  await prisma.eventMessage.create({
    data: { eventId: e5.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Teresa Gómez", guestId: e5.guests[0]?.id ?? null, body: "Un brunch tranquilo y precioso. Gracias, Ana Pau.", createdAt: notAfter(addDays(e5.endsAt, 1), now) },
  });

  await prisma.review.create({
    data: {
      eventId: e4.id,
      customerId: refs.customers.valeria!.id,
      rating: 5,
      npsScore: 10,
      comment: "Todo fue perfecto: la mesa, la comida y la atención. Mis amigas ya están planeando el suyo.",
      publishable: true,
      createdAt: addDays(e4.endsAt, 3),
    },
  });

  // Cierre de E4 con snapshot de rentabilidad (calculado con los datos reales sembrados)
  const e4Data = await prisma.event.findUniqueOrThrow({
    where: { id: e4.id },
    include: { purchases: true, costs: true, staffAssignments: true, booking: { include: { payments: true } } },
  });
  const byCategory: Partial<Record<CostCategory, number>> = {};
  const addCat = (cat: CostCategory, amount: number) => {
    byCategory[cat] = (byCategory[cat] ?? 0) + amount;
  };
  const purchasesCents = e4Data.purchases
    .filter((p) => p.status === "RECEIVED")
    .reduce((s, p) => {
      const amount = p.actualAmountCents ?? p.expectedAmountCents;
      addCat(p.category, amount);
      return s + amount;
    }, 0);
  const staffCents = e4Data.staffAssignments.reduce((s, a) => s + a.amountCents, 0);
  addCat("STAFF", staffCents);
  const extraCostsCents = e4Data.costs.reduce((s, c) => {
    addCat(c.category, c.amountCents);
    return s + c.amountCents;
  }, 0);
  const paidPayments = e4Data.booking?.payments.filter((p) => p.status === "PAID") ?? [];
  const paymentFeesCents = paidPayments.reduce((s, p) => s + p.feeCents, 0);
  addCat("PAYMENT_FEE", paymentFeesCents);
  addCat("OTHER", lossCentsE4);
  const totalCents = e4.quote.calc.totalCents;
  const taxCents = e4.quote.calc.taxCents;
  const netRevenueCents = totalCents - taxCents;
  const actualCostCents = purchasesCents + staffCents + extraCostsCents + paymentFeesCents + lossCentsE4;
  const actualMarginCents = netRevenueCents - actualCostCents;
  const closedAt = notAfter(addDays(e4.endsAt, 3), now);
  await prisma.event.update({
    where: { id: e4.id },
    data: {
      closedAt,
      closedById: refs.users.ivonne.id,
      closingSnapshot: json({
        version: 1,
        closedAt: closedAt.toISOString(),
        currency: "MXN",
        guestCount: e4Data.guestCount,
        revenue: {
          totalCents,
          taxCents,
          netRevenueCents,
          paidCents: paidPayments.reduce((s, p) => s + p.amountCents, 0),
        },
        estimated: {
          costCents: e4.quote.calc.estimatedCostCents,
          marginCents: e4.quote.calc.estimatedMarginCents,
          marginBps: e4.quote.calc.marginBps,
        },
        actual: {
          purchasesCents,
          staffCents,
          extraCostsCents,
          paymentFeesCents,
          inventoryLossCents: lossCentsE4,
          totalCostCents: actualCostCents,
          marginCents: actualMarginCents,
          marginBps: marginBps(actualMarginCents, netRevenueCents),
        },
        costsByCategory: byCategory,
        variance: {
          costCents: actualCostCents - e4.quote.calc.estimatedCostCents,
          marginBps: marginBps(actualMarginCents, netRevenueCents) - e4.quote.calc.marginBps,
        },
        notes: "Pescado por encima de lo estimado; flores y consumibles ligeramente abajo.",
      }),
    },
  });

  return { leads, quotes, events, memoryShareTokens };
}

