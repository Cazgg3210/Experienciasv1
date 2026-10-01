import "server-only";

export type InventoryShortage = {
  inventoryItemId: string;
  sku: string;
  name: string;
  required: number;
  available: number;
  shortBy: number;
};

/**
 * STUB — lo implementa el módulo Inventario.
 * Contrato: calcula requerimientos del evento (experiencia + add-ons, perGuest × guestCount),
 * crea/actualiza InventoryReservation (idempotente, @@unique item+evento), registra movimientos
 * RESERVE y devuelve faltantes considerando otras reservas del mismo día.
 */
export async function reserveInventoryForEvent(
  _eventId: string,
): Promise<{ reserved: number; shortages: InventoryShortage[] }> {
  return { reserved: 0, shortages: [] };
}
