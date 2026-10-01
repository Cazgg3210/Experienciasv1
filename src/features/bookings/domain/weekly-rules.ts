/**
 * Reglas semanales de disponibilidad (puro): normalización a 7 días y validación de horarios.
 */
export type WeeklyRule = {
  weekday: number; // 0=domingo … 6=sábado
  isOpen: boolean;
  maxEvents: number;
  earliestStart: string; // HH:mm
  latestEnd: string; // HH:mm
};

export const DEFAULT_RULE: Omit<WeeklyRule, "weekday"> = {
  isOpen: true,
  maxEvents: 2,
  earliestStart: "08:00",
  latestEnd: "21:00",
};

/** Orden de captura en la UI: lunes → domingo */
export const RULES_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Completa los días faltantes con defaults (Prisma usa los mismos) y ordena lunes→domingo. */
export function normalizeWeeklyRules(rows: WeeklyRule[]): WeeklyRule[] {
  return RULES_DISPLAY_ORDER.map((weekday) => {
    const row = rows.find((r) => r.weekday === weekday);
    return row
      ? {
          weekday,
          isOpen: row.isOpen,
          maxEvents: row.maxEvents,
          earliestStart: row.earliestStart,
          latestEnd: row.latestEnd,
        }
      : { weekday, ...DEFAULT_RULE };
  });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Errores por día (índice de weekday) — vacío si todo es válido. */
export function validateWeeklyRules(rules: WeeklyRule[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Set<number>();
  for (const r of rules) {
    if (seen.has(r.weekday)) errors[r.weekday] = "Día duplicado.";
    seen.add(r.weekday);
    if (toMinutes(r.latestEnd) <= toMinutes(r.earliestStart)) {
      errors[r.weekday] = "La hora de fin debe ser posterior a la de inicio.";
    }
    if (r.isOpen && r.maxEvents < 1) errors[r.weekday] = "Un día abierto necesita al menos 1 evento.";
  }
  if (seen.size !== 7) errors[-1] = "Deben capturarse los 7 días de la semana.";
  return errors;
}
