import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma HMAC del enlace de resultado de pago (/pago/resultado?p=<paymentId>&s=<firma>).
 * Evita que alguien consulte el estado de pagos ajenos adivinando IDs.
 */
const SIG_LENGTH = 32;

export function signPaymentResult(paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`pago-resultado:${paymentId}`).digest("base64url").slice(0, SIG_LENGTH);
}

export function verifyPaymentResult(
  paymentId: string | null | undefined,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!paymentId || !signature) return false;
  if (!/^[a-z0-9]{10,40}$/i.test(paymentId)) return false;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(signature)) return false;
  const expected = Buffer.from(signPaymentResult(paymentId, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function paymentResultPath(paymentId: string, secret: string): string {
  return `/pago/resultado?p=${encodeURIComponent(paymentId)}&s=${signPaymentResult(paymentId, secret)}`;
}
