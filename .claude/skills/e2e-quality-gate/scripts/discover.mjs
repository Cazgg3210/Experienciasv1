#!/usr/bin/env node
/**
 * Discovery automático (Phase 0) del proyecto: inventario de páginas, rutas de API, Server Actions con su
 * permiso, roles/permisos, modelos, middleware, pruebas existentes y variables de entorno.
 * No reemplaza leer el código: da un mapa verificable y detecta DRIFT contra la corrida anterior.
 *
 * Uso:  node .claude/skills/e2e-quality-gate/scripts/discover.mjs [--out docs/qa/.discovery]
 * Salida: <out>/inventory.json (+ inventory.prev.json) y un resumen en consola (incluye cambios).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const outArg = process.argv.indexOf("--out");
const outDir = path.join(root, outArg > -1 ? process.argv[outArg + 1] : "docs/qa/.discovery");
const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

function walk(dir, filter, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, filter, acc);
    else if (filter(full)) acc.push(full);
  }
  return acc;
}

/** src/app/(admin)/admin/events/[id]/page.tsx -> /admin/events/[id] */
function routeOf(file, appDir) {
  const parts = rel(path.dirname(file)).replace(rel(appDir), "").split("/").filter(Boolean);
  const route = "/" + parts.filter((p) => !/^\(.*\)$/.test(p)).join("/");
  const group = (parts.find((p) => /^\(.*\)$/.test(p)) || "(root)").replace(/[()]/g, "");
  return { route: route === "/" ? "/" : route.replace(/\/$/, ""), group };
}

const appDir = path.join(root, "src", "app");

