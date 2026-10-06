/**
 * Helpers del paquete 2 (Venta pública) — cotizaciones por token y reservas.
 *
 * Datos propios por prueba:
 *  - claimFreeDate(): fecha futura LIBRE (sin eventos, excepciones ni cotizaciones) reservada para esta prueba.
 *    Las pruebas corren en varios workers: el "apartado" usa mkdir atómico en test-results/l<carril>/ para que
 *    dos workers nunca reciban la misma fecha (aceptar una cotización ocupa capacidad del calendario).
 *  - createSentQuote(): cotización SENT con Prisma (rápida, controlable: vencida, versión, costos internos…).
 *  - createQuoteViaAdmin(): cotización real creada y enviada por la fundadora con las Server Actions del admin
 *    (precios del QuoteEngine), para los recorridos P0.
 */
import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { createCustomer, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { generateToken } from "../../../src/lib/tokens";
import { dateOnly, localDateKey, weekdayOf } from "../../../src/lib/dates";
import { addDaysKey } from "../../../src/features/configurator/domain/calendar";
import { callAction, okData } from "../configurator/_helpers";

export { addDaysKey };

const DAY_MS = 86_400_000;

function claimsDir(): string {
  const lane = Number(process.env.E2E_LANE ?? 0);
  return path.resolve(process.cwd(), lane > 0 ? `test-results/l${lane}` : "test-results", ".date-claims");
}

/**
 * Aparta una fecha futura libre. `weekdays` (0=domingo…6=sábado) por defecto: martes a domingo (lunes cerrado).
 * Martes–viernes tienen capacidad 1; sábado y domingo, 2.
 */
export async function claimFreeDate(
  db: PrismaClient,
  opts: { weekdays?: number[]; minDays?: number; maxDays?: number } = {},
): Promise<string> {
  const weekdays = opts.weekdays ?? [0, 2, 3, 4, 5, 6];
  const minDays = opts.minDays ?? 70;
  const maxDays = opts.maxDays ?? 330;
  const dir = claimsDir();
  fs.mkdirSync(dir, { recursive: true });
  // Apartados viejos (> 20 min) ya quedaron reflejados en la base (o la prueba murió): se liberan.
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs > 20 * 60_000) fs.rmSync(p, { recursive: true, force: true });
    } catch {
      // otro worker lo borró
    }
  }
  const today = localDateKey();
  const span = maxDays - minDays;
  const start = Math.floor(Math.random() * span);
  for (let i = 0; i < span; i++) {
    const key = addDaysKey(today, minDays + ((start + i) % span));
    if (!weekdays.includes(weekdayOf(key))) continue;
    const day = dateOnly(key);
    const [events, exceptions, quotes] = await Promise.all([
      db.event.count({ where: { eventDate: day } }),
      db.availabilityException.count({ where: { date: day } }),
      db.quote.count({ where: { eventDate: day } }),
    ]);
    if (events || exceptions || quotes) continue;
    try {
      fs.mkdirSync(path.join(dir, key));
      return key;
    } catch {
      // otro worker la apartó primero
    }
  }
  throw new Error("DATA ISSUE: no quedan fechas libres para apartar");
}

export type SentQuoteOptions = {
  status?: "SENT" | "DRAFT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  experienceSlug?: string;
  guestCount?: number;
  dateKey?: string;
  validUntil?: Date;
  version?: number;
  withLead?: boolean;
  customer?: { name?: string; email?: string | null; phone?: string | null };
  notesForCustomer?: string | null;
  title?: string;
};

/** Montos distintivos de costos internos: si aparecen en una vista pública, es fuga de datos. */
export const INTERNAL_MARKERS = { unitCostCents: 123_457, marginBps: 4_321, estimatedCostCents: 987_653 };

/**
 * Cotización con líneas y totales coherentes (precios del catálogo, IVA incluido 16 %, anticipo 50 %).
 * Los costos internos llevan valores "marcadores" para detectar fugas en la vista pública.
 */
