/**
 * Ajustes de stock (lógica pura). Mantiene la consistencia:
 *   0 ≤ maintenanceQuantity ≤ totalQuantity
 * y nunca deja cantidades negativas.
 */
import type { StockLike } from "./availability";

export const STOCK_ADJUSTMENT_TYPES = [
  "PURCHASE_IN",
  "LOSS",
  "ADJUSTMENT",
  "MAINTENANCE_OUT",
  "MAINTENANCE_IN",
] as const;

export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];

export type StockAdjustment = {
  type: StockAdjustmentType;
  /** Siempre positiva. */
  quantity: number;
  /** Sólo para ADJUSTMENT: +1 suma piezas, −1 resta piezas. */
  direction?: 1 | -1;
};

export class StockAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockAdjustmentError";
  }
}

/** Cantidad con signo que se registra en el movimiento (positiva = entra al total). */
export function signedMovementQuantity(adj: StockAdjustment): number {
  const q = Math.abs(Math.trunc(adj.quantity));
  switch (adj.type) {
    case "PURCHASE_IN":
    case "MAINTENANCE_OUT":
    case "MAINTENANCE_IN":
    case "LOSS":
      return q;
    case "ADJUSTMENT":
      return (adj.direction ?? 1) * q;
  }
}

/** Calcula el nuevo stock o lanza StockAdjustmentError con un mensaje en español. */
export function applyStockAdjustment(item: StockLike, adj: StockAdjustment): StockLike {
  const q = Math.trunc(adj.quantity);
  if (!Number.isFinite(q) || q <= 0) throw new StockAdjustmentError("La cantidad debe ser mayor a cero.");
  let total = item.totalQuantity;
  let maintenance = item.maintenanceQuantity;
  switch (adj.type) {
    case "PURCHASE_IN":
      total += q;
      break;
    case "LOSS":
      if (q > total - maintenance) {
        throw new StockAdjustmentError(
          `Sólo hay ${Math.max(0, total - maintenance)} piezas fuera de mantenimiento; no puedes dar de baja ${q}.`,
        );
      }
      total -= q;
      break;
    case "ADJUSTMENT":
      if ((adj.direction ?? 1) === 1) {
        total += q;
      } else {
        if (q > total - maintenance) {
          throw new StockAdjustmentError(
            `El ajuste dejaría el inventario por debajo de las piezas en mantenimiento (${maintenance}).`,
          );
        }
        total -= q;
      }
      break;
    case "MAINTENANCE_OUT":
      if (q > total - maintenance) {
        throw new StockAdjustmentError(`Sólo hay ${Math.max(0, total - maintenance)} piezas disponibles para enviar a mantenimiento.`);
      }
      maintenance += q;
      break;
    case "MAINTENANCE_IN":
      if (q > maintenance) {
        throw new StockAdjustmentError(`Sólo hay ${maintenance} piezas en mantenimiento.`);
      }
      maintenance -= q;
      break;
  }
  if (total < 0 || maintenance < 0 || maintenance > total) {
    throw new StockAdjustmentError("El ajuste dejaría cantidades inválidas.");
  }
  return { totalQuantity: total, maintenanceQuantity: maintenance };
}

/**
 * Aplica una baja por daño/pérdida al regresar de un evento: reduce el total y, si fuera
 * necesario, acota el mantenimiento para que nunca supere el total.
 */
export function applyReturnLoss(item: StockLike, damaged: number): StockLike {
  const d = Math.max(0, Math.trunc(damaged));
  const total = Math.max(0, item.totalQuantity - d);
  return { totalQuantity: total, maintenanceQuantity: Math.min(item.maintenanceQuantity, total) };
}
