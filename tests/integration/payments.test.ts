/**
 * Integración: Pagos (checkout, webhook idempotente, confirmación de evento, pagos manuales, reembolsos).
 * Usa la base de pruebas (TEST_DATABASE_URL). Cada prueba crea sus propios datos únicos.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventStatus, QuoteStatus } from "@prisma/client";
import { prisma } from "@/db";
import { env } from "@/lib/env";
import { dateOnly, localDateKey, zonedDateTime } from "@/lib/dates";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import { signMockPayload } from "@/server/providers/payments/mock-signature";
import { getPaymentProvider } from "@/server/providers";
import { MockPaymentProvider } from "@/server/providers/payments/mock-provider";
import { testOwner, uid } from "./helpers";

const hoisted = vi.hoisted(() => ({
  onEventConfirmed: vi.fn(async (_eventId: string) => undefined),
  paymentsEnabled: { value: true },
  currentUser: { value: null as null | { id: string; email: string; name: string; role: "SUPER_ADMIN" | "OWNER" | "STAFF" } },
}));

vi.mock("@/features/events/server/lifecycle", () => ({ onEventConfirmed: hoisted.onEventConfirmed }));
// Sesión simulada para ejercitar las Server Actions (RBAC del wrapper) fuera de una petición de Next.
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: vi.fn(async () => hoisted.currentUser.value),
  hasPermission: vi.fn(async () => false),
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/flags", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/flags")>();
  return {
    ...original,
    isEnabled: vi.fn(async (flag: string) => (flag === "PAYMENTS_ENABLED" ? hoisted.paymentsEnabled.value : true)),
  };
});

import { POST as webhookPOST } from "@/app/api/webhooks/payments/[provider]/route";
import {
  recordManualPayment,
  refundPayment,
  resolveBookingFromToken,
  startCheckout,
} from "@/features/payments/server/payment-service";
import { handlePaymentWebhook } from "@/features/payments/server/webhook-service";
import { getPaymentStatusAction, startCheckoutAction } from "@/features/payments/server/checkout-actions";
import { mockCheckoutAction } from "@/features/payments/server/mock-checkout-actions";
import { recordManualPaymentAction, refundPaymentAction } from "@/features/payments/server/actions";
import { estimateFeeCents } from "@/features/payments/domain/amounts";
import { cancelEvent } from "@/features/events/server/event-service";
import { getSettings } from "@/features/settings/server/settings-service";
import { getBookingPaymentSummary, getPaymentResult, getPaymentsPanelData, listRecentPayments } from "@/features/payments/server/queries";
import { isValidPaymentResultSignature, paymentResultRelativePath } from "@/features/payments/server/payment-links";

const DAY = 24 * 60 * 60 * 1000;
const TOTAL = 1_000_000; // $10,000
const DEPOSIT = 500_000; // $5,000

const created = { customers: [] as string[], quotes: [] as string[], events: [] as string[], bookings: [] as string[] };

async function makeFixture(opts: { eventStatus?: EventStatus; quoteStatus?: QuoteStatus; total?: number; deposit?: number } = {}) {
  const total = opts.total ?? TOTAL;
  const deposit = opts.deposit ?? DEPOSIT;
  const customer = await prisma.customer.create({
    data: {
      name: "Valeria Pagos",
      email: `${uid("pago")}@example.test`,
      whatsapp: "5512345678",
      referralCode: uid("REF").toUpperCase(),
    },
  });
  created.customers.push(customer.id);
  const startsAtGuess = new Date(Date.now() + 30 * DAY);
  const dateKey = localDateKey(startsAtGuess);
  const startsAt = zonedDateTime(dateKey, "11:00");
  const quote = await prisma.quote.create({
    data: {
      code: uid("Q-").toUpperCase(),
      publicToken: generateToken(),
      status: opts.quoteStatus ?? "ACCEPTED",
      customerId: customer.id,
      title: "Brunch de pagos",
      guestCount: 8,
      eventDate: dateOnly(dateKey),
      totalCents: total,
      depositCents: deposit,
      acceptedAt: new Date(),
    },
  });
  created.quotes.push(quote.id);
  const event = await prisma.event.create({
    data: {
      code: uid("EV-").toUpperCase(),
      title: "Brunch de pagos",
      status: opts.eventStatus ?? "PENDING_PAYMENT",
      customerId: customer.id,
      quoteId: quote.id,
      eventDate: dateOnly(dateKey),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000),
      guestCount: 8,
      micrositeSlug: `pay-${uid()}`,
      inviteToken: generateToken(),
      portalToken: generateToken(),
      colors: [],
    },
  });
  created.events.push(event.id);
  const booking = await prisma.booking.create({
    data: {
      code: uid("B-").toUpperCase(),
      quoteId: quote.id,
      customerId: customer.id,
      eventId: event.id,
      totalCents: total,
      depositRequiredCents: deposit,
      termsVersion: "2026-09",
      termsAcceptedAt: new Date(),
      acceptedByName: customer.name,
      balanceDueAt: new Date(startsAt.getTime() - 3 * DAY),
    },
  });
  created.bookings.push(booking.id);
  return { customer, quote, event, booking };
}

function mockWebhook(
  payment: { id: string; providerCheckoutId: string | null; amountCents: number },
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded",
  extra: Record<string, unknown> = {},
) {
  const token = uid();
  const payload = {
    id: `evt_mock_${token}`,
    type,
    checkoutId: payment.providerCheckoutId,
    paymentId: payment.id,
    providerPaymentId: `mock_pi_${token}`,
    amountCents: payment.amountCents,
    feeCents: 18_300,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  const body = JSON.stringify(payload);
  return { body, signature: signMockPayload(body, env().PAYMENT_WEBHOOK_SECRET), payload };
}

async function postWebhook(provider: string, body: string, signature: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("x-mock-signature", signature);
  const res = await webhookPOST(
    new Request(`http://localhost/api/webhooks/payments/${provider}`, { method: "POST", body, headers }),
    { params: Promise.resolve({ provider }) },
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function notificationCount(eventId: string, type: "PAYMENT_RECEIVED" | "BOOKING_CONFIRMED", channel: "EMAIL" | "WHATSAPP" = "EMAIL") {
  return prisma.notificationLog.count({ where: { eventId, type, channel } });
}

/**
 * Retiene un candado de fila (SELECT ... FOR UPDATE) en una transacción propia para forzar un orden
 * determinista entre procesos que compiten por él (las esperas por candado de Postgres son FIFO).
 *  - waitBlocked(n): espera a que n sesiones estén bloqueadas, directa o transitivamente, detrás de ella.
 *  - run(fn): ejecuta algo dentro de esa transacción (p. ej. cambiar el pago) antes de soltarla.
 *  - release(): confirma la transacción y suelta el candado.
 */
