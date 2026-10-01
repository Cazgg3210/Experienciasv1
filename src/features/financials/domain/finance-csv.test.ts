import { describe, expect, it } from "vitest";
import { escapeCsvCell, financeCsv, FINANCE_CSV_HEADERS, type FinanceCsvRow } from "./finance-csv";

const row = (over: Partial<FinanceCsvRow> = {}): FinanceCsvRow => ({
  code: "EV-1",
  title: "Brunch de Ana",
  status: "COMPLETED",
  eventDate: new Date("2026-09-22T00:00:00Z"),
  closed: true,
  saleCents: 2_078_000,
  collectedCents: 2_078_000,
  balanceCents: 0,
  estimatedCostCents: 1_144_108,
  estimatedMarginCents: 647_271,
  estimatedMarginBps: 3613,
  actualCostCents: 1_900_000,
  actualMarginCents: -108_621,
  actualMarginBps: -606,
  ...over,
});

const opts = {
  statusLabel: (s: string) => (s === "COMPLETED" ? "Completado" : s),
  dateKey: (d: Date) => d.toISOString().slice(0, 10),
};

describe("financeCsv", () => {
  it("incluye BOM, encabezados y montos en pesos (negativos como número)", () => {
    const csv = financeCsv([row()], opts);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header, line] = csv.slice(1).split("\r\n");
    expect(header!.split(",")).toHaveLength(FINANCE_CSV_HEADERS.length);
    expect(line).toBe(
      "2026-09-22,EV-1,Brunch de Ana,Completado,Sí,20780,20780,0,11441.08,19000,Sí,6472.71,36.13,-1086.21,-6.06",
    );
  });

  it("celdas vacías cuando no hay costos reales", () => {
    const csv = financeCsv(
      [row({ actualCostCents: null, actualMarginCents: null, actualMarginBps: null, closed: false })],
      opts,
    );
    expect(csv.split("\r\n")[1]!.endsWith(",No,20780,20780,0,11441.08,,,6472.71,36.13,,")).toBe(true);
  });

  it("marca costos reales parciales", () => {
    const csv = financeCsv([row({ actualIsFinal: false })], opts);
    expect(csv.split("\r\n")[1]).toContain(",19000,No (parcial),");
  });

  it("neutraliza inyección de fórmulas en textos y escapa comillas/comas", () => {
    expect(escapeCsvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell('Brunch "VIP", CDMX')).toBe('"Brunch ""VIP"", CDMX"');
    expect(escapeCsvCell(-12.5)).toBe("-12.5");
    expect(escapeCsvCell(Number.NaN)).toBe("");
    expect(escapeCsvCell(null)).toBe("");
  });
});
