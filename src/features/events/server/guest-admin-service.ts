import "server-only";
import { prisma } from "@/db";
import { toCsv } from "@/lib/csv";
import { formatDateTime, formatLongDate, localDateKey, toDateKey } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { notify } from "@/features/notifications/server/notification-service";
import { possibleDuplicateIds } from "@/features/guests/domain/rsvp";
import { blankToNull } from "../domain/event-changes";
import {
  GUEST_CSV_HEADERS,
  aggregateDietary,
  guestCsvFilename,
  guestCsvRows,
  summarizeRsvp,
} from "../domain/guest-summary";
import type { GuestInput } from "../schemas";

const ID_RE = /^[a-z0-9_-]{8,40}$/i;

/** Datos de la pestaña Invitadas: invitadas, resumen RSVP, restricciones y mensajes a la homenajeada. */
export async function getGuestsOverview(eventId: string) {
  if (!ID_RE.test(eventId)) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      guestCount: true,
      eventDate: true,
      micrositeSlug: true,
      micrositeEnabled: true,
      honoreeName: true,
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
          invitedAt: true,
          createdAt: true,
        },
      },
      messages: {
        where: { kind: "HONOREE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          authorName: true,
          body: true,
          hidden: true,
          createdAt: true,
          guest: { select: { name: true } },
        },
      },
    },
  });
  if (!event) return null;
  return {
    event,
    summary: summarizeRsvp(event.guests),
    dietary: aggregateDietary(event.guests),
    /** Auto-registros del link general que coinciden con otra invitada (revisión del equipo) */
    possibleDuplicates: possibleDuplicateIds(event.guests),
  };
}
export type GuestsOverview = NonNullable<Awaited<ReturnType<typeof getGuestsOverview>>>;
export type AdminGuest = GuestsOverview["event"]["guests"][number];

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true } });
  if (!event) throw new NotFoundError("No encontramos este evento.");
  return event;
}

function guestData(input: GuestInput) {
  return {
    name: input.name.trim(),
    email: blankToNull(input.email)?.toLowerCase() ?? null,
    phone: blankToNull(input.phone),
    rsvpStatus: input.rsvpStatus,
    plusOne: input.plusOne,
    plusOneName: input.plusOne ? blankToNull(input.plusOneName) : null,
    dietaryRestrictions: Array.from(new Set(input.dietaryRestrictions)),
    dietaryNotes: blankToNull(input.dietaryNotes),
    comment: blankToNull(input.comment),
  };
}

const phoneDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").slice(-10);

/**
 * Evita registrar dos veces a la misma invitada (mismo correo o teléfono) en un evento.
 * Es un aviso confirmable (código DUPLICATE_GUEST): una familia puede compartir WhatsApp o correo.
 * Sólo revisa los datos nuevos o cambiados, para no bloquear la edición de duplicados previos.
 */
async function assertNoDuplicateContact(
  eventId: string,
  guestId: string | null,
  data: { email: string | null; phone: string | null },
): Promise<void> {
  const phone = phoneDigits(data.phone);
  if (!data.email && phone.length < 10) return;
  const others = await prisma.eventGuest.findMany({
    where: { eventId, ...(guestId ? { id: { not: guestId } } : {}) },
    select: { name: true, email: true, phone: true },
  });
  const fieldErrors: Record<string, string[]> = {};
  const sameEmail = data.email ? others.find((o) => o.email?.toLowerCase() === data.email) : undefined;
  if (sameEmail) fieldErrors.email = [`${sameEmail.name} ya está en la lista con este correo.`];
  const samePhone = phone.length >= 10 ? others.find((o) => phoneDigits(o.phone) === phone) : undefined;
  if (samePhone) fieldErrors.phone = [`${samePhone.name} ya está en la lista con este teléfono.`];
  if (Object.keys(fieldErrors).length) {
    const error = new AppError(
      "Parece que esta invitada ya está en la lista. Si es otra persona que comparte contacto, confirma para guardarla.",
      "DUPLICATE_GUEST",
      409,
    );
    throw Object.assign(error, { fieldErrors });
  }
}

