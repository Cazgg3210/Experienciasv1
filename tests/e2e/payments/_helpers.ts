/**
 * Helpers del paquete 2 (Venta pública) — pagos con el proveedor MOCK.
 *
 * - Firma de webhooks igual que el proveedor simulado (src/server/providers/payments/mock-signature.ts):
 *   header `x-mock-signature: t=<unix>,v1=<hmac_sha256(secret, "t.body")>`, con PAYMENT_WEBHOOK_SECRET del .env.
 * - Enlace firmado de /pago/resultado (src/features/payments/domain/result-signature.ts).
 * Los secretos sólo se leen del entorno local de E2E y nunca se imprimen.
 */
import { createHmac, randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { callAction, okData } from "../configurator/_helpers";

function webhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET || "dev-webhook-secret-change-me";
}

export function signMockBody(body: string, timestamp = Math.floor(Date.now() / 1000), secret = webhookSecret()): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export type MockWebhook = {
  id: string;
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded";
  checkoutId: string;
  paymentId: string;
  providerPaymentId: string;
  amountCents: number;
  feeCents?: number;
  refundedCents?: number;
  failureReason?: string;
  createdAt: string;
};

export function mockEvent(
  payment: { id: string; providerCheckoutId: string | null; amountCents: number },
  over: Partial<MockWebhook> = {},
): MockWebhook {
  const t = randomBytes(9).toString("base64url");
  return {
    id: `evt_e2e_${t}`,
    type: "payment.succeeded",
    checkoutId: payment.providerCheckoutId ?? `mock_cs_e2e_${t}`,
    paymentId: payment.id,
    providerPaymentId: `mock_pi_e2e_${t}`,
    amountCents: payment.amountCents,
    feeCents: 1000,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

/** POST al webhook del proveedor mock con firma válida (o la que se indique). */
export async function postWebhook(
  request: APIRequestContext,
  payload: unknown,
  opts: { signature?: string | null; provider?: string } = {},
) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const sig = opts.signature === undefined ? signMockBody(body) : opts.signature;
  if (sig) headers["x-mock-signature"] = sig;
  const res = await request.post(`/api/webhooks/payments/${opts.provider ?? "mock"}`, {
    headers,
    data: body,
    failOnStatusCode: false,
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status(), json };
}

function resultSecret(): string {
  return `ir-pago-resultado:${process.env.AUTH_SECRET ?? webhookSecret()}`;
}

export function signResult(paymentId: string): string {
  return createHmac("sha256", resultSecret()).update(`pago-resultado:${paymentId}`).digest("base64url").slice(0, 32);
}

export function resultPath(paymentId: string): string {
  return `/pago/resultado?p=${encodeURIComponent(paymentId)}&s=${signResult(paymentId)}`;
}

/**
 * startCheckoutAction por HTTP. Se invoca en la ruta de la cotización (que importa la acción):
 * así se simula exactamente lo que hace el botón "Pagar anticipo".
 */
export function startCheckoutCall(
  request: APIRequestContext,
  baseURL: string,
  input: { token: string; tokenType: "quote" | "portal"; kind: "DEPOSIT" | "BALANCE" | "FULL" },
  routePath = input.tokenType === "quote" ? `/cotizacion/${input.token}` : `/mi-evento/${input.token}`,
) {
  return callAction<{ url: string }>(request, baseURL, "startCheckoutAction", input, routePath);
}

export function mockCheckoutCall(
  request: APIRequestContext,
  baseURL: string,
  input: { checkoutId: string; outcome: "success" | "failure" | "cancel"; from?: "quote" | "portal" },
  routePath = `/pago/mock/${input.checkoutId}`,
) {
  return callAction<{ redirectTo: string }>(request, baseURL, "mockCheckoutAction", input, routePath);
}

export function paymentStatusCall(request: APIRequestContext, baseURL: string, routePath: string, p: string, s: string) {
  return callAction<{
    status: string;
    eventConfirmed: boolean;
    eventCancelled: boolean;
    collectedAfterCancellation: boolean;
    failureReason: string | null;
  }>(
    request,
    baseURL,
    "getPaymentStatusAction",
    { p, s },
    routePath,
  );
}

/** Inicia el checkout del anticipo de una cotización aceptada y devuelve el Payment PENDING creado. */
export async function startDepositCheckout(db: PrismaClient, request: APIRequestContext, baseURL: string, quoteToken: string) {
  const { url } = okData(await startCheckoutCall(request, baseURL, { token: quoteToken, tokenType: "quote", kind: "DEPOSIT" }));
  const checkoutId = new URL(url).pathname.split("/").pop()!;
  const payment = await db.payment.findFirstOrThrow({ where: { provider: "mock", providerCheckoutId: checkoutId } });
  return { url, checkoutId, payment };
}
