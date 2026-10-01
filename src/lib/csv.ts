/** Serializa filas a CSV (RFC 4180) con BOM para Excel. Neutraliza inyección de fórmulas. */
export function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const escape = (value: string | number | boolean | null | undefined): string => {
    if (value == null) return "";
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return "﻿" + lines.join("\r\n");
}