/** Promesa que la prueba resuelve a mano (p. ej. una pasarela que tarda en responder). */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function holdRowLock(table: "Booking" | "Payment", id: string) {
  type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const jobs: ((tx: Tx) => Promise<void>)[] = [];
  let ready!: (pid: number) => void;
  const pidReady = new Promise<number>((resolve) => (ready = resolve));
  const done = prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      if (table === "Booking") await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id} FOR UPDATE`;
      else await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} FOR UPDATE`;
      ready(row!.pid);
      await released;
      for (const job of jobs) await job(tx);
    },
    { maxWait: 10_000, timeout: 25_000 },
  );
  const holder = await Promise.race([
    pidReady,
    done.then(() => {
      throw new Error("La transacción que retiene el candado terminó antes de tiempo");
    }),
  ]);
  return {
    async waitBlocked(n: number) {
      const deadline = Date.now() + 10_000;
      for (;;) {
        const [row] = await prisma.$queryRaw<{ blocked: number }[]>`
          WITH RECURSIVE chain(pid) AS (
            SELECT a.pid FROM pg_stat_activity a WHERE ${holder}::int = ANY(pg_blocking_pids(a.pid))
            UNION
            SELECT a.pid FROM pg_stat_activity a JOIN chain c ON c.pid = ANY(pg_blocking_pids(a.pid))
          )
          SELECT count(*)::int AS blocked FROM chain`;
        if ((row?.blocked ?? 0) >= n) return;
        if (Date.now() > deadline) throw new Error(`Se esperaban ${n} sesiones bloqueadas por el candado; hay ${row?.blocked ?? 0}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },
    async release(job?: (tx: Tx) => Promise<void>) {
      if (job) jobs.push(job);
      release();
      await done;
    },
  };
}

beforeEach(() => {
  hoisted.onEventConfirmed.mockClear();
  hoisted.paymentsEnabled.value = true;
  hoisted.currentUser.value = null;
});

afterAll(async () => {
  // Limpieza best-effort de los datos creados por esta suite (nunca truncar tablas).
  try {
    await prisma.payment.updateMany({ where: { bookingId: { in: created.bookings } }, data: { refundOfId: null } });
    await prisma.payment.deleteMany({ where: { bookingId: { in: created.bookings } } });
    await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } });
    await prisma.notificationLog.deleteMany({ where: { eventId: { in: created.events } } });
    await prisma.analyticsEvent.deleteMany({ where: { eventId: { in: created.events } } });
    await prisma.event.deleteMany({ where: { id: { in: created.events } } });
    await prisma.quote.deleteMany({ where: { id: { in: created.quotes } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
  } catch {
    // datos de prueba: si algo queda referenciado no es crítico
  }
});

describe("startCheckout", () => {
  it("calcula el anticipo, crea un Payment PENDING con checkout y lo reutiliza < 1 h", async () => {
    const { booking, event } = await makeFixture();
    const first = await startCheckout(booking.id, "DEPOSIT", { source: "portal" });
    expect(first.reused).toBe(false);
    expect(first.url).toContain("/pago/mock/mock_cs_");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    expect(payment).toMatchObject({
      status: "PENDING",
      kind: "DEPOSIT",
      method: "ONLINE",
      provider: "mock",
      amountCents: DEPOSIT,
    });
    expect(payment.idempotencyKey.startsWith(`${booking.id}:DEPOSIT:`)).toBe(true);
    expect(payment.providerCheckoutId).toMatch(/^mock_cs_/);
    expect(payment.checkoutUrl).toBe(first.url);

    const again = await startCheckout(booking.id, "DEPOSIT");
    expect(again).toMatchObject({ reused: true, paymentId: first.paymentId });
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(1);
    expect(await prisma.analyticsEvent.count({ where: { eventId: event.id, type: "START_PAYMENT" } })).toBe(1);

    // Desde la cotización, el checkout simulado recuerda volver a la cotización al cancelar
    const fromQuote = await startCheckout(booking.id, "DEPOSIT", { source: "quote" });
    expect(fromQuote.url).toContain("from=quote");
  });

  it("saldo/pago completo = total − pagado neto; bloquea si el anticipo ya está cubierto o no hay saldo", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: DEPOSIT,
      kind: "DEPOSIT",
      method: "TRANSFER",
      paidAt: localDateKey(),
    });
    await expect(startCheckout(booking.id, "DEPOSIT")).rejects.toThrow("Tu anticipo ya está cubierto");
    const balance = await startCheckout(booking.id, "BALANCE");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: balance.paymentId } })).amountCents).toBe(TOTAL - DEPOSIT);
    const full = await startCheckout(booking.id, "FULL");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: full.paymentId } })).amountCents).toBe(TOTAL - DEPOSIT);

    await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: TOTAL - DEPOSIT,
      kind: "BALANCE",
      method: "CASH",
      paidAt: localDateKey(),
    });
    await expect(startCheckout(booking.id, "BALANCE")).rejects.toThrow("No hay saldo pendiente");
  });

  it("solicitudes simultáneas de la misma reserva comparten un solo pago pendiente (candado de la reserva)", async () => {
    const { booking, event } = await makeFixture();
    const results = await Promise.all([1, 2, 3].map(() => startCheckout(booking.id, "DEPOSIT", { source: "portal" })));
    expect(new Set(results.map((r) => r.paymentId)).size).toBe(1);
    expect(new Set(results.map((r) => r.url)).size).toBe(1);
    expect(results.filter((r) => !r.reused)).toHaveLength(1);
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(1);
    expect(await prisma.analyticsEvent.count({ where: { eventId: event.id, type: "START_PAYMENT" } })).toBe(1);
  });

  it("la pasarela se llama FUERA del candado: la reserva no queda bloqueada y otra solicitud espera y reutiliza la misma URL", async () => {
    const { booking, event } = await makeFixture();
    const gate = deferred();
    const original = MockPaymentProvider.prototype.createCheckout;
    const create = vi.spyOn(MockPaymentProvider.prototype, "createCheckout").mockImplementation(async function (
      this: MockPaymentProvider,
      input,
    ) {
      await gate.promise;
      return original.call(this, input);
    });
    try {
      const first = startCheckout(booking.id, "DEPOSIT");
      await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      // Mientras la pasarela responde, nadie retiene el candado de la reserva (NOWAIT falla si lo hubiera).
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE NOWAIT`;
      });
      // El lugar quedó reservado (PENDING sin URL) antes de llamar a la pasarela.
      expect(await prisma.payment.findMany({ where: { bookingId: booking.id }, select: { status: true, checkoutUrl: true } })).toEqual([
        { status: "PENDING", checkoutUrl: null },
      ]);
      const second = startCheckout(booking.id, "DEPOSIT");
      gate.resolve();
      const [a, b] = await Promise.all([first, second]);
      expect(a.reused).toBe(false);
      expect(b).toEqual({ url: a.url, paymentId: a.paymentId, reused: true });
      expect(create, "un solo cobro abierto en la pasarela").toHaveBeenCalledTimes(1);
      expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.analyticsEvent.count({ where: { eventId: event.id, type: "START_PAYMENT" } })).toBe(1);
    } finally {
      gate.resolve();
      create.mockRestore();
    }
  });

  it("si la pasarela falla, el intento queda FAILED y responde CHECKOUT_FAILED; el siguiente intento abre uno nuevo", async () => {
    const { booking, event } = await makeFixture();
    const create = vi.spyOn(MockPaymentProvider.prototype, "createCheckout").mockRejectedValueOnce(new Error("pasarela caída (prueba)"));
    try {
      await expect(startCheckout(booking.id, "DEPOSIT")).rejects.toMatchObject({ code: "CHECKOUT_FAILED" });
      expect(await prisma.payment.findMany({ where: { bookingId: booking.id }, select: { status: true, failureReason: true, checkoutUrl: true } })).toEqual([
        { status: "FAILED", failureReason: "No se pudo abrir la pasarela de pago.", checkoutUrl: null },
      ]);
      expect(await prisma.analyticsEvent.count({ where: { eventId: event.id, type: "START_PAYMENT" } })).toBe(0);
      const retry = await startCheckout(booking.id, "DEPOSIT");
      expect(retry.reused).toBe(false);
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: retry.paymentId } })).toMatchObject({ status: "PENDING", checkoutUrl: retry.url });
    } finally {
      create.mockRestore();
    }
  });

  it("un lugar reservado que quedó sin URL más allá de la ventana de apertura se da por fallido y se abre otro", async () => {
    const { booking } = await makeFixture();
    const abandoned = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: "DEPOSIT",
        status: "PENDING",
        method: "ONLINE",
        provider: "mock",
        amountCents: DEPOSIT,
        currency: "MXN",
        idempotencyKey: `${booking.id}:DEPOSIT:${uid()}`,
        createdAt: new Date(Date.now() - 60_000),
      },
    });
    const res = await startCheckout(booking.id, "DEPOSIT");
    expect(res.reused).toBe(false);
    expect(res.paymentId).not.toBe(abandoned.id);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: abandoned.id } })).toMatchObject({
      status: "FAILED",
      failureReason: "No se pudo abrir la pasarela de pago.",
    });
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PENDING" } })).toBe(1);
  });

  it("rechaza eventos cancelados y pagos deshabilitados", async () => {
    const cancelled = await makeFixture({ eventStatus: "CANCELLED" });
    await expect(startCheckout(cancelled.booking.id, "DEPOSIT")).rejects.toMatchObject({ code: "EVENT_CANCELLED" });

    const { booking } = await makeFixture();
    hoisted.paymentsEnabled.value = false;
    const err = await startCheckout(booking.id, "DEPOSIT").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("PAYMENTS_DISABLED");
    expect((err as AppError).message).toContain("WhatsApp");
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it("resuelve tokens de cotización aceptada y de portal; 404 genérico en lo demás", async () => {
    const { booking, quote, event } = await makeFixture();
    expect(await resolveBookingFromToken(quote.publicToken, "quote")).toEqual({ bookingId: booking.id });
    expect(await resolveBookingFromToken(event.portalToken, "portal")).toEqual({ bookingId: booking.id });
    await expect(resolveBookingFromToken(event.portalToken, "quote")).rejects.toBeInstanceOf(NotFoundError);
    await expect(resolveBookingFromToken("corto", "portal")).rejects.toBeInstanceOf(NotFoundError);
    await expect(resolveBookingFromToken(generateToken(), "portal")).rejects.toBeInstanceOf(NotFoundError);

    const sent = await makeFixture({ quoteStatus: "SENT" });
    await expect(resolveBookingFromToken(sent.quote.publicToken, "quote")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Webhook de pagos", () => {
  it("pago exitoso: PAID + evento CONFIRMED + lifecycle + notificaciones; el duplicado no repite nada", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const hook = mockWebhook(payment, "payment.succeeded");

    const res = await postWebhook("mock", hook.body, hook.signature);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ received: true, applied: true });

    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    expect(paid.feeCents).toBe(18_300);
    expect(paid.providerPaymentId).toBe(hook.payload.providerPaymentId);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    expect(hoisted.onEventConfirmed).toHaveBeenCalledTimes(1);
    expect(hoisted.onEventConfirmed).toHaveBeenCalledWith(event.id);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(1);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED", "WHATSAPP")).toBe(1);
    expect(await notificationCount(event.id, "BOOKING_CONFIRMED")).toBe(1);
    const wh = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "mock", externalId: hook.payload.id } },
    });
    expect(wh.processedAt).not.toBeNull();
    expect(wh.signatureValid).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { action: "event.confirmed_by_payment", entityId: event.id } }),
    ).toBe(1);

    // Mismo evento otra vez → 200 duplicate, sin cambios
    const dup = await postWebhook("mock", hook.body, hook.signature);
    expect(dup.status).toBe(200);
    expect(dup.json).toMatchObject({ duplicate: true });
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PAID" } })).toBe(1);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(1);
    expect(await notificationCount(event.id, "BOOKING_CONFIRMED")).toBe(1);
    expect(hoisted.onEventConfirmed).toHaveBeenCalledTimes(1);
    expect(await prisma.analyticsEvent.count({ where: { eventId: event.id, type: "PAYMENT_SUCCESS" } })).toBe(1);

    // Otro evento (id distinto) para el mismo pago: el pago ya está PAID → no se re-aplica
    const second = mockWebhook(payment, "payment.succeeded");
    const res2 = await postWebhook("mock", second.body, second.signature);
    expect(res2.status).toBe(200);
    expect(res2.json).toMatchObject({ applied: false });
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(1);

    // El enlace de resultado firmado expone sólo este pago
    const path = paymentResultRelativePath(paymentId);
    const url = new URL(path, "http://x");
    expect(isValidPaymentResultSignature(url.searchParams.get("p"), url.searchParams.get("s"))).toBe(true);
    expect(isValidPaymentResultSignature(paymentId, "x".repeat(32))).toBe(false);
    expect((await getPaymentResult(paymentId))?.status).toBe("PAID");
  });

  it("firma inválida → 400 y sin cambios; proveedor desconocido → 404", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const hook = mockWebhook(payment, "payment.succeeded");

    const tampered = hook.body.replace(String(payment.amountCents), "1");
    expect((await postWebhook("mock", tampered, hook.signature)).status).toBe(400);
    expect((await postWebhook("mock", hook.body, null)).status).toBe(400);
    expect((await postWebhook("mock", hook.body, signMockPayload(hook.body, "otro-secreto"))).status).toBe(400);
    expect((await postWebhook("paypal", hook.body, hook.signature)).status).toBe(404);
    expect((await postWebhook("stripe", hook.body, hook.signature)).status).toBe(404); // sin credenciales → no disponible

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PENDING");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
    expect(await prisma.webhookEvent.count({ where: { provider: "mock", externalId: hook.payload.id } })).toBe(0);
    expect(hoisted.onEventConfirmed).not.toHaveBeenCalled();
  });

  it("pago rechazado → FAILED con motivo; el evento sigue pendiente; un reintento exitoso confirma", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const failed = mockWebhook(payment, "payment.failed", { failureReason: "Tarjeta rechazada (prueba)", feeCents: undefined });
    const res = await postWebhook("mock", failed.body, failed.signature);
    expect(res.status).toBe(200);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status).toBe("FAILED");
    expect(after.failureReason).toBe("Tarjeta rechazada (prueba)");
    expect(after.failedAt).not.toBeNull();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(0);

    // Reintento: nuevo checkout (el fallido no se reutiliza) y pago exitoso
    const retry = await startCheckout(booking.id, "DEPOSIT");
    expect(retry.paymentId).not.toBe(paymentId);
    const retryPayment = await prisma.payment.findUniqueOrThrow({ where: { id: retry.paymentId } });
    const ok = mockWebhook(retryPayment, "payment.succeeded");
    expect((await postWebhook("mock", ok.body, ok.signature)).status).toBe(200);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");

    // Un "failed" tardío nunca degrada un pago cobrado
    const late = mockWebhook(retryPayment, "payment.failed");
    await postWebhook("mock", late.body, late.signature);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: retry.paymentId } })).status).toBe("PAID");
  });

  it("el webhook mock no puede tocar pagos de otro proveedor", async () => {
    const { booking } = await makeFixture();
    const foreign = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: "DEPOSIT",
        status: "PENDING",
        provider: "stripe",
        providerCheckoutId: `cs_test_${uid()}`,
        amountCents: DEPOSIT,
        idempotencyKey: `${booking.id}:DEPOSIT:${uid()}`,
      },
    });
    const hook = mockWebhook(foreign, "payment.succeeded");
    const res = await postWebhook("mock", hook.body, hook.signature);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ applied: false, note: "payment_not_found" });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("PENDING");
  });

  it("refund.succeeded del proveedor actualiza estado, crea el REFUND por la diferencia y es idempotente", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const ok = mockWebhook(payment, "payment.succeeded");
    await postWebhook("mock", ok.body, ok.signature);

    const partial = mockWebhook(payment, "refund.succeeded", { refundedCents: 200_000 });
    expect((await postWebhook("mock", partial.body, partial.signature)).status).toBe(200);
    let p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(p).toMatchObject({ status: "PARTIAL_REFUND", refundedCents: 200_000 });
    expect(await prisma.payment.count({ where: { refundOfId: paymentId, kind: "REFUND" } })).toBe(1);

    // Repetir el mismo total (otro id) no crea otra fila
    const same = mockWebhook(payment, "refund.succeeded", { refundedCents: 200_000 });
    await postWebhook("mock", same.body, same.signature);
    expect(await prisma.payment.count({ where: { refundOfId: paymentId, kind: "REFUND" } })).toBe(1);

    const total = mockWebhook(payment, "refund.succeeded", { refundedCents: DEPOSIT });
    await postWebhook("mock", total.body, total.signature);
    p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(p).toMatchObject({ status: "REFUNDED", refundedCents: DEPOSIT });
    const refunds = await prisma.payment.findMany({ where: { refundOfId: paymentId }, orderBy: { createdAt: "asc" } });
    expect(refunds.map((r) => r.amountCents)).toEqual([200_000, 300_000]);
    const summary = await getBookingPaymentSummary(booking.id);
    expect(summary?.netPaidCents).toBe(0);
    // El evento confirmado no se revierte automáticamente
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
  });

  it("dos pagos parciales simultáneos suman para confirmar el anticipo (bloqueo de la reserva)", async () => {
    const { booking, event } = await makeFixture();
    const mk = (amountCents: number) =>
      prisma.payment.create({
        data: {
          bookingId: booking.id,
          kind: "DEPOSIT",
          status: "PENDING",
          provider: "mock",
          providerCheckoutId: `mock_cs_${uid()}`,
          amountCents,
          idempotencyKey: `${booking.id}:DEPOSIT:${uid()}`,
        },
      });
    const [a, b] = await Promise.all([mk(DEPOSIT / 2), mk(DEPOSIT / 2)]);
    const ha = mockWebhook(a, "payment.succeeded");
    const hb = mockWebhook(b, "payment.succeeded");
    const [ra, rb] = await Promise.all([postWebhook("mock", ha.body, ha.signature), postWebhook("mock", hb.body, hb.signature)]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    expect(hoisted.onEventConfirmed).toHaveBeenCalledTimes(1);
    expect(await notificationCount(event.id, "BOOKING_CONFIRMED")).toBe(1);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(2);
  });

  it("handlePaymentWebhook reprocesa un evento cuyo intento previo falló (sin processedAt)", async () => {
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const hook = mockWebhook(payment, "payment.succeeded");
    await prisma.webhookEvent.create({
      data: { provider: "mock", externalId: hook.payload.id, type: "payment.succeeded", payload: {}, signatureValid: true, error: "boom" },
    });
    const res = await handlePaymentWebhook("mock", hook.body, new Headers({ "x-mock-signature": hook.signature }));
    expect(res.status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PAID");
    const wh = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "mock", externalId: hook.payload.id } },
    });
    expect(wh.processedAt).not.toBeNull();
    expect(wh.error).toBeNull();
  });
});

