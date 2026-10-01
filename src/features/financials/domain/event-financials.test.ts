import { describe, expect, it } from "vitest";
import {
  buildClosingSnapshot,
  computeCollection,
  computeEventFinancials,
  computePaymentFeesCents,
  computeRefundsCents,
  estimatedBreakdownFromQuote,
  estimatePaymentFee,
  marginBpsOrNull,
  readClosingSnapshot,
  taxIncludedIn,
  weightedMarginBps,
  type EventFinancialsInput,
  type FinPayment,
} from "./event-financials";

const paid = (amountCents: number, feeCents = 0, extra: Partial<FinPayment> = {}): FinPayment => ({
  kind: "DEPOSIT",
  status: "PAID",
  amountCents,
  feeCents,
  refundedCents: 0,
  ...extra,
});

function baseInput(overrides: Partial<EventFinancialsInput> = {}): EventFinancialsInput {
  return {
    salesTotalCents: 11_600_00,
    taxCents: 1_600_00,
    estimated: {
      costBreakdown: { FOOD: 3_000_00, FLOWERS: 1_000_00, STAFF: 1_500_00, PAYMENT_FEE: 500_00 },
    },
    actual: { purchases: [], staffAssignments: [], manualCosts: [], payments: [] },
    ...overrides,
  };
}

describe("computeEventFinancials — ingresos", () => {
  it("calcula ingreso neto sin IVA y margen estimado", () => {
    const fin = computeEventFinancials(baseInput());
    expect(fin.sale).toBe(11_600_00);
    expect(fin.tax).toBe(1_600_00);
    expect(fin.plannedNetRevenue).toBe(10_000_00);
    expect(fin.netRevenue).toBe(10_000_00);
    expect(fin.estimatedCost).toBe(6_000_00);
    expect(fin.estimatedMargin).toBe(4_000_00);
    expect(fin.estimatedMarginBps).toBe(4000);
  });

  it("sin costos reales: costo real 0, margen real = ingreso neto y advertencia NO_ACTUALS", () => {
    const fin = computeEventFinancials(baseInput());
    expect(fin.anyActuals).toBe(false);
    expect(fin.actualCost).toBe(0);
    expect(fin.actualMargin).toBe(10_000_00);
    expect(fin.byCategory.every((r) => r.variance === null && !r.hasActuals)).toBe(true);
    expect(fin.warnings.map((w) => w.code)).toContain("NO_ACTUALS");
  });

  it("los reembolsos reducen la venta y el IVA proporcionalmente", () => {
    const fin = computeEventFinancials(
      baseInput({
        actual: {
          purchases: [],
          staffAssignments: [],
          manualCosts: [],
          payments: [paid(11_600_00, 0, { kind: "FULL", status: "PARTIAL_REFUND", refundedCents: 1_160_00 })],
        },
      }),
    );
    expect(fin.refunds).toBe(1_160_00);
    // 10,440 con IVA → IVA 1,440 → neto 9,000
    expect(fin.tax).toBe(1_440_00);
    expect(fin.netRevenue).toBe(9_000_00);
    // el margen estimado sigue sobre el ingreso planeado
    expect(fin.plannedNetRevenue).toBe(10_000_00);
    expect(fin.warnings.map((w) => w.code)).toContain("REFUNDS_APPLIED");
  });

  it("reembolso nunca excede la venta", () => {
    const fin = computeEventFinancials(
      baseInput({
        salesTotalCents: 1_000_00,
        taxCents: 137_93,
        actual: {
          purchases: [],
          staffAssignments: [],
          manualCosts: [],
          payments: [
            { kind: "REFUND", status: "PAID", amountCents: 5_000_00, feeCents: 0, refundedCents: 0 },
          ],
        },
      }),
    );
    expect(fin.refunds).toBe(1_000_00);
    expect(fin.netRevenue).toBe(0);
    expect(fin.actualMarginBps).toBeNull();
  });

  it("sin venta: advierte NO_SALE y bps indefinido (null)", () => {
    const fin = computeEventFinancials(baseInput({ salesTotalCents: 0, taxCents: 0 }));
    expect(fin.warnings.map((w) => w.code)).toContain("NO_SALE");
    expect(fin.estimatedMarginBps).toBeNull();
    expect(fin.estimatedMargin).toBe(-6_000_00);
  });

  it("evento cancelado: sin costo estimado, pero los costos hundidos sí cuentan", () => {
    const fin = computeEventFinancials(
      baseInput({
        cancelled: true,
        // Venta = anticipo cobrado ($5,800 con IVA)
        salesTotalCents: 5_800_00,
        taxCents: 800_00,
        actual: {
          purchases: [
            {
              category: "FLOWERS",
              status: "RECEIVED",
              expectedAmountCents: 900_00,
              actualAmountCents: 950_00,
            },
          ],
          staffAssignments: [],
          manualCosts: [],
          payments: [paid(5_800_00, 200_00)],
        },
      }),
    );
    expect(fin.estimatedCost).toBe(0);
    expect(fin.byCategory.every((r) => r.estimated === 0)).toBe(true);
    expect(fin.estimatedMargin).toBe(5_000_00);
    expect(fin.actualCost).toBe(950_00 + 200_00);
    expect(fin.actualMargin).toBe(5_000_00 - 1_150_00);
    const codes = fin.warnings.map((w) => w.code);
    expect(codes).toContain("CANCELLED_EVENT");
    expect(codes).not.toContain("NO_ESTIMATE");
    expect(codes).not.toContain("MISSING_ACTUALS");
    expect(codes).not.toContain("COST_OVERRUN");
  });
});