// ---------- Páginas ----------
const pages = walk(appDir, (f) => f.endsWith(`${path.sep}page.tsx`)).map((f) => {
  const { route, group } = routeOf(f, appDir);
  const src = read(f);
  const perm = (src.match(/requirePagePermission\("([^"]+)"/) || [])[1] || null;
  return {
    route,
    group,
    file: rel(f),
    dynamic: /\[.+\]/.test(route),
    permission: perm,
    forceDynamic: /dynamic\s*=\s*["']force-dynamic["']/.test(src),
  };
});

// ---------- Rutas de API / route handlers ----------
const apis = walk(appDir, (f) => f.endsWith(`${path.sep}route.ts`)).map((f) => {
  const { route } = routeOf(f, appDir);
  const src = read(f);
  const methods = new Set([...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]));
  for (const m of src.matchAll(/export\s+const\s+\{\s*([A-Z,\s]+)\}/g)) m[1].split(",").forEach((x) => x.trim() && methods.add(x.trim()));
  return {
    route,
    file: rel(f),
    methods: [...methods],
    checksSession: /getCurrentUser|requirePermission|auth\(\)/.test(src),
    checksOrigin: /isSameOrigin/.test(src),
    checksSignature: /verifyWebhook|signature|CRON_SECRET|timingSafeEqual|safeEqual/.test(src),
    rateLimited: /rateLimit\(/.test(src),
  };
});

// ---------- Server Actions ----------
const actionFiles = walk(path.join(root, "src"), (f) => /\.(ts|tsx)$/.test(f) && /^\s*["']use server["']/m.test(read(f)));
const actions = [];
for (const f of actionFiles) {
  const src = read(f);
  const re = /export\s+const\s+(\w+)\s*=\s*(protectedAction|publicAction)\s*\(\s*\{([\s\S]*?)\}\s*,/g;
  let m;
  while ((m = re.exec(src))) {
    const cfg = m[3];
    actions.push({
      name: m[1],
      kind: m[2] === "protectedAction" ? "protected" : "public",
      action: (cfg.match(/name:\s*["']([^"']+)["']/) || [])[1] || null,
      permission: (cfg.match(/permission:\s*["']([^"']+)["']/) || [])[1] || null,
      rateLimit: /rateLimit/.test(cfg) || m[2] === "publicAction",
      file: rel(f),
    });
  }
  for (const fm of src.matchAll(/export\s+async\s+function\s+(\w+)/g)) {
    if (!actions.some((a) => a.name === fm[1] && a.file === rel(f))) actions.push({ name: fm[1], kind: "raw-function", action: null, permission: null, rateLimit: false, file: rel(f) });
  }
}

// ---------- Roles y permisos ----------
const permSrc = read(path.join(root, "src/server/auth/permissions.ts"));
const arr = (name) => {
  const m = permSrc.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
};
const roles = { roles: arr("ROLES"), permissions: arr("PERMISSIONS"), staffPermissions: arr("STAFF_PERMISSIONS"), ownerExcludes: (permSrc.match(/OWNER_PERMISSIONS[^;]*filter\(\(p\) => p !== "([^"]+)"/) || [])[1] || null };

// ---------- Datos, middleware, pruebas, entorno ----------
const schema = read(path.join(root, "prisma/schema.prisma"));
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
const enums = [...schema.matchAll(/^enum\s+(\w+)/gm)].map((m) => m[1]);
const middleware = read(path.join(root, "src/middleware.ts"));
const e2eSpecs = walk(path.join(root, "tests/e2e"), (f) => f.endsWith(".spec.ts"));
const tags = {};
for (const f of e2eSpecs) for (const t of read(f).matchAll(/@(P[0-3]|smoke|critical|auth|permissions|negative|regression|mobile|responsive|a11y|infra|module:[\w-]+)/g)) tags[t[0]] = (tags[t[0]] || 0) + 1;
const pkg = JSON.parse(read(path.join(root, "package.json")) || "{}");

const inventory = {
  generatedAt: new Date().toISOString(),
  stack: {
    next: pkg.dependencies?.next,
    react: pkg.dependencies?.react,
    prisma: pkg.devDependencies?.prisma || pkg.dependencies?.["@prisma/client"],
    nextAuth: pkg.dependencies?.["next-auth"],
    playwright: pkg.devDependencies?.["@playwright/test"],
    axe: pkg.devDependencies?.["@axe-core/playwright"] || null,
    packageManager: pkg.packageManager,
  },
  counts: {
    pages: pages.length,
    pagesByGroup: pages.reduce((a, p) => ((a[p.group] = (a[p.group] || 0) + 1), a), {}),
    apiRoutes: apis.length,
    serverActions: actions.filter((a) => a.kind !== "raw-function").length,
    protectedActions: actions.filter((a) => a.kind === "protected").length,
    publicActions: actions.filter((a) => a.kind === "public").length,
    rawServerFunctions: actions.filter((a) => a.kind === "raw-function").length,
    models: models.length,
    enums: enums.length,
    unitTestFiles: walk(path.join(root, "src"), (f) => f.endsWith(".test.ts")).length + walk(path.join(root, "tests/unit"), (f) => f.endsWith(".test.ts")).length,
    integrationTestFiles: walk(path.join(root, "tests/integration"), (f) => f.endsWith(".test.ts")).length,
    e2eSpecFiles: e2eSpecs.length,
  },
  roles,
  pages,
  apis,
  actions,
  models,
  middleware: {
    protectsAdmin: /\/admin/.test(middleware),
    protectsStaff: /\/staff/.test(middleware),
    tokenPrefixes: (middleware.match(/TOKEN_PREFIXES\s*=\s*\[([^\]]*)\]/) || [])[1]?.match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) || [],
  },
  e2e: { specs: e2eSpecs.map(rel), tags },
  env: [...read(path.join(root, ".env.example")).matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]),
  scripts: Object.fromEntries(Object.entries(pkg.scripts || {}).filter(([k]) => /test|e2e|qa|db:/.test(k))),
};

// ---------- Drift contra la corrida anterior ----------
mkdirSync(outDir, { recursive: true });
const current = path.join(outDir, "inventory.json");
let drift = null;
if (existsSync(current)) {
  const prev = JSON.parse(read(current));
  const diff = (a, b, key) => {
    const A = new Set(a.map(key));
    const B = new Set(b.map(key));
    return { added: [...B].filter((x) => !A.has(x)), removed: [...A].filter((x) => !B.has(x)) };
  };
  drift = {
    since: prev.generatedAt,
    pages: diff(prev.pages, inventory.pages, (p) => p.route),
    apis: diff(prev.apis, inventory.apis, (p) => `${p.route} ${p.methods.join(",")}`),
    actions: diff(prev.actions, inventory.actions, (a) => `${a.file}#${a.name}:${a.permission ?? a.kind}`),
    models: diff(prev.models.map((m) => ({ m })), inventory.models.map((m) => ({ m })), (x) => x.m),
  };
  renameSync(current, path.join(outDir, "inventory.prev.json"));
}
inventory.drift = drift;
writeFileSync(current, JSON.stringify(inventory, null, 2));

// ---------- Resumen ----------
const c = inventory.counts;
console.log(`\nDISCOVERY — ${inventory.generatedAt}`);
console.log(`Stack: Next ${inventory.stack.next} · React ${inventory.stack.react} · Prisma ${inventory.stack.prisma} · Auth.js ${inventory.stack.nextAuth} · Playwright ${inventory.stack.playwright} · axe ${inventory.stack.axe ?? "no"}`);
console.log(`Páginas: ${c.pages} ${JSON.stringify(c.pagesByGroup)} · API: ${c.apiRoutes} · Server Actions: ${c.serverActions} (${c.protectedActions} protegidas, ${c.publicActions} públicas) · funciones "use server" sin wrapper: ${c.rawServerFunctions}`);
console.log(`Modelos: ${c.models} · Enums: ${c.enums} · Roles: ${roles.roles.join(", ")} · Permisos: ${roles.permissions.length} (STAFF: ${roles.staffPermissions.join(", ")})`);
console.log(`Pruebas: unit ${c.unitTestFiles} archivos · integración ${c.integrationTestFiles} · E2E ${c.e2eSpecFiles} specs · etiquetas E2E ${JSON.stringify(tags)}`);
const noPerm = pages.filter((p) => p.group === "admin" && !p.permission);
if (noPerm.length) console.log(`⚠ Páginas admin sin requirePagePermission visible (revisar layout/guard): ${noPerm.map((p) => p.route).join(", ")}`);
const unguardedApi = apis.filter((a) => a.methods.some((m) => m !== "GET") && !a.checksSession && !a.checksSignature && !a.checksOrigin);
if (unguardedApi.length) console.log(`⚠ Route handlers con escritura sin sesión/firma/origen visibles: ${unguardedApi.map((a) => a.route).join(", ")}`);
const raw = actions.filter((a) => a.kind === "raw-function");
if (raw.length) console.log(`⚠ Funciones de servidor exportadas sin protectedAction/publicAction (revisar autorización manual): ${raw.map((a) => `${a.file}#${a.name}`).join(", ")}`);
if (drift) {
  const n = (d) => d.added.length + d.removed.length;
  console.log(`\nDRIFT desde ${drift.since}: páginas ±${n(drift.pages)} · API ±${n(drift.apis)} · acciones ±${n(drift.actions)} · modelos ±${n(drift.models)}`);
  for (const [k, d] of Object.entries(drift)) {
    if (k === "since" || !n(d)) continue;
    if (d.added.length) console.log(`  + ${k}: ${d.added.join(" | ")}`);
    if (d.removed.length) console.log(`  - ${k}: ${d.removed.join(" | ")}`);
  }
} else {
  console.log("\n(Primera corrida de discovery: sin comparación de drift.)");
}
console.log(`\nInventario: ${rel(current)}`);
