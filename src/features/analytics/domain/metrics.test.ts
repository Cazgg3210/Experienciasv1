import { describe, expect, it } from "vitest";
import {
  average,
  buildFunnel,
  changeBps,
  checklistProgressBps,
  computeInventoryConflicts,
  currentMonthKey,
  dateWindow,
  formatChange,
  formatPercentBps,
  isValidMonthKey,
  lastMonths,
  monthBucket,
  monthLongLabel,
  monthOptions,
  parseRangeDays,
  rateBps,
  rollingWindow,
  rsvpPendingBps,
  rsvpProgressBps,
  shiftMonthKey,
  toRankedRows,
  uniqueFunnelCounts,
} from "./metrics";

describe("tasas y variaciones", () => {
  it("changeBps", () => {
    expect(changeBps(12, 10)).toBe(2000);
    expect(changeBps(5, 10)).toBe(-5000);
    expect(changeBps(0, 0)).toBe(0);
    expect(changeBps(3, 0)).toBeNull();
  });
  it("rateBps", () => {
    expect(rateBps(1, 4)).toBe(2500);
    expect(rateBps(1, 0)).toBeNull();
  });
  it("formatos", () => {
    expect(formatPercentBps(2550)).toBe("26%");
    expect(formatPercentBps(2550, 1)).toBe("25.5%");
    expect(formatPercentBps(null)).toBe("—");
    expect(formatChange(1500)).toBe("+15%");
    expect(formatChange(-800)).toBe("−8%");
    expect(formatChange(0)).toBe("sin cambio");
    expect(formatChange(null)).toBe("sin periodo previo");
  });
  it("average", () => {
    expect(average([1, 2, 3])).toBe(2);
    expect(average([])).toBeNull();
  });
});

describe("embudo", () => {
  it("calcula conversión por paso y acumulada", () => {
    const rows = buildFunnel({
      VIEW_EXPERIENCE: 200,
      START_CONFIGURATOR: 100,
      COMPLETE_CONFIGURATOR: 50,
      SUBMIT_LEAD: 25,
    });
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({
      step: "VIEW_EXPERIENCE",
      count: 200,
      stepRateBps: null,
      overallRateBps: 10_000,
    });
    expect(rows[1]).toMatchObject({ count: 100, stepRateBps: 5000, overallRateBps: 5000 });
    expect(rows[3]).toMatchObject({ count: 25, stepRateBps: 5000, overallRateBps: 1250 });
    expect(rows[4]).toMatchObject({ step: "VIEW_QUOTE", count: 0, stepRateBps: 0 });
    expect(rows[5]).toMatchObject({ step: "ACCEPT_QUOTE", count: 0, stepRateBps: null });
  });
  it("sin datos: todo en cero sin dividir entre cero", () => {
    const rows = buildFunnel({});
    expect(rows.every((r) => r.count === 0)).toBe(true);
    expect(rows[0]!.overallRateBps).toBeNull();
    expect(rows[1]!.stepRateBps).toBeNull();
  });

  it("uniqueFunnelCounts cuenta recorridos únicos, no eventos crudos", () => {
    const g = (
      type: string,
      ids: Partial<{ sessionId: string; leadId: string; quoteId: string; eventId: string }>,
      count = 1,
    ) => ({ type, sessionId: null, leadId: null, quoteId: null, eventId: null, ...ids, count });
    const counts = uniqueFunnelCounts([
      // Una sesión que vio 3 experiencias (3 filas agrupadas) + otra sesión + 2 vistas anónimas
      g("VIEW_EXPERIENCE", { sessionId: "s1" }, 3),
      g("VIEW_EXPERIENCE", { sessionId: "s2" }),
      g("VIEW_EXPERIENCE", {}, 2),
      g("SUBMIT_LEAD", { leadId: "l1", sessionId: "s1" }),
      g("SUBMIT_LEAD", { leadId: "l2" }),
      // La misma cotización aceptada; dos intentos de pago y anticipo + saldo exitosos
      g("ACCEPT_QUOTE", { quoteId: "q1", eventId: "e1" }),
      g("START_PAYMENT", { quoteId: "q1", eventId: "e1" }, 2),
      g("PAYMENT_SUCCESS", { quoteId: "q1", eventId: "e1" }, 2),
      // Sin cotización: cae al evento
      g("PAYMENT_SUCCESS", { eventId: "e2" }),
      // Tipos fuera del embudo se ignoran
      g("RSVP_SUBMIT", { eventId: "e1" }, 9),
    ]);
    expect(counts.VIEW_EXPERIENCE).toBe(4);
    expect(counts.SUBMIT_LEAD).toBe(2);
    expect(counts.ACCEPT_QUOTE).toBe(1);
    expect(counts.START_PAYMENT).toBe(1);
    expect(counts.PAYMENT_SUCCESS).toBe(2);
    expect(counts.VIEW_QUOTE).toBe(0);
    expect(Object.keys(counts)).toHaveLength(8);
    // El pago ya no supera a la aceptación por contar anticipo + saldo
    const funnel = buildFunnel(counts);
    expect(funnel.find((r) => r.step === "START_PAYMENT")!.stepRateBps).toBe(10_000);
  });
});

