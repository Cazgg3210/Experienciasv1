/**
 * Regresión de BUG-009: contraste WCAG 2.1 AA (≥ 4.5:1 en texto normal) de los tokens de color de
 * `src/app/globals.css` en las combinaciones que usa la UI:
 *  - tonos de estado (StatusBadge, avisos): texto `text-<tono>` sobre `bg-<tono>/10` compuesto en los
 *    fondos de la paleta (como lo pinta el navegador y lo mide axe);
 *  - texto secundario (`text-muted-foreground`, `text-taupe-deep`) y texto claro sobre olive;
 *  - lo mismo en el modo oscuro preparado (`.dark`).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No encontré el bloque ${selector} en globals.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}

const ROOT = block(":root");
const DARK = { ...ROOT, ...block(".dark") };

function resolve(vars: Record<string, string>, name: string, depth = 0): string {
  const raw = vars[name];
  if (!raw) throw new Error(`Token ${name} no definido`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  if (ref && depth < 10) return resolve(vars, ref[1]!, depth + 1);
  if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error(`Token ${name} no es un hex de 6 dígitos: ${raw}`);
  return raw;
}

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
/** Color `fg` con opacidad `alpha` compuesto sobre `bg` (lo que hace `bg-<tono>/10`). */
const over = (fg: RGB, alpha: number, bg: RGB): RGB => fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as RGB;

const AA = 4.5;
const TONES = ["--warning", "--info", "--success", "--destructive"] as const;
const LIGHT_SURFACES = ["--background", "--card", "--sidebar", "--muted", "--brand-sand-soft", "--brand-sage-soft"];
const DARK_SURFACES = ["--background", "--card", "--sidebar", "--muted"];

function failures(vars: Record<string, string>, fgs: readonly string[], surfaces: string[], tint: number | null) {
  const out: string[] = [];
  for (const fg of fgs) {
    const text = rgb(resolve(vars, fg));
    for (const s of surfaces) {
      const surface = rgb(resolve(vars, s));
      const bg = tint === null ? surface : over(text, tint, surface);
      const ratio = contrast(text, bg);
      if (ratio < AA) out.push(`${fg} sobre ${tint === null ? "" : `${fg}/${tint * 100} en `}${s}: ${ratio.toFixed(2)}:1`);
    }
  }
  return out;
}

describe("tokens de color · contraste WCAG AA (BUG-009)", () => {
  it("tonos de estado: texto sobre su fondo al 10 % (StatusBadge) y sobre fondos de 15 % en ivory/card", () => {
    expect(failures(ROOT, TONES, LIGHT_SURFACES, 0.1)).toEqual([]);
    expect(failures(ROOT, TONES, ["--background", "--card"], 0.15)).toEqual([]);
    expect(failures(ROOT, TONES, LIGHT_SURFACES, null)).toEqual([]);
  });

  it("texto secundario: muted-foreground y taupe-deep (el taupe de marca es sólo decorativo)", () => {
    expect(failures(ROOT, ["--muted-foreground", "--brand-taupe-deep"], LIGHT_SURFACES, null)).toEqual([]);
    // Control: el taupe de marca NO alcanza AA como texto; por eso existe taupe-deep.
    expect(contrast(rgb(resolve(ROOT, "--brand-taupe")), rgb(resolve(ROOT, "--background")))).toBeLessThan(AA);
  });

  it("texto claro sobre olive (botones primarios, chips y burbujas seleccionadas)", () => {
    expect(contrast(rgb(resolve(ROOT, "--primary-foreground")), rgb(resolve(ROOT, "--primary")))).toBeGreaterThanOrEqual(AA);
  });

  it("*-foreground sobre el tono sólido (p. ej. bg-warning text-warning-foreground)", () => {
    const cases: Array<[Record<string, string>, readonly string[]]> = [
      [ROOT, TONES],
      [DARK, ["--warning", "--info", "--success"]],
    ];
    for (const [vars, tones] of cases) {
      for (const t of tones) {
        expect(contrast(rgb(resolve(vars, `${t}-foreground`)), rgb(resolve(vars, t))), t).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it("modo oscuro: tonos de estado y taupe-deep legibles sobre los fondos oscuros", () => {
    expect(failures(DARK, ["--warning", "--info", "--success"], DARK_SURFACES, 0.1)).toEqual([]);
    expect(failures(DARK, ["--brand-taupe-deep", "--muted-foreground"], DARK_SURFACES, null)).toEqual([]);
  });
});
