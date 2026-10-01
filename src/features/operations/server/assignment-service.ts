import "server-only";
import type { StaffAssignment } from "@prisma/client";
import { prisma } from "@/db";
import { appUrl } from "@/lib/env";
import { formatLongDate, localTime } from "@/lib/dates";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { STAFF_FUNCTION_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import { can, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { notify } from "@/features/notifications/server/notification-service";
import {
  assignmentWarnings,
  defaultAssignmentAmount,
  parseLocalDateTime,
  type AssignmentWarning,
} from "../domain/assignment";
import {
  assignmentFlagsSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
} from "../schemas";
import type { z } from "zod";

type Actor = Pick<SessionUser, "id" | "email" | "role">;

function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

function parseWindow(startsAt: string, endsAt: string): { startsAt: Date; endsAt: Date } {
  const s = parseLocalDateTime(startsAt);
  const e = parseLocalDateTime(endsAt);
  if (!s) throw new ValidationError("Revisa el horario.", { startsAt: ["Fecha y hora inválidas."] });
  if (!e) throw new ValidationError("Revisa el horario.", { endsAt: ["Fecha y hora inválidas."] });
  if (e.getTime() <= s.getTime()) {
    throw new ValidationError("Revisa el horario.", { endsAt: ["La salida debe ser posterior a la entrada."] });
  }
  if (e.getTime() - s.getTime() > 24 * 60 * 60_000) {
    throw new ValidationError("Revisa el horario.", { endsAt: ["Una asignación no puede durar más de 24 horas."] });
  }
  return { startsAt: s, endsAt: e };
}

/** Avisos de disponibilidad (día de la semana) y traslapes con otros eventos no cancelados. */
export async function computeAssignmentWarnings(input: {
  staffMemberId: string;
  eventId: string;
  startsAt: Date;
  endsAt: Date;
  excludeAssignmentId?: string;
}): Promise<AssignmentWarning[]> {
  const member = await prisma.staffMember.findUnique({
    where: { id: input.staffMemberId },
    select: { name: true, availableWeekdays: true, active: true },
  });
  if (!member) return [];
  const others = await prisma.staffAssignment.findMany({
    where: {
      staffMemberId: input.staffMemberId,
      id: input.excludeAssignmentId ? { not: input.excludeAssignmentId } : undefined,
      eventId: { not: input.eventId },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      event: { status: { not: "CANCELLED" } },
    },
    select: { id: true, eventId: true, startsAt: true, endsAt: true, event: { select: { title: true } } },
  });
  return assignmentWarnings({
    member,
    eventId: input.eventId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    others: others.map((o) => ({ ...o, eventTitle: o.event.title })),
  });
}

export type AssignmentResult = { assignment: StaffAssignment; warnings: AssignmentWarning[] };

/**
 * Asigna a un integrante a un evento. Monto por defecto: tarifa por evento, o tarifa por hora × horas.
 * Notifica STAFF_ASSIGNED al correo/WhatsApp del integrante y le asigna las tareas de su función.
 */
export async function createAssignment(actor: Actor, raw: CreateAssignmentInput): Promise<AssignmentResult> {
  assertCan(actor, "staff:write");
  const input = createAssignmentSchema.parse(raw);
  const window = parseWindow(input.startsAt, input.endsAt);

  const [event, member] = await Promise.all([
    prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true, title: true, status: true, eventDate: true, startsAt: true } }),
    prisma.staffMember.findUnique({ where: { id: input.staffMemberId } }),
  ]);
  if (!event) throw new NotFoundError("No encontramos el evento.");
  if (!member) throw new ValidationError("Selecciona un integrante.", { staffMemberId: ["Integrante no encontrado."] });
  if (event.status === "CANCELLED") throw new ValidationError("El evento está cancelado.");
  if (!member.active) {
    throw new ValidationError("Este integrante está inactivo.", { staffMemberId: ["Integrante inactivo."] });
  }

  const duplicate = await prisma.staffAssignment.findUnique({
    where: {
      eventId_staffMemberId_function: { eventId: event.id, staffMemberId: member.id, function: input.function },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("Esta persona ya tiene esa función en el evento.", {
      function: ["Ya asignada con esta función."],
    });
  }

  const amountCents = input.amountCents ?? defaultAssignmentAmount(member, window.startsAt, window.endsAt);
  const warnings = await computeAssignmentWarnings({
    staffMemberId: member.id,
    eventId: event.id,
    ...window,
  });

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.staffAssignment.create({
      data: {
        eventId: event.id,
        staffMemberId: member.id,
        function: input.function,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        amountCents,
        confirmed: input.confirmed,
        paid: input.paid,
        notes: input.notes,
      },
    });
    // Tareas de plantilla sin responsable cuya función por defecto coincide → a esta persona.
    await tx.eventChecklistItem.updateMany({
      where: {
        eventId: event.id,
        assigneeId: null,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        templateItem: { defaultFunction: input.function },
      },
      data: { assigneeId: member.id },
    });
    await audit(
      {
        action: "staff_assignment.created",
        entityType: "StaffAssignment",
        entityId: created.id,
        after: { eventId: event.id, staffMemberId: member.id, function: input.function, amountCents, paid: input.paid },
        actor,
      },
      tx,
    );
    return created;
  });

  // Notificación (nunca rompe el flujo)
  try {
    const data = {
      name: member.name,
      eventTitle: event.title,
      eventDate: formatLongDate(event.eventDate),
      eventTime: `${localTime(window.startsAt)}–${localTime(window.endsAt)}`,
      staffFunction: STAFF_FUNCTION_LABELS[input.function].toLowerCase(),
      url: appUrl(`/staff/events/${event.id}`),
    };
    await Promise.all([
      member.email
        ? notify({ type: "STAFF_ASSIGNED", channel: "EMAIL", to: member.email, data, eventId: event.id, dedupeKey: `staff-assigned:${assignment.id}:email` })
        : null,
      member.phone
        ? notify({ type: "STAFF_ASSIGNED", channel: "WHATSAPP", to: member.phone, data, eventId: event.id, dedupeKey: `staff-assigned:${assignment.id}:wa` })
        : null,
    ]);
  } catch (error) {
    logger.error("operations.staff_notify_failed", { error, assignmentId: assignment.id });
  }

  return { assignment, warnings };
}