describe("Pagos manuales", () => {
  it("registra un pago PAID auditado; un anticipo parcial no confirma, al completarlo sí", async () => {
    const owner = await testOwner();
    const { event, booking } = await makeFixture();

    const first = await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: 200_000,
      kind: "DEPOSIT",
      method: "TRANSFER",
      paidAt: localDateKey(),
      notes: "SPEI ref 123",
    });
    expect(first.confirmed).toBe(false);
    const p1 = await prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    expect(p1).toMatchObject({
      status: "PAID",
      provider: "manual",
      method: "TRANSFER",
      amountCents: 200_000,
      feeCents: 0,
      recordedById: owner.id,
      notes: "SPEI ref 123",
    });
    expect(p1.idempotencyKey.startsWith("manual:")).toBe(true);
    const auditRow = await prisma.auditLog.findFirst({ where: { action: "payment.manual_recorded", entityId: p1.id } });
    expect(auditRow?.actorId).toBe(owner.id);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
    expect(hoisted.onEventConfirmed).not.toHaveBeenCalled();
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(1);

    const second = await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: 300_000,
      kind: "DEPOSIT",
      method: "CASH",
      paidAt: localDateKey(),
    });
    expect(second.confirmed).toBe(true);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    expect(hoisted.onEventConfirmed).toHaveBeenCalledWith(event.id);
    expect(await notificationCount(event.id, "BOOKING_CONFIRMED")).toBe(1);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(2);

    const summary = await getBookingPaymentSummary(booking.id);
    expect(summary).toMatchObject({ netPaidCents: DEPOSIT, balanceDueCents: TOTAL - DEPOSIT, depositSatisfied: true });
  });

  it("valida monto contra el saldo, fecha futura, comprobante y eventos cancelados", async () => {
    const owner = await testOwner();
    const { event } = await makeFixture();
    const tooMuch = await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: TOTAL + 1,
      kind: "FULL",
      method: "CASH",
      paidAt: localDateKey(),
    }).catch((e: unknown) => e);
    expect(tooMuch).toBeInstanceOf(ValidationError);
    expect((tooMuch as ValidationError).fieldErrors?.amountCents?.[0]).toContain("excede el saldo");

    const future = localDateKey(new Date(Date.now() + 3 * DAY));
    await expect(
      recordManualPayment(owner, { eventId: event.id, amountCents: 1_000, kind: "DEPOSIT", method: "CASH", paidAt: future }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      recordManualPayment(owner, {
        eventId: event.id,
        amountCents: 1_000,
        kind: "DEPOSIT",
        method: "CASH",
        paidAt: localDateKey(),
        receiptMediaId: "cm000000000000000000000000",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const cancelled = await makeFixture({ eventStatus: "CANCELLED" });
    await expect(
      recordManualPayment(owner, {
        eventId: cancelled.event.id,
        amountCents: 1_000,
        kind: "DEPOSIT",
        method: "CASH",
        paidAt: localDateKey(),
      }),
    ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
    expect(await prisma.payment.count({ where: { booking: { eventId: event.id } } })).toBe(0);
  });

  it("dos pagos manuales simultáneos no pueden exceder el saldo", async () => {
    const owner = await testOwner();
    const { event, booking } = await makeFixture();
    const input = { eventId: event.id, amountCents: TOTAL, kind: "FULL" as const, method: "TRANSFER" as const, paidAt: localDateKey() };
    const results = await Promise.allSettled([recordManualPayment(owner, input), recordManualPayment(owner, input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ValidationError);
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PAID" } })).toBe(1);
  });

  it("acepta un comprobante RECEIPT y una fecha pasada", async () => {
    const owner = await testOwner();
    const { event } = await makeFixture();
    const media = await prisma.mediaAsset.create({
      data: { driver: "LOCAL", storageKey: `test/${uid()}.pdf`, mimeType: "application/pdf", purpose: "RECEIPT", eventId: event.id },
    });
    const yesterday = localDateKey(new Date(Date.now() - DAY));
    const res = await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: DEPOSIT,
      kind: "DEPOSIT",
      method: "CARD_TERMINAL",
      paidAt: yesterday,
      receiptMediaId: media.id,
    });
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
    expect(p.receiptMediaId).toBe(media.id);
    expect(localDateKey(p.paidAt!)).toBe(yesterday);
    await prisma.payment.update({ where: { id: p.id }, data: { receiptMediaId: null } });
    await prisma.mediaAsset.delete({ where: { id: media.id } });
  });
});

describe("Reembolsos desde el panel", () => {
  it("parcial y total sobre un pago manual: estados, fila REFUND, auditoría y pagado neto", async () => {
    const owner = await testOwner();
    const { event, booking } = await makeFixture();
    const { paymentId } = await recordManualPayment(owner, {
      eventId: event.id,
      amountCents: DEPOSIT,
      kind: "DEPOSIT",
      method: "TRANSFER",
      paidAt: localDateKey(),
    });

    const partial = await refundPayment(owner, { paymentId, amountCents: 150_000, reason: "Ajuste de invitadas" });
    expect(partial).toMatchObject({ originalStatus: "PARTIAL_REFUND", refundedCents: 150_000, providerStatus: "manual" });
    const refundRow = await prisma.payment.findUniqueOrThrow({ where: { id: partial.refundPaymentId } });
    expect(refundRow).toMatchObject({ kind: "REFUND", refundOfId: paymentId, amountCents: 150_000, status: "PAID", notes: "Ajuste de invitadas" });
    expect(await prisma.auditLog.count({ where: { action: "payment.refunded", entityId: paymentId } })).toBe(1);
    expect((await getBookingPaymentSummary(booking.id))?.netPaidCents).toBe(DEPOSIT - 150_000);

    await expect(refundPayment(owner, { paymentId, amountCents: DEPOSIT, reason: "Demasiado" })).rejects.toBeInstanceOf(
      ValidationError,
    );

    const total = await refundPayment(owner, { paymentId, amountCents: DEPOSIT - 150_000, reason: "Cancelación" });
    expect(total).toMatchObject({ originalStatus: "REFUNDED", refundedCents: DEPOSIT });
    const original = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(original).toMatchObject({ status: "REFUNDED", refundedCents: DEPOSIT });
    expect((await getBookingPaymentSummary(booking.id))?.netPaidCents).toBe(0);
    await expect(refundPayment(owner, { paymentId, amountCents: 1, reason: "Otra vez" })).rejects.toBeInstanceOf(ValidationError);

    const panel = await getPaymentsPanelData(event.id);
    expect(panel?.booking?.payments).toHaveLength(3);
    expect(panel?.summary?.refundedCents).toBe(DEPOSIT);
  });

  it("reembolso en línea usa el proveedor (mock) y guarda su referencia", async () => {
    const owner = await testOwner();
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "FULL");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const ok = mockWebhook(payment, "payment.succeeded");
    await postWebhook("mock", ok.body, ok.signature);

    const res = await refundPayment(owner, { paymentId, amountCents: 100_000, reason: "Cortesía" });
    expect(res.providerStatus).toBe("succeeded");
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: res.refundPaymentId } });
    expect(row.providerPaymentId).toMatch(/^mock_re_/);
    expect(row.provider).toBe("mock");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PARTIAL_REFUND");

    // El webhook del proveedor con el mismo total no duplica la fila REFUND
    const echo = mockWebhook(payment, "refund.succeeded", { refundedCents: 100_000 });
    await postWebhook("mock", echo.body, echo.signature);
    expect(await prisma.payment.count({ where: { refundOfId: paymentId } })).toBe(1);
  });

  it("no permite reembolsar pagos pendientes", async () => {
    const owner = await testOwner();
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    await expect(refundPayment(owner, { paymentId, amountCents: 100, reason: "Prueba" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Anomalías de cobro y conciliación de reembolsos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("un webhook con cobro MENOR al esperado no marca PAID ni confirma; deja nota y avisa al equipo", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const hook = mockWebhook(payment, "payment.succeeded", { amountCents: 100 });
    const res = await postWebhook("mock", hook.body, hook.signature);
    expect(res.status).toBe(200); // procesado (sin reintentos), pero no aplicado
    expect(res.json).toMatchObject({ applied: false });
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status).toBe("PENDING");
    expect(after.notes).toContain("Revisión manual");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
    expect(hoisted.onEventConfirmed).not.toHaveBeenCalled();
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(0);
    const wh = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: "mock", externalId: hook.payload.id } },
    });
    expect(wh.processedAt).not.toBeNull();
    expect(wh.error).toMatch(/^amount_mismatch:/);
    expect(await prisma.notificationLog.count({ where: { eventId: event.id, type: "GENERIC", dedupeKey: `amount-mismatch:${hook.payload.id}` } })).toBe(1);
  });

  it("un excedente (cobro mayor al total) se aplica y el aviso al equipo lo señala", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "FULL");
    // Mientras la clienta estaba en la pasarela, el equipo registró un pago manual del anticipo
    await recordManualPayment(owner, { eventId: event.id, amountCents: DEPOSIT, kind: "DEPOSIT", method: "TRANSFER", paidAt: localDateKey() });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const hook = mockWebhook(payment, "payment.succeeded");
    expect((await postWebhook("mock", hook.body, hook.signature)).json).toMatchObject({ applied: true });
    const team = await prisma.notificationLog.findUniqueOrThrow({ where: { dedupeKey: `payment-received-team:${paymentId}` } });
    expect(team.body).toContain("excede el total");
    expect((await getBookingPaymentSummary(booking.id))?.netPaidCents).toBe(TOTAL + DEPOSIT);
  });

  it("si el webhook de reembolso llega ANTES que el registro del panel, se concilia (sin error ni doble fila)", async () => {
    const owner = await testOwner();
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const ok = mockWebhook(payment, "payment.succeeded");
    await postWebhook("mock", ok.body, ok.signature);

    const provider = getPaymentProvider();
    vi.spyOn(provider, "refund").mockImplementation(async (input) => {
      // La pasarela notifica el reembolso (total acumulado) antes de que el panel lo guarde
      const echo = mockWebhook(payment, "refund.succeeded", { refundedCents: input.amountCents });
      await postWebhook("mock", echo.body, echo.signature);
      return { refundId: "mock_re_race1", status: "succeeded" };
    });
    const res = await refundPayment(owner, { paymentId, amountCents: 120_000, reason: "Cortesía" });
    expect(res).toMatchObject({ originalStatus: "PARTIAL_REFUND", refundedCents: 120_000, providerStatus: "succeeded" });
    const rows = await prisma.payment.findMany({ where: { refundOfId: paymentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountCents: 120_000, recordedById: owner.id, notes: "Cortesía", providerPaymentId: "mock_re_race1" });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).refundedCents).toBe(120_000);
    const audits = await prisma.auditLog.findMany({ where: { action: "payment.refunded", entityId: paymentId } });
    expect(audits.length).toBe(2); // webhook (actor null) + conciliación del panel
  });

  it("doble envío simultáneo del mismo reembolso en línea (misma referencia del proveedor) no duplica", async () => {
    const owner = await testOwner();
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const ok = mockWebhook(payment, "payment.succeeded");
    await postWebhook("mock", ok.body, ok.signature);

    // Stripe/MP devuelven el mismo reembolso para la misma Idempotency-Key
    vi.spyOn(getPaymentProvider(), "refund").mockResolvedValue({ refundId: "mock_re_same", status: "succeeded" });
    const input = { paymentId, amountCents: 50_000, reason: "Doble clic" };
    const results = await Promise.allSettled([refundPayment(owner, input), refundPayment(owner, input)]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await prisma.payment.count({ where: { refundOfId: paymentId } })).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).refundedCents).toBe(50_000);
  });

  it("un reembolso 'en proceso' en la pasarela queda aplicado cuando el proveedor lo confirma", async () => {
    const owner = await testOwner();
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const ok = mockWebhook(payment, "payment.succeeded");
    await postWebhook("mock", ok.body, ok.signature);

    vi.spyOn(getPaymentProvider(), "refund").mockResolvedValue({ refundId: "mock_re_pending", status: "pending" });
    const res = await refundPayment(owner, { paymentId, amountCents: DEPOSIT, reason: "Cancelación" });
    expect(res.providerStatus).toBe("pending");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: res.refundPaymentId } })).status).toBe("PENDING");

    const confirm = mockWebhook(payment, "refund.succeeded", { refundedCents: DEPOSIT });
    expect((await postWebhook("mock", confirm.body, confirm.signature)).json).toMatchObject({ applied: true, note: "refund_settled" });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: res.refundPaymentId } })).status).toBe("PAID");
    expect(await prisma.payment.count({ where: { refundOfId: paymentId } })).toBe(1);
  });
});

