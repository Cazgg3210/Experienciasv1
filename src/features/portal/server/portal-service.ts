import "server-only";
import type { DietaryRestriction, EventStatus, GuestSource, MessageAuthorType, Occasion, Prisma, RsvpStatus } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { isEnabled } from "@/lib/flags";
import { formatLongDate, localTime } from "@/lib/dates";
import { isPlausibleToken, safeEqual } from "@/lib/tokens";
import { logger } from "@/lib/logger";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { getSettings } from "@/features/settings/server/settings-service";
import { notify } from "@/features/notifications/server/notification-service";
import { netPaidCents } from "@/features/payments/domain/payment-status";
import { firstName, rsvpStats, type RsvpStats } from "@/features/guests/domain/rsvp";
import {
  PORTAL_ACCESS_LOOKBACK_DAYS,
  PORTAL_ACCESS_NEUTRAL_MESSAGE,
  buildGuestInvitationText,
  buildInvitationText,
  canEditAddress,
  isPortalEditable,
  mapsLink,
  paymentCta,
  type PaymentCta,
} from "../domain/portal";
import { buildMenuView, type MenuView } from "../domain/menu";

// -----------------------------------------------------------------------------
// Resolución de tokens (siempre validar formato antes de tocar la DB)
// -----------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const portalEventSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  customerId: true,
  startsAt: true,
  endsAt: true,
  micrositeSlug: true,
  micrositeEnabled: true,
  inviteToken: true,
  portalToken: true,
} satisfies Prisma.EventSelect;

export type PortalEventRef = Prisma.EventGetPayload<{ select: typeof portalEventSelect }>;

/** Evento por Event.portalToken (o null si el token es inválido / no existe). */
export async function resolvePortalEvent(token: string | null | undefined): Promise<PortalEventRef | null> {
  if (!isPlausibleToken(token)) return null;
  return prisma.event.findUnique({ where: { portalToken: token }, select: portalEventSelect });
}

const inviteEventSelect = {
  id: true,
  title: true,
  status: true,
  startsAt: true,
  endsAt: true,
  micrositeSlug: true,
  micrositeEnabled: true,
  inviteToken: true,
  portalToken: true,
} satisfies Prisma.EventSelect;

export type InviteEventRef = Prisma.EventGetPayload<{ select: typeof inviteEventSelect }>;

const inviteGuestSelect = {
  id: true,
  eventId: true,
  name: true,
  email: true,
  phone: true,
  token: true,
  rsvpStatus: true,
  plusOne: true,
  plusOneName: true,
  dietaryRestrictions: true,
  dietaryNotes: true,
  comment: true,
  source: true,
  photoConsent: true,
  respondedAt: true,
} satisfies Prisma.EventGuestSelect;

export type InviteGuestRef = Prisma.EventGuestGetPayload<{ select: typeof inviteGuestSelect }>;

export type ResolvedInvite = {
  event: InviteEventRef;
  /** Invitada (si el token es personal) */
  guest: InviteGuestRef | null;
  via: "invite" | "guest";
};

/**
 * Resuelve /e/[slug]/[token]: el token puede ser la invitación general (Event.inviteToken)
 * o el token personal de una invitada (EventGuest.token) del MISMO evento.
 * El slug debe coincidir y el micrositio debe estar habilitado; si no → null (404).
 */
export async function resolveInvite(
  slug: string | null | undefined,
  token: string | null | undefined,
): Promise<ResolvedInvite | null> {
  if (!isPlausibleToken(token)) return null;
  if (typeof slug !== "string" || slug.length > 100 || !SLUG_RE.test(slug)) return null;
  const event = await prisma.event.findUnique({ where: { micrositeSlug: slug }, select: inviteEventSelect });
  if (!event || !event.micrositeEnabled) return null;
  if (safeEqual(event.inviteToken, token)) return { event, guest: null, via: "invite" };
  const guest = await prisma.eventGuest.findUnique({ where: { token }, select: inviteGuestSelect });
  if (!guest || guest.eventId !== event.id) return null;
  return { event, guest, via: "guest" };
}

