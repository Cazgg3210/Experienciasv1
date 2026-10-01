/**
 * Exportación CSV de finanzas (puro). RFC 4180 + BOM para Excel.
 * Los textos se neutralizan contra inyección de fórmulas (=, +, -, @ al inicio);
 * los números se escriben tal cual (un número negativo NO es una fórmula), en pesos con 2 decimales.
 */

export type FinanceCsvRow = {
  code: string;
  title: string;
  status: string;
  eventDate: Date;
  closed: boolean;
  saleCents: number;
  collectedCents: number;
  balanceCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  estimatedMarginBps: number | null;
  actualCostCents: number | null;
  actualMarginCents: number | null;
  actualMarginBps: number | null;
  /** Costo real definitivo (evento completado/cerrado) o parcial */
  actualIsFinal?: boolean;
};

type Cell = string | number | null | undefined;

export const FINANCE_CSV_HEADERS = [
  "Fecha",
  "Código",
  "Evento",
  "Estado",
  "Cerrado",
  "Venta (MXN)",
  "Cobrado (MXN)",
  "Saldo (MXN)",
  "Costo estimado (MXN)",
  "Costo real (MXN)",
  "Costo real definitivo",
  "Margen estimado (MXN)",
  "Margen estimado (%)",
  "Margen real (MXN)",
  "Margen real (%)",
];

export function escapeCsvCell(value: Cell): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function centsToPesosNumber(cents: number | null): number | null {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

export function bpsToPercentNumber(bps: number | null): number | null {
  if (bps == null) return null;
  return Math.round(bps) / 100;
}

export function financeCsv(
  rows: FinanceCsvRow[],
  opts: { statusLabel: (status: string) => string; dateKey: (d: Date) => string },
): string {
  const lines: string[] = [FINANCE_CSV_HEADERS.map(escapeCsvCell).join(",")];
  for (const r of rows) {
    const cells: Cell[] = [
      opts.dateKey(r.eventDate),
      r.code,
      r.title,
      opts.statusLabel(r.status),
      r.closed ? "Sí" : "No",
      centsToPesosNumber(r.saleCents),
      centsToPesosNumber(r.collectedCents),
      centsToPesosNumber(r.balanceCents),
      centsToPesosNumber(r.estimatedCostCents),
      centsToPesosNumber(r.actualCostCents),
      r.actualCostCents == null ? "" : r.actualIsFinal === false ? "No (parcial)" : "Sí",
      centsToPesosNumber(r.estimatedMarginCents),
      bpsToPercentNumber(r.estimatedMarginBps),
      centsToPesosNumber(r.actualMarginCents),
      bpsToPercentNumber(r.actualMarginBps),
    ];
    lines.push(cells.map(escapeCsvCell).join(","));
  }
  return String.fromCharCode(0xfeff) + lines.join("\r\n");
}