describe("computeEventFinancials — costos reales", () => {
  it("sólo cuenta compras RECIBIDAS (monto real) y reporta pendientes", () => {
    const fin = computeEventFinancials(
      baseInput({
        actual: {
          purchases: [
            {
              category: "FOOD",
              status: "RECEIVED",
              expectedAmountCents: 3_000_00,
              actualAmountCents: 3_200_00,
            },
            {
              category: "FLOWERS",
              status: "ORDERED",
              expectedAmountCents: 1_000_00,
              actualAmountCents: null,
            },
            {
              category: "FLOWERS",
              status: "CANCELLED",
              expectedAmountCents: 900_00,
              actualAmountCents: 900_00,
            },
            {
              category: "CONSUMABLES",
              status: "REQUESTED",
              expectedAmountCents: 200_00,
              actualAmountCents: null,
            },
          ],
          staffAssignments: [],
          manualCosts: [],
          payments: [],
        },
      }),
    );
    expect(fin.sources.purchasesCents).toBe(3_200_00);
    expect(fin.sources.pendingPurchases).toBe(2);
    const food = fin.byCategory.find((r) => r.category === "FOOD")!;
    expect(food).toMatchObject({ estimated: 3_000_00, actual: 3_200_00, variance: 200_00, hasActuals: true });
    const flowers = fin.byCategory.find((r) => r.category === "FLOWERS")!;
    expect(flowers).toMatchObject({ actual: 0, variance: null, hasActuals: false });
    const codes = fin.warnings.map((w) => w.code);
    expect(codes).toContain("PURCHASES_PENDING");
    expect(codes).toContain("MISSING_ACTUALS");
  });

  it("compra recibida sin monto real usa el esperado y lo advierte", () => {
    const fin = computeEventFinancials(
      baseInput({
        actual: {
          purchases: [
            { category: "FOOD", status: "RECEIVED", expectedAmountCents: 2_500_00, actualAmountCents: null },
          ],
          staffAssignments: [],
          manualCosts: [],
          payments: [],
        },
      }),
    );
    expect(fin.actualCost).toBe(2_500_00);
    expect(fin.warnings.map((w) => w.code)).toContain("RECEIVED_WITHOUT_AMOUNT");
  });

  it("suma staff, costos manuales por categoría y comisiones de pagos cobrados", () => {
    const fin = computeEventFinancials(
      baseInput({
        actual: {
          purchases: [],
          staffAssignments: [{ amountCents: 900_00 }, { amountCents: 700_00 }],
          manualCosts: [
            { category: "TRANSPORT", amountCents: 350_00 },
            { category: "STAFF", amountCents: 100_00 },
          ],
          payments: [
            paid(5_800_00, 210_00),
            paid(5_800_00, 0, { kind: "BALANCE", status: "PENDING" }),
            paid(5_800_00, 999_00, { kind: "BALANCE", status: "FAILED" }),
          ],
        },
      }),
    );
    expect(fin.sources.staffCents).toBe(1_600_00);
    expect(fin.sources.manualCents).toBe(450_00);
    expect(fin.sources.paymentFeesCents).toBe(210_00);
    const staff = fin.byCategory.find((r) => r.category === "STAFF")!;
    expect(staff.actual).toBe(1_700_00);
    expect(staff.variance).toBe(200_00);
    const transport = fin.byCategory.find((r) => r.category === "TRANSPORT")!;
    expect(transport).toMatchObject({ estimated: 0, actual: 350_00, variance: 350_00, hasActuals: true });
    const fee = fin.byCategory.find((r) => r.category === "PAYMENT_FEE")!;
    expect(fee).toMatchObject({ estimated: 500_00, actual: 210_00, variance: -290_00 });
    expect(fin.actualCost).toBe(1_600_00 + 450_00 + 210_00);
  });

  it("margen real negativo se reporta negativo (no se recorta) y advierte sobrecosto", () => {
    const fin = computeEventFinancials(
      baseInput({
        actual: {
          purchases: [
            {
              category: "FOOD",
              status: "RECEIVED",
              expectedAmountCents: 3_000_00,
              actualAmountCents: 12_000_00,
            },
          ],
          staffAssignments: [],
          manualCosts: [],
          payments: [],
        },
      }),
    );
    expect(fin.actualMargin).toBe(-2_000_00);
    expect(fin.actualMarginBps).toBe(-2000);
    const codes = fin.warnings.map((w) => w.code);
    expect(codes).toContain("NEGATIVE_ACTUAL_MARGIN");
    expect(codes).toContain("COST_OVERRUN");
  });

  it("margen estimado negativo se reporta y advierte", () => {
    const fin = computeEventFinancials(baseInput({ estimated: { costBreakdown: { FOOD: 12_000_00 } } }));
    expect(fin.estimatedMargin).toBe(-2_000_00);
    expect(fin.estimatedMarginBps).toBe(-2000);
    expect(fin.warnings.map((w) => w.code)).toContain("NEGATIVE_ESTIMATED_MARGIN");
  });

  it("usa estimatedCostCents en OTHER si el desglose viene vacío", () => {
    const fin = computeEventFinancials(
      baseInput({ estimated: { costBreakdown: {}, estimatedCostCents: 4_000_00 } }),
    );
    expect(fin.estimatedCost).toBe(4_000_00);
    expect(fin.byCategory.find((r) => r.category === "OTHER")!.estimated).toBe(4_000_00);
  });

  it("sin estimado advierte NO_ESTIMATE", () => {
    const fin = computeEventFinancials(baseInput({ estimated: { costBreakdown: {} } }));
    expect(fin.estimatedCost).toBe(0);
    expect(fin.warnings.map((w) => w.code)).toContain("NO_ESTIMATE");
  });

  it("devuelve siempre las 8 categorías en orden", () => {
    const fin = computeEventFinancials(baseInput());
    expect(fin.byCategory.map((r) => r.category)).toEqual([
      "FOOD",
      "FLOWERS",
      "STAFF",
      "TRANSPORT",
      "VENDOR",
      "CONSUMABLES",
      "PAYMENT_FEE",
      "OTHER",
    ]);
  });
});