describe("Checkout simulado (mockCheckoutAction)", () => {
  const prevInternal = process.env.INTERNAL_APP_URL;
  beforeEach(() => {
    // Puerto inalcanzable: fuerza el respaldo (procesar el mismo webhook firmado directamente)
    process.env.INTERNAL_APP_URL = "http://127.0.0.1:9";
  });
  afterAll(() => {
    if (prevInternal === undefined) delete process.env.INTERNAL_APP_URL;
    else process.env.INTERNAL_APP_URL = prevInternal;
  });

  it("Pagar (simulado): webhook firmado → PAID + CONFIRMED → redirige al resultado; repetir no re-aplica", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const res = await mockCheckoutAction({ checkoutId: payment.providerCheckoutId!, outcome: "success" });
    expect(res).toEqual({ ok: true, data: { redirectTo: paymentResultRelativePath(paymentId) } });
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(paid.status).toBe("PAID");
    expect(paid.providerPaymentId).toMatch(/^mock_pi_/);
    expect(paid.feeCents).toBe(estimateFeeCents(payment.amountCents, await getSettings("pricing"))); // comisión estimada
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    const hooks = await prisma.webhookEvent.findMany({ where: { provider: "mock", payload: { path: ["paymentId"], equals: paymentId } } });
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.externalId).toMatch(/^evt_mock_/);

    const again = await mockCheckoutAction({ checkoutId: payment.providerCheckoutId!, outcome: "success" });
    expect(again).toEqual({ ok: true, data: { redirectTo: paymentResultRelativePath(paymentId) } });
    expect(await prisma.webhookEvent.count({ where: { provider: "mock", payload: { path: ["paymentId"], equals: paymentId } } })).toBe(1);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(1);
  });

  it("rechazo simulado → FAILED; cancelar vuelve a la cotización o al portal sin tocar el pago", async () => {
    const { booking, event, quote } = await makeFixture();
    const first = await startCheckout(booking.id, "DEPOSIT");
    const p1 = await prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    expect(await mockCheckoutAction({ checkoutId: p1.providerCheckoutId!, outcome: "cancel", from: "quote" })).toEqual({
      ok: true,
      data: { redirectTo: `/cotizacion/${quote.publicToken}` },
    });
    expect(await mockCheckoutAction({ checkoutId: p1.providerCheckoutId!, outcome: "cancel" })).toEqual({
      ok: true,
      data: { redirectTo: `/mi-evento/${event.portalToken}` },
    });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p1.id } })).status).toBe("PENDING");

    const failed = await mockCheckoutAction({ checkoutId: p1.providerCheckoutId!, outcome: "failure" });
    expect(failed.ok).toBe(true);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: p1.id } });
    expect(after.status).toBe("FAILED");
    expect(after.failureReason).toContain("simulación");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("enlace vencido (> 1 h) o con saldo desactualizado → error sin cobrar; checkout inexistente → NOT_FOUND", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await prisma.payment.update({ where: { id: p.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    const expired = await mockCheckoutAction({ checkoutId: p.providerCheckoutId!, outcome: "success" });
    expect(expired).toMatchObject({ ok: false, code: "CHECKOUT_EXPIRED" });

    const fresh = await startCheckout(booking.id, "DEPOSIT");
    const p2 = await prisma.payment.findUniqueOrThrow({ where: { id: fresh.paymentId } });
    await recordManualPayment(owner, { eventId: event.id, amountCents: 100_000, kind: "DEPOSIT", method: "CASH", paidAt: localDateKey() });
    const stale = await mockCheckoutAction({ checkoutId: p2.providerCheckoutId!, outcome: "success" });
    expect(stale).toMatchObject({ ok: false, code: "CHECKOUT_STALE" });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p2.id } })).status).toBe("PENDING");

    const missing = await mockCheckoutAction({ checkoutId: `mock_cs_${generateToken(18)}`, outcome: "success" });
    expect(missing).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const invalid = await mockCheckoutAction({ checkoutId: "cs_live_123", outcome: "success" });
    expect(invalid).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });
});

