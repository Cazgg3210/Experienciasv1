import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

/** Carriles paralelos (E2E_LANE) usan <base>_l<N>: se crea vacía la primera vez; las migraciones hacen el resto. */
async function ensureDatabase(u: URL, dbName: string) {
  if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`Nombre de base inválido: ${dbName}`);
  const admin = new URL(u.toString());
  admin.pathname = "/postgres";
  const prisma = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    const rows = await prisma.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM pg_database WHERE datname = ${dbName}`;
    if (!rows.length) await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Prepara la base E2E antes de cada corrida: migraciones + datos demo frescos (seed DEMO).
 * Así cada corrida parte de un estado conocido. Los tests crean además sus propios datos únicos.
 *
 * Candado: sólo opera sobre una base LOCAL cuyo nombre contiene "e2e". Nunca dev ni producción.
 * E2E_SKIP_SEED=1 reutiliza la base tal cual (útil para depurar un solo test).
 */
export default async function globalSetup() {
  config({ path: ".env" });
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL no está definida");
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, "");
  const localHosts = ["localhost", "127.0.0.1", "::1", "postgres", "db"];
  if (!localHosts.includes(u.hostname) && process.env.E2E_ALLOW_REMOTE_DB !== "true") {
    throw new Error(`E2E_DATABASE_URL apunta a ${u.hostname}: sólo se permiten bases locales para E2E.`);
  }
  if (!/e2e/i.test(dbName)) {
    throw new Error(`La base "${dbName}" no parece de E2E (debe contener "e2e"). Abortado para proteger tus datos.`);
  }
  if (process.env.E2E_SKIP_SEED === "1") return;
  await ensureDatabase(u, dbName);
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url, NODE_ENV: "development" };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
