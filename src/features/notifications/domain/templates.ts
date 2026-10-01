import type { NotificationType } from "@prisma/client";

/** Datos disponibles para las plantillas (todos opcionales, en español). */
export type NotificationData = {
  name?: string; // destinataria
  brandName?: string;
  eventTitle?: string;
  eventDate?: string; // ya formateada
  eventTime?: string;
  amount?: string; // ya formateado MXN
  quoteCode?: string;
  validUntil?: string;
  url?: string; // CTA principal
  message?: string;
  staffFunction?: string;
};

export type RenderedNotification = {
  subject: string;
  text: string;
  html: string;
  whatsapp: string;
};

type Copy = {
  subject: (d: NotificationData) => string;
  body: (d: NotificationData) => string;
  cta?: string;
};

const hi = (d: NotificationData) => (d.name ? `Hola ${d.name.split(" ")[0]},` : "Hola,");

const COPY: Record<NotificationType, Copy> = {
  LEAD_RECEIVED: {
    subject: () => "Recibimos tu solicitud",
    body: (d) =>
      `${hi(d)} gracias por imaginar tu celebración con nosotras. Revisaremos disponibilidad para ${d.eventDate ?? "la fecha que elegiste"} y te escribiremos muy pronto con tu propuesta.`,
  },
  QUOTE_SENT: {
    subject: (d) => `Tu propuesta ${d.quoteCode ?? ""} está lista`,
    body: (d) =>
      `${hi(d)} preparamos tu propuesta para ${d.eventTitle ?? "tu celebración"}. Total: ${d.amount ?? ""}. Está vigente hasta ${d.validUntil ?? "la fecha indicada"}.`,
    cta: "Ver mi propuesta",
  },
  QUOTE_EXPIRING: {
    subject: () => "Tu propuesta vence pronto",
    body: (d) =>
      `${hi(d)} tu propuesta ${d.quoteCode ?? ""} vence ${d.validUntil ?? "pronto"}. Si quieres asegurar la fecha, puedes aceptarla en línea.`,
    cta: "Revisar propuesta",
  },
  QUOTE_ACCEPTED: {
    subject: () => "¡Aceptaste tu propuesta! Siguiente paso: anticipo",
    body: (d) =>
      `${hi(d)} qué emoción. Para confirmar ${d.eventTitle ?? "tu fecha"} sólo falta el anticipo de ${d.amount ?? ""}.`,
    cta: "Pagar anticipo",
  },
  PAYMENT_DUE: {
    subject: () => "Recordatorio de pago",
    body: (d) =>
      `${hi(d)} te recordamos que el saldo de ${d.amount ?? ""} para ${d.eventTitle ?? "tu evento"} vence pronto.`,
    cta: "Pagar ahora",
  },
  PAYMENT_RECEIVED: {
    subject: () => "Recibimos tu pago",
    body: (d) => `${hi(d)} recibimos tu pago de ${d.amount ?? ""} para ${d.eventTitle ?? "tu evento"}. ¡Gracias!`,
    cta: "Ver mi evento",
  },
  BOOKING_CONFIRMED: {
    subject: () => "¡Tu fecha está confirmada!",
    body: (d) =>
      `${hi(d)} tu celebración ${d.eventTitle ?? ""} del ${d.eventDate ?? ""} está confirmada. Desde tu portal puedes invitar a tus amigas, ver el menú y darnos los detalles.`,
    cta: "Abrir mi portal",
  },
  RSVP_REMINDER: {
    subject: (d) => `¿Nos acompañas a ${d.eventTitle ?? "la celebración"}?`,
    body: (d) =>
      `${hi(d)} confirma tu asistencia a ${d.eventTitle ?? "la celebración"} (${d.eventDate ?? ""}) y cuéntanos si tienes alguna restricción alimentaria.`,
    cta: "Confirmar asistencia",
  },
  EVENT_7D: {
    subject: () => "¡Falta una semana!",
    body: (d) =>
      `${hi(d)} en 7 días celebramos ${d.eventTitle ?? ""}. Revisa invitadas, alergias y detalles finales en tu portal.`,
    cta: "Revisar detalles",
  },
  EVENT_48H: {
    subject: () => "Todo listo para pasado mañana",
    body: (d) =>
      `${hi(d)} en 48 horas montamos ${d.eventTitle ?? "tu celebración"} (${d.eventDate ?? ""} ${d.eventTime ?? ""}). Confirma que la dirección y el acceso estén correctos.`,
    cta: "Ver mi evento",
  },
  POST_EVENT: {
    subject: () => "Gracias por celebrar con nosotras",
    body: (d) =>
      `${hi(d)} fue un honor ser parte de ${d.eventTitle ?? "tu celebración"}. Tu Memory Capsule con fotos y mensajes ya está disponible.`,
    cta: "Ver Memory Capsule",
  },
  REVIEW_REQUEST: {
    subject: () => "¿Cómo lo vivieron?",
    body: (d) =>
      `${hi(d)} tu opinión nos ayuda muchísimo. ¿Nos regalas un minuto para contarnos cómo estuvo todo?`,
    cta: "Dejar mi opinión",
  },
  PORTAL_ACCESS: {
    subject: () => "Tu acceso a Mi evento",
    body: (d) => `${hi(d)} aquí está tu enlace seguro para entrar a tu portal. ${d.message ?? ""}`,
    cta: "Entrar a mi portal",
  },
  STAFF_ASSIGNED: {
    subject: (d) => `Nuevo evento asignado: ${d.eventTitle ?? ""}`,
    body: (d) =>
      `${hi(d)} te asignamos a ${d.eventTitle ?? "un evento"} el ${d.eventDate ?? ""} como ${d.staffFunction ?? "parte del equipo"}.`,
    cta: "Ver mis eventos",
  },
  GENERIC: {
    subject: (d) => d.eventTitle ?? "Mensaje de Ivonne & Rosa",
    body: (d) => `${hi(d)} ${d.message ?? ""}`,
  },
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderNotification(type: NotificationType, data: NotificationData): RenderedNotification {
  const copy = COPY[type];
  const brand = data.brandName ?? "Ivonne & Rosa";
  const subject = copy.subject(data).replace(/\s+/g, " ").trim();
  const body = copy.body(data).replace(/\s+/g, " ").trim();
  const ctaText = copy.cta && data.url ? `${copy.cta}: ${data.url}` : (data.url ?? "");
  const text = [body, ctaText, "", `Con cariño, ${brand}`].join("\n");
  const whatsapp = [body, ctaText].filter(Boolean).join("\n\n");
  const button =
    copy.cta && data.url
      ? `<p style="margin:28px 0"><a href="${escapeHtml(data.url)}" style="background:#5C6B4E;color:#F7F3EC;padding:12px 22px;border-radius:999px;text-decoration:none;font-family:Georgia,serif">${escapeHtml(copy.cta)}</a></p>`
      : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F7F3EC;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#2F2C2A">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="font-family:Georgia,serif;font-size:22px;margin:0 0 20px;color:#5C6B4E">${escapeHtml(brand)}</p>
<p style="font-size:16px;line-height:1.6;margin:0">${escapeHtml(body)}</p>
${button}
<p style="font-size:13px;color:#A48F7E;margin-top:32px">Tú reúne a las tuyas. Nosotras hacemos el resto.</p>
</td></tr></table></body></html>`;
  return { subject, text, html, whatsapp };
}
