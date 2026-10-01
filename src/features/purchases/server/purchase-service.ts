import "server-only";
import type { Prisma, Purchase } from "@prisma/client";
import { prisma } from "@/db";
import { formatShortDate, localDateKey, zonedDateTime } from "@/lib/dates";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { PurchaseRuleError, appendCancellationNote, planPurchaseTransition } from "../domain/purchase-rules";
import type { PurchaseStatus } from "../domain/purchase-status";
import type { CreatePurchaseData, UpdatePurchaseData } from "../schemas";

type Tx = Prisma.TransactionClient;

/** Hora de referencia para "necesario para" cuando sólo se captura la fecha. */
const NEEDED_BY_TIME = "09:00";

function toRuleError(error: unknown): never {
  if (error instanceof PurchaseRuleError) {
    if (error.field) throw new ValidationError(error.message, { [error.field]: [error.message] });
    throw new ConflictError(error.message);
  }
  throw error;
}

const EVENT_CLOSED = "El evento ya está cerrado: sus costos quedaron congelados.";

async function assertEvent(db: Tx, eventId: string | null) {
  if (!eventId) return null;
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, code: true, closedAt: true } });
  if (!event) throw new ValidationError("El evento elegido no existe.", { eventId: ["El evento elegido no existe."] });
  return event;
}

/**
 * Las compras alimentan el costo real del evento; al cerrarlo (Finanzas) sus costos se congelan,
 * igual que los costos manuales. Lanza ConflictError si el evento de la compra ya está cerrado.
 */
async function assertEventCostsOpen(db: Tx, eventId: string | null) {
  if (!eventId) return;
  const event = await db.event.findUnique({ where: { id: eventId }, select: { closedAt: true } });
  if (event?.closedAt) throw new ConflictError(EVENT_CLOSED);
}

async function assertVendor(db: Tx, vendorId: string | null, { allowCurrent }: { allowCurrent?: string | null } = {}) {
  if (!vendorId) return null;
  const vendor = await db.vendor.findUnique({ where: { id: vendorId }, select: { id: true, status: true, name: true } });
  if (!vendor) throw new ValidationError("El proveedor elegido no existe.", { vendorId: ["El proveedor elegido no existe."] });
  if (vendor.status === "BLOCKED" && vendor.id !== allowCurrent) {
    throw new ValidationError("Este proveedor está bloqueado; elige otro.", {
      vendorId: ["Este proveedor está bloqueado; elige otro."],
    });
  }
  return vendor;
}

async function assertReceipt(db: Tx, mediaId: string | null, eventId: string | null) {
  if (!mediaId) return null;
  const media = await db.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { id: true, purpose: true, eventId: true },
  });
  if (!media || media.purpose !== "RECEIPT") {
    throw new ValidationError("El comprobante no es válido. Vuelve a subirlo.", {
      receiptMediaId: ["El comprobante no es válido. Vuelve a subirlo."],
    });
  }
  if (media.eventId && eventId && media.eventId !== eventId) {
    throw new ValidationError("El comprobante pertenece a otro evento.", {
      receiptMediaId: ["El comprobante pertenece a otro evento."],
    });
  }
  return media;
}

