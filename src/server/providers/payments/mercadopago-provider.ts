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
 * Mercado Pago (Checkout Pro) vía HTTP (sin SDK).
 * Webhooks: header `x-signature: ts=<ts>,v1=<hmac>` sobre el manifest
 *   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * y después se consulta GET /v1/payments/{id} (la notificación no trae el estado).
 * Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */

const MP_API = "https://api.mercadopago.com";

/** Header interno con el `data.id` de la query string de la notificación (lo fija la ruta del webhook). */
export const MP_QUERY_DATA_ID_HEADER = "x-ir-query-data-id";

type FetchLike = typeof fetch;

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret: string;
  appUrl: string;
  fetchImpl?: FetchLike;
};

/** Construye el manifest firmado por Mercado Pago (omite las partes ausentes, como indica la doc). */
export function mercadoPagoManifest(dataId: string | null, requestId: string | null, ts: string | null): string {
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  if (ts) manifest += `ts:${ts};`;
  return manifest;
}

/** Normaliza data.id: si es alfanumérico, Mercado Pago firma la versión en minúsculas. */
export function normalizeMpDataId(id: unknown): string | null {
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  if (typeof id === "string" && id.trim()) return /^[a-z0-9]+$/i.test(id) ? id.toLowerCase() : id;
  return null;
}

export function verifyMercadoPagoSignature(
  input: { dataId: string | null; requestId: string | null; signatureHeader: string | null },
  secret: string,
): { valid: boolean; ts?: string; reason?: string } {
  if (!input.signatureHeader) return { valid: false, reason: "missing_signature" };
  if (!secret) return { valid: false, reason: "missing_secret" };
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of input.signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  if (!ts || !v1 || !input.dataId) return { valid: false, reason: "malformed_signature" };
  const expected = createHmac("sha256", secret)
    .update(mercadoPagoManifest(input.dataId, input.requestId, ts))
    .digest("hex");
  return safeEqual(expected, v1) ? { valid: true, ts } : { valid: false, reason: "signature_mismatch" };
}

/** Firma una notificación como lo haría Mercado Pago (útil para pruebas). */
export function signMercadoPagoNotification(dataId: string, requestId: string | null, secret: string, ts = String(Date.now())): string {
  const v1 = createHmac("sha256", secret).update(mercadoPagoManifest(dataId, requestId, ts)).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

type MpPayment = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  fee_details?: Array<{ type?: string; amount?: number; fee_payer?: string }>;
};

const pesosToCents = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) : undefined;

const MP_FAILURE_REASONS: Record<string, string> = {
  cc_rejected_insufficient_amount: "Fondos insuficientes.",
  cc_rejected_bad_filled_security_code: "Código de seguridad incorrecto.",
  cc_rejected_bad_filled_date: "Fecha de vencimiento incorrecta.",
  cc_rejected_bad_filled_other: "Revisa los datos de la tarjeta.",
  cc_rejected_call_for_authorize: "El banco requiere autorizar el pago.",
  cc_rejected_card_disabled: "La tarjeta no está activa.",
  cc_rejected_high_risk: "El pago fue rechazado por seguridad.",
  cc_rejected_duplicated_payment: "Pago duplicado.",
  expired: "El pago expiró.",
};

