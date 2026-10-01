/**
 * Rentabilidad por evento — dominio PURO (sin I/O).
 *
 * Convenciones:
 *  - Todo en centavos MXN (enteros). Márgenes en bps (1600 = 16 %).
 *  - La venta (`salesTotalCents`) incluye IVA; el margen se calcula sobre el ingreso NETO de impuestos.
 *  - Los reembolsos reducen la venta; el IVA se ajusta proporcionalmente a lo que queda.
 *  - Costo estimado: desglose por categoría tomado de la cotización (snapshot o partidas).
 *  - Costo real: compras RECIBIDAS + staff asignado + costos manuales + comisiones de pagos cobrados.
 *  - Márgenes negativos se reportan como negativos (nunca se recortan ni se ocultan).
 */

export const COST_CATEGORIES = [
  "FOOD",
  "FLOWERS",
  "STAFF",
  "TRANSPORT",
  "VENDOR",
  "CONSUMABLES",
  "PAYMENT_FEE",
  "OTHER",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];
export type CategoryAmounts = Partial<Record<CostCategory, number>>;

export type FinPurchaseStatus = "REQUESTED" | "ORDERED" | "RECEIVED" | "CANCELLED";
export type FinPaymentKind = "DEPOSIT" | "BALANCE" | "FULL" | "REFUND";
export type FinPaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";

export type FinPurchase = {
  category: CostCategory;
  status: FinPurchaseStatus;
  expectedAmountCents: number;
  actualAmountCents: number | null;
};

export type FinPayment = {
  kind: FinPaymentKind;
  status: FinPaymentStatus;
  amountCents: number;
  feeCents: number;
  refundedCents: number;
};

export type EventFinancialsInput = {
  /**
   * Evento cancelado: la venta es sólo lo cobrado y el costo estimado de la cotización ya no aplica
   * (no se va a ejecutar). Los costos reales (compras recibidas, etc.) sí cuentan: son costos hundidos.
   */
  cancelled?: boolean;
  /** Total de la reserva/cotización (IVA incluido). */
  salesTotalCents: number;
  /** IVA contenido en `salesTotalCents`. */
  taxCents: number;
  estimated: {
    /** Costo estimado por categoría (de la cotización). */
    costBreakdown: CategoryAmounts;
    /** Total estimado declarado por la cotización (se usa si el desglose viene vacío). */
    estimatedCostCents?: number | null;
  };
  actual: {
    purchases: FinPurchase[];
    staffAssignments: Array<{ amountCents: number }>;
    manualCosts: Array<{ category: CostCategory; amountCents: number }>;
    payments: FinPayment[];
  };
};

export type CategoryRow = {
  category: CostCategory;
  estimated: number;
  actual: number;
  /** actual − estimado; null si la categoría no tiene costos reales registrados. */
  variance: number | null;
  hasActuals: boolean;
};

export type FinancialWarningCode =
  | "CANCELLED_EVENT"
  | "NO_SALE"
  | "NO_ESTIMATE"
  | "NO_ACTUALS"
  | "MISSING_ACTUALS"
  | "NEGATIVE_ESTIMATED_MARGIN"
  | "NEGATIVE_ACTUAL_MARGIN"
  | "COST_OVERRUN"
  | "REFUNDS_APPLIED"
  | "RECEIVED_WITHOUT_AMOUNT"
  | "PURCHASES_PENDING";

export type FinancialWarning = { code: FinancialWarningCode; message: string };

export type EventFinancials = {
  /** Venta total con IVA (antes de reembolsos). */
  sale: number;
  /** Reembolsos aplicados (con IVA). */
  refunds: number;
  /** IVA sobre la venta efectiva (después de reembolsos). */
  tax: number;
  /** Ingreso neto planeado (venta − IVA, sin reembolsos): base del margen estimado. */
  plannedNetRevenue: number;
  /** Ingreso neto real (venta − reembolsos − IVA proporcional): base del margen real. */
  netRevenue: number;
  estimatedCost: number;
  actualCost: number;
  estimatedMargin: number;
  /** null cuando no hay ingreso neto (el % no está definido). */
  estimatedMarginBps: number | null;
  actualMargin: number;
  actualMarginBps: number | null;
  /** actualCost − estimatedCost (positivo = gastamos más de lo estimado). */
  costVariance: number;
  byCategory: CategoryRow[];
  hasActuals: Record<CostCategory, boolean>;
  anyActuals: boolean;
  sources: {
    purchasesCents: number;
    staffCents: number;
    manualCents: number;
    paymentFeesCents: number;
    pendingPurchases: number;
  };
  warnings: FinancialWarning[];
};

