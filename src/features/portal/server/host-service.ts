import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { isPlausibleToken } from "@/lib/tokens";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { getSettings } from "@/features/settings/server/settings-service";
import { notify } from "@/features/notifications/server/notification-service";
import {
  canEditAddress,
  changedPreferenceKeys,
  emptyToNull,
  isPortalEditable,
  joinSpanish,
  preferenceChangeMessage,
  type HostPreferences,
} from "../domain/portal";
import type {
  AddressFormValues,
  HostMessageFormValues,
  PreferencesFormValues,
  ReviewFormValues,
} from "../schemas";

/**
 * Mutaciones de la anfitriona desde su portal (acceso por Event.portalToken, sin sesión).
 * El "actor" es el token: cada operación vuelve a resolver el evento y valida su estado.
 */
export type HostContext = { ip?: string | null };

const NOT_FOUND_MESSAGE = "No encontramos tu evento. Revisa que el enlace esté completo.";
const CLOSED_MESSAGE = "Este evento ya no admite cambios. Si necesitas algo, escríbenos.";
const SYSTEM_AUTHOR = "Ivonne & Rosa";

function assertToken(token: string) {
  if (!isPlausibleToken(token)) throw new NotFoundError(NOT_FOUND_MESSAGE);
}

// -----------------------------------------------------------------------------
// Preferencias
// -----------------------------------------------------------------------------

function normalizeColors(colors: string[]): string[] {
  const out: string[] = [];
  for (const c of colors) {
    const v = c.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export async function updateHostPreferences(
  token: string,
  input: PreferencesFormValues,
  ctx: HostContext = {},
): Promise<{ changed: Array<keyof HostPreferences> }> {
  assertToken(token);
  const event = await prisma.event.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      status: true,
      colors: true,
      honoreeName: true,
      customerNotes: true,
      dressCode: true,
      hostMessage: true,
      playlistUrl: true,
    },
  });
  if (!event) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (!isPortalEditable(event.status)) throw new AppError(CLOSED_MESSAGE, "EVENT_CLOSED", 409);

  const before: HostPreferences = {
    colors: event.colors,
    honoreeName: event.honoreeName,
    customerNotes: event.customerNotes,
    dressCode: event.dressCode,
    hostMessage: event.hostMessage,
    playlistUrl: event.playlistUrl,
  };
  const after: HostPreferences = {
    colors: normalizeColors(input.colors),
    honoreeName: emptyToNull(input.honoreeName),
    customerNotes: emptyToNull(input.customerNotes),
    dressCode: emptyToNull(input.dressCode),
    hostMessage: emptyToNull(input.hostMessage),
    playlistUrl: emptyToNull(input.playlistUrl),
  };
  const changed = changedPreferenceKeys(before, after);
  if (changed.length === 0) return { changed };

  const pick = (p: HostPreferences) => Object.fromEntries(changed.map((k) => [k, p[k]]));
  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: event.id }, data: after });
    await tx.eventMessage.create({
      data: {
        eventId: event.id,
        kind: "HOST_THREAD",
        authorType: "SYSTEM",
        authorName: SYSTEM_AUTHOR,
        body: preferenceChangeMessage(changed)!,
      },
    });
    await audit(
      {
        action: "event.host_preferences_updated",
        entityType: "Event",
        entityId: event.id,
        before: pick(before),
        after: pick(after),
        ip: ctx.ip ?? null,
      },
      tx,
    );
  });
  return { changed };
}

// -----------------------------------------------------------------------------
// Dirección (editable hasta 48 h antes)
// -----------------------------------------------------------------------------

const ADDRESS_LABELS = {
  addressLine: "la dirección",
  neighborhood: "la colonia",
  postalCode: "el código postal",
  addressNotes: "las indicaciones de acceso",
  mapsUrl: "el enlace de mapas",
} as const;