// -----------------------------------------------------------------------------
// Dashboard del portal
// -----------------------------------------------------------------------------

export type PortalGuest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: RsvpStatus;
  plusOne: boolean;
  plusOneName: string | null;
  dietaryRestrictions: DietaryRestriction[];
  dietaryNotes: string | null;
  comment: string | null;
  source: GuestSource;
  respondedAt: Date | null;
  inviteUrl: string;
  whatsappUrl: string;
  canRemove: boolean;
};

export type PortalMessage = {
  id: string;
  authorType: MessageAuthorType;
  authorName: string;
  body: string;
  createdAt: Date;
};

export type PortalDashboard = {
  token: string;
  now: Date;
  event: {
    id: string;
    code: string;
    title: string;
    status: EventStatus;
    occasion: Occasion;
    honoreeName: string | null;
    eventDate: Date;
    startsAt: Date;
    endsAt: Date;
    dateLabel: string;
    startTime: string;
    endTime: string;
    guestCount: number;
    addressLine: string | null;
    addressNotes: string | null;
    neighborhood: string | null;
    city: string;
    postalCode: string | null;
    mapsUrl: string | null;
    mapsLink: string | null;
    colors: string[];
    dressCode: string | null;
    hostMessage: string | null;
    playlistUrl: string | null;
    customerNotes: string | null;
    micrositeEnabled: boolean;
    cancellationReason: string | null;
  };
  host: { name: string; firstName: string };
  experience: { name: string; includes: string[]; coverImageUrl: string | null } | null;
  style: { name: string; palette: string[]; imageUrl: string | null } | null;
  menu: MenuView | null;
  addOns: Array<{ id: string; name: string; quantity: number }>;
  payment: {
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    depositRequiredCents: number;
    balanceDueAt: Date | null;
    cta: PaymentCta | null;
    paymentsEnabled: boolean;
  } | null;
  guests: PortalGuest[];
  stats: RsvpStats;
  honoreeMessageCount: number;
  timeline: Array<{ id: string; time: string; title: string; description: string | null; visibleToGuests: boolean }>;
  messages: PortalMessage[];
  memory: { enabled: boolean; url: string | null };
  review: { rating: number; npsScore: number | null; comment: string | null; createdAt: Date } | null;
  permissions: { editable: boolean; canEditAddress: boolean; canReview: boolean };
  /** invite/portal: URLs absolutas para compartir; *Path: rutas relativas para navegar */
  links: { invite: string; invitePath: string; portal: string; summary: string };
  invitationText: string;
  business: { brandName: string; contactEmail: string; whatsappNumber: string; whatsappUrl: string };
};

/** Selección explícita: nunca se leen notas internas, costos ni snapshots de cierre. */
const dashboardSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  occasion: true,
  honoreeName: true,
  eventDate: true,
  startsAt: true,
  endsAt: true,
  guestCount: true,
  addressLine: true,
  addressNotes: true,
  neighborhood: true,
  city: true,
  postalCode: true,
  mapsUrl: true,
  colors: true,
  dressCode: true,
  hostMessage: true,
  playlistUrl: true,
  customerNotes: true,
  micrositeSlug: true,
  micrositeEnabled: true,
  inviteToken: true,
  cancellationReason: true,
  customer: { select: { name: true } },
  experience: { select: { name: true, includes: true, coverImageUrl: true } },
  style: { select: { name: true, palette: true, imageUrl: true } },
  menu: {
    select: {
      name: true,
      description: true,
      dietaryTags: true,
      items: {
        select: { id: true, name: true, description: true, course: true, dietaryTags: true, sortOrder: true },
      },
    },
  },
  addOns: { select: { id: true, quantity: true, addOn: { select: { name: true } } } },
  booking: {
    select: {
      totalCents: true,
      depositRequiredCents: true,
      balanceDueAt: true,
      payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
    },
  },
  guests: {
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      token: true,
      rsvpStatus: true,
      plusOne: true,
      plusOneName: true,
      dietaryRestrictions: true,
      dietaryNotes: true,
      comment: true,
      source: true,
      respondedAt: true,
    },
  },
  timeline: {
    orderBy: [{ sortOrder: "asc" }, { time: "asc" }],
    select: { id: true, time: true, title: true, description: true, visibleToGuests: true },
  },
  messages: {
    where: { kind: "HOST_THREAD", hidden: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, authorType: true, authorName: true, body: true, createdAt: true },
  },
  memoryCapsule: { select: { published: true, shareToken: true } },
  review: { select: { rating: true, npsScore: true, comment: true, createdAt: true } },
  _count: { select: { messages: { where: { kind: "HONOREE", hidden: false } } } },
} satisfies Prisma.EventSelect;

