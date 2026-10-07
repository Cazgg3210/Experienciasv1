import "server-only";
import type { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { generateCode, generateReferralCode } from "@/lib/codes";
import { formatLongDate, localTime, toDateKey } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { EVENT_STATUS_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { checkAvailability } from "@/features/bookings/server/availability-service";
import type { AvailabilityResult } from "@/features/bookings/domain/availability";
import { notifyCustomer } from "@/features/notifications/server/notification-service";
import {
  BOOKING_LOCK_TX_OPTIONS,
  expireVoidedCheckouts,
  voidOpenCheckoutsForCancelledBooking,
} from "@/features/payments/server/payment-service";
import { getSettings } from "@/features/settings/server/settings-service";
import { findCustomerByContact, lockCustomerContact, phoneForStorage } from "@/features/customers/server/customer-contact";
import { contactUpdateForExisting } from "@/features/customers/domain/contact-merge";
import { CAPACITY_STATUSES, eventStatusMachine } from "../domain/event-status";
import {
  ScheduleError,
  buildSchedule,
  buildScheduleFromDuration,
  shiftInstant,
  type EventSchedule,
} from "../domain/event-schedule";
import {
  blankToNull,
  diffFields,
  hasSensitiveChange,
  needsAvailabilityCheck,
  parseColorList,
} from "../domain/event-changes";
import { baseMicrositeSlug, slugCandidates } from "../domain/microsite-slug";
import { entersCapacity, isScheduleLocked } from "../domain/status-actions";
import type {
  AdminMessageInput,
  CancelEventInput,
  CreateEventInput,
  RotateTokenInput,
  TimelineItemInput,
  TransitionEventInput,
  UpdateEventInput,
} from "../schemas";
import { onEventConfirmed } from "./lifecycle";

// -----------------------------------------------------------------------------
// Tipos de resultado
// -----------------------------------------------------------------------------

/** Resumen serializable de disponibilidad para mostrar advertencias en la UI. */
export type AvailabilityWarning = Pick<
  AvailabilityResult,
  "status" | "reason" | "available" | "capacity" | "booked" | "remaining"
> & { overlaps: number };

export type NeedsConfirmation = { status: "needs_confirmation"; availability: AvailabilityWarning };

function toWarning(r: AvailabilityResult): AvailabilityWarning {
  return {
    status: r.status,
    reason: r.reason,
    available: r.available,
    capacity: r.capacity,
    booked: r.booked,
    remaining: r.remaining,
    overlaps: r.overlaps.length,
  };
}

/** Conflictos reales de capacidad (no avisos de anticipación/horario). */
function isCapacityConflict(r: AvailabilityResult): boolean {
  return r.status === "FULL" || r.status === "BLOCKED" || r.status === "CLOSED";
}

function scheduleOrThrow(fn: () => EventSchedule): EventSchedule {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ScheduleError) {
      throw new ValidationError(error.message, { [error.field]: [error.message] });
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

async function assertReferences(refs: {
  experienceId?: string | null;
  menuId?: string | null;
  styleId?: string | null;
  serviceAreaId?: string | null;
}): Promise<void> {
  const fieldErrors: Record<string, string[]> = {};
  const [experience, menu, style, area] = await Promise.all([
    refs.experienceId
      ? prisma.experience.findUnique({ where: { id: refs.experienceId }, select: { id: true } })
      : true,
    refs.menuId ? prisma.menu.findUnique({ where: { id: refs.menuId }, select: { id: true } }) : true,
    refs.styleId ? prisma.style.findUnique({ where: { id: refs.styleId }, select: { id: true } }) : true,
    refs.serviceAreaId
      ? prisma.serviceArea.findUnique({ where: { id: refs.serviceAreaId }, select: { id: true } })
      : true,
  ]);
  if (!experience) fieldErrors.experienceId = ["La experiencia ya no existe."];
  if (!menu) fieldErrors.menuId = ["El menú ya no existe."];
  if (!style) fieldErrors.styleId = ["El estilo ya no existe."];
  if (!area) fieldErrors.serviceAreaId = ["La zona ya no existe."];
  if (Object.keys(fieldErrors).length) throw new ValidationError("Revisa los datos marcados.", fieldErrors);
}

async function findEventOrThrow<T extends Prisma.EventSelect>(id: string, select: T) {
  const event = await prisma.event.findUnique({ where: { id }, select });
  if (!event) throw new NotFoundError("No encontramos este evento.");
  return event as Prisma.EventGetPayload<{ select: T }>;
}

/** Elige un slug de micrositio libre (base, base-2… o con sufijo aleatorio). */
async function pickMicrositeSlug(
  tx: Prisma.TransactionClient,
  input: { title: string; honoreeName?: string | null },
): Promise<string> {
  const base = baseMicrositeSlug(input);
  const candidates = slugCandidates(
    base,
    generateToken(3)
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 4) || "x",
  );
  const taken = await tx.event.findMany({
    where: { micrositeSlug: { in: candidates } },
    select: { micrositeSlug: true },
  });
  const used = new Set(taken.map((t) => t.micrositeSlug));
  return candidates.find((c) => !used.has(c)) ?? `${base}-${Date.now().toString(36)}`;
}

// -----------------------------------------------------------------------------
// Alta manual (estado INQUIRY)
// -----------------------------------------------------------------------------

export type CreateEventResult = { status: "created"; id: string; code: string } | NeedsConfirmation;

export async function createManualEvent(
  input: CreateEventInput,
  actor: SessionUser,
): Promise<CreateEventResult> {
  const schedule = scheduleOrThrow(() =>
    buildScheduleFromDuration(input.date, input.startTime, input.durationMinutes),
  );
  const experienceId = blankToNull(input.experienceId);
  const serviceAreaId = blankToNull(input.serviceAreaId);
  await assertReferences({ experienceId, serviceAreaId });

  const availability = await checkAvailability({
    date: input.date,
    serviceAreaId,
    startTime: input.startTime,
    durationMinutes: schedule.durationMinutes,
  });
  if (!availability.available && !input.confirmUnavailable) {
    return { status: "needs_confirmation", availability: toWarning(availability) };
  }

  let customerId: string;
  if (input.customerMode === "existing") {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new ValidationError("Elige una clienta válida.", { customerId: ["La clienta ya no existe."] });
    }
    customerId = customer.id;
  } else {
    customerId = await findOrCreateCustomer({
      name: input.newCustomer.name,
      email: blankToNull(input.newCustomer.email)?.toLowerCase() ?? null,
      phone: phoneForStorage(input.newCustomer.phone, "newCustomer.phone"),
    });
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const micrositeSlug = await pickMicrositeSlug(tx, {
          title: input.title,
          honoreeName: input.honoreeName,
        });
        const event = await tx.event.create({
          data: {
            code: generateCode("EV"),
            title: input.title.trim(),
            status: "INQUIRY",
            customerId,
            experienceId,
            serviceAreaId,
            occasion: input.occasion,
            honoreeName: blankToNull(input.honoreeName),
            eventDate: schedule.eventDate,
            startsAt: schedule.startsAt,
            endsAt: schedule.endsAt,
            guestCount: input.guestCount,
            addressLine: blankToNull(input.addressLine),
            neighborhood: blankToNull(input.neighborhood),
            postalCode: blankToNull(input.postalCode),
            internalNotes: blankToNull(input.internalNotes),
            micrositeSlug,
            inviteToken: generateToken(),
            portalToken: generateToken(),
          },
          select: { id: true, code: true },
        });
        await audit(
          {
            action: "event.created",
            entityType: "Event",
            entityId: event.id,
            after: {
              code: event.code,
              status: "INQUIRY",
              eventDate: input.date,
              startTime: input.startTime,
              guestCount: input.guestCount,
              availability: availability.status,
              overrodeAvailability: !availability.available,
            },
            actor,
          },
          tx,
        );
        return event;
      });
      return { status: "created", id: created.id, code: created.code };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 3) throw error;
    }
  }
  throw new ConflictError("No pudimos generar el código del evento. Intenta de nuevo.");
}