async function lockPurchase(tx: Tx, id: string): Promise<Purchase> {
  await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${id} FOR UPDATE`;
  const purchase = await tx.purchase.findUnique({ where: { id } });
  if (!purchase) throw new NotFoundError("No encontramos la compra.");
  return purchase;
}

function neededByFromKey(key: string | null, current: Date | null = null): Date | null {
  if (!key) return null;
  // Si la fecha no cambió, conservamos la hora original (p. ej. "4 h antes del evento").
  if (current && localDateKey(current) === key) return current;
  return zonedDateTime(key, NEEDED_BY_TIME);
}

export async function createPurchase(actor: SessionUser, data: CreatePurchaseData) {
  return prisma.$transaction(async (tx) => {
    const event = await assertEvent(tx, data.eventId);
    if (event?.closedAt) throw new ValidationError(EVENT_CLOSED, { eventId: [EVENT_CLOSED] });
    await assertVendor(tx, data.vendorId);
    const purchase = await tx.purchase.create({
      data: {
        eventId: data.eventId,
        vendorId: data.vendorId,
        concept: data.concept,
        category: data.category,
        expectedAmountCents: data.expectedAmountCents,
        neededBy: neededByFromKey(data.neededBy),
        notes: data.notes,
        status: "REQUESTED",
        createdById: actor.id,
      },
    });
    await audit(
      {
        action: "purchase.created",
        entityType: "Purchase",
        entityId: purchase.id,
        after: { concept: purchase.concept, expectedAmountCents: purchase.expectedAmountCents, eventId: purchase.eventId },
        actor,
      },
      tx,
    );
    return purchase;
  });
}

const EDITABLE_FIELDS = ["eventId", "vendorId", "concept", "category", "expectedAmountCents", "neededBy", "notes"] as const;

export async function updatePurchase(actor: SessionUser, data: UpdatePurchaseData) {
  return prisma.$transaction(async (tx) => {
    const before = await lockPurchase(tx, data.id);
    // En un evento cerrado sólo se permiten cambios que no tocan el costo (concepto, notas, fecha, proveedor).
    const costChanged =
      data.eventId !== before.eventId ||
      data.category !== before.category ||
      data.expectedAmountCents !== before.expectedAmountCents;
    if (costChanged) await assertEventCostsOpen(tx, before.eventId);
    const event = await assertEvent(tx, data.eventId);
    if (event?.closedAt && data.eventId !== before.eventId) {
      throw new ValidationError(EVENT_CLOSED, { eventId: [EVENT_CLOSED] });
    }
    await assertVendor(tx, data.vendorId, { allowCurrent: before.vendorId });
    const updated = await tx.purchase.update({
      where: { id: data.id },
      data: {
        eventId: data.eventId,
        vendorId: data.vendorId,
        concept: data.concept,
        category: data.category,
        expectedAmountCents: data.expectedAmountCents,
        neededBy: neededByFromKey(data.neededBy, before.neededBy),
        notes: data.notes,
      },
    });
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      const a = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
      const b = updated[key] instanceof Date ? (updated[key] as Date).toISOString() : updated[key];
      if (a !== b) {
        changedBefore[key] = a;
        changedAfter[key] = b;
      }
    }
    if (Object.keys(changedAfter).length) {
      await audit(
        { action: "purchase.updated", entityType: "Purchase", entityId: data.id, before: changedBefore, after: changedAfter, actor },
        tx,
      );
    }
    return updated;
  });
}

/**
 * Cambia el estado de una compra con purchaseStatusMachine:
 *  REQUESTED→ORDERED (orderedAt), →RECEIVED (requiere monto real; receivedAt; comprobante opcional),
 *  →CANCELLED (cancelledAt; motivo en notas), reabrir →REQUESTED.
 */
export async function transitionPurchase(
  actor: SessionUser,
  input: {
    id: string;
    to: PurchaseStatus;
    actualAmountCents?: number | null;
    reason?: string | null;
    receiptMediaId?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const current = await lockPurchase(tx, input.id);
    // Recibir cambia el costo real del evento: no se permite si ya se cerró.
    if (input.to === "RECEIVED") await assertEventCostsOpen(tx, current.eventId);
    const now = new Date();
    let patch;
    try {
      patch = planPurchaseTransition(current, {
        to: input.to,
        actualAmountCents: input.actualAmountCents,
        reason: input.reason,
        now,
      });
    } catch (error) {
      toRuleError(error);
    }
    const data: Prisma.PurchaseUpdateInput = { ...patch };
    if (input.to === "CANCELLED" && input.reason) {
      data.notes = appendCancellationNote(current.notes, input.reason, formatShortDate(now));
    }
    if (input.to === "RECEIVED" && input.receiptMediaId) {
      await assertReceipt(tx, input.receiptMediaId, current.eventId);
      data.receiptMedia = { connect: { id: input.receiptMediaId } };
    }
    const updated = await tx.purchase.update({ where: { id: input.id }, data });
    await audit(
      {
        action: input.to === "CANCELLED" ? "purchase.cancelled" : "purchase.status_changed",
        entityType: "Purchase",
        entityId: input.id,
        before: { status: current.status, actualAmountCents: current.actualAmountCents },
        after: {
          status: updated.status,
          actualAmountCents: updated.actualAmountCents,
          ...(input.reason ? { reason: input.reason } : {}),
        },
        actor,
      },
      tx,
    );
    return updated;
  });
}

/** Corrige el monto real de una compra ya recibida (auditado como "purchase.amount_changed"). */
export async function updateActualAmount(
  actor: SessionUser,
  input: { id: string; actualAmountCents: number; reason: string },
) {
  return prisma.$transaction(async (tx) => {
    const current = await lockPurchase(tx, input.id);
    if (current.status !== "RECEIVED") {
      throw new ConflictError("Sólo puedes corregir el monto real de compras recibidas.");
    }
    await assertEventCostsOpen(tx, current.eventId);
    if (current.actualAmountCents === input.actualAmountCents) return current;
    const updated = await tx.purchase.update({
      where: { id: input.id },
      data: { actualAmountCents: input.actualAmountCents },
    });
    await audit(
      {
        action: "purchase.amount_changed",
        entityType: "Purchase",
        entityId: input.id,
        before: { actualAmountCents: current.actualAmountCents },
        after: { actualAmountCents: input.actualAmountCents, reason: input.reason },
        actor,
      },
      tx,
    );
    return updated;
  });
}

/** Adjunta (o quita con null) el comprobante de una compra. */
export async function attachReceipt(actor: SessionUser, input: { id: string; receiptMediaId: string | null }) {
  return prisma.$transaction(async (tx) => {
    const current = await lockPurchase(tx, input.id);
    await assertReceipt(tx, input.receiptMediaId, current.eventId);
    const updated = await tx.purchase.update({
      where: { id: input.id },
      data: { receiptMediaId: input.receiptMediaId },
    });
    await audit(
      {
        action: input.receiptMediaId ? "purchase.receipt_attached" : "purchase.receipt_removed",
        entityType: "Purchase",
        entityId: input.id,
        before: { receiptMediaId: current.receiptMediaId },
        after: { receiptMediaId: input.receiptMediaId },
        actor,
      },
      tx,
    );
    return updated;
  });
}
