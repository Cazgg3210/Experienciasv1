import "server-only";
import type { InventoryMovementType, InventoryReservationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { ACTIVE_RESERVATION_STATUSES, availableOn } from "../domain/availability";
import { planReservation, requirementsForEvent } from "../domain/requirements";
import { reservationStatusMachine, validateReturn } from "../domain/reservation-status";
import { applyReturnLoss } from "../domain/stock";

export type InventoryShortage = {
  inventoryItemId: string;
  sku: string;
  name: string;
  required: number;
  available: number;
  shortBy: number;
};

type Tx = Prisma.TransactionClient;
type Actor = Pick<SessionUser, "id" | "email"> | null | undefined;

const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

/** Mensajes claros cuando la reserva no está en el estado esperado para la acción. */
function transitionMessage(from: InventoryReservationStatus, to: InventoryReservationStatus): string {
  if (from === to) {
    return {
      CHECKED_OUT: "Estas piezas ya salieron al evento.",
      RETURNED: "El regreso de estas piezas ya se registró.",
      CANCELLED: "Esta reserva ya estaba liberada.",
      RESERVED: "Esta reserva ya está activa.",
    }[to];
  }
  switch (to) {
    case "CHECKED_OUT":
      return "Sólo puedes entregar piezas que estén reservadas.";
    case "RETURNED":
      return "Sólo puedes registrar el regreso de piezas que salieron al evento.";
    case "CANCELLED":
      return "Sólo puedes liberar reservas que aún no salen al evento.";
    default:
      return "La reserva ya cambió de estado. Actualiza la página.";
  }
}

function assertReservationTransition(from: InventoryReservationStatus, to: InventoryReservationStatus) {
  if (!reservationStatusMachine.can(from, to)) throw new ConflictError(transitionMessage(from, to));
}

/** Bloquea la fila del evento para serializar recalculos concurrentes del mismo evento. */
async function lockEvent(tx: Tx, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
}

async function lockItem(tx: Tx, itemId: string) {
  await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${itemId} FOR UPDATE`;
}

/**
 * Faltantes de un evento: para cada reserva activa del evento compara su cantidad contra lo
 * disponible ese día (total − mantenimiento − reservas activas de OTROS eventos no cancelados).
 */
export async function computeEventShortages(db: Tx, eventId: string): Promise<InventoryShortage[]> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, eventDate: true, status: true } });
  if (!event || event.status === "CANCELLED") return [];
  const active = await db.inventoryReservation.findMany({
    where: { eventId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
    select: {
      inventoryItemId: true,
      quantity: true,
      inventoryItem: { select: { sku: true, name: true, totalQuantity: true, maintenanceQuantity: true } },
    },
  });
  if (!active.length) return [];
  const others = await db.inventoryReservation.findMany({
    where: {
      eventId: { not: eventId },
      inventoryItemId: { in: active.map((r) => r.inventoryItemId) },
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      event: { eventDate: event.eventDate, status: { not: "CANCELLED" } },
    },
    select: { inventoryItemId: true, quantity: true, status: true },
  });
  const othersByItem = new Map<string, typeof others>();
  for (const o of others) {
    const list = othersByItem.get(o.inventoryItemId) ?? [];
    list.push(o);
    othersByItem.set(o.inventoryItemId, list);
  }
  const out: InventoryShortage[] = [];
  for (const r of active) {
    const available = availableOn(r.inventoryItem, othersByItem.get(r.inventoryItemId) ?? []);
    if (r.quantity > available) {
      out.push({
        inventoryItemId: r.inventoryItemId,
        sku: r.inventoryItem.sku,
        name: r.inventoryItem.name,
        required: r.quantity,
        available,
        shortBy: r.quantity - available,
      });
    }
  }
  return out.sort((a, b) => b.shortBy - a.shortBy);
}

/** Faltantes actuales de un evento (lectura). */
export async function getEventShortages(eventId: string): Promise<InventoryShortage[]> {
  return computeEventShortages(prisma, eventId);
}

/** Requerimientos calculados (experiencia + add-ons) de un evento: itemId → piezas. */
export async function loadEventRequirements(db: Tx, eventId: string): Promise<Map<string, number> | null> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      guestCount: true,
      experience: { select: { inventoryReqs: { select: { inventoryItemId: true, quantity: true, perGuest: true } } } },
      addOns: {
        select: {
          quantity: true,
          addOn: { select: { inventoryReqs: { select: { inventoryItemId: true, quantity: true, perGuest: true } } } },
        },
      },
    },
  });
  if (!event) return null;
  return requirementsForEvent({
    guestCount: event.guestCount,
    experienceReqs: event.experience?.inventoryReqs ?? [],
    addOnReqs: event.addOns.flatMap((a) =>
      a.addOn.inventoryReqs.map((r) => ({ ...r, addOnQuantity: a.quantity })),
    ),
  });
}

/**
 * Reserva (idempotente) el inventario de un evento a partir de sus requerimientos
 * (experiencia + add-ons, perGuest × invitadas). Crea/actualiza una InventoryReservation por
 * artículo (@@unique item+evento) y registra movimientos RESERVE/RELEASE sólo por las diferencias.
 * Si el evento está cancelado, libera todas sus reservas activas.
 * Devuelve `reserved` = número de artículos con reserva activa y los faltantes del día.
 */
export async function reserveInventoryForEvent(
  eventId: string,
  opts: { actor?: Actor } = {},
): Promise<{ reserved: number; shortages: InventoryShortage[] }> {
  const actorId = opts.actor?.id ?? null;
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, code: true, status: true } });
    if (!event) throw new NotFoundError("No encontramos el evento.");

    const required =
      event.status === "CANCELLED" ? new Map<string, number>() : ((await loadEventRequirements(tx, eventId)) ?? new Map());
    const existing = await tx.inventoryReservation.findMany({
      where: { eventId },
      select: { id: true, inventoryItemId: true, quantity: true, status: true },
    });
    const byItem = new Map(existing.map((r) => [r.inventoryItemId, r]));
    const itemIds = new Set<string>([...required.keys(), ...byItem.keys()]);

    const movements: Prisma.InventoryMovementCreateManyInput[] = [];
    const move = (inventoryItemId: string, type: InventoryMovementType, quantity: number, reason: string) =>
      movements.push({ inventoryItemId, eventId, type, quantity, reason, actorId });

    for (const itemId of itemIds) {
      const current = byItem.get(itemId) ?? null;
      const plan = planReservation({ required: required.get(itemId) ?? 0, existing: current });
      switch (plan.kind) {
        case "noop":
          break;
        case "create":
          await tx.inventoryReservation.create({
            data: { inventoryItemId: itemId, eventId, quantity: plan.quantity, status: "RESERVED" },
          });
          move(itemId, "RESERVE", plan.quantity, `Reserva para ${event.code}`);
          break;
        case "update":
          await tx.inventoryReservation.update({ where: { id: current!.id }, data: { quantity: plan.quantity } });
          if (plan.delta > 0) move(itemId, "RESERVE", plan.delta, `Ajuste de reserva para ${event.code}`);
          else move(itemId, "RELEASE", -plan.delta, `Ajuste de reserva para ${event.code}`);
          break;
        case "reactivate":
          await tx.inventoryReservation.update({
            where: { id: current!.id },
            data: { quantity: plan.quantity, status: "RESERVED", returnedQuantity: null, damagedQuantity: null },
          });
          move(itemId, "RESERVE", plan.quantity, `Reserva reactivada para ${event.code}`);
          break;
        case "release":
          await tx.inventoryReservation.update({ where: { id: current!.id }, data: { status: "CANCELLED" } });
          move(
            itemId,
            "RELEASE",
            plan.quantity,
            event.status === "CANCELLED" ? `Evento ${event.code} cancelado` : `Ya no se requiere para ${event.code}`,
          );
          break;
      }
    }
    if (movements.length) await tx.inventoryMovement.createMany({ data: movements });

    const reserved = await tx.inventoryReservation.count({
      where: { eventId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
    });
    const shortages = await computeEventShortages(tx, eventId);
    if (movements.length && opts.actor) {
      await audit(
        {
          action: "inventory.reservations_recalculated",
          entityType: "Event",
          entityId: eventId,
          after: { movements: movements.length, reserved, shortages: shortages.length },
          actor: opts.actor,
        },
        tx,
      );
    }
    return { reserved, shortages };
  }, TX_OPTIONS);
}

/** Libera todas las reservas activas (RESERVED) de un evento, p. ej. al cancelarlo. */
export async function releaseInventoryForEvent(eventId: string, opts: { actor?: Actor; reason?: string } = {}) {
  const actorId = opts.actor?.id ?? null;
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const active = await tx.inventoryReservation.findMany({ where: { eventId, status: "RESERVED" } });
    if (!active.length) return { released: 0 };
    await tx.inventoryReservation.updateMany({
      where: { id: { in: active.map((r) => r.id) } },
      data: { status: "CANCELLED" },
    });
    await tx.inventoryMovement.createMany({
      data: active.map((r) => ({
        inventoryItemId: r.inventoryItemId,
        eventId,
        type: "RELEASE" as const,
        quantity: r.quantity,
        reason: opts.reason ?? "Reservas liberadas",
        actorId,
      })),
    });
    if (opts.actor) {
      await audit(
        {
          action: "inventory.reservations_released",
          entityType: "Event",
          entityId: eventId,
          before: { reserved: active.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity })) },
          after: { released: active.length, reason: opts.reason ?? null },
          actor: opts.actor,
        },
        tx,
      );
    }
    return { released: active.length };
  }, TX_OPTIONS);
}

/**
 * "Recalcular desde requerimientos" desde el panel: no se permite en eventos completados
 * (su operación ya cerró). En eventos cancelados el recálculo libera lo que siga reservado.
 */
export async function recalculateEventReservations(actor: SessionUser, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event) throw new NotFoundError("No encontramos el evento.");
  if (event.status === "COMPLETED") {
    throw new ConflictError("El evento ya se completó: sus reservas ya no se recalculan.");
  }
  return reserveInventoryForEvent(eventId, { actor });
}

/** Carga una reserva bloqueando antes la fila del evento (evita carreras entre acciones). */
async function loadReservation(tx: Tx, reservationId: string) {
  const ref = await tx.inventoryReservation.findUnique({ where: { id: reservationId }, select: { eventId: true } });
  if (!ref) throw new NotFoundError("No encontramos la reserva.");
  await lockEvent(tx, ref.eventId);
  const reservation = await tx.inventoryReservation.findUnique({
    where: { id: reservationId },
    include: {
      event: { select: { id: true, code: true, title: true, status: true } },
      inventoryItem: { select: { id: true, sku: true, name: true, totalQuantity: true, maintenanceQuantity: true } },
    },
  });
  if (!reservation) throw new NotFoundError("No encontramos la reserva.");
  return reservation;
}

/** Cambia manualmente la cantidad de una reserva activa (registra RESERVE/RELEASE por la diferencia). */
export async function updateReservationQuantity(
  actor: SessionUser,
  input: { reservationId: string; quantity: number },
): Promise<{ eventId: string; itemId: string; shortage: InventoryShortage | null }> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new ValidationError("La cantidad debe ser al menos 1.", { quantity: ["La cantidad debe ser al menos 1."] });
  }
  return prisma.$transaction(async (tx) => {
    const r = await loadReservation(tx, input.reservationId);
    if (r.status !== "RESERVED") {
      throw new ConflictError("Sólo puedes cambiar la cantidad de reservas que aún no salen al evento.");
    }
    if (r.event.status === "CANCELLED") {
      throw new ConflictError("El evento está cancelado: libera la reserva en lugar de cambiar su cantidad.");
    }
    const delta = input.quantity - r.quantity;
    if (delta !== 0) {
      await tx.inventoryReservation.update({ where: { id: r.id }, data: { quantity: input.quantity } });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: r.inventoryItemId,
          eventId: r.eventId,
          type: delta > 0 ? "RESERVE" : "RELEASE",
          quantity: Math.abs(delta),
          reason: `Ajuste manual de reserva (${r.quantity} → ${input.quantity})`,
          actorId: actor.id,
        },
      });
      await audit(
        {
          action: "inventory.reservation_updated",
          entityType: "InventoryReservation",
          entityId: r.id,
          before: { quantity: r.quantity },
          after: { quantity: input.quantity },
          actor,
        },
        tx,
      );
    }
    const shortages = await computeEventShortages(tx, r.eventId);
    return {
      eventId: r.eventId,
      itemId: r.inventoryItemId,
      shortage: shortages.find((s) => s.inventoryItemId === r.inventoryItemId) ?? null,
    };
  }, TX_OPTIONS);
}

/** Agrega manualmente un artículo a las reservas de un evento (o reactiva una reserva cancelada). */
export async function addReservation(
  actor: SessionUser,
  input: { eventId: string; inventoryItemId: string; quantity: number },
): Promise<{ reservationId: string; shortage: InventoryShortage | null }> {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { id: true, code: true, status: true } });
    if (!event) throw new NotFoundError("No encontramos el evento.");
    if (event.status === "CANCELLED" || event.status === "COMPLETED") {
      throw new ConflictError("No puedes reservar inventario para un evento cancelado o completado.");
    }
    const item = await tx.inventoryItem.findUnique({ where: { id: input.inventoryItemId }, select: { id: true, active: true } });
    if (!item) throw new ValidationError("Elige un artículo válido.", { inventoryItemId: ["Elige un artículo válido."] });
    if (!item.active) {
      throw new ValidationError("Este artículo está inactivo.", { inventoryItemId: ["Este artículo está inactivo."] });
    }
    const existing = await tx.inventoryReservation.findUnique({
      where: { inventoryItemId_eventId: { inventoryItemId: input.inventoryItemId, eventId: input.eventId } },
    });
    let reservationId: string;
    if (existing && existing.status === "RESERVED") {
      throw new ConflictError("Este artículo ya tiene una reserva en el evento; edita su cantidad.");
    } else if (existing && existing.status !== "CANCELLED") {
      throw new ConflictError(
        existing.status === "CHECKED_OUT"
          ? "Este artículo ya salió a este evento; registra su regreso antes de reservar más."
          : "Este artículo ya regresó de este evento; no se puede volver a reservar.",
      );
    } else if (existing) {
      await tx.inventoryReservation.update({
        where: { id: existing.id },
        data: { quantity: input.quantity, status: "RESERVED", returnedQuantity: null, damagedQuantity: null },
      });
      reservationId = existing.id;
    } else {
      const created = await tx.inventoryReservation.create({
        data: { inventoryItemId: input.inventoryItemId, eventId: input.eventId, quantity: input.quantity },
      });
      reservationId = created.id;
    }
    await tx.inventoryMovement.create({
      data: {
        inventoryItemId: input.inventoryItemId,
        eventId: input.eventId,
        type: "RESERVE",
        quantity: input.quantity,
        reason: `Reserva manual para ${event.code}`,
        actorId: actor.id,
      },
    });
    const shortages = await computeEventShortages(tx, input.eventId);
    return { reservationId, shortage: shortages.find((s) => s.inventoryItemId === input.inventoryItemId) ?? null };
  }, TX_OPTIONS);
}

/** Salida a evento: RESERVED → CHECKED_OUT + movimiento CHECK_OUT. */
export async function checkOutReservation(actor: SessionUser, input: { reservationId: string }) {
  return prisma.$transaction(async (tx) => {
    const r = await loadReservation(tx, input.reservationId);
    assertReservationTransition(r.status, "CHECKED_OUT");
    if (r.event.status === "CANCELLED") {
      throw new ConflictError("El evento está cancelado: libera la reserva en lugar de entregarla.");
    }
    await tx.inventoryReservation.update({ where: { id: r.id }, data: { status: "CHECKED_OUT" } });
    await tx.inventoryMovement.create({
      data: {
        inventoryItemId: r.inventoryItemId,
        eventId: r.eventId,
        type: "CHECK_OUT",
        quantity: r.quantity,
        reason: `Salida a ${r.event.title}`,
        actorId: actor.id,
      },
    });
    return { eventId: r.eventId, itemId: r.inventoryItemId };
  }, TX_OPTIONS);
}

/** Entrega todas las reservas activas (RESERVED) de un evento. */
export async function checkOutAllForEvent(actor: SessionUser, input: { eventId: string }) {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, input.eventId);
    const event = await tx.event.findUnique({ where: { id: input.eventId }, select: { id: true, title: true, status: true } });
    if (!event) throw new NotFoundError("No encontramos el evento.");
    if (event.status === "CANCELLED") throw new ConflictError("El evento está cancelado.");
    const pending = await tx.inventoryReservation.findMany({ where: { eventId: input.eventId, status: "RESERVED" } });
    if (!pending.length) return { checkedOut: 0 };
    await tx.inventoryReservation.updateMany({
      where: { id: { in: pending.map((r) => r.id) }, status: "RESERVED" },
      data: { status: "CHECKED_OUT" },
    });
    await tx.inventoryMovement.createMany({
      data: pending.map((r) => ({
        inventoryItemId: r.inventoryItemId,
        eventId: input.eventId,
        type: "CHECK_OUT" as const,
        quantity: r.quantity,
        reason: `Salida a ${event.title}`,
        actorId: actor.id,
      })),
    });
    return { checkedOut: pending.length };
  }, TX_OPTIONS);
}

/**
 * Regreso de evento: CHECKED_OUT → RETURNED. Las piezas dañadas o perdidas generan un movimiento
 * LOSS y reducen el total del artículo (nunca por debajo de cero).
 */
export async function returnReservation(
  actor: SessionUser,
  input: { reservationId: string; returnedQuantity: number; damagedQuantity: number; notes?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const r = await loadReservation(tx, input.reservationId);
    await lockItem(tx, r.inventoryItemId);
    assertReservationTransition(r.status, "RETURNED");
    const problem = validateReturn({
      quantity: r.quantity,
      returnedQuantity: input.returnedQuantity,
      damagedQuantity: input.damagedQuantity,
    });
    if (problem) throw new ValidationError(problem, { damagedQuantity: [problem] });

    await tx.inventoryReservation.update({
      where: { id: r.id },
      data: {
        status: "RETURNED",
        returnedQuantity: input.returnedQuantity,
        damagedQuantity: input.damagedQuantity,
        notes: input.notes ?? r.notes,
      },
    });
    if (input.returnedQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: r.inventoryItemId,
          eventId: r.eventId,
          type: "RETURN",
          quantity: input.returnedQuantity,
          reason: `Regreso de ${r.event.title}`,
          actorId: actor.id,
        },
      });
    }
    if (input.damagedQuantity > 0) {
      const item = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: r.inventoryItemId },
        select: { totalQuantity: true, maintenanceQuantity: true },
      });
      const next = applyReturnLoss(item, input.damagedQuantity);
      await tx.inventoryItem.update({ where: { id: r.inventoryItemId }, data: next });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: r.inventoryItemId,
          eventId: r.eventId,
          type: "LOSS",
          quantity: input.damagedQuantity,
          reason: input.notes ? `Daño/pérdida en ${r.event.code}: ${input.notes}` : `Daño/pérdida en ${r.event.code}`,
          actorId: actor.id,
        },
      });
      await audit(
        {
          action: "inventory.loss_recorded",
          entityType: "InventoryItem",
          entityId: r.inventoryItemId,
          before: item,
          after: { ...next, damaged: input.damagedQuantity, eventId: r.eventId },
          actor,
        },
        tx,
      );
    }
    return { eventId: r.eventId, itemId: r.inventoryItemId };
  }, TX_OPTIONS);
}

/** Libera una reserva: RESERVED → CANCELLED + movimiento RELEASE. */
export async function cancelReservation(actor: SessionUser, input: { reservationId: string }) {
  return prisma.$transaction(async (tx) => {
    const r = await loadReservation(tx, input.reservationId);
    assertReservationTransition(r.status, "CANCELLED");
    await tx.inventoryReservation.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
    await tx.inventoryMovement.create({
      data: {
        inventoryItemId: r.inventoryItemId,
        eventId: r.eventId,
        type: "RELEASE",
        quantity: r.quantity,
        reason: `Reserva liberada manualmente (${r.event.code})`,
        actorId: actor.id,
      },
    });
    await audit(
      {
        action: "inventory.reservation_cancelled",
        entityType: "InventoryReservation",
        entityId: r.id,
        before: { status: r.status, quantity: r.quantity },
        after: { status: "CANCELLED" },
        actor,
      },
      tx,
    );
    return { eventId: r.eventId, itemId: r.inventoryItemId };
  }, TX_OPTIONS);
}