/**
 * «Clienta nueva» del alta manual de evento: misma regla que leads y cotizaciones (`findCustomerByContact`,
 * serializada por correo/teléfono). Si ya existe se le completan los datos que falten (los capturó el
 * equipo); una clienta con el mismo teléfono pero OTRO correo es otra persona y se crea la nueva.
 */
async function findOrCreateCustomer(input: { name: string; email: string | null; phone: string | null }) {
  return prisma.$transaction(async (tx) => {
    await lockCustomerContact(tx, input);
    const match = await findCustomerByContact(tx, { email: input.email, phone: input.phone });
    if (match) {
      const { fill } = contactUpdateForExisting("team", match.customer, { email: input.email, phone: input.phone });
      if (Object.keys(fill).length) await tx.customer.update({ where: { id: match.customer.id }, data: fill });
      return match.customer.id;
    }
    const created = await tx.customer.create({
      data: {
        name: input.name.trim(),
        email: input.email,
        phone: input.phone,
        whatsapp: input.phone,
        source: "MANUAL",
        referralCode: generateReferralCode(input.name),
      },
      select: { id: true },
    });
    return created.id;
  });
}

// -----------------------------------------------------------------------------
// Edición
// -----------------------------------------------------------------------------

export type UpdateEventResult =
  | {
      status: "updated";
      changed: string[];
      audited: boolean;
      /** Turnos de staff y tareas abiertas que se movieron junto con el evento al reprogramar. */
      shifted: { staffShifts: number; checklistItems: number };
    }
  | { status: "unchanged" }
  | NeedsConfirmation;

