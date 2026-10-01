/**
 * Integración: Inventario (reservas, faltantes, ajustes), Compras (transiciones) y Proveedores (CRUD).
 * Usa la base de PRUEBAS; cada prueba crea sus propios datos con valores únicos.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/db";
import { addDaysUtc, dateOnly, localDateKey, toDateKey, zonedDateTime } from "@/lib/dates";
import type { SessionUser } from "@/server/auth/session";
import {
  addReservation,
  cancelReservation,
  checkOutAllForEvent,
  checkOutReservation,
  getEventShortages,
  recalculateEventReservations,
  releaseInventoryForEvent,
  reserveInventoryForEvent,
  returnReservation,
  updateReservationQuantity,
} from "@/features/inventory/server/reservation-service";
import { adjustStock, createInventoryItem, updateInventoryItem } from "@/features/inventory/server/inventory-service";
import { getEventReservations, getInventoryConflicts, listInventory } from "@/features/inventory/server/queries";
import {
  attachReceipt,
  createPurchase,
  transitionPurchase,
  updateActualAmount,
  updatePurchase,
} from "@/features/purchases/server/purchase-service";
import { getEventPurchaseSummary, listPurchases } from "@/features/purchases/server/queries";
import { createVendor, deleteVendor, updateVendor } from "@/features/vendors/server/vendor-service";
import { getVendorDetail, listVendors } from "@/features/vendors/server/queries";
import { testOwner, uid } from "./helpers";

let owner: SessionUser;
let customerId: string;
const createdEventIds: string[] = [];

/** Fecha (YYYY-MM-DD) dentro de la ventana de conflictos (hoy + n días, CDMX). */
function dayKey(offset: number): string {
  return toDateKey(addDaysUtc(dateOnly(localDateKey()), offset));
}

async function makeItem(over: { total?: number; maintenance?: number; threshold?: number; name?: string } = {}) {
  return prisma.inventoryItem.create({
    data: {
      sku: uid("SKU-").toUpperCase(),
      name: over.name ?? `Copa de prueba ${uid()}`,
      category: "GLASSWARE",
      totalQuantity: over.total ?? 20,
      maintenanceQuantity: over.maintenance ?? 0,
      lowStockThreshold: over.threshold ?? 0,
      replacementCostCents: 15_000,
    },
  });
}

async function makeExperience(reqs: Array<{ inventoryItemId: string; quantity: number; perGuest: boolean }>) {
  return prisma.experience.create({
    data: {
      name: `Experiencia ${uid()}`,
      slug: uid("exp-"),
      description: "Experiencia de prueba de inventario",
      basePriceCents: 1_000_000,
      inventoryReqs: { create: reqs },
    },
  });
}

async function makeAddOn(reqs: Array<{ inventoryItemId: string; quantity: number; perGuest: boolean }>) {
  return prisma.addOn.create({
    data: {
      name: `Add-on ${uid()}`,
      slug: uid("addon-"),
      priceCents: 50_000,
      inventoryReqs: { create: reqs },
    },
  });
}

async function makeEvent(opts: {
  dateKey: string;
  guestCount: number;
  experienceId?: string | null;
  status?: "CONFIRMED" | "PLANNING" | "CANCELLED" | "COMPLETED";
}) {
  const event = await prisma.event.create({
    data: {
      code: uid("EV-").toUpperCase(),
      title: `Evento de prueba ${uid()}`,
      status: opts.status ?? "CONFIRMED",
      customerId,
      experienceId: opts.experienceId ?? null,
      eventDate: dateOnly(opts.dateKey),
      startsAt: zonedDateTime(opts.dateKey, "11:00"),
      endsAt: zonedDateTime(opts.dateKey, "14:00"),
      guestCount: opts.guestCount,
      micrositeSlug: uid("ms-"),
      inviteToken: uid("inv"),
      portalToken: uid("por"),
    },
  });
  createdEventIds.push(event.id);
  return event;
}

