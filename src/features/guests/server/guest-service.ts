import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { generateToken, isPlausibleToken } from "@/lib/tokens";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { isPortalEditable } from "@/features/portal/domain/portal";
import { MAX_GUESTS_PER_EVENT, canHostRemoveGuest, normalizeName, parseContact } from "../domain/rsvp";
import type { HostGuestFormValues } from "../schemas";

/**
 * Lista de invitadas administrada por la anfitriona desde su portal (token = Event.portalToken).
 */

const NOT_FOUND_MESSAGE = "No encontramos tu evento. Revisa que el enlace esté completo.";

/** Serializa altas/RSVPs concurrentes del mismo evento (evita duplicados por carrera). */
export async function lockEventGuests(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`guests:${eventId}`}))`;
}

async function eventForHost(portalToken: string) {
  if (!isPlausibleToken(portalToken)) throw new NotFoundError(NOT_FOUND_MESSAGE);
  const event = await prisma.event.findUnique({
    where: { portalToken },
    select: { id: true, status: true },
  });
  if (!event) throw new NotFoundError(NOT_FOUND_MESSAGE);
  return event;
}

export type HostGuestCreated = { id: string; name: string; token: string };

export async function addGuestAsHost(portalToken: string, input: HostGuestFormValues): Promise<HostGuestCreated> {
  const event = await eventForHost(portalToken);
  if (!isPortalEditable(event.status)) {
    throw new AppError("Este evento ya no admite cambios en la lista de invitadas.", "EVENT_CLOSED", 409);
  }
  const name = input.name.trim().replace(/\s+/g, " ");
  const contact = parseContact(input.contact);
  if (contact && "error" in contact) throw new ValidationError(contact.error, { contact: [contact.error] });

  return prisma.$transaction(async (tx) => {
    await lockEventGuests(tx, event.id);
    const existing = await tx.eventGuest.findMany({ where: { eventId: event.id }, select: { name: true } });
    if (existing.length >= MAX_GUESTS_PER_EVENT) {
      throw new AppError(
        `Tu lista llegó al máximo de ${MAX_GUESTS_PER_EVENT} invitadas. Escríbenos si necesitas más.`,
        "GUEST_LIMIT",
        409,
      );
    }
    const normalized = normalizeName(name);
    if (existing.some((g) => normalizeName(g.name) === normalized)) {
      const err = new ValidationError(`${name} ya está en tu lista.`, {
        name: ["Ya está en tu lista. Si es otra persona, agrega su apellido o inicial."],
      });
      throw err;
    }
    return tx.eventGuest.create({
      data: {
        eventId: event.id,
        name,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        token: generateToken(),
        source: "HOST",
        rsvpStatus: "PENDING",
      },
      select: { id: true, name: true, token: true },
    });
  });
}

/** Sólo invitadas agregadas por la anfitriona (HOST) que todavía no responden (PENDING). */
export async function removeGuestAsHost(
  portalToken: string,
  guestId: string,
  ctx: { ip?: string | null } = {},
): Promise<{ id: string }> {
  const event = await eventForHost(portalToken);
  if (!isPortalEditable(event.status)) {
    throw new AppError("Este evento ya no admite cambios en la lista de invitadas.", "EVENT_CLOSED", 409);
  }
  const guest = await prisma.eventGuest.findFirst({
    where: { id: guestId, eventId: event.id },
    select: { id: true, name: true, source: true, rsvpStatus: true },
  });
  if (!guest) throw new NotFoundError("Esta invitada ya no está en tu lista.");
  if (!canHostRemoveGuest(guest)) {
    throw new AppError(
      guest.source !== "HOST"
        ? "Esta invitada confirmó por su cuenta; si necesitas quitarla, escríbenos."
        : "Esta invitada ya respondió. Si necesitas quitarla, escríbenos.",
      "FORBIDDEN",
      403,
    );
  }
  // Borrado condicional: si respondió entre la lectura y el borrado, no se elimina.
  const { count } = await prisma.eventGuest.deleteMany({
    where: { id: guest.id, eventId: event.id, source: "HOST", rsvpStatus: "PENDING" },
  });
  if (count !== 1) throw new ConflictError("Esta invitada acaba de responder; ya no se puede quitar.");
  await audit({
    action: "event.guest_removed_by_host",
    entityType: "EventGuest",
    entityId: guest.id,
    before: { eventId: event.id, name: guest.name },
    ip: ctx.ip ?? null,
  });
  return { id: guest.id };
}
