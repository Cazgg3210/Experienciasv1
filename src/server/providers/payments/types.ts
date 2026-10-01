/**
 * Contrato de pagos independiente del proveedor (Mock / Stripe / Mercado Pago).
 * El dominio NUNCA depende de un SDK concreto. La confirmación de pago SIEMPRE llega por webhook
 * firmado e idempotente — jamás por el redirect del navegador.
 */
export type CreateCheckoutInput = {
  paymentId: string;
  amountCents: number;
  currency: "MXN";
  description: string;
  customer: { name: string; email?: string | null; phone?: string | null };
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
};

export type CheckoutSession = {
  checkoutId: string;
  url: string;
  expiresAt?: Date;
};

export type NormalizedPaymentEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "refund.succeeded"
  | "unknown";

export type NormalizedPaymentEvent = {
  /** ID único del evento del proveedor (clave de idempotencia del webhook) */
  externalId: string;
  type: NormalizedPaymentEventType;
  checkoutId?: string;
  providerPaymentId?: string;
  /** Nuestro Payment.id si el proveedor lo devuelve en metadata */
  paymentId?: string;
  amountCents?: number;
  feeCents?: number;
  refundedCents?: number;
  failureReason?: string;
  raw: unknown;
};

export type WebhookVerification =
  | { valid: true; event: NormalizedPaymentEvent }
  | { valid: false; reason: string };

export type RefundInput = {
  providerPaymentId: string;
  amountCents: number;
  idempotencyKey: string;
  reason?: string;
};

export type RefundResult = { refundId: string; status: "succeeded" | "pending" | "failed" };

export interface PaymentProvider {
  readonly name: "mock" | "stripe" | "mercadopago";
  readonly isMock: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Verifica firma y normaliza el evento. rawBody debe ser el cuerpo exacto recibido. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification>;
  refund(input: RefundInput): Promise<RefundResult>;
}
