import "server-only";
import { prisma } from "@/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { parseLocalDateTime } from "../domain/assignment";
import { addOnNotesSchema, logisticsSchema, type LogisticsInput } from "../schemas";
import type { z } from "zod";

type Actor = Pick<SessionUser, "id" | "email" | "role">;

function toDate(value: string | null, field: string): Date | null {
  if (!value) return null;
  const d = parseLocalDateTime(value);
  if (!d) throw new ValidationError("Fecha inválida.", { [field]: ["Fecha y hora inválidas."] });
  return d;
}

/** Salida / montaje / desmontaje del evento (auditado como "event.logistics_updated"). */
export async function updateEventLogistics(actor: Actor, raw: LogisticsInput) {
  if (!can(actor.role, "events:write")) throw new ForbiddenError();
  const input = logisticsSchema.parse(raw);
  const before = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, departureAt: true, setupStartsAt: true, teardownAt: true, startsAt: true, endsAt: true },
  });
  if (!before) throw new NotFoundError("No encontramos el evento.");

  const departureAt = toDate(input.departureAt, "departureAt");
  const setupStartsAt = toDate(input.setupStartsAt, "setupStartsAt");
  const teardownAt = toDate(input.teardownAt, "teardownAt");
  if (setupStartsAt && setupStartsAt.getTime() > before.startsAt.getTime()) {
    throw new ValidationError("Revisa el horario de montaje.", {
      setupStartsAt: ["El montaje debe empezar antes del inicio del evento."],
    });
  }
  if (departureAt && departureAt.getTime() > before.startsAt.getTime()) {
    throw new ValidationError("Revisa la hora de salida.", { departureAt: ["La salida debe ser antes del inicio del evento."] });
  }
  if (teardownAt && teardownAt.getTime() < before.startsAt.getTime()) {
    throw new ValidationError("Revisa el desmontaje.", { teardownAt: ["El desmontaje debe ser después del inicio del evento."] });
  }

  const event = await prisma.event.update({
    where: { id: before.id },
    data: { departureAt, setupStartsAt, teardownAt },
    select: { id: true, departureAt: true, setupStartsAt: true, teardownAt: true },
  });
  await audit({
    action: "event.logistics_updated",
    entityType: "Event",
    entityId: before.id,
    before: { departureAt: before.departureAt, setupStartsAt: before.setupStartsAt, teardownAt: before.teardownAt },
    after: { departureAt, setupStartsAt, teardownAt },
    actor,
  });
  return event;
}

/** Notas operativas de un add-on del evento. */
export async function updateEventAddOnNotes(actor: Actor, raw: z.input<typeof addOnNotesSchema>) {
  if (!can(actor.role, "events:write")) throw new ForbiddenError();
  const input = addOnNotesSchema.parse(raw);
  const existing = await prisma.eventAddOn.findUnique({ where: { id: input.id }, select: { id: true, eventId: true } });
  if (!existing) throw new NotFoundError("El add-on ya no está en el evento.");
  return prisma.eventAddOn.update({ where: { id: input.id }, data: { notes: input.notes }, select: { id: true, eventId: true, notes: true } });
}
