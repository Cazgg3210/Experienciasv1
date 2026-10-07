/**
 * Utilidades de contraste WCAG 2.1 para las pruebas de tokens de color (`src/app/globals.css`).
 * Lee las variables CSS de `:root` y `.dark` y compone colores con opacidad como lo hace el navegador
 * (y como lo mide axe): `bg-<tono>/10` es el tono al 10 % sobre la superficie de abajo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../../../src/app/globals.css", import.meta.url)), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No encontré el bloque ${selector} en globals.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}

export type Tokens = Record<string, string>;
export const ROOT: Tokens = block(":root");
export const DARK: Tokens = { ...ROOT, ...block(".dark") };

/** Valor hex final de un token (sigue `var(--otro)`). */
export function resolve(vars: Tokens, name: string, depth = 0): string {
  const raw = vars[name];
  if (!raw) throw new Error(`Token ${name} no definido`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  if (ref && depth < 10) return resolve(vars, ref[1]!, depth + 1);
  if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error(`Token ${name} no es un hex de 6 dígitos: ${raw}`);
  return raw;
}

export type RGB = [number, number, number];
export const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
export const token = (vars: Tokens, name: string): RGB => rgb(resolve(vars, name));

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Color `fg` con opacidad `alpha` (0–1) compuesto sobre `bg`. */
export const over = (fg: RGB, alpha: number, bg: RGB): RGB =>
  fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as RGB;

/** WCAG 2.1 AA para texto normal. */
export const AA = 4.5;

export const TONES = ["--warning", "--info", "--success", "--destructive"] as const;
/** Superficies claras donde aparece texto: fondo, tarjetas, sidebar, muted y los fondos suaves de marca. */
export const LIGHT_SURFACES = [
  "--background",
  "--card",
  "--sidebar",
  "--muted",
  "--brand-sand-soft",
  "--brand-sage-soft",
];
/** Superficies del panel donde viven los estados hover de tonos (> 10 %): fondo, tarjetas y sidebar. */
export const LIGHT_HOVER_SURFACES = ["--background", "--card", "--sidebar"];
export const DARK_SURFACES = ["--background", "--card", "--sidebar", "--muted"];