export async function createSentQuote(db: PrismaClient, opts: SentQuoteOptions = {}) {
  const exp = await db.experience.findUnique({ where: { slug: opts.experienceSlug ?? "birthday-table" } });
  if (!exp) throw new Error("DATA ISSUE: experiencia del seed no encontrada");
  const area = await db.serviceArea.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const guestCount = opts.guestCount ?? 8;
  const dateKey = opts.dateKey ?? (await claimFreeDate(db));
  const customerName = opts.customer?.name ?? `Clienta ${uniq("QPUB")}`;
  const customer = await createCustomer(db, {
    name: customerName,
    email: opts.customer?.email === undefined ? uniqEmail("cotiza") : opts.customer.email,
    phone: opts.customer?.phone === undefined ? `+52${uniqPhone()}` : opts.customer.phone,
    whatsapp: opts.customer?.phone === undefined ? undefined : opts.customer.phone,
    source: "CONFIGURATOR",
  });
  const lead = opts.withLead === false
    ? null
    : await db.lead.create({
        data: {
          code: `L-E2E-${generateToken(4).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}`,
          customerId: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          occasion: "BIRTHDAY",
          status: "QUOTED",
          source: "CONFIGURATOR",
          guestCount,
          eventDate: dateOnly(dateKey),
          experienceId: exp.id,
        },
      });

  const extra = Math.max(0, guestCount - exp.baseGuests);
  const logistics = area?.logisticsFeeCents ?? 0;
  const lines = [
    { type: "BASE_EXPERIENCE" as const, description: `${exp.name} (incluye ${exp.baseGuests} personas)`, quantity: 1, unit: exp.basePriceCents },
    ...(extra ? [{ type: "EXTRA_GUEST" as const, description: `Invitada adicional (${extra})`, quantity: extra, unit: exp.extraGuestPriceCents }] : []),
    ...(logistics ? [{ type: "LOGISTICS" as const, description: `Logística y traslado — ${area!.name}`, quantity: 1, unit: logistics }] : []),
  ];
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit, 0);
  const total = subtotal;
  const tax = Math.round((total * 1600) / 11600);
  const deposit = Math.round((total * 5000) / 10000);
  const status = opts.status ?? "SENT";
  const now = new Date();
  const quote = await db.quote.create({
    data: {
      code: `Q-E2E-${generateToken(4).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}`,
      publicToken: generateToken(),
      version: opts.version ?? 1,
      status,
      leadId: lead?.id ?? null,
      customerId: customer.id,
      experienceId: exp.id,
      serviceAreaId: area?.id ?? null,
      occasion: "BIRTHDAY",
      title: opts.title ?? `E2E Cumpleaños de ${customerName}`,
      eventDate: dateOnly(dateKey),
      startTime: "11:00",
      guestCount,
      subtotalCents: subtotal,
      logisticsCents: logistics,
      taxCents: tax,
      totalCents: total,
      estimatedCostCents: INTERNAL_MARKERS.estimatedCostCents,
      estimatedMarginCents: total - INTERNAL_MARKERS.estimatedCostCents,
      marginBps: INTERNAL_MARKERS.marginBps,
      depositBps: 5000,
      depositCents: deposit,
      notesForCustomer: opts.notesForCustomer ?? null,
      internalNotes: "NOTA INTERNA E2E: no mostrar a la clienta",
      validUntil: opts.validUntil ?? new Date(now.getTime() + 7 * DAY_MS),
      sentAt: status === "DRAFT" ? null : now,
      items: {
        create: lines.map((l, i) => ({
          type: l.type,
          refId: l.type === "BASE_EXPERIENCE" ? exp.id : null,
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unit,
          unitCostCents: INTERNAL_MARKERS.unitCostCents,
          totalPriceCents: l.quantity * l.unit,
          totalCostCents: INTERNAL_MARKERS.unitCostCents * l.quantity,
          costCategory: "FOOD",
          sortOrder: i,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return { quote, customer, lead, experience: exp, dateKey, totals: { subtotal, total, tax, deposit } };
}

/** acceptQuoteAction por HTTP (como la clienta con su enlace). */
export function acceptQuoteCall(
  request: APIRequestContext,
  baseURL: string,
  token: string,
  input: { fullName?: string; acceptTerms?: boolean; version?: number } = {},
) {
  const args: Record<string, unknown> = {
    token,
    fullName: input.fullName ?? "Clienta Prueba E2E",
    acceptTerms: input.acceptTerms ?? true,
  };
  if (input.version !== undefined) args.version = input.version;
  return callAction<{ portalToken: string }>(request, baseURL, "acceptQuoteAction", args, `/cotizacion/${token}`);
}

export function rejectQuoteCall(request: APIRequestContext, baseURL: string, token: string, reason?: string) {
  const args: Record<string, unknown> = { token };
  if (reason !== undefined) args.reason = reason;
  return callAction<{ ok: true }>(request, baseURL, "rejectQuoteAction", args, `/cotizacion/${token}`);
}

/** Cotización SENT + aceptada por la clienta (reserva + evento PENDING_PAYMENT). */
export async function createAcceptedQuote(
  db: PrismaClient,
  request: APIRequestContext,
  baseURL: string,
  opts: SentQuoteOptions = {},
) {
  const created = await createSentQuote(db, opts);
  okData(await acceptQuoteCall(request, baseURL, created.quote.publicToken, { fullName: "Clienta Prueba E2E" }));
  const booking = await db.booking.findUniqueOrThrow({ where: { quoteId: created.quote.id }, include: { event: true } });
  return { ...created, booking, event: booking.event };
}

/**
 * Recorrido real del admin: la fundadora crea la cotización desde un lead (precios del QuoteEngine)
 * y la envía (SENT + token + notificación). Usa sus Server Actions con su sesión.
 */
export async function createQuoteViaAdmin(
  db: PrismaClient,
  ownerApi: APIRequestContext,
  baseURL: string,
  opts: { experienceSlug?: string; guestCount?: number; dateKey?: string; customerName?: string } = {},
) {
  const exp = await db.experience.findUniqueOrThrow({
    where: { slug: opts.experienceSlug ?? "birthday-table" },
    include: { menus: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  const area = await db.serviceArea.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const dateKey = opts.dateKey ?? (await claimFreeDate(db));
  const name = opts.customerName ?? `Clienta ${uniq("P0")}`;
  const customer = await createCustomer(db, { name, email: uniqEmail("p0"), phone: `+52${uniqPhone()}`, source: "CONFIGURATOR" });
  const lead = await db.lead.create({
    data: {
      code: `L-E2E-${generateToken(4).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}`,
      customerId: customer.id,
      name,
      email: customer.email,
      phone: customer.phone,
      occasion: "BIRTHDAY",
      status: "CONTACTED",
      source: "CONFIGURATOR",
      guestCount: opts.guestCount ?? 8,
      eventDate: dateOnly(dateKey),
      experienceId: exp.id,
    },
  });
  const created = okData(
    await callAction<{ id: string; code: string }>(
      ownerApi,
      baseURL,
      "createQuoteAction",
      {
        experienceId: exp.id,
        guestCount: opts.guestCount ?? 8,
        menuId: exp.menus[0]?.id ?? null,
        serviceAreaId: area.id,
        addOns: [],
        depositBps: 5000,
        leadId: lead.id,
        customerMode: "existing",
        customerId: customer.id,
        newCustomer: null,
        title: `E2E Cumpleaños de ${name}`,
        occasion: "BIRTHDAY",
        eventDate: dateKey,
        startTime: "11:00",
        styleId: null,
        notesForCustomer: "Nos encantará celebrar contigo.",
        internalNotes: "NOTA INTERNA E2E: margen objetivo",
      },
      "/admin/quotes/new",
    ),
  );
  okData(await callAction(ownerApi, baseURL, "sendQuoteAction", { quoteId: created.id }, `/admin/quotes/${created.id}`));
  const quote = await db.quote.findUniqueOrThrow({ where: { id: created.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  return { quote, customer, lead, experience: exp, dateKey };
}
