import type { PaymentProvider } from "./types";
import { StripePaymentProvider } from "./stripe-provider";
import { MercadoPagoPaymentProvider } from "./mercadopago-provider";

/**
 * Proveedores reales de pago (Stripe / Mercado Pago) vía HTTP, sin SDK.
 * Devuelve null si el proveedor no está soportado o falta configuración (el registro cae al Mock).
 */
export function createRealPaymentProvider(
  provider: "stripe" | "mercadopago",
  secretKey: string,
  webhookSecret: string,
  appUrl: string,
): PaymentProvider | null {
  if (!secretKey) return null;
  if (provider === "stripe") return new StripePaymentProvider({ secretKey, webhookSecret, appUrl });
  if (provider === "mercadopago") return new MercadoPagoPaymentProvider({ accessToken: secretKey, webhookSecret, appUrl });
  return null;
}
