import type { ExperienceType, Occasion } from "@prisma/client";
import { EXPERIENCE_TYPE_LABELS, OCCASION_LABELS } from "@/lib/labels";
import {
  activeFilterCount,
  EXPERIENCE_TYPE_SLUGS,
  OCCASION_SLUGS,
  type CatalogFilters,
  type GuestBounds,
} from "./catalog-filters";

export type FilterOption = { value: string; label: string };

export type FacetsLike = {
  types: ExperienceType[];
  occasions: Occasion[];
  styles: Array<{ slug: string; name: string }>;
};

const TYPE_ORDER = Object.keys(EXPERIENCE_TYPE_LABELS) as ExperienceType[];
const OCCASION_ORDER = Object.keys(OCCASION_LABELS) as Occasion[];

/**
 * Opciones de los selects del catálogo: sólo valores con experiencias activas,
 * más el valor seleccionado actualmente (para que el control refleje la URL).
 */
export function buildFilterOptions(facets: FacetsLike, filters: CatalogFilters, bounds: GuestBounds) {
  const types = TYPE_ORDER.filter((t) => facets.types.includes(t) || filters.tipo === t);
  const occasions = OCCASION_ORDER.filter((o) => facets.occasions.includes(o) || filters.ocasion === o);
  const styles = [...facets.styles];
  if (filters.estilo && !styles.some((s) => s.slug === filters.estilo)) {
    styles.push({ slug: filters.estilo, name: filters.estilo });
  }

  const personasOptions: FilterOption[] = [];
  for (let n = bounds.minStandardGuests; n <= bounds.maxStandardGuests; n++) {
    personasOptions.push({ value: String(n), label: `${n} personas` });
  }
  const moreValue = String(bounds.maxStandardGuests + 1);
  personasOptions.push({ value: moreValue, label: `Más de ${bounds.maxStandardGuests}` });
  const current = filters.personas !== undefined ? String(filters.personas) : "";
  if (current && !personasOptions.some((o) => o.value === current)) {
    const extra = { value: current, label: `${current} ${filters.personas === 1 ? "persona" : "personas"}` };
    if (filters.personas! < bounds.minStandardGuests) personasOptions.unshift(extra);
    else personasOptions.push(extra);
  }

  return {
    tipo: {
      options: types.map((t) => ({ value: EXPERIENCE_TYPE_SLUGS[t], label: EXPERIENCE_TYPE_LABELS[t] })),
      value: filters.tipo ? EXPERIENCE_TYPE_SLUGS[filters.tipo] : "",
    },
    ocasion: {
      options: occasions.map((o) => ({ value: OCCASION_SLUGS[o], label: OCCASION_LABELS[o] })),
      value: filters.ocasion ? OCCASION_SLUGS[filters.ocasion] : "",
    },
    personas: { options: personasOptions, value: current },
    estilo: {
      options: styles.map((s) => ({ value: s.slug, label: s.name })),
      value: filters.estilo ?? "",
    },
    hasActiveFilters: activeFilterCount(filters) > 0,
  };
}

/** Resumen legible de los filtros activos ("Cumpleaños · 8 personas · Natural"). */
export function describeFilters(filters: CatalogFilters, styleName?: string | null): string {
  const parts: string[] = [];
  if (filters.tipo) parts.push(EXPERIENCE_TYPE_LABELS[filters.tipo]);
  if (filters.ocasion) parts.push(OCCASION_LABELS[filters.ocasion]);
  if (filters.personas !== undefined) parts.push(`${filters.personas} ${filters.personas === 1 ? "persona" : "personas"}`);
  if (filters.estilo) parts.push(styleName ?? filters.estilo);
  return parts.join(" · ");
}
