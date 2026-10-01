import type { ExperienceType, Occasion, Prisma } from "@prisma/client";

/**
 * Filtros del catálogo público (/experiencias) vía GET searchParams.
 * Lógica pura: parseo tolerante de la URL → filtros normalizados → `where` de Prisma.
 * URLs legibles en español: ?tipo=brunch&ocasion=cumpleanos&personas=8&estilo=natural
 */

export const EXPERIENCE_TYPE_SLUGS: Record<ExperienceType, string> = {
  BRUNCH: "brunch",
  BREAKFAST: "desayuno",
  CELEBRATION: "celebracion",
  THEMED: "tematica",
};

export const OCCASION_SLUGS: Record<Occasion, string> = {
  BIRTHDAY: "cumpleanos",
  FRIENDS_BRUNCH: "brunch-entre-amigas",
  BACHELORETTE: "despedida",
  BRIDAL: "bridal",
  BABY_BRUNCH: "baby-brunch",
  GATHERING: "reunion",
  CORPORATE: "corporativo",
  OTHER: "otra",
};

export type CatalogFilters = {
  tipo?: ExperienceType;
  ocasion?: Occasion;
  personas?: number;
  estilo?: string;
};

export type GuestBounds = { minStandardGuests: number; maxStandardGuests: number };

export const DEFAULT_GUEST_BOUNDS: GuestBounds = { minStandardGuests: 6, maxStandardGuests: 12 };

/** Máximo aceptado en la URL (evita valores absurdos). */
export const MAX_PERSONAS_PARAM = 200;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function fromSlugOrEnum<K extends string>(map: Record<K, string>, raw: string | undefined): K | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  for (const key of Object.keys(map) as K[]) {
    if (map[key] === value || key.toLowerCase() === value) return key;
  }
  return undefined;
}

const STYLE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Parsea searchParams (tolerante: ignora valores inválidos en lugar de fallar). */
export function parseCatalogFilters(params: RawParams): CatalogFilters {
  const filters: CatalogFilters = {};
  const tipo = fromSlugOrEnum(EXPERIENCE_TYPE_SLUGS, first(params.tipo));
  if (tipo) filters.tipo = tipo;
  const ocasion = fromSlugOrEnum(OCCASION_SLUGS, first(params.ocasion));
  if (ocasion) filters.ocasion = ocasion;

  const personasRaw = first(params.personas);
  if (personasRaw && /^\d{1,4}$/.test(personasRaw)) {
    const n = Number(personasRaw);
    if (n >= 1 && n <= MAX_PERSONAS_PARAM) filters.personas = n;
  }

  const estilo = first(params.estilo)?.toLowerCase();
  if (estilo && estilo.length <= 60 && STYLE_SLUG_RE.test(estilo)) filters.estilo = estilo;
  return filters;
}

/** Grupo mayor al estándar (p. ej. > 12): se muestra la nota de "consulta especial". */
export function isSpecialGroup(personas: number | undefined, bounds: GuestBounds = DEFAULT_GUEST_BOUNDS): boolean {
  return personas !== undefined && personas > bounds.maxStandardGuests;
}

/** Grupo menor al mínimo estándar (p. ej. < 6). */
export function isSmallGroup(personas: number | undefined, bounds: GuestBounds = DEFAULT_GUEST_BOUNDS): boolean {
  return personas !== undefined && personas < bounds.minStandardGuests;
}

/**
 * Construye el `where` de Prisma para el catálogo público.
 * - Siempre sólo experiencias activas.
 * - personas ≤ máximo estándar: minGuests ≤ n ≤ maxGuests.
 * - personas > máximo estándar (consulta especial): se muestran las experiencias que admiten
 *   al menos ese mínimo (minGuests ≤ n), porque se adaptan bajo propuesta especial.
 */
export function buildCatalogWhere(
  filters: CatalogFilters,
  bounds: GuestBounds = DEFAULT_GUEST_BOUNDS,
): Prisma.ExperienceWhereInput {
  const and: Prisma.ExperienceWhereInput[] = [{ active: true }];
  if (filters.tipo) and.push({ type: filters.tipo });
  if (filters.ocasion) and.push({ occasions: { has: filters.ocasion } });
  if (filters.personas !== undefined) {
    const n = filters.personas;
    if (isSpecialGroup(n, bounds)) {
      and.push({ minGuests: { lte: n } });
    } else {
      and.push({ minGuests: { lte: n } }, { maxGuests: { gte: n } });
    }
  }
  if (filters.estilo) and.push({ styles: { some: { slug: filters.estilo, active: true } } });
  return and.length === 1 ? and[0]! : { AND: and };
}

/** Orden estándar del catálogo: destacadas primero, luego orden editorial. */
export const CATALOG_ORDER_BY: Prisma.ExperienceOrderByWithRelationInput[] = [
  { featured: "desc" },
  { sortOrder: "asc" },
  { name: "asc" },
];

/** Cuántos filtros están activos (para "Limpiar filtros" y textos). */
export function activeFilterCount(filters: CatalogFilters): number {
  return [filters.tipo, filters.ocasion, filters.personas, filters.estilo].filter((v) => v !== undefined).length;
}

/** Serializa filtros a query string canónico (slugs en español). */
export function catalogFiltersToQuery(filters: CatalogFilters): string {
  const qs = new URLSearchParams();
  if (filters.tipo) qs.set("tipo", EXPERIENCE_TYPE_SLUGS[filters.tipo]);
  if (filters.ocasion) qs.set("ocasion", OCCASION_SLUGS[filters.ocasion]);
  if (filters.personas !== undefined) qs.set("personas", String(filters.personas));
  if (filters.estilo) qs.set("estilo", filters.estilo);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Clave estable para cachear resultados por combinación de filtros. */
export function catalogCacheKey(filters: CatalogFilters): string {
  return catalogFiltersToQuery(filters) || "all";
}
