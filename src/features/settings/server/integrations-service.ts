import "server-only";
import { appUrl, env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import { providerStatus } from "@/server/providers";
import { notify } from "@/features/notifications/server/notification-service";
import { getSettings } from "./settings-service";

export type IntegrationKey = "payments" | "email" | "whatsapp" | "ai" | "storage";

export type EnvVarStatus = { name: string; set: boolean; required: boolean; hint?: string };

export type IntegrationCard = {
  key: IntegrationKey;
  title: string;
  description: string;
  providerName: string;
  mock: boolean;
  demoNote: string;
  envVars: EnvVarStatus[];
};

/** Nunca devuelve valores: sólo si la variable tiene contenido. */
function isSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function vars(list: Array<[name: string, required: boolean, hint?: string]>): EnvVarStatus[] {
  return list.map(([name, required, hint]) => ({ name, set: isSet(name), required, hint }));
}

/** Tarjetas de estado de integraciones (sin exponer secretos). */
export function getIntegrationCards(): IntegrationCard[] {
  const status = providerStatus();
  return [
    {
      key: "payments",
      title: "Pagos",
      description: "Cobro de anticipos y saldos en línea (Stripe o Mercado Pago).",
      providerName: status.payments.name,
      mock: status.payments.mock,
      demoNote: "Los pagos se simulan con un checkout de prueba; no se cobra dinero real.",
      envVars: vars([
        ["PAYMENT_PROVIDER", true, "stripe | mercadopago"],
        ["PAYMENT_SECRET_KEY", true],
        ["PAYMENT_PUBLIC_KEY", false],
        ["PAYMENT_WEBHOOK_SECRET", true, "firma de webhooks"],
      ]),
    },
    {
      key: "email",
      title: "Email",
      description: "Confirmaciones, propuestas y recordatorios por correo (Resend).",
      providerName: status.email.name,
      mock: status.email.mock,
      demoNote: "Los correos no salen a internet: se guardan en la Bandeja.",
      envVars: vars([
        ["EMAIL_PROVIDER", true, "resend"],
        ["EMAIL_API_KEY", true],
        ["EMAIL_FROM", true, "remitente verificado"],
      ]),
    },
    {
      key: "whatsapp",
      title: "WhatsApp",
      description: "Mensajes automáticos por WhatsApp Business (Cloud API de Meta).",
      providerName: status.whatsapp.name,
      mock: status.whatsapp.mock,
      demoNote: "Los mensajes se guardan en la Bandeja con un botón para enviarlos a mano.",
      envVars: vars([
        ["WHATSAPP_PROVIDER", true, "cloud_api"],
        ["WHATSAPP_TOKEN", true],
        ["WHATSAPP_PHONE_NUMBER_ID", true],
        ["WHATSAPP_BUSINESS_NUMBER", false, "número público del negocio"],
      ]),
    },
    {
      key: "ai",
      title: "Inteligencia artificial",
      description: "Diseñador de experiencias con IA (Anthropic u OpenAI).",
      providerName: status.ai.name,
      mock: status.ai.mock,
      demoNote: "El diseñador responde con propuestas de ejemplo generadas localmente.",
      envVars: vars([
        ["AI_PROVIDER", true, "anthropic | openai"],
        ["AI_API_KEY", true],
        ["AI_MODEL", false],
      ]),
    },
    {
      key: "storage",
      title: "Archivos",
      description: "Fotos, comprobantes y evidencias en almacenamiento compatible con S3.",
      providerName: status.storage.name,
      mock: status.storage.mock,
      demoNote: "Los archivos se guardan en el disco del servidor (se pierden al redeplegar).",
      envVars: vars([
        ["STORAGE_DRIVER", true, "s3"],
        ["STORAGE_ENDPOINT", false, "R2, Spaces, MinIO…"],
        ["STORAGE_BUCKET", true],
        ["STORAGE_ACCESS_KEY", true],
        ["STORAGE_SECRET_KEY", true],
        ["STORAGE_PUBLIC_URL", false, "CDN opcional"],
      ]),
    },
  ];
}

export function getWebhookUrls(): Array<{ provider: string; label: string; url: string; note: string }> {
  return [
    {
      provider: "stripe",
      label: "Stripe",
      url: appUrl("/api/webhooks/payments/stripe"),
      note: "Suscribe los eventos de checkout completado, pago fallido y reembolso",
    },
    {
      provider: "mercadopago",
      label: "Mercado Pago",
      url: appUrl("/api/webhooks/payments/mercadopago"),
      note: "Notificaciones de pagos (topic payment)",
    },
    {
      provider: "mock",
      label: "Pagos de prueba",
      url: appUrl("/api/webhooks/payments/mock"),
      note: "Sólo para el modo demo; se desactiva con un proveedor real en producción",
    },
  ];
}

export function getCronInfo(): { url: string; secretConfigured: boolean; curl: string; schedule: string } {
  const url = appUrl("/api/cron/notifications");
  let secretConfigured = false;
  try {
    secretConfigured = !!env().CRON_SECRET;
  } catch {
    secretConfigured = false;
  }
  return {
    url,
    secretConfigured,
    schedule: "Cada hora (0 * * * *)",
    curl: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" ${url}`,
  };
}

export type TestMessageResult = { id: string; status: string; to: string };

/** Email de prueba (GENERIC) a la persona que lo solicita. Queda en la Bandeja. */
export async function sendTestEmail(actor: SessionUser): Promise<TestMessageResult> {
  if (!actor.email) throw new AppError("Tu usuario no tiene correo registrado.", "VALIDATION_ERROR", 422);
  const res = await notify({
    type: "GENERIC",
    channel: "EMAIL",
    to: actor.email,
    data: {
      name: actor.name,
      eventTitle: "Email de prueba",
      message:
        "Este es un mensaje de prueba de la plataforma. Si lo recibes, el envío de correos está funcionando.",
      url: appUrl("/admin/notifications"),
    },
  });
  if (!res) throw new AppError("No se pudo registrar el email de prueba. Revisa los logs del servidor.", "SEND_FAILED", 502);
  return { id: res.id, status: res.status, to: actor.email };
}

/** WhatsApp de prueba (GENERIC) al número del negocio configurado en Negocio. */
export async function sendTestWhatsApp(actor: SessionUser): Promise<TestMessageResult> {
  const business = await getSettings("business");
  const to = business.whatsappNumber;
  const res = await notify({
    type: "GENERIC",
    channel: "WHATSAPP",
    to,
    data: {
      name: actor.name,
      eventTitle: "WhatsApp de prueba",
      message: "Mensaje de prueba de la plataforma Ivonne & Rosa. Si lo recibes, WhatsApp está conectado.",
    },
  });
  if (!res) throw new AppError("No se pudo registrar el WhatsApp de prueba. Revisa los logs del servidor.", "SEND_FAILED", 502);
  return { id: res.id, status: res.status, to };
}
