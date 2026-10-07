import "server-only";
import { Prisma, type NotificationChannel, type NotificationStatus, type NotificationType } from "@prisma/client";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";
import { isEnabled } from "@/lib/flags";
import { getEmailProvider, getWhatsAppProvider } from "@/server/providers";
import { whatsappDigits } from "@/server/providers/whatsapp/links";
import { getSettings } from "@/features/settings/server/settings-service";
import { renderNotification, type NotificationData } from "../domain/templates";

export type NotifyInput = {
  type: NotificationType;
  channel: NotificationChannel;
  to: string | null | undefined;
  data: NotificationData;
  leadId?: string | null;
  quoteId?: string | null;
  eventId?: string | null;
  /** Evita duplicados (p. ej. recordatorios programados): único en NotificationLog */
  dedupeKey?: string;
};

export type NotifyResult = { id: string; status: NotificationStatus } | null;

function toStatus(status: "sent" | "mocked" | "failed"): NotificationStatus {
  return status === "sent" ? "SENT" : status === "mocked" ? "MOCKED" : "FAILED";
}

/**
 * Servicio único de notificaciones. Siempre deja rastro en NotificationLog (mock inbox en dev).
 * Nunca lanza: un fallo de envío no debe romper el flujo de negocio.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  try {
    if (!input.to) return null;
    if (input.dedupeKey) {
      const existing = await prisma.notificationLog.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { id: existing.id, status: existing.status };
    }
    const business = await getSettings("business");
    const rendered = renderNotification(input.type, { brandName: business.brandName, ...input.data });
    const base = {
      type: input.type,
      status: "QUEUED" as const,
      subject: rendered.subject,
      actionUrl: input.data.url ?? null,
      dedupeKey: input.dedupeKey ?? null,
      leadId: input.leadId ?? null,
      quoteId: input.quoteId ?? null,
      eventId: input.eventId ?? null,
    };

    if (input.channel === "WHATSAPP") {
      const to = whatsappDigits(input.to);
      const provider = getWhatsAppProvider();
      const enabled = await isEnabled("WHATSAPP_ENABLED");
      const log = await prisma.notificationLog.create({
        data: { ...base, channel: "WHATSAPP", provider: provider.name, to: to ?? input.to, body: rendered.whatsapp },
      });
      if (!enabled || !to) {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: "SKIPPED", error: !enabled ? "WHATSAPP_ENABLED=false" : "Teléfono inválido" },
        });
        return { id: log.id, status: "SKIPPED" };
      }
      const res = await provider.send({ to, body: rendered.whatsapp });
      const status = toStatus(res.status);
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status,
          providerMessageId: res.providerMessageId,
          error: res.error,
          sentAt: status === "FAILED" ? null : new Date(),
        },
      });
      return { id: log.id, status };
    }

    const provider = getEmailProvider();
    const log = await prisma.notificationLog.create({
      data: { ...base, channel: "EMAIL", provider: provider.name, to: input.to, body: rendered.text },
    });
    const res = await provider.send({
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    const status = toStatus(res.status);
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status,
        providerMessageId: res.providerMessageId,
        error: res.error,
        sentAt: status === "FAILED" ? null : new Date(),
      },
    });
    return { id: log.id, status };
  } catch (error) {
    // Carrera entre dos ejecuciones con el mismo dedupeKey (p. ej. cron + botón manual):
    // la restricción única evita el duplicado; devolvemos el registro existente.
    if (input.dedupeKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.notificationLog
        .findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true, status: true } })
        .catch(() => null);
      if (existing) return existing;
    }
    logger.error("notifications.failed", { error, type: input.type, channel: input.channel });
    return null;
  }
}

/** Envía por email y WhatsApp cuando hay datos de contacto. */
export async function notifyCustomer(
  contact: { email?: string | null; phone?: string | null; whatsapp?: string | null },
  input: Omit<NotifyInput, "channel" | "to">,
): Promise<void> {
  const phone = contact.whatsapp ?? contact.phone;
  await Promise.all([
    contact.email
      ? notify({
          ...input,
          channel: "EMAIL",
          to: contact.email,
          dedupeKey: input.dedupeKey ? `${input.dedupeKey}:email` : undefined,
        })
      : null,
    phone
      ? notify({
          ...input,
          channel: "WHATSAPP",
          to: phone,
          dedupeKey: input.dedupeKey ? `${input.dedupeKey}:wa` : undefined,
        })
      : null,
  ]);
}
