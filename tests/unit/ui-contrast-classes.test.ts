/**
 * Contrato de contraste sobre las CLASES que usa el código (complementa design-tokens-contrast.test.ts, que
 * valida los tokens). Recorre `src/**` y, por cada cadena de clases, calcula el contraste real de:
 *
 *  1. Tonos con fondo translúcido: `text-<tono>` junto a `bg-<tono>/NN` (también `hover:`, `[a]:hover:`,
 *     `dark:`…). Claro: ≤ 10 % sobre todas las superficies de la paleta y > 10 % (hover) sobre fondo, tarjeta
 *     y sidebar. Oscuro: todas las opacidades sobre las superficies oscuras.
 *  2. `text-<tono>-foreground` junto a `bg-<tono>` / `bg-<tono>/NN` (botón sólido y su hover).
 *  3. Texto atenuado con opacidad (`text-muted-foreground/80`, `text-foreground/70`…), la causa de BUG-009 que
 *     quedó en el configurador (`estimate-summary`): debe seguir ≥ 4.5:1 sobre las superficies claras (o sobre
 *     el fondo que fije la misma cadena, p. ej. `bg-card`), salvo las excepciones justificadas de abajo
 *     (íconos aria-hidden y controles deshabilitados, exentos de 1.4.3).
 *
 * axe no mide estados hover ni filas que sólo aparecen con ciertos datos; este contrato sí los ve.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AA,
  DARK,
  DARK_SURFACES,
  LIGHT_HOVER_SURFACES,
  LIGHT_SURFACES,
  ROOT,
  contrast,
  over,
  token,
  type Tokens,
} from "./support/contrast";

const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));
const SRC = path.join(ROOT_DIR, "src");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Cadenas literales ("…", '…', `…`) de un archivo: ahí viven las clases (className, cva, cn, mapas). */
function stringLiterals(code: string): string[] {
  return [...code.matchAll(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)].map((m) =>
    m[0].slice(1, -1),
  );
}

/** Separa las variantes (`dark:`, `hover:`, `[a]:hover:`, `*:data-[x=y]:`) de la utilidad final. */
function splitClass(cls: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of cls) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  return { variants: parts, utility: current };
}

type Use = { file: string; classes: Array<{ variants: string[]; utility: string }> };

const USES: Use[] = sourceFiles(SRC).flatMap((file) =>
  stringLiterals(readFileSync(file, "utf8")).map((literal) => ({
    file: path.relative(ROOT_DIR, file).replace(/\\/g, "/"),
    classes: literal.split(/\s+/).filter(Boolean).map(splitClass),
  })),
);

const TONE = "(destructive|success|warning|info)";
const isDark = (variants: string[]) => variants.includes("dark");

/** Tokens de TEXTO cuyo uso con opacidad se calcula (claro). Otros (`text-ivory/80` sobre fotos) no aplican. */
const TEXT_TOKENS: Record<string, string> = {
  "muted-foreground": "--muted-foreground",
  foreground: "--foreground",
  "card-foreground": "--card-foreground",
  "popover-foreground": "--popover-foreground",
  "secondary-foreground": "--secondary-foreground",
  "accent-foreground": "--accent-foreground",
  "sidebar-foreground": "--sidebar-foreground",
  charcoal: "--brand-charcoal",
  "taupe-deep": "--brand-taupe-deep",
  olive: "--brand-olive",
  primary: "--primary",
  destructive: "--destructive",
  success: "--success",
  warning: "--warning",
  info: "--info",
};

/**
 * Excepciones revisadas a mano (archivo + clase). Sólo contextos exentos de WCAG 1.4.3:
 * controles deshabilitados y elementos que no son texto (íconos aria-hidden).
 */
