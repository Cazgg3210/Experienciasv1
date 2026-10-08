import "server-only";
import type { DietaryRestriction, EventStatus, Occasion, RsvpStatus } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { formatLongDate, localTime } from "@/lib/dates";
import { getSettings } from "@/features/settings/server/settings-service";
import { resolveInvite } from "@/features/portal/server/portal-service";
import { isRsvpOpen, mapsLink, safeExternalUrl } from "@/features/portal/domain/portal";
import { buildMenuView, type MenuView } from "@/features/portal/domain/menu";
import { GENERAL_INVITE_FULL_MESSAGE, canSeeFullAddress, canSelfRegister, firstName, maskEmail } from "../domain/rsvp";
import { buildIcs } from "../domain/ics";

export type InviteView = {
  via: "invite" | "guest";
  slug: string;
  token: string;
  event: {
    title: string;
    status: EventStatus;
    occasion: Occasion;
    honoreeName: string | null;
    startsAt: Date;
    endsAt: Date;
    dateLabel: string;
    startTime: string;
    endTime: string;
    neighborhood: string | null;
    city: string;
    colors: string[];
    dressCode: string | null;
    hostMessage: string | null;
    playlistUrl: string | null;
    cancelled: boolean;
    rsvpOpen: boolean;
  };
  /** Dirección completa: sólo para la invitada que confirmó que asiste */
  address: { addressLine: string | null; postalCode: string | null; addressNotes: string | null; mapsLink: string | null } | null;
  hostFirstName: string;
  experienceName: string | null;
  cover: { src: string; alt: string } | null;
  palette: string[];
  menu: MenuView | null;
  timeline: Array<{ id: string; time: string; title: string; description: string | null }>;
  guest: {
    name: string;
    /** Email enmascarado (nunca el completo: ver maskEmail) */
    emailHint: string | null;
    rsvpStatus: RsvpStatus;
    plusOne: boolean;
    plusOneName: string | null;
    dietaryRestrictions: DietaryRestriction[];
    dietaryNotes: string | null;
    comment: string | null;
    photoConsent: boolean;
    honoreeMessage: string | null;
    respondedAt: Date | null;
  } | null;
  calendarPath: string;
  shareUrl: string;
  brandName: string;
  /**
   * Link general con la lista en su tope (`canSelfRegister`: el mismo criterio con que `submitRsvp` rechaza con
   * `GUEST_LIMIT`): el micrositio pinta este aviso desde el servidor en lugar del formulario. Es el mismo texto
   * del error, sin números ni nombres. null con el link personal (no cuenta contra el tope) o si hay lugar. El
   * servidor sigue validando al enviar: un formulario abierto antes de que la lista se llenara recibe `GUEST_LIMIT`.
   */
  generalInviteClosedNotice: string | null;
};

