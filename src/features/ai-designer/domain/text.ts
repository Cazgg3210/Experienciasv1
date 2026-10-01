/**
 * Utilidades de texto puras (normalización, tokens de gustos, hash determinista).
 */

/** minúsculas, sin acentos, espacios simples */
export function normalize(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const STOPWORDS = new Set([
  "para",
  "pero",
  "como",
  "porque",
  "todo",
  "toda",
  "todos",
  "todas",
  "mucho",
  "mucha",
  "muchos",
  "muchas",
  "algo",
  "ella",
  "ellas",
  "ellos",
  "este",
  "esta",
  "esto",
  "estos",
  "estas",
  "bien",
  "buena",
  "bueno",
  "tipo",
  "cosas",
  "cosa",
  "siempre",
  "tambien",
  "amigas",
  "amiga",
  "amigos",
  "cumple",
  "cumpleanos",
  "brunch",
  "comida",
  "musica",
  "actividades",
  "actividad",
  "gusta",
  "gustan",
  "encanta",
  "encantan",
  "aman",
  "ama",
  "fan",
  "fans",
  "nada",
  "otra",
  "otro",
  "otras",
  "otros",
  "unas",
  "unos",
  "sobre",
  "cuando",
  "donde",
  "desde",
  "hasta",
  "entre",
  "sin",
  "con",
  "las",
  "los",
  "del",
  "que",
  "una",
  "mas",
  "muy",
  "nos",
  "les",
  "sus",
  "mis",
  "tus",
  "favorito",
  "favorita",
  "favoritos",
  "favoritas",
  "quiero",
  "queremos",
  "queria",
  "seria",
  "algun",
  "alguna",
  "grupo",
  "chicas",
  "ademas",
]);

/** Sinónimos de gustos → raíz que aparece en el catálogo. */
const SYNONYMS: Record<string, string[]> = {
  cantar: ["karaoke"],
  canciones: ["karaoke"],
  cantamos: ["karaoke"],
  karaokes: ["karaoke"],
  champagne: ["espumoso", "mimosa"],
  champana: ["espumoso", "mimosa"],
  burbujas: ["espumoso", "mimosa"],
  prosecco: ["espumoso", "mimosa"],
  fotos: ["fotograf"],
  foto: ["fotograf"],
  fotografias: ["fotograf"],
  plantas: ["follaje", "flor"],
  flores: ["flor", "floral"],
  dulces: ["postre"],
  dulce: ["postre", "dulce"],
  pasteles: ["pastel"],
  torta: ["pastel"],
  saludable: ["ligero", "vegetar"],
  vegetariana: ["vegetar"],
  vegetariano: ["vegetar"],
  peruana: ["peru"],
  peruano: ["peru"],
  nikkei: ["peru", "nikkei"],
  mexicana: ["mexic"],
  mexicano: ["mexic"],
  videos: ["video"],
  reels: ["video"],
  tiktok: ["video"],
  recuerdos: ["album", "memory"],
  recuerdo: ["album", "memory"],
  globo: ["globos"],
  regalos: ["regalo"],
  sorpresa: ["regalo"],
  manualidades: ["taller"],
  lujo: ["premium"],
  elegante: ["premium", "elegante"],
};

function stem(word: string): string {
  return word.slice(0, word.length >= 7 ? 5 : 4);
}

/**
 * Grupos de raíces a partir de texto libre (gustos): una entrada por palabra relevante
 * (sin stopwords, ≥4 letras) con su raíz + sinónimos curados. Cada grupo cuenta como UN gusto.
 * Determinista y sin duplicados.
 */
export function tasteStems(text: string | null | undefined): string[][] {
  const words = normalize(text)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(" ")
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const groups = new Map<string, string[]>();
  for (const w of words) {
    const alternatives = [...new Set([stem(w), ...(SYNONYMS[w] ?? [])])].sort();
    groups.set(alternatives.join("|"), alternatives);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
}

/** Número de palabras clave presentes en el texto (ya normalizado). */
export function countStemHits(stems: string[], haystack: string): number {
  let hits = 0;
  for (const s of stems) if (haystack.includes(s)) hits++;
  return hits;
}

/** Número de gustos (grupos) con al menos una raíz presente en el texto. */
export function countGroupHits(groups: string[][], haystack: string): number {
  let hits = 0;
  for (const g of groups) if (g.some((s) => haystack.includes(s))) hits++;
  return hits;
}

/** FNV-1a 32 bits: hash determinista (mismo input → misma elección de plantillas). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Elige un elemento de forma determinista según semilla + sal. */
export function pick<T>(list: readonly T[], seed: string, salt: string): T {
  if (list.length === 0) throw new Error("pick: lista vacía");
  return list[hashString(`${seed}|${salt}`) % list.length]!;
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** "a", "a y b", "a, b y c" */
export function joinEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

const PRICE_PATTERN = /(\$\s?\d)|(\d[\d.,]*\s?(mxn|pesos|usd|dolares|dólares)\b)|(\bmxn\b)/i;

/**
 * Quita oraciones que mencionen montos: los precios SIEMPRE vienen del motor de cotización,
 * nunca del texto generado.
 */
export function stripPriceMentions(text: string): string {
  if (!PRICE_PATTERN.test(text)) return text.trim();
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return sentences
    .map((s) => s.trim())
    .filter((s) => s && !PRICE_PATTERN.test(s))
    .join(" ")
    .trim();
}

export function hasPriceMention(text: string): boolean {
  return PRICE_PATTERN.test(text);
}