describe("Cancelación del evento con checkouts abiertos", () => {
  const prevInternal = process.env.INTERNAL_APP_URL;
  beforeEach(() => {
    // Puerto inalcanzable: el checkout simulado procesa su webhook firmado directamente
    process.env.INTERNAL_APP_URL = "http://127.0.0.1:9";
  });
  afterAll(() => {
    if (prevInternal === undefined) delete process.env.INTERNAL_APP_URL;
    else process.env.INTERNAL_APP_URL = prevInternal;
  });

  it("cancelar anula los checkouts PENDING (FAILED «Evento cancelado.»), lo audita y el checkout simulado ya no cobra", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");

    const r = await cancelEvent({ eventId: event.id, reason: "La clienta canceló (prueba)", notifyCustomer: false }, owner);
    expect(r.status).toBe("cancelled");
    const voided = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(voided).toMatchObject({ status: "FAILED", failureReason: "Evento cancelado." });
    expect(voided.failedAt).toBeInstanceOf(Date);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "event.cancelled", entityId: event.id } });
    expect(log.after).toMatchObject({ voidedPayments: [paymentId] });

    const res = await mockCheckoutAction({ checkoutId: voided.providerCheckoutId!, outcome: "success" });
    expect(res).toMatchObject({ ok: false, code: "EVENT_CANCELLED" });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("FAILED");
    expect(await prisma.webhookEvent.count({ where: { payload: { path: ["paymentId"], equals: paymentId } } })).toBe(0);
    await expect(startCheckout(booking.id, "DEPOSIT")).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(0);
  });

  it("cancelar pide a la pasarela expirar las sesiones anuladas (best-effort: si falla, la cancelación sigue)", async () => {
    const owner = await testOwner();
    const expire = vi.spyOn(MockPaymentProvider.prototype, "expireCheckout");
    try {
      const first = await makeFixture();
      const { paymentId } = await startCheckout(first.booking.id, "DEPOSIT");
      await cancelEvent({ eventId: first.event.id, reason: "La clienta canceló (prueba)", notifyCustomer: false }, owner);
      const voided = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(expire).toHaveBeenCalledTimes(1);
      expect(expire).toHaveBeenCalledWith(voided.providerCheckoutId);

      // La pasarela rechaza la expiración (p. ej. ya expirada o caída): la cancelación no falla.
      expire.mockClear();
      expire.mockRejectedValueOnce(new Error("pasarela no disponible (prueba)"));
      const second = await makeFixture();
      const other = await startCheckout(second.booking.id, "DEPOSIT");
      const r = await cancelEvent({ eventId: second.event.id, reason: "La clienta canceló (prueba)", notifyCustomer: false }, owner);
      expect(r.status).toBe("cancelled");
      expect(expire).toHaveBeenCalledTimes(1);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: other.paymentId } })).status).toBe("FAILED");

      // Sin checkouts abiertos no se llama a la pasarela.
      expire.mockClear();
      const third = await makeFixture();
      await cancelEvent({ eventId: third.event.id, reason: "La clienta canceló (prueba)", notifyCustomer: false }, owner);
      expect(expire).not.toHaveBeenCalled();
    } finally {
      expire.mockRestore();
    }
  });

  it("un pago cobrado normalmente y un evento cancelado después no se presenta como cobro tardío", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const hook = mockWebhook(payment, "payment.succeeded");
    expect((await postWebhook("mock", hook.body, hook.signature)).json).toMatchObject({ applied: true });
    await cancelEvent({ eventId: event.id, reason: "Cancelación con anticipo retenido", notifyCustomer: false }, owner);
    const s = new URL(paymentResultRelativePath(paymentId), "http://x").searchParams.get("s")!;
    expect(await getPaymentStatusAction({ p: paymentId, s })).toMatchObject({
      ok: true,
      data: { status: "PAID", eventCancelled: true, collectedAfterCancellation: false },
    });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).notes).toBeNull();
  });

  it("cancelar mientras la pasarela abre la sesión: la cancelación no la espera, el enlace nunca se entrega y esa sesión se expira", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const gate = deferred();
    const original = MockPaymentProvider.prototype.createCheckout;
    const sessions: string[] = [];
    const create = vi.spyOn(MockPaymentProvider.prototype, "createCheckout").mockImplementation(async function (
      this: MockPaymentProvider,
      input,
    ) {
      await gate.promise;
      const session = await original.call(this, input);
      sessions.push(session.checkoutId);
      return session;
    });
    const expire = vi.spyOn(MockPaymentProvider.prototype, "expireCheckout");
    try {
      const checkout = startCheckout(booking.id, "DEPOSIT").catch((e: unknown) => e);
      await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      // La cancelación termina aunque la pasarela no haya respondido (no hay candado retenido).
      const r = await cancelEvent({ eventId: event.id, reason: "Cancelación mientras se abre el pago (prueba)", notifyCustomer: false }, owner);
      expect(r.status).toBe("cancelled");
      const voided = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
      expect(voided).toMatchObject({ status: "FAILED", failureReason: "Evento cancelado.", checkoutUrl: null });
      expect(expire, "aún no hay sesión que expirar").not.toHaveBeenCalled();

      gate.resolve();
      expect(await checkout).toMatchObject({ code: "EVENT_CANCELLED" });
      const after = await prisma.payment.findUniqueOrThrow({ where: { id: voided.id } });
      expect(after).toMatchObject({ status: "FAILED", failureReason: "Evento cancelado.", checkoutUrl: null, providerCheckoutId: null });
      expect(sessions).toHaveLength(1);
      expect(expire, "la sesión que abrió la pasarela tarde se expira").toHaveBeenCalledWith(sessions[0]);
      expect(await prisma.analyticsEvent.count({ where: { eventId: event.id, type: "START_PAYMENT" } })).toBe(0);
      expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PENDING" } })).toBe(0);
    } finally {
      gate.resolve();
      create.mockRestore();
      expire.mockRestore();
    }
  });

  it("cancelación y checkout simultáneos nunca dejan un pago pendiente en una reserva cancelada", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const [checkout, cancel] = await Promise.allSettled([
      startCheckout(booking.id, "DEPOSIT"),
      cancelEvent({ eventId: event.id, reason: "Cancelación simultánea (prueba)", notifyCustomer: false }, owner),
    ]);
    expect(cancel.status).toBe("fulfilled");
    if (checkout.status === "rejected") expect(checkout.reason).toMatchObject({ code: "EVENT_CANCELLED" });
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: "PENDING" } })).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).cancelledAt).toBeInstanceOf(Date);
  });

  it("un cobro que la pasarela confirma tras cancelar queda PAID con «Reembolso requerido», sin reconfirmar ni avisar a la clienta", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    await cancelEvent({ eventId: event.id, reason: "Cancelación con sesión abierta", notifyCustomer: false }, owner);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    const hook = mockWebhook(payment, "payment.succeeded");
    const res = await postWebhook("mock", hook.body, hook.signature);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ applied: true, note: "cancelled_booking" });
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(paid.status).toBe("PAID");
    expect(paid.failureReason).toBeNull();
    expect(paid.notes).toMatch(/^Reembolso requerido: /);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CANCELLED");
    expect(hoisted.onEventConfirmed).not.toHaveBeenCalled();
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(0);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED", "WHATSAPP")).toBe(0);
    expect(await notificationCount(event.id, "BOOKING_CONFIRMED")).toBe(0);
    expect(await prisma.notificationLog.count({ where: { dedupeKey: `payment-received-team:${paymentId}` } })).toBe(0);
    const alert = await prisma.notificationLog.findUniqueOrThrow({ where: { dedupeKey: `cancelled-booking-payment:${paymentId}` } });
    expect(alert.type).toBe("GENERIC");
    expect(alert.body).toContain("ya estaba cancelado");
    expect(await prisma.auditLog.count({ where: { action: "payment.collected_after_cancellation", entityId: paymentId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "event.confirmed_by_payment", entityId: event.id } })).toBe(0);
    expect((await prisma.webhookEvent.findFirstOrThrow({ where: { externalId: String(hook.payload.id) } })).error).toBe("cancelled_booking");
    // El resultado que consulta la clienta lo marca por el propio pago (no sólo por el evento cancelado).
    const s = new URL(paymentResultRelativePath(paymentId), "http://x").searchParams.get("s")!;
    expect(await getPaymentStatusAction({ p: paymentId, s })).toMatchObject({
      ok: true,
      data: { status: "PAID", eventCancelled: true, collectedAfterCancellation: true, failureReason: null },
    });

    const dup = await postWebhook("mock", hook.body, hook.signature);
    expect(dup.json).toMatchObject({ duplicate: true });
    expect(await prisma.notificationLog.count({ where: { dedupeKey: `cancelled-booking-payment:${paymentId}` } })).toBe(1);

    // El equipo lo reembolsa desde el panel (el cobro cuenta como pagado para poder devolverlo).
    const refund = await refundPayment(owner, { paymentId, amountCents: paid.amountCents, reason: "Evento cancelado" });
    expect(refund.originalStatus).toBe("REFUNDED");
  });

  it("un pago manual no se registra si el evento se canceló (también dentro del candado)", async () => {
    const owner = await testOwner();
    const { event } = await makeFixture();
    const [manual, cancel] = await Promise.allSettled([
      recordManualPayment(owner, { eventId: event.id, amountCents: DEPOSIT, kind: "DEPOSIT", method: "CASH", paidAt: localDateKey() }),
      cancelEvent({ eventId: event.id, reason: "Cancelación simultánea (prueba)", notifyCustomer: false }, owner),
    ]);
    // O el pago se registra antes de la cancelación, o se rechaza por evento cancelado; nunca un cobro
    // manual «para reembolso» sobre una reserva ya cancelada.
    expect([manual.status, cancel.status]).toContain("fulfilled");
    if (manual.status === "rejected") expect(manual.reason).toMatchObject({ code: "EVENT_CANCELLED" });
    if (cancel.status === "rejected") expect(cancel.reason).toMatchObject({ code: "CONFLICT" });
    expect(await prisma.payment.count({ where: { notes: { startsWith: "Reembolso requerido" }, booking: { eventId: event.id } } })).toBe(0);
  });

  it("webhook de cobro que leyó el pago PENDING mientras se cancelaba: queda PAID con «Reembolso requerido» y aviso al equipo, nunca FAILED", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const hook = mockWebhook(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }), "payment.succeeded");

    // Orden forzado: la cancelación toma el candado de la reserva primero; el webhook lee el pago (PENDING)
    // antes de que la cancelación confirme y luego espera el mismo candado.
    const lock = await holdRowLock("Booking", booking.id);
    const cancel = cancelEvent({ eventId: event.id, reason: "Cancelación simultánea al cobro (prueba)", notifyCustomer: false }, owner);
    await lock.waitBlocked(1);
    const webhook = postWebhook("mock", hook.body, hook.signature);
    await lock.waitBlocked(2);
    await lock.release();
    const [cancelled, res] = await Promise.all([cancel, webhook]);

    expect(cancelled.status).toBe("cancelled");
    const cancelAudit = await prisma.auditLog.findFirstOrThrow({ where: { action: "event.cancelled", entityId: event.id } });
    expect(cancelAudit.after).toMatchObject({ voidedPayments: [paymentId] });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ applied: true, note: "cancelled_booking" });
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status, "el dinero cobrado nunca queda como «Evento cancelado.» FAILED").toBe("PAID");
    expect(after.failureReason).toBeNull();
    expect(after.providerPaymentId).toBe(hook.payload.providerPaymentId);
    expect(after.notes).toMatch(/^Reembolso requerido: /);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CANCELLED");
    expect(await prisma.auditLog.count({ where: { action: "payment.collected_after_cancellation", entityId: paymentId } })).toBe(1);
    expect(await prisma.notificationLog.count({ where: { dedupeKey: `cancelled-booking-payment:${paymentId}` } })).toBe(1);
    expect(await notificationCount(event.id, "PAYMENT_RECEIVED")).toBe(0);
    expect(hoisted.onEventConfirmed).not.toHaveBeenCalled();
    const record = await prisma.webhookEvent.findFirstOrThrow({ where: { externalId: String(hook.payload.id) } });
    expect(record.processedAt).toBeInstanceOf(Date);
    expect(record.error).toBe("cancelled_booking");
  });

  it("webhook de cobro que toma el candado antes que la cancelación: PAID + CONFIRMED y la cancelación falla por conflicto", async () => {
    const owner = await testOwner();
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const hook = mockWebhook(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }), "payment.succeeded");

    const lock = await holdRowLock("Booking", booking.id);
    const webhook = postWebhook("mock", hook.body, hook.signature);
    await lock.waitBlocked(1);
    const cancel = cancelEvent({ eventId: event.id, reason: "Cancelación simultánea al cobro (prueba)", notifyCustomer: false }, owner).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await lock.waitBlocked(2);
    await lock.release();
    const [res, cancelled] = await Promise.all([webhook, cancel]);

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ applied: true });
    expect(res.json.note).toBeUndefined();
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) expect(cancelled.error).toMatchObject({ code: "CONFLICT" });
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status).toBe("PAID");
    expect(after.notes).toBeNull();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).cancelledAt).toBeNull();
    expect(hoisted.onEventConfirmed).toHaveBeenCalledWith(event.id);
    expect(await prisma.auditLog.count({ where: { action: "event.cancelled", entityId: event.id } })).toBe(0);
  });

  it("un webhook de cobro que pierde una carrera (el pago cambió entre la lectura y la escritura) no se marca procesado: 500 y el reintento lo aplica", async () => {
    const { booking, event } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const hook = mockWebhook(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }), "payment.succeeded");

    // Un escritor que no toma el candado de la reserva cambia el pago mientras el webhook intenta aplicarlo.
    const lock = await holdRowLock("Payment", paymentId);
    const webhook = postWebhook("mock", hook.body, hook.signature);
    await lock.waitBlocked(1);
    await lock.release(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "FAILED", failedAt: new Date(), failureReason: "Rechazado por el banco (prueba)." },
      });
    });
    const res = await webhook;

    expect(res.status, "el proveedor debe reintentar").toBe(500);
    const record = await prisma.webhookEvent.findFirstOrThrow({ where: { externalId: String(hook.payload.id) } });
    expect(record.processedAt).toBeNull();
    expect(record.error).toContain("concurrent_update");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("FAILED");

    const retry = await postWebhook("mock", hook.body, hook.signature);
    expect(retry.status).toBe(200);
    expect(retry.json).toMatchObject({ applied: true });
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status).toBe("PAID");
    expect(after.failureReason).toBeNull();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    expect((await prisma.webhookEvent.findFirstOrThrow({ where: { externalId: String(hook.payload.id) } })).processedAt).toBeInstanceOf(Date);
  });
});

