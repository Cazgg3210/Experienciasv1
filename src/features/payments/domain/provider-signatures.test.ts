import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  StripePaymentProvider,
  mapStripeEvent,
  signStripePayload,
  verifyStripeSignature,
} from "@/server/providers/payments/stripe-provider";
import {
  MP_QUERY_DATA_ID_HEADER,
  MercadoPagoPaymentProvider,
  mapMercadoPagoPayment,
  mercadoPagoManifest,
  normalizeMpDataId,
  signMercadoPagoNotification,
  verifyMercadoPagoSignature,
} from "@/server/providers/payments/mercadopago-provider";
import { createRealPaymentProvider } from "@/server/providers/payments/real";
import { signMockPayload, verifyMockSignature } from "@/server/providers/payments/mock-signature";

const STRIPE_SECRET = "whsec_test_123456";
const MP_SECRET = "mp-webhook-secret-test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Stripe — verificación de firma", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = 1_790_000_000;

  it("acepta una firma válida dentro de la tolerancia", () => {
    const header = signStripePayload(body, STRIPE_SECRET, now - 10);
    expect(verifyStripeSignature(body, header, STRIPE_SECRET, 300, now)).toEqual({ valid: true });
  });
  it("acepta si alguno de varios v1 coincide (rotación de secreto)", () => {
    const good = signStripePayload(body, STRIPE_SECRET, now).split(",")[1]!;
    const header = `t=${now},v1=${"0".repeat(64)},${good},v0=abc`;
    expect(verifyStripeSignature(body, header, STRIPE_SECRET, 300, now).valid).toBe(true);
  });
  it("rechaza cuerpo alterado, secreto incorrecto, timestamp viejo o header mal formado", () => {
    const header = signStripePayload(body, STRIPE_SECRET, now);
    expect(verifyStripeSignature(`${body} `, header, STRIPE_SECRET, 300, now)).toEqual({ valid: false, reason: "signature_mismatch" });
    expect(verifyStripeSignature(body, header, "whsec_otro", 300, now).valid).toBe(false);
    expect(verifyStripeSignature(body, header, STRIPE_SECRET, 300, now + 301)).toEqual({
      valid: false,
      reason: "timestamp_out_of_tolerance",
    });
    expect(verifyStripeSignature(body, null, STRIPE_SECRET, 300, now).reason).toBe("missing_signature");
    expect(verifyStripeSignature(body, "garbage", STRIPE_SECRET, 300, now).reason).toBe("malformed_signature");
    expect(verifyStripeSignature(body, `t=${now}`, STRIPE_SECRET, 300, now).reason).toBe("malformed_signature");
  });
  it("la firma es HMAC-SHA256 de `${t}.${raw}`", () => {
    const expected = createHmac("sha256", STRIPE_SECRET).update(`${now}.${body}`).digest("hex");
    expect(signStripePayload(body, STRIPE_SECRET, now)).toBe(`t=${now},v1=${expected}`);
  });
});

describe("Stripe — normalización de eventos", () => {
  it("checkout.session.completed pagado → payment.succeeded", () => {
    const e = mapStripeEvent({
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_status: "paid",
          amount_total: 500_000,
          payment_intent: "pi_123",
          client_reference_id: "pay_fallback",
          metadata: { paymentId: "cmpayment000000000000001" },
        },
      },
    });
    expect(e).toMatchObject({
      externalId: "evt_paid",
      type: "payment.succeeded",
      checkoutId: "cs_test_1",
      paymentId: "cmpayment000000000000001",
      providerPaymentId: "pi_123",
      amountCents: 500_000,
    });
  });
  it("sesión completada sin pagar (OXXO pendiente) → unknown", () => {
    expect(
      mapStripeEvent({ id: "e", type: "checkout.session.completed", data: { object: { id: "cs", payment_status: "unpaid" } } }).type,
    ).toBe("unknown");
  });
  it("async_payment_failed / expired → payment.failed; charge.refunded → refund.succeeded", () => {
    expect(mapStripeEvent({ id: "e1", type: "checkout.session.async_payment_failed", data: { object: { id: "cs" } } })).toMatchObject({
      type: "payment.failed",
      checkoutId: "cs",
    });
    expect(mapStripeEvent({ id: "e2", type: "checkout.session.expired", data: { object: { id: "cs" } } })).toMatchObject({
      type: "payment.failed",
      failureReason: "La sesión de pago expiró.",
    });
    expect(
      mapStripeEvent({
        id: "e3",
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_9", amount: 500_000, amount_refunded: 200_000 } },
      }),
    ).toMatchObject({ type: "refund.succeeded", providerPaymentId: "pi_9", refundedCents: 200_000, amountCents: 500_000 });
    expect(mapStripeEvent({ id: "e4", type: "customer.created" }).type).toBe("unknown");
  });
});

