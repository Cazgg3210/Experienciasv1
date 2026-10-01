import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "@/lib/state-machine";
import { planReservation, requirementsForEvent } from "./requirements";
import {
  availableOn,
  availableToday,
  detectConflicts,
  isLowStock,
  maxReservedByDate,
  reservedQuantity,
  shortages,
  usableQuantity,
} from "./availability";
import { StockAdjustmentError, applyReturnLoss, applyStockAdjustment, signedMovementQuantity } from "./stock";
import { reservationStatusMachine, validateReturn } from "./reservation-status";

describe("requirementsForEvent", () => {
  it("multiplica por invitadas los requerimientos perGuest y por cantidad del add-on los fijos", () => {
    const req = requirementsForEvent({
      guestCount: 10,
      experienceReqs: [
        { inventoryItemId: "plato", quantity: 1, perGuest: true },
        { inventoryItemId: "mantel", quantity: 2, perGuest: false },
      ],
      addOnReqs: [
        { inventoryItemId: "copa", quantity: 1, perGuest: true, addOnQuantity: 3 },
        { inventoryItemId: "microfono", quantity: 2, perGuest: false, addOnQuantity: 2 },
        { inventoryItemId: "plato", quantity: 1, perGuest: false, addOnQuantity: 1 },
      ],
    });
    expect(req.get("plato")).toBe(11);
    expect(req.get("mantel")).toBe(2);
    expect(req.get("copa")).toBe(10);
    expect(req.get("microfono")).toBe(4);
  });

  it("ignora cantidades no positivas", () => {
    const req = requirementsForEvent({
      guestCount: 0,
      experienceReqs: [{ inventoryItemId: "plato", quantity: 1, perGuest: true }],
      addOnReqs: [{ inventoryItemId: "copa", quantity: 1, perGuest: false, addOnQuantity: 0 }],
    });
    expect(req.size).toBe(0);
  });
});

describe("planReservation", () => {
  it("crea, actualiza por delta, libera y reactiva", () => {
    expect(planReservation({ required: 5, existing: null })).toEqual({ kind: "create", quantity: 5 });
    expect(planReservation({ required: 0, existing: null })).toEqual({ kind: "noop" });
    expect(planReservation({ required: 5, existing: { quantity: 5, status: "RESERVED" } })).toEqual({ kind: "noop" });
    expect(planReservation({ required: 8, existing: { quantity: 5, status: "RESERVED" } })).toEqual({
      kind: "update",
      quantity: 8,
      delta: 3,
    });
    expect(planReservation({ required: 2, existing: { quantity: 5, status: "RESERVED" } })).toEqual({
      kind: "update",
      quantity: 2,
      delta: -3,
    });
    expect(planReservation({ required: 0, existing: { quantity: 5, status: "RESERVED" } })).toEqual({
      kind: "release",
      quantity: 5,
    });
    expect(planReservation({ required: 4, existing: { quantity: 5, status: "CANCELLED" } })).toEqual({
      kind: "reactivate",
      quantity: 4,
    });
  });

  it("no toca reservas entregadas o devueltas", () => {
    expect(planReservation({ required: 9, existing: { quantity: 5, status: "CHECKED_OUT" } })).toEqual({ kind: "noop" });
    expect(planReservation({ required: 0, existing: { quantity: 5, status: "RETURNED" } })).toEqual({ kind: "noop" });
  });
});

