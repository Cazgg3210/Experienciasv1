#!/usr/bin/env node
/**
 * Servidor para E2E: build de producción en .next-e2e apuntando a E2E_DATABASE_URL, en el puerto 3200.
 * Usado por playwright.config.ts (webServer). Rate limit desactivado para no interferir con los flujos.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env" });
const port = process.env.E2E_PORT ?? "3200";
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_DIST_DIR: ".next-e2e",
  DATABASE_URL: process.env.E2E_DATABASE_URL,
  APP_URL: `http://localhost:${port}`,
  AUTH_URL: `http://localhost:${port}`,
  RATE_LIMIT_DISABLED: "true",
  PORT: port,
};
if (!env.DATABASE_URL) {
  console.error("E2E_DATABASE_URL no está definida");
  process.exit(1);
}
if (!existsSync(".next-e2e/BUILD_ID") || process.env.E2E_REBUILD === "1") {
  console.log("[e2e] Construyendo build de producción…");
  execSync("npx next build", { stdio: "inherit", env });
}
console.log(`[e2e] Iniciando servidor en :${port}`);
const child = spawn("npx", ["next", "start", "-p", port], { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
