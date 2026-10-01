import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import { dateOnly, localDateKey, toDateKey } from "@/lib/dates";
import type { SessionUser } from "@/server/auth/session";
import {
  closeEvent,
  computeFinancialsForEvent,
  createEventCost,
  deleteEventCost,
  getEventFinancialsPage,
  updateEventCost,
} from "@/features/financials/server/event-financials-service";
import {
  financeTotals,
  getFinanceRows,
  getOutstandingBalances,
  getRevenueByMonth,
} from "@/features/financials/server/finance-queries";
import {
  getCriticalPending,
  getDashboardKpis,
  getIncompleteRsvp,
  getInventoryConflicts,
  getNextSevenDays,
  getPendingPayments,
} from "@/features/analytics/server/dashboard-queries";
import {
  getAddOnRevenue,
  getAnalyticsOverview,
  getPopularExperiences,
} from "@/features/analytics/server/analytics-queries";
import type { ClosingSnapshot } from "@/features/financials/domain/event-financials";
import { testOwner, uid } from "./helpers";

const DAY = 86_400_000;

let owner: SessionUser;
const ids = {
  customers: [] as string[],
  events: [] as string[],
  quotes: [] as string[],
  bookings: [] as string[],
  staff: [] as string[],
  items: [] as string[],
  addOns: [] as string[],
  experiences: [] as string[],
  leads: [] as string[],
  analytics: [] as string[],
};

async function makeCustomer() {
  const s = uid();
  const c = await prisma.customer.create({
    data: {
      name: `Clienta Finanzas ${s}`,
      email: `fin.${s}@ivonne-rosa.test`,
      phone: "5512345678",
      referralCode: `FIN${s}`.toUpperCase(),
    },
  });
  ids.customers.push(c.id);
  return c;
}

async function makeEvent(opts: {
  status: EventStatus;
  startsAt: Date;
  title?: string;
  customerId?: string;
  guestCount?: number;
}) {
  const s = uid();
  const customerId = opts.customerId ?? (await makeCustomer()).id;
  const ev = await prisma.event.create({
    data: {
      code: `EV-${s}`.toUpperCase(),
      title: `${opts.title ?? "Evento finanzas"} ${s}`,
      status: opts.status,
      customerId,
      eventDate: dateOnly(localDateKey(opts.startsAt)),
      startsAt: opts.startsAt,
      endsAt: new Date(opts.startsAt.getTime() + 3 * 3_600_000),
      guestCount: opts.guestCount ?? 10,
      micrositeSlug: `fin-${s}`,
      inviteToken: generateToken(),
      portalToken: generateToken(),
    },
  });
  ids.events.push(ev.id);
  return ev;
}

/**
 * Evento construido con todos los ingredientes de costeo:
 *  venta $11,600 (IVA $1,600) · snapshot con desglose estimado · compras recibidas/pendientes ·
 *  staff · costo manual · comisiones · reembolso parcial.
 */
