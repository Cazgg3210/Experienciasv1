#!/usr/bin/env node
/**
 * Ivonne & Rosa — preparación del entorno de desarrollo (multiplataforma: Windows/macOS/Linux).
 *
 *   pnpm db:setup                 → todo: .env, Docker, migraciones, cliente, bucket, base de pruebas y seed DEMO
 *   pnpm db:setup --skip-seed     → igual pero sin seed (no toca los datos existentes)
 *   pnpm db:setup --seed-base     → usa el seed BASE (idempotente) en lugar del DEMO
 *   pnpm db:setup --skip-docker   → no levanta contenedores (usa una base/almacenamiento ya existentes)
 *
 * Otras opciones: --skip-storage, --skip-test-db, --skip-generate, --wait <segundos>, --help
 *
 * Pasos:
 *   1. Copia .env.example → .env si no existe.
 *   2. Si DATABASE_URL apunta a localhost y Docker está disponible: `docker compose up -d db storage`.
 *   3. Espera a que PostgreSQL acepte conexiones (hasta 60 s).
 *   4. prisma migrate deploy  ·  5. prisma generate
 *   6. Bucket S3 (scripts/storage-init.ts) — se omite con aviso si STORAGE_DRIVER=local o no responde.
 *   7. Base de pruebas (scripts/prepare-test-db.mjs) si TEST_DATABASE_URL está definida.
 *   8. Seed (pnpm db:seed) salvo --skip-seed.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal"]);

// ---------------------------------------------------------------------------------------------
// Utilidades puras (exportadas para pruebas)
// ---------------------------------------------------------------------------------------------

/** Interpreta los argumentos de línea de comandos. Lanza Error con mensaje en español si son inválidos. */
export function parseArgs(argv) {
  const opts = {
    skipSeed: false,
    seedBase: false,
    skipDocker: false,
    skipStorage: false,
    skipTestDb: false,
    skipGenerate: false,
    waitSeconds: 60,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--skip-seed":
        opts.skipSeed = true;
        break;
      case "--seed-base":
        opts.seedBase = true;
        break;
      case "--skip-docker":
        opts.skipDocker = true;
        break;
      case "--skip-storage":
        opts.skipStorage = true;
        break;
      case "--skip-test-db":
        opts.skipTestDb = true;
        break;
      case "--skip-generate":
        opts.skipGenerate = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "--wait": {
        const value = Number(argv[++i]);
        if (!Number.isFinite(value) || value < 1 || value > 600) {
          throw new Error("--wait espera un número de segundos entre 1 y 600");
        }
        opts.waitSeconds = Math.round(value);
        break;
      }
      default:
        if (arg.startsWith("--wait=")) {
          opts.waitSeconds = parseArgs(["--wait", arg.slice("--wait=".length)]).waitSeconds;
          break;
        }
        throw new Error(`Opción desconocida: ${arg} (usa --help)`);
    }
  }
  if (opts.skipSeed && opts.seedBase) throw new Error("--skip-seed y --seed-base no pueden usarse juntas");
  return opts;
}

/** Extrae host/puerto/base de una URL de PostgreSQL. Devuelve null si no es válida. */
export function parseDatabaseUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (!host) return null;
    return {
      host,
      port: u.port ? Number(u.port) : 5432,
      database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
      user: decodeURIComponent(u.username || ""),
    };
  } catch {
    return null;
  }
}

/** ¿El host corresponde a esta máquina (y por tanto a los contenedores de docker-compose.yml)? */
export function isLocalHost(host) {
  return LOCAL_HOSTS.has(String(host).toLowerCase());
}

/** Oculta la contraseña de una URL para imprimirla en consola. */
export function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return "(URL inválida)";
  }
}