describe("helpers de pagos", () => {
  it("no cuenta dos veces un reembolso registrado en el original y como REFUND", () => {
    const payments: FinPayment[] = [
      paid(10_000, 0, { status: "PARTIAL_REFUND", refundedCents: 3_000 }),
      { kind: "REFUND", status: "PAID", amountCents: 3_000, feeCents: 0, refundedCents: 0 },
    ];
    expect(computeRefundsCents(payments)).toBe(3_000);
  });

  it("comisiones sólo de pagos cobrados (incluye reembolsados)", () => {
    expect(
      computePaymentFeesCents([
        paid(100, 10),
        paid(100, 20, { status: "REFUNDED", refundedCents: 100 }),
        paid(100, 30, { status: "PENDING" }),
        paid(100, 40, { status: "FAILED" }),
      ]),
    ).toBe(30);
  });

  it("cobranza: cobrado neto de reembolsos y saldo nunca negativo", () => {
    expect(
      computeCollection(10_000, [
        paid(6_000),
        paid(1_000, 0, { status: "PARTIAL_REFUND", refundedCents: 500 }),
      ]),
    ).toEqual({
      total: 10_000,
      paid: 6_500,
      balance: 3_500,
    });
    expect(computeCollection(5_000, [paid(6_000)]).balance).toBe(0);
  });
});

