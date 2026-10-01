/**
 * Motor de reglas del AI Experience Designer — PURO y determinista (sin I/O).
 *
 * Convierte un brief difuso en una propuesta vendible usando SÓLO el catálogo real:
 *  1. Puntúa experiencias (ocasión, rango de invitadas, afinidad de vibras/gustos, presupuesto).
 *  2. Elige estilo (vibras + colores), menú (restricciones alimentarias + gustos) y add-ons
 *     (afinidad vibra→categoría, ocasión, gustos) cuidando el presupuesto.
 *  3. Redacta nombre, concepto, descripción, actividades, mesa y playlist con plantillas curadas.
 *
 * Los totales que calcula aquí sólo sirven para AJUSTAR la propuesta al presupuesto (usa el
 * QuoteEngine puro); el precio que ve la clienta siempre sale de estimateSelection en servidor.
 */
import type { DietaryRestriction, Occasion } from "@prisma/client";
import { calculateQuote } from "@/features/quotes/domain/quote-engine";
import { BUDGET_UNKNOWN, COLOR_PRESETS, OTHER_AREA, VIBE_VALUES, type Vibe } from "../constants";
import type { DesignerInput } from "../schemas";
import { buildPalette, minDistance, normalizeHex } from "./palette";
import {
  CLOSINGS,
  DEFAULT_TABLE,
  DIETARY_PHRASES,
  FEATURE_ACTIVITIES,
  MEAT_WORDS,
  MUSIC_KEYWORDS,
  NAME_PATTERNS,
  NO_ADDONS_SENTENCES,
  NUT_WORDS,
  OCCASION_ACTIVITIES,
  OCCASION_ADDON_KEYWORDS,
  OCCASION_TEXT,
  SEAFOOD_WORDS,
  STYLE_TABLE,
  VIBE_ACTIVITIES,
  VIBE_ADDON_CATEGORY,
  VIBE_ADDON_KEYWORDS,
  VIBE_ADJECTIVE,
  VIBE_CONCEPT,
  VIBE_OPENERS,
  VIBE_KEYWORDS,
  VIBE_MENU_TAGS,
  VIBE_PLAYLIST,
  VIBE_STYLE_SLUGS,
  VIBE_TABLE_DETAIL,
} from "./templates";
import {
  capitalize,
  countGroupHits,
  countStemHits,
  hashString,
  joinEs,
  normalize,
  pick,
  tasteStems,
  truncate,
} from "./text";
import type {
  BudgetFit,
  CatalogAddOn,
  CatalogArea,
  CatalogBudget,
  CatalogExperience,
  CatalogMenu,
  CatalogStyle,
  DesignerCatalog,
  DesignProposal,
  DesignSelection,
  PaletteColor,
  RulesDesignResult,
} from "./types";

export class DesignerCatalogError extends Error {
  constructor(message = "No hay experiencias activas en el catálogo.") {
    super(message);
    this.name = "DesignerCatalogError";
  }
}

/** Puntaje mínimo para que un add-on se sugiera. */
export const MIN_ADDON_SCORE = 6;

/** Restricciones que un menú puede "cubrir" con sus dietaryTags. */
const COVERABLE: DietaryRestriction[] = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "KOSHER",
  "HALAL",
];

export type DesignerContext = {
  input: DesignerInput;
  catalog: DesignerCatalog;
  seed: string;
  stems: string[][];
  vibes: Vibe[];
  colors: string[];
  restrictions: DietaryRestriction[];
  budget: CatalogBudget | null;
  area: CatalogArea | null;
  experienceById: Map<string, CatalogExperience>;
  menuById: Map<string, CatalogMenu>;
  addOnById: Map<string, CatalogAddOn>;
  styleById: Map<string, CatalogStyle>;
};

// -----------------------------------------------------------------------------
// Contexto
// -----------------------------------------------------------------------------