describe("rangos y meses", () => {
  it("parseRangeDays acepta 7/30/90 y cae al default", () => {
    expect(parseRangeDays("7")).toBe(7);
    expect(parseRangeDays(["90"])).toBe(90);
    expect(parseRangeDays("15")).toBe(30);
    expect(parseRangeDays(undefined, 7)).toBe(7);
  });
  it("rollingWindow", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const w = rollingWindow(30, now);
    expect(w.to).toEqual(now);
    expect(w.from.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    expect(w.prevFrom.toISOString()).toBe("2026-08-02T12:00:00.000Z");
    expect(w.prevTo).toEqual(w.from);
  });
  it("shiftMonthKey cruza años", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-03", 1)).toBe("2026-04");
    expect(shiftMonthKey("2026-10", -13)).toBe("2025-09");
  });
  it("currentMonthKey usa la zona CDMX", () => {
    // 1 oct 03:00 UTC = 30 sep 21:00 en CDMX
    expect(currentMonthKey(new Date("2026-10-01T03:00:00Z"))).toBe("2026-09");
    expect(currentMonthKey(new Date("2026-10-01T12:00:00Z"))).toBe("2026-10");
  });
  it("monthBucket con límites en CDMX y como @db.Date", () => {
    const b = monthBucket("2026-12");
    expect(b.label).toBe("dic 2026");
    expect(b.start.toISOString()).toBe("2026-12-01T06:00:00.000Z");
    expect(b.end.toISOString()).toBe("2027-01-01T06:00:00.000Z");
    expect(b.startDate.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(b.endDate.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("lastMonths devuelve N meses en orden cronológico", () => {
    const months = lastMonths(6, new Date("2026-02-15T12:00:00Z"));
    expect(months.map((m) => m.key)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
  it("monthOptions incluye futuros y pasados (reciente primero)", () => {
    const opts = monthOptions(2, 1, new Date("2026-10-10T12:00:00Z"));
    expect(opts.map((o) => o.value)).toEqual(["2026-11", "2026-10", "2026-09", "2026-08"]);
    expect(opts[1]!.label).toBe("Octubre 2026");
  });
  it("isValidMonthKey / monthLongLabel", () => {
    expect(isValidMonthKey("2026-09")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("x")).toBe(false);
    expect(monthLongLabel("2026-01")).toBe("Enero 2026");
  });
  it("dateWindow es inclusiva del último día", () => {
    const w = dateWindow(7, new Date("2026-10-01T12:00:00Z"));
    expect(w.todayKey).toBe("2026-10-01");
    expect(w.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-09T00:00:00.000Z");
  });
});

describe("progreso de eventos", () => {
  const guests = [
    { rsvpStatus: "PENDING" },
    { rsvpStatus: "ATTENDING" },
    { rsvpStatus: "NOT_ATTENDING" },
    { rsvpStatus: "PENDING" },
  ];
  it("RSVP", () => {
    expect(rsvpProgressBps(guests)).toBe(5000);
    expect(rsvpPendingBps(guests)).toBe(5000);
    expect(rsvpProgressBps([])).toBeNull();
    expect(rsvpPendingBps([])).toBeNull();
  });
  it("checklist cuenta hecho y omitido", () => {
    expect(
      checklistProgressBps([
        { status: "DONE" },
        { status: "SKIPPED" },
        { status: "PENDING" },
        { status: "IN_PROGRESS" },
      ]),
    ).toBe(5000);
    expect(checklistProgressBps([])).toBeNull();
  });
});

describe("conflictos de inventario", () => {
  const items = [
    { id: "i1", name: "Copas", sku: "GL-1", totalQuantity: 20, maintenanceQuantity: 2 },
    { id: "i2", name: "Platos", sku: "DW-1", totalQuantity: 30, maintenanceQuantity: 0 },
  ];
  it("detecta sobre-reservas por fecha y artículo", () => {
    const conflicts = computeInventoryConflicts(items, [
      { inventoryItemId: "i1", eventId: "e1", eventTitle: "A", dateKey: "2026-10-10", quantity: 10 },
      { inventoryItemId: "i1", eventId: "e2", eventTitle: "B", dateKey: "2026-10-10", quantity: 10 },
      { inventoryItemId: "i1", eventId: "e3", eventTitle: "C", dateKey: "2026-10-11", quantity: 10 },
      { inventoryItemId: "i2", eventId: "e1", eventTitle: "A", dateKey: "2026-10-10", quantity: 30 },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      dateKey: "2026-10-10",
      itemId: "i1",
      reserved: 20,
      available: 18,
      shortage: 2,
    });
    expect(conflicts[0]!.events.map((e) => e.title)).toEqual(["A", "B"]);
  });
  it("ignora artículos desconocidos y cantidades no positivas", () => {
    expect(
      computeInventoryConflicts(items, [
        { inventoryItemId: "zz", eventId: "e1", eventTitle: "A", dateKey: "2026-10-10", quantity: 999 },
        { inventoryItemId: "i1", eventId: "e1", eventTitle: "A", dateKey: "2026-10-10", quantity: -5 },
      ]),
    ).toEqual([]);
  });
  it("mantenimiento mayor al total deja disponible en 0", () => {
    const c = computeInventoryConflicts(
      [{ id: "i3", name: "Bocina", sku: "AU-1", totalQuantity: 1, maintenanceQuantity: 3 }],
      [{ inventoryItemId: "i3", eventId: "e1", eventTitle: "A", dateKey: "2026-10-10", quantity: 1 }],
    );
    expect(c[0]).toMatchObject({ available: 0, shortage: 1 });
  });
});

describe("toRankedRows", () => {
  it("ordena descendente y omite ceros", () => {
    const rows = toRankedRows({ A: 2, B: 5 }, { A: "Alfa", B: "Beta", C: "Gamma" });
    expect(rows).toEqual([
      { key: "B", label: "Beta", value: 5 },
      { key: "A", label: "Alfa", value: 2 },
    ]);
    expect(toRankedRows({}, { A: "Alfa" }, { includeZero: true })).toHaveLength(1);
  });
});