describe("Stripe — llamadas HTTP (sin SDK)", () => {
  it("createCheckout envía form-urlencoded con monto, metadata e Idempotency-Key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc", expires_at: 1_790_003_600 }));
    const provider = new StripePaymentProvider({
      secretKey: "sk_test_x",
      webhookSecret: STRIPE_SECRET,
      appUrl: "https://ivonne.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const session = await provider.createCheckout({
      paymentId: "cmpay1",
      amountCents: 512_345,
      currency: "MXN",
      description: "Anticipo · Brunch de Ana",
      customer: { name: "Ana", email: "ana@example.com" },
      successUrl: "https://ivonne.test/pago/resultado?p=cmpay1&s=abc",
      cancelUrl: "https://ivonne.test/mi-evento/tok",
      idempotencyKey: "bk:DEPOSIT:xyz",
      metadata: { paymentId: "cmpay1", bookingId: "bk" },
    });
    expect(session).toMatchObject({ checkoutId: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk_test_x");
    expect(headers["Idempotency-Key"]).toBe("bk:DEPOSIT:xyz");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(init.body as string);
    expect(form.get("mode")).toBe("payment");
    expect(form.get("line_items[0][price_data][currency]")).toBe("mxn");
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("512345");
    expect(form.get("metadata[paymentId]")).toBe("cmpay1");
    expect(form.get("metadata[bookingId]")).toBe("bk");
    expect(form.get("client_reference_id")).toBe("cmpay1");
    expect(form.get("success_url")).toBe("https://ivonne.test/pago/resultado?p=cmpay1&s=abc");
    expect(form.get("customer_email")).toBe("ana@example.com");
  });
  it("createCheckout lanza si Stripe responde error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { type: "invalid_request_error", message: "bad" } }, 400));
    const provider = new StripePaymentProvider({ secretKey: "sk", webhookSecret: "w", appUrl: "x", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(
      provider.createCheckout({
        paymentId: "p",
        amountCents: 100,
        currency: "MXN",
        description: "d",
        customer: { name: "n" },
        successUrl: "s",
        cancelUrl: "c",
        idempotencyKey: "k",
        metadata: {},
      }),
    ).rejects.toThrow(/Stripe/);
  });
  it("refund usa /v1/refunds con payment_intent y amount", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "re_1", status: "succeeded" }));
    const provider = new StripePaymentProvider({ secretKey: "sk", webhookSecret: "w", appUrl: "x", fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await provider.refund({ providerPaymentId: "pi_1", amountCents: 1_000, idempotencyKey: "rk", reason: "motivo" });
    expect(res).toEqual({ refundId: "re_1", status: "succeeded" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/refunds");
    const form = new URLSearchParams(init.body as string);
    expect(form.get("payment_intent")).toBe("pi_1");
    expect(form.get("amount")).toBe("1000");
  });
  it("expireCheckout expira la sesión con POST /v1/checkout/sessions/{id}/expire y lanza si Stripe la rechaza", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "cs_test_abc", status: "expired" }));
    const provider = new StripePaymentProvider({ secretKey: "sk_x", webhookSecret: "w", appUrl: "x", fetchImpl: fetchImpl as unknown as typeof fetch });
    await provider.expireCheckout("cs_test_abc");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions/cs_test_abc/expire");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_x");
    const rejected = vi.fn(async () => jsonResponse({ error: { type: "invalid_request_error", message: "Only open sessions can be expired" } }, 400));
    const p2 = new StripePaymentProvider({ secretKey: "sk", webhookSecret: "w", appUrl: "x", fetchImpl: rejected as unknown as typeof fetch });
    await expect(p2.expireCheckout("cs_done")).rejects.toThrow(/Stripe .*expire 400/);
  });
  it("verifyWebhook valida firma y normaliza", async () => {
    const provider = new StripePaymentProvider({ secretKey: "sk", webhookSecret: STRIPE_SECRET, appUrl: "x" });
    const raw = JSON.stringify({
      id: "evt_ok",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid", amount_total: 100, metadata: { paymentId: "cmx" } } },
    });
    const ok = await provider.verifyWebhook(raw, new Headers({ "stripe-signature": signStripePayload(raw, STRIPE_SECRET) }));
    expect(ok.valid && ok.event.type).toBe("payment.succeeded");
    const bad = await provider.verifyWebhook(raw, new Headers({ "stripe-signature": signStripePayload(raw, "whsec_bad") }));
    expect(bad.valid).toBe(false);
  });
});

