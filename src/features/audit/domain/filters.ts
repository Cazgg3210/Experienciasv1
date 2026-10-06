import { isValidDateKey } from "@/lib/dates";

/** Filtros del visor de auditoría a partir de searchParams (puro). */
export type AuditFilters = {
  action?: string;
  entityType?: string;
  /** id de usuaria o "system" (acciones sin actor: cron, webhooks) */
  actor?: string;
  entityId?: string;
  from?: string; // YYYY-MM-DD (día local CDMX)
  to?: string; // YYYY-MM-DD inclusive
};

type SP = Record<string, string | string[] | undefined>;

function one(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : undefined;
}

const SAFE = /^[\w.:-]{1,80}$/;

export function parseAuditFilters(sp: SP): AuditFilters {
  const action = one(sp, "action");
  const entityType = one(sp, "entityType");
  const actor = one(sp, "actor");
  const entityId = one(sp, "entityId");
  let from = one(sp, "from");
  let to = one(sp, "to");
  if (from && !isValidDateKey(from)) from = undefined;
  if (to && !isValidDateKey(to)) to = undefined;
  if (from && to && from > to) [from, to] = [to, from];
  return {
    action: action && SAFE.test(action) ? action : undefined,
    entityType: entityType && SAFE.test(entityType) ? entityType : undefined,
    actor: actor && (actor === "system" || /^[a-z0-9]{10,40}$/i.test(actor)) ? actor : undefined,
    entityId: entityId && SAFE.test(entityId) ? entityId : undefined,
    from,
    to,
  };
}

export function hasActiveFilters(f: AuditFilters): boolean {
  return Object.values(f).some(Boolean);
}

/** Etiquetas en español de acciones conocidas (fallback: la clave técnica). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "settings.updated": "Configuración actualizada",
  "settings.pricing_changed": "Precios y márgenes actualizados",
  "settings.flag_changed": "Función activada/desactivada",
  "settings.flag_reset": "Función restablecida a entorno",
  "user.created": "Usuaria creada",
  "user.role_changed": "Cambio de rol",
  "user.activated": "Cuenta reactivada",
  "user.deactivated": "Cuenta desactivada",
  "user.password_reset": "Contraseña restablecida",
  "media.uploaded": "Imagen agregada a galería",
  "media.updated": "Imagen actualizada",
  "media.deleted": "Imagen eliminada",
  "testimonial.created": "Testimonio creado",
  "testimonial.updated": "Testimonio actualizado",
  "testimonial.deleted": "Testimonio eliminado",
  "faq.created": "Pregunta frecuente creada",
  "faq.updated": "Pregunta frecuente actualizada",
  "faq.deleted": "Pregunta frecuente eliminada",
  "guest.possible_duplicate": "Posible invitada duplicada (link general)",
  "quote.expired": "Cotización expirada (automático)",
  "quote.discount_applied": "Descuento aplicado",
  "notifications.scheduler_run": "Recordatorios ejecutados manualmente",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditActionTone(action: string): "danger" | "warning" | "info" | "brand" | "neutral" {
  if (/\.(deleted|deactivated|cancel|cancelled|refund|refunded)$/.test(action) || action.includes("delete")) return "danger";
  if (/(pricing|discount|role|password|flag)/.test(action)) return "warning";
  if (/\.(created|uploaded|activated)$/.test(action)) return "brand";
  if (action.startsWith("settings.")) return "info";
  return "neutral";
}
