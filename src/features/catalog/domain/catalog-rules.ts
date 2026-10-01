/**
 * Reglas puras del catálogo (sin I/O): normalización de listas, colores, códigos postales,
 * reordenamiento, detección de cambios de precio y decisión de borrado vs. desactivación.
 * Se usan tanto en servidor (servicios) como en cliente (editores).
 */

// -----------------------------------------------------------------------------
// Listas de texto (tags, "incluye", códigos postales)
// -----------------------------------------------------------------------------

/** Limpia una lista de textos: trim, quita vacíos y duplicados (sin distinguir mayúsculas/acentos). */
export function normalizeTextList(values: readonly string[], opts: { lowercase?: boolean } = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = foldKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(opts.lowercase ? value.toLowerCase() : value);
  }
  return out;
}

function foldKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Separa texto pegado ("06700, 06600 06100") en elementos individuales. */
export function splitListInput(raw: string): string[] {
  return raw
    .split(/[,;\n\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const POSTAL_CODE_RE = /^\d{5}$/;

/** Códigos postales MX: 5 dígitos. Separa válidos de inválidos y quita duplicados. */
export function normalizePostalCodes(values: readonly string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of values.flatMap((v) => v.split(/[\s,;]+/))) {
    const value = raw.trim();
    if (!value) continue;
    if (!POSTAL_CODE_RE.test(value)) {
      invalid.push(value);
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    valid.push(value);
  }
  return { valid: valid.sort(), invalid };
}

// -----------------------------------------------------------------------------
// Colores (paletas de estilos)
// -----------------------------------------------------------------------------

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Normaliza "#ABC", "abc", "#aabbcc" → "#aabbcc". Devuelve null si no es un color hex válido. */
export function normalizeHexColor(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (!value.startsWith("#")) value = `#${value}`;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return HEX_COLOR_RE.test(value) ? value : null;
}

export function normalizePalette(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const hex = normalizeHexColor(v);
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out;
}

/** Texto legible (oscuro/claro) sobre un color de fondo — para etiquetas de swatches. */
export function readableTextOn(hex: string): "dark" | "light" {
  const value = normalizeHexColor(hex);
  if (!value) return "dark";
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "dark" : "light";
}

// -----------------------------------------------------------------------------
// Orden
// -----------------------------------------------------------------------------

/** Mueve un elemento una posición arriba (-1) o abajo (+1). Devuelve una copia. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(index, 1);
  copy.splice(target, 0, moved as T);
  return copy;
}

/** Verifica que `orderedIds` sea exactamente una permutación de `currentIds`. */
export function isPermutation(currentIds: readonly string[], orderedIds: readonly string[]): boolean {
  if (currentIds.length !== orderedIds.length) return false;
  const set = new Set(currentIds);
  if (set.size !== new Set(orderedIds).size) return false;
  return orderedIds.every((id) => set.has(id));
}

// -----------------------------------------------------------------------------
// Cambios de precio (para RBAC pricing:write + auditoría)
// -----------------------------------------------------------------------------

export type PriceDiff<T extends Record<string, unknown>> = {
  changed: boolean;
  fields: Array<keyof T>;
  before: Partial<T>;
  after: Partial<T>;
};

/** Compara campos de precio/costo; los valores se comparan por JSON (sirve para arreglos). */
export function diffPriceFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: ReadonlyArray<keyof T>,
): PriceDiff<T> {
  const fields: Array<keyof T> = [];
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fields.push(key);
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { changed: fields.length > 0, fields, before: b, after: a };
}

export type CostComponentLike = {
  category: string;
  description: string;
  amountCents: number;
  perGuest: boolean;
};

/** Forma canónica de los componentes de costo (para comparar y auditar). */
export function canonicalCostComponents(items: readonly CostComponentLike[]): CostComponentLike[] {
  return items.map((c) => ({
    category: c.category,
    description: c.description.trim(),
    amountCents: c.amountCents,
    perGuest: c.perGuest,
  }));
}

/** ¿La creación fija algún precio/costo distinto de cero? (requiere pricing:write). */
export function hasNonZeroPricing(values: ReadonlyArray<number | null | undefined>): boolean {
  return values.some((v) => typeof v === "number" && v !== 0);
}

// -----------------------------------------------------------------------------
// Borrado seguro
// -----------------------------------------------------------------------------

export type ReferenceCount = { count: number; one: string; many: string };

export type DeletionDecision =
  | { mode: "delete"; reasons: [] }
  | { mode: "deactivate"; reasons: string[] };

/** Si hay referencias se desactiva en lugar de borrar (para no romper historial). */
export function deletionDecision(refs: readonly ReferenceCount[]): DeletionDecision {
  const reasons = refs.filter((r) => r.count > 0).map((r) => `${r.count} ${r.count === 1 ? r.one : r.many}`);
  return reasons.length ? { mode: "deactivate", reasons } : { mode: "delete", reasons: [] };
}

/** "3 cotizaciones, 1 evento y 2 leads" */
export function joinSpanish(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export type EntityNoun = { label: string; feminine: boolean };

/** Mensaje claro cuando un borrado se convierte en desactivación. */
export function deactivationMessage(entity: EntityNoun, reasons: readonly string[]): string {
  const linked = entity.feminine ? "ligada" : "ligado";
  const pronoun = entity.feminine ? "La" : "Lo";
  return `No eliminamos ${entity.label} porque está ${linked} a ${joinSpanish(reasons)}. ${pronoun} desactivamos para que deje de ofrecerse; el historial queda intacto.`;
}

// -----------------------------------------------------------------------------
// Validación de URLs de imagen (placeholders locales o https)
// -----------------------------------------------------------------------------

/**
 * Ruta local (/images/..., /api/media/...) o URL https. Se rechaza http:// (contenido mixto en el
 * sitio público), URLs relativas al protocolo (//host) y esquemas como javascript:.
 */
export function isAcceptableImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v.startsWith("/") && !v.startsWith("//")) return !/[\s\\]/.test(v);
  return /^https:\/\/[^\s/]+\/?[^\s]*$/i.test(v);
}

/** URL estable para un MediaAsset PÚBLICO servido por /api/media/[id]. */
export function publicMediaPath(mediaAssetId: string): string {
  return `/api/media/${mediaAssetId}`;
}

/** "1 evento" / "3 eventos" */
export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