const DIMMED_TEXT_EXEMPT: Record<string, string> = {
  "src/features/configurator/components/availability-calendar.tsx::text-muted-foreground/70":
    "día lleno: botón aria-disabled (componente inactivo)",
  "src/features/configurator/components/availability-calendar.tsx::text-muted-foreground/60":
    "día cerrado: botón aria-disabled (componente inactivo)",
  "src/features/configurator/components/availability-calendar.tsx::text-muted-foreground/40":
    "día pasado: botón aria-disabled (componente inactivo)",
  "src/features/configurator/components/availability-calendar.tsx::text-muted-foreground/50":
    "día aún consultando: botón aria-disabled (componente inactivo, transitorio)",
  "src/features/configurator/components/configurator-wizard.tsx::text-muted-foreground/60":
    "paso todavía no disponible: <button disabled>",
  "src/features/vendors/components/vendor-ui.tsx::text-muted-foreground/40":
    "estrella vacía: ícono aria-hidden",
  "src/features/portal/components/review-form.tsx::text-muted-foreground/50":
    "estrella vacía: ícono aria-hidden",
  "src/features/portal/components/portal-dashboard.tsx::text-muted-foreground/40":
    "estrella vacía: ícono aria-hidden",
  "src/features/customers/components/customer-history.tsx::text-muted-foreground/40":
    "estrella vacía: ícono aria-hidden",
  "src/features/content/components/content-controls.tsx::text-muted-foreground/40":
    "estrella vacía: ícono aria-hidden",
};

function tintFailures(): string[] {
  const out: string[] = [];
  const check = (
    vars: Tokens,
    mode: string,
    tone: string,
    alpha: number,
    surfaces: string[],
    where: string,
  ) => {
    const text = token(vars, `--${tone}`);
    for (const s of surfaces) {
      const ratio = contrast(text, over(text, alpha, token(vars, s)));
      if (ratio < AA)
        out.push(
          `${where}: text-${tone} sobre bg-${tone}/${Math.round(alpha * 100)} en ${s} (${mode}) = ${ratio.toFixed(2)}:1`,
        );
    }
  };
  for (const { file, classes } of USES) {
    for (const tone of ["destructive", "success", "warning", "info"]) {
      if (!classes.some((c) => c.utility === `text-${tone}`)) continue;
      for (const c of classes) {
        const m = c.utility.match(new RegExp(`^bg-${tone}/(\\d+)$`));
        if (!m) continue;
        const alpha = Number(m[1]) / 100;
        if (!isDark(c.variants))
          check(ROOT, "claro", tone, alpha, alpha <= 0.1 ? LIGHT_SURFACES : LIGHT_HOVER_SURFACES, file);
        // En oscuro aplican tanto las variantes `dark:` como las que no se sobrescriben.
        check(DARK, "oscuro", tone, alpha, DARK_SURFACES, file);
      }
    }
  }
  return [...new Set(out)];
}

function foregroundFailures(): string[] {
  const out: string[] = [];
  for (const { file, classes } of USES) {
    for (const c of classes) {
      const fg = c.utility.match(new RegExp(`^text-${TONE}-foreground$`));
      if (!fg) continue;
      const tone = fg[1]!;
      for (const b of classes) {
        const m = b.utility.match(new RegExp(`^bg-${tone}(?:/(\\d+))?$`));
        if (!m) continue;
        const alpha = m[1] ? Number(m[1]) / 100 : 1;
        for (const [vars, mode] of [
          [ROOT, "claro"],
          [DARK, "oscuro"],
        ] as const) {
          for (const s of ["--background", "--card"]) {
            const ratio = contrast(
              token(vars, `--${tone}-foreground`),
              over(token(vars, `--${tone}`), alpha, token(vars, s)),
            );
            if (ratio < AA)
              out.push(
                `${file}: text-${tone}-foreground sobre ${b.utility} en ${s} (${mode}) = ${ratio.toFixed(2)}:1`,
              );
          }
        }
      }
    }
  }
  return [...new Set(out)];
}

