import type { InventoryMovementType, InventoryReservationStatus } from "@prisma/client";
import type { Tone } from "@/lib/labels";

export const RESERVATION_STATUS_TONES: Record<InventoryReservationStatus, Tone> = {
  RESERVED: "info",
  CHECKED_OUT: "brand",
  RETURNED: "success",
  CANCELLED: "muted",
};

export const MOVEMENT_TONES: Record<InventoryMovementType, Tone> = {
  PURCHASE_IN: "success",
  RESERVE: "info",
  RELEASE: "muted",
  CHECK_OUT: "brand",
  RETURN: "success",
  MAINTENANCE_OUT: "warning",
  MAINTENANCE_IN: "neutral",
  LOSS: "danger",
  ADJUSTMENT: "neutral",
};

/** Cómo se muestra la cantidad de un movimiento (signo respecto al stock físico). */
export function movementQuantityLabel(type: InventoryMovementType, quantity: number): string {
  switch (type) {
    case "PURCHASE_IN":
    case "RETURN":
    case "MAINTENANCE_IN":
      return `+${quantity}`;
    case "LOSS":
    case "CHECK_OUT":
    case "MAINTENANCE_OUT":
      return `−${quantity}`;
    case "ADJUSTMENT":
      return quantity >= 0 ? `+${quantity}` : `−${Math.abs(quantity)}`;
    case "RESERVE":
    case "RELEASE":
      return String(quantity);
  }
}
