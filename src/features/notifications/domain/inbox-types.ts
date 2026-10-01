import type {
  NotificationChannel as PrismaChannel,
  NotificationStatus as PrismaStatus,
  NotificationType as PrismaType,
} from "@prisma/client";
import type { Tone as LabelTone } from "@/lib/labels";

export type NotificationChannel = PrismaChannel;
export type NotificationStatus = PrismaStatus;
export type NotificationType = PrismaType;
export type Tone = LabelTone;

/** Listas de valores (sin importar @prisma/client en runtime, apto para cliente y tests). */
export const NOTIFICATION_CHANNELS = ["EMAIL", "WHATSAPP"] as const satisfies readonly NotificationChannel[];
export const NOTIFICATION_STATUSES = [
  "QUEUED",
  "SENT",
  "MOCKED",
  "FAILED",
  "SKIPPED",
] as const satisfies readonly NotificationStatus[];
export const NOTIFICATION_TYPES = [
  "LEAD_RECEIVED",
  "QUOTE_SENT",
  "QUOTE_EXPIRING",
  "QUOTE_ACCEPTED",
  "PAYMENT_DUE",
  "PAYMENT_RECEIVED",
  "BOOKING_CONFIRMED",
  "RSVP_REMINDER",
  "EVENT_7D",
  "EVENT_48H",
  "POST_EVENT",
  "REVIEW_REQUEST",
  "PORTAL_ACCESS",
  "STAFF_ASSIGNED",
  "GENERIC",
] as const satisfies readonly NotificationType[];