/** Datos completos del portal "Mi evento" (sin datos internos: costos, notas internas, staff). */
export async function getPortalDashboard(token: string, now: Date = new Date()): Promise<PortalDashboard | null> {
  if (!isPlausibleToken(token)) return null;
  const event = await prisma.event.findUnique({ where: { portalToken: token }, select: dashboardSelect });
  if (!event) return null;

  const [business, memoryEnabled, paymentsEnabled] = await Promise.all([
    getSettings("business"),
    isEnabled("MEMORY_CAPSULE_ENABLED"),
    isEnabled("PAYMENTS_ENABLED"),
  ]);

  const hostName = event.customer.name;
  const dateLabel = formatLongDate(event.eventDate);
  const startTime = localTime(event.startsAt);
  const inviteUrl = appUrl(`/e/${event.micrositeSlug}/${event.inviteToken}`);
  const invitationBase = {
    hostName,
    title: event.title,
    dateLabel,
    timeLabel: startTime,
    neighborhood: event.neighborhood,
    city: event.city,
  };

  const guests: PortalGuest[] = event.guests.map((g) => {
    const url = appUrl(`/e/${event.micrositeSlug}/${g.token}`);
    const text = buildGuestInvitationText({ ...invitationBase, guestName: g.name, url });
    return {
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      rsvpStatus: g.rsvpStatus,
      plusOne: g.plusOne,
      plusOneName: g.plusOneName,
      dietaryRestrictions: g.dietaryRestrictions,
      dietaryNotes: g.dietaryNotes,
      comment: g.comment,
      source: g.source,
      respondedAt: g.respondedAt,
      inviteUrl: url,
      whatsappUrl: whatsappLink(g.phone, text),
      canRemove: g.source === "HOST" && g.rsvpStatus === "PENDING",
    };
  });

  let payment: PortalDashboard["payment"] = null;
  if (event.booking) {
    const paid = netPaidCents(event.booking.payments);
    const total = event.booking.totalCents;
    payment = {
      totalCents: total,
      paidCents: paid,
      balanceCents: Math.max(0, total - paid),
      depositRequiredCents: event.booking.depositRequiredCents,
      balanceDueAt: event.booking.balanceDueAt,
      cta: paymentCta({
        status: event.status,
        totalCents: total,
        paidCents: paid,
        depositRequiredCents: event.booking.depositRequiredCents,
      }),
      paymentsEnabled,
    };
  }

  const editable = isPortalEditable(event.status);
  const businessWhatsapp = whatsappLink(
    business.whatsappNumber,
    `Hola, soy ${firstName(hostName)} (${event.code}). Tengo una pregunta sobre ${event.title}.`,
  );

  return {
    token,
    now,
    event: {
      id: event.id,
      code: event.code,
      title: event.title,
      status: event.status,
      occasion: event.occasion,
      honoreeName: event.honoreeName,
      eventDate: event.eventDate,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      dateLabel,
      startTime,
      endTime: localTime(event.endsAt),
      guestCount: event.guestCount,
      addressLine: event.addressLine,
      addressNotes: event.addressNotes,
      neighborhood: event.neighborhood,
      city: event.city,
      postalCode: event.postalCode,
      mapsUrl: event.mapsUrl,
      mapsLink: mapsLink(event),
      colors: event.colors,
      dressCode: event.dressCode,
      hostMessage: event.hostMessage,
      playlistUrl: event.playlistUrl,
      customerNotes: event.customerNotes,
      micrositeEnabled: event.micrositeEnabled,
      cancellationReason: event.cancellationReason,
    },
    host: { name: hostName, firstName: firstName(hostName) },
    experience: event.experience,
    style: event.style,
    menu: buildMenuView(event.menu),
    addOns: event.addOns.map((a) => ({ id: a.id, name: a.addOn.name, quantity: a.quantity })),
    payment,
    guests,
    stats: rsvpStats(event.guests),
    honoreeMessageCount: event._count.messages,
    timeline: event.timeline.map((t) => ({
      id: t.id,
      time: t.time,
      title: t.title,
      description: t.description,
      visibleToGuests: t.visibleToGuests,
    })),
    messages: [...event.messages].reverse(),
    memory: {
      enabled: memoryEnabled,
      url:
        memoryEnabled && event.memoryCapsule?.published ? `/memory/${event.memoryCapsule.shareToken}` : null,
    },
    review: event.review,
    permissions: {
      editable,
      canEditAddress: canEditAddress(event.status, event.startsAt, now),
      canReview: event.status === "COMPLETED" && !event.review,
    },
    links: {
      invite: inviteUrl,
      invitePath: `/e/${event.micrositeSlug}/${event.inviteToken}`,
      portal: appUrl(`/mi-evento/${token}`),
      summary: `/mi-evento/${token}/resumen`,
    },
    invitationText: buildInvitationText({ ...invitationBase, url: inviteUrl }),
    business: {
      brandName: business.brandName,
      contactEmail: business.contactEmail,
      whatsappNumber: business.whatsappNumber,
      whatsappUrl: businessWhatsapp,
    },
  };
}