/** Servicios de docker-compose.yml que hay que levantar según la configuración. */
export function servicesToStart(env) {
  const services = [];
  const db = parseDatabaseUrl(env.DATABASE_URL);
  if (db && isLocalHost(db.host)) services.push("db");
  const driver = (env.STORAGE_DRIVER || "s3").toLowerCase();
  if (driver === "s3") {
    const endpoint = env.STORAGE_ENDPOINT;
    let local = false;
    try {
      local = !!endpoint && isLocalHost(new URL(endpoint).hostname.replace(/^\[|\]$/g, ""));
    } catch {
      local = false;
    }
    if (local) services.push("storage");
  }
  return services;
}

/**
 * Verifica que un servidor PostgreSQL responda en host:puerto enviando un SSLRequest
 * (protocolo de PostgreSQL). Un simple "puerto abierto" no basta: docker-proxy acepta la
 * conexión TCP aunque el contenedor aún esté inicializando. Responde 'S' o 'N' si es Postgres.
 */
export function probePostgres(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("connect", () => {
      const buf = Buffer.alloc(8);
      buf.writeInt32BE(8, 0);
      buf.writeInt32BE(80877103, 4); // SSLRequest
      socket.write(buf);
    });
    socket.once("data", (data) => finish(data.length >= 1 && (data[0] === 0x53 || data[0] === 0x4e)));
    socket.once("close", () => finish(false));
  });
}

// ---------------------------------------------------------------------------------------------
// Consola
// ---------------------------------------------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: paint("1"),
  dim: paint("2"),
  green: paint("32"),
  yellow: paint("33"),
  red: paint("31"),
  cyan: paint("36"),
};

let stepNo = 0;
const TOTAL_STEPS = 8;
const step = (title) => console.log(`\n${c.cyan(`[${++stepNo}/${TOTAL_STEPS}]`)} ${c.bold(title)}`);
const ok = (msg) => console.log(`  ${c.green("✓")} ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow("!")} ${msg}`);
const info = (msg) => console.log(`  ${c.dim("·")} ${msg}`);
const skip = (msg) => console.log(`  ${c.dim("–")} ${c.dim(msg)}`);

class SetupError extends Error {}

const IS_WINDOWS = process.platform === "win32";

/**
 * spawnSync multiplataforma. En Windows npx/pnpm son .cmd y requieren shell: se pasa la línea
 * completa (los argumentos de este script son literales fijos, sin espacios ni comillas).
 */
function spawn(command, args, options) {
  if (IS_WINDOWS) return spawnSync([command, ...args].join(" "), { ...options, shell: true });
  return spawnSync(command, args, options);
}