export async function updateEvent(input: UpdateEventInput, actor: SessionUser): Promise<UpdateEventResult> {
  const event = await findEventOrThrow(input.eventId, {
    id: true,
    status: true,
    title: true,
    occasion: true,
    eventDate: true,
    startsAt: true,
    endsAt: true,
    guestCount: true,
    experienceId: true,
    menuId: true,
    styleId: true,
    serviceAreaId: true,
    addressLine: true,
    neighborhood: true,
    postalCode: true,
    mapsUrl: true,
    addressNotes: true,
    honoreeName: true,
    colors: true,
    dressCode: true,
    hostMessage: true,
    playlistUrl: true,
    customerNotes: true,
    internalNotes: true,
    micrositeEnabled: true,
    micrositeSlug: true,
    portalToken: true,
    inviteToken: true,
    departureAt: true,
    setupStartsAt: true,
    teardownAt: true,
  });
  const schedule = scheduleOrThrow(() => buildSchedule(input.date, input.startTime, input.endTime));
  const next = {
    title: input.title.trim(),
    occasion: input.occasion,
    eventDate: schedule.eventDate,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    guestCount: input.guestCount,
    experienceId: blankToNull(input.experienceId),
    menuId: blankToNull(input.menuId),
    styleId: blankToNull(input.styleId),
    serviceAreaId: blankToNull(input.serviceAreaId),
    addressLine: blankToNull(input.addressLine),
    neighborhood: blankToNull(input.neighborhood),
    postalCode: blankToNull(input.postalCode),
    mapsUrl: blankToNull(input.mapsUrl),
    addressNotes: blankToNull(input.addressNotes),
    honoreeName: blankToNull(input.honoreeName),
    colors: parseColorList(input.colors),
    dressCode: blankToNull(input.dressCode),
    hostMessage: blankToNull(input.hostMessage),
    playlistUrl: blankToNull(input.playlistUrl),
    customerNotes: blankToNull(input.customerNotes),
    internalNotes: blankToNull(input.internalNotes),
    micrositeEnabled: input.micrositeEnabled,
  };
  const diff = diffFields(event, next);
  if (!diff.changed.length) return { status: "unchanged" };

  await assertReferences({
    experienceId: diff.changed.includes("experienceId") ? next.experienceId : null,
    menuId: diff.changed.includes("menuId") ? next.menuId : null,
    styleId: diff.changed.includes("styleId") ? next.styleId : null,
    serviceAreaId: diff.changed.includes("serviceAreaId") ? next.serviceAreaId : null,
  });

  const scheduleChanged = diff.changed.some((f) => f === "eventDate" || f === "startsAt" || f === "endsAt");
  if (scheduleChanged && isScheduleLocked(event.status)) {
    throw new AppError(
      `No se puede reprogramar un evento ${EVENT_STATUS_LABELS[event.status].toLowerCase()}.`,
      "SCHEDULE_LOCKED",
      409,
    );
  }

  if (needsAvailabilityCheck(diff.changed) && !isScheduleLocked(event.status)) {
    const availability = await checkAvailability({
      date: input.date,
      serviceAreaId: next.serviceAreaId,
      startTime: input.startTime,
      durationMinutes: schedule.durationMinutes,
      excludeEventId: event.id,
    });
    if (!availability.available && !input.confirmUnavailable) {
      return { status: "needs_confirmation", availability: toWarning(availability) };
    }
  }

  const deltaMs = next.startsAt.getTime() - event.startsAt.getTime();
  const audited = hasSensitiveChange(diff.changed);
  const shifted = await prisma.$transaction(async (tx) => {
    // Guardia optimista: si otra persona cambió el estado mientras tanto (p. ej. lo canceló), no pisar.
    const res = await tx.event.updateMany({
      where: { id: event.id, status: event.status },
      data: {
        ...next,
        ...(deltaMs !== 0
          ? {
              departureAt: shiftInstant(event.departureAt, deltaMs),
              setupStartsAt: shiftInstant(event.setupStartsAt, deltaMs),
              teardownAt: shiftInstant(event.teardownAt, deltaMs),
            }
          : {}),
      },
    });
    if (res.count === 0) {
      throw new ConflictError("El estado del evento cambió mientras tanto. Recarga la página.");
    }
    // Al reprogramar, los turnos de staff y las tareas abiertas (dueAt = inicio + offset)
    // se mueven con el evento para que la operación no quede en la fecha anterior.
    let staffShifts = 0;
    let checklistItems = 0;
    if (deltaMs !== 0) {
      staffShifts = await tx.$executeRaw`
        UPDATE "StaffAssignment"
        SET "startsAt" = "startsAt" + (${deltaMs}::double precision * interval '1 millisecond'),
            "endsAt" = "endsAt" + (${deltaMs}::double precision * interval '1 millisecond'),
            "updatedAt" = timezone('UTC', now())
        WHERE "eventId" = ${event.id}`;
      checklistItems = await tx.$executeRaw`
        UPDATE "EventChecklistItem"
        SET "dueAt" = "dueAt" + (${deltaMs}::double precision * interval '1 millisecond'),
            "updatedAt" = timezone('UTC', now())
        WHERE "eventId" = ${event.id}
          AND "dueAt" IS NOT NULL
          AND "status" IN ('PENDING', 'IN_PROGRESS')`;
    }
    if (audited) {
      await audit(
        {
          action: "event.updated",
          entityType: "Event",
          entityId: event.id,
          before: diff.before,
          after: {
            ...diff.after,
            changed: diff.changed,
            overrodeAvailability: input.confirmUnavailable || undefined,
            ...(deltaMs !== 0
              ? { shiftedStaffShifts: staffShifts, shiftedChecklistItems: checklistItems }
              : {}),
          },
          actor,
        },
        tx,
      );
    }
    return { staffShifts, checklistItems };
  });
  return { status: "updated", changed: diff.changed, audited, shifted };
}