export const COST_OVERRUN_TOLERANCE_BPS = 1000; // 10 %

const CATEGORY_NAMES: Record<CostCategory, string> = {
  FOOD: "Alimentos",
  FLOWERS: "Flores",
  STAFF: "Staff",
  TRANSPORT: "Transporte",
  VENDOR: "Proveedores",
  CONSUMABLES: "Consumibles",
  PAYMENT_FEE: "Comisión de pago",
  OTHER: "Otros",
};

export function isCostCategory(value: unknown): value is CostCategory {
  return typeof value === "string" && (COST_CATEGORIES as readonly string[]).includes(value);
}

export function emptyCategoryAmounts(): Record<CostCategory, number> {
  return { FOOD: 0, FLOWERS: 0, STAFF: 0, TRANSPORT: 0, VENDOR: 0, CONSUMABLES: 0, PAYMENT_FEE: 0, OTHER: 0 };
}

function safeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

/** Margen en bps sobre un ingreso; null si el ingreso no es positivo (porcentaje indefinido). */
export function marginBpsOrNull(marginCents: number, revenueCents: number): number | null {
  if (revenueCents <= 0) return null;
  return Math.round((marginCents / revenueCents) * 10_000);
}

/** IVA contenido en un total con impuestos incluidos. */
export function taxIncludedIn(totalCents: number, taxRateBps: number): number {
  if (totalCents <= 0 || taxRateBps <= 0) return 0;
  return Math.round(totalCents - (totalCents * 10_000) / (10_000 + taxRateBps));
}

/** Estatus de pago que implican un cobro efectivo (y por tanto comisión de la pasarela). */
const CHARGED_STATUSES: FinPaymentStatus[] = ["PAID", "PARTIAL_REFUND", "REFUNDED"];

/**
 * Reembolsos totales del evento. Se modelan de dos formas (según el flujo que los registró):
 *  - `refundedCents` en el pago original (estatus PARTIAL_REFUND/REFUNDED), y/o
 *  - un registro `kind = REFUND` pagado.
 * Ambas representan el mismo dinero, por eso se toma el mayor (nunca se suman dos veces).
 */
export function computeRefundsCents(payments: FinPayment[]): number {
  const onOriginals = payments
    .filter((p) => p.kind !== "REFUND")
    .reduce((s, p) => s + Math.max(0, safeInt(p.refundedCents)), 0);
  const refundRows = payments
    .filter((p) => p.kind === "REFUND" && p.status === "PAID")
    .reduce((s, p) => s + Math.abs(safeInt(p.amountCents)), 0);
  return Math.max(onOriginals, refundRows);
}

/** Comisiones de pasarela de pagos efectivamente cobrados. */
export function computePaymentFeesCents(payments: FinPayment[]): number {
  return payments
    .filter((p) => CHARGED_STATUSES.includes(p.status))
    .reduce((s, p) => s + Math.max(0, safeInt(p.feeCents)), 0);
}

/** Cobrado neto (sin registros de reembolso, descontando lo reembolsado). */
export function computeCollectedCents(payments: FinPayment[]): number {
  return payments
    .filter((p) => p.kind !== "REFUND" && CHARGED_STATUSES.includes(p.status))
    .reduce((s, p) => s + safeInt(p.amountCents) - Math.max(0, safeInt(p.refundedCents)), 0);
}

export function computeCollection(totalCents: number, payments: FinPayment[]) {
  const paid = computeCollectedCents(payments);
  return { total: totalCents, paid, balance: Math.max(0, totalCents - paid) };
}