/** Fondos de la paleta: si la misma cadena fija uno (p. ej. `bg-card` del Alert), el texto se mide sólo sobre él. */
const SURFACE_CLASSES: Record<string, string> = {
  "bg-background": "--background",
  "bg-card": "--card",
  "bg-popover": "--popover",
  "bg-muted": "--muted",
  "bg-sidebar": "--sidebar",
  "bg-secondary": "--secondary",
  "bg-accent": "--accent",
  "bg-ivory": "--brand-ivory",
  "bg-sand-soft": "--brand-sand-soft",
  "bg-sage-soft": "--brand-sage-soft",
};

function dimmedTextFailures(): { failures: string[]; exemptSeen: Set<string> } {
  const failures: string[] = [];
  const exemptSeen = new Set<string>();
  for (const { file, classes } of USES) {
    const own = classes
      .filter((c) => c.variants.length === 0 && SURFACE_CLASSES[c.utility])
      .map((c) => SURFACE_CLASSES[c.utility]!);
    const surfaces = own.length ? own : LIGHT_SURFACES;
    for (const c of classes) {
      const m = c.utility.match(/^text-([a-z-]+)\/(\d+)$/);
      if (!m || !TEXT_TOKENS[m[1]!] || isDark(c.variants)) continue;
      const key = `${file}::${c.utility}`;
      if (DIMMED_TEXT_EXEMPT[key]) {
        exemptSeen.add(key);
        continue;
      }
      const text = token(ROOT, TEXT_TOKENS[m[1]!]!);
      const alpha = Number(m[2]) / 100;
      for (const s of surfaces) {
        const surface = token(ROOT, s);
        const ratio = contrast(over(text, alpha, surface), surface);
        if (ratio < AA) failures.push(`${key} en ${s} = ${ratio.toFixed(2)}:1`);
      }
    }
  }
  return { failures: [...new Set(failures)], exemptSeen };
}

describe("clases de color del código · contraste WCAG AA (BUG-009)", () => {
  it("el escáner encuentra las combinaciones que debe vigilar (control: no es un contrato vacío)", () => {
    const has = (file: string, utility: string) =>
      USES.some((u) => u.file === file && u.classes.some((c) => c.utility === utility));
    expect(has("src/components/ui/button.tsx", "bg-destructive/15")).toBe(true);
    expect(has("src/components/ui/badge.tsx", "bg-destructive/20")).toBe(true);
    expect(has("src/features/payments/components/refund-dialog.tsx", "text-destructive-foreground")).toBe(
      true,
    );
    expect(splitClass("[a]:hover:bg-destructive/15")).toEqual({
      variants: ["[a]", "hover"],
      utility: "bg-destructive/15",
    });
    expect(splitClass("*:data-[slot=alert-description]:text-destructive/90")).toEqual({
      variants: ["*", "data-[slot=alert-description]"],
      utility: "text-destructive/90",
    });
  });

  it("texto de tono sobre su fondo translúcido (badges, avisos, hover) alcanza AA en claro y oscuro", () => {
    expect(tintFailures()).toEqual([]);
  });

  it("*-foreground sobre el tono sólido o casi sólido (botón destructivo y su hover)", () => {
    expect(foregroundFailures()).toEqual([]);
  });

  it("sin texto atenuado con opacidad por debajo de AA (salvo íconos y controles deshabilitados)", () => {
    const { failures, exemptSeen } = dimmedTextFailures();
    expect(failures).toEqual([]);
    // Cada excepción sigue existiendo en el código (si se quita la clase, se quita la excepción).
    expect(Object.keys(DIMMED_TEXT_EXEMPT).filter((k) => !exemptSeen.has(k))).toEqual([]);
  });

  it("control: el caso de BUG-009 que quedó en el configurador (muted-foreground al 80 %) no alcanzaría AA", () => {
    const muted = token(ROOT, "--muted-foreground");
    const card = token(ROOT, "--card");
    expect(contrast(over(muted, 0.8, card), card)).toBeLessThan(AA);
  });
});