/** Normaliza un pago de Mercado Pago al contrato agnóstico. */
export function mapMercadoPagoPayment(payment: MpPayment, notification: unknown): NormalizedPaymentEvent {
  const id = payment.id != null ? String(payment.id) : "unknown";
  const status = payment.status ?? "unknown";
  const refundedCents = pesosToCents(payment.transaction_amount_refunded) ?? 0;
  const amountCents = pesosToCents(payment.transaction_amount);
  const feeCents = (payment.fee_details ?? [])
    .filter((f) => !f.fee_payer || f.fee_payer === "collector")
    .reduce((sum, f) => sum + (pesosToCents(f.amount) ?? 0), 0);
  const base = {
    providerPaymentId: id,
    paymentId: payment.external_reference ?? undefined,
    amountCents,
    raw: { notification, payment },
  };
  if ((status === "approved" && refundedCents > 0) || status === "refunded" || status === "charged_back") {
    return {
      ...base,
      externalId: `${id}:${status === "approved" ? "partially_refunded" : status}:${refundedCents}`,
      type: "refund.succeeded",
      refundedCents: status === "approved" ? refundedCents : refundedCents || amountCents,
    };
  }
  if (status === "approved") {
    return { ...base, externalId: `${id}:${status}`, type: "payment.succeeded", feeCents: feeCents || undefined };
  }
  if (status === "rejected" || status === "cancelled") {
    return {
      ...base,
      externalId: `${id}:${status}`,
      type: "payment.failed",
      failureReason:
        MP_FAILURE_REASONS[payment.status_detail ?? ""] ??
        (status === "cancelled" ? "El pago fue cancelado." : "El pago fue rechazado."),
    };
  }
  return { ...base, externalId: `${id}:${status}`, type: "unknown" };
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;
  readonly isMock = false;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: MercadoPagoConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await this.fetchImpl(`${MP_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
    if (!res.ok) throw new Error(`MercadoPago ${method} ${path} ${res.status}: ${json.error ?? ""} ${json.message ?? ""}`.trim());
    return json;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const now = new Date();
    const expires = new Date(now.getTime() + 60 * 60 * 1000);
    const pref = await this.call<{ id: string; init_point?: string; sandbox_init_point?: string }>(
      "POST",
      "/checkout/preferences",
      {
        items: [
          {
            id: input.paymentId,
            title: input.description.slice(0, 250),
            quantity: 1,
            currency_id: input.currency,
            unit_price: input.amountCents / 100,
          },
        ],
        payer: {
          name: input.customer.name,
          // Un correo mal formado hace que Mercado Pago rechace la preferencia: sólo se envía si es válido.
          ...(input.customer.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email) ? { email: input.customer.email } : {}),
        },
        external_reference: input.paymentId,
        back_urls: { success: input.successUrl, pending: input.successUrl, failure: input.cancelUrl },
        auto_return: "approved",
        notification_url: `${this.config.appUrl.replace(/\/$/, "")}/api/webhooks/payments/mercadopago`,
        metadata: { ...input.metadata, payment_id: input.paymentId },
        statement_descriptor: "IVONNE ROSA",
        expires: true,
        expiration_date_from: now.toISOString(),
        expiration_date_to: expires.toISOString(),
      },
      input.idempotencyKey,
    );
    const sandbox = this.config.accessToken.startsWith("TEST-");
    const url = (sandbox ? pref.sandbox_init_point : pref.init_point) ?? pref.init_point ?? pref.sandbox_init_point;
    if (!pref.id || !url) throw new Error("MercadoPago: respuesta de preferencia incompleta");
    return { checkoutId: pref.id, url, expiresAt: expires };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    let body: { type?: string; action?: string; id?: number | string; data?: { id?: number | string } };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return { valid: false, reason: "invalid_json" };
    }
    // Mercado Pago firma el `data.id` de los query params de la notificación (la ruta lo reenvía en
    // MP_QUERY_DATA_ID_HEADER); el del cuerpo es equivalente y sirve de respaldo.
    const dataId = normalizeMpDataId(headers.get(MP_QUERY_DATA_ID_HEADER) || body.data?.id);
    const sig = verifyMercadoPagoSignature(
      { dataId, requestId: headers.get("x-request-id"), signatureHeader: headers.get("x-signature") },
      this.config.webhookSecret,
    );
    if (!sig.valid) return { valid: false, reason: sig.reason ?? "invalid" };
    const type = body.type ?? body.action?.split(".")[0] ?? "unknown";
    if (type !== "payment" || !dataId) {
      return {
        valid: true,
        event: { externalId: `${type}:${dataId ?? "na"}:${body.id ?? sig.ts}`, type: "unknown", raw: body },
      };
    }
    // La notificación sólo trae el id: el estado real se consulta a la API (fuente de verdad).
    const payment = await this.call<MpPayment>("GET", `/v1/payments/${encodeURIComponent(dataId)}`);
    return { valid: true, event: mapMercadoPagoPayment(payment, body) };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const res = await this.call<{ id: number | string; status?: string }>(
      "POST",
      `/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refunds`,
      { amount: input.amountCents / 100 },
      input.idempotencyKey,
    );
    const status: RefundResult["status"] =
      res.status === "approved" ? "succeeded" : res.status === "in_process" || res.status === "pending" ? "pending" : "failed";
    return { refundId: String(res.id), status };
  }

  /** PUT /checkout/preferences/{id}: adelanta la vigencia de la preferencia a "ahora" (ya no se puede pagar). */
  async expireCheckout(checkoutId: string): Promise<void> {
    await this.call<{ id: string }>("PUT", `/checkout/preferences/${encodeURIComponent(checkoutId)}`, {
      expires: true,
      expiration_date_to: new Date().toISOString(),
    });
  }
}
