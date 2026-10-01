import { createStateMachine } from "@/lib/state-machine";
import type { ReservationStatusValue } from "./availability";

/**
 * Ciclo de vida de una reserva de inventario:
 *   RESERVED → CHECKED_OUT (salida a evento) → RETURNED (regreso, con daños/pérdidas)
 *   RESERVED → CANCELLED (liberación) → RESERVED (reactivar)
 */
export const reservationStatusMachine = createStateMachine<ReservationStatusValue>("InventoryReservation", {
  RESERVED: ["CHECKED_OUT", "CANCELLED"],
  CHECKED_OUT: ["RETURNED"],
  RETURNED: [],
  CANCELLED: ["RESERVED"],
});

export type ReturnInput = { quantity: number; returnedQuantity: number; damagedQuantity: number };

/** Valida un regreso: piezas en buen estado + dañadas/perdidas = piezas que salieron. */
export function validateReturn({ quantity, returnedQuantity, damagedQuantity }: ReturnInput): string | null {
  if (!Number.isInteger(returnedQuantity) || returnedQuantity < 0) return "Las piezas devueltas no pueden ser negativas.";
  if (!Number.isInteger(damagedQuantity) || damagedQuantity < 0) return "Las piezas dañadas no pueden ser negativas.";
  if (returnedQuantity + damagedQuantity !== quantity) {
    return `Devueltas (${returnedQuantity}) + dañadas o perdidas (${damagedQuantity}) deben sumar las ${quantity} piezas que salieron.`;
  }
  return null;
}