describe("estimatedBreakdownFromQuote", () => {
  const fees = { paymentFeeBps: 360, paymentFeeFixedCents: 300 };

  it("usa costBreakdown del snapshot cuando existe", () => {
    const out = estimatedBreakdownFromQuote(
      {
        pricingSnapshot: { costBreakdown: { FOOD: 100, STAFF: 50, PAYMENT_FEE: 7, BOGUS: 9 } },
        items: [],
        estimatedCostCents: 0,
        totalCents: 0,
      },
      fees,
    );
    expect(out).toEqual({ FOOD: 100, STAFF: 50, PAYMENT_FEE: 7 });
  });

  it("lee result.costBreakdown anidado", () => {
    const out = estimatedBreakdownFromQuote(
      {
        pricingSnapshot: { result: { costBreakdown: { FLOWERS: 40 } } },
        items: [],
        estimatedCostCents: 0,
        totalCents: 0,
      },
      fees,
    );
    expect(out).toEqual({ FLOWERS: 40 });
  });

  it("agrupa partidas por categoría + comisión del snapshot (forma sembrada)", () => {
    const out = estimatedBreakdownFromQuote(
      {
        pricingSnapshot: { totals: { paymentFeeCents: 1_234 } },
        items: [
          { costCategory: "FOOD", totalCostCents: 1_000 },
          { costCategory: "FOOD", totalCostCents: 500 },
          { costCategory: "TRANSPORT", totalCostCents: 200 },
        ],
        estimatedCostCents: 99_999,
        totalCents: 10_000,
      },
      fees,
    );
    expect(out.FOOD).toBe(1_500);
    expect(out.TRANSPORT).toBe(200);
    expect(out.PAYMENT_FEE).toBe(1_234);
  });

  it("sin snapshot: comisión = estimatedCostCents − costo de partidas", () => {
    const out = estimatedBreakdownFromQuote(
      {
        pricingSnapshot: null,
        items: [{ costCategory: "FOOD", totalCostCents: 1_000 }],
        estimatedCostCents: 1_400,
        totalCents: 10_000,
      },
      fees,
    );
    expect(out.PAYMENT_FEE).toBe(400);
  });

  it("sin snapshot ni diferencia: comisión desde configuración", () => {
    const out = estimatedBreakdownFromQuote(
      {
        pricingSnapshot: null,
        items: [{ costCategory: "FOOD", totalCostCents: 1_000 }],
        estimatedCostCents: 1_000,
        totalCents: 100_000,
      },
      fees,
    );
    expect(out.PAYMENT_FEE).toBe(estimatePaymentFee(100_000, fees));
    expect(out.PAYMENT_FEE).toBe(3_600 + 300);
  });

  it("categoría desconocida cae en OTHER", () => {
    const out = estimatedBreakdownFromQuote(
      {
        pricingSnapshot: null,
        items: [{ costCategory: "WEIRD", totalCostCents: 10 }],
        estimatedCostCents: 0,
        totalCents: 0,
      },
      fees,
    );
    expect(out.OTHER).toBe(10);
    expect(out.PAYMENT_FEE).toBe(0);
  });
});