/** Alta o edición de una invitada desde el admin. */
export async function saveGuest(
  input: GuestInput,
  actor: SessionUser,
): Promise<{ id: string; created: boolean }> {
  await assertEventExists(input.eventId);
  const data = guestData(input);
  const guestId = blankToNull(input.guestId);

  const current = guestId
    ? await prisma.eventGuest.findFirst({
        where: { id: guestId, eventId: input.eventId },
        select: { id: true, rsvpStatus: true, respondedAt: true, email: true, phone: true },
      })
    : null;
  if (guestId && !current) throw new NotFoundError("Esa invitada ya no existe.");
  if (!input.allowDuplicateContact) {
    await assertNoDuplicateContact(input.eventId, guestId, {
      email: !current || current.email?.toLowerCase() !== data.email ? data.email : null,
      phone: !current || phoneDigits(current.phone) !== phoneDigits(data.phone) ? data.phone : null,
    });
  }

  if (current) {
    const respondedAt =
      current.rsvpStatus !== data.rsvpStatus && data.rsvpStatus !== "PENDING"
        ? new Date()
        : data.rsvpStatus === "PENDING"
          ? null
          : current.respondedAt;
    await prisma.eventGuest.update({ where: { id: current.id }, data: { ...data, respondedAt } });
    if (current.rsvpStatus !== data.rsvpStatus) {
      await audit({
        action: "guest.rsvp_changed",
        entityType: "EventGuest",
        entityId: current.id,
        before: { rsvpStatus: current.rsvpStatus },
        after: { rsvpStatus: data.rsvpStatus, eventId: input.eventId },
        actor,
      });
    }
    return { id: current.id, created: false };
  }

  const created = await prisma.eventGuest.create({
    data: {
      ...data,
      eventId: input.eventId,
      token: generateToken(),
      source: "ADMIN",
      respondedAt: data.rsvpStatus === "PENDING" ? null : new Date(),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

export async function deleteGuest(
  input: { eventId: string; guestId: string },
  actor: SessionUser,
): Promise<void> {
  const guest = await prisma.eventGuest.findFirst({
    where: { id: input.guestId, eventId: input.eventId },
    select: { id: true, name: true, rsvpStatus: true },
  });
  if (!guest) throw new NotFoundError("Esa invitada ya no existe.");
  await prisma.eventGuest.delete({ where: { id: guest.id } });
  await audit({
    action: "guest.deleted",
    entityType: "EventGuest",
    entityId: guest.id,
    before: { name: guest.name, rsvpStatus: guest.rsvpStatus, eventId: input.eventId },
    actor,
  });
}

export type ReminderResult = {
  sent: number;
  /** Invitadas a las que no se pudo entregar por ningún canal (canal desactivado, teléfono inválido, error) */
  failed: number;
  alreadySentToday: number;
  withoutContact: number;
  pending: number;
};

/**
 * Recordatorio RSVP a invitadas pendientes con teléfono o correo.
 * Idempotente por día: dedupeKey por invitada + canal + fecha local.
 */
export async function sendRsvpReminders(eventId: string, actor: SessionUser): Promise<ReminderResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      status: true,
      eventDate: true,
      micrositeSlug: true,
      micrositeEnabled: true,
      guests: {
        where: { rsvpStatus: "PENDING" },
        select: { id: true, name: true, email: true, phone: true, token: true, invitedAt: true },
      },
    },
  });
  if (!event) throw new NotFoundError("No encontramos este evento.");
  if (
    event.status === "CANCELLED" ||
    event.status === "COMPLETED" ||
    toDateKey(event.eventDate) < localDateKey()
  ) {
    throw new AppError("Este evento ya no admite recordatorios.", "EVENT_CLOSED", 409);
  }
  if (!event.micrositeEnabled) {
    throw new AppError(
      "Activa el micrositio para que las invitadas puedan confirmar.",
      "MICROSITE_DISABLED",
      409,
    );
  }

  const day = localDateKey();
  const reachable = event.guests.filter((g) => g.phone || g.email);
  const prefix = (guestId: string) => `rsvp-reminder:${guestId}:${day}:`;
  const existing = reachable.length
    ? await prisma.notificationLog.findMany({
        where: { OR: reachable.map((g) => ({ dedupeKey: { startsWith: prefix(g.id) } })) },
        select: { dedupeKey: true, status: true },
      })
    : [];
  /**
   * Clave de dedupe del canal para hoy, o null si ya se entregó (o se omitió por canal
   * desactivado / teléfono inválido). Un intento FAILED (error del proveedor) puede reintentarse
   * el mismo día con una clave nueva (…:email:r2, …:email:r3).
   */
  const nextKey = (guestId: string, channel: "email" | "wa"): string | null => {
    const base = `${prefix(guestId)}${channel}`;
    const attempts = existing.filter((e) => e.dedupeKey === base || e.dedupeKey?.startsWith(`${base}:r`));
    if (attempts.some((e) => e.status !== "FAILED")) return null;
    return attempts.length === 0 ? base : `${base}:r${attempts.length + 1}`;
  };

  let sent = 0;
  let failed = 0;
  let alreadySentToday = 0;
  const eventDate = formatLongDate(event.eventDate);
  for (const g of reachable) {
    const emailKey = g.email ? nextKey(g.id, "email") : null;
    const waKey = g.phone ? nextKey(g.id, "wa") : null;
    if (!emailKey && !waKey) {
      alreadySentToday += 1;
      continue;
    }
    const data = {
      name: g.name,
      eventTitle: event.title,
      eventDate,
      url: appUrl(`/e/${event.micrositeSlug}/${g.token}`),
    };
    const results = await Promise.all([
      emailKey
        ? notify({
            type: "RSVP_REMINDER",
            channel: "EMAIL",
            to: g.email,
            eventId: event.id,
            data,
            dedupeKey: emailKey,
          })
        : null,
      waKey
        ? notify({
            type: "RSVP_REMINDER",
            channel: "WHATSAPP",
            to: g.phone,
            eventId: event.id,
            data,
            dedupeKey: waKey,
          })
        : null,
    ]);
    const delivered = results.some((r) => r && r.status !== "FAILED" && r.status !== "SKIPPED");
    if (!delivered) {
      failed += 1;
      continue;
    }
    if (!g.invitedAt)
      await prisma.eventGuest.update({ where: { id: g.id }, data: { invitedAt: new Date() } });
    sent += 1;
  }

  if (sent > 0) {
    await audit({
      action: "event.rsvp_reminders_sent",
      entityType: "Event",
      entityId: event.id,
      after: { sent, failed, day },
      actor,
    });
  }
  return {
    sent,
    failed,
    alreadySentToday,
    withoutContact: event.guests.length - reachable.length,
    pending: event.guests.length,
  };
}

