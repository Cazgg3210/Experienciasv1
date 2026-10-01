import { formatMXN } from "@/lib/money";

/** Etiqueta sugerida para un rango de presupuesto: "Hasta $15,000", "$15,000 – $20,000", "Más de $45,000". */
export function suggestBudgetLabel(minCents: number | null | undefined, maxCents: number | null | undefined): string {
  const min = typeof minCents === "number" && Number.isFinite(minCents) ? minCents : 0;
  const max = typeof maxCents === "number" && Number.isFinite(maxCents) ? maxCents : null;
  if (max == null) return min > 0 ? `Más de ${formatMXN(min)}` : "Cualquier presupuesto";
  if (min <= 0) return `Hasta ${formatMXN(max)}`;
  return `${formatMXN(min)} – ${formatMXN(max)}`;
}

/** Rango legible para listas del admin. */
export function formatBudgetRange(minCents: number, maxCents: number | null): string {
  if (maxCents == null) return `${formatMXN(minCents)} en adelante`;
  return `${formatMXN(minCents)} – ${formatMXN(maxCents)}`;
}

/** Detecta huecos o traslapes entre rangos activos (ordenados por mínimo) para avisar en el admin. */
export function budgetRangeIssues(
  ranges: ReadonlyArray<{ id: string; label: string; minCents: number; maxCents: number | null; active: boolean }>,
): string[] {
  const active = ranges.filter((r) => r.active).sort((a, b) => a.minCents - b.minCents);
  const issues: string[] = [];
  for (let i = 1; i < active.length; i++) {
    const prev = active[i - 1]!;
    const cur = active[i]!;
    if (prev.maxCents == null) {
      issues.push(`"${prev.label}" no tiene máximo pero hay rangos mayores ("${cur.label}").`);
      continue;
    }
    if (cur.minCents < prev.maxCents) issues.push(`"${prev.label}" y "${cur.label}" se traslapan.`);
    else if (cur.minCents > prev.maxCents) issues.push(`Hay un hueco entre "${prev.label}" y "${cur.label}".`);
  }
  return issues;
}