describe("Mercado Pago — verificación de firma", () => {
  it("manifest omite partes ausentes", () => {
    expect(mercadoPagoManifest("123", "req-1", "1700")).toBe("id:123;request-id:req-1;ts:1700;");
    expect(mercadoPagoManifest("123", null, "1700")).toBe("id:123;ts:1700;");
  });
  it("data.id alfanumérico se normaliza a minúsculas", () => {
    expect(normalizeMpDataId("ABC123")).toBe("abc123");
    expect(normalizeMpDataId(987654)).toBe("987654");
    expect(normalizeMpDataId(undefined)).toBeNull();
  });
  it("acepta firma válida y rechaza alteraciones", () => {
    const header = signMercadoPagoNotification("123456", "req-abc", MP_SECRET, "1704908010");
    expect(verifyMercadoPagoSignature({ dataId: "123456", requestId: "req-abc", signatureHeader: header }, MP_SECRET)).toEqual({
      valid: true,
      ts: "1704908010",
    });
    expect(verifyMercadoPagoSignature({ dataId: "123457", requestId: "req-abc", signatureHeader: header }, MP_SECRET).valid).toBe(false);
    expect(verifyMercadoPagoSignature({ dataId: "123456", requestId: "req-xyz", signatureHeader: header }, MP_SECRET).valid).toBe(false);
    expect(verifyMercadoPagoSignature({ dataId: "123456", requestId: "req-abc", signatureHeader: header }, "otro").valid).toBe(false);
    expect(verifyMercadoPagoSignature({ dataId: "123456", requestId: null, signatureHeader: null }, MP_SECRET).reason).toBe(
      "missing_signature",
    );
    expect(verifyMercadoPagoSignature({ dataId: "123456", requestId: null, signatureHeader: "v1=abc" }, MP_SECRET).reason).toBe(
      "malformed_signature",
    );
  });
});

describe("Mercado Pago — normalización de pagos", () => {
  it("approved → payment.succeeded con comisión en centavos", () => {
    const e = mapMercadoPagoPayment(
      {
        id: 111,
        status: "approved",
        external_reference: "cmpay1",
        transaction_amount: 5123.45,
        fee_details: [{ type: "mercadopago_fee", amount: 190.12, fee_payer: "collector" }],
      },
      {},
    );
    expect(e).toMatchObject({
      externalId: "111:approved",
      type: "payment.succeeded",
      paymentId: "cmpay1",
      providerPaymentId: "111",
      amountCents: 512_345,
      feeCents: 19_012,
    });
  });
  it("rejected / cancelled → payment.failed con motivo en español", () => {
    expect(
      mapMercadoPagoPayment({ id: 2, status: "rejected", status_detail: "cc_rejected_insufficient_amount", external_reference: "x" }, {}),
    ).toMatchObject({ type: "payment.failed", externalId: "2:rejected", failureReason: "Fondos insuficientes." });
    expect(mapMercadoPagoPayment({ id: 3, status: "cancelled" }, {}).type).toBe("payment.failed");
  });
  it("refunded y reembolso parcial → refund.succeeded", () => {
    expect(
      mapMercadoPagoPayment({ id: 4, status: "refunded", transaction_amount: 100, transaction_amount_refunded: 100 }, {}),
    ).toMatchObject({ type: "refund.succeeded", refundedCents: 10_000, externalId: "4:refunded:10000" });
    expect(
      mapMercadoPagoPayment({ id: 5, status: "approved", transaction_amount: 100, transaction_amount_refunded: 40 }, {}),
    ).toMatchObject({ type: "refund.succeeded", refundedCents: 4_000, externalId: "5:partially_refunded:4000" });
  });
  it("pending / in_process → unknown", () => {
    expect(mapMercadoPagoPayment({ id: 6, status: "in_process" }, {}).type).toBe("unknown");
  });
});

