/**
 * Contrato de BUG-013: las rutas PÚBLICAS y POR TOKEN responden un 404 real (no un soft-404 con HTTP 200).
 *
 * En Next 15.5 un `loading.tsx` envuelve en Suspense todo lo que cuelga de su segmento (layouts y páginas
 * hijas). Si `notFound()` ocurre dentro de ese límite, el streaming ya empezó con status 200 y el 404 sólo
 * se ve en el contenido. Por eso esas rutas validan el slug/token en un `layout.tsx` propio, ANTES del
 * `loading.tsx` de su segmento — y eso sólo funciona si NINGÚN segmento por encima del layout tiene
 * `loading.tsx` (ni un `<Suspense>` en un layout ancestro).
 *
 * Esta prueba falla si alguien agrega un `loading.tsx` (o un Suspense) donde rompería el 404 de
 * /experiencias/[slug], /cotizacion/[token], /mi-evento/[token], /e/[slug]/[token], /memory/[token],
 * /pago/mock/[checkoutId] o /pago/resultado. Las zonas internas (/admin, /staff) quedan fuera a propósito:
 * su soft-404 está documentado en docs/qa/findings/sales.md (BUG-013 · revisión del patrón).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));
const APP = path.join(ROOT_DIR, "src", "app");
/** Grupos de rutas públicos o por token (indexables o con enlaces que circulan fuera del equipo). */
const PUBLIC_GROUPS = ["(public)", "(experience)", "(auth)"];
const EXT = ["tsx", "ts", "jsx", "js"];

const rel = (p: string) => path.relative(APP, p).replace(/\\/g, "/") || ".";

function routeFile(dir: string, name: string): string | null {
  for (const ext of EXT) {
    const file = path.join(dir, `${name}.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

/** Código sin comentarios (los comentarios mencionan notFound()/Suspense y no cuentan). */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const callsNotFound = (file: string | null) => !!file && /\bnotFound\s*\(\s*\)/.test(code(file));
const usesSuspense = (file: string | null) => !!file && /<Suspense\b/.test(code(file));

function dirs(dir: string): string[] {
  return [
    dir,
    ...readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_") && e.name !== "api")
      .flatMap((e) => dirs(path.join(dir, e.name))),
  ];
}

/** Segmentos desde src/app hasta `dir` (incluido). */
function chain(dir: string): string[] {
  const out: string[] = [];
  for (let d = dir; d.startsWith(APP); d = path.dirname(d)) {
    out.unshift(d);
    if (d === APP) break;
  }
  return out;
}

const ALL_DIRS = dirs(APP);
const inPublicGroup = (dir: string) => PUBLIC_GROUPS.includes(rel(dir).split("/")[0]!);

/** Límites de streaming que envuelven a un layout de `dir`: loading.* o <Suspense> en segmentos ancestros. */
function boundariesAboveLayout(dir: string): string[] {
  const ancestors = chain(dir).slice(0, -1);
  return ancestors.flatMap((d) => {
    const found: string[] = [];
    const loading = routeFile(d, "loading");
    if (loading) found.push(rel(loading));
    const layout = routeFile(d, "layout");
    if (usesSuspense(layout)) found.push(`${rel(layout!)} (<Suspense>)`);
    const template = routeFile(d, "template");
    if (usesSuspense(template)) found.push(`${rel(template!)} (<Suspense>)`);
    return found;
  });
}

/** …y los que envuelven a una página de `dir`: además, el loading.* del propio segmento. */
function boundariesAbovePage(dir: string): string[] {
  const own = routeFile(dir, "loading");
  return [...boundariesAboveLayout(dir), ...(own ? [rel(own)] : [])];
}

/** Layouts que validan con notFound() sin ningún límite de streaming encima: dan un 404 real. */
const GUARD_LAYOUTS = ALL_DIRS.filter((d) => inPublicGroup(d) && callsNotFound(routeFile(d, "layout")));

describe("404 real en rutas públicas y por token (BUG-013)", () => {
  it("ningún layout que valida con notFound() queda dentro de un loading.tsx o <Suspense> ancestro", () => {
    const broken = GUARD_LAYOUTS.flatMap((d) =>
      boundariesAboveLayout(d).map((b) => `${rel(routeFile(d, "layout")!)} queda dentro de ${b}`),
    );
    expect(broken).toEqual([]);
  });

  it("toda página pública/por token que llama notFound() dentro de un límite de carga tiene un layout guardián", () => {
    const soft404: string[] = [];
    for (const d of ALL_DIRS.filter(inPublicGroup)) {
      const page = routeFile(d, "page");
      if (!callsNotFound(page)) continue;
      const boundaries = boundariesAbovePage(d);
      if (boundaries.length === 0) continue; // sin Suspense: el notFound() de la página ya da 404 real
      // El guardián debe estar en el propio segmento o en uno ancestro, y él mismo sin límites encima.
      const guarded = chain(d).some(
        (c) => GUARD_LAYOUTS.includes(c) && boundariesAboveLayout(c).length === 0,
      );
      if (!guarded) soft404.push(`${rel(page!)} (dentro de ${boundaries.join(", ")})`);
    }
    expect(soft404).toEqual([]);
  });

  it("las rutas con slug/token conocidas siguen validando en su layout (control: el contrato no está vacío)", () => {
    expect(GUARD_LAYOUTS.map(rel).sort()).toEqual(
      expect.arrayContaining([
        "(experience)/cotizacion/[token]",
        "(experience)/e/[slug]/[token]",
        "(experience)/memory/[token]",
        "(experience)/mi-evento/[token]",
        "(experience)/pago/mock/[checkoutId]",
        "(public)/experiencias/[slug]",
      ]),
    );
    // /pago/resultado valida en la página: sólo es 404 real porque ningún segmento de su cadena tiene loading.tsx.
    expect(boundariesAbovePage(path.join(APP, "(experience)", "pago", "resultado"))).toEqual([]);
    expect(callsNotFound(routeFile(path.join(APP, "(experience)", "pago", "resultado"), "page"))).toBe(true);
  });

  it("control: el detector sí reconoce un soft-404 (las zonas internas, fuera del contrato, lo tienen)", () => {
    const staffEvent = path.join(APP, "(staff)", "staff", "events", "[id]");
    expect(callsNotFound(routeFile(staffEvent, "page"))).toBe(true);
    expect(boundariesAbovePage(staffEvent)).toEqual(
      expect.arrayContaining(["(staff)/staff/loading.tsx", "(staff)/staff/events/[id]/loading.tsx"]),
    );
  });
});