export function buildContext(input: DesignerInput, catalog: DesignerCatalog): DesignerContext {
  const vibes = [...new Set(input.vibes)].filter((v): v is Vibe =>
    (VIBE_VALUES as readonly string[]).includes(v),
  );
  if (vibes.length === 0) vibes.push("relajado");
  const colors = [...new Set(input.colors.map((c) => normalizeHex(c)).filter((c): c is string => !!c))];
  const restrictions = [...new Set(input.dietary)].sort() as DietaryRestriction[];
  const budget =
    input.budgetRangeId && input.budgetRangeId !== BUDGET_UNKNOWN
      ? (catalog.budgets.find((b) => b.id === input.budgetRangeId) ?? null)
      : null;
  const area =
    input.serviceArea && input.serviceArea !== OTHER_AREA
      ? (catalog.areas.find((a) => a.id === input.serviceArea) ?? null)
      : null;

  const seed = JSON.stringify({
    o: input.occasion,
    oo: normalize(input.occasionOther),
    p: normalize(input.profile),
    a: input.honoreeAge ?? null,
    g: input.guestCount,
    b: input.budgetRangeId,
    t: normalize(input.tastes),
    c: [...colors].sort(),
    v: vibes,
    s: input.serviceArea,
    d: restrictions,
  });

  return {
    input,
    catalog,
    seed,
    stems: tasteStems(`${input.tastes ?? ""} ${input.profile}`),
    vibes,
    colors,
    restrictions,
    budget,
    area,
    experienceById: new Map(catalog.experiences.map((e) => [e.id, e])),
    menuById: new Map(catalog.menus.map((m) => [m.id, m])),
    addOnById: new Map(catalog.addOns.map((a) => [a.id, a])),
    styleById: new Map(catalog.styles.map((s) => [s.id, s])),
  };
}

// -----------------------------------------------------------------------------
// Precio aproximado (QuoteEngine puro, sin costos) — sólo para ajustar al presupuesto
// -----------------------------------------------------------------------------

export function priceOf(
  ctx: DesignerContext,
  sel: DesignSelection,
  guestCount = ctx.input.guestCount,
): number {
  const e = ctx.experienceById.get(sel.experienceId);
  if (!e) throw new DesignerCatalogError(`Experiencia desconocida: ${sel.experienceId}`);
  const m = sel.menuId ? ctx.menuById.get(sel.menuId) : null;
  const addOns = sel.addOnIds.map((id) => ctx.addOnById.get(id)).filter((a): a is CatalogAddOn => !!a);
  const result = calculateQuote({
    experience: {
      id: e.id,
      name: e.name,
      basePriceCents: e.basePriceCents,
      baseGuests: e.baseGuests,
      minGuests: e.minGuests,
      maxGuests: e.maxGuests,
      extraGuestPriceCents: e.extraGuestPriceCents,
      extraGuestCostCents: 0,
      costComponents: [],
    },
    guestCount,
    menu: m
      ? { id: m.id, name: m.name, pricingType: m.pricingType, priceCents: m.priceCents, costPerGuestCents: 0 }
      : null,
    addOns: addOns.map((a) => ({
      id: a.id,
      name: a.name,
      pricingType: a.pricingType,
      priceCents: a.priceCents,
      costCents: 0,
      costCategory: "OTHER" as const,
      quantity: 1,
      maxQuantity: a.maxQuantity,
    })),
    serviceArea: ctx.area
      ? {
          id: ctx.area.id,
          name: ctx.area.name,
          logisticsFeeCents: ctx.area.logisticsFeeCents,
          logisticsCostCents: 0,
        }
      : null,
    settings: ctx.catalog.pricing,
  });
  return result.totalCents;
}

function budgetMax(ctx: DesignerContext): number | null {
  return ctx.budget?.maxCents ?? null;
}

// -----------------------------------------------------------------------------
// Experiencias
// -----------------------------------------------------------------------------

function experienceText(e: CatalogExperience): string {
  return normalize([e.name, e.slug, e.tagline, e.description, e.includes.join(" ")].join(" "));
}

