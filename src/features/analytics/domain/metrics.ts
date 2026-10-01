/**
 * Métricas de negocio — dominio PURO (sin I/O): KPIs, embudo, periodos, conflictos de inventario.
 */
import { dateOnly, localDateKey, zonedDateTime } from "@/lib/dates";

const DAY_MS = 86_400_000;

// ============================================================================
// Variaciones y tasas
// ============================================================================

/** Variación porcentual en bps (current vs previous). null si no hay base de comparación. */
export function changeBps(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 10_000);
}

/** Tasa (numerador / denominador) en bps; null si denominador = 0. */
export function rateBps(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000);
}

export function formatPercentBps(bps: number | null | undefined, digits = 0): string {
  if (bps == null || Number.isNaN(bps)) return "—";
  return `${(bps / 100).toFixed(digits)}%`;
}

/** "+12%" / "−8%" / "sin cambio" para pistas de KPIs. */
export function formatChange(bps: number | null): string {
  if (bps == null) return "sin periodo previo";
  if (bps === 0) return "sin cambio";
  const sign = bps > 0 ? "+" : "−";
  return `${sign}${Math.abs(Math.round(bps / 100))}%`;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

// ============================================================================
// Embudo de conversión
// ============================================================================

export const FUNNEL_STEPS = [
  "VIEW_EXPERIENCE",
  "START_CONFIGURATOR",
  "COMPLETE_CONFIGURATOR",
  "SUBMIT_LEAD",
  "VIEW_QUOTE",
  "ACCEPT_QUOTE",
  "START_PAYMENT",
  "PAYMENT_SUCCESS",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const ANALYTICS_EVENT_LABELS = {
  VIEW_EXPERIENCE: "Vio una experiencia",
  START_CONFIGURATOR: "Inició el configurador",
  COMPLETE_CONFIGURATOR: "Completó el configurador",
  SUBMIT_LEAD: "Envió su solicitud",
  VIEW_QUOTE: "Abrió su cotización",
  ACCEPT_QUOTE: "Aceptó la cotización",
  START_PAYMENT: "Inició el pago",
  PAYMENT_SUCCESS: "Pago exitoso",
  RSVP_SUBMIT: "RSVP enviados",
  AI_DESIGN_GENERATED: "Diseños con IA",
} as const;

export type FunnelRow = {
  step: FunnelStep;
  label: string;
  count: number;
  /** Conversión contra el paso anterior (bps); null en el primer paso o si el anterior es 0. */
  stepRateBps: number | null;
  /** Conversión acumulada contra el primer paso (bps). */
  overallRateBps: number | null;
};

export function isFunnelStep(value: string): value is FunnelStep {
  return (FUNNEL_STEPS as readonly string[]).includes(value);
}

/** Fila agregada de AnalyticsEvent (groupBy por tipo + identificadores). */
export type FunnelGroupRow = {
  type: string;
  sessionId: string | null;
  leadId: string | null;
  quoteId: string | null;
  eventId: string | null;
  count: number;
};

type FunnelKeyField = "sessionId" | "leadId" | "quoteId" | "eventId";

/**
 * Qué identifica a "una persona/un caso" en cada etapa (en orden de preferencia).
 * Así el embudo cuenta recorridos únicos y no eventos crudos: una visita que ve 3 experiencias,
 * o una reserva con anticipo + saldo (2 pagos), cuentan una sola vez.
 */
export const FUNNEL_UNIQUE_KEYS: Record<FunnelStep, FunnelKeyField[]> = {
  VIEW_EXPERIENCE: ["sessionId"],
  START_CONFIGURATOR: ["sessionId"],
  COMPLETE_CONFIGURATOR: ["sessionId"],
  SUBMIT_LEAD: ["leadId", "sessionId"],
  VIEW_QUOTE: ["quoteId", "sessionId"],
  ACCEPT_QUOTE: ["quoteId", "eventId"],
  START_PAYMENT: ["quoteId", "eventId"],
  PAYMENT_SUCCESS: ["quoteId", "eventId"],
};

/**
 * Conteos únicos por etapa del embudo. Los registros sin ningún identificador
 * (p. ej. vistas sin sesión) cuentan uno por uno.
 */
export function uniqueFunnelCounts(rows: FunnelGroupRow[]): Record<FunnelStep, number> {
  const seen = new Map<FunnelStep, Set<string>>();
  const anonymous = new Map<FunnelStep, number>();
  for (const r of rows) {
    if (!isFunnelStep(r.type) || r.count <= 0) continue;
    const field = FUNNEL_UNIQUE_KEYS[r.type].find((f) => !!r[f]);
    if (!field) {
      anonymous.set(r.type, (anonymous.get(r.type) ?? 0) + r.count);
      continue;
    }
    let set = seen.get(r.type);
    if (!set) {
      set = new Set();
      seen.set(r.type, set);
    }
    set.add(`${field}:${r[field]}`);
  }
  const out = {} as Record<FunnelStep, number>;
  for (const step of FUNNEL_STEPS) out[step] = (seen.get(step)?.size ?? 0) + (anonymous.get(step) ?? 0);
  return out;
}

export function buildFunnel(counts: Partial<Record<string, number>>): FunnelRow[] {
  const first = counts[FUNNEL_STEPS[0]] ?? 0;
  return FUNNEL_STEPS.map((step, i) => {
    const count = counts[step] ?? 0;
    const prev = i > 0 ? (counts[FUNNEL_STEPS[i - 1]!] ?? 0) : null;
    return {
      step,
      label: ANALYTICS_EVENT_LABELS[step],
      count,
      stepRateBps: prev == null ? null : rateBps(count, prev),
      overallRateBps: i === 0 ? (first > 0 ? 10_000 : null) : rateBps(count, first),
    };
  });
}

// ============================================================================
// Rangos y periodos (zona de negocio CDMX)
// ============================================================================

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRangeDays(value: string | string[] | undefined, fallback: RangeDays = 30): RangeDays {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  return (RANGE_OPTIONS as readonly number[]).includes(raw) ? (raw as RangeDays) : fallback;
}

/** Ventana [from, to) de N días que termina ahora, y la ventana inmediata anterior. */
export function rollingWindow(days: number, now: Date = new Date()) {
  const to = now;
  const from = new Date(now.getTime() - days * DAY_MS);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  return { from, to, prevFrom, prevTo: from };
}

export type MonthBucket = {
  /** YYYY-MM */
  key: string;
  /** "oct 2026" */
  label: string;
  /** Inicio del mes en CDMX (instante UTC) */
  start: Date;
  /** Inicio del mes siguiente en CDMX */
  end: Date;
  /** Inicio/fin como columnas @db.Date */
  startDate: Date;
  endDate: Date;
};

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function isValidMonthKey(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthBucket(key: string): MonthBucket {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const next = shiftMonthKey(key, 1);
  return {
    key,
    label: `${MONTH_SHORT[m - 1]} ${y}`,
    start: zonedDateTime(`${key}-01`, "00:00"),
    end: zonedDateTime(`${next}-01`, "00:00"),
    startDate: dateOnly(`${key}-01`),
    endDate: dateOnly(`${next}-01`),
  };
}

export function monthLongLabel(key: string): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const name = MONTH_LONG[m - 1] ?? key;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** YYYY-MM del mes actual en CDMX */
export function currentMonthKey(now: Date = new Date()): string {
  return localDateKey(now).slice(0, 7);
}

/** Desplaza una clave YYYY-MM por N meses (aritmética entera, sin zonas horarias). */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Últimos N meses (incluye el actual), del más antiguo al más reciente. */
export function lastMonths(n: number, now: Date = new Date()): MonthBucket[] {
  const current = currentMonthKey(now);
  const out: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthBucket(shiftMonthKey(current, -i)));
  return out;
}

/** Meses alrededor de hoy (pasados y futuros) para filtros, del más reciente al más antiguo. */
export function monthOptions(
  past: number,
  future: number,
  now: Date = new Date(),
): Array<{ value: string; label: string }> {
  const current = currentMonthKey(now);
  const out: Array<{ value: string; label: string }> = [];
  for (let i = future; i >= -past; i--) {
    const key = shiftMonthKey(current, i);
    out.push({ value: key, label: monthLongLabel(key) });
  }
  return out;
}

/** Ventana de días calendario CDMX [hoy, hoy+N] como columnas @db.Date (fin exclusivo). */
export function dateWindow(daysAhead: number, now: Date = new Date()) {
  const todayKey = localDateKey(now);
  const start = dateOnly(todayKey);
  return { todayKey, start, end: new Date(start.getTime() + (daysAhead + 1) * DAY_MS) };
}

// ============================================================================
// Progreso de evento
// ============================================================================

/** % de respuestas RSVP (no pendientes) en bps; null si no hay invitadas. */
export function rsvpProgressBps(guests: Array<{ rsvpStatus: string }>): number | null {
  if (guests.length === 0) return null;
  const responded = guests.filter((g) => g.rsvpStatus !== "PENDING").length;
  return rateBps(responded, guests.length);
}

/** % de RSVP pendientes en bps; null si no hay invitadas. */
export function rsvpPendingBps(guests: Array<{ rsvpStatus: string }>): number | null {
  if (guests.length === 0) return null;
  return rateBps(guests.filter((g) => g.rsvpStatus === "PENDING").length, guests.length);
}

/** % de checklist resuelto (hecho u omitido) en bps; null si no hay tareas. */
export function checklistProgressBps(items: Array<{ status: string }>): number | null {
  if (items.length === 0) return null;
  return rateBps(items.filter((i) => i.status === "DONE" || i.status === "SKIPPED").length, items.length);
}

// ============================================================================
// Conflictos de inventario
// ============================================================================

export type InventoryItemLite = {
  id: string;
  name: string;
  sku: string;
  totalQuantity: number;
  maintenanceQuantity: number;
};

export type ReservationLite = {
  inventoryItemId: string;
  eventId: string;
  eventTitle: string;
  dateKey: string;
  quantity: number;
};

export type InventoryConflict = {
  dateKey: string;
  itemId: string;
  itemName: string;
  sku: string;
  reserved: number;
  available: number;
  shortage: number;
  events: Array<{ id: string; title: string; quantity: number }>;
};

/**
 * Para cada fecha y artículo suma lo reservado por eventos (no cancelados) y lo compara con
 * lo disponible (total − mantenimiento). Devuelve sólo los sobre-comprometidos.
 */
export function computeInventoryConflicts(
  items: InventoryItemLite[],
  reservations: ReservationLite[],
): InventoryConflict[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups = new Map<string, InventoryConflict>();
  for (const r of reservations) {
    const item = byId.get(r.inventoryItemId);
    if (!item || r.quantity <= 0) continue;
    const key = `${r.dateKey}|${item.id}`;
    let g = groups.get(key);
    if (!g) {
      const available = Math.max(0, item.totalQuantity - item.maintenanceQuantity);
      g = {
        dateKey: r.dateKey,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        reserved: 0,
        available,
        shortage: 0,
        events: [],
      };
      groups.set(key, g);
    }
    g.reserved += r.quantity;
    const existing = g.events.find((e) => e.id === r.eventId);
    if (existing) existing.quantity += r.quantity;
    else g.events.push({ id: r.eventId, title: r.eventTitle, quantity: r.quantity });
  }
  return [...groups.values()]
    .map((g) => ({ ...g, shortage: g.reserved - g.available }))
    .filter((g) => g.shortage > 0)
    .sort(
      (a, b) =>
        a.dateKey.localeCompare(b.dateKey) || b.shortage - a.shortage || a.itemName.localeCompare(b.itemName),
    );
}

// ============================================================================
// Agrupaciones genéricas
// ============================================================================

/** Ordena un conteo { clave: n } en filas descendentes con etiqueta. */
export function toRankedRows<K extends string>(
  counts: Partial<Record<K, number>>,
  labels: Record<K, string>,
  opts: { includeZero?: boolean } = {},
): Array<{ key: K; label: string; value: number }> {
  const keys = Object.keys(labels) as K[];
  return keys
    .map((key) => ({ key, label: labels[key], value: counts[key] ?? 0 }))
    .filter((r) => opts.includeZero || r.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