/** Moderación de mensajes para la homenajeada (ocultar / mostrar). */
export async function setHonoreeMessageHidden(
  input: { eventId: string; messageId: string; hidden: boolean },
  actor: SessionUser,
): Promise<void> {
  const res = await prisma.eventMessage.updateMany({
    where: { id: input.messageId, eventId: input.eventId, kind: "HONOREE" },
    data: { hidden: input.hidden },
  });
  if (res.count === 0) throw new NotFoundError("Ese mensaje ya no existe.");
  await audit({
    action: input.hidden ? "message.hidden" : "message.unhidden",
    entityType: "EventMessage",
    entityId: input.messageId,
    after: { hidden: input.hidden, eventId: input.eventId },
    actor,
  });
}

/** CSV de invitadas (con BOM para Excel). null si el evento no existe. */
export async function buildGuestsCsv(
  eventId: string,
): Promise<{ filename: string; csv: string; count: number } | null> {
  if (!ID_RE.test(eventId)) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      code: true,
      guests: {
        orderBy: [{ rsvpStatus: "asc" }, { name: "asc" }],
        select: {
          name: true,
          email: true,
          phone: true,
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
    },
  });
  if (!event) return null;
  const csv = toCsv(
    GUEST_CSV_HEADERS,
    guestCsvRows(event.guests, (d) => formatDateTime(d)),
  );
  return { filename: guestCsvFilename(event.code), csv, count: event.guests.length };
}
