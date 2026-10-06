#!/usr/bin/env node
/**
 * Calcula el Quality Gate a partir de resultados REALES (no a ojo):
 *  - reporte JSON de Playwright (test-results/results.json; varios con --results a,b,c)
 *  - docs/qa/BUG_REPORT.md (Severity / Status de cada BUG-XXX)
 *
 * Reglas:
 *  - Resultado por escenario: PASS | FAIL | FLAKY (falló y pasó al reintentar = POTENTIAL FLAKY, NO es PASS)
 *    | BLOCKED (skip con anotación "blocked") | NOT APPLICABLE (anotación "not-applicable") | NOT TESTED (otros skip).
 *  - Pass rate = PASS / (PASS + FAIL + FLAKY). Cobertura = ejecutadas / (ejecutadas + BLOCKED + NOT TESTED).
 *  - Se excluyen proyecto "setup" y etiqueta @infra (si fallan => entorno BLOQUEADO).
 *  - Prioridad por etiqueta @P0..@P3; recorridos críticos = @critical; módulo = @module:<nombre>.
 *
 * Veredicto (nunca READY con Blocker/Critical abiertos):
 *  🔴 BLOCKED          Blocker abierto, infraestructura/sesiones fallidas, sin pruebas evaluables, o un recorrido crítico FAIL/BLOCKED.
 *  🟠 NOT RECOMMENDED  Critical abierto, P0 < 100%, falla de autorización (@permissions FAIL) o ≥ 3 High abiertos.
 *  🟡 READY WITH CONDITIONS  P0 100% sin Blocker/Critical, pero hay High/Medium abiertos, pruebas FLAKY,
 *                     P1 < 95% o P0/P1 sin probar.
 *  🟢 READY            P0 100%, recorridos críticos 100%, P1 ≥ 95%, sin Blocker/Critical/High abiertos ni FLAKY P0/P1.
 *
 * Uso: node quality-gate.mjs [--results test-results/results.json] [--bugs docs/qa/BUG_REPORT.md]
 *                            [--mode full] [--out docs/qa/runs] [--commit <sha>]
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
// Por defecto: suite regular (carril 0) + suites especiales que existan (global, ratelimit en carril 9).
const resultFiles = arg("results", "test-results/results.json,test-results/global/results.json,test-results/l9/ratelimit/results.json")
  .split(",")
  .map((f) => path.resolve(root, f.trim()));
const bugsFile = path.resolve(root, arg("bugs", "docs/qa/BUG_REPORT.md"));
const mode = arg("mode", "full");
const outBase = path.resolve(root, arg("out", "docs/qa/runs"));

// ---------- Leer resultados de Playwright ----------
const scenarios = [];
let infraFailed = false;
const missing = resultFiles.filter((f) => !existsSync(f));
if (missing.length === resultFiles.length) {
  console.error(`No hay resultados de Playwright (${missing.join(", ")}). Ejecuta las pruebas primero.`);
  process.exit(2);
}

function walkSuites(suites, file) {
  for (const s of suites ?? []) {
    const f = s.file ?? file;
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const tags = [...new Set([...(spec.tags ?? []).map((x) => (x.startsWith("@") ? x : `@${x}`)), ...(spec.title.match(/@[\w:-]+/g) ?? [])])];
        const annotations = t.annotations ?? [];
        const last = t.results?.[t.results.length - 1];
        const isInfra = t.projectName === "setup" || tags.includes("@infra");
        let result;
        if (t.status === "skipped") {
          if (annotations.some((a) => a.type === "blocked")) result = "BLOCKED";
          else if (annotations.some((a) => a.type === "not-applicable")) result = "NOT APPLICABLE";
          else result = "NOT TESTED";
        } else if (t.status === "flaky") result = "FLAKY";
        else if (t.status === "expected") result = "PASS";
        // El navegador no arrancó: ningún paso de la prueba corrió ⇒ ENVIRONMENT ISSUE, no FAIL de la app.
        else if (/browserType\.launch|Executable doesn't exist|spawn UNKNOWN/i.test(last?.error?.message ?? "")) result = "BLOCKED";
        else result = "FAIL";
        if (isInfra) {
          if (result === "FAIL") infraFailed = true;
          continue;
        }
        const idMatch = spec.title.match(/\[([A-Z0-9]+-\d{3,})\]/);
        scenarios.push({
          id: idMatch?.[1] ?? null,
          title: spec.title.replace(/\s*@[\w:-]+/g, "").trim(),
          file: f,
          project: t.projectName,
          tags,
          priority: tags.find((x) => /^@P[0-3]$/.test(x))?.slice(1) ?? "UNTAGGED",
          module: tags.find((x) => x.startsWith("@module:"))?.slice(8) ?? "sin-modulo",
          critical: tags.includes("@critical"),
          permissions: tags.includes("@permissions"),
          result,
          bugs: annotations.filter((a) => a.type === "bug").map((a) => a.description),
          error: last?.error?.message?.split("\n")[0]?.slice(0, 240) ?? null,
          durationMs: (t.results ?? []).reduce((s, r) => s + (r.duration ?? 0), 0),
        });
      }
    }
    walkSuites(s.suites, f);
  }
}
for (const file of resultFiles.filter((f) => existsSync(f))) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  walkSuites(json.suites, undefined);
}

// ---------- Métricas ----------
function stats(list) {
  const c = { PASS: 0, FAIL: 0, FLAKY: 0, BLOCKED: 0, "NOT TESTED": 0, "NOT APPLICABLE": 0 };
  for (const s of list) c[s.result]++;
  const executed = c.PASS + c.FAIL + c.FLAKY;
  const coverageBase = executed + c.BLOCKED + c["NOT TESTED"];
  return {
    total: list.length,
    ...c,
    passRate: executed ? +((c.PASS / executed) * 100).toFixed(1) : null,
    coverage: coverageBase ? +((executed / coverageBase) * 100).toFixed(1) : null,
  };
}
const byPriority = Object.fromEntries(["P0", "P1", "P2", "P3", "UNTAGGED"].map((p) => [p, stats(scenarios.filter((s) => s.priority === p))]));
const critical = stats(scenarios.filter((s) => s.critical));
const permissions = stats(scenarios.filter((s) => s.permissions));
const overall = stats(scenarios);
const byModule = {};
for (const s of scenarios) (byModule[s.module] ??= []).push(s);
const moduleStats = Object.fromEntries(Object.entries(byModule).map(([m, l]) => [m, stats(l)]));
const byProject = {};
for (const s of scenarios) (byProject[s.project] ??= []).push(s);
const projectStats = Object.fromEntries(Object.entries(byProject).map(([p, l]) => [p, stats(l)]));

// ---------- Bugs ----------
const bugs = [];
if (existsSync(bugsFile)) {
  const md = readFileSync(bugsFile, "utf8");
  const blocks = md.split(/^## (?=BUG-\d+)/m).slice(1);
  for (const b of blocks) {
    const head = b.split("\n")[0].trim();
    const field = (name) => (b.match(new RegExp(`^\\**${name}\\**:\\s*\\**([^\\n*]+)`, "mi")) || [])[1]?.trim() ?? null;
    bugs.push({
      id: head.match(/^(BUG-\d+)/)?.[1],
      title: head.replace(/^BUG-\d+\s*[—-]\s*/, ""),
      severity: (field("Severity") ?? "UNKNOWN").toUpperCase(),
      status: (field("Status") ?? "Open").toLowerCase(),
      module: field("Module"),
    });
  }
}
const open = bugs.filter((b) => !/^(fixed|verified|closed|won'?t fix|duplicate|not a bug)/.test(b.status));
const openBy = Object.fromEntries(["BLOCKER", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => [s, open.filter((b) => b.severity === s).length]));

// ---------- Veredicto ----------
const reasons = [];
let verdict = "🟢 READY";
const p0 = byPriority.P0;
const p1 = byPriority.P1;
const criticalBroken = critical.FAIL + critical.BLOCKED;
if (infraFailed) reasons.push("La infraestructura E2E o las sesiones por rol fallaron (resultados no confiables).");
if (!scenarios.length) reasons.push("No se ejecutó ninguna prueba evaluable (sólo @infra/setup o nada).");
if (openBy.BLOCKER) reasons.push(`${openBy.BLOCKER} bug(s) BLOCKER abiertos.`);
if (criticalBroken) reasons.push(`${criticalBroken} recorrido(s) crítico(s) en FAIL/BLOCKED.`);
if (reasons.length) verdict = "🔴 BLOCKED";
else {
  if (openBy.CRITICAL) reasons.push(`${openBy.CRITICAL} bug(s) CRITICAL abiertos.`);
  if (p0.total && p0.passRate !== 100) reasons.push(`P0 pass rate ${p0.passRate}% (< 100%).`);
  if (permissions.FAIL) reasons.push(`${permissions.FAIL} prueba(s) de autorización en FAIL.`);
  if (openBy.HIGH >= 3) reasons.push(`${openBy.HIGH} bugs HIGH abiertos.`);
  if (reasons.length) verdict = "🟠 NOT RECOMMENDED";
  else {
    if (openBy.HIGH) reasons.push(`${openBy.HIGH} bug(s) HIGH abiertos.`);
    if (openBy.MEDIUM) reasons.push(`${openBy.MEDIUM} bug(s) MEDIUM abiertos.`);
    const flakyP01 = p0.FLAKY + p1.FLAKY;
    if (flakyP01) reasons.push(`${flakyP01} prueba(s) P0/P1 POTENTIAL FLAKY.`);
    if (p1.total && p1.passRate !== null && p1.passRate < 95) reasons.push(`P1 pass rate ${p1.passRate}% (< 95%).`);
    const untested = p0.BLOCKED + p0["NOT TESTED"] + p1.BLOCKED + p1["NOT TESTED"];
    if (untested) reasons.push(`${untested} escenario(s) P0/P1 BLOCKED o NOT TESTED.`);
    if (!p0.total) reasons.push("No hay pruebas P0 en esta corrida.");
    if (byPriority.UNTAGGED.total) reasons.push(`${byPriority.UNTAGGED.total} prueba(s) sin prioridad (@P0..@P3).`);
    if (reasons.length) verdict = "🟡 READY WITH CONDITIONS";
  }
}

let commit = arg("commit", null);
if (!commit) {
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    commit = "desconocido";
  }
}
const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
const gate = {
  generatedAt: now.toISOString(),
  mode,
  commit,
  verdict,
  reasons,
  overall,
  criticalJourneys: critical,
  byPriority,
  permissions,
  byProject: projectStats,
  byModule: moduleStats,
  bugs: { total: bugs.length, open: open.length, openBySeverity: openBy, list: bugs },
  failures: scenarios.filter((s) => s.result === "FAIL").map(({ id, title, project, priority, module, error, bugs: b }) => ({ id, title, project, priority, module, error, bugs: b })),
  flaky: scenarios.filter((s) => s.result === "FLAKY").map(({ id, title, project, priority }) => ({ id, title, project, priority })),
  blocked: scenarios.filter((s) => s.result === "BLOCKED").map(({ id, title, project }) => ({ id, title, project })),
};

const pct = (v) => (v === null ? "—" : `${v}%`);
const row = (name, s) => `| ${name} | ${s.total} | ${s.PASS} | ${s.FAIL} | ${s.FLAKY} | ${s.BLOCKED} | ${s["NOT TESTED"]} | ${pct(s.passRate)} | ${pct(s.coverage)} |`;
const md = [
  `## Final Quality Gate — ${verdict}`,
  "",
  `Modo: **${mode}** · Commit: \`${commit}\` · Fecha: ${now.toISOString()}`,
  "",
  reasons.length ? reasons.map((r) => `- ${r}`).join("\n") : "- Sin condiciones pendientes.",
  "",
  "| Grupo | Total | PASS | FAIL | FLAKY | BLOCKED | NOT TESTED | Pass rate | Cobertura |",
  "|---|---|---|---|---|---|---|---|---|",
  row("**Overall**", overall),
  row("Recorridos críticos", critical),
  row("P0", byPriority.P0),
  row("P1", byPriority.P1),
  row("P2", byPriority.P2),
  row("P3", byPriority.P3),
  row("Autorización (@permissions)", permissions),
  ...Object.entries(projectStats).map(([p, s]) => row(`Navegador: ${p}`, s)),
  "",
  `Bugs abiertos — Blocker: ${openBy.BLOCKER} · Critical: ${openBy.CRITICAL} · High: ${openBy.HIGH} · Medium: ${openBy.MEDIUM} · Low: ${openBy.LOW} (total registrados: ${bugs.length})`,
  "",
  "### Por módulo",
  "| Módulo | Total | PASS | FAIL | FLAKY | BLOCKED | NOT TESTED | Pass rate | Cobertura |",
  "|---|---|---|---|---|---|---|---|---|",
  ...Object.entries(moduleStats).sort().map(([m, s]) => row(m, s)),
].join("\n");

const outDir = path.join(outBase, `${stamp}-${mode}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "gate.json"), JSON.stringify(gate, null, 2));
writeFileSync(path.join(outDir, "gate.md"), md + "\n");
console.log(md);
console.log(`\nResultados leídos: ${resultFiles.filter((f) => existsSync(f)).map((f) => path.relative(root, f)).join(", ")}`);
console.log(`Guardado en ${path.relative(root, outDir).split(path.sep).join("/")}/ (gate.json, gate.md)`);
