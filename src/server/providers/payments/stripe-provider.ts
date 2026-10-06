import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/tokens";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  NormalizedPaymentEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookVerification,
} from "./types";

/**
 * Stripe vía HTTP (sin SDK). Checkout Sessions + webhooks firmados (Stripe-Signature).
 * Docs: https://docs.stripe.com/api/checkout/sessions/create · https://docs.stripe.com/webhooks#verify-manually
 */

const STRIPE_API = "https://api.stripe.com/v1";

type FetchLike = typeof fetch;

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  appUrl: string;
  fetchImpl?: FetchLike;
  /** Tolerancia de la firma (segundos). Stripe recomienda 300. */
  toleranceSeconds?: number;
};

/** Verifica el header `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>]` (HMAC-SHA256 de `${t}.${raw}`). */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): { valid: boolean; reason?: string } {
  if (!header) return { valid: false, reason: "missing_signature" };
  if (!secret) return { valid: false, reason: "missing_secret" };
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1" && value) signatures.push(value);
  }
  const t = Number(timestamp);
  if (!timestamp || !Number.isFinite(t) || signatures.length === 0) return { valid: false, reason: "malformed_signature" };
  if (Math.abs(now - t) > toleranceSeconds) return { valid: false, reason: "timestamp_out_of_tolerance" };
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return signatures.some((sig) => safeEqual(expected, sig)) ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}

/** Firma un payload como lo haría Stripe (útil para pruebas). */
export function signStripePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function int(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;
}
function idOf(v: unknown): string | undefined {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && "id" in v) return str((v as { id?: unknown }).id);
  return undefined;
}
function metadataPaymentId(obj: Record<string, unknown>): string | undefined {
  const md = obj.metadata;
  if (md && typeof md === "object") return str((md as Record<string, unknown>).paymentId);
  return undefined;
}

/** Normaliza un evento de Stripe al contrato agnóstico. */
export function mapStripeEvent(event: StripeEvent): NormalizedPaymentEvent {
  const externalId = str(event.id) ?? `stripe_unknown_${Date.now()}`;
  const obj = (event.data?.object ?? {}) as Record<string, unknown>;
  const base = { externalId, raw: event };
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const paid = obj.payment_status === "paid" || obj.payment_status === "no_payment_required";
      if (!paid) return { ...base, type: "unknown", checkoutId: str(obj.id) };
      return {
        ...base,
        type: "payment.succeeded",
        checkoutId: str(obj.id),
        paymentId: metadataPaymentId(obj) ?? str(obj.client_reference_id),
        providerPaymentId: idOf(obj.payment_intent),
        amountCents: int(obj.amount_total),
      };
    }
    case "checkout.session.async_payment_failed":
      return {
        ...base,
        type: "payment.failed",
        checkoutId: str(obj.id),
        paymentId: metadataPaymentId(obj) ?? str(obj.client_reference_id),
        providerPaymentId: idOf(obj.payment_intent),
        failureReason: "El pago no pudo completarse.",
      };
    case "checkout.session.expired":
      return {
        ...base,
        type: "payment.failed",
        checkoutId: str(obj.id),
        paymentId: metadataPaymentId(obj) ?? str(obj.client_reference_id),
        failureReason: "La sesión de pago expiró.",
      };
    case "charge.refunded":
      return {
        ...base,
        type: "refund.succeeded",
        providerPaymentId: idOf(obj.payment_intent),
        paymentId: metadataPaymentId(obj),
        amountCents: int(obj.amount),
        refundedCents: int(obj.amount_refunded),
      };
    default:
      return { ...base, type: "unknown" };
  }
}

/** application/x-www-form-urlencoded con la sintaxis de corchetes de Stripe. */
export function toStripeForm(params: Record<string, string | number | undefined | null>): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    body.append(k, String(v));
  }
  return body.toString();
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly isMock = false;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: StripeConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, form: string, idempotencyKey?: string): Promise<T> {
    const res = await this.fetchImpl(`${STRIPE_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: form,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; type?: string } };
    if (!res.ok) {
      throw new Error(`Stripe ${path} ${res.status}: ${json.error?.type ?? ""} ${json.error?.message ?? ""}`.trim());
    }
    return json;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // Stripe: entre 30 min y 24 h
    const params: Record<string, string | number | undefined> = {
      mode: "payment",
      locale: "es-419",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.paymentId,
      customer_email: input.customer.email && /.+@.+\..+/.test(input.customer.email) ? input.customer.email : undefined,
      expires_at: expiresAt,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "mxn",
      "line_items[0][price_data][unit_amount]": input.amountCents,
      "line_items[0][price_data][product_data][name]": input.description.slice(0, 250),
      "metadata[paymentId]": input.paymentId,
      "payment_intent_data[metadata][paymentId]": input.paymentId,
      "payment_intent_data[description]": input.description.slice(0, 250),
    };
    for (const [k, v] of Object.entries(input.metadata)) {
      if (k === "paymentId") continue;
      params[`metadata[${k}]`] = v.slice(0, 500);
    }
    const session = await this.request<{ id: string; url: string; expires_at?: number }>(
      "/checkout/sessions",
      toStripeForm(params),
      input.idempotencyKey,
    );
    if (!session.id || !session.url) throw new Error("Stripe: respuesta de checkout incompleta");
    return {
      checkoutId: session.id,
      url: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : new Date(expiresAt * 1000),
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    const sig = verifyStripeSignature(
      rawBody,
      headers.get("stripe-signature"),
      this.config.webhookSecret,
      this.config.toleranceSeconds ?? 300,
    );
    if (!sig.valid) return { valid: false, reason: sig.reason ?? "invalid" };
    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return { valid: false, reason: "invalid_json" };
    }
    if (!event.id || !event.type) return { valid: false, reason: "invalid_event" };
    return { valid: true, event: mapStripeEvent(event) };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.request<{ id: string; status?: string }>(
      "/refunds",
      toStripeForm({
        payment_intent: input.providerPaymentId,
        amount: input.amountCents,
        reason: "requested_by_customer",
        "metadata[reason]": input.reason?.slice(0, 500),
      }),
      input.idempotencyKey,
    );
    const status: RefundResult["status"] =
      refund.status === "succeeded" ? "succeeded" : refund.status === "pending" || refund.status === "requires_action" ? "pending" : "failed";
    return { refundId: refund.id, status };
  }

  /** POST /v1/checkout/sessions/{id}/expire: la sesión deja de aceptar pagos (sólo si sigue abierta). */
  async expireCheckout(checkoutId: string): Promise<void> {
    await this.request<{ id: string; status?: string }>(`/checkout/sessions/${encodeURIComponent(checkoutId)}/expire`, "");
  }
}