export function scoreExperience(ctx: DesignerContext, e: CatalogExperience): number {
  const { input } = ctx;
  let s = 0;

  // Ocasión
  if (e.occasions.includes(input.occasion as Occasion)) {
    s += 40;
    if (e.occasions[0] === input.occasion) s += 5;
  } else if (
    input.occasion === "OTHER" &&
    (e.occasions.includes("GATHERING") || e.occasions.includes("FRIENDS_BRUNCH"))
  ) {
    s += 15;
  }

  // Rango de invitadas
  const g = input.guestCount;
  if (g >= e.minGuests && g <= e.maxGuests) s += 15;
  else if (g > e.maxGuests) s -= Math.min(15, g - e.maxGuests);
  else s -= 5;

  // Vibras (estilos asociados + palabras clave)
  const text = experienceText(e);
  const styleSlugs = e.styleIds.map((id) => ctx.styleById.get(id)?.slug).filter((x): x is string => !!x);
  ctx.vibes.forEach((vibe, i) => {
    const weight = i === 0 ? 1.5 : 1;
    if (VIBE_STYLE_SLUGS[vibe].some((slug) => styleSlugs.includes(slug))) s += 6 * weight;
    s += Math.min(12, countStemHits(VIBE_KEYWORDS[vibe], text) * 4) * weight;
  });

  // Gustos
  s += Math.min(18, countGroupHits(ctx.stems, text) * 6);

  // Zona
  if (ctx.area && e.serviceAreaIds.length > 0 && !e.serviceAreaIds.includes(ctx.area.id)) s -= 8;

  // Presupuesto (precio base + invitadas extra + logística)
  const max = budgetMax(ctx);
  if (max == null) {
    s += 10;
  } else {
    const approx = priceOf(ctx, { experienceId: e.id, menuId: null, addOnIds: [] });
    if (approx <= max) s += 20;
    else s -= Math.min(60, Math.round(((approx - max) / max) * 100));
  }

  if (e.featured) s += 1;
  return s;
}

