#!/usr/bin/env node
/**
 * Genera docs/qa/TEST_COVERAGE_MATRIX.md a partir de resultados REALES de Playwright (results.json),
 * para que la matriz nunca diga algo distinto de lo que se ejecutó.
 *
 * Columnas: | ID | Módulo | Escenario | Rol | Priority | Automated | Result |
 *  - Rol: anotaciones `rol` de evidence(); si no hay, "—".
 *  - Result: PASS / FAIL / FLAKY / BLOCKED / NOT TESTED / NOT APPLICABLE por escenario, combinando proyectos
 *    (navegadores/viewports): el peor resultado manda y se detalla por proyecto cuando difieren.
 *  - Bugs: anotaciones `bug` (IDs provisionales o BUG-XXX), mapeadas con --map docs/qa/.bug-map.json si existe.
 *
 * Uso: node coverage-matrix.mjs --results a.json,b.json [--out docs/qa/TEST_COVERAGE_MATRIX.md] [--title "…"]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const files = arg("results", "test-results/results.json,test-results/global/results.json,test-results/l9/ratelimit/results.json")
  .split(",")
  .map((f) => path.resolve(root, f.trim()))
  .filter((f) => existsSync(f));
if (!files.length) {
  console.error("No hay results.json para construir la matriz.");
  process.exit(2);
}
const out = path.resolve(root, arg("out", "docs/qa/TEST_COVERAGE_MATRIX.md"));
const title = arg("title", "Test Coverage Matrix");
const mapFile = path.resolve(root, arg("map", "docs/qa/.bug-map.json"));
const bugMap = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : {};

const RANK = { FAIL: 6, BLOCKED: 5, FLAKY: 4, "NOT TESTED": 3, "NOT APPLICABLE": 2, PASS: 1 };
const rows = new Map();

function resultOf(t) {
  const ann = t.annotations ?? [];
  const last = t.results?.[t.results.length - 1];
  if (t.status === "skipped") {
    if (ann.some((a) => a.type === "blocked")) return "BLOCKED";
    if (ann.some((a) => a.type === "not-applicable")) return "NOT APPLICABLE";
    return "NOT TESTED";
  }
  if (t.status === "flaky") return "FLAKY";
  if (t.status === "expected") return "PASS";
  if (/browserType\.launch|Executable doesn't exist|spawn UNKNOWN/i.test(last?.error?.message ?? "")) return "BLOCKED";
  return "FAIL";
}

function walk(suites, file) {
  for (const s of suites ?? []) {
    const f = s.file ?? file;
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const tags = [...new Set([...(spec.tags ?? []).map((x) => (x.startsWith("@") ? x : `@${x}`)), ...(spec.title.match(/@[\w:-]+/g) ?? [])])];
        if (t.projectName === "setup" || tags.includes("@infra")) continue;
        const id = spec.title.match(/\[([A-Z0-9]+-\d{3,})\]/)?.[1] ?? null;
        const key = id ?? `${f}::${spec.title}`;
        const ann = t.annotations ?? [];
        const row = rows.get(key) ?? {
          id: id ?? "—",
          module: tags.find((x) => x.startsWith("@module:"))?.slice(8) ?? "—",
          scenario: spec.title.replace(/\[[A-Z0-9]+-\d{3,}\]\s*/, "").replace(/\s*@[\w:-]+/g, "").trim(),
          roles: new Set(),
          priority: tags.find((x) => /^@P[0-3]$/.test(x))?.slice(1) ?? "—",
          file: `tests/e2e/${f}`.replace(/\\/g, "/").replace("tests/e2e/tests/e2e/", "tests/e2e/"),
          perProject: {},
          bugs: new Set(),
        };
        for (const a of ann) {
          if (a.type === "rol" && a.description) row.roles.add(a.description.replace(/\s*\(.*\)$/, ""));
          if (a.type === "bug" && a.description) row.bugs.add(bugMap[a.description] ?? a.description);
        }
        row.perProject[t.projectName] = resultOf(t);
        rows.set(key, row);
      }
    }
    walk(s.suites, f);
  }
}
for (const file of files) walk(JSON.parse(readFileSync(file, "utf8")).suites, undefined);

const list = [...rows.values()].sort((a, b) => (a.id === "—") - (b.id === "—") || a.id.localeCompare(b.id, "es", { numeric: true }));
const totals = {};
const byModule = {};
for (const r of list) {
  const results = Object.values(r.perProject);
  r.result = results.reduce((w, x) => (RANK[x] > RANK[w] ? x : w), "PASS");
  const distinct = [...new Set(results)];
  r.resultText =
    distinct.length > 1
      ? `${r.result} (${Object.entries(r.perProject).map(([p, x]) => `${p}: ${x}`).join(", ")})`
      : `${r.result}${Object.keys(r.perProject).length > 1 ? ` (${Object.keys(r.perProject).join(", ")})` : ""}`;
  if (r.bugs.size) r.resultText += ` — ${[...r.bugs].join(", ")}`;
  totals[r.result] = (totals[r.result] ?? 0) + 1;
  const m = (byModule[r.module] ??= { total: 0 });
  m.total++;
  m[r.result] = (m[r.result] ?? 0) + 1;
}

const esc = (s) => String(s).replace(/\|/g, "\\|");
const states = ["PASS", "FAIL", "FLAKY", "BLOCKED", "NOT TESTED", "NOT APPLICABLE"];
const md = [
  `# ${title}`,
  "",
  `Generado por \`.claude/skills/e2e-quality-gate/scripts/coverage-matrix.mjs\` desde: ${files.map((f) => `\`${path.relative(root, f).split(path.sep).join("/")}\``).join(", ")}.`,
  "Un escenario = una prueba con ID; el resultado combina todos los proyectos donde corrió (el peor manda). FLAKY = pasó sólo al reintentar (no cuenta como PASS).",
  "",
  `**Escenarios:** ${list.length} · ${states.map((s) => `${s}: ${totals[s] ?? 0}`).join(" · ")}`,
  "",
  "## Por módulo",
  "",
  `| Módulo | Total | ${states.join(" | ")} |`,
  `|---|---|${states.map(() => "---").join("|")}|`,
  ...Object.entries(byModule)
    .sort()
    .map(([m, c]) => `| ${m} | ${c.total} | ${states.map((s) => c[s] ?? 0).join(" | ")} |`),
  "",
  "## Escenarios",
  "",
  "| ID | Módulo | Escenario | Rol | Priority | Automated | Result |",
  "|---|---|---|---|---|---|---|",
  ...list.map(
    (r) =>
      `| ${r.id} | ${esc(r.module)} | ${esc(r.scenario)} | ${esc([...r.roles].join(", ") || "—")} | ${r.priority} | ✅ \`${esc(r.file)}\` | ${esc(r.resultText)} |`,
  ),
  "",
].join("\n");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, md);
console.log(`Matriz: ${list.length} escenarios → ${path.relative(root, out)} (${states.map((s) => `${s} ${totals[s] ?? 0}`).join(", ")})`);