// -----------------------------------------------------------------------------
// Estados
// -----------------------------------------------------------------------------

export type TransitionResult = { status: "updated"; from: EventStatus; to: EventStatus } | NeedsConfirmation;

function invalidTransition(from: EventStatus, to: EventStatus): AppError {
  return new AppError(
    `No se puede pasar de "${EVENT_STATUS_LABELS[from]}" a "${EVENT_STATUS_LABELS[to]}".`,
    "INVALID_TRANSITION",
    409,
  );
}

export async function transitionEventStatus(
  input: TransitionEventInput,
  actor: SessionUser,
): Promise<TransitionResult> {
  if (input.to === "CANCELLED") {
    throw new AppError("Para cancelar el evento indica el motivo.", "REASON_REQUIRED", 422);
  }
  const event = await findEventOrThrow(input.eventId, {
    id: true,
    status: true,
    eventDate: true,
    startsAt: true,
    endsAt: true,
    serviceAreaId: true,
  });
  const from = event.status;
  const to = input.to;
  if (!eventStatusMachine.can(from, to)) throw invalidTransition(from, to);

  if (entersCapacity(from, to, CAPACITY_STATUSES) && !input.confirmUnavailable) {
    const availability = await checkAvailability({
      date: toDateKey(event.eventDate),
      serviceAreaId: event.serviceAreaId,
      startTime: localTime(event.startsAt),
      durationMinutes: Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000),
      excludeEventId: event.id,
    });
    if (isCapacityConflict(availability)) {
      return { status: "needs_confirmation", availability: toWarning(availability) };
    }
  }

  await prisma.$transaction(async (tx) => {
    const res = await tx.event.updateMany({
      where: { id: event.id, status: from },
      data: { status: to, ...(to === "COMPLETED" ? { completedAt: new Date() } : {}) },
    });
    if (res.count === 0)
      throw new ConflictError("El estado del evento cambió mientras tanto. Recarga la página.");
    await audit(
      {
        action: "event.status_changed",
        entityType: "Event",
        entityId: event.id,
        before: { status: from },
        after: { status: to, overrodeAvailability: input.confirmUnavailable || undefined },
        actor,
      },
      tx,
    );
  });

  if (to === "CONFIRMED") await onEventConfirmed(event.id);
  return { status: "updated", from, to };
}

