import type { PaletteColor } from "./types";

/**
 * Paleta de la propuesta: colores de la clienta primero, luego la paleta del estilo elegido,
 * completando con neutros de marca. 4–5 colores con nombre en español.
 */

const NAMED_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Marfil", hex: "#F7F3EC" },
  { name: "Lino", hex: "#EFE6D8" },
  { name: "Arena", hex: "#E8DCC8" },
  { name: "Champaña", hex: "#F1E2C6" },
  { name: "Mantequilla", hex: "#F6D27A" },
  { name: "Mostaza", hex: "#D9A441" },
  { name: "Dorado", hex: "#C6A15B" },
  { name: "Durazno", hex: "#F4B6A6" },
  { name: "Coral", hex: "#F08A75" },
  { name: "Mandarina", hex: "#F4A261" },
  { name: "Terracota", hex: "#C8664B" },
  { name: "Rosa palo", hex: "#F3E1DA" },
  { name: "Blush", hex: "#E9C9BE" },
  { name: "Rosa chicle", hex: "#F2A2C0" },
  { name: "Fucsia", hex: "#D6336C" },
  { name: "Rojo", hex: "#C0392B" },
  { name: "Vino", hex: "#7B2D3A" },
  { name: "Lavanda", hex: "#B9A7D6" },
  { name: "Lila", hex: "#C8A2C8" },
  { name: "Ciruela", hex: "#6B3A5B" },
  { name: "Azul cielo", hex: "#8FB3E0" },
  { name: "Azul francés", hex: "#4A6FA5" },
  { name: "Azul marino", hex: "#24345A" },
  { name: "Turquesa", hex: "#2A9D8F" },
  { name: "Menta", hex: "#A8D5C2" },
  { name: "Eucalipto", hex: "#8DA399" },
  { name: "Salvia", hex: "#A3B18A" },
  { name: "Oliva", hex: "#5C6B4E" },
  { name: "Verde bosque", hex: "#2F4F3A" },
  { name: "Taupe", hex: "#A48F7E" },
  { name: "Chocolate", hex: "#5A3E36" },
  { name: "Gris perla", hex: "#D9D4CC" },
  { name: "Carbón", hex: "#2F2C2A" },
  { name: "Negro", hex: "#111111" },
];

/** Neutros de marca para completar la paleta. */
const BRAND_NEUTRALS = ["#F7F3EC", "#E8DCC8", "#A3B18A", "#5C6B4E", "#A48F7E"];

export const MIN_PALETTE = 4;
export const MAX_PALETTE = 5;

export function normalizeHex(value: string): string | null {
  const v = value.trim().replace(/^#?/, "#").toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(v)) return v;
  if (/^#[0-9A-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Distancia "redmean" (aprox. perceptual, barata). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Nombre en español del color con nombre más cercano. */
export function colorName(hex: string): string {
  let best = NAMED_COLORS[0]!;
  let bestD = Infinity;
  for (const c of NAMED_COLORS) {
    const d = colorDistance(hex, c.hex);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

/** Distancia mínima de un color a un conjunto. */
export function minDistance(hex: string, set: string[]): number {
  let min = Infinity;
  for (const s of set) min = Math.min(min, colorDistance(hex, s));
  return min;
}

const NEAR_DUPLICATE = 45;

/**
 * Compone la paleta final.
 * @param userColors colores elegidos por la clienta (prioridad)
 * @param stylePalette paleta del estilo sugerido
 * @param named nombres conocidos (p. ej. de los chips del formulario) para respetar el nombre que vio la clienta
 */
export function buildPalette(
  userColors: string[],
  stylePalette: string[],
  named: ReadonlyArray<{ name: string; hex: string }> = [],
): PaletteColor[] {
  const out: PaletteColor[] = [];
  const usedNames = new Set<string>();

  const add = (raw: string, allowNearDuplicate: boolean) => {
    if (out.length >= MAX_PALETTE) return;
    const hex = normalizeHex(raw);
    if (!hex) return;
    const hexes = out.map((c) => c.hex);
    if (hexes.includes(hex)) return;
    if (!allowNearDuplicate && hexes.length && minDistance(hex, hexes) < NEAR_DUPLICATE) return;
    let name = named.find((n) => n.hex.toUpperCase() === hex)?.name ?? colorName(hex);
    if (usedNames.has(name)) {
      const twin = out.find((c) => c.name === name)!;
      name = `${name} ${luminance(hex) >= luminance(twin.hex) ? "claro" : "profundo"}`;
      if (usedNames.has(name)) return;
    }
    usedNames.add(name);
    out.push({ name, hex });
  };

  // La clienta manda: sus colores entran aunque sean parecidos entre sí (máx. 4 para dejar aire).
  for (const c of userColors.slice(0, 4)) add(c, true);
  for (const c of stylePalette) add(c, false);
  for (const c of BRAND_NEUTRALS) {
    if (out.length >= MIN_PALETTE) break;
    add(c, false);
  }
  // Último recurso (paletas muy parecidas): permitir neutros aunque estén cerca.
  for (const c of BRAND_NEUTRALS) {
    if (out.length >= MIN_PALETTE) break;
    add(c, true);
  }
  return out;
}
