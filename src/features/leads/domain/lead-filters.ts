/**
 * Filtros del CRM de leads (lógica pura, sin I/O).
 * Fuente única para: la tabla/kanban de /admin/leads, la exportación CSV y las pruebas.
 */
import type { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { dateOnly, isValidDateKey, toDateKey, zonedDateTime } from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

export const LEAD_STATUS_VALUES = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"] as const satisfies readonly LeadStatus[];

export const LEAD_SOURCE_VALUES = [
  "CONFIGURATOR",
  "AI_DESIGNER",
  "CONTACT_FORM",
  "WHATSAPP",
  "INSTAGRAM",
  "TIKTOK",
  "REFERRAL",
  "GOOGLE",
  "MANUAL",
  "OTHER",
] as const satisfies readonly LeadSource[];

export const LEAD_SORT_VALUES = ["created_desc", "created_asc", "event_asc", "event_desc"] as const;
export type LeadSort = (typeof LEAD_SORT_VALUES)[number];

export const LEAD_SORT_LABELS: Record<LeadSort, string> = {
  created_desc: "Más recientes",
  created_asc: "Más antiguos",
  event_asc: "Fecha del evento (próximos primero)",
  event_desc: "Fecha del evento (lejanos primero)",
};

export const LEAD_FLAG_VALUES = ["outOfArea", "special"] as const;
export type LeadFlag = (typeof LEAD_FLAG_VALUES)[number];

export const LEAD_FLAG_LABELS: Record<LeadFlag, string> = {
  outOfArea: "Fuera de cobertura",
  special: "Consulta especial",
};

export const LEAD_DATE_FIELDS = ["event", "created"] as const;
export type LeadDateField = (typeof LEAD_DATE_FIELDS)[number];

export const LEAD_DATE_FIELD_LABELS: Record<LeadDateField, string> = {
  event: "Fecha del evento",
  created: "Fecha de registro",
};

/** Valor especial del filtro "asignada a" para leads sin responsable. */
export const UNASSIGNED = "none";

export type LeadFilters = {
  statuses: LeadStatus[];
  source: LeadSource | null;
  /** id de usuario, "none" (sin asignar) o null (todas) */
  assignedTo: string | null;
  q: string | null;
  dateField: LeadDateField;
  from: string | null;
  to: string | null;
  flags: LeadFlag[];
  sort: LeadSort;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  statuses: [],
  source: null,
  assignedTo: null,
  q: null,
  dateField: "event",
  from: null,
  to: null,
  flags: [],
  sort: "created_desc",
};

/** Todos los valores de un parámetro (repetido o separado por comas). */
function values(sp: RawSearchParams, key: string): string[] {
  const raw = sp[key];
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return list
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function first(sp: RawSearchParams, key: string): string | null {
  return values(sp, key)[0] ?? null;
}

function oneOf<T extends string>(list: readonly T[], value: string | null | undefined): T | null {
  return value != null && (list as readonly string[]).includes(value) ? (value as T) : null;
}

function unique<T>(list: T[]): T[] {
  return [...new Set(list)];
}

const ID_RE = /^[a-z0-9_-]{1,64}$/i;

/** Convierte searchParams (no confiables) en filtros válidos. Nunca lanza. */
export function parseLeadFilters(sp: RawSearchParams): LeadFilters {
  const statuses = unique(
    values(sp, "status")
      .map((s) => oneOf(LEAD_STATUS_VALUES, s.toUpperCase()))
      .filter((s): s is LeadStatus => s != null),
  );
  const flags = unique(
    values(sp, "flag")
      .map((f) => oneOf(LEAD_FLAG_VALUES, f))
      .filter((f): f is LeadFlag => f != null),
  );
  const assigned = first(sp, "assignedTo");
  const qRaw = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  let from = first(sp, "from");
  let to = first(sp, "to");
  if (from && !isValidDateKey(from)) from = null;
  if (to && !isValidDateKey(to)) to = null;
  if (from && to && from > to) [from, to] = [to, from];

  return {
    statuses,
    source: oneOf(LEAD_SOURCE_VALUES, first(sp, "source")?.toUpperCase()),
    assignedTo: assigned && (assigned === UNASSIGNED || ID_RE.test(assigned)) ? assigned : null,
    q: qRaw ? qRaw.slice(0, 100) : null,
    dateField: oneOf(LEAD_DATE_FIELDS, first(sp, "dateField")) ?? "event",
    from,
    to,
    flags,
    sort: oneOf(LEAD_SORT_VALUES, first(sp, "sort")) ?? "created_desc",
  };
}

/** Serializa filtros a querystring (para paginación, kanban, CSV). Omite valores por defecto. */
export function leadFiltersToSearchParams(
  filters: LeadFilters,
  extra: Record<string, string | null | undefined> = {},
): URLSearchParams {
  const params = new URLSearchParams();
  for (const s of filters.statuses) params.append("status", s);
  if (filters.source) params.set("source", filters.source);
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  if (filters.q) params.set("q", filters.q);
  if (filters.from || filters.to) {
    if (filters.dateField !== "event") params.set("dateField", filters.dateField);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  for (const f of filters.flags) params.append("flag", f);
  if (filters.sort !== "created_desc") params.set("sort", filters.sort);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  return params;
}

/** Cuántos filtros (además de la búsqueda) están activos. */
export function activeFilterCount(filters: LeadFilters): number {
  return (
    (filters.statuses.length ? 1 : 0) +
    (filters.source ? 1 : 0) +
    (filters.assignedTo ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0) +
    filters.flags.length
  );
}

export function hasAnyFilter(filters: LeadFilters): boolean {
  return activeFilterCount(filters) > 0 || !!filters.q;
}

/** Agrega o quita un estado de la selección (chips del resumen). */
export function toggleStatus(filters: LeadFilters, status: LeadStatus): LeadFilters {
  const statuses = filters.statuses.includes(status)
    ? filters.statuses.filter((s) => s !== status)
    : [...filters.statuses, status];
  return { ...filters, statuses };
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** where de Prisma para los filtros. `ignoreStatus` sirve para los conteos por estado. */
export function buildLeadWhere(filters: LeadFilters, opts: { ignoreStatus?: boolean } = {}): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];

  if (!opts.ignoreStatus && filters.statuses.length) and.push({ status: { in: filters.statuses } });
  if (filters.source) and.push({ source: filters.source });
  if (filters.assignedTo === UNASSIGNED) and.push({ assignedToId: null });
  else if (filters.assignedTo) and.push({ assignedToId: filters.assignedTo });

  if (filters.q) {
    const q = filters.q;
    const or: Prisma.LeadWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
    const digits = digitsOf(q);
    if (digits.length >= 4 && digits !== q) or.push({ phone: { contains: digits } });
    and.push({ OR: or });
  }

  if (filters.from || filters.to) {
    if (filters.dateField === "event") {
      const range: Prisma.DateTimeNullableFilter = {};
      if (filters.from) range.gte = dateOnly(filters.from);
      if (filters.to) range.lte = dateOnly(filters.to);
      and.push({ eventDate: range });
    } else {
      const range: Prisma.DateTimeFilter = {};
      if (filters.from) range.gte = zonedDateTime(filters.from, "00:00");
      // Día siguiente calculado en UTC puro (independiente de la zona/DST del proceso)
      if (filters.to) range.lt = zonedDateTime(toDateKey(new Date(dateOnly(filters.to).getTime() + DAY_MS)), "00:00");
      and.push({ createdAt: range });
    }
  }

  if (filters.flags.includes("outOfArea")) and.push({ outOfArea: true });
  if (filters.flags.includes("special")) and.push({ specialRequest: true });

  return and.length ? { AND: and } : {};
}

export function buildLeadOrderBy(sort: LeadSort): Prisma.LeadOrderByWithRelationInput[] {
  switch (sort) {
    case "created_asc":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "event_asc":
      return [{ eventDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }];
    case "event_desc":
      return [{ eventDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }];
    case "created_desc":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}