export type CancelResult = { status: "cancelled"; releasedReservations: number; notified: boolean };

export async function cancelEvent(input: CancelEventInput, actor: SessionUser): Promise<CancelResult> {
  const reason = input.reason?.trim() ?? "";
  if (reason.length < 5) {
    throw new ValidationError("Escribe el motivo de la cancelación.", {
      reason: ["Escribe el motivo de la cancelación (mín. 5 caracteres)"],
    });
  }
  const event = await findEventOrThrow(input.eventId, {
    id: true,
    status: true,
    title: true,
    eventDate: true,
    portalToken: true,
    customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
    booking: { select: { id: true, cancelledAt: true } },
  });
  const from = event.status;
  if (!eventStatusMachine.can(from, "CANCELLED")) throw invalidTransition(from, "CANCELLED");

  const now = new Date();
  const { released, voidedPayments } = await prisma.$transaction(async (tx) => {
    // Primero la reserva (mismo candado y orden que checkout/webhooks): los checkouts en línea abiertos
    // quedan anulados en esta misma transacción y ya no se pueden pagar.
    const voidedPayments = event.booking ? await voidOpenCheckoutsForCancelledBooking(tx, event.booking.id, now) : [];
    const res = await tx.event.updateMany({
      where: { id: event.id, status: from },
      data: { status: "CANCELLED", cancelledAt: now, cancellationReason: reason },
    });
    if (res.count === 0)
      throw new ConflictError("El estado del evento cambió mientras tanto. Recarga la página.");

    const reservations = await tx.inventoryReservation.findMany({
      where: { eventId: event.id, status: "RESERVED" },
      select: { id: true, inventoryItemId: true, quantity: true },
    });
    if (reservations.length) {
      await tx.inventoryReservation.updateMany({
        where: { id: { in: reservations.map((r) => r.id) } },
        data: { status: "CANCELLED" },
      });
      await tx.inventoryMovement.createMany({
        data: reservations.map((r) => ({
          inventoryItemId: r.inventoryItemId,
          eventId: event.id,
          type: "RELEASE" as const,
          quantity: r.quantity,
          reason: "Evento cancelado",
          actorId: actor.id,
        })),
      });
    }
    if (event.booking && !event.booking.cancelledAt) {
      await tx.booking.update({
        where: { id: event.booking.id },
        data: { cancelledAt: now, cancellationReason: reason },
      });
    }
    await audit(
      {
        action: "event.cancelled",
        entityType: "Event",
        entityId: event.id,
        before: { status: from },
        after: { status: "CANCELLED", reason, releasedReservations: reservations.length, voidedPayments },
        actor,
      },
      tx,
    );
    return { released: reservations.length, voidedPayments };
  }, BOOKING_LOCK_TX_OPTIONS);

  // Best-effort: la pasarela deja de aceptar las sesiones anuladas (un cobro tardío igual queda registrado
  // para reembolso y el equipo recibe el aviso).
  await expireVoidedCheckouts(voidedPayments);

  let notified = false;
  if (input.notifyCustomer) {
    try {
      await notifyCustomer(event.customer, {
        type: "GENERIC",
        eventId: event.id,
        dedupeKey: `event-cancelled:${event.id}`,
        data: {
          name: event.customer.name,
          eventTitle: `Cancelación de ${event.title}`,
          eventDate: formatLongDate(event.eventDate),
          message: `te confirmamos que tu celebración «${event.title}» del ${formatLongDate(event.eventDate)} quedó cancelada. Si tienes dudas o quieres elegir una nueva fecha, escríbenos: con gusto te ayudamos.`,
        },
      });
      notified = true;
    } catch (error) {
      logger.warn("events.cancel_notify_failed", { error, eventId: event.id });
    }
  }
  return { status: "cancelled", releasedReservations: released, notified };
}