describe("Mercado Pago — llamadas HTTP (sin SDK)", () => {
  it("verifyWebhook valida la firma y consulta el pago en la API", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: 999, status: "approved", external_reference: "cmpay9", transaction_amount: 1500 }),
    );
    const provider = new MercadoPagoPaymentProvider({
      accessToken: "APP_USR-x",
      webhookSecret: MP_SECRET,
      appUrl: "https://ivonne.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const raw = JSON.stringify({ action: "payment.updated", type: "payment", data: { id: "999" }, id: 1 });
    const headers = new Headers({
      "x-signature": signMercadoPagoNotification("999", "req-1", MP_SECRET),
      "x-request-id": "req-1",
    });
    const res = await provider.verifyWebhook(raw, headers);
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.event).toMatchObject({ type: "payment.succeeded", paymentId: "cmpay9", amountCents: 150_000 });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.mercadopago.com/v1/payments/999");

    const invalid = await provider.verifyWebhook(raw, new Headers({ "x-signature": "ts=1,v1=deadbeef", "x-request-id": "req-1" }));
    expect(invalid.valid).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // sin firma válida no se consulta la API
  });
  it("usa el data.id de la query string (lo firmado por MP) cuando la ruta lo reenvía", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: 4242, status: "rejected", status_detail: "cc_rejected_high_risk", external_reference: "cmpay7" }),
    );
    const provider = new MercadoPagoPaymentProvider({
      accessToken: "APP_USR-x",
      webhookSecret: MP_SECRET,
      appUrl: "https://ivonne.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // El cuerpo trae otro id: la firma y la consulta usan el de la query (header interno de la ruta).
    const raw = JSON.stringify({ type: "payment", data: { id: "1" } });
    const headers = new Headers({
      "x-signature": signMercadoPagoNotification("4242", "req-9", MP_SECRET),
      "x-request-id": "req-9",
      [MP_QUERY_DATA_ID_HEADER]: "4242",
    });
    const res = await provider.verifyWebhook(raw, headers);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.event).toMatchObject({ type: "payment.failed", paymentId: "cmpay7", externalId: "4242:rejected" });
      expect(res.event.failureReason).toBe("El pago fue rechazado por seguridad.");
    }
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.mercadopago.com/v1/payments/4242");

    // Sin el header, el id del cuerpo ("1") no coincide con lo firmado → inválido
    const noQuery = new Headers({ "x-signature": headers.get("x-signature")!, "x-request-id": "req-9" });
    expect((await provider.verifyWebhook(raw, noQuery)).valid).toBe(false);
  });
  it("createCheckout omite un correo mal formado (MP rechazaría la preferencia)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "pref_2", init_point: "https://mp/init" }));
    const provider = new MercadoPagoPaymentProvider({ accessToken: "APP_USR-1", webhookSecret: MP_SECRET, appUrl: "https://x.test", fetchImpl: fetchImpl as unknown as typeof fetch });
    await provider.createCheckout({
      paymentId: "cmpay2",
      amountCents: 10_000,
      currency: "MXN",
      description: "Anticipo",
      customer: { name: "Ana", email: "ana@@correo" },
      successUrl: "https://x.test/ok",
      cancelUrl: "https://x.test/cancel",
      idempotencyKey: "ik2",
      metadata: {},
    });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.payer).toEqual({ name: "Ana" });
  });
  it("notificaciones que no son de pago → unknown sin llamar a la API", async () => {
    const fetchImpl = vi.fn();
    const provider = new MercadoPagoPaymentProvider({ accessToken: "t", webhookSecret: MP_SECRET, appUrl: "x", fetchImpl: fetchImpl as unknown as typeof fetch });
    const raw = JSON.stringify({ type: "merchant_order", data: { id: "77" } });
    const res = await provider.verifyWebhook(raw, new Headers({ "x-signature": signMercadoPagoNotification("77", null, MP_SECRET) }));
    expect(res.valid && res.event.type).toBe("unknown");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("createCheckout crea preferencia con external_reference, back_urls y notification_url", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "pref_1", init_point: "https://mp/init", sandbox_init_point: "https://mp/sandbox" }));
    const provider = new MercadoPagoPaymentProvider({
      accessToken: "TEST-123",
      webhookSecret: MP_SECRET,
      appUrl: "https://ivonne.test/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const session = await provider.createCheckout({
      paymentId: "cmpay1",
      amountCents: 250_050,
      currency: "MXN",
      description: "Saldo · Brunch",
      customer: { name: "Ana", email: "ana@example.com" },
      successUrl: "https://ivonne.test/pago/resultado?p=cmpay1&s=x",
      cancelUrl: "https://ivonne.test/mi-evento/tok",
      idempotencyKey: "ik",
      metadata: { paymentId: "cmpay1" },
    });
    expect(session).toMatchObject({ checkoutId: "pref_1", url: "https://mp/sandbox" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect((init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("ik");
    const body = JSON.parse(init.body as string);
    expect(body.external_reference).toBe("cmpay1");
    expect(body.items[0]).toMatchObject({ unit_price: 2500.5, currency_id: "MXN", quantity: 1 });
    expect(body.notification_url).toBe("https://ivonne.test/api/webhooks/payments/mercadopago");
    expect(body.back_urls.success).toBe("https://ivonne.test/pago/resultado?p=cmpay1&s=x");
    expect(body.auto_return).toBe("approved");
  });
  it("expireCheckout adelanta la expiración de la preferencia con PUT /checkout/preferences/{id}", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-06T15:00:00Z") });
    try {
      const fetchImpl = vi.fn(async () => jsonResponse({ id: "pref_1" }));
      const provider = new MercadoPagoPaymentProvider({ accessToken: "APP_USR-1", webhookSecret: MP_SECRET, appUrl: "x", fetchImpl: fetchImpl as unknown as typeof fetch });
      await provider.expireCheckout("pref_1");
      const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://api.mercadopago.com/checkout/preferences/pref_1");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body as string)).toEqual({ expires: true, expiration_date_to: "2026-10-06T15:00:00.000Z" });
      const rejected = vi.fn(async () => jsonResponse({ error: "not_found", message: "preference not found" }, 404));
      const p2 = new MercadoPagoPaymentProvider({ accessToken: "t", webhookSecret: "w", appUrl: "x", fetchImpl: rejected as unknown as typeof fetch });
      await expect(p2.expireCheckout("pref_x")).rejects.toThrow(/MercadoPago PUT/);
    } finally {
      vi.useRealTimers();
    }
  });
  it("refund usa /v1/payments/{id}/refunds con monto en pesos", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 55, status: "approved" }));
    const provider = new MercadoPagoPaymentProvider({ accessToken: "t", webhookSecret: "w", appUrl: "x", fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await provider.refund({ providerPaymentId: "999", amountCents: 12_550, idempotencyKey: "rk" });
    expect(res).toEqual({ refundId: "55", status: "succeeded" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments/999/refunds");
    expect(JSON.parse(init.body as string)).toEqual({ amount: 125.5 });
  });
});

describe("Registro de proveedores reales", () => {
  it("crea Stripe / Mercado Pago y devuelve null sin llave", () => {
    expect(createRealPaymentProvider("stripe", "sk_test", "whsec", "https://x")?.name).toBe("stripe");
    expect(createRealPaymentProvider("mercadopago", "APP_USR", "sec", "https://x")?.name).toBe("mercadopago");
    expect(createRealPaymentProvider("stripe", "", "whsec", "https://x")).toBeNull();
  });
});

describe("Mock — firma compatible", () => {
  it("firma y verifica", () => {
    const body = JSON.stringify({ id: "evt_mock_1" });
    expect(verifyMockSignature(body, signMockPayload(body, "s"), "s").valid).toBe(true);
    expect(verifyMockSignature(body, signMockPayload(body, "s"), "t").valid).toBe(false);
  });
});
