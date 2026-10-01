import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { PaymentProvider } from "./payments/types";
import { MockPaymentProvider } from "./payments/mock-provider";
import { createRealPaymentProvider } from "./payments/real";
import type { EmailProvider } from "./email/types";
import { MockEmailProvider } from "./email/mock-provider";
import { ResendEmailProvider } from "./email/resend-provider";
import type { WhatsAppProvider } from "./whatsapp/types";
import { MockWhatsAppProvider } from "./whatsapp/mock-provider";
import { CloudApiWhatsAppProvider } from "./whatsapp/cloud-api-provider";
import type { AIProvider } from "./ai/types";
import { MockAIProvider } from "./ai/mock-provider";
import { createRealAIProvider } from "./ai/real";
import type { StorageProvider } from "./storage/types";
import { S3StorageProvider } from "./storage/s3-provider";
import { LocalStorageProvider } from "./storage/local-provider";

/**
 * Registro de proveedores de infraestructura. Si falta una credencial se usa el Mock
 * (y el admin muestra un aviso visible de "modo demo").
 */

let payment: PaymentProvider | null = null;
export function getPaymentProvider(): PaymentProvider {
  if (payment) return payment;
  const e = env();
  if (e.PAYMENT_PROVIDER !== "mock" && e.PAYMENT_SECRET_KEY) {
    const real = createRealPaymentProvider(e.PAYMENT_PROVIDER, e.PAYMENT_SECRET_KEY, e.PAYMENT_WEBHOOK_SECRET, e.APP_URL);
    if (real) return (payment = real);
    logger.warn("payments.provider_unavailable_fallback_mock", { provider: e.PAYMENT_PROVIDER });
  }
  payment = new MockPaymentProvider(e.APP_URL, e.PAYMENT_WEBHOOK_SECRET);
  return payment;
}

/** Devuelve un proveedor por nombre (para webhooks /api/webhooks/payments/[provider]). */
export function getPaymentProviderByName(name: string): PaymentProvider | null {
  const current = getPaymentProvider();
  if (current.name === name) return current;
  if (name === "mock") {
    const e = env();
    // En producción con proveedor real, el webhook mock queda deshabilitado.
    if (e.NODE_ENV === "production" && e.PAYMENT_PROVIDER !== "mock") return null;
    return new MockPaymentProvider(e.APP_URL, e.PAYMENT_WEBHOOK_SECRET);
  }
  return null;
}

let email: EmailProvider | null = null;
export function getEmailProvider(): EmailProvider {
  if (email) return email;
  const e = env();
  email =
    e.EMAIL_PROVIDER === "resend" && e.EMAIL_API_KEY
      ? new ResendEmailProvider(e.EMAIL_API_KEY, e.EMAIL_FROM)
      : new MockEmailProvider();
  return email;
}

let whatsapp: WhatsAppProvider | null = null;
export function getWhatsAppProvider(): WhatsAppProvider {
  if (whatsapp) return whatsapp;
  const e = env();
  whatsapp =
    e.WHATSAPP_PROVIDER === "cloud_api" && e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID
      ? new CloudApiWhatsAppProvider(e.WHATSAPP_TOKEN, e.WHATSAPP_PHONE_NUMBER_ID)
      : new MockWhatsAppProvider();
  return whatsapp;
}

let ai: AIProvider | null = null;
export function getAIProvider(): AIProvider {
  if (ai) return ai;
  const e = env();
  if (e.AI_PROVIDER !== "mock" && e.AI_API_KEY) {
    const real = createRealAIProvider(e.AI_PROVIDER, e.AI_API_KEY, e.AI_MODEL);
    if (real) return (ai = real);
    logger.warn("ai.provider_unavailable_fallback_mock", { provider: e.AI_PROVIDER });
  }
  ai = new MockAIProvider();
  return ai;
}

let storage: StorageProvider | null = null;
export function getStorage(): StorageProvider {
  if (storage) return storage;
  const e = env();
  if (e.STORAGE_DRIVER === "s3" && e.STORAGE_ACCESS_KEY && e.STORAGE_SECRET_KEY) {
    storage = new S3StorageProvider({
      endpoint: e.STORAGE_ENDPOINT,
      region: e.STORAGE_REGION,
      bucket: e.STORAGE_BUCKET,
      accessKeyId: e.STORAGE_ACCESS_KEY,
      secretAccessKey: e.STORAGE_SECRET_KEY,
      forcePathStyle: e.STORAGE_FORCE_PATH_STYLE,
    });
  } else {
    if (e.NODE_ENV === "production") logger.warn("storage.local_driver_in_production");
    storage = new LocalStorageProvider();
  }
  return storage;
}

export type ProviderStatus = {
  payments: { name: string; mock: boolean };
  email: { name: string; mock: boolean };
  whatsapp: { name: string; mock: boolean };
  ai: { name: string; mock: boolean };
  storage: { name: string; mock: boolean };
};

/** Estado de integraciones para mostrar avisos de "modo demo" en admin. */
export function providerStatus(): ProviderStatus {
  const p = getPaymentProvider();
  const em = getEmailProvider();
  const wa = getWhatsAppProvider();
  const a = getAIProvider();
  const s = getStorage();
  return {
    payments: { name: p.name, mock: p.isMock },
    email: { name: em.name, mock: em.isMock },
    whatsapp: { name: wa.name, mock: wa.isMock },
    ai: { name: a.name, mock: a.isMock },
    storage: { name: s.driver, mock: s.driver === "LOCAL" },
  };
}