// -----------------------------------------------------------------------------
// "Entra a tu evento": enlace de acceso por email (sin enumeración de cuentas)
// -----------------------------------------------------------------------------

export type PortalAccessResult = { message: string };

/**
 * Si existe una clienta con ese email y tiene eventos no cancelados (próximos o de los últimos
 * 60 días), le envía (PORTAL_ACCESS) sus enlaces al portal. SIEMPRE devuelve el mismo resultado.
 */
export async function requestPortalAccess(email: string, now: Date = new Date()): Promise<PortalAccessResult> {
  const neutral: PortalAccessResult = { message: PORTAL_ACCESS_NEUTRAL_MESSAGE };
  const normalized = email.trim().toLowerCase();
  if (!normalized) return neutral;
  try {
    const cutoff = new Date(now.getTime() - PORTAL_ACCESS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const customer = await prisma.customer.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: {
        name: true,
        email: true,
        events: {
          where: { status: { not: "CANCELLED" }, endsAt: { gte: cutoff } },
          orderBy: { startsAt: "asc" },
          take: 10,
          select: { id: true, title: true, eventDate: true, endsAt: true, portalToken: true },
        },
      },
    });
    if (!customer?.email || customer.events.length === 0) return neutral;

    const events = customer.events;
    // El enlace principal es el del próximo evento; si todos ya pasaron, el más reciente.
    const first = events.find((e) => e.endsAt.getTime() >= now.getTime()) ?? events[events.length - 1]!;
    const list = events
      .map((e) => `${e.title} (${formatLongDate(e.eventDate)}): ${appUrl(`/mi-evento/${e.portalToken}`)}`)
      .join(" · ");
    await notify({
      type: "PORTAL_ACCESS",
      channel: "EMAIL",
      to: customer.email,
      eventId: first.id,
      data: {
        name: customer.name,
        eventTitle: first.title,
        eventDate: formatLongDate(first.eventDate),
        url: appUrl(`/mi-evento/${first.portalToken}`),
        message:
          events.length > 1
            ? `Tienes ${events.length} eventos con nosotras: ${list}. El enlace es personal: no lo compartas.`
            : `Evento: ${first.title} (${formatLongDate(first.eventDate)}). El enlace es personal: no lo compartas.`,
      },
    });
  } catch (error) {
    // Nunca revelar errores ni existencia de la cuenta.
    logger.error("portal.access_request_failed", { error });
  }
  return neutral;
}