/** Datos públicos del micrositio. Nunca incluye datos de otras invitadas ni datos internos. */
export async function getInviteView(slug: string, token: string): Promise<InviteView | null> {
  const resolved = await resolveInvite(slug, token);
  if (!resolved) return null;
  // Defensa en profundidad: la dirección exacta ni siquiera se lee si la invitada no confirmó.
  const full = canSeeFullAddress(resolved.guest);

  const [event, business, honoree, listSize] = await Promise.all([
    prisma.event.findUnique({
      where: { id: resolved.event.id },
      select: {
        title: true,
        status: true,
        occasion: true,
        honoreeName: true,
        eventDate: true,
        startsAt: true,
        endsAt: true,
        guestCount: true,
        addressLine: full,
        addressNotes: full,
        neighborhood: true,
        city: true,
        postalCode: full,
        mapsUrl: full,
        colors: true,
        dressCode: true,
        hostMessage: true,
        playlistUrl: true,
        micrositeSlug: true,
        customer: { select: { name: true } },
        experience: { select: { name: true, coverImageUrl: true } },
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
        timeline: {
          where: { visibleToGuests: true },
          orderBy: [{ sortOrder: "asc" }, { time: "asc" }],
          select: { id: true, time: true, title: true, description: true },
        },
      },
    }),
    getSettings("business"),
    resolved.guest
      ? prisma.eventMessage.findFirst({
          where: { eventId: resolved.event.id, kind: "HONOREE", guestId: resolved.guest.id },
          orderBy: { createdAt: "desc" },
          select: { body: true },
        })
      : Promise.resolve(null),
    // Sólo el link general cuenta contra el tope (lista completa, como `submitRsvp`)
    resolved.via === "invite"
      ? prisma.eventGuest.count({ where: { eventId: resolved.event.id } })
      : Promise.resolve(null),
  ]);
  if (!event) return null;
  const generalInviteClosedNotice =
    listSize !== null && !canSelfRegister(listSize, event.guestCount) ? GENERAL_INVITE_FULL_MESSAGE : null;

  const g = resolved.guest;
  const coverSrc = isSafeImagePath(event.experience?.coverImageUrl)
    ? event.experience!.coverImageUrl!
    : isSafeImagePath(event.style?.imageUrl)
      ? event.style!.imageUrl!
      : null;

  return {
    via: resolved.via,
    slug: event.micrositeSlug,
    token,
    event: {
      title: event.title,
      status: event.status,
      occasion: event.occasion,
      honoreeName: event.honoreeName,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      dateLabel: formatLongDate(event.eventDate),
      startTime: localTime(event.startsAt),
      endTime: localTime(event.endsAt),
      neighborhood: event.neighborhood,
      city: event.city,
      colors: event.colors,
      dressCode: event.dressCode,
      hostMessage: event.hostMessage,
      playlistUrl: safeExternalUrl(event.playlistUrl),
      cancelled: event.status === "CANCELLED",
      rsvpOpen: isRsvpOpen(event.status, event.endsAt),
    },
    address: full
      ? {
          addressLine: event.addressLine ?? null,
          postalCode: event.postalCode ?? null,
          addressNotes: event.addressNotes ?? null,
          mapsLink: mapsLink(event),
        }
      : null,
    hostFirstName: firstName(event.customer.name),
    experienceName: event.experience?.name ?? null,
    cover: coverSrc ? { src: coverSrc, alt: event.experience?.name ?? event.style?.name ?? event.title } : null,
    palette: event.style?.palette ?? [],
    menu: buildMenuView(event.menu),
    timeline: event.timeline,
    guest: g
      ? {
          name: g.name,
          emailHint: maskEmail(g.email),
          rsvpStatus: g.rsvpStatus,
          plusOne: g.plusOne,
          plusOneName: g.plusOneName,
          dietaryRestrictions: g.dietaryRestrictions,
          dietaryNotes: g.dietaryNotes,
          comment: g.comment,
          photoConsent: g.photoConsent,
          honoreeMessage: honoree?.body ?? null,
          respondedAt: g.respondedAt,
        }
      : null,
    calendarPath: `/e/${event.micrositeSlug}/${token}/calendar.ics`,
    shareUrl: appUrl(`/e/${event.micrositeSlug}/${token}`),
    brandName: business.brandName,
    generalInviteClosedNotice,
  };
}

/** Sólo rutas locales (placeholders) o URLs http(s) para next/image. */
function isSafeImagePath(src: string | null | undefined): src is string {
  if (!src) return false;
  return src.startsWith("/images/");
}

/**
 * Archivo .ics para "Agregar a mi calendario". La ubicación completa sólo se incluye
 * si la invitada confirmó asistencia (mismo criterio de privacidad que el micrositio).
 */
export async function getInviteCalendar(
  slug: string,
  token: string,
): Promise<{ filename: string; content: string } | null> {
  const resolved = await resolveInvite(slug, token);
  if (!resolved || resolved.event.status === "CANCELLED") return null;
  const full = canSeeFullAddress(resolved.guest);
  const event = await prisma.event.findUnique({
    where: { id: resolved.event.id },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      addressLine: full,
      neighborhood: true,
      city: true,
      postalCode: full,
      addressNotes: full,
      dressCode: true,
      micrositeSlug: true,
    },
  });
  if (!event) return null;
  const location = full
    ? [event.addressLine, event.neighborhood, event.postalCode, event.city].filter(Boolean).join(", ")
    : [event.neighborhood, event.city].filter(Boolean).join(", ");
  const url = appUrl(`/e/${event.micrositeSlug}/${token}`);
  const description = [
    event.dressCode ? `Código de vestimenta: ${event.dressCode}` : null,
    full && event.addressNotes ? `Indicaciones: ${event.addressNotes}` : null,
    full ? null : "La dirección exacta aparece en tu invitación al confirmar tu asistencia.",
    `Tu invitación: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
  const content = buildIcs({
    uid: `${event.id}@ivonne-rosa`,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location,
    description,
    url,
  });
  return { filename: `${event.micrositeSlug}.ics`, content };
}
