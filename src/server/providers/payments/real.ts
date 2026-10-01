import type { PaymentProvider } from "./types";

/**
 * STUB — lo implementa el módulo Pagos (Stripe / Mercado Pago vía HTTP, sin SDK).
 * Devuelve null si el proveedor no está soportado (el registro cae al Mock).
 */
export function createRealPaymentProvider(
  _provider: "stripe" | "mercadopago",
  _secretKey: string,
  _webhookSecret: string,
  _appUrl: string,
): PaymentProvider | null {
  return null;
}
