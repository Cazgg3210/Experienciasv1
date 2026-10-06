/**
 * Revisión automática de accesibilidad con axe-core (WCAG 2.0/2.1 A y AA, incluye contraste).
 * Complementa —no sustituye— las pruebas de teclado/foco/modales que se escriben a mano.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

export type A11yOptions = {
  /** Limitar a una región (p. ej. "main"). */
  include?: string;
  /** Excluir regiones con ruido conocido y documentado. */
  exclude?: string[];
  /** Reglas a omitir SÓLO con justificación en la prueba (queda en el reporte). */
  disableRules?: string[];
  /** Impactos que hacen fallar. Por defecto: critical y serious. */
  failOn?: Array<"minor" | "moderate" | "serious" | "critical">;
};

export async function scanA11y(page: Page, testInfo: TestInfo, opts: A11yOptions = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (opts.include) builder = builder.include(opts.include);
  for (const sel of opts.exclude ?? []) builder = builder.exclude(sel);
  if (opts.disableRules?.length) builder = builder.disableRules(opts.disableRules);
  const results = await builder.analyze();
  const failOn = opts.failOn ?? ["critical", "serious"];
  const blocking = results.violations.filter((v) => v.impact && failOn.includes(v.impact as never));
  await testInfo.attach("a11y-axe.json", {
    body: JSON.stringify(
      {
        url: page.url(),
        disabledRules: opts.disableRules ?? [],
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
        })),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  return { all: results.violations, blocking };
}