async function makeCostedEvent(status: EventStatus = "COMPLETED") {
  const customer = await makeCustomer();
  const ev = await makeEvent({
    status,
    startsAt: new Date(Date.now() - 5 * DAY),
    customerId: customer.id,
    title: "Brunch costeado",
  });
  const s = uid();
  const quote = await prisma.quote.create({
    data: {
      code: `Q-${s}`.toUpperCase(),
      publicToken: generateToken(),
      status: "ACCEPTED",
      customerId: customer.id,
      title: ev.title,
      guestCount: 10,
      subtotalCents: 1_160_000,
      taxCents: 160_000,
      totalCents: 1_160_000,
      estimatedCostCents: 595_000,
      estimatedMarginCents: 405_000,
      marginBps: 4050,
      depositCents: 580_000,
      pricingSnapshot: {
        costBreakdown: { FOOD: 300_000, FLOWERS: 100_000, STAFF: 150_000, PAYMENT_FEE: 45_000 },
      },
      items: {
        create: [
          {
            type: "BASE_EXPERIENCE",
            description: "Base",
            quantity: 1,
            unitPriceCents: 1_160_000,
            totalPriceCents: 1_160_000,
            unitCostCents: 550_000,
            totalCostCents: 550_000,
            costCategory: "FOOD",
          },
        ],
      },
    },
  });
  ids.quotes.push(quote.id);
  await prisma.event.update({ where: { id: ev.id }, data: { quoteId: quote.id } });
  const booking = await prisma.booking.create({
    data: {
      code: `B-${s}`.toUpperCase(),
      quoteId: quote.id,
      customerId: customer.id,
      eventId: ev.id,
      totalCents: 1_160_000,
      depositRequiredCents: 580_000,
      termsVersion: "2026-09",
      termsAcceptedAt: new Date(Date.now() - 20 * DAY),
      acceptedByName: customer.name,
      balanceDueAt: new Date(Date.now() - 8 * DAY),
    },
  });
  ids.bookings.push(booking.id);
  await prisma.payment.createMany({
    data: [
      {
        bookingId: booking.id,
        kind: "DEPOSIT",
        status: "PAID",
        provider: "mock",
        amountCents: 580_000,
        feeCents: 21_000,
        idempotencyKey: `fin-dep-${s}`,
        paidAt: new Date(Date.now() - 20 * DAY),
      },
      {
        bookingId: booking.id,
        kind: "BALANCE",
        status: "PARTIAL_REFUND",
        provider: "mock",
        amountCents: 580_000,
        feeCents: 21_000,
        refundedCents: 116_000,
        idempotencyKey: `fin-bal-${s}`,
        paidAt: new Date(Date.now() - 9 * DAY),
      },
      {
        bookingId: booking.id,
        kind: "BALANCE",
        status: "FAILED",
        provider: "mock",
        amountCents: 580_000,
        feeCents: 9_999,
        idempotencyKey: `fin-fail-${s}`,
      },
    ],
  });
  await prisma.purchase.createMany({
    data: [
      {
        eventId: ev.id,
        concept: "Insumos cocina",
        category: "FOOD",
        expectedAmountCents: 300_000,
        actualAmountCents: 320_000,
        status: "RECEIVED",
      },
      {
        eventId: ev.id,
        concept: "Flores mesa",
        category: "FLOWERS",
        expectedAmountCents: 90_000,
        actualAmountCents: null,
        status: "RECEIVED",
      },
      {
        eventId: ev.id,
        concept: "Flores extra",
        category: "FLOWERS",
        expectedAmountCents: 100_000,
        status: "ORDERED",
      },
      {
        eventId: ev.id,
        concept: "Velas",
        category: "CONSUMABLES",
        expectedAmountCents: 50_000,
        actualAmountCents: 50_000,
        status: "CANCELLED",
      },
    ],
  });
  const chef = await prisma.staffMember.create({ data: { name: `Chef ${s}`, primaryFunction: "CHEF" } });
  const server = await prisma.staffMember.create({
    data: { name: `Mesera ${s}`, primaryFunction: "SERVER" },
  });
  ids.staff.push(chef.id, server.id);
  await prisma.staffAssignment.createMany({
    data: [
      {
        eventId: ev.id,
        staffMemberId: chef.id,
        function: "CHEF",
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        amountCents: 90_000,
      },
      {
        eventId: ev.id,
        staffMemberId: server.id,
        function: "SERVER",
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        amountCents: 60_000,
      },
    ],
  });
  return { event: ev, customer, quote, booking };
}

beforeAll(async () => {
  owner = await testOwner();
});

