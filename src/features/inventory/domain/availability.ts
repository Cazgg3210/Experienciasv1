/**
 * Disponibilidad de inventario por fecha (lógica pura).
 * Disponible = total − mantenimiento − reservado por OTROS eventos no cancelados el mismo día
 * (reservas RESERVED o CHECKED_OUT).
 */
export type ReservationStatusValue = "RESERVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED";

/** Estados de reserva que ocupan inventario. */
export const ACTIVE_RESERVATION_STATUSES = ["RESERVED", "CHECKED_OUT"] as const satisfies readonly ReservationStatusValue[];

export type StockLike = { totalQuantity: number; maintenanceQuantity: number };

export type ReservationLike = {
  quantity: number;
  status: ReservationStatusValue;
  /** Estado del evento; si es CANCELLED la reserva no ocupa inventario. */
  eventStatus?: string | null;
};

export function isActiveReservation(r: ReservationLike): boolean {
  if (r.eventStatus === "CANCELLED") return false;
  return r.status === "RESERVED" || r.status === "CHECKED_OUT";
}

/** Piezas utilizables (sin las que están en mantenimiento). Nunca negativo. */
export function usableQuantity(item: StockLike): number {
  return Math.max(0, item.totalQuantity - item.maintenanceQuantity);
}

/** Suma de piezas comprometidas por reservas activas. */
export function reservedQuantity(reservations: ReservationLike[]): number {
  return reservations.reduce((sum, r) => (isActiveReservation(r) ? sum + Math.max(0, r.quantity) : sum), 0);
}

/**
 * Disponible para un evento en una fecha = total − mantenimiento − reservado por otros eventos ese día.
 * Se acota en 0 (si otros eventos ya sobre-reservaron, no hay nada disponible).
 */
export function availableOn(item: StockLike, otherReservationsSameDate: ReservationLike[]): number {
  return Math.max(0, usableQuantity(item) - reservedQuantity(otherReservationsSameDate));
}

/** Indica si el stock utilizable está en o por debajo del umbral bajo configurado. */
export function isLowStock(item: StockLike & { lowStockThreshold: number }): boolean {
  if (item.lowStockThreshold <= 0) return false;
  return usableQuantity(item) <= item.lowStockThreshold;
}

export type Shortage = {
  inventoryItemId: string;
  required: number;
  available: number;
  shortBy: number;
};

/** Faltantes: artículos cuyo requerimiento supera lo disponible. */
export function shortages(required: Map<string, number>, available: Map<string, number>): Shortage[] {
  const out: Shortage[] = [];
  for (const [inventoryItemId, req] of required) {
    if (req <= 0) continue;
    const avail = Math.max(0, available.get(inventoryItemId) ?? 0);
    if (req > avail) out.push({ inventoryItemId, required: req, available: avail, shortBy: req - avail });
  }
  return out.sort((a, b) => b.shortBy - a.shortBy);
}

/**
 * Máximo reservado en un mismo día dentro de una ventana: agrupa por fecha y toma el pico.
 * Útil para la columna "reservado (próximos 30 días)" del inventario.
 */
export function maxReservedByDate(rows: Array<ReservationLike & { dateKey: string }>): { max: number; dateKey: string | null } {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!isActiveReservation(r)) continue;
    byDate.set(r.dateKey, (byDate.get(r.dateKey) ?? 0) + Math.max(0, r.quantity));
  }
  let max = 0;
  let dateKey: string | null = null;
  for (const [key, qty] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (qty > max) {
      max = qty;
      dateKey = key;
    }
  }
  return { max, dateKey };
}

/**
 * Disponible HOY: total − mantenimiento − reservas activas de eventos de hoy − piezas que siguen
 * fuera (CHECKED_OUT de otras fechas, aún no devueltas).
 */
export function availableToday(
  item: StockLike,
  rows: Array<ReservationLike & { dateKey: string }>,
  todayKey: string,
): number {
  const committed = rows.reduce((sum, r) => {
    if (!isActiveReservation(r)) return sum;
    if (r.dateKey === todayKey || r.status === "CHECKED_OUT") return sum + Math.max(0, r.quantity);
    return sum;
  }, 0);
  return Math.max(0, usableQuantity(item) - committed);
}

export type ConflictEventRef = { eventId: string; quantity: number };

export type DateItemConflict = {
  dateKey: string;
  inventoryItemId: string;
  required: number;
  available: number;
  shortBy: number;
  events: ConflictEventRef[];
};

/**
 * Detecta conflictos por fecha y artículo: la suma de reservas activas de todos los eventos
 * de ese día supera el stock utilizable.
 */
export function detectConflicts(
  rows: Array<ReservationLike & { dateKey: string; inventoryItemId: string; eventId: string }>,
  stock: Map<string, StockLike>,
): DateItemConflict[] {
  const groups = new Map<string, { dateKey: string; inventoryItemId: string; events: ConflictEventRef[] }>();
  for (const r of rows) {
    if (!isActiveReservation(r) || r.quantity <= 0) continue;
    const key = `${r.dateKey}|${r.inventoryItemId}`;
    const g = groups.get(key) ?? { dateKey: r.dateKey, inventoryItemId: r.inventoryItemId, events: [] };
    const existing = g.events.find((e) => e.eventId === r.eventId);
    if (existing) existing.quantity += r.quantity;
    else g.events.push({ eventId: r.eventId, quantity: r.quantity });
    groups.set(key, g);
  }
  const out: DateItemConflict[] = [];
  for (const g of groups.values()) {
    const item = stock.get(g.inventoryItemId);
    if (!item) continue;
    const required = g.events.reduce((s, e) => s + e.quantity, 0);
    const available = usableQuantity(item);
    if (required > available) {
      out.push({ ...g, required, available, shortBy: required - available });
    }
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || b.shortBy - a.shortBy);
}
