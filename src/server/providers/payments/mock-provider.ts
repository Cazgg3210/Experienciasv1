import { generateToken } from "@/lib/tokens";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  NormalizedPaymentEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookVerification,
} from "./types";
import { verifyMockSignature } from "./mock-signature";

/** Payload que envía el checkout simulado a /api/webhooks/payments/mock */
export type MockWebhookPayload = {
  id: string; // id del evento (idempotencia)
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

/**
 * MockPaymentProvider: reproduce el contrato real. El checkout vive en /pago/mock/[checkoutId]
 * y emite un webhook firmado (HMAC) igual que haría un proveedor real.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  readonly isMock = true;

  constructor(
    private readonly appUrl: string,
    private readonly webhookSecret: string,
  ) {}

  async createCheckout(_input: CreateCheckoutInput): Promise<CheckoutSession> {
    const checkoutId = `mock_cs_${generateToken(18)}`;
    return {
      checkoutId,
      url: `${this.appUrl.replace(/\/$/, "")}/pago/mock/${checkoutId}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    const sig = verifyMockSignature(rawBody, headers.get("x-mock-signature"), this.webhookSecret);
    if (!sig.valid) return { valid: false, reason: sig.reason ?? "invalid" };
    let payload: MockWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as MockWebhookPayload;
    } catch {
      return { valid: false, reason: "invalid_json" };
    }
    const event: NormalizedPaymentEvent = {
      externalId: payload.id,
      type: payload.type,
      checkoutId: payload.checkoutId,
      providerPaymentId: payload.providerPaymentId,
      paymentId: payload.paymentId,
      amountCents: payload.amountCents,
      feeCents: payload.feeCents,
      refundedCents: payload.refundedCents,
      failureReason: payload.failureReason,
      raw: payload,
    };
    return { valid: true, event };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { refundId: `mock_re_${generateToken(12)}`, status: input.amountCents > 0 ? "succeeded" : "failed" };
  }

  /** El checkout simulado consulta la reserva en cada intento (una cancelada nunca se cobra): no hay sesión externa. */
  async expireCheckout(_checkoutId: string): Promise<void> {}
}
