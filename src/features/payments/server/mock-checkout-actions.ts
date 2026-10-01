"use server";

import { appUrl, env } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateToken } from "@/lib/tokens";
import { publicAction } from "@/server/action";
import { getPaymentProvider } from "@/server/providers";
import type { MockWebhookPayload } from "@/server/providers/payments/mock-provider";
import { signMockPayload } from "@/server/providers/payments/mock-signature";
import { getSettings } from "@/features/settings/server/settings-service";
import { checkoutLinkState, estimateFeeCents } from "../domain/amounts";
import { mockCheckoutSchema } from "../schemas";
import { paymentResultRelativePath, portalPath, quotePath } from "./payment-links";
import { getMockCheckout } from "./queries";
import { handlePaymentWebhook } from "./webhook-service";

/**
 * Envía el webhook firmado por HTTP real (ejercita la ruta /api/webhooks/payments/mock).
 * Si la red falla (p. ej. APP_URL apunta a otro puerto), procesa el mismo cuerpo directamente.
 */
async function deliverMockWebhook(body: string, signature: string): Promise<void> {
  const base = (process.env.INTERNAL_APP_URL || appUrl()).replace(/\/$/, "");
  const processDirectly = async () => {
    const result = await handlePaymentWebhook(
      "mock",
      body,
      new Headers({ "content-type": "application/json", "x-mock-signature": signature }),
    );
    if (result.status !== 200) logger.warn("payments.mock_webhook_fallback_status", { status: result.status });
  };
  try {
    const res = await fetch(`${base}/api/webhooks/payments/mock`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-signature": signature },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      logger.warn("payments.mock_webhook_http_status", { status: res.status, base });
      // 400 = firma rechazada (no tiene caso reintentar). Otro error (proxy, 404, 5xx): procesar directo;
      // es seguro porque el webhook es idempotente.
      if (res.status !== 400) await processDirectly();
    }
  } catch (error) {
    logger.warn("payments.mock_webhook_http_failed_fallback", { error, base });
    await processDirectly();
  }
}

/**
 * Acción del checkout simulado: construye un MockWebhookPayload firmado (como haría un
 * proveedor real) y lo envía al webhook. Sólo disponible con el proveedor mock.
 */
export const mockCheckoutAction = publicAction(
  { name: "payments.mock_checkout", schema: mockCheckoutSchema, rateLimit: { limit: 20, windowMs: 60_000 } },
  async (input): Promise<{ redirectTo: string }> => {
    if (!getPaymentProvider().isMock) throw new NotFoundError("Checkout no disponible.");
    const payment = await getMockCheckout(input.checkoutId);
    if (!payment) throw new NotFoundError("No encontramos este checkout.");

    if (input.outcome === "cancel") {
      const quoteToken = payment.booking.quote?.publicToken;
      return {
        redirectTo:
          input.from === "quote" && quoteToken ? quotePath(quoteToken) : portalPath(payment.booking.event.portalToken),
      };
    }

    const resultPath = paymentResultRelativePath(payment.id);
    const state = checkoutLinkState(payment, payment.booking, payment.booking.payments);
    if (state === "processed") return { redirectTo: resultPath };
    if (state === "expired") {
      throw new AppError("Este enlace de pago expiró. Vuelve a tu portal para generar uno nuevo.", "CHECKOUT_EXPIRED", 410);
    }
    if (state === "stale") {
      throw new AppError(
        "Este enlace de pago ya no está vigente porque tu saldo cambió. Vuelve a tu portal para generar uno nuevo.",
        "CHECKOUT_STALE",
        409,
      );
    }

    const token = generateToken(12);
    const succeeded = input.outcome === "success";
    const pricing = await getSettings("pricing");
    const payload: MockWebhookPayload = {
      id: `evt_mock_${token}`,
      type: succeeded ? "payment.succeeded" : "payment.failed",
      checkoutId: input.checkoutId,
      paymentId: payment.id,
      providerPaymentId: `mock_pi_${token}`,
      amountCents: payment.amountCents,
      ...(succeeded
        ? { feeCents: estimateFeeCents(payment.amountCents, pricing) }
        : { failureReason: "Tu banco rechazó el cargo (simulación)." }),
      createdAt: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    await deliverMockWebhook(body, signMockPayload(body, env().PAYMENT_WEBHOOK_SECRET));
    return { redirectTo: resultPath };
  },
);
