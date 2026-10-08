import "server-only";
import type { RsvpStatus } from "@prisma/client";
import { prisma } from "@/db";
import { generateToken } from "@/lib/tokens";
import { AppError, NotFoundError } from "@/lib/errors";
import { track } from "@/server/analytics";
import { audit } from "@/server/audit";
import { resolveInvite } from "@/features/portal/server/portal-service";
import { emptyToNull, isRsvpOpen } from "@/features/portal/domain/portal";
import {
  GENERAL_INVITE_FULL_MESSAGE,
  canSelfRegister,
  findPossibleDuplicates,
  normalizeEmail,
  sortDietary,
} from "../domain/rsvp";
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
  /** "updated" con el link personal (su propia invitada); "created" con el link general (siempre nueva) */
  outcome: "created" | "updated";
  via: "invite" | "guest";
  /**
   * Link general: coincide por nombre o email con otra invitada (queda marcada para revisión).
   * Sólo para el servidor: NUNCA devolverlo al cliente (revelaría quién está en la lista).
   */
  possibleDuplicate: boolean;
};

const guestSelect = { id: true, token: true, name: true, rsvpStatus: true } as const;

/**
 * Registra la respuesta de una invitada desde el micrositio /e/[slug]/[token]:
 *  - token personal (EventGuest.token) → actualiza a esa invitada y sólo a ella;
 *  - token general (Event.inviteToken) → SIEMPRE crea una invitada nueva (SELF_RSVP, token propio).
 *    Nunca re-identifica por nombre ni por email: escribirlos no prueba que sea ella, y hacerlo permitía
 *    sobrescribir la respuesta de otra invitada y recibir su link personal (BUG-003). Si coincide con
 *    alguien de la lista se crea igual (la respuesta es idéntica, sin revelar quién está invitada) y
 *    queda como «Posible duplicado» para que la anfitriona o el equipo lo revisen (+ auditoría). Sólo mientras
 *    la lista no llegue al tope del link general (`selfRsvpGuestLimit`: guestCount + margen, techo 60).
 * El mensaje para la homenajeada se guarda como EventMessage HONOREE ligado a la invitada (uno por invitada).
 */
export async function submitRsvp(
  input: SubmitRsvpInput,
  ctx: { ip?: string | null; now?: Date } = {},
): Promise<RsvpResult> {
  const now = ctx.now ?? new Date();
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
  const personalGuest = resolved.guest;

  const { guest, outcome, duplicateIds } = await prisma.$transaction(async (tx) => {
    await lockEventGuests(tx, event.id);
    let outcome: RsvpResult["outcome"];
    let duplicateIds: string[] = [];
    let guest: { id: string; token: string; name: string; rsvpStatus: RsvpStatus };

    if (personalGuest) {
      outcome = "updated";
      guest = await tx.eventGuest.update({ where: { id: personalGuest.id }, data, select: guestSelect });
    } else {
      outcome = "created";
      // Tope del link general: la lista no pasa de `guestCount` + margen (techo 60, `selfRsvpGuestLimit`). Se
      // cuenta DENTRO del candado del evento, con el `guestCount` leído aquí mismo: dos respuestas simultáneas en
      // el borde se serializan y la segunda ya ve a la primera, así que no lo rebasan. Va antes de buscar
      // coincidencias: con la lista llena la respuesta es la misma haya o no coincidencia (sin enumeración).
      const { guestCount } = await tx.event.findUniqueOrThrow({ where: { id: event.id }, select: { guestCount: true } });
      const existing = await tx.eventGuest.findMany({
        where: { eventId: event.id },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      if (!canSelfRegister(existing.length, guestCount)) {
        throw new AppError(GENERAL_INVITE_FULL_MESSAGE, "GUEST_LIMIT", 409);
      }
      duplicateIds = findPossibleDuplicates(existing, { name: data.name, email }).map((g) => g.id);
      guest = await tx.eventGuest.create({
        data: { ...data, eventId: event.id, token: generateToken(), source: "SELF_RSVP" },
        select: guestSelect,
      });
      if (duplicateIds.length) {
        // Rastro para el equipo: alguien respondió con el link general con el nombre o email de otra
        // invitada. Va dentro de la transacción: se confirma junto con la invitada (o no queda ninguno) y ya
        // no es una escritura aparte, con su propia conexión, después de la transacción. La diferencia de
        // tiempo entre «coincide» y «no coincide» queda en un INSERT sobre la conexión ya abierta (además
        // del límite de 10 respuestas por IP cada 10 min, del tope del link general y de que cada sondeo deja un
        // registro marcado visible para la anfitriona).
        await audit(
          {
            action: "guest.possible_duplicate",
            entityType: "EventGuest",
            entityId: guest.id,
            after: { eventId: event.id, name: guest.name, matchedGuestIds: duplicateIds },
            ip: ctx.ip ?? null,
          },
          tx,
        );
      }
    }

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
    } else if (previous && personalGuest) {
      // Con su link personal (formulario precargado) un mensaje vacío significa "bórralo".
      await tx.eventMessage.delete({ where: { id: previous.id } });
    }
    return { guest, outcome, duplicateIds };
  });

  const possibleDuplicate = duplicateIds.length > 0;

  await track("RSVP_SUBMIT", {
    eventId: event.id,
    path: `/e/${event.micrositeSlug}`,
    metadata: { status: guest.rsvpStatus, via: resolved.via, outcome, possibleDuplicate },
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
    possibleDuplicate,
  };
}
