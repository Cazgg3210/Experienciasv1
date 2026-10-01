import "server-only";
import type { RsvpStatus } from "@prisma/client";
import { prisma } from "@/db";
import { generateToken } from "@/lib/tokens";
import { AppError, NotFoundError } from "@/lib/errors";
import { track } from "@/server/analytics";
import { resolveInvite } from "@/features/portal/server/portal-service";
import { emptyToNull, isRsvpOpen } from "@/features/portal/domain/portal";
import { MAX_GUESTS_PER_EVENT, findMatchingGuest, normalizeEmail, sortDietary } from "../domain/rsvp";
import type { SubmitRsvpInput } from "../schemas";
import { lockEventGuests } from "./guest-service";

export type RsvpResult = {
  guestId: string;
  guestToken: string;
  name: string;
  rsvpStatus: RsvpStatus;
  eventId: string;
  slug: string;
  /** Sólo para revalidar rutas en servidor: NUNCA devolver al cliente */
  portalToken: string;
  /** "updated" si actualizó una invitada existente, "created" si la creó (link genérico) */
  outcome: "created" | "updated";
  via: "invite" | "guest";
};

/**
 * Registra la respuesta de una invitada desde el micrositio /e/[slug]/[token]:
 *  - token personal (EventGuest.token) → actualiza a esa invitada;
 *  - token genérico (Event.inviteToken) → busca a la invitada por nombre normalizado (y email)
 *    o crea una nueva con source SELF_RSVP y token propio.
 * El mensaje para la homenajeada se guarda como EventMessage HONOREE ligado a la invitada (uno por invitada).
 */
export async function submitRsvp(input: SubmitRsvpInput, now: Date = new Date()): Promise<RsvpResult> {
  const resolved = await resolveInvite(input.slug, input.token);
  if (!resolved) throw new NotFoundError("Este enlace de invitación ya no es válido.");
  const { event } = resolved;
  if (event.status === "CANCELLED") {
    throw new AppError("Este evento fue cancelado. Gracias por tu cariño.", "EVENT_CANCELLED", 409);
  }
  if (!isRsvpOpen(event.status, event.endsAt, now)) {
    throw new AppError("Las confirmaciones para este evento ya cerraron.", "RSVP_CLOSED", 409);
  }

  const r = input.rsvp;
  const attending = r.rsvpStatus === "ATTENDING";
  const email = normalizeEmail(r.email);
  const plusOne = attending && r.plusOne;
  const data = {
    name: r.name.trim().replace(/\s+/g, " "),
    rsvpStatus: r.rsvpStatus,
    plusOne,
    plusOneName: plusOne ? emptyToNull(r.plusOneName) : null,
    dietaryRestrictions: sortDietary(r.dietaryRestrictions),
    dietaryNotes: emptyToNull(r.dietaryNotes),
    comment: emptyToNull(r.comment),
    photoConsent: r.photoConsent,
    respondedAt: now,
    // Un email vacío no borra el que ya tenía registrado la anfitriona.
    ...(email ? { email } : {}),
  };
  const honoreeMessage = emptyToNull(r.honoreeMessage);

  const { guest, outcome } = await prisma.$transaction(async (tx) => {
    await lockEventGuests(tx, event.id);
    let outcome: RsvpResult["outcome"] = "updated";
    let targetId: string | null = resolved.guest?.id ?? null;

    if (!targetId) {
      const existing = await tx.eventGuest.findMany({
        where: { eventId: event.id },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      const match = findMatchingGuest(existing, { name: data.name, email });
      if (match) targetId = match.id;
      else if (existing.length >= MAX_GUESTS_PER_EVENT) {
        throw new AppError("La lista de invitadas ya está completa. Escríbele a la anfitriona.", "GUEST_LIMIT", 409);
      }
    }

    const guest = targetId
      ? await tx.eventGuest.update({
          where: { id: targetId },
          data,
          select: { id: true, token: true, name: true, rsvpStatus: true },
        })
      : await tx.eventGuest.create({
          data: { ...data, eventId: event.id, token: generateToken(), source: "SELF_RSVP" },
          select: { id: true, token: true, name: true, rsvpStatus: true },
        });
    if (!targetId) outcome = "created";

    const previous = await tx.eventMessage.findFirst({
      where: { eventId: event.id, kind: "HONOREE", guestId: guest.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true },
    });
    if (honoreeMessage) {
      if (!previous) {
        await tx.eventMessage.create({
          data: {
            eventId: event.id,
            kind: "HONOREE",
            authorType: "GUEST",
            authorName: guest.name,
            guestId: guest.id,
            body: honoreeMessage,
          },
        });
      } else if (previous.body !== honoreeMessage) {
        await tx.eventMessage.update({
          where: { id: previous.id },
          data: { body: honoreeMessage, authorName: guest.name },
        });
      }
    } else if (previous && resolved.via === "guest") {
      // Sólo con su link personal (formulario precargado) un mensaje vacío significa "bórralo".
      // Con el link genérico el formulario llega vacío: no se borra lo que ya había escrito.
      await tx.eventMessage.delete({ where: { id: previous.id } });
    }
    return { guest, outcome };
  });

  await track("RSVP_SUBMIT", {
    eventId: event.id,
    path: `/e/${event.micrositeSlug}`,
    metadata: { status: guest.rsvpStatus, via: resolved.via, outcome },
  });

  return {
    guestId: guest.id,
    guestToken: guest.token,
    name: guest.name,
    rsvpStatus: guest.rsvpStatus,
    eventId: event.id,
    slug: event.micrositeSlug,
    portalToken: event.portalToken,
    outcome,
    via: resolved.via,
  };
}