describe("snapshot de cierre", () => {
  it("construye y relee el snapshot v2", () => {
    const fin = computeEventFinancials(
      baseInput({
        actual: {
          purchases: [
            {
              category: "FOOD",
              status: "RECEIVED",
              expectedAmountCents: 3_000_00,
              actualAmountCents: 3_100_00,
            },
          ],
          staffAssignments: [{ amountCents: 1_500_00 }],
          manualCosts: [],
          payments: [paid(11_600_00, 420_00)],
        },
      }),
    );
    const closedAt = new Date("2026-09-30T18:00:00Z");
    const snap = buildClosingSnapshot(fin, {
      closedAt,
      guestCount: 8,
      collectedCents: 11_600_00,
      balanceCents: 0,
    });
    expect(snap.version).toBe(2);
    expect(snap.costsByCategory).toEqual({ FOOD: 3_100_00, STAFF: 1_500_00, PAYMENT_FEE: 420_00 });
    const read = readClosingSnapshot(JSON.parse(JSON.stringify(snap)))!;
    expect(read.closedAt).toBe(closedAt.toISOString());
    expect(read.saleCents).toBe(11_600_00);
    expect(read.actualCostCents).toBe(5_020_00);
    expect(read.actualMarginCents).toBe(10_000_00 - 5_020_00);
    expect(read.actualMarginBps).toBe(4980);
    expect(read.estimatedMarginBps).toBe(4000);
  });

  it("lee el snapshot v1 sembrado (sin marginBps calculado)", () => {
    const read = readClosingSnapshot({
      version: 1,
      revenue: { totalCents: 116_00, taxCents: 16_00, netRevenueCents: 100_00, paidCents: 116_00 },
      estimated: { costCents: 50_00 },
      actual: { totalCostCents: 120_00 },
      costsByCategory: { FOOD: 120_00 },
      notes: "Nota",
    })!;
    expect(read.actualMarginCents).toBe(-20_00);
    expect(read.actualMarginBps).toBe(-2000);
    expect(read.estimatedMarginCents).toBe(50_00);
    expect(read.notes).toBe("Nota");
  });

  it("devuelve null para snapshots inválidos", () => {
    expect(readClosingSnapshot(null)).toBeNull();
    expect(readClosingSnapshot({ foo: 1 })).toBeNull();
    expect(readClosingSnapshot("x")).toBeNull();
  });
});

describe("utilidades", () => {
  it("marginBpsOrNull", () => {
    expect(marginBpsOrNull(25, 100)).toBe(2500);
    expect(marginBpsOrNull(-25, 100)).toBe(-2500);
    expect(marginBpsOrNull(10, 0)).toBeNull();
  });

  it("taxIncludedIn", () => {
    expect(taxIncludedIn(11_600, 1600)).toBe(1_600);
    expect(taxIncludedIn(0, 1600)).toBe(0);
  });

  it("weightedMarginBps pondera por ingreso", () => {
    expect(
      weightedMarginBps([
        { marginCents: 50, revenueCents: 100 },
        { marginCents: -10, revenueCents: 100 },
      ]),
    ).toBe(2000);
    expect(weightedMarginBps([])).toBeNull();
  });
});
