/**
 * Filtros del listado de eventos a partir de searchParams (puro, tolerante a basura en la URL).
 */
import type { EventStatus } from "./event-status";
import { isValidDateKey } from "@/lib/dates";

export const EVENT_STATUSES: EventStatus[] = [
  "INQUIRY",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PLANNING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export type EventPeriod = "upcoming" | "past" | "all";

export const EVENT_PERIOD_LABELS: Record<EventPeriod, string> = {
  upcoming: "Próximos",
  past: "Pasados",
  all: "Todos",
};

export type EventFilters = {
  statuses: EventStatus[];
  period: EventPeriod;
  from: string | null;
  to: string | null;
  experienceId: string | null;
  serviceAreaId: string | null;
  q: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

const ID_RE = /^[a-z0-9_-]{8,40}$/i;

export function parseEventFilters(params: RawParams): EventFilters {
  const statuses = Array.from(
    new Set(all(params.status).filter((s): s is EventStatus => (EVENT_STATUSES as string[]).includes(s))),
  );
  const periodRaw = first(params.period);
  const period: EventPeriod = periodRaw === "past" || periodRaw === "all" ? periodRaw : "upcoming";
  const from = first(params.from);
  const to = first(params.to);
  const experienceId = first(params.experience);
  const serviceAreaId = first(params.zone);
  const q = first(params.q)?.trim().slice(0, 80);
  return {
    statuses,
    period,
    from: from && isValidDateKey(from) ? from : null,
    to: to && isValidDateKey(to) ? to : null,
    experienceId: experienceId && ID_RE.test(experienceId) ? experienceId : null,
    serviceAreaId: serviceAreaId && ID_RE.test(serviceAreaId) ? serviceAreaId : null,
    q: q ? q : null,
  };
}

/**
 * Rango de fechas efectivo (YYYY-MM-DD, inclusivo) combinando periodo y rango explícito.
 * "Próximos" = desde hoy; "Pasados" = hasta ayer. El rango explícito restringe aún más.
 */
export function effectiveDateRange(
  filters: Pick<EventFilters, "period" | "from" | "to">,
  todayKey: string,
  yesterdayKey: string,
): { gte: string | null; lte: string | null } {
  let gte = filters.from;
  let lte = filters.to;
  if (filters.period === "upcoming") gte = !gte || gte < todayKey ? todayKey : gte;
  if (filters.period === "past") lte = !lte || lte > yesterdayKey ? yesterdayKey : lte;
  return { gte, lte };
}

/** Orden por defecto: próximos ascendente (lo más cercano primero); pasados/todos descendente. */
export function sortDirection(period: EventPeriod): "asc" | "desc" {
  return period === "upcoming" ? "asc" : "desc";
}

/** ¿Hay algún filtro activo además del periodo por defecto? */
export function hasActiveFilters(filters: EventFilters): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.period !== "upcoming" ||
    !!filters.from ||
    !!filters.to ||
    !!filters.experienceId ||
    !!filters.serviceAreaId ||
    !!filters.q
  );
}