describe("availability", () => {
  const item = { totalQuantity: 24, maintenanceQuantity: 2 };

  it("descuenta mantenimiento y reservas activas de otros eventos", () => {
    expect(usableQuantity(item)).toBe(22);
    expect(
      availableOn(item, [
        { quantity: 10, status: "RESERVED" },
        { quantity: 3, status: "CHECKED_OUT" },
        { quantity: 5, status: "CANCELLED" },
        { quantity: 4, status: "RETURNED" },
        { quantity: 6, status: "RESERVED", eventStatus: "CANCELLED" },
      ]),
    ).toBe(9);
  });

  it("nunca devuelve disponibilidad negativa", () => {
    expect(availableOn(item, [{ quantity: 40, status: "RESERVED" }])).toBe(0);
    expect(usableQuantity({ totalQuantity: 1, maintenanceQuantity: 3 })).toBe(0);
  });

  it("calcula faltantes", () => {
    const req = new Map([
      ["a", 10],
      ["b", 3],
      ["c", 7],
    ]);
    const avail = new Map([
      ["a", 4],
      ["b", 5],
    ]);
    expect(shortages(req, avail)).toEqual([
      { inventoryItemId: "c", required: 7, available: 0, shortBy: 7 },
      { inventoryItemId: "a", required: 10, available: 4, shortBy: 6 },
    ]);
  });

  it("umbral bajo y suma de reservas", () => {
    expect(isLowStock({ totalQuantity: 10, maintenanceQuantity: 7, lowStockThreshold: 3 })).toBe(true);
    expect(isLowStock({ totalQuantity: 10, maintenanceQuantity: 0, lowStockThreshold: 3 })).toBe(false);
    expect(isLowStock({ totalQuantity: 0, maintenanceQuantity: 0, lowStockThreshold: 0 })).toBe(false);
    expect(reservedQuantity([{ quantity: 2, status: "RESERVED" }, { quantity: 3, status: "RETURNED" }])).toBe(2);
  });

  it("toma el pico reservado por fecha", () => {
    const res = maxReservedByDate([
      { dateKey: "2026-10-10", quantity: 10, status: "RESERVED" },
      { dateKey: "2026-10-10", quantity: 12, status: "RESERVED" },
      { dateKey: "2026-10-17", quantity: 15, status: "RESERVED" },
      { dateKey: "2026-10-18", quantity: 30, status: "CANCELLED" },
    ]);
    expect(res).toEqual({ max: 22, dateKey: "2026-10-10" });
  });

  it("disponible hoy incluye piezas que siguen fuera", () => {
    const rows = [
      { dateKey: "2026-10-01", quantity: 5, status: "RESERVED" as const },
      { dateKey: "2026-09-30", quantity: 3, status: "CHECKED_OUT" as const },
      { dateKey: "2026-10-05", quantity: 8, status: "RESERVED" as const },
    ];
    expect(availableToday(item, rows, "2026-10-01")).toBe(14);
  });

  it("detecta conflictos por fecha y artículo", () => {
    const stock = new Map([
      ["copa", { totalQuantity: 24, maintenanceQuantity: 2 }],
      ["plato", { totalQuantity: 60, maintenanceQuantity: 0 }],
    ]);
    const conflicts = detectConflicts(
      [
        { dateKey: "2026-10-10", inventoryItemId: "copa", eventId: "e1", quantity: 12, status: "RESERVED" },
        { dateKey: "2026-10-10", inventoryItemId: "copa", eventId: "e2", quantity: 12, status: "RESERVED" },
        { dateKey: "2026-10-10", inventoryItemId: "plato", eventId: "e1", quantity: 20, status: "RESERVED" },
        { dateKey: "2026-10-11", inventoryItemId: "copa", eventId: "e3", quantity: 30, status: "CANCELLED" },
      ],
      stock,
    );
    expect(conflicts).toEqual([
      {
        dateKey: "2026-10-10",
        inventoryItemId: "copa",
        required: 24,
        available: 22,
        shortBy: 2,
        events: [
          { eventId: "e1", quantity: 12 },
          { eventId: "e2", quantity: 12 },
        ],
      },
    ]);
  });
});

