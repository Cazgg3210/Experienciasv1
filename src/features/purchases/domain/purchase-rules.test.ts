import { describe, expect, it } from "vitest";
import {
  PurchaseRuleError,
  appendCancellationNote,
  defaultCostCategoryForVendor,
  planPurchaseTransition,
  purchaseVariance,
  summarizePurchases,
} from "./purchase-rules";

const now = new Date("2026-10-01T15:00:00Z");

describe("planPurchaseTransition", () => {
  it("REQUESTED → ORDERED fija orderedAt", () => {
    expect(planPurchaseTransition({ status: "REQUESTED", orderedAt: null }, { to: "ORDERED", now })).toEqual({
      status: "ORDERED",
      orderedAt: now,
    });
  });

  it("→ RECEIVED exige monto real y fija fechas", () => {
    expect(() => planPurchaseTransition({ status: "ORDERED", orderedAt: now }, { to: "RECEIVED", now })).toThrow(
      PurchaseRuleError,
    );
    expect(() =>
      planPurchaseTransition({ status: "ORDERED", orderedAt: now }, { to: "RECEIVED", actualAmountCents: -5, now }),
    ).toThrow(/monto real/);
    const ordered = new Date("2026-09-20T10:00:00Z");
    expect(
      planPurchaseTransition({ status: "ORDERED", orderedAt: ordered }, { to: "RECEIVED", actualAmountCents: 120_000, now }),
    ).toEqual({ status: "RECEIVED", receivedAt: now, orderedAt: ordered, actualAmountCents: 120_000 });
    expect(
      planPurchaseTransition({ status: "REQUESTED", orderedAt: null }, { to: "RECEIVED", actualAmountCents: 0, now }),
    ).toMatchObject({ orderedAt: now, actualAmountCents: 0 });
  });

  it("→ CANCELLED exige motivo", () => {
    expect(() => planPurchaseTransition({ status: "ORDERED", orderedAt: now }, { to: "CANCELLED", now })).toThrow(/motivo/);
    expect(
      planPurchaseTransition({ status: "ORDERED", orderedAt: now }, { to: "CANCELLED", reason: "Ya no se requiere", now }),
    ).toEqual({ status: "CANCELLED", cancelledAt: now });
  });

  it("reabrir limpia fechas", () => {
    expect(planPurchaseTransition({ status: "CANCELLED", orderedAt: now }, { to: "REQUESTED", now })).toEqual({
      status: "REQUESTED",
      orderedAt: null,
      cancelledAt: null,
    });
  });

  it("rechaza transiciones inválidas", () => {
    expect(() => planPurchaseTransition({ status: "RECEIVED", orderedAt: now }, { to: "CANCELLED", reason: "x y z" })).toThrow(
      /recibida/,
    );
    expect(() => planPurchaseTransition({ status: "CANCELLED", orderedAt: null }, { to: "ORDERED" })).toThrow(
      PurchaseRuleError,
    );
    expect(() => planPurchaseTransition({ status: "ORDERED", orderedAt: null }, { to: "ORDERED" })).toThrow(/ya está/);
  });
});

describe("summarizePurchases", () => {
  it("suma esperado vs real y variación", () => {
    const totals = summarizePurchases([
      { status: "RECEIVED", expectedAmountCents: 180_000, actualAmountCents: 205_000 },
      { status: "RECEIVED", expectedAmountCents: 260_000, actualAmountCents: 248_000 },
      { status: "ORDERED", expectedAmountCents: 100_000, actualAmountCents: null },
      { status: "REQUESTED", expectedAmountCents: 50_000, actualAmountCents: null },
      { status: "CANCELLED", expectedAmountCents: 999_999, actualAmountCents: null },
    ]);
    expect(totals.count).toBe(5);
    expect(totals.expectedCents).toBe(590_000);
    expect(totals.actualCents).toBe(453_000);
    expect(totals.receivedExpectedCents).toBe(440_000);
    expect(totals.varianceCents).toBe(13_000);
    expect(totals.pendingCents).toBe(150_000);
    expect(totals.byStatus).toEqual({ REQUESTED: 1, ORDERED: 1, RECEIVED: 2, CANCELLED: 1 });
  });

  it("variación por compra", () => {
    expect(purchaseVariance({ status: "RECEIVED", expectedAmountCents: 100, actualAmountCents: 80 })).toBe(-20);
    expect(purchaseVariance({ status: "ORDERED", expectedAmountCents: 100, actualAmountCents: null })).toBeNull();
  });

  it("agrega el motivo de cancelación a las notas", () => {
    expect(appendCancellationNote(null, " ya no ", "1 oct 2026")).toBe("Cancelada (1 oct 2026): ya no");
    expect(appendCancellationNote("Nota previa", "cambio", "1 oct 2026")).toBe("Nota previa\nCancelada (1 oct 2026): cambio");
  });
});

describe("defaultCostCategoryForVendor", () => {
  it("sugiere la categoría de costo", () => {
    expect(defaultCostCategoryForVendor("FLOWERS")).toBe("FLOWERS");
    expect(defaultCostCategoryForVendor("BEVERAGES")).toBe("FOOD");
    expect(defaultCostCategoryForVendor("TRANSPORT")).toBe("TRANSPORT");
    expect(defaultCostCategoryForVendor("PASTRY")).toBe("VENDOR");
    expect(defaultCostCategoryForVendor(null)).toBe("VENDOR");
  });
});