describe("Server Actions: tokens, RBAC y validación", () => {
  it("startCheckoutAction con token de cotización/portal devuelve la URL; token ajeno → 404 genérico", async () => {
    const { quote, event } = await makeFixture();
    const viaQuote = await startCheckoutAction({ token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" });
    expect(viaQuote.ok && viaQuote.data.url).toContain("/pago/mock/mock_cs_");
    expect(viaQuote.ok && viaQuote.data.url).toContain("from=quote");
    const viaPortal = await startCheckoutAction({ token: event.portalToken, tokenType: "portal", kind: "BALANCE" });
    expect(viaPortal.ok).toBe(true);
    const unknown = await startCheckoutAction({ token: generateToken(), tokenType: "portal", kind: "DEPOSIT" });
    expect(unknown).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const bad = await startCheckoutAction({ token: "x", tokenType: "portal", kind: "DEPOSIT" });
    expect(bad).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("getPaymentStatusAction exige la firma del enlace y sólo expone el estado", async () => {
    const { booking } = await makeFixture();
    const { paymentId } = await startCheckout(booking.id, "DEPOSIT");
    const url = new URL(paymentResultRelativePath(paymentId), "http://x");
    const ok = await getPaymentStatusAction({ p: paymentId, s: url.searchParams.get("s")! });
    expect(ok).toEqual({
      ok: true,
      data: { status: "PENDING", eventConfirmed: false, eventCancelled: false, collectedAfterCancellation: false, failureReason: null },
    });
    const forged = await getPaymentStatusAction({ p: paymentId, s: "A".repeat(32) });
    expect(forged).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("pago manual y reembolso: sin sesión → UNAUTHORIZED, STAFF → FORBIDDEN, OWNER → ok; Zod valida", async () => {
    const owner = await testOwner();
    const { event } = await makeFixture();
    const input = { eventId: event.id, amountCents: 150_000, kind: "DEPOSIT" as const, method: "TRANSFER" as const, paidAt: localDateKey() };

    expect(await recordManualPaymentAction(input)).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    hoisted.currentUser.value = { id: "staff-user", email: "s@x.test", name: "Staff", role: "STAFF" };
    expect(await recordManualPaymentAction(input)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await prisma.payment.count({ where: { booking: { eventId: event.id } } })).toBe(0);

    hoisted.currentUser.value = { id: owner.id, email: owner.email, name: owner.name, role: "OWNER" };
    const invalid = await recordManualPaymentAction({ ...input, amountCents: 10, paidAt: "01/10/2026" });
    expect(invalid).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    if (!invalid.ok) expect(Object.keys(invalid.fieldErrors ?? {})).toEqual(expect.arrayContaining(["amountCents", "paidAt"]));

    const recorded = await recordManualPaymentAction(input);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.data).toMatchObject({ eventId: event.id, confirmed: false });

    const noReason = await refundPaymentAction({ paymentId: recorded.data.paymentId, amountCents: 1_000, reason: "" });
    expect(noReason).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    hoisted.currentUser.value = { id: "staff-user", email: "s@x.test", name: "Staff", role: "STAFF" };
    expect(await refundPaymentAction({ paymentId: recorded.data.paymentId, amountCents: 1_000, reason: "Prueba" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    hoisted.currentUser.value = { id: owner.id, email: owner.email, name: owner.name, role: "OWNER" };
    const refunded = await refundPaymentAction({ paymentId: recorded.data.paymentId, amountCents: 1_000, reason: "Ajuste" });
    expect(refunded).toMatchObject({ ok: true, data: { originalStatus: "PARTIAL_REFUND", refundedCents: 1_000 } });
  });
});

describe("Consultas", () => {
  it("listRecentPayments filtra por estado y tipo", async () => {
    const owner = await testOwner();
    const { event } = await makeFixture();
    await recordManualPayment(owner, { eventId: event.id, amountCents: 1_000, kind: "DEPOSIT", method: "OTHER", paidAt: localDateKey() });
    const { items, total } = await listRecentPayments({ status: "PAID", kind: ["DEPOSIT"], limit: 5 });
    expect(total).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items.every((i) => i.status === "PAID" && i.kind === "DEPOSIT")).toBe(true);
    expect(items[0]?.booking.event.title).toBeTruthy();
  });
});
