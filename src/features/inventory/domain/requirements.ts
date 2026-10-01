/**
 * Requerimientos de inventario de un evento (lógica pura, sin I/O).
 *
 * - Requerimiento de la experiencia: perGuest → cantidad × invitadas; fijo → cantidad.
 * - Requerimiento de add-on: perGuest → cantidad × invitadas; fijo → cantidad × cantidad del add-on.
 */
export type ExperienceRequirement = {
  inventoryItemId: string;
  quantity: number;
  perGuest: boolean;
};

export type AddOnRequirement = {
  inventoryItemId: string;
  quantity: number;
  perGuest: boolean;
  /** Cantidad contratada del add-on en el evento (EventAddOn.quantity). */
  addOnQuantity: number;
};

export type RequirementsInput = {
  guestCount: number;
  experienceReqs: ExperienceRequirement[];
  addOnReqs: AddOnRequirement[];
};

function safeInt(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Devuelve un mapa itemId → piezas requeridas (sólo cantidades > 0). */
export function requirementsForEvent(input: RequirementsInput): Map<string, number> {
  const guests = safeInt(input.guestCount);
  const totals = new Map<string, number>();
  const add = (itemId: string, qty: number) => {
    if (qty <= 0) return;
    totals.set(itemId, (totals.get(itemId) ?? 0) + qty);
  };
  for (const r of input.experienceReqs) {
    const base = safeInt(r.quantity);
    add(r.inventoryItemId, r.perGuest ? base * guests : base);
  }
  for (const r of input.addOnReqs) {
    const base = safeInt(r.quantity);
    add(r.inventoryItemId, r.perGuest ? base * guests : base * safeInt(r.addOnQuantity));
  }
  return totals;
}

export type ReservationDeltaInput = {
  /** Cantidad requerida (0 = ya no se requiere). */
  required: number;
  /** Reserva existente (si la hay). */
  existing: { quantity: number; status: "RESERVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED" } | null;
};

export type ReservationPlan =
  | { kind: "noop" }
  | { kind: "create"; quantity: number }
  | { kind: "update"; quantity: number; delta: number }
  | { kind: "reactivate"; quantity: number }
  | { kind: "release"; quantity: number };

/**
 * Decide qué hacer con la reserva de un artículo al recalcular desde requerimientos.
 * Reservas ya entregadas o devueltas (CHECKED_OUT / RETURNED) no se tocan: son operación física en curso o cerrada.
 */
export function planReservation({ required, existing }: ReservationDeltaInput): ReservationPlan {
  const req = safeInt(required);
  if (!existing) return req > 0 ? { kind: "create", quantity: req } : { kind: "noop" };
  switch (existing.status) {
    case "CHECKED_OUT":
    case "RETURNED":
      return { kind: "noop" };
    case "CANCELLED":
      return req > 0 ? { kind: "reactivate", quantity: req } : { kind: "noop" };
    case "RESERVED": {
      if (req === 0) return { kind: "release", quantity: existing.quantity };
      if (req === existing.quantity) return { kind: "noop" };
      return { kind: "update", quantity: req, delta: req - existing.quantity };
    }
  }
}
