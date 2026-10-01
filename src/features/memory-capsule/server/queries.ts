import "server-only";
import type { EventStatus, MessageAuthorType, MessageKind } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { mediaUrl } from "@/features/media/server/media-url";
import { buildCustomerShareText, moderationSummary, photoAlt } from "../domain/capsule";

/** Vista de administración de la Memory Capsule de un evento (incluye fotos ocultas). */

export type AdminCapsuleMedia = {
  id: string;
  url: string;
  alt: string;
  mimeType: string;
  sizeBytes: number;
  uploaderName: string | null;
  uploadedByTeam: boolean;
  consent: boolean;
  approved: boolean;
  isCover: boolean;
  createdAt: Date;
};

export type AdminCapsuleMessage = {
  id: string;
  kind: MessageKind;
  authorType: MessageAuthorType;
  authorName: string;
  body: string;
  hidden: boolean;
  createdAt: Date;
};

export type AdminMemoryPageData = {
  event: {
    id: string;
    code: string;
    title: string;
    status: EventStatus;
    eventDate: Date;
    honoreeName: string | null;
    customerName: string;
    customerPhone: string | null;
  };
  capsule: {
    id: string;
    title: string;
    message: string | null;
    published: boolean;
    allowGuestUploads: boolean;
    coverMediaId: string | null;
    shareUrl: string;
    whatsappUrl: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  media: AdminCapsuleMedia[];
  messages: AdminCapsuleMessage[];
  summary: { total: number; approved: number; pending: number };
};

export async function getAdminMemoryPage(eventId: string): Promise<AdminMemoryPageData | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      eventDate: true,
      honoreeName: true,
      customer: { select: { name: true, phone: true, whatsapp: true } },
      memoryCapsule: {
        include: {
          media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
      messages: {
        where: { kind: { in: ["HONOREE", "GUESTBOOK"] } },
        orderBy: { createdAt: "desc" },
        take: 300,
      },
    },
  });
  if (!event) return null;

  const customerPhone = event.customer.whatsapp ?? event.customer.phone ?? null;
  const c = event.memoryCapsule;
  const capsuleTitle = c?.title ?? event.title;

  const media: AdminCapsuleMedia[] = (c?.media ?? []).map((m, index) => ({
    id: m.id,
    url: mediaUrl(m),
    alt: photoAlt({ alt: m.alt, uploaderName: m.uploaderName, index, title: capsuleTitle }),
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    uploaderName: m.uploaderName,
    uploadedByTeam: !!m.uploadedById,
    consent: m.consent,
    approved: m.approved,
    isCover: c?.coverMediaId === m.id,
    createdAt: m.createdAt,
  }));

  let capsule: AdminMemoryPageData["capsule"] = null;
  if (c) {
    const shareUrl = appUrl(`/memory/${c.shareToken}`);
    capsule = {
      id: c.id,
      title: c.title,
      message: c.message,
      published: c.published,
      allowGuestUploads: c.allowGuestUploads,
      coverMediaId: c.coverMediaId,
      shareUrl,
      whatsappUrl: whatsappLink(
        customerPhone,
        buildCustomerShareText({
          customerName: event.customer.name,
          capsuleTitle: c.title,
          url: shareUrl,
          published: c.published,
        }),
      ),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  return {
    event: {
      id: event.id,
      code: event.code,
      title: event.title,
      status: event.status,
      eventDate: event.eventDate,
      honoreeName: event.honoreeName,
      customerName: event.customer.name,
      customerPhone,
    },
    capsule,
    media,
    messages: event.messages.map((m) => ({
      id: m.id,
      kind: m.kind,
      authorType: m.authorType,
      authorName: m.authorName,
      body: m.body,
      hidden: m.hidden,
      createdAt: m.createdAt,
    })),
    summary: moderationSummary(media),
  };
}