export function rankExperiences(
  ctx: DesignerContext,
): Array<{ experience: CatalogExperience; score: number }> {
  return ctx.catalog.experiences
    .map((experience) => ({ experience, score: scoreExperience(ctx, experience) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.experience.sortOrder - b.experience.sortOrder ||
        a.experience.id.localeCompare(b.experience.id),
    );
}

// -----------------------------------------------------------------------------
// Estilo
// -----------------------------------------------------------------------------

export function pickStyle(ctx: DesignerContext, e: CatalogExperience): CatalogStyle | null {
  const candidates = e.styleIds.map((id) => ctx.styleById.get(id)).filter((s): s is CatalogStyle => !!s);
  if (candidates.length === 0) return null;
  const scored = candidates.map((style) => {
    let s = 0;
    const text = normalize(`${style.name} ${style.slug} ${style.description ?? ""}`);
    ctx.vibes.forEach((vibe, i) => {
      // La primera vibra manda (así lo prometemos en el formulario).
      const weight = i === 0 ? 1.5 : 1;
      if (VIBE_STYLE_SLUGS[vibe].includes(style.slug)) s += 10 * weight;
      s += Math.min(9, countStemHits(VIBE_KEYWORDS[vibe], text) * 3) * weight;
    });
    const palette = style.palette.map((c) => normalizeHex(c)).filter((c): c is string => !!c);
    if (palette.length) for (const c of ctx.colors) if (minDistance(c, palette) < 70) s += 4;
    return { style, s };
  });
  scored.sort(
    (a, b) => b.s - a.s || a.style.sortOrder - b.style.sortOrder || a.style.id.localeCompare(b.style.id),
  );
  return scored[0]!.style;
}

// -----------------------------------------------------------------------------
// Menú
// -----------------------------------------------------------------------------

export type RankedMenu = {
  menu: CatalogMenu;
  score: number;
  covered: DietaryRestriction[];
  conflicts: DietaryRestriction[];
  /** cubre todas las restricciones cubribles y no tiene conflictos (mariscos/nueces) */
  compatible: boolean;
};

function menuText(m: CatalogMenu): string {
  return normalize([m.name, m.slug, m.description, m.tags.join(" "), m.itemNames.join(" ")].join(" "));
}

/** ¿Contiene alguna de las palabras como palabra completa? (evita "res" dentro de "fresas") */
function hasWord(text: string, words: string[]): boolean {
  return words.some((w) => new RegExp(`(^|[^a-z0-9ñ])${w}([^a-z0-9ñ]|$)`).test(text));
}

export function analyzeMenuDietary(
  restrictions: DietaryRestriction[],
  m: CatalogMenu,
): Pick<RankedMenu, "covered" | "conflicts" | "compatible"> {
  const text = menuText(m);
  const required = restrictions.filter((r) => COVERABLE.includes(r));
  const covered = required.filter(
    (r) => m.dietaryTags.includes(r) || (r === "VEGETARIAN" && m.dietaryTags.includes("VEGAN")),
  );
  const conflicts: DietaryRestriction[] = [];
  if (restrictions.includes("SEAFOOD_ALLERGY") && SEAFOOD_WORDS.some((w) => text.includes(w)))
    conflicts.push("SEAFOOD_ALLERGY");
  if (restrictions.includes("NUT_ALLERGY") && NUT_WORDS.some((w) => text.includes(w)))
    conflicts.push("NUT_ALLERGY");
  return { covered, conflicts, compatible: covered.length === required.length && conflicts.length === 0 };
}

export function rankMenus(ctx: DesignerContext, e: CatalogExperience): RankedMenu[] {
  const candidates = e.menuIds.map((id) => ctx.menuById.get(id)).filter((m): m is CatalogMenu => !!m);
  const ranked = candidates.map((menu) => {
    const d = analyzeMenuDietary(ctx.restrictions, menu);
    const required = ctx.restrictions.filter((r) => COVERABLE.includes(r)).length;
    // Alergias (conflictos) pesan más que cualquier gusto o vibra.
    let score = d.covered.length * 30 - d.conflicts.length * 40 - (required - d.covered.length) * 5;
    const text = menuText(menu);
    const plantBased = ctx.restrictions.includes("VEGAN") || ctx.restrictions.includes("VEGETARIAN");
    if (plantBased) {
      // Vegana sin menú vegano: un menú vegetariano es el mejor punto de partida.
      if (
        ctx.restrictions.includes("VEGAN") &&
        !menu.dietaryTags.includes("VEGAN") &&
        menu.dietaryTags.includes("VEGETARIAN")
      ) {
        score += 15;
      }
      // Menos proteína animal = menos platillos por adaptar.
      const meatItems = menu.itemNames.filter((item) => hasWord(normalize(item), MEAT_WORDS)).length;
      score -= Math.min(32, meatItems * 8);
    }
    score += Math.min(15, countGroupHits(ctx.stems, text) * 5);
    const tags = menu.tags.map((t) => normalize(t));
    for (const vibe of ctx.vibes) {
      for (const [tag, pts] of Object.entries(VIBE_MENU_TAGS[vibe])) if (tags.includes(tag)) score += pts;
    }
    if (menu.pricingType === "INCLUDED") score += 4;
    return { menu, score, ...d };
  });
  return ranked.sort(
    (a, b) => b.score - a.score || a.menu.sortOrder - b.menu.sortOrder || a.menu.id.localeCompare(b.menu.id),
  );
}

/**
 * Elige el menú: el mejor puntuado; si con él la base ya rebasa el presupuesto, el siguiente
 * que quepa sin empeorar la compatibilidad alimentaria.
 */
export function chooseMenu(ctx: DesignerContext, e: CatalogExperience): RankedMenu | null {
  const ranked = rankMenus(ctx, e);
  const best = ranked[0];
  if (!best) return null;
  const max = budgetMax(ctx);
  if (max == null) return best;
  const price = (r: RankedMenu) => priceOf(ctx, { experienceId: e.id, menuId: r.menu.id, addOnIds: [] });
  if (price(best) <= max) return best;
  const alternative = ranked.find(
    (r) => r.compatible === best.compatible && r.conflicts.length <= best.conflicts.length && price(r) <= max,
  );
  return alternative ?? best;
}

export function dietaryNote(ctx: DesignerContext, menu: CatalogMenu | null): string | null {
  if (ctx.restrictions.length === 0) return null;
  const d = menu
    ? analyzeMenuDietary(ctx.restrictions, menu)
    : { covered: [] as DietaryRestriction[], conflicts: [], compatible: false };
  const covered = d.covered;
  const others = ctx.restrictions.filter((r) => !covered.includes(r));
  const parts: string[] = [];
  if (covered.length) parts.push(`Menú con opciones ${joinEs(covered.map((r) => DIETARY_PHRASES[r]))}`);
  if (others.length) {
    parts.push(
      `${parts.length ? "y preparamos" : "Preparamos"} alternativas ${joinEs(others.map((r) => DIETARY_PHRASES[r]))}; lo confirmamos contigo`,
    );
  }
  return `${parts.join(" ")}.`;
}

// -----------------------------------------------------------------------------
// Add-ons
// -----------------------------------------------------------------------------

function addOnText(a: CatalogAddOn): string {
  return normalize(`${a.name} ${a.slug} ${a.description ?? ""}`);
}

export function scoreAddOn(ctx: DesignerContext, a: CatalogAddOn): number {
  const text = addOnText(a);
  let s = 0;
  for (const vibe of ctx.vibes) {
    s += VIBE_ADDON_CATEGORY[vibe][a.category] ?? 0;
    for (const [k, pts] of Object.entries(VIBE_ADDON_KEYWORDS[vibe])) if (text.includes(k)) s += pts;
  }
  for (const [k, pts] of Object.entries(OCCASION_ADDON_KEYWORDS[ctx.input.occasion as Occasion] ?? {})) {
    if (text.includes(k)) s += pts;
  }
  s += Math.min(24, countGroupHits(ctx.stems, text) * 12);
  return s;
}

export function rankAddOns(
  ctx: DesignerContext,
  e: CatalogExperience,
): Array<{ addOn: CatalogAddOn; score: number }> {
  return e.addOnIds
    .map((id) => ctx.addOnById.get(id))
    .filter((a): a is CatalogAddOn => !!a)
    .map((addOn) => ({ addOn, score: scoreAddOn(ctx, addOn) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.addOn.priceCents - b.addOn.priceCents ||
        a.addOn.sortOrder - b.addOn.sortOrder ||
        a.addOn.id.localeCompare(b.addOn.id),
    );
}

function maxAddOns(ctx: DesignerContext): number {
  return ctx.budget && ctx.budget.maxCents == null ? 4 : 3;
}

/** Selección codiciosa por puntaje: una por categoría, sin rebasar el presupuesto. */
export function selectAddOns(ctx: DesignerContext, e: CatalogExperience, menuId: string | null): string[] {
  const max = budgetMax(ctx);
  const limit = maxAddOns(ctx);
  const selected: string[] = [];
  const categories = new Set<string>();
  for (const { addOn, score } of rankAddOns(ctx, e)) {
    if (score < MIN_ADDON_SCORE || selected.length >= limit) break;
    if (categories.has(addOn.category)) continue;
    const candidate = [...selected, addOn.id];
    if (max != null && priceOf(ctx, { experienceId: e.id, menuId, addOnIds: candidate }) > max) continue;
    selected.push(addOn.id);
    categories.add(addOn.category);
  }
  return selected;
}

// -----------------------------------------------------------------------------
// Ajuste al presupuesto (también se aplica a propuestas del LLM)
// -----------------------------------------------------------------------------

/**
 * Ajusta una selección al presupuesto: quita add-ons (menor puntaje primero, luego el más caro)
 * y, si aún no cabe, baja a un menú más accesible sin empeorar la compatibilidad alimentaria.
 */
export function fitSelectionToBudget(
  ctx: DesignerContext,
  sel: DesignSelection,
): DesignSelection & { totalCents: number } {
  const e = ctx.experienceById.get(sel.experienceId);
  if (!e) throw new DesignerCatalogError(`Experiencia desconocida: ${sel.experienceId}`);
  let menuId = sel.menuId;
  let addOnIds = [...sel.addOnIds];
  let total = priceOf(ctx, { experienceId: e.id, menuId, addOnIds });
  const max = budgetMax(ctx);
  if (max == null || total <= max) return { experienceId: e.id, menuId, addOnIds, totalCents: total };

  const score = new Map(rankAddOns(ctx, e).map((r) => [r.addOn.id, r.score]));
  while (total > max && addOnIds.length > 0) {
    const worst = [...addOnIds].sort((a, b) => {
      const ds = (score.get(a) ?? 0) - (score.get(b) ?? 0);
      if (ds !== 0) return ds;
      return (ctx.addOnById.get(b)?.priceCents ?? 0) - (ctx.addOnById.get(a)?.priceCents ?? 0);
    })[0]!;
    addOnIds = addOnIds.filter((id) => id !== worst);
    total = priceOf(ctx, { experienceId: e.id, menuId, addOnIds });
  }

  if (total > max && menuId) {
    const current = ctx.menuById.get(menuId);
    const currentDiet = current ? analyzeMenuDietary(ctx.restrictions, current) : null;
    const cheaper = rankMenus(ctx, e).find((r) => {
      if (r.menu.id === menuId) return false;
      if (
        currentDiet &&
        (r.compatible !== currentDiet.compatible || r.conflicts.length > currentDiet.conflicts.length)
      ) {
        return false;
      }
      return priceOf(ctx, { experienceId: e.id, menuId: r.menu.id, addOnIds }) < total;
    });
    if (cheaper) {
      menuId = cheaper.menu.id;
      total = priceOf(ctx, { experienceId: e.id, menuId, addOnIds });
    }
  }
  return { experienceId: e.id, menuId, addOnIds, totalCents: total };
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`;
}

/** Evalúa el ajuste al presupuesto y, si se pasa, arma una sugerencia concreta. */
export function evaluateBudget(ctx: DesignerContext, sel: DesignSelection, totalCents?: number): BudgetFit {
  const total = totalCents ?? priceOf(ctx, sel);
  const max = budgetMax(ctx);
  if (max == null || total <= max) {
    return { budget: ctx.budget, estimatedTotalCents: total, overBudget: false, suggestion: null };
  }
  const e = ctx.experienceById.get(sel.experienceId)!;
  const options: string[] = [];

  // 1) Menos invitadas
  if (e.extraGuestPriceCents > 0 && ctx.input.guestCount > e.baseGuests) {
    const floor = Math.max(e.baseGuests, e.minGuests, 1);
    for (let g = ctx.input.guestCount - 1; g >= floor; g--) {
      if (priceOf(ctx, sel, g) <= max) {
        options.push(`ajustar a ${g} personas`);
        break;
      }
    }
  }
  // 2) Experiencia más accesible para la misma ocasión
  const alt = rankExperiences(ctx).find(
    ({ experience: x }) =>
      x.id !== e.id &&
      x.occasions.includes(ctx.input.occasion as Occasion) &&
      priceOf(ctx, { experienceId: x.id, menuId: null, addOnIds: [] }) <= max,
  );
  if (alt) options.push(`probar nuestra experiencia ${alt.experience.name}`);
  // 3) Dejar extras para después
  if (sel.addOnIds.length > 0) options.push("dejar los extras para después");
  // 4) El rango de presupuesto que sí la cubre
  if (options.length < 2) {
    const fitting = [...ctx.catalog.budgets]
      .sort((a, b) => a.minCents - b.minCents)
      .find(
        (b) => b.id !== ctx.budget?.id && (b.maxCents == null || b.maxCents >= total) && b.minCents <= total,
      );
    if (fitting) options.push(`considerar el rango ${fitting.label}`);
  }
  if (options.length === 0) options.push("platicarlo con nosotras para ajustar detalles");

  const pct = (total - max) / max;
  const lead =
    pct <= 0.15 ? "Se pasa un poco de tu presupuesto" : "Esta propuesta queda arriba de tu presupuesto";
  return {
    budget: ctx.budget,
    estimatedTotalCents: total,
    overBudget: true,
    suggestion: `${lead}: te sugerimos ${joinOr(options.slice(0, 2))}.`,
  };
}

// -----------------------------------------------------------------------------
// Textos
// -----------------------------------------------------------------------------

function occasionPhrase(ctx: DesignerContext): string {
  const other = ctx.input.occasionOther?.trim();
  if (ctx.input.occasion === "OTHER" && other)
    return `una celebración de ${truncate(other.toLowerCase(), 60)}`;
  return OCCASION_TEXT[ctx.input.occasion as Occasion].phrase;
}

export function composeName(ctx: DesignerContext): string {
  const noun = OCCASION_TEXT[ctx.input.occasion as Occasion].noun;
  return pick(NAME_PATTERNS[ctx.vibes[0]!], ctx.seed, "name").replace("{o}", noun);
}

export function composeConcept(ctx: DesignerContext): string {
  const [primary, secondary] = ctx.vibes;
  const toque = secondary ? `, con un toque ${VIBE_ADJECTIVE[secondary]}` : "";
  return `${capitalize(occasionPhrase(ctx))} ${VIBE_CONCEPT[primary!]}${toque}.`;
}

export function composeActivities(
  ctx: DesignerContext,
  e: CatalogExperience,
  addOns: CatalogAddOn[],
): string[] {
  const out: string[] = [];
  const push = (t: string | undefined) => {
    if (!t || out.length >= 4) return;
    // Evita duplicados y casi-duplicados (una contenida en la otra).
    const n = normalize(t);
    if (out.some((o) => normalize(o).includes(n) || n.includes(normalize(o)))) return;
    out.push(t);
  };
  // Lo que realmente está incluido o seleccionado (no la descripción: evita prometer extras no elegidos)
  const featureText = normalize(
    `${e.name} ${e.includes.join(" ")} ${addOns.map((a) => `${a.name} ${a.slug}`).join(" ")}`,
  );
  for (const f of FEATURE_ACTIVITIES) {
    if (out.length >= 2) break;
    if (featureText.includes(f.key)) push(f.text);
  }
  const occasionList = OCCASION_ACTIVITIES[ctx.input.occasion as Occasion];
  const start = occasionList.length ? hashString(`${ctx.seed}|occ`) % occasionList.length : 0;
  push(occasionList[start]);
  push(pick(VIBE_ACTIVITIES[ctx.vibes[0]!], ctx.seed, "vibe1"));
  if (ctx.vibes[1]) push(pick(VIBE_ACTIVITIES[ctx.vibes[1]], ctx.seed, "vibe2"));
  push(occasionList[(start + 1) % Math.max(1, occasionList.length)]);
  for (const t of VIBE_ACTIVITIES[ctx.vibes[0]!]) push(t);
  return out;
}

function paletteWords(palette: PaletteColor[]): string {
  return joinEs(palette.slice(0, 3).map((c) => c.name.toLowerCase()));
}

export function composeTable(
  ctx: DesignerContext,
  style: CatalogStyle | null,
  palette: PaletteColor[],
  addOns: CatalogAddOn[],
): string {
  const base = (style && STYLE_TABLE[style.slug]) || DEFAULT_TABLE;
  // Sólo lo que se ve en la mesa: decoración y papelería/letreros (no regalos ni comida).
  const decor = addOns
    .filter(
      (a) =>
        a.category === "DECOR" ||
        (a.category === "PERSONALIZATION" && /papeler|letrero|tarjeta|impres/.test(addOnText(a))),
    )
    .map((a) => a.name);
  const extra = decor.length ? ` Sumamos ${joinEs(decor)} para completar el look.` : "";
  return `${base}, en tonos ${paletteWords(palette)}, con ${VIBE_TABLE_DETAIL[ctx.vibes[0]!]}.${extra}`;
}

export function composePlaylist(ctx: DesignerContext): string {
  const base = VIBE_PLAYLIST[ctx.vibes[0]!];
  const tastes = ` ${normalize(ctx.input.tastes)} `;
  const found: string[] = [];
  for (const [key, label] of MUSIC_KEYWORDS) {
    const re = new RegExp(`(^|[^a-z0-9])${key.replace(/[-]/g, "\\-")}`);
    if (re.test(tastes) && !found.includes(label)) found.push(label);
    if (found.length >= 3) break;
  }
  // "pop" dentro de "k-pop" no cuenta doble; tampoco repetimos lo que la base ya menciona.
  const baseText = normalize(base);
  const cleaned = (found.includes("K-pop") ? found.filter((f) => f !== "pop") : found).filter(
    (f) => !baseText.includes(normalize(f)),
  );
  return cleaned.length ? `${base} Con guiño a lo que más les gusta: ${joinEs(cleaned)}.` : base;
}

/** Cláusula breve de restricciones para la narrativa (", con opciones vegetarianas"). */
function dietaryClause(ctx: DesignerContext, menu: CatalogMenu | null): string {
  if (ctx.restrictions.length === 0) return "";
  const covered = menu ? analyzeMenuDietary(ctx.restrictions, menu).covered : [];
  const others = ctx.restrictions.filter((r) => !covered.includes(r));
  const parts: string[] = [];
  if (covered.length) parts.push(`, con opciones ${joinEs(covered.map((r) => DIETARY_PHRASES[r]))}`);
  if (others.length)
    parts.push(
      `${covered.length ? " y" : ","} preparamos alternativas ${joinEs(others.map((r) => DIETARY_PHRASES[r]))}`,
    );
  return parts.join("");
}

export function composeDescription(
  ctx: DesignerContext,
  args: {
    name: string;
    experience: CatalogExperience;
    style: CatalogStyle | null;
    menu: CatalogMenu | null;
    addOns: CatalogAddOn[];
    palette: PaletteColor[];
    activities: string[];
  },
): string[] {
  const { input } = ctx;
  const { experience: e, style, menu, addOns, palette, activities } = args;
  const age =
    input.honoreeAge && input.occasion === "BIRTHDAY" ? ` para celebrar sus ${input.honoreeAge} años` : "";
  const styleText = style ? `, con una mesa de estilo ${style.name.toLowerCase()}` : "";
  const p1 =
    `${pick(VIBE_OPENERS[ctx.vibes[0]!], ctx.seed, "opener")} ` +
    `Partimos de nuestra experiencia ${e.name}${age}, pensada para ${input.guestCount} personas${styleText} ` +
    `y una paleta en ${paletteWords(palette)}.`;

  const menuText = menu ? `nuestro menú ${menu.name}` : "el brunch de la casa";
  const diet = dietaryClause(ctx, menu);
  const addOnsText = addOns.length
    ? `${pick(["Para hacerlo inolvidable", "Para darle un giro especial", "Como toque final"], ctx.seed, "addons")} sumamos ${joinEs(addOns.map((a) => a.name))}.`
    : pick(NO_ADDONS_SENTENCES, ctx.seed, "noaddons");
  // Teaser con una dinámica sencilla (sin ":" ni nombres propios al inicio).
  const teaserActivity = activities.find(
    (a) => !a.includes(":") && !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ]/.test(a),
  );
  const teaser = teaserActivity
    ? ` Entre plato y plato: ${teaserActivity.charAt(0).toLowerCase()}${teaserActivity.slice(1)}.`
    : "";
  const p2 = `En la mesa servimos ${menuText}${diet}. ${addOnsText}${teaser}`;

  const profile = truncate(input.profile.replace(/[.\s]+$/, ""), 140);
  const p3 = `Lo diseñamos pensando en lo que nos contaste: “${profile}”. ${pick(CLOSINGS, ctx.seed, "closing")}`;
  return [p1, p2, p3];
}

// -----------------------------------------------------------------------------
// Orquestación
// -----------------------------------------------------------------------------

/** Arma textos y paleta para una selección ya decidida (reglas o LLM mapeado). */
export function composeDesign(
  ctx: DesignerContext,
  sel: DesignSelection,
  styleId: string | null,
): RulesDesignResult["design"] & {
  dietaryNote: string | null;
} {
  const e = ctx.experienceById.get(sel.experienceId)!;
  const style = styleId ? (ctx.styleById.get(styleId) ?? null) : null;
  const menu = sel.menuId ? (ctx.menuById.get(sel.menuId) ?? null) : null;
  const addOns = sel.addOnIds.map((id) => ctx.addOnById.get(id)).filter((a): a is CatalogAddOn => !!a);
  const palette = buildPalette(ctx.colors, style?.palette ?? [], COLOR_PRESETS);
  const name = composeName(ctx);
  const activities = composeActivities(ctx, e, addOns);
  const note = dietaryNote(ctx, menu);
  const design: DesignProposal = {
    name,
    concept: composeConcept(ctx),
    description: composeDescription(ctx, { name, experience: e, style, menu, addOns, palette, activities }),
    palette,
    experienceId: e.id,
    styleId: style?.id ?? null,
    menuId: menu?.id ?? null,
    addOnIds: addOns.map((a) => a.id),
    activities,
    tableDesign: composeTable(ctx, style, palette, addOns),
    playlistVibe: composePlaylist(ctx),
  };
  return { ...design, dietaryNote: note };
}

/** Elige experiencia + estilo + menú + add-ons ajustados al presupuesto. */
export function chooseSelection(ctx: DesignerContext): {
  selection: DesignSelection;
  styleId: string | null;
  totalCents: number;
} {
  const ranked = rankExperiences(ctx);
  const best = ranked[0];
  if (!best) throw new DesignerCatalogError();
  const e = best.experience;
  const style = pickStyle(ctx, e);
  const menu = chooseMenu(ctx, e);
  const menuId = menu?.menu.id ?? null;
  const addOnIds = selectAddOns(ctx, e, menuId);
  const fitted = fitSelectionToBudget(ctx, { experienceId: e.id, menuId, addOnIds });
  return {
    selection: { experienceId: fitted.experienceId, menuId: fitted.menuId, addOnIds: fitted.addOnIds },
    styleId: style?.id ?? null,
    totalCents: fitted.totalCents,
  };
}

export type RulesDesignWithSelection = RulesDesignResult & {
  selection: DesignSelection;
  styleId: string | null;
};

/** Motor de reglas sobre un contexto ya construido (el servicio lo reutiliza para el camino LLM). */
export function designFromContext(ctx: DesignerContext): RulesDesignWithSelection {
  if (ctx.catalog.experiences.length === 0) throw new DesignerCatalogError();
  const { selection, styleId, totalCents } = chooseSelection(ctx);
  const { dietaryNote: note, ...design } = composeDesign(ctx, selection, styleId);
  return { design, fit: evaluateBudget(ctx, selection, totalCents), dietaryNote: note, selection, styleId };
}

/** Punto de entrada del motor de reglas. */
export function designWithRules(input: DesignerInput, catalog: DesignerCatalog): RulesDesignWithSelection {
  if (catalog.experiences.length === 0) throw new DesignerCatalogError();
  return designFromContext(buildContext(input, catalog));
}
