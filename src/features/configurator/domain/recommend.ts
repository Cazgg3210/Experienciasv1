/**
 * Recomendación pura de experiencias para el configurador: ordena por compatibilidad con
 * la ocasión, el estilo y el número de invitadas. Las compatibles van primero ("Recomendada");
 * las demás siguen disponibles debajo.
 */

export type RecommendableExperience = {
  id: string;
  name: string;
  occasions: readonly string[];
  styleIds: readonly string[];
  minGuests: number;
  maxGuests: number;
  featured?: boolean;
  sortOrder?: number;
};

export type RecommendCriteria = {
  occasion?: string | null;
  styleId?: string | null;
  guestCount?: number | null;
};

export type RecommendMatch = {
  /** null = criterio no especificado (o "otra" ocasión) */
  occasion: boolean | null;
  style: boolean | null;
  guests: boolean | null;
};

export type RankedExperience<T> = {
  experience: T;
  score: number;
  match: RecommendMatch;
  /** Coincide con todos los criterios especificados (o es la mejor opción si ninguna coincide) */
  recommended: boolean;
};

const WEIGHTS = { occasion: 4, style: 3, guests: 2, featured: 0.5 } as const;

export function matchExperience(exp: RecommendableExperience, c: RecommendCriteria): RecommendMatch {
  const occasion = c.occasion && c.occasion !== "OTHER" ? exp.occasions.includes(c.occasion) : null;
  const style = c.styleId ? exp.styleIds.includes(c.styleId) : null;
  const guests =
    typeof c.guestCount === "number" && c.guestCount > 0
      ? c.guestCount >= exp.minGuests && c.guestCount <= exp.maxGuests
      : null;
  return { occasion, style, guests };
}

export function scoreExperience(exp: RecommendableExperience, c: RecommendCriteria): number {
  const m = matchExperience(exp, c);
  let score = 0;
  if (m.occasion) score += WEIGHTS.occasion;
  if (m.style) score += WEIGHTS.style;
  if (m.guests) score += WEIGHTS.guests;
  if (exp.featured) score += WEIGHTS.featured;
  return score;
}

function isFullMatch(m: RecommendMatch): boolean {
  const specified = [m.occasion, m.style, m.guests].filter((v) => v !== null);
  return specified.length > 0 && specified.every(Boolean);
}

/**
 * Ordena experiencias: recomendadas primero (por puntaje), luego el resto (por puntaje),
 * desempatando por orden del catálogo y nombre. Si ninguna coincide en todo, la de mayor
 * puntaje (con al menos una coincidencia) se marca como recomendada.
 */
export function rankExperiences<T extends RecommendableExperience>(
  list: readonly T[],
  criteria: RecommendCriteria,
): RankedExperience<T>[] {
  const ranked = list.map((experience) => {
    const match = matchExperience(experience, criteria);
    return {
      experience,
      match,
      score: scoreExperience(experience, criteria),
      recommended: isFullMatch(match),
    };
  });

  if (!ranked.some((r) => r.recommended)) {
    const best = [...ranked].sort(compare)[0];
    const hasAnyMatch = best && (best.match.occasion || best.match.style || best.match.guests);
    if (best && hasAnyMatch) best.recommended = true;
  }

  return ranked.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return compare(a, b);
  });
}

function compare<T extends RecommendableExperience>(a: RankedExperience<T>, b: RankedExperience<T>): number {
  if (b.score !== a.score) return b.score - a.score;
  const so = (a.experience.sortOrder ?? 0) - (b.experience.sortOrder ?? 0);
  if (so !== 0) return so;
  return a.experience.name.localeCompare(b.experience.name, "es");
}