export async function updateHostAddress(
  token: string,
  input: AddressFormValues,
  ctx: HostContext = {},
  now: Date = new Date(),
): Promise<{ changed: string[] }> {
  assertToken(token);
  const event = await prisma.event.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      status: true,
      startsAt: true,
      addressLine: true,
      neighborhood: true,
      postalCode: true,
      addressNotes: true,
      mapsUrl: true,
    },
  });
  if (!event) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (!canEditAddress(event.status, event.startsAt, now)) {
    throw new AppError(
      "Faltan menos de 48 horas para tu evento. Para cambiar la dirección, escríbenos en Mensajes o por WhatsApp.",
      "ADDRESS_LOCKED",
      409,
    );
  }
  const after = {
    addressLine: input.addressLine.trim(),
    neighborhood: input.neighborhood.trim(),
    postalCode: emptyToNull(input.postalCode),
    addressNotes: emptyToNull(input.addressNotes),
    mapsUrl: emptyToNull(input.mapsUrl),
  };
  const keys = (Object.keys(ADDRESS_LABELS) as Array<keyof typeof ADDRESS_LABELS>).filter(
    (k) => (event[k] ?? null) !== (after[k] ?? null),
  );
  if (keys.length === 0) return { changed: [] };
  const before = Object.fromEntries(keys.map((k) => [k, event[k]]));
  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: event.id }, data: after });
    await tx.eventMessage.create({
      data: {
        eventId: event.id,
        kind: "HOST_THREAD",
        authorType: "SYSTEM",
        authorName: SYSTEM_AUTHOR,
        body: `La anfitriona actualizó ${joinSpanish(keys.map((k) => ADDRESS_LABELS[k]))}.`,
      },
    });
    await audit(
      {
        action: "event.host_address_updated",
        entityType: "Event",
        entityId: event.id,
        before,
        after: Object.fromEntries(keys.map((k) => [k, after[k]])),
        ip: ctx.ip ?? null,
      },
      tx,
    );
  });
  return { changed: keys };
}

// -----------------------------------------------------------------------------
// Mensajes con el equipo
// -----------------------------------------------------------------------------

export async function sendHostMessage(
  token: string,
  input: HostMessageFormValues,
): Promise<{ id: string; body: string; authorName: string; createdAt: Date }> {
  assertToken(token);
  const event = await prisma.event.findUnique({
    where: { portalToken: token },
    select: { id: true, code: true, title: true, status: true, customer: { select: { name: true } } },
  });
  if (!event) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (event.status === "CANCELLED") throw new AppError(CLOSED_MESSAGE, "EVENT_CLOSED", 409);
  const body = input.body.trim();
  const message = await prisma.eventMessage.create({
    data: {
      eventId: event.id,
      kind: "HOST_THREAD",
      authorType: "CUSTOMER",
      authorName: event.customer.name,
      body,
    },
    select: { id: true, body: true, authorName: true, createdAt: true },
  });

  // Aviso al equipo (nunca rompe el flujo)
  try {
    const settings = await getSettings("notifications");
    await notify({
      type: "GENERIC",
      channel: "EMAIL",
      to: settings.ownerNotificationEmail,
      eventId: event.id,
      data: {
        name: "equipo",
        eventTitle: `Nuevo mensaje de ${event.customer.name} (${event.code})`,
        message: `${event.customer.name} escribió en el portal de «${event.title}»: "${body.slice(0, 280)}${body.length > 280 ? "…" : ""}"`,
        url: appUrl(`/admin/events/${event.id}`),
      },
    });
  } catch {
    // notify ya registra el error
  }
  return message;
}

// -----------------------------------------------------------------------------
// Opinión posterior al evento
// -----------------------------------------------------------------------------

export async function submitHostReview(token: string, input: ReviewFormValues): Promise<{ id: string }> {
  assertToken(token);
  const event = await prisma.event.findUnique({
    where: { portalToken: token },
    select: { id: true, status: true, customerId: true, review: { select: { id: true } } },
  });
  if (!event) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (event.status !== "COMPLETED") {
    throw new AppError("Podrás dejarnos tu opinión cuando termine tu celebración.", "REVIEW_NOT_AVAILABLE", 409);
  }
  if (event.review) throw new ConflictError("Ya recibimos tu opinión. ¡Gracias por tomarte el tiempo!");
  try {
    return await prisma.review.create({
      data: {
        eventId: event.id,
        customerId: event.customerId,
        rating: input.rating,
        npsScore: input.npsScore,
        comment: emptyToNull(input.comment),
        publishable: input.publishable,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Ya recibimos tu opinión. ¡Gracias por tomarte el tiempo!");
    }
    throw error;
  }
}
