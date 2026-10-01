import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { NotFoundError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import { providerStatus } from "@/server/providers";
import type { InboxFilters } from "../domain/inbox-filters";

export const INBOX_PAGE_SIZE = 25;

export function inboxWhere(f: InboxFilters): Prisma.NotificationLogWhereInput {
  const where: Prisma.NotificationLogWhereInput = {};
  if (f.channel) where.channel = f.channel;
  if (f.type) where.type = f.type;
  if (f.status) where.status = f.status;
  if (f.unread) where.readAt = null;
  if (f.q) {
    where.OR = [
      { to: { contains: f.q, mode: "insensitive" } },
      { subject: { contains: f.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listNotifications(filters: InboxFilters, page: number, pageSize = INBOX_PAGE_SIZE) {
  const where = inboxWhere(filters);
  const [items, total, unreadTotal] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        channel: true,
        status: true,
        to: true,
        subject: true,
        body: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prisma.notificationLog.count({ where }),
    prisma.notificationLog.count({ where: { readAt: null } }),
  ]);
  return { items, total, unreadTotal };
}

export type InboxListItem = Awaited<ReturnType<typeof listNotifications>>["items"][number];

export async function getNotification(id: string) {
  return prisma.notificationLog.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, code: true } },
      quote: { select: { id: true, code: true } },
      event: { select: { id: true, code: true, title: true } },
    },
  });
}

export type InboxDetail = NonNullable<Awaited<ReturnType<typeof getNotification>>>;

/** Marca un mensaje como leído / no leído (readAt). */
export async function setNotificationRead(id: string, read: boolean, _actor: SessionUser) {
  const existing = await prisma.notificationLog.findUnique({ where: { id }, select: { id: true, readAt: true } });
  if (!existing) throw new NotFoundError("El mensaje ya no existe.");
  if (read && existing.readAt) return { id, readAt: existing.readAt };
  const updated = await prisma.notificationLog.update({
    where: { id },
    data: { readAt: read ? new Date() : null },
    select: { id: true, readAt: true },
  });
  return updated;
}

/** Marca todos los mensajes no leídos (opcionalmente sólo los del filtro actual). */
export async function markAllNotificationsRead(_actor: SessionUser, filters?: InboxFilters): Promise<number> {
  const where: Prisma.NotificationLogWhereInput = filters ? { ...inboxWhere(filters), readAt: null } : { readAt: null };
  const res = await prisma.notificationLog.updateMany({ where, data: { readAt: new Date() } });
  return res.count;
}

/** ¿Los canales de mensajería están en modo demo? (para el aviso de la bandeja) */
export function messagingMockStatus(): { email: boolean; whatsapp: boolean } {
  const s = providerStatus();
  return { email: s.email.mock, whatsapp: s.whatsapp.mock };
}