afterAll(async () => {
  const ev = ids.events;
  try {
    await prisma.notificationLog.deleteMany({ where: { eventId: { in: ev } } });
    await prisma.purchase.deleteMany({ where: { eventId: { in: ev } } });
    await prisma.inventoryReservation.deleteMany({ where: { eventId: { in: ev } } });
    await prisma.eventAddOn.deleteMany({ where: { eventId: { in: ev } } });
    await prisma.payment.deleteMany({ where: { bookingId: { in: ids.bookings } } });
    await prisma.booking.deleteMany({ where: { id: { in: ids.bookings } } });
    await prisma.memoryCapsule.deleteMany({ where: { eventId: { in: ev } } });
    await prisma.event.deleteMany({ where: { id: { in: ev } } });
    await prisma.quote.deleteMany({ where: { id: { in: ids.quotes } } });
    await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await prisma.analyticsEvent.deleteMany({ where: { id: { in: ids.analytics } } });
    await prisma.staffMember.deleteMany({ where: { id: { in: ids.staff } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: ids.items } } });
    await prisma.addOn.deleteMany({ where: { id: { in: ids.addOns } } });
    await prisma.experience.deleteMany({ where: { id: { in: ids.experiences } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
  } catch (error) {
    console.warn("cleanup financials-analytics", error);
  }
});

// ============================================================================
describe("rentabilidad de un evento construido", () => {
  it("calcula venta, costos estimados/reales, márgenes y cobranza esperados", async () => {
    const { event } = await makeCostedEvent("COMPLETED");
    const cost = await createEventCost(owner, {
      eventId: event.id,
      category: "TRANSPORT",
      description: "Estacionamiento y casetas",
      amountCents: 35_000,
    });

    const res = await computeFinancialsForEvent(event.id);
    expect(res).not.toBeNull();
    const { financials: fin, collection } = res!;

    expect(fin.sale).toBe(1_160_000);
    expect(fin.refunds).toBe(116_000);
    expect(fin.tax).toBe(144_000);
    expect(fin.plannedNetRevenue).toBe(1_000_000);
    expect(fin.netRevenue).toBe(900_000);

    expect(fin.estimatedCost).toBe(595_000);
    expect(fin.estimatedMargin).toBe(405_000);
    expect(fin.estimatedMarginBps).toBe(4050);

    expect(fin.sources).toMatchObject({
      purchasesCents: 410_000,
      staffCents: 150_000,
      manualCents: 35_000,
      paymentFeesCents: 42_000,
      pendingPurchases: 1,
    });
    expect(fin.actualCost).toBe(637_000);
    expect(fin.actualMargin).toBe(263_000);
    expect(fin.actualMarginBps).toBe(2922);

    const cat = Object.fromEntries(fin.byCategory.map((r) => [r.category, r]));
    expect(cat.FOOD).toMatchObject({
      estimated: 300_000,
      actual: 320_000,
      variance: 20_000,
      hasActuals: true,
    });
    expect(cat.FLOWERS).toMatchObject({ estimated: 100_000, actual: 90_000, variance: -10_000 });
    expect(cat.STAFF).toMatchObject({ estimated: 150_000, actual: 150_000, variance: 0 });
    expect(cat.TRANSPORT).toMatchObject({ estimated: 0, actual: 35_000, variance: 35_000 });
    expect(cat.PAYMENT_FEE).toMatchObject({ estimated: 45_000, actual: 42_000, variance: -3_000 });
    expect(cat.CONSUMABLES).toMatchObject({ actual: 0, hasActuals: false, variance: null });

    const codes = fin.warnings.map((w) => w.code);
    expect(codes).toEqual(
      expect.arrayContaining(["REFUNDS_APPLIED", "RECEIVED_WITHOUT_AMOUNT", "PURCHASES_PENDING"]),
    );
    expect(codes).not.toContain("NEGATIVE_ACTUAL_MARGIN");

    expect(collection).toEqual({ total: 1_160_000, paid: 1_044_000, balance: 116_000 });

    // Datos de la página
    const page = await getEventFinancialsPage(event.id);
    expect(page?.canClose).toBe(true);
    expect(page?.pendingPurchases).toBe(1);
    expect(page?.event.costs.map((c) => c.id)).toContain(cost.id);

    // Auditoría de alta
    const log = await prisma.auditLog.findFirst({ where: { action: "cost.created", entityId: cost.id } });
    expect(log?.actorId).toBe(owner.id);
  });

  it("usa partidas + comisión cuando el snapshot no trae desglose, y margen negativo se reporta negativo", async () => {
    const { event, quote } = await makeCostedEvent("IN_PROGRESS");
    await prisma.quote.update({
      where: { id: quote.id },
      data: { pricingSnapshot: { totals: { paymentFeeCents: 45_000 } } },
    });
    await createEventCost(owner, {
      eventId: event.id,
      category: "OTHER",
      description: "Reposición de vajilla",
      amountCents: 600_000,
    });
    const res = await computeFinancialsForEvent(event.id);
    const fin = res!.financials;
    expect(fin.estimatedCost).toBe(550_000 + 45_000);
    expect(fin.byCategory.find((r) => r.category === "FOOD")!.estimated).toBe(550_000);
    expect(fin.actualCost).toBe(637_000 - 35_000 + 600_000);
    expect(fin.actualMargin).toBe(900_000 - 1_202_000);
    expect(fin.actualMargin).toBeLessThan(0);
    expect(fin.actualMarginBps).toBeLessThan(0);
    expect(fin.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["NEGATIVE_ACTUAL_MARGIN", "COST_OVERRUN"]),
    );
  });

  it("edita y elimina costos manuales con auditoría", async () => {
    const ev = await makeEvent({ status: "CONFIRMED", startsAt: new Date(Date.now() + 10 * DAY) });
    const cost = await createEventCost(owner, {
      eventId: ev.id,
      category: "OTHER",
      description: "Propinas",
      amountCents: 10_000,
    });
    const updated = await updateEventCost(owner, {
      costId: cost.id,
      category: "STAFF",
      description: "Propinas del equipo",
      amountCents: 12_500,
    });
    expect(updated).toMatchObject({ category: "STAFF", amountCents: 12_500 });
    const upd = await prisma.auditLog.findFirst({ where: { action: "cost.updated", entityId: cost.id } });
    expect(upd?.before).toMatchObject({ amountCents: 10_000 });

    await deleteEventCost(owner, { costId: cost.id });
    expect(await prisma.eventCost.findUnique({ where: { id: cost.id } })).toBeNull();
    const del = await prisma.auditLog.findFirst({ where: { action: "cost.deleted", entityId: cost.id } });
    expect(del?.before).toMatchObject({ description: "Propinas del equipo" });

    await expect(deleteEventCost(owner, { costId: cost.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createEventCost(owner, {
        eventId: "no-existe-123",
        category: "OTHER",
        description: "X costo",
        amountCents: 100,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ============================================================================
describe("cierre de evento", () => {
  it("cierra un evento completado: closedAt, snapshot, auditoría y notificaciones", async () => {
    const { event } = await makeCostedEvent("COMPLETED");
    const capsuleToken = `cap${uid()}${uid()}`;
    await prisma.memoryCapsule.create({
      data: { eventId: event.id, title: "Memorias", shareToken: capsuleToken, published: true },
    });
    const closedAt = new Date();
    const res = await closeEvent(owner, event.id, { now: closedAt });
    expect(res.snapshot.version).toBe(2);

    const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.closedAt?.getTime()).toBe(closedAt.getTime());
    expect(after.closedById).toBe(owner.id);
    const snap = after.closingSnapshot as unknown as ClosingSnapshot;
    expect(snap.revenue.totalCents).toBe(1_160_000);
    expect(snap.revenue.netRevenueCents).toBe(900_000);
    expect(snap.revenue.balanceCents).toBe(116_000);
    expect(snap.actual.totalCostCents).toBe(602_000);
    expect(snap.actual.marginCents).toBe(298_000);
    expect(snap.estimated.costCents).toBe(595_000);

    const log = await prisma.auditLog.findFirst({ where: { action: "event.closed", entityId: event.id } });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(owner.id);

    const notes = await prisma.notificationLog.findMany({ where: { eventId: event.id } });
    const post = notes.filter((n) => n.type === "POST_EVENT");
    const review = notes.filter((n) => n.type === "REVIEW_REQUEST");
    expect(post.length).toBeGreaterThanOrEqual(1);
    expect(review.length).toBeGreaterThanOrEqual(1);
    expect(post.find((n) => n.channel === "EMAIL")?.actionUrl).toContain(`/memory/${capsuleToken}`);
    expect(review.find((n) => n.channel === "EMAIL")?.actionUrl).toContain(`/mi-evento/${event.portalToken}`);
    // Mismas llaves que el programador de notificaciones: el cron no vuelve a enviar el agradecimiento.
    expect(post.find((n) => n.channel === "EMAIL")?.dedupeKey).toBe(`sched:post_event:${event.id}:email`);
    expect(review.find((n) => n.channel === "EMAIL")?.dedupeKey).toBe(
      `sched:review_request:${event.id}:email`,
    );
    expect(post.find((n) => n.channel === "EMAIL")?.body).toContain("Memory Capsule");

    // Página: muestra el resumen congelado
    const page = await getEventFinancialsPage(event.id);
    expect(page?.canClose).toBe(false);
    expect(page?.closing?.actualCostCents).toBe(602_000);

    // No se puede cerrar dos veces
    await expect(closeEvent(owner, event.id)).rejects.toBeInstanceOf(ConflictError);
    // Los costos quedan congelados
    await expect(
      createEventCost(owner, {
        eventId: event.id,
        category: "OTHER",
        description: "Tarde",
        amountCents: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    // Sin notificaciones duplicadas
    const notesAfter = await prisma.notificationLog.count({ where: { eventId: event.id } });
    expect(notesAfter).toBe(notes.length);
  });

  it("sin cápsula publicada, el agradecimiento lleva al portal y no promete la cápsula", async () => {
    const { event } = await makeCostedEvent("COMPLETED");
    await closeEvent(owner, event.id);
    const post = await prisma.notificationLog.findFirst({
      where: { eventId: event.id, type: "POST_EVENT", channel: "EMAIL" },
    });
    expect(post?.actionUrl).toContain(`/mi-evento/${event.portalToken}`);
    expect(post?.body).not.toContain("Memory Capsule");
    expect(post?.body).toContain("Ver mi evento");
  });

  it("no duplica mensajes que el programador ya envió ni pide reseña si ya existe", async () => {
    const { event, customer } = await makeCostedEvent("COMPLETED");
    // El cron ya mandó el agradecimiento (con otra llave) y la clienta ya dejó su reseña.
    await prisma.notificationLog.create({
      data: {
        type: "POST_EVENT",
        channel: "EMAIL",
        status: "MOCKED",
        provider: "mock",
        to: customer.email!,
        body: "Gracias (cron)",
        eventId: event.id,
        dedupeKey: `test-cron-post:${event.id}`,
      },
    });
    await prisma.review.create({ data: { eventId: event.id, customerId: customer.id, rating: 5 } });

    await closeEvent(owner, event.id);
    const notes = await prisma.notificationLog.findMany({ where: { eventId: event.id } });
    expect(notes.filter((n) => n.type === "POST_EVENT")).toHaveLength(1);
    expect(notes.filter((n) => n.type === "REVIEW_REQUEST")).toHaveLength(0);
    const closed = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(closed.closedAt).not.toBeNull();
  });

  it("rechaza cerrar eventos no completados", async () => {
    for (const status of ["CONFIRMED", "IN_PROGRESS", "CANCELLED"] as const) {
      const ev = await makeEvent({ status, startsAt: new Date(Date.now() - DAY) });
      await expect(closeEvent(owner, ev.id)).rejects.toBeInstanceOf(ConflictError);
      const again = await prisma.event.findUniqueOrThrow({ where: { id: ev.id } });
      expect(again.closedAt).toBeNull();
      expect(again.closingSnapshot).toBeNull();
    }
    await expect(closeEvent(owner, "no-existe-xyz")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cierres concurrentes: sólo uno gana", async () => {
    const { event } = await makeCostedEvent("COMPLETED");
    const results = await Promise.allSettled([closeEvent(owner, event.id), closeEvent(owner, event.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const logs = await prisma.auditLog.count({ where: { action: "event.closed", entityId: event.id } });
    expect(logs).toBe(1);
  });
});

// ============================================================================
describe("finanzas", () => {
  it("lista el evento con sus números y totales; eventos cerrados usan el snapshot", async () => {
    const { event } = await makeCostedEvent("COMPLETED");
    await closeEvent(owner, event.id);
    const month = localDateKey(event.startsAt).slice(0, 7);
    const { rows } = await getFinanceRows({ month, status: "CLOSED" });
    const row = rows.find((r) => r.id === event.id);
    expect(row).toMatchObject({
      saleCents: 1_160_000,
      collectedCents: 1_044_000,
      balanceCents: 116_000,
      estimatedCostCents: 595_000,
      actualCostCents: 602_000,
      closed: true,
    });
    const totals = financeTotals(rows);
    expect(totals.count).toBe(rows.length);
    expect(totals.saleCents).toBeGreaterThanOrEqual(1_160_000);

    const open = await getFinanceRows({ month, status: "OPEN" });
    expect(open.rows.find((r) => r.id === event.id)).toBeUndefined();

    const revenue = await getRevenueByMonth(6);
    expect(revenue).toHaveLength(6);
    expect(revenue.every((m) => m.soldCents >= 0 && m.collectedCents >= 0)).toBe(true);
  });

  it("saldos pendientes incluye eventos activos con saldo", async () => {
    const { event } = await makeCostedEvent("CONFIRMED");
    const balances = await getOutstandingBalances(500);
    expect(balances.find((b) => b.eventId === event.id)?.balanceCents).toBe(116_000);
  });

  it("excluye consultas (INQUIRY) y en cancelados sólo cuenta lo cobrado, sin saldo", async () => {
    const inquiry = await makeCostedEvent("INQUIRY");
    const cancelled = await makeCostedEvent("CANCELLED");
    const month = localDateKey(inquiry.event.startsAt).slice(0, 7);
    const all = await getFinanceRows({ month });
    expect(all.rows.find((r) => r.id === inquiry.event.id)).toBeUndefined();
    const row = all.rows.find((r) => r.id === cancelled.event.id);
    // Cancelado: venta = lo cobrado, sin saldo, y el costo estimado de la cotización ya no aplica
    // (no distorsiona el margen estimado agregado); los costos reales hundidos sí cuentan.
    expect(row).toMatchObject({
      saleCents: 1_160_000,
      collectedCents: 1_044_000,
      balanceCents: 0,
      estimatedCostCents: 0,
      actualCostCents: 602_000,
      actualIsFinal: true,
    });
    const totals = financeTotals([row!]);
    expect(totals.estimatedMarginBps).toBeNull();
    const page = await getEventFinancialsPage(cancelled.event.id);
    expect(page?.collection.balance).toBe(0);
    expect(page?.financials.warnings.map((w) => w.code)).toContain("CANCELLED_EVENT");
    expect(page?.canClose).toBe(false);
    const open = await getFinanceRows({ month, status: "OPEN" });
    expect(open.rows.find((r) => r.id === cancelled.event.id)).toBeUndefined();
    const onlyCancelled = await getFinanceRows({ month, status: "CANCELLED" });
    expect(onlyCancelled.rows.every((r) => r.status === "CANCELLED")).toBe(true);
    expect(onlyCancelled.rows.find((r) => r.id === cancelled.event.id)).toBeDefined();
  });

  it("margen real agregado sólo usa eventos completados o cerrados", async () => {
    const done = await makeCostedEvent("COMPLETED");
    const future = await makeCostedEvent("CONFIRMED");
    const month = localDateKey(done.event.startsAt).slice(0, 7);
    const { rows } = await getFinanceRows({ month });
    const mine = rows.filter((r) => r.id === done.event.id || r.id === future.event.id);
    expect(mine).toHaveLength(2);
    expect(mine.find((r) => r.id === future.event.id)?.actualIsFinal).toBe(false);
    const totals = financeTotals(mine);
    expect(totals.withActuals).toBe(2);
    expect(totals.withFinalActuals).toBe(1);
    // margen real ponderado = sólo el evento completado: (900,000 − 602,000) / 900,000
    expect(totals.actualMarginBps).toBe(3311);
  });
});

// ============================================================================
describe("dashboard y analytics", () => {
  it("KPIs y widgets reflejan los datos de prueba", async () => {
    const now = new Date();
    const s = uid();
    const before = await getCriticalPending(now);
    // Lead nuevo sin contacto desde hace 30 h
    const stale = await prisma.lead.create({
      data: {
        code: `L-${s}`.toUpperCase(),
        name: `Lead ${s}`,
        status: "NEW",
        createdAt: new Date(now.getTime() - 30 * 3_600_000),
      },
    });
    ids.leads.push(stale.id);

    // Evento en 3 días sin staff, RSVP mayormente pendiente y con inventario sobre-reservado
    const soon = await makeEvent({
      status: "CONFIRMED",
      startsAt: new Date(now.getTime() + 3 * DAY),
      title: "Evento pronto",
    });
    const twin = await makeEvent({
      status: "PLANNING",
      startsAt: new Date(now.getTime() + 3 * DAY),
      title: "Evento gemelo",
    });
    await prisma.eventGuest.createMany({
      data: [
        { eventId: soon.id, name: "Ana", token: generateToken(), rsvpStatus: "PENDING" },
        { eventId: soon.id, name: "Bea", token: generateToken(), rsvpStatus: "PENDING" },
        { eventId: soon.id, name: "Cami", token: generateToken(), rsvpStatus: "ATTENDING" },
      ],
    });
    await prisma.eventChecklistItem.create({
      data: {
        eventId: soon.id,
        phase: "T_MINUS_7",
        title: `Confirmar menú ${s}`,
        dueAt: new Date(now.getTime() - 3_600_000),
      },
    });
    const item = await prisma.inventoryItem.create({
      data: {
        sku: `SKU-${s}`.toUpperCase(),
        name: `Copas ${s}`,
        category: "GLASSWARE",
        totalQuantity: 5,
        maintenanceQuantity: 1,
      },
    });
    ids.items.push(item.id);
    await prisma.inventoryReservation.createMany({
      data: [
        { inventoryItemId: item.id, eventId: soon.id, quantity: 3 },
        { inventoryItemId: item.id, eventId: twin.id, quantity: 3 },
      ],
    });

    const [kpis, next, critical, conflicts, rsvp, payments] = await Promise.all([
      getDashboardKpis(now),
      getNextSevenDays(now),
      getCriticalPending(now),
      getInventoryConflicts(now),
      getIncompleteRsvp(now),
      getPendingPayments(now),
    ]);

    expect(kpis.leads.current).toBeGreaterThanOrEqual(1);
    expect(kpis.upcoming.count).toBeGreaterThanOrEqual(2);
    expect(kpis.pendingBalances.cents).toBeGreaterThanOrEqual(0);
    for (const v of [kpis.revenueMonth.soldCents, kpis.revenueMonth.collectedCents, kpis.upcoming.guests]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }

    const nextRow = next.find((e) => e.id === soon.id);
    expect(nextRow).toMatchObject({ staffCount: 0, guestsInvited: 3, rsvpBps: 3333, checklistBps: 0 });

    // Los conteos son reales aunque la lista sólo muestre los primeros 6.
    expect(critical.staleLeads.count).toBeGreaterThanOrEqual(before.staleLeads.count + 1);
    expect(critical.staleLeads.items.length).toBeLessThanOrEqual(6);
    expect(critical.overdueChecklist.count).toBeGreaterThanOrEqual(before.overdueChecklist.count + 1);
    expect(critical.unstaffedEvents.map((e) => e.id)).toEqual(expect.arrayContaining([soon.id, twin.id]));
    expect(critical.total).toBe(
      critical.overdueChecklist.count +
        critical.expiringQuotes.count +
        critical.staleLeads.count +
        critical.unstaffedEvents.length,
    );

    const conflict = conflicts.find((c) => c.itemId === item.id);
    expect(conflict).toMatchObject({
      reserved: 6,
      available: 4,
      shortage: 2,
      dateKey: toDateKey(soon.eventDate),
    });

    expect(rsvp.find((e) => e.id === soon.id)).toMatchObject({ invited: 3, pending: 2 });
    expect(Array.isArray(payments.deposits)).toBe(true);
  });

  it("analytics: embudo, experiencias populares e ingreso por add-ons", async () => {
    const s = uid();
    const exp = await prisma.experience.create({
      data: { name: `Exp ${s}`, slug: `exp-${s}`, description: "Prueba", basePriceCents: 1_000_000 },
    });
    ids.experiences.push(exp.id);
    const created = await Promise.all([
      ...Array.from({ length: 4 }, () =>
        prisma.analyticsEvent.create({ data: { type: "VIEW_EXPERIENCE", experienceId: exp.id } }),
      ),
      prisma.analyticsEvent.create({ data: { type: "START_CONFIGURATOR", experienceId: exp.id } }),
      prisma.analyticsEvent.create({ data: { type: "RSVP_SUBMIT" } }),
    ]);
    ids.analytics.push(...created.map((c) => c.id));

    const baseline = await getAnalyticsOverview(7);
    // Anticipo + saldo de la misma cotización (2 eventos) cuentan como 1 en el embudo, 2 en el contador.
    const fakeQuote = `q-${uid()}`;
    const payments = await Promise.all(
      [0, 1].map(() =>
        prisma.analyticsEvent.create({ data: { type: "PAYMENT_SUCCESS", quoteId: fakeQuote } }),
      ),
    );
    ids.analytics.push(...payments.map((c) => c.id));

    const overview = await getAnalyticsOverview(7);
    expect(overview.funnel).toHaveLength(8);
    expect(overview.funnel[0]!.count).toBeGreaterThanOrEqual(4);
    expect(overview.counters.rsvp.current).toBeGreaterThanOrEqual(1);
    const step = (o: typeof overview) => o.funnel.find((f) => f.step === "PAYMENT_SUCCESS")!.count;
    expect(step(overview) - step(baseline)).toBe(1);
    expect(overview.counters.payments.current - baseline.counters.payments.current).toBe(2);

    const popular = await getPopularExperiences(7);
    expect(popular.find((p) => p.id === exp.id)).toMatchObject({ views: 4, leads: 0, bookings: 0 });

    const addOn = await prisma.addOn.create({
      data: { name: `Karaoke ${s}`, slug: `karaoke-${s}`, priceCents: 150_000, costCents: 50_000 },
    });
    ids.addOns.push(addOn.id);
    const ev = await makeEvent({ status: "CONFIRMED", startsAt: new Date(Date.now() + 20 * DAY) });
    const cancelled = await makeEvent({ status: "CANCELLED", startsAt: new Date(Date.now() + 21 * DAY) });
    await prisma.eventAddOn.createMany({
      data: [
        { eventId: ev.id, addOnId: addOn.id, quantity: 2, priceCents: 150_000, costCents: 50_000 },
        { eventId: cancelled.id, addOnId: addOn.id, quantity: 5, priceCents: 150_000, costCents: 50_000 },
      ],
    });
    const revenue = await getAddOnRevenue();
    expect(revenue.items.find((a) => a.id === addOn.id)).toMatchObject({
      units: 2,
      events: 1,
      revenueCents: 300_000,
      costCents: 100_000,
      marginCents: 200_000,
    });
  });
});