export function computeEventFinancials(input: EventFinancialsInput): EventFinancials {
  const warnings: FinancialWarning[] = [];
  const sale = Math.max(0, safeInt(input.salesTotalCents));
  const plannedTax = Math.min(Math.max(0, safeInt(input.taxCents)), sale);

  // ---- Ingresos -----------------------------------------------------------
  const refunds = Math.min(computeRefundsCents(input.actual.payments), sale);
  const effectiveSale = sale - refunds;
  const tax = sale > 0 ? Math.round((plannedTax * effectiveSale) / sale) : 0;
  const plannedNetRevenue = sale - plannedTax;
  const netRevenue = effectiveSale - tax;

  // En cancelados sin cobro, CANCELLED_EVENT ya lo explica.
  if (sale <= 0 && input.cancelled !== true) {
    warnings.push({ code: "NO_SALE", message: "El evento no tiene una venta registrada." });
  }
  if (refunds > 0) {
    warnings.push({
      code: "REFUNDS_APPLIED",
      message:
        "Hay reembolsos aplicados: el margen real se calcula sobre el ingreso neto después de reembolsos.",
    });
  }

  // ---- Costo estimado -----------------------------------------------------
  const cancelled = input.cancelled === true;
  const estimated = emptyCategoryAmounts();
  let breakdownTotal = 0;
  if (!cancelled) {
    for (const cat of COST_CATEGORIES) {
      const v = safeInt(input.estimated.costBreakdown[cat]);
      estimated[cat] = v;
      breakdownTotal += v;
    }
    const declared = safeInt(input.estimated.estimatedCostCents);
    if (breakdownTotal === 0 && declared > 0) {
      estimated.OTHER = declared;
      breakdownTotal = declared;
    }
  }
  const estimatedCost = breakdownTotal;
  if (cancelled) {
    warnings.push({
      code: "CANCELLED_EVENT",
      message:
        "Evento cancelado: la venta es lo cobrado (menos reembolsos) y el costo estimado de la cotización ya no aplica.",
    });
  } else if (estimatedCost === 0) {
    warnings.push({
      code: "NO_ESTIMATE",
      message: "No hay costo estimado (el evento no tiene cotización con costos).",
    });
  }

  // ---- Costo real ---------------------------------------------------------
  const actual = emptyCategoryAmounts();
  const has: Record<CostCategory, boolean> = {
    FOOD: false,
    FLOWERS: false,
    STAFF: false,
    TRANSPORT: false,
    VENDOR: false,
    CONSUMABLES: false,
    PAYMENT_FEE: false,
    OTHER: false,
  };

  let purchasesCents = 0;
  let receivedWithoutAmount = 0;
  let pendingPurchases = 0;
  for (const p of input.actual.purchases) {
    if (p.status === "RECEIVED") {
      let amount = p.actualAmountCents;
      if (amount == null) {
        amount = safeInt(p.expectedAmountCents);
        receivedWithoutAmount += 1;
      }
      const cat = isCostCategory(p.category) ? p.category : "OTHER";
      actual[cat] += safeInt(amount);
      has[cat] = true;
      purchasesCents += safeInt(amount);
    } else if (p.status === "REQUESTED" || p.status === "ORDERED") {
      pendingPurchases += 1;
    }
  }
  if (receivedWithoutAmount > 0) {
    warnings.push({
      code: "RECEIVED_WITHOUT_AMOUNT",
      message: `${receivedWithoutAmount} compra(s) recibida(s) sin monto real: se usó el monto esperado.`,
    });
  }
  if (pendingPurchases > 0) {
    warnings.push({
      code: "PURCHASES_PENDING",
      message: `${pendingPurchases} compra(s) sin recibir todavía no cuentan en el costo real.`,
    });
  }

  const staffCents = input.actual.staffAssignments.reduce(
    (s, a) => s + Math.max(0, safeInt(a.amountCents)),
    0,
  );
  if (input.actual.staffAssignments.length > 0) {
    actual.STAFF += staffCents;
    has.STAFF = true;
  }

  let manualCents = 0;
  for (const c of input.actual.manualCosts) {
    const cat = isCostCategory(c.category) ? c.category : "OTHER";
    actual[cat] += safeInt(c.amountCents);
    has[cat] = true;
    manualCents += safeInt(c.amountCents);
  }

  const paymentFeesCents = computePaymentFeesCents(input.actual.payments);
  const chargedPayments = input.actual.payments.filter((p) => CHARGED_STATUSES.includes(p.status));
  if (chargedPayments.length > 0) {
    actual.PAYMENT_FEE += paymentFeesCents;
    has.PAYMENT_FEE = true;
  }

  const anyActuals = COST_CATEGORIES.some((c) => has[c]);
  const actualCost = COST_CATEGORIES.reduce((s, c) => s + actual[c], 0);

  // ---- Márgenes -----------------------------------------------------------
  const estimatedMargin = plannedNetRevenue - estimatedCost;
  const actualMargin = netRevenue - actualCost;
  const estimatedMarginBps = marginBpsOrNull(estimatedMargin, plannedNetRevenue);
  const actualMarginBps = marginBpsOrNull(actualMargin, netRevenue);

  if (estimatedCost > 0 && estimatedMargin < 0) {
    warnings.push({ code: "NEGATIVE_ESTIMATED_MARGIN", message: "El margen estimado es negativo." });
  }
  if (!anyActuals) {
    warnings.push({ code: "NO_ACTUALS", message: "Aún no hay costos reales registrados." });
  } else {
    if (actualMargin < 0) {
      warnings.push({
        code: "NEGATIVE_ACTUAL_MARGIN",
        message: "El margen real es negativo: el evento está en pérdida.",
      });
    }
    if (estimatedCost > 0 && actualCost * 10_000 > estimatedCost * (10_000 + COST_OVERRUN_TOLERANCE_BPS)) {
      warnings.push({
        code: "COST_OVERRUN",
        message: `El costo real supera al estimado en más de ${COST_OVERRUN_TOLERANCE_BPS / 100}%.`,
      });
    }
    const missing = COST_CATEGORIES.filter((c) => estimated[c] > 0 && !has[c]);
    if (missing.length > 0) {
      warnings.push({
        code: "MISSING_ACTUALS",
        message: `Sin costos reales registrados en: ${missing.map((c) => CATEGORY_NAMES[c]).join(", ")}.`,
      });
    }
  }

  const byCategory: CategoryRow[] = COST_CATEGORIES.map((category) => ({
    category,
    estimated: estimated[category],
    actual: actual[category],
    variance: has[category] ? actual[category] - estimated[category] : null,
    hasActuals: has[category],
  }));

  return {
    sale,
    refunds,
    tax,
    plannedNetRevenue,
    netRevenue,
    estimatedCost,
    actualCost,
    estimatedMargin,
    estimatedMarginBps,
    actualMargin,
    actualMarginBps,
    costVariance: actualCost - estimatedCost,
    byCategory,
    hasActuals: has,
    anyActuals,
    sources: { purchasesCents, staffCents, manualCents, paymentFeesCents, pendingPurchases },
    warnings,
  };
}