describe("stock adjustments", () => {
  const item = { totalQuantity: 10, maintenanceQuantity: 2 };

  it("aplica entradas, bajas, ajustes y mantenimiento", () => {
    expect(applyStockAdjustment(item, { type: "PURCHASE_IN", quantity: 5 })).toEqual({ totalQuantity: 15, maintenanceQuantity: 2 });
    expect(applyStockAdjustment(item, { type: "LOSS", quantity: 3 })).toEqual({ totalQuantity: 7, maintenanceQuantity: 2 });
    expect(applyStockAdjustment(item, { type: "ADJUSTMENT", quantity: 2, direction: 1 })).toEqual({
      totalQuantity: 12,
      maintenanceQuantity: 2,
    });
    expect(applyStockAdjustment(item, { type: "ADJUSTMENT", quantity: 2, direction: -1 })).toEqual({
      totalQuantity: 8,
      maintenanceQuantity: 2,
    });
    expect(applyStockAdjustment(item, { type: "MAINTENANCE_OUT", quantity: 3 })).toEqual({
      totalQuantity: 10,
      maintenanceQuantity: 5,
    });
    expect(applyStockAdjustment(item, { type: "MAINTENANCE_IN", quantity: 2 })).toEqual({
      totalQuantity: 10,
      maintenanceQuantity: 0,
    });
  });

  it("nunca deja cantidades negativas ni mantenimiento mayor al total", () => {
    expect(() => applyStockAdjustment(item, { type: "LOSS", quantity: 9 })).toThrow(StockAdjustmentError);
    expect(() => applyStockAdjustment(item, { type: "ADJUSTMENT", quantity: 11, direction: -1 })).toThrow(StockAdjustmentError);
    expect(() => applyStockAdjustment(item, { type: "MAINTENANCE_OUT", quantity: 9 })).toThrow(StockAdjustmentError);
    expect(() => applyStockAdjustment(item, { type: "MAINTENANCE_IN", quantity: 3 })).toThrow(StockAdjustmentError);
    expect(() => applyStockAdjustment(item, { type: "PURCHASE_IN", quantity: 0 })).toThrow(StockAdjustmentError);
    expect(() => applyStockAdjustment(item, { type: "PURCHASE_IN", quantity: -4 })).toThrow(StockAdjustmentError);
  });

  it("registra la cantidad con signo sólo en ajustes", () => {
    expect(signedMovementQuantity({ type: "ADJUSTMENT", quantity: 3, direction: -1 })).toBe(-3);
    expect(signedMovementQuantity({ type: "ADJUSTMENT", quantity: 3 })).toBe(3);
    expect(signedMovementQuantity({ type: "LOSS", quantity: 3 })).toBe(3);
  });

  it("las bajas por regreso nunca dejan negativos", () => {
    expect(applyReturnLoss({ totalQuantity: 10, maintenanceQuantity: 2 }, 1)).toEqual({ totalQuantity: 9, maintenanceQuantity: 2 });
    expect(applyReturnLoss({ totalQuantity: 2, maintenanceQuantity: 2 }, 5)).toEqual({ totalQuantity: 0, maintenanceQuantity: 0 });
  });
});

describe("reservation lifecycle", () => {
  it("sigue reservado → en evento → devuelto", () => {
    expect(reservationStatusMachine.can("RESERVED", "CHECKED_OUT")).toBe(true);
    expect(reservationStatusMachine.can("CHECKED_OUT", "RETURNED")).toBe(true);
    expect(reservationStatusMachine.can("RESERVED", "RETURNED")).toBe(false);
    expect(reservationStatusMachine.can("CHECKED_OUT", "CANCELLED")).toBe(false);
    expect(() => reservationStatusMachine.assert("RETURNED", "RESERVED")).toThrow(InvalidTransitionError);
  });

  it("valida que devueltas + dañadas sumen lo que salió", () => {
    expect(validateReturn({ quantity: 10, returnedQuantity: 9, damagedQuantity: 1 })).toBeNull();
    expect(validateReturn({ quantity: 10, returnedQuantity: 9, damagedQuantity: 0 })).toMatch(/deben sumar/);
    expect(validateReturn({ quantity: 10, returnedQuantity: -1, damagedQuantity: 11 })).toMatch(/negativas/);
  });
});
