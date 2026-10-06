#!/usr/bin/env node
/**
 * Verificación previa (Phase 0): el entorno es seguro y apto para correr el quality gate.
 * BLOQUEANTE (exit 1): base E2E no local o sin "e2e", E2E_BASE_URL remota, Postgres inalcanzable,
 * Chromium o @playwright/test ausentes. Avisos (no bloquean): Firefox/WebKit, axe-core, almacenamiento S3,
 * cambios sin commit (el servidor E2E se reconstruye solo).
 *
 * Uso: node .claude/skills/e2e-quality-gate/scripts/preflight.mjs [--cross-browser]
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const crossBrowser = process.argv.includes("--cross-browser") || process.env.E2E_CROSS_BROWSER === "1";
const blockers = [];
const warnings = [];
const ok = [];

function loadEnv() {
  const file = path.join(root, ".env");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };

function tcp(host, port, timeout = 2500) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(timeout, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

// 1. Node
const major = Number(process.versions.node.split(".")[0]);
(major >= 20 ? ok : blockers).push(`Node ${process.versions.node} (requiere ≥ 20)`);

// 2. .env y base E2E (candado de seguridad)
if (!existsSync(path.join(root, ".env"))) blockers.push("No existe .env (copia .env.example).");
const dbUrl = env.E2E_DATABASE_URL;
let dbHost = null;
let dbPort = 5432;
if (!dbUrl) blockers.push("E2E_DATABASE_URL no está definida.");
else {
  const u = new URL(dbUrl);
  dbHost = u.hostname;
  dbPort = Number(u.port || 5432);
  const local = ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(u.hostname);
  if (!local && env.E2E_ALLOW_REMOTE_DB !== "true") blockers.push(`E2E_DATABASE_URL apunta a ${u.hostname}: sólo bases locales.`);
  else if (!/e2e/i.test(u.pathname)) blockers.push(`La base ${u.pathname} no contiene "e2e": se protege para no destruir datos.`);
  else ok.push(`Base E2E: ${u.hostname}:${dbPort}${u.pathname}`);
  if (env.DATABASE_URL && env.DATABASE_URL === dbUrl) warnings.push("DATABASE_URL y E2E_DATABASE_URL son iguales: las pruebas re-siembran esa base.");
}

// 3. URL objetivo (nunca producción para pruebas destructivas)
if (env.E2E_BASE_URL) {
  const u = new URL(env.E2E_BASE_URL);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname) || u.hostname.endsWith(".localhost") || u.hostname.endsWith(".test");
  if (!local) {
    if (env.E2E_ALLOW_REMOTE === "readonly") warnings.push(`E2E_BASE_URL remota (${u.host}) en modo SÓLO LECTURA: ejecuta únicamente pruebas @smoke sin escrituras.`);
    else blockers.push(`E2E_BASE_URL apunta a ${u.host}. Prohibido correr el gate contra un servidor remoto/producción.`);
  } else ok.push(`Servidor objetivo: ${env.E2E_BASE_URL}`);
} else ok.push(`Servidor objetivo: build de producción local en :${env.E2E_PORT ?? 3200} (scripts/e2e-server.mjs)`);

// 4. Postgres alcanzable
if (dbHost) {
  const up = await tcp(dbHost === "::1" ? "127.0.0.1" : dbHost, dbPort);
  if (up) ok.push(`Postgres responde en ${dbHost}:${dbPort}`);
  else blockers.push(`Postgres no responde en ${dbHost}:${dbPort}. ¿Docker Desktop está encendido? (docker compose up -d db storage)`);
}

// 5. Almacenamiento S3 (subidas) — aviso
if ((env.STORAGE_DRIVER ?? "s3") === "s3" && env.STORAGE_ENDPOINT) {
  try {
    const u = new URL(env.STORAGE_ENDPOINT);
    const up = await tcp(u.hostname, Number(u.port || (u.protocol === "https:" ? 443 : 80)));
    (up ? ok : warnings).push(up ? `Almacenamiento S3 responde (${u.host})` : `Almacenamiento S3 no responde (${u.host}): las pruebas de subida quedarán BLOCKED.`);
  } catch {
    warnings.push("STORAGE_ENDPOINT inválido.");
  }
}

// 6. Playwright y navegadores
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
if (!pkg.devDependencies?.["@playwright/test"]) blockers.push("@playwright/test no está en devDependencies.");
else ok.push(`@playwright/test ${pkg.devDependencies["@playwright/test"]}`);
(pkg.devDependencies?.["@axe-core/playwright"] ? ok : warnings).push(
  pkg.devDependencies?.["@axe-core/playwright"] ? "@axe-core/playwright instalado (accesibilidad)" : "@axe-core/playwright no instalado: accesibilidad sólo manual.",
);
const browsersDir =
  env.PLAYWRIGHT_BROWSERS_PATH ||
  (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local", "ms-playwright")
    : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
      : path.join(os.homedir(), ".cache", "ms-playwright"));
const installed = existsSync(browsersDir) ? readdirSync(browsersDir) : [];
const has = (b) => installed.some((d) => d.startsWith(`${b}-`));
(has("chromium") ? ok : blockers).push(has("chromium") ? "Chromium instalado" : "Chromium no instalado: pnpm exec playwright install chromium");
for (const b of ["firefox", "webkit"]) {
  if (has(b)) ok.push(`${b} instalado`);
  else (crossBrowser ? blockers : warnings).push(`${b} no instalado (cross-browser P0): pnpm exec playwright install ${b}`);
}

// 7. Git (informativo)
try {
  const dirty = execSync("git status --porcelain", { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean).length;
  const head = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
  ok.push(`Git ${head}${dirty ? ` (+${dirty} cambios sin commit: el build E2E se reconstruye)` : ""}`);
} catch {
  warnings.push("Sin git: el servidor E2E se reconstruirá en cada corrida.");
}

console.log("\nPREFLIGHT — E2E Quality Gate");
for (const m of ok) console.log(`  ✔ ${m}`);
for (const m of warnings) console.log(`  ⚠ ${m}`);
for (const m of blockers) console.log(`  ✖ ${m}`);
console.log(blockers.length ? `\nRESULTADO: BLOQUEADO (${blockers.length}) — problema de ENTORNO, no de la aplicación.` : "\nRESULTADO: listo para ejecutar.");
process.exit(blockers.length ? 1 : 0);