beforeAll(async () => {
  owner = await testOwner();
  const customer = await prisma.customer.create({
    data: { name: "Clienta Inventario", referralCode: uid("REF-").toUpperCase() },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// -----------------------------------------------------------------------------
// INVENTARIO
// -----------------------------------------------------------------------------

describe("reserveInventoryForEvent", () => {
  it("es idempotente: mismas filas y un solo movimiento RESERVE por artículo", async () => {
    const plato = await makeItem({ total: 60 });
    const mantel = await makeItem({ total: 10 });
    const microfono = await makeItem({ total: 4 });
    const exp = await makeExperience([
      { inventoryItemId: plato.id, quantity: 1, perGuest: true },
      { inventoryItemId: mantel.id, quantity: 2, perGuest: false },
    ]);
    const addOn = await makeAddOn([{ inventoryItemId: microfono.id, quantity: 1, perGuest: false }]);
    const event = await makeEvent({ dateKey: dayKey(20), guestCount: 8, experienceId: exp.id });
    await prisma.eventAddOn.create({
      data: { eventId: event.id, addOnId: addOn.id, quantity: 2, priceCents: 100_000, costCents: 20_000 },
    });

    const first = await reserveInventoryForEvent(event.id, { actor: owner });
    const second = await reserveInventoryForEvent(event.id, { actor: owner });
    expect(first).toEqual({ reserved: 3, shortages: [] });
    expect(second).toEqual(first);

    const rows = await prisma.inventoryReservation.findMany({ where: { eventId: event.id } });
    expect(rows).toHaveLength(3);
    const qty = Object.fromEntries(rows.map((r) => [r.inventoryItemId, r.quantity]));
    expect(qty[plato.id]).toBe(8);
    expect(qty[mantel.id]).toBe(2);
    expect(qty[microfono.id]).toBe(2);

    const reserves = await prisma.inventoryMovement.findMany({ where: { eventId: event.id, type: "RESERVE" } });
    expect(reserves).toHaveLength(3);
    expect(reserves.every((m) => m.actorId === owner.id)).toBe(true);

    // Cambia el número de invitadas: sólo se registra la diferencia
    await prisma.event.update({ where: { id: event.id }, data: { guestCount: 10 } });
    await reserveInventoryForEvent(event.id);
    await prisma.event.update({ where: { id: event.id }, data: { guestCount: 6 } });
    await reserveInventoryForEvent(event.id);
    const platoMoves = await prisma.inventoryMovement.findMany({
      where: { eventId: event.id, inventoryItemId: plato.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(platoMoves.map((m) => [m.type, m.quantity])).toEqual([
      ["RESERVE", 8],
      ["RESERVE", 2],
      ["RELEASE", 4],
    ]);
    const platoRes = await prisma.inventoryReservation.findUniqueOrThrow({
      where: { inventoryItemId_eventId: { inventoryItemId: plato.id, eventId: event.id } },
    });
    expect(platoRes.quantity).toBe(6);

    // Quitar el add-on libera su reserva
    await prisma.eventAddOn.deleteMany({ where: { eventId: event.id } });
    const after = await reserveInventoryForEvent(event.id);
    expect(after.reserved).toBe(2);
    const micRes = await prisma.inventoryReservation.findUniqueOrThrow({
      where: { inventoryItemId_eventId: { inventoryItemId: microfono.id, eventId: event.id } },
    });
    expect(micRes.status).toBe("CANCELLED");
    const release = await prisma.inventoryMovement.findMany({
      where: { eventId: event.id, inventoryItemId: microfono.id, type: "RELEASE" },
    });
    expect(release.map((m) => m.quantity)).toEqual([2]);
  });

  it("ejecuciones concurrentes no duplican reservas ni movimientos", async () => {
    const item = await makeItem({ total: 40 });
    const exp = await makeExperience([{ inventoryItemId: item.id, quantity: 1, perGuest: true }]);
    const event = await makeEvent({ dateKey: dayKey(21), guestCount: 7, experienceId: exp.id });
    await Promise.all([reserveInventoryForEvent(event.id), reserveInventoryForEvent(event.id), reserveInventoryForEvent(event.id)]);
    expect(await prisma.inventoryReservation.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.inventoryMovement.count({ where: { eventId: event.id, type: "RESERVE" } })).toBe(1);
  });

  it("detecta faltantes entre dos eventos el mismo día y los expone en conflictos", async () => {
    const copa = await makeItem({ total: 10 });
    const exp = await makeExperience([{ inventoryItemId: copa.id, quantity: 1, perGuest: true }]);
    const date = dayKey(25);
    const e1 = await makeEvent({ dateKey: date, guestCount: 6, experienceId: exp.id });
    const e2 = await makeEvent({ dateKey: date, guestCount: 6, experienceId: exp.id });
    const other = await makeEvent({ dateKey: dayKey(26), guestCount: 6, experienceId: exp.id });

    expect((await reserveInventoryForEvent(e1.id)).shortages).toEqual([]);
    expect((await reserveInventoryForEvent(other.id)).shortages).toEqual([]); // otro día no compite
    const res2 = await reserveInventoryForEvent(e2.id);
    expect(res2.shortages).toEqual([
      { inventoryItemId: copa.id, sku: copa.sku, name: copa.name, required: 6, available: 4, shortBy: 2 },
    ]);
    // El primer evento también queda en conflicto (compite con el segundo)
    expect((await getEventShortages(e1.id)).map((s) => s.shortBy)).toEqual([2]);

    const conflicts = (await getInventoryConflicts({ days: 60 })).filter((c) => c.item.id === copa.id);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ date, required: 12, available: 10, shortBy: 2 });
    expect(conflicts[0]!.events.map((e) => e.id).sort()).toEqual([e1.id, e2.id].sort());

    const listing = await listInventory({ conflict: "1" });
    expect(listing.rows.some((r) => r.id === copa.id && r.conflictDates.includes(date))).toBe(true);

    // Cancelar el segundo evento libera sus piezas y quita el conflicto
    await prisma.event.update({ where: { id: e2.id }, data: { status: "CANCELLED" } });
    const cancelled = await reserveInventoryForEvent(e2.id);
    expect(cancelled).toEqual({ reserved: 0, shortages: [] });
    const after = (await getInventoryConflicts({ days: 60 })).filter((c) => c.item.id === copa.id);
    expect(after).toHaveLength(0);
    expect(await getEventShortages(e1.id)).toEqual([]);
  });

  it("las piezas en mantenimiento reducen la disponibilidad", async () => {
    const vaso = await makeItem({ total: 10, maintenance: 5 });
    const exp = await makeExperience([{ inventoryItemId: vaso.id, quantity: 1, perGuest: true }]);
    const event = await makeEvent({ dateKey: dayKey(30), guestCount: 6, experienceId: exp.id });
    const res = await reserveInventoryForEvent(event.id);
    expect(res.shortages).toEqual([
      expect.objectContaining({ inventoryItemId: vaso.id, required: 6, available: 5, shortBy: 1 }),
    ]);
    await adjustStock(owner, { itemId: vaso.id, type: "MAINTENANCE_IN", quantity: 5, direction: "IN", reason: "Reparados" });
    expect(await getEventShortages(event.id)).toEqual([]);

    const data = await getEventReservations(event.id);
    expect(data?.reservations[0]).toMatchObject({ quantity: 6, requiredByRules: 6, shortage: null });
  });
});

describe("operación de reservas", () => {
  it("edita cantidades, entrega, registra regreso con daños y libera", async () => {
    const copa = await makeItem({ total: 12 });
    const mantel = await makeItem({ total: 5 });
    const event = await makeEvent({ dateKey: dayKey(15), guestCount: 8 });
    const { reservationId } = await addReservation(owner, { eventId: event.id, inventoryItemId: copa.id, quantity: 8 });
    await expect(addReservation(owner, { eventId: event.id, inventoryItemId: copa.id, quantity: 2 })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    // Edición manual: registra la diferencia y avisa si no alcanza
    const edit = await updateReservationQuantity(owner, { reservationId, quantity: 14 });
    expect(edit.shortage).toMatchObject({ required: 14, available: 12, shortBy: 2 });
    await updateReservationQuantity(owner, { reservationId, quantity: 10 });
    const moves = await prisma.inventoryMovement.findMany({
      where: { eventId: event.id, inventoryItemId: copa.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(moves.map((m) => [m.type, m.quantity])).toEqual([
      ["RESERVE", 8],
      ["RESERVE", 6],
      ["RELEASE", 4],
    ]);
    expect(
      await prisma.auditLog.count({ where: { action: "inventory.reservation_updated", entityId: reservationId } }),
    ).toBe(2);

    // Regreso sólo después de la salida
    await expect(
      returnReservation(owner, { reservationId, returnedQuantity: 10, damagedQuantity: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await checkOutReservation(owner, { reservationId });
    await expect(checkOutReservation(owner, { reservationId })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateReservationQuantity(owner, { reservationId, quantity: 3 })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(cancelReservation(owner, { reservationId })).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      returnReservation(owner, { reservationId, returnedQuantity: 8, damagedQuantity: 1 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await returnReservation(owner, { reservationId, returnedQuantity: 8, damagedQuantity: 2, notes: "2 copas rotas" });

    const res = await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } });
    expect(res).toMatchObject({ status: "RETURNED", returnedQuantity: 8, damagedQuantity: 2 });
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: copa.id } });
    expect(item.totalQuantity).toBe(10);
    const tail = await prisma.inventoryMovement.findMany({
      where: { eventId: event.id, inventoryItemId: copa.id, type: { in: ["CHECK_OUT", "RETURN", "LOSS"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(tail.map((m) => [m.type, m.quantity])).toEqual([
      ["CHECK_OUT", 10],
      ["RETURN", 8],
      ["LOSS", 2],
    ]);
    expect(await prisma.auditLog.count({ where: { action: "inventory.loss_recorded", entityId: copa.id } })).toBe(1);

    // Liberar una reserva activa
    const second = await addReservation(owner, { eventId: event.id, inventoryItemId: mantel.id, quantity: 2 });
    await cancelReservation(owner, { reservationId: second.reservationId });
    const released = await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: second.reservationId } });
    expect(released.status).toBe("CANCELLED");
    expect(
      await prisma.inventoryMovement.count({ where: { eventId: event.id, inventoryItemId: mantel.id, type: "RELEASE" } }),
    ).toBe(1);
    // Reactivar con "Agregar artículo"
    await addReservation(owner, { eventId: event.id, inventoryItemId: mantel.id, quantity: 3 });
    expect((await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: second.reservationId } })).status).toBe("RESERVED");
  });

  it("entrega todo y libera al cancelar", async () => {
    const a = await makeItem({ total: 10 });
    const b = await makeItem({ total: 10 });
    const event = await makeEvent({ dateKey: dayKey(16), guestCount: 4 });
    await addReservation(owner, { eventId: event.id, inventoryItemId: a.id, quantity: 4 });
    await addReservation(owner, { eventId: event.id, inventoryItemId: b.id, quantity: 2 });
    const bulk = await checkOutAllForEvent(owner, { eventId: event.id });
    expect(bulk.checkedOut).toBe(2);
    expect(await checkOutAllForEvent(owner, { eventId: event.id })).toEqual({ checkedOut: 0 });

    const event2 = await makeEvent({ dateKey: dayKey(17), guestCount: 4 });
    await addReservation(owner, { eventId: event2.id, inventoryItemId: a.id, quantity: 4 });
    expect(await releaseInventoryForEvent(event2.id, { actor: owner })).toEqual({ released: 1 });
    expect(await releaseInventoryForEvent(event2.id, { actor: owner })).toEqual({ released: 0 });

    const cancelledEvent = await makeEvent({ dateKey: dayKey(18), guestCount: 4, status: "CANCELLED" });
    await expect(
      addReservation(owner, { eventId: cancelledEvent.id, inventoryItemId: a.id, quantity: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("en eventos cancelados sólo permite liberar (con auditoría) y no recalcula eventos completados", async () => {
    const item = await makeItem({ total: 10 });
    const other = await makeItem({ total: 10 });
    const event = await makeEvent({ dateKey: dayKey(19), guestCount: 4 });
    const { reservationId } = await addReservation(owner, { eventId: event.id, inventoryItemId: item.id, quantity: 3 });
    await addReservation(owner, { eventId: event.id, inventoryItemId: other.id, quantity: 2 });

    // El evento se cancela por fuera del módulo con piezas aún apartadas
    await prisma.event.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
    await expect(checkOutReservation(owner, { reservationId })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateReservationQuantity(owner, { reservationId, quantity: 5 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.inventoryMovement.count({ where: { eventId: event.id, type: "CHECK_OUT" } })).toBe(0);

    expect(await releaseInventoryForEvent(event.id, { actor: owner, reason: "Cancelado" })).toEqual({ released: 2 });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "inventory.reservations_released", entityId: event.id } });
    expect(log.after).toMatchObject({ released: 2 });
    expect(
      (await prisma.inventoryMovement.findMany({ where: { eventId: event.id, type: "RELEASE" } })).map((m) => m.quantity).sort(),
    ).toEqual([2, 3]);

    // Re-agregar algo ya devuelto no se permite (mensaje claro)
    const done = await makeEvent({ dateKey: dayKey(9), guestCount: 2 });
    const r = await addReservation(owner, { eventId: done.id, inventoryItemId: item.id, quantity: 1 });
    await checkOutReservation(owner, { reservationId: r.reservationId });
    await expect(addReservation(owner, { eventId: done.id, inventoryItemId: item.id, quantity: 1 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("salió"),
    });
    await returnReservation(owner, { reservationId: r.reservationId, returnedQuantity: 1, damagedQuantity: 0 });
    await expect(addReservation(owner, { eventId: done.id, inventoryItemId: item.id, quantity: 1 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("regresó"),
    });

    // Los eventos completados no se recalculan desde el panel
    await prisma.event.update({ where: { id: done.id }, data: { status: "COMPLETED" } });
    await expect(recalculateEventReservations(owner, done.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(recalculateEventReservations(owner, "no-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("artículos y ajustes de stock", () => {
  it("crea artículos con SKU único (error amigable) y registra el alta", async () => {
    const sku = uid("NEW-").toUpperCase();
    const item = await createInventoryItem(owner, {
      sku,
      name: "Jarra de prueba",
      category: "SERVING",
      unit: "pz",
      totalQuantity: 6,
      lowStockThreshold: 2,
      replacementCostCents: 25_000,
      location: "Bodega",
      notes: null,
      active: true,
    });
    expect(item.totalQuantity).toBe(6);
    expect(await prisma.inventoryMovement.count({ where: { inventoryItemId: item.id, type: "ADJUSTMENT", quantity: 6 } })).toBe(1);
    await expect(
      createInventoryItem(owner, {
        sku: sku.toLowerCase(),
        name: "Duplicada",
        category: "SERVING",
        unit: "pz",
        totalQuantity: 0,
        lowStockThreshold: 0,
        replacementCostCents: 0,
        location: null,
        notes: null,
        active: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { sku: [expect.stringContaining("SKU")] } });

    const updated = await updateInventoryItem(owner, {
      id: item.id,
      sku,
      name: "Jarra de vidrio",
      category: "SERVING",
      unit: "pz",
      lowStockThreshold: 3,
      replacementCostCents: 30_000,
      location: "Bodega",
      notes: "Frágil",
      active: true,
    });
    expect(updated.totalQuantity).toBe(6); // la edición no cambia cantidades
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "inventory.item_updated", entityId: item.id } });
    expect(log.after).toMatchObject({ name: "Jarra de vidrio", replacementCostCents: 30_000 });
  });

  it("nunca deja stock negativo y audita cada ajuste", async () => {
    const item = await makeItem({ total: 5 });
    await expect(
      adjustStock(owner, { itemId: item.id, type: "LOSS", quantity: 6, direction: "IN", reason: "Se rompieron" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).totalQuantity).toBe(5);
    expect(await prisma.inventoryMovement.count({ where: { inventoryItemId: item.id } })).toBe(0);

    await adjustStock(owner, { itemId: item.id, type: "LOSS", quantity: 2, direction: "IN", reason: "Rotas en lavado" });
    await adjustStock(owner, { itemId: item.id, type: "PURCHASE_IN", quantity: 4, direction: "IN", reason: "Compra" });
    await adjustStock(owner, { itemId: item.id, type: "MAINTENANCE_OUT", quantity: 3, direction: "IN", reason: "Pulido" });
    await adjustStock(owner, { itemId: item.id, type: "ADJUSTMENT", quantity: 1, direction: "OUT", reason: "Conteo físico" });
    await expect(
      adjustStock(owner, { itemId: item.id, type: "ADJUSTMENT", quantity: 4, direction: "OUT", reason: "Conteo" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      adjustStock(owner, { itemId: item.id, type: "MAINTENANCE_IN", quantity: 4, direction: "IN", reason: "Regreso" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const final = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(final).toMatchObject({ totalQuantity: 6, maintenanceQuantity: 3 });
    const moves = await prisma.inventoryMovement.findMany({ where: { inventoryItemId: item.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(moves.map((m) => [m.type, m.quantity, m.actorId])).toEqual([
      ["LOSS", 2, owner.id],
      ["PURCHASE_IN", 4, owner.id],
      ["MAINTENANCE_OUT", 3, owner.id],
      ["ADJUSTMENT", -1, owner.id],
    ]);
    const audits = await prisma.auditLog.findMany({ where: { action: "inventory.adjusted", entityId: item.id } });
    expect(audits).toHaveLength(4);
    expect(audits.every((a) => a.actorId === owner.id)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// COMPRAS
// -----------------------------------------------------------------------------

describe("compras", () => {
  it("sigue la máquina de estados y exige monto real al recibir", async () => {
    const event = await makeEvent({ dateKey: dayKey(12), guestCount: 8 });
    const vendor = await createVendor(owner, {
      name: `Florería ${uid()}`,
      category: "FLOWERS",
      contactName: null,
      phone: null,
      whatsapp: "5512345678",
      email: null,
      slaNotes: null,
      notes: null,
      status: "ACTIVE",
      rating: 5,
    });
    const p = await createPurchase(owner, {
      eventId: event.id,
      vendorId: vendor.id,
      concept: "Rosas blush",
      category: "FLOWERS",
      expectedAmountCents: 150_000,
      neededBy: dayKey(11),
      notes: null,
    });
    expect(p).toMatchObject({ status: "REQUESTED", createdById: owner.id });
    expect(localDateKey(p.neededBy!)).toBe(dayKey(11));

    const ordered = await transitionPurchase(owner, { id: p.id, to: "ORDERED" });
    expect(ordered.status).toBe("ORDERED");
    expect(ordered.orderedAt).toBeInstanceOf(Date);

    await expect(transitionPurchase(owner, { id: p.id, to: "RECEIVED" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { actualAmountCents: [expect.any(String)] },
    });

    const receipt = await prisma.mediaAsset.create({
      data: { driver: "LOCAL", storageKey: uid("receipts/"), mimeType: "application/pdf", kind: "DOCUMENT", purpose: "RECEIPT", eventId: event.id },
    });
    const received = await transitionPurchase(owner, {
      id: p.id,
      to: "RECEIVED",
      actualAmountCents: 165_000,
      receiptMediaId: receipt.id,
    });
    expect(received).toMatchObject({ status: "RECEIVED", actualAmountCents: 165_000, receiptMediaId: receipt.id });
    expect(received.receivedAt).toBeInstanceOf(Date);

    // Recibida es terminal
    await expect(transitionPurchase(owner, { id: p.id, to: "CANCELLED", reason: "Ya no" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(transitionPurchase(owner, { id: p.id, to: "REQUESTED" })).rejects.toMatchObject({ code: "CONFLICT" });

    // Corregir el monto real queda auditado
    await updateActualAmount(owner, { id: p.id, actualAmountCents: 158_000, reason: "Factura final" });
    const amountLog = await prisma.auditLog.findFirstOrThrow({ where: { action: "purchase.amount_changed", entityId: p.id } });
    expect(amountLog.before).toEqual({ actualAmountCents: 165_000 });
    expect(amountLog.after).toMatchObject({ actualAmountCents: 158_000, reason: "Factura final" });

    // Resumen del evento (lo consume Finanzas)
    const summary = await getEventPurchaseSummary(event.id);
    expect(summary).toMatchObject({ expectedCents: 150_000, actualCents: 158_000, varianceCents: 8_000 });

    const list = await listPurchases({ event: event.id });
    expect(list.total).toBe(1);
    expect(list.totals.actualCents).toBe(158_000);
  });

  it("cancela con motivo, permite reabrir y valida comprobantes y proveedores", async () => {
    const p = await createPurchase(owner, {
      eventId: null,
      vendorId: null,
      concept: "Servilletas para inventario",
      category: "OTHER",
      expectedAmountCents: 80_000,
      neededBy: null,
      notes: "Color arena",
    });
    await expect(transitionPurchase(owner, { id: p.id, to: "CANCELLED" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const cancelled = await transitionPurchase(owner, { id: p.id, to: "CANCELLED", reason: "Se consiguió donación" });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled.notes).toMatch(/Color arena\nCancelada .*: Se consiguió donación/);
    await expect(transitionPurchase(owner, { id: p.id, to: "ORDERED" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateActualAmount(owner, { id: p.id, actualAmountCents: 1, reason: "xxx" })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const reopened = await transitionPurchase(owner, { id: p.id, to: "REQUESTED" });
    expect(reopened).toMatchObject({ status: "REQUESTED", cancelledAt: null, orderedAt: null });
    expect(await prisma.auditLog.count({ where: { action: "purchase.cancelled", entityId: p.id } })).toBe(1);

    const notReceipt = await prisma.mediaAsset.create({
      data: { driver: "LOCAL", storageKey: uid("misc/"), mimeType: "image/png", purpose: "EVENT" },
    });
    await expect(attachReceipt(owner, { id: p.id, receiptMediaId: notReceipt.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const blocked = await createVendor(owner, {
      name: `Bloqueado ${uid()}`,
      category: "OTHER",
      contactName: null,
      phone: null,
      whatsapp: null,
      email: null,
      slaNotes: null,
      notes: null,
      status: "BLOCKED",
      rating: null,
    });
    await expect(
      updatePurchase(owner, {
        id: p.id,
        eventId: null,
        vendorId: blocked.id,
        concept: p.concept,
        category: p.category,
        expectedAmountCents: 90_000,
        neededBy: null,
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { vendorId: [expect.any(String)] } });

    const updated = await updatePurchase(owner, {
      id: p.id,
      eventId: null,
      vendorId: null,
      concept: "Servilletas de lino arena",
      category: "OTHER",
      expectedAmountCents: 90_000,
      neededBy: dayKey(5),
      notes: null,
    });
    expect(updated).toMatchObject({ concept: "Servilletas de lino arena", expectedAmountCents: 90_000 });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "purchase.updated", entityId: p.id } });
    expect(log.after).toMatchObject({ expectedAmountCents: 90_000, concept: "Servilletas de lino arena" });
  });
});

describe("compras de eventos cerrados", () => {
  it("congelan el costo real: no se reciben, no se corrige el monto ni se mueven de/hacia el evento", async () => {
    const event = await makeEvent({ dateKey: dayKey(-3), guestCount: 6, status: "COMPLETED" });
    const open = await makeEvent({ dateKey: dayKey(4), guestCount: 6 });
    const base = {
      vendorId: null,
      category: "FOOD" as const,
      expectedAmountCents: 50_000,
      neededBy: null,
      notes: null,
    };
    const pending = await createPurchase(owner, { ...base, eventId: event.id, concept: "Pan de prueba" });
    const received = await createPurchase(owner, { ...base, eventId: event.id, concept: "Quesos de prueba" });
    await transitionPurchase(owner, { id: received.id, to: "RECEIVED", actualAmountCents: 52_000 });
    const general = await createPurchase(owner, { ...base, eventId: null, concept: "Compra general de prueba" });

    // Finanzas cierra el evento
    await prisma.event.update({ where: { id: event.id }, data: { closedAt: new Date() } });

    await expect(
      createPurchase(owner, { ...base, eventId: event.id, concept: "Tarde" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { eventId: [expect.stringContaining("cerrado")] } });
    await expect(
      transitionPurchase(owner, { id: pending.id, to: "RECEIVED", actualAmountCents: 49_000 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      updateActualAmount(owner, { id: received.id, actualAmountCents: 60_000, reason: "Ajuste tardío" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Mover la compra fuera del evento cerrado o cambiar su monto/categoría
    await expect(
      updatePurchase(owner, { ...base, id: received.id, eventId: open.id, concept: received.concept }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      updatePurchase(owner, { ...base, id: received.id, eventId: event.id, concept: received.concept, expectedAmountCents: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Meter una compra general a un evento cerrado
    await expect(
      updatePurchase(owner, { ...base, id: general.id, eventId: event.id, concept: general.concept }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Cambios que no tocan el costo sí se permiten; cancelar lo pendiente también
    const renamed = await updatePurchase(owner, { ...base, id: received.id, eventId: event.id, concept: "Quesos maduros", notes: "Factura 123" });
    expect(renamed).toMatchObject({ concept: "Quesos maduros", notes: "Factura 123", actualAmountCents: 52_000 });
    await transitionPurchase(owner, { id: pending.id, to: "CANCELLED", reason: "Ya no se necesitó" });

    const summary = await getEventPurchaseSummary(event.id);
    expect(summary).toMatchObject({ actualCents: 52_000, byStatus: { RECEIVED: 1, CANCELLED: 1 } });
  });
});

// -----------------------------------------------------------------------------
// PROVEEDORES
// -----------------------------------------------------------------------------

describe("proveedores", () => {
  it("CRUD con auditoría, totales y bloqueo de eliminación con historial", async () => {
    const name = `Pastelería ${uid()}`;
    const vendor = await createVendor(owner, {
      name,
      category: "PASTRY",
      contactName: "Mariana",
      phone: "55 1111 2222",
      whatsapp: "55 1111 2222",
      email: "pedidos@pasteleria.test",
      slaNotes: "Pedidos con 72 h",
      notes: null,
      status: "ACTIVE",
      rating: 4,
    });
    expect(await prisma.auditLog.count({ where: { action: "vendor.created", entityId: vendor.id } })).toBe(1);

    const listed = await listVendors({ q: name });
    expect(listed.rows.map((r) => r.id)).toEqual([vendor.id]);

    const updated = await updateVendor(owner, {
      id: vendor.id,
      name,
      category: "PASTRY",
      contactName: "Mariana",
      phone: "55 1111 2222",
      whatsapp: "55 1111 2222",
      email: "pedidos@pasteleria.test",
      slaNotes: "Pedidos con 72 h",
      notes: "Retrasos recientes",
      status: "INACTIVE",
      rating: 3,
    });
    expect(updated).toMatchObject({ status: "INACTIVE", rating: 3 });
    const statusLog = await prisma.auditLog.findFirstOrThrow({ where: { action: "vendor.status_changed", entityId: vendor.id } });
    expect(statusLog.before).toMatchObject({ status: "ACTIVE", rating: 4 });

    const p = await createPurchase(owner, {
      eventId: null,
      vendorId: vendor.id,
      concept: "Pastel de prueba",
      category: "VENDOR",
      expectedAmountCents: 95_000,
      neededBy: null,
      notes: null,
    });
    await transitionPurchase(owner, { id: p.id, to: "RECEIVED", actualAmountCents: 100_000 });
    const detail = await getVendorDetail(vendor.id);
    expect(detail?.totals).toMatchObject({ count: 1, expectedCents: 95_000, actualCents: 100_000, varianceCents: 5_000 });

    await expect(deleteVendor(owner, vendor.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const temp = await createVendor(owner, {
      name: `Temporal ${uid()}`,
      category: "OTHER",
      contactName: null,
      phone: null,
      whatsapp: null,
      email: null,
      slaNotes: null,
      notes: null,
      status: "ACTIVE",
      rating: null,
    });
    await deleteVendor(owner, temp.id);
    expect(await prisma.vendor.findUnique({ where: { id: temp.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "vendor.deleted", entityId: temp.id } })).toBe(1);
  });
});