// ============================================================================
// Costo estimado desde la cotización
// ============================================================================

export type QuoteCostSource = {
  pricingSnapshot: unknown;
  items: Array<{ costCategory: string; totalCostCents: number }>;
  estimatedCostCents: number;
  totalCents: number;
};

export type FeeSettings = { paymentFeeBps: number; paymentFeeFixedCents: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lee un desglose { CATEGORIA: centavos } si el objeto lo parece. */
function readBreakdown(value: unknown): CategoryAmounts | null {
  if (!isRecord(value)) return null;
  const out: CategoryAmounts = {};
  let found = false;
  for (const [k, v] of Object.entries(value)) {
    if (isCostCategory(k) && typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.round(v);
      found = true;
    }
  }
  return found ? out : null;
}

function readNumber(obj: unknown, ...path: string[]): number | null {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return null;
    cur = cur[key];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : null;
}

/**
 * Desglose de costo estimado de una cotización:
 *  1. `pricingSnapshot.costBreakdown` (o `.result.costBreakdown` / `.estimate.costBreakdown`) si existe;
 *  2. si no, partidas agrupadas por `costCategory` + comisión de pago estimada
 *     (snapshot.totals.paymentFeeCents → diferencia contra estimatedCostCents → configuración).
 */
export function estimatedBreakdownFromQuote(quote: QuoteCostSource, fees: FeeSettings): CategoryAmounts {
  const snap = quote.pricingSnapshot;
  if (isRecord(snap)) {
    const direct =
      readBreakdown(snap.costBreakdown) ??
      (isRecord(snap.result) ? readBreakdown(snap.result.costBreakdown) : null) ??
      (isRecord(snap.estimate) ? readBreakdown(snap.estimate.costBreakdown) : null);
    if (direct) return direct;
  }

  const out = emptyCategoryAmounts();
  let itemsCost = 0;
  for (const item of quote.items) {
    const cat = isCostCategory(item.costCategory) ? item.costCategory : "OTHER";
    const v = safeInt(item.totalCostCents);
    out[cat] += v;
    itemsCost += v;
  }

  if (out.PAYMENT_FEE === 0) {
    const fromSnapshot = readNumber(snap, "totals", "paymentFeeCents") ?? readNumber(snap, "paymentFeeCents");
    let fee: number;
    if (fromSnapshot != null) fee = Math.round(fromSnapshot);
    else if (quote.estimatedCostCents > itemsCost) fee = quote.estimatedCostCents - itemsCost;
    else fee = estimatePaymentFee(quote.totalCents, fees);
    out.PAYMENT_FEE = Math.max(0, fee);
  }
  return out;
}

export function estimatePaymentFee(totalCents: number, fees: FeeSettings): number {
  if (totalCents <= 0) return 0;
  return Math.round((totalCents * fees.paymentFeeBps) / 10_000) + fees.paymentFeeFixedCents;
}

// ============================================================================
// Snapshot de cierre
// ============================================================================

export const CLOSING_SNAPSHOT_VERSION = 2;

/** Snapshot congelado al cerrar el evento (compatible con la forma v1 sembrada en demo). */
export function buildClosingSnapshot(
  fin: EventFinancials,
  extra: { closedAt: Date; guestCount: number; collectedCents: number; balanceCents: number },
) {
  const costsByCategory: CategoryAmounts = {};
  for (const row of fin.byCategory) if (row.hasActuals) costsByCategory[row.category] = row.actual;
  return {
    version: CLOSING_SNAPSHOT_VERSION,
    closedAt: extra.closedAt.toISOString(),
    currency: "MXN",
    guestCount: extra.guestCount,
    revenue: {
      totalCents: fin.sale,
      taxCents: fin.tax,
      refundsCents: fin.refunds,
      netRevenueCents: fin.netRevenue,
      plannedNetRevenueCents: fin.plannedNetRevenue,
      paidCents: extra.collectedCents,
      balanceCents: extra.balanceCents,
    },
    estimated: {
      costCents: fin.estimatedCost,
      marginCents: fin.estimatedMargin,
      marginBps: fin.estimatedMarginBps,
    },
    actual: {
      purchasesCents: fin.sources.purchasesCents,
      staffCents: fin.sources.staffCents,
      extraCostsCents: fin.sources.manualCents,
      paymentFeesCents: fin.sources.paymentFeesCents,
      totalCostCents: fin.actualCost,
      marginCents: fin.actualMargin,
      marginBps: fin.actualMarginBps,
    },
    costsByCategory,
    variance: {
      costCents: fin.costVariance,
      marginBps:
        fin.actualMarginBps != null && fin.estimatedMarginBps != null
          ? fin.actualMarginBps - fin.estimatedMarginBps
          : null,
    },
    byCategory: fin.byCategory,
    warnings: fin.warnings.map((w) => w.code),
  };
}

export type ClosingSnapshot = ReturnType<typeof buildClosingSnapshot>;

/** Vista normalizada de un snapshot de cierre (v1 sembrado o v2 de este módulo). */
export type ClosingSummary = {
  closedAt: string | null;
  saleCents: number;
  netRevenueCents: number;
  paidCents: number | null;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  estimatedMarginBps: number | null;
  actualCostCents: number;
  actualMarginCents: number;
  actualMarginBps: number | null;
  costsByCategory: CategoryAmounts;
  notes: string | null;
};

export function readClosingSnapshot(value: unknown): ClosingSummary | null {
  if (!isRecord(value)) return null;
  const sale = readNumber(value, "revenue", "totalCents");
  const net = readNumber(value, "revenue", "netRevenueCents");
  const actualCost = readNumber(value, "actual", "totalCostCents");
  if (sale == null || net == null || actualCost == null) return null;
  const estimatedCost = readNumber(value, "estimated", "costCents") ?? 0;
  const actualMargin = readNumber(value, "actual", "marginCents") ?? net - actualCost;
  const estimatedMargin = readNumber(value, "estimated", "marginCents") ?? net - estimatedCost;
  return {
    closedAt: typeof value.closedAt === "string" ? value.closedAt : null,
    saleCents: Math.round(sale),
    netRevenueCents: Math.round(net),
    paidCents: readNumber(value, "revenue", "paidCents"),
    estimatedCostCents: Math.round(estimatedCost),
    estimatedMarginCents: Math.round(estimatedMargin),
    estimatedMarginBps: readNumber(value, "estimated", "marginBps") ?? marginBpsOrNull(estimatedMargin, net),
    actualCostCents: Math.round(actualCost),
    actualMarginCents: Math.round(actualMargin),
    actualMarginBps: readNumber(value, "actual", "marginBps") ?? marginBpsOrNull(actualMargin, net),
    costsByCategory: readBreakdown(value.costsByCategory) ?? {},
    notes: typeof value.notes === "string" ? value.notes : null,
  };
}

/** Margen ponderado (Σ margen / Σ ingreso) en bps; null si no hay ingreso. */
export function weightedMarginBps(rows: Array<{ marginCents: number; revenueCents: number }>): number | null {
  const revenue = rows.reduce((s, r) => s + r.revenueCents, 0);
  const margin = rows.reduce((s, r) => s + r.marginCents, 0);
  return marginBpsOrNull(margin, revenue);
}