// -----------------------------------------------------------------------------
// Tokens (portal de la clienta / invitación)
// -----------------------------------------------------------------------------

export async function rotateEventToken(
  input: RotateTokenInput,
  actor: SessionUser,
): Promise<{ kind: RotateTokenInput["kind"]; url: string }> {
  const event = await findEventOrThrow(input.eventId, {
    id: true,
    micrositeSlug: true,
    portalToken: true,
    inviteToken: true,
  });
  const token = generateToken();
  const previous = input.kind === "portal" ? event.portalToken : event.inviteToken;
  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: event.id },
      data: input.kind === "portal" ? { portalToken: token } : { inviteToken: token },
    });
    await audit(
      {
        action: "event.token_rotated",
        entityType: "Event",
        entityId: event.id,
        // Nunca guardar tokens completos en la bitácora
        before: { kind: input.kind, tokenEnding: previous.slice(-4) },
        after: { kind: input.kind, tokenEnding: token.slice(-4) },
        actor,
      },
      tx,
    );
  });
  return {
    kind: input.kind,
    url:
      input.kind === "portal" ? appUrl(`/mi-evento/${token}`) : appUrl(`/e/${event.micrositeSlug}/${token}`),
  };
}

// -----------------------------------------------------------------------------
// Timeline del evento
// -----------------------------------------------------------------------------

export async function saveTimelineItem(
  input: TimelineItemInput,
  _actor: SessionUser,
): Promise<{ id: string }> {
  await findEventOrThrow(input.eventId, { id: true });
  const data = {
    time: input.time,
    title: input.title.trim(),
    description: blankToNull(input.description),
    visibleToGuests: input.visibleToGuests,
    sortOrder: input.sortOrder,
  };
  const itemId = blankToNull(input.itemId);
  if (itemId) {
    const res = await prisma.eventTimelineItem.updateMany({
      where: { id: itemId, eventId: input.eventId },
      data,
    });
    if (res.count === 0) throw new NotFoundError("Ese momento del programa ya no existe.");
    return { id: itemId };
  }
  const created = await prisma.eventTimelineItem.create({
    data: { ...data, eventId: input.eventId },
    select: { id: true },
  });
  return created;
}

export async function deleteTimelineItem(
  input: { eventId: string; itemId: string },
  _actor: SessionUser,
): Promise<void> {
  const res = await prisma.eventTimelineItem.deleteMany({
    where: { id: input.itemId, eventId: input.eventId },
  });
  if (res.count === 0) throw new NotFoundError("Ese momento del programa ya no existe.");
}

// -----------------------------------------------------------------------------
// Conversación con la anfitriona (HOST_THREAD)
// -----------------------------------------------------------------------------

export async function addAdminMessage(
  input: AdminMessageInput,
  _actor: SessionUser,
): Promise<{ id: string; notified: boolean }> {
  const event = await findEventOrThrow(input.eventId, {
    id: true,
    title: true,
    portalToken: true,
    customer: { select: { name: true, email: true, phone: true, whatsapp: true } },
  });
  const business = await getSettings("business");
  const body = input.body.trim();
  const message = await prisma.eventMessage.create({
    data: {
      eventId: event.id,
      kind: "HOST_THREAD",
      authorType: "ADMIN",
      authorName: `Equipo ${business.brandName}`,
      body,
    },
    select: { id: true },
  });
  let notified = false;
  if (input.notifyCustomer) {
    const preview = body.length > 280 ? `${body.slice(0, 277)}…` : body;
    await notifyCustomer(event.customer, {
      type: "GENERIC",
      eventId: event.id,
      data: {
        name: event.customer.name,
        eventTitle: `Nuevo mensaje sobre ${event.title}`,
        message: `tienes un nuevo mensaje del equipo sobre «${event.title}»: “${preview}”`,
        url: appUrl(`/mi-evento/${event.portalToken}`),
      },
    });
    notified = true;
  }
  return { id: message.id, notified };
}

/** Alias con el nombre del contrato del módulo (rotación de tokens del portal / invitación). */
export const rotateTokens = rotateEventToken;
