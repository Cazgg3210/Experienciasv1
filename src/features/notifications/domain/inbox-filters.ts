import type { NotificationChannel, NotificationStatus, NotificationType, Tone } from "./inbox-types";
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from "./inbox-types";

/** Filtros de la bandeja a partir de searchParams (puro). */
export type InboxFilters = {
  channel?: NotificationChannel;
  type?: NotificationType;
  status?: NotificationStatus;
  q?: string;
  unread: boolean;
  /** mensaje seleccionado (vista dividida) */
  id?: string;
};

type SP = Record<string, string | string[] | undefined>;

function one(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : undefined;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseInboxFilters(sp: SP): InboxFilters {
  const q = one(sp, "q");
  const id = one(sp, "id");
  return {
    channel: pick(one(sp, "channel"), NOTIFICATION_CHANNELS),
    type: pick(one(sp, "type"), NOTIFICATION_TYPES),
    status: pick(one(sp, "status"), NOTIFICATION_STATUSES),
    q: q ? q.slice(0, 100) : undefined,
    unread: one(sp, "unread") === "1",
    id: id && /^[a-z0-9]{10,40}$/i.test(id) ? id : undefined,
  };
}

export function hasInboxFilters(f: InboxFilters): boolean {
  return !!(f.channel || f.type || f.status || f.q || f.unread);
}

/** Construye la URL de la bandeja conservando filtros (y opcionalmente seleccionando un mensaje). */
export function inboxHref(
  basePath: string,
  f: InboxFilters,
  overrides: { id?: string | null; page?: number | null } = {},
): string {
  const params = new URLSearchParams();
  if (f.channel) params.set("channel", f.channel);
  if (f.type) params.set("type", f.type);
  if (f.status) params.set("status", f.status);
  if (f.q) params.set("q", f.q);
  if (f.unread) params.set("unread", "1");
  const id = overrides.id === undefined ? f.id : overrides.id;
  if (id) params.set("id", id);
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export const NOTIFICATION_STATUS_TONES: Record<NotificationStatus, Tone> = {
  QUEUED: "muted",
  SENT: "success",
  MOCKED: "info",
  FAILED: "danger",
  SKIPPED: "warning",
};

/** Primera línea útil del cuerpo (para la vista previa de WhatsApp sin asunto). */
export function previewText(body: string, max = 120): string {
  const line = body.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
