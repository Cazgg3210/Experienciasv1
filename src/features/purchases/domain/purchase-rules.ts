/**
 * Reglas puras de compras: transiciones con efectos (fechas, monto real) y totales.
 * La máquina de estados vive en ./purchase-status.ts (fuente única).
 */
import { purchaseStatusMachine, type PurchaseStatus } from "./purchase-status";

export type PurchaseLike = {
  status: PurchaseStatus;
  expectedAmountCents: number;
  actualAmountCents: number | null;
};

export type PurchaseTotals = {
  count: number;
  /** Esperado de compras no canceladas */
  expectedCents: number;
  /** Real de compras recibidas */
  actualCents: number;
  /** Esperado de las compras ya recibidas (para comparar contra el real) */
  receivedExpectedCents: number;
  /** Real − esperado de las recibidas (positivo = gastamos de más) */
  varianceCents: number;
  /** Esperado de compras aún no recibidas (solicitadas u ordenadas) */
  pendingCents: number;
  byStatus: Record<PurchaseStatus, number>;
};

export function summarizePurchases(purchases: PurchaseLike[]): PurchaseTotals {
  const totals: PurchaseTotals = {
    count: purchases.length,
    expectedCents: 0,
    actualCents: 0,
    receivedExpectedCents: 0,
    varianceCents: 0,
    pendingCents: 0,
    byStatus: { REQUESTED: 0, ORDERED: 0, RECEIVED: 0, CANCELLED: 0 },
  };
  for (const p of purchases) {
    totals.byStatus[p.status] += 1;
    if (p.status === "CANCELLED") continue;
    totals.expectedCents += p.expectedAmountCents;
    if (p.status === "RECEIVED") {
      const actual = p.actualAmountCents ?? p.expectedAmountCents;
      totals.actualCents += actual;
      totals.receivedExpectedCents += p.expectedAmountCents;
      totals.varianceCents += actual - p.expectedAmountCents;
    } else {
      totals.pendingCents += p.expectedAmountCents;
    }
  }
  return totals;
}

/** Variación de una compra recibida (real − esperado) o null si aún no se recibe. */
export function purchaseVariance(p: PurchaseLike): number | null {
  if (p.status !== "RECEIVED" || p.actualAmountCents == null) return null;
  return p.actualAmountCents - p.expectedAmountCents;
}

export class PurchaseRuleError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "PurchaseRuleError";
  }
}

export type TransitionInput = {
  to: PurchaseStatus;
  actualAmountCents?: number | null;
  reason?: string | null;
  now?: Date;
};

export type TransitionPatch = {
  status: PurchaseStatus;
  orderedAt?: Date | null;
  receivedAt?: Date | null;
  cancelledAt?: Date | null;
  actualAmountCents?: number | null;
};

/**
 * Calcula los cambios de una transición de estado validando las reglas:
 *  - REQUESTED→ORDERED: orderedAt
 *  - →RECEIVED: requiere monto real (≥ 0); receivedAt (y orderedAt si no existía)
 *  - →CANCELLED: cancelledAt; requiere motivo
 *  - →REQUESTED (reabrir): limpia fechas de orden/cancelación
 */
export function planPurchaseTransition(
  current: { status: PurchaseStatus; orderedAt: Date | null },
  input: TransitionInput,
): TransitionPatch {
  const now = input.now ?? new Date();
  if (!purchaseStatusMachine.can(current.status, input.to)) {
    throw new PurchaseRuleError(
      current.status === input.to
        ? "La compra ya está en ese estado."
        : current.status === "RECEIVED"
          ? "Una compra recibida ya no puede cambiar de estado."
          : "Ese cambio de estado no está permitido para esta compra.",
    );
  }
  switch (input.to) {
    case "ORDERED":
      return { status: "ORDERED", orderedAt: now };
    case "RECEIVED": {
      const amount = input.actualAmountCents;
      if (amount == null || !Number.isInteger(amount) || amount < 0) {
        throw new PurchaseRuleError("Para marcarla como recibida necesitamos el monto real pagado.", "actualAmountCents");
      }
      return { status: "RECEIVED", receivedAt: now, orderedAt: current.orderedAt ?? now, actualAmountCents: amount };
    }
    case "CANCELLED": {
      if (!input.reason || input.reason.trim().length < 3) {
        throw new PurchaseRuleError("Cuéntanos el motivo de la cancelación.", "reason");
      }
      return { status: "CANCELLED", cancelledAt: now };
    }
    case "REQUESTED":
      return { status: "REQUESTED", orderedAt: null, cancelledAt: null };
  }
}

/** Agrega el motivo de cancelación a las notas existentes. */
export function appendCancellationNote(notes: string | null, reason: string, when: string): string {
  const line = `Cancelada (${when}): ${reason.trim()}`;
  return notes?.trim() ? `${notes.trim()}\n${line}` : line;
}

/** Categoría de costo sugerida según la categoría del proveedor. */
export function defaultCostCategoryForVendor(
  vendorCategory: "FLOWERS" | "FOOD" | "PASTRY" | "TRANSPORT" | "FURNITURE" | "PHOTO" | "BEVERAGES" | "OTHER" | null | undefined,
): "FLOWERS" | "FOOD" | "TRANSPORT" | "VENDOR" {
  switch (vendorCategory) {
    case "FLOWERS":
      return "FLOWERS";
    case "FOOD":
    case "BEVERAGES":
      return "FOOD";
    case "TRANSPORT":
      return "TRANSPORT";
    default:
      return "VENDOR";
  }
}