export async function updateAssignment(actor: Actor, raw: UpdateAssignmentInput): Promise<AssignmentResult> {
  assertCan(actor, "staff:write");
  const input = updateAssignmentSchema.parse(raw);
  const window = parseWindow(input.startsAt, input.endsAt);
  const before = await prisma.staffAssignment.findUnique({
    where: { id: input.id },
    include: { event: { select: { status: true } } },
  });
  if (!before) throw new NotFoundError("La asignación ya no existe.");
  const member = await prisma.staffMember.findUnique({ where: { id: input.staffMemberId } });
  if (!member) throw new ValidationError("Selecciona un integrante.", { staffMemberId: ["Integrante no encontrado."] });
  const memberChanged = input.staffMemberId !== before.staffMemberId;
  const functionChanged = input.function !== before.function;
  if (memberChanged && before.event.status === "CANCELLED") {
    throw new ValidationError("El evento está cancelado.");
  }
  if (memberChanged && !member.active) {
    throw new ValidationError("Este integrante está inactivo.", { staffMemberId: ["Integrante inactivo."] });
  }

  if (memberChanged || functionChanged) {
    const duplicate = await prisma.staffAssignment.findUnique({
      where: {
        eventId_staffMemberId_function: { eventId: before.eventId, staffMemberId: input.staffMemberId, function: input.function },
      },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== before.id) {
      throw new ValidationError("Esta persona ya tiene esa función en el evento.", {
        function: ["Ya asignada con esta función."],
      });
    }
  }

  const amountCents = input.amountCents ?? defaultAssignmentAmount(member, window.startsAt, window.endsAt);
  const assignment = await prisma.$transaction(async (tx) => {
    const updated = await tx.staffAssignment.update({
      where: { id: before.id },
      data: {
        staffMemberId: input.staffMemberId,
        function: input.function,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        amountCents,
        confirmed: input.confirmed,
        paid: input.paid,
        notes: input.notes,
      },
    });
    if (memberChanged) {
      // Reemplazo de persona: las tareas abiertas de quien sale (si ya no tiene otra función en el
      // evento) pasan a quien entra, para que no queden asignadas a alguien que ya no las ve.
      const remaining = await tx.staffAssignment.count({
        where: { eventId: before.eventId, staffMemberId: before.staffMemberId },
      });
      if (remaining === 0) {
        await tx.eventChecklistItem.updateMany({
          where: { eventId: before.eventId, assigneeId: before.staffMemberId, status: { in: ["PENDING", "IN_PROGRESS"] } },
          data: { assigneeId: input.staffMemberId },
        });
      }
    }
    if (memberChanged || functionChanged) {
      // Igual que al asignar: tareas de plantilla sin responsable con esta función → a esta persona.
      await tx.eventChecklistItem.updateMany({
        where: {
          eventId: before.eventId,
          assigneeId: null,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          templateItem: { defaultFunction: input.function },
        },
        data: { assigneeId: input.staffMemberId },
      });
    }
    await audit(
      {
        action: "staff_assignment.updated",
        entityType: "StaffAssignment",
        entityId: before.id,
        before: {
          staffMemberId: before.staffMemberId,
          function: before.function,
          amountCents: before.amountCents,
          paid: before.paid,
          confirmed: before.confirmed,
        },
        after: { staffMemberId: input.staffMemberId, function: input.function, amountCents, paid: input.paid, confirmed: input.confirmed },
        actor,
      },
      tx,
    );
    return updated;
  });
  const warnings = await computeAssignmentWarnings({
    staffMemberId: input.staffMemberId,
    eventId: before.eventId,
    ...window,
    excludeAssignmentId: before.id,
  });
  return { assignment, warnings };
}

/** Cambios rápidos (confirmado / pagado) desde la tabla. */
export async function setAssignmentFlags(actor: Actor, raw: z.input<typeof assignmentFlagsSchema>): Promise<StaffAssignment> {
  assertCan(actor, "staff:write");
  const input = assignmentFlagsSchema.parse(raw);
  const before = await prisma.staffAssignment.findUnique({ where: { id: input.id } });
  if (!before) throw new NotFoundError("La asignación ya no existe.");
  const assignment = await prisma.staffAssignment.update({
    where: { id: input.id },
    data: {
      confirmed: input.confirmed ?? before.confirmed,
      paid: input.paid ?? before.paid,
    },
  });
  if (input.paid !== undefined && input.paid !== before.paid) {
    await audit({
      action: "staff_assignment.paid_changed",
      entityType: "StaffAssignment",
      entityId: before.id,
      before: { paid: before.paid, amountCents: before.amountCents },
      after: { paid: assignment.paid, amountCents: assignment.amountCents },
      actor,
    });
  }
  return assignment;
}

export async function deleteAssignment(actor: Actor, id: string): Promise<{ eventId: string }> {
  assertCan(actor, "staff:write");
  const before = await prisma.staffAssignment.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("La asignación ya no existe.");
  await prisma.$transaction(async (tx) => {
    await tx.staffAssignment.delete({ where: { id } });
    // Si ya no le queda ninguna función en el evento, liberar sus tareas abiertas.
    const remaining = await tx.staffAssignment.count({ where: { eventId: before.eventId, staffMemberId: before.staffMemberId } });
    if (remaining === 0) {
      await tx.eventChecklistItem.updateMany({
        where: { eventId: before.eventId, assigneeId: before.staffMemberId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        data: { assigneeId: null },
      });
    }
    await audit(
      {
        action: "staff_assignment.deleted",
        entityType: "StaffAssignment",
        entityId: id,
        before: {
          eventId: before.eventId,
          staffMemberId: before.staffMemberId,
          function: before.function,
          amountCents: before.amountCents,
          paid: before.paid,
        },
        actor,
      },
      tx,
    );
  });
  return { eventId: before.eventId };
}
