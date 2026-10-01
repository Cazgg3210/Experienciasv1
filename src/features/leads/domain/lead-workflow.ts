/**
 * Reglas de trabajo del CRM de leads (puras): contacto, transiciones permitidas en UI,
 * mensajes plantilla para WhatsApp/email.
 */
import type { LeadActivityType, LeadStatus, Occasion } from "@prisma/client";
import { OCCASION_LABELS } from "@/lib/labels";
import { leadStatusMachine } from "./lead-status";

/** Tipos de actividad que el equipo puede registrar a mano. */
export const LOGGABLE_ACTIVITY_TYPES = ["NOTE", "CALL", "WHATSAPP", "EMAIL"] as const satisfies readonly LeadActivityType[];
export type LoggableActivityType = (typeof LOGGABLE_ACTIVITY_TYPES)[number];

/** Los que cuentan como contacto con la clienta (la nota es interna). */
export const CONTACT_ACTIVITY_TYPES = ["CALL", "WHATSAPP", "EMAIL"] as const satisfies readonly LeadActivityType[];

export const LOGGABLE_ACTIVITY_LABELS: Record<LoggableActivityType, string> = {
  NOTE: "Nota interna",
  CALL: "Llamada",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

export function isContactActivity(type: LeadActivityType): boolean {
  return (CONTACT_ACTIVITY_TYPES as readonly string[]).includes(type);
}

/** Registrar un contacto sobre un lead NUEVO lo mueve automáticamente a CONTACTADO. */
export function shouldAutoContact(status: LeadStatus, type: LeadActivityType): boolean {
  return status === "NEW" && isContactActivity(type) && leadStatusMachine.can("NEW", "CONTACTED");
}

/** Estados a los que puede moverse un lead desde su estado actual. */
export function nextLeadStatuses(from: LeadStatus): LeadStatus[] {
  return [...leadStatusMachine.next(from)];
}

export function requiresLostReason(to: LeadStatus): boolean {
  return to === "LOST";
}

export function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return n;
}

export type LeadMessageContext = {
  leadName: string;
  senderName?: string | null;
  occasion?: Occasion | null;
  occasionOther?: string | null;
  /** Fecha ya formateada (p. ej. "sábado 7 de noviembre de 2026") */
  eventDateLabel?: string | null;
  guestCount?: number | null;
  experienceName?: string | null;
};

function occasionPhrase(ctx: LeadMessageContext): string | null {
  if (ctx.occasion === "OTHER") return ctx.occasionOther?.trim() ? ctx.occasionOther.trim().toLowerCase() : "celebración";
  return ctx.occasion ? OCCASION_LABELS[ctx.occasion].toLowerCase() : null;
}

/** Mensaje cálido de primer contacto para WhatsApp (deep link wa.me). */
export function buildWhatsappMessage(ctx: LeadMessageContext): string {
  const name = firstName(ctx.leadName) || "hola";
  const sender = firstName(ctx.senderName);
  const occasion = occasionPhrase(ctx);
  const details: string[] = [];
  if (occasion) details.push(`tu ${occasion}`);
  if (ctx.eventDateLabel) details.push(`el ${ctx.eventDateLabel}`);
  if (ctx.guestCount) details.push(`para ${ctx.guestCount} ${ctx.guestCount === 1 ? "persona" : "personas"}`);

  const greeting = `¡Hola, ${name}! ${sender ? `Soy ${sender}, de` : "Te escribimos de"} Ivonne & Rosa.`;
  const thanks = details.length
    ? `Gracias por pensar en nosotras para ${details.join(" ")}.`
    : "Gracias por escribirnos.";
  const experience = ctx.experienceName ? ` Nos encantaría platicarte cómo imaginamos tu ${ctx.experienceName}.` : "";
  const close = " ¿Te parece si te comparto opciones y resolvemos tus dudas por aquí?";
  return `${greeting} ${thanks}${experience}${close}`;
}

export function buildEmailSubject(ctx: LeadMessageContext): string {
  const occasion = occasionPhrase(ctx);
  return occasion ? `Tu ${occasion} con Ivonne & Rosa` : "Tu experiencia con Ivonne & Rosa";
}

export function buildEmailBody(ctx: LeadMessageContext): string {
  const name = firstName(ctx.leadName) || "";
  const sender = firstName(ctx.senderName);
  const lines = [
    `Hola${name ? `, ${name}` : ""}:`,
    "",
    buildWhatsappMessage(ctx).replace(/^¡Hola, [^!]+! /, ""),
    "",
    "Con cariño,",
    sender ? `${sender} · Ivonne & Rosa` : "Ivonne & Rosa",
  ];
  return lines.join("\n");
}

/** mailto: con asunto y cuerpo codificados. */
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** tel: con sólo dígitos y + inicial. */
export function telLink(phone: string): string {
  const clean = phone.trim().replace(/[^\d+]/g, "");
  return `tel:${clean}`;
}
