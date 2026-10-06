#!/usr/bin/env node
/**
 * Servidor para E2E: build de producción en .next-e2e apuntando a E2E_DATABASE_URL (puerto 3200).
 * Usado por playwright.config.ts (webServer) y por la skill e2e-quality-gate.
 *
 * - Reconstruye automáticamente si el código cambió desde el último build (sello git) o con E2E_REBUILD=1.
 * - Se niega a arrancar si E2E_DATABASE_URL no apunta a una base local "*_e2e" (nunca dev ni producción).
 * - Rate limit desactivado para no interferir con los flujos (las pruebas de rate limit se cubren aparte).
 */
import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env" });
const port = process.env.E2E_PORT ?? "3200";
const dbUrl = process.env.E2E_DATABASE_URL;

function assertSafeDatabase(url) {
  if (!url) throw new Error("E2E_DATABASE_URL no está definida (ver .env.example)");
  const u = new URL(url);
  const localHosts = ["localhost", "127.0.0.1", "::1", "postgres", "db"];
  const dbName = u.pathname.replace(/^\//, "");
  if (!localHosts.includes(u.hostname) && process.env.E2E_ALLOW_REMOTE_DB !== "true") {
    throw new Error(`E2E_DATABASE_URL apunta a ${u.hostname}: sólo se permiten bases locales para E2E.`);
  }
  if (!/e2e/i.test(dbName)) {
    throw new Error(`La base "${dbName}" no parece de E2E (debe contener "e2e"). Abortado para proteger tus datos.`);
  }
}

function sourceStamp() {
  try {
    const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain -- src prisma public next.config.ts package.json pnpm-lock.yaml", {
      encoding: "utf8",
    });
    const diff = dirty.trim()
      ? execSync("git diff HEAD -- src prisma public next.config.ts package.json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      : "";
    return createHash("sha1").update(head).update(dirty).update(diff).digest("hex");
  } catch {
    return `nogit-${Date.now()}`; // sin git: siempre reconstruir
  }
}

assertSafeDatabase(dbUrl);

const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_STANDALONE: "false",
  DATABASE_URL: dbUrl,
  APP_URL: `http://localhost:${port}`,
  AUTH_URL: `http://localhost:${port}`,
  INTERNAL_APP_URL: `http://127.0.0.1:${port}`,
  // La suite "ratelimit" (E2E_SUITE=ratelimit, carril propio) necesita el limitador encendido.
  RATE_LIMIT_DISABLED: process.env.E2E_SUITE === "ratelimit" ? "false" : "true",
  PORT: port,
};

const stampFile = ".next-e2e/E2E_SOURCE_STAMP";
const lockDir = ".next-e2e.lock";
const stamp = sourceStamp();
const isStale = () =>
  !existsSync(".next-e2e/BUILD_ID") ||
  process.env.E2E_REBUILD === "1" ||
  (existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : "") !== stamp;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Varios carriles (E2E_LANE) pueden arrancar a la vez: sólo uno construye; el resto espera y reutiliza.
if (isStale()) {
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch {
      // Candado huérfano (> 20 min) de un build interrumpido.
      if (existsSync(lockDir) && Date.now() - statSync(lockDir).mtimeMs > 20 * 60_000) rmSync(lockDir, { recursive: true, force: true });
      else sleep(3000);
    }
  }
  try {
    if (isStale()) {
      console.log("[e2e] Construyendo build de producción (código cambió o no existe build)…");
      execSync("npx next build", { stdio: "inherit", env });
      writeFileSync(stampFile, stamp);
    } else console.log("[e2e] Otro carril terminó el build: se reutiliza .next-e2e");
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
} else {
  console.log("[e2e] Build vigente: se reutiliza .next-e2e");
}

console.log(`[e2e] Iniciando servidor en :${port}`);
const child = spawn("npx", ["next", "start", "-p", port], { stdio: "inherit", env, shell: true });
const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
