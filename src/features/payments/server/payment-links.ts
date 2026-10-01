import "server-only";
import { appUrl, env } from "@/lib/env";
import { paymentResultPath, verifyPaymentResult } from "../domain/result-signature";

/** Secreto para firmar enlaces de resultado de pago (nunca el de webhooks del proveedor directamente). */
function resultSecret(): string {
  const e = env();
  return `ir-pago-resultado:${e.AUTH_SECRET ?? e.PAYMENT_WEBHOOK_SECRET}`;
}

/** Ruta relativa firmada: /pago/resultado?p=<id>&s=<firma> */
export function paymentResultRelativePath(paymentId: string): string {
  return paymentResultPath(paymentId, resultSecret());
}

/** URL absoluta (para el proveedor de pagos). */
export function paymentResultUrl(paymentId: string): string {
  return appUrl(paymentResultRelativePath(paymentId));
}

export function isValidPaymentResultSignature(paymentId: string | null | undefined, sig: string | null | undefined): boolean {
  return verifyPaymentResult(paymentId, sig, resultSecret());
}

export function portalPath(portalToken: string): string {
  return `/mi-evento/${portalToken}`;
}

export function quotePath(publicToken: string): string {
  return `/cotizacion/${publicToken}`;
}