/** Ejecuta un comando heredando la consola. Devuelve el código de salida. */
function run(command, args, { env, quiet = false } = {}) {
  info(c.dim(`$ ${[command, ...args].join(" ")}`));
  const res = spawn(command, args, {
    cwd: ROOT,
    stdio: quiet ? "pipe" : "inherit",
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  if (res.error) return { status: 1, output: String(res.error.message) };
  return { status: res.status ?? 1, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

function commandWorks(command, args) {
  const res = spawn(command, args, { cwd: ROOT, stdio: "ignore" });
  return !res.error && res.status === 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Gestor de paquetes con el que se invocó el script (pnpm por defecto). */
function packageManager() {
  const ua = process.env.npm_config_user_agent || "";
  if (ua.startsWith("npm/")) return "npm";
  if (ua.startsWith("yarn/")) return "yarn";
  return "pnpm";
}

// ---------------------------------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------------------------------

async function loadEnv() {
  const file = path.join(ROOT, ".env");
  try {
    const { config } = await import("dotenv");
    config({ path: file, quiet: true });
  } catch {
    // dotenv es devDependency; si no está, Node >= 20.12 trae process.loadEnvFile
    try {
      process.loadEnvFile?.(file);
    } catch {
      /* sin .env: se usan las variables del entorno */
    }
  }
}

function ensureEnvFile() {
  step("Archivo de entorno (.env)");
  const target = path.join(ROOT, ".env");
  const example = path.join(ROOT, ".env.example");
  if (existsSync(target)) {
    ok(".env ya existe (no se modifica).");
    return;
  }
  if (!existsSync(example)) throw new SetupError("No existe .env.example: no puedo crear .env.");
  copyFileSync(example, target);
  ok("Se creó .env a partir de .env.example. Revisa los valores antes de producción.");
}

function startDocker(opts) {
  step("Servicios locales (Docker)");
  if (opts.skipDocker) {
    skip("--skip-docker: se usan servicios ya existentes.");
    return false;
  }
  const services = servicesToStart(process.env);
  if (services.length === 0) {
    skip("DATABASE_URL y STORAGE_ENDPOINT no apuntan a localhost: no se levantan contenedores.");
    return false;
  }
  let compose = null;
  if (commandWorks("docker", ["compose", "version"])) compose = ["docker", ["compose"]];
  else if (commandWorks("docker-compose", ["version"])) compose = ["docker-compose", []];
  if (!compose) {
    warn("Docker no está disponible. Inicia PostgreSQL manualmente o instala Docker Desktop.");
    return false;
  }
  if (!commandWorks("docker", ["info"])) {
    warn(
      "Docker está instalado pero el daemon no responde (¿Docker Desktop está abierto?). Continúo sin contenedores.",
    );
    return false;
  }
  const [bin, prefix] = compose;
  const res = run(bin, [...prefix, "up", "-d", ...services]);
  if (res.status !== 0)
    throw new SetupError(`No se pudieron levantar los contenedores (${services.join(", ")}).`);
  ok(`Contenedores arriba: ${services.join(", ")}.`);
  return true;
}

async function waitForPostgres(opts) {
  step("Esperando a PostgreSQL");
  const db = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!db)
    throw new SetupError("DATABASE_URL no está definida o no es una URL postgresql:// válida (revisa .env).");
  info(`DATABASE_URL = ${maskUrl(process.env.DATABASE_URL)}`);
  const deadline = Date.now() + opts.waitSeconds * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await probePostgres(db.host, db.port)) {
      ok(`PostgreSQL responde en ${db.host}:${db.port} (intento ${attempt}).`);
      return;
    }
    if (attempt === 1)
      info(`Aún no responde ${db.host}:${db.port}; reintentando hasta ${opts.waitSeconds} s…`);
    await sleep(1000);
  }
  throw new SetupError(
    `PostgreSQL no respondió en ${db.host}:${db.port} tras ${opts.waitSeconds} s. ` +
      "Revisa `docker compose ps` / `docker compose logs db`.",
  );
}

async function migrate() {
  step("Migraciones (prisma migrate deploy)");
  // Reintentos: justo después de crear el contenedor, Postgres puede reiniciarse una vez (initdb).
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = run("npx", ["prisma", "migrate", "deploy"]);
    if (res.status === 0) {
      ok("Migraciones aplicadas / al día.");
      return;
    }
    if (attempt < 3) {
      warn(`migrate deploy falló (intento ${attempt}/3). Reintento en 3 s…`);
      await sleep(3000);
    }
  }
  throw new SetupError(
    "prisma migrate deploy falló. Revisa el error de arriba (credenciales, base inexistente, migración fallida).",
  );
}

function generate(opts) {
  step("Cliente de Prisma (prisma generate)");
  if (opts.skipGenerate) {
    skip("--skip-generate.");
    return;
  }
  const res = run("npx", ["prisma", "generate"], { quiet: true });
  if (res.status === 0) {
    ok("Prisma Client generado.");
    return;
  }
  // En Windows el engine (query_engine-windows.dll.node) queda bloqueado si hay servidores `next dev` corriendo.
  if (/EPERM|EBUSY|operation not permitted/i.test(res.output)) {
    warn(
      "No se pudo reemplazar el engine de Prisma (archivo en uso). Detén los servidores de desarrollo y corre `npx prisma generate`.",
    );
    warn("Se conserva el cliente generado previamente (pnpm install ya lo generó).");
    return;
  }
  console.log(res.output);
  throw new SetupError("prisma generate falló.");
}

function storage(opts) {
  step("Almacenamiento S3 (bucket)");
  if (opts.skipStorage) {
    skip("--skip-storage.");
    return;
  }
  if ((process.env.STORAGE_DRIVER || "s3").toLowerCase() === "local") {
    warn(
      "STORAGE_DRIVER=local: los archivos se guardan en ./.uploads (sólo desarrollo). Se omite el bucket.",
    );
    return;
  }
  if (!process.env.STORAGE_ACCESS_KEY || !process.env.STORAGE_SECRET_KEY) {
    warn("Faltan STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY: la app usará el driver local. Se omite el bucket.");
    return;
  }
  const res = run("npx", ["tsx", "scripts/storage-init.ts"]);
  if (res.status === 0) {
    ok("Almacenamiento listo.");
  } else {
    warn(
      "No se pudo preparar el bucket. La app funcionará, pero las subidas fallarán hasta que el almacenamiento responda.",
    );
    warn("Reintenta después con: pnpm storage:init");
  }
}

function testDatabase(opts) {
  step("Base de pruebas (TEST_DATABASE_URL)");
  if (opts.skipTestDb) {
    skip("--skip-test-db.");
    return;
  }
  if (!process.env.TEST_DATABASE_URL) {
    skip("TEST_DATABASE_URL no está definida: se omite.");
    return;
  }
  const res = run("node", ["scripts/prepare-test-db.mjs"]);
  if (res.status !== 0) {
    warn(
      "No se pudo preparar la base de pruebas. Las pruebas de integración fallarán hasta corregirlo (pnpm test:integration:prepare).",
    );
    return;
  }
  ok("Base de pruebas migrada.");
}

function seed(opts) {
  step(opts.seedBase ? "Datos BASE (seed idempotente)" : "Datos de demostración (seed)");
  if (opts.skipSeed) {
    skip("--skip-seed: no se modifican los datos.");
    return;
  }
  const pm = packageManager();
  const script = opts.seedBase ? "db:seed:base" : "db:seed";
  const res = run(pm, ["run", script]);
  if (res.status !== 0) throw new SetupError(`El seed (${script}) falló.`);
  ok(opts.seedBase ? "Seed BASE aplicado." : "Datos demo listos.");
}

function printHelp() {
  console.log(`
${c.bold("pnpm db:setup")} — prepara el entorno local de Ivonne & Rosa

Opciones:
  --skip-seed       no ejecuta el seed (conserva los datos actuales)
  --seed-base       ejecuta el seed BASE (idempotente) en lugar del DEMO (que borra todo)
  --skip-docker     no levanta contenedores (usa servicios ya existentes)
  --skip-storage    no crea el bucket S3
  --skip-test-db    no migra la base de pruebas
  --skip-generate   no ejecuta prisma generate
  --wait <seg>      segundos máximos de espera a PostgreSQL (default 60)
  -h, --help        muestra esta ayuda
`);
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(c.red(`✗ ${error.message}`));
    return 2;
  }
  if (opts.help) {
    printHelp();
    return 0;
  }
  const started = Date.now();
  console.log(c.bold("Ivonne & Rosa — preparación del entorno de desarrollo"));
  try {
    ensureEnvFile();
    await loadEnv();
    startDocker(opts);
    await waitForPostgres(opts);
    await migrate();
    generate(opts);
    storage(opts);
    testDatabase(opts);
    seed(opts);
  } catch (error) {
    console.error(
      `\n${c.red("✗ No se completó la preparación:")} ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n${c.green("✓ Entorno listo")} en ${secs} s. Siguiente paso: ${c.bold("pnpm dev")} → http://localhost:3000`,
  );
  if (!opts.skipSeed && !opts.seedBase) {
    console.log(
      c.dim(
        "  Cuentas demo (contraseña Demo2026!): superadmin@ivonne-rosa.test · ivonne@ivonne-rosa.test · staff@ivonne-rosa.test",
      ),
    );
  }
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().then((code) => process.exit(code));
}
