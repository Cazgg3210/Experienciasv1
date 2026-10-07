/**
 * Regresión de BUG-009: contraste WCAG 2.1 AA (≥ 4.5:1 en texto normal) de los tokens de color de
 * `src/app/globals.css` en las combinaciones que usa la UI:
 *  - tonos de estado (StatusBadge, avisos): texto `text-<tono>` sobre `bg-<tono>/NN` compuesto en los
 *    fondos de la paleta (como lo pinta el navegador y lo mide axe). Claro: hasta 15 %; oscuro: hasta 20 %
 *    (`dark:bg-destructive/20` del badge). Qué opacidades usa realmente el código lo vigila
 *    `ui-contrast-classes.test.ts`;
 *  - texto secundario (`text-muted-foreground`, `text-taupe-deep`) y texto claro sobre olive;
 *  - `*-foreground` sobre el tono sólido y su hover al 90 %;
 *  - lo mismo en el modo oscuro preparado (`.dark`), incluido `--destructive`.
 */
import { describe, expect, it } from "vitest";
import {
  AA,
  DARK,
  DARK_SURFACES,
  LIGHT_HOVER_SURFACES,
  LIGHT_SURFACES,
  ROOT,
  TONES,
  contrast,
  over,
  token,
  type Tokens,
} from "./support/contrast";

function failures(vars: Tokens, fgs: readonly string[], surfaces: string[], tint: number | null) {
  const out: string[] = [];
  for (const fg of fgs) {
    const text = token(vars, fg);
    for (const s of surfaces) {
      const surface = token(vars, s);
      const bg = tint === null ? surface : over(text, tint, surface);
      const ratio = contrast(text, bg);
      if (ratio < AA) out.push(`${fg} sobre ${tint === null ? "" : `${fg}/${Math.round(tint * 100)} en `}${s}: ${ratio.toFixed(2)}:1`);
    }
  }
  return out;
}

/** `*-foreground` sobre el tono sólido y sobre `bg-<tono>/90` (hover) compuesto en fondo y tarjeta. */
function foregroundFailures(vars: Tokens, tones: readonly string[]) {
  const out: string[] = [];
  for (const t of tones) {
    const fg = token(vars, `${t}-foreground`);
    const tone = token(vars, t);
    const solid = contrast(fg, tone);
    if (solid < AA) out.push(`${t}-foreground sobre ${t}: ${solid.toFixed(2)}:1`);
    for (const s of ["--background", "--card"]) {
      const ratio = contrast(fg, over(tone, 0.9, token(vars, s)));
      if (ratio < AA) out.push(`${t}-foreground sobre ${t}/90 en ${s}: ${ratio.toFixed(2)}:1`);
    }
  }
  return out;
}

describe("tokens de color · contraste WCAG AA (BUG-009)", () => {
  it("tonos de estado: texto sobre su fondo al 10 % (StatusBadge) y sobre fondos de 15 % (hover) en ivory/card/sidebar", () => {
    expect(failures(ROOT, TONES, LIGHT_SURFACES, 0.1)).toEqual([]);
    expect(failures(ROOT, TONES, LIGHT_HOVER_SURFACES, 0.15)).toEqual([]);
    expect(failures(ROOT, TONES, LIGHT_SURFACES, null)).toEqual([]);
  });

  it("control: al 20 % los tonos claros ya NO alcanzan AA (por eso los hover se quedan en 15 %)", () => {
    expect(failures(ROOT, ["--destructive"], ["--background", "--card"], 0.2)).not.toEqual([]);
  });

  it("texto secundario: muted-foreground y taupe-deep (el taupe de marca es sólo decorativo)", () => {
    expect(failures(ROOT, ["--muted-foreground", "--brand-taupe-deep"], LIGHT_SURFACES, null)).toEqual([]);
    // Control: el taupe de marca NO alcanza AA como texto; por eso existe taupe-deep.
    expect(contrast(token(ROOT, "--brand-taupe"), token(ROOT, "--background"))).toBeLessThan(AA);
  });

  it("texto claro sobre olive (botones primarios, chips y burbujas seleccionadas)", () => {
    expect(contrast(token(ROOT, "--primary-foreground"), token(ROOT, "--primary"))).toBeGreaterThanOrEqual(AA);
  });

  it("*-foreground sobre el tono sólido y su hover al 90 % (p. ej. bg-destructive text-destructive-foreground)", () => {
    expect(foregroundFailures(ROOT, TONES)).toEqual([]);
    expect(foregroundFailures(DARK, TONES)).toEqual([]);
  });

  it("modo oscuro: tonos de estado (incluido destructive) legibles sobre su fondo al 10–20 % y taupe-deep", () => {
    for (const tint of [0.1, 0.15, 0.2]) expect(failures(DARK, TONES, DARK_SURFACES, tint), `al ${tint * 100} %`).toEqual([]);
    expect(failures(DARK, TONES, DARK_SURFACES, null)).toEqual([]);
    expect(failures(DARK, ["--brand-taupe-deep", "--muted-foreground"], DARK_SURFACES, null)).toEqual([]);
  });
});
