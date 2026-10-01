import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

/**
 * Base de datos EFÍMERA por corrida de integración:
 *  1. crea `<base de TEST_DATABASE_URL>_it_<timestamp>` (nueva, vacía),
 *  2. aplica las migraciones,
 *  3. las pruebas la usan (los workers heredan process.env),
 *  4. al terminar se elimina SÓLO esa base recién creada.
 * Nunca reinicia ni borra bases existentes. Para reutilizar TEST_DATABASE_URL tal cual: INTEGRATION_EPHEMERAL_DB=0.
 */
let ephemeralName: string | null = null;
let adminUrl: string | null = null;

function withDatabase(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

export async function setup() {
  config({ path: ".env" });
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL no está definida");
  if (process.env.INTEGRATION_EPHEMERAL_DB === "0") return;

  const baseName = new URL(base).pathname.replace(/^\//, "") || "ivonne_rosa_test";
  ephemeralName = `${baseName}_it_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, "_");
  adminUrl = withDatabase(base, "postgres");

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${ephemeralName}"`);
  } finally {
    await admin.$disconnect();
  }
  const url = withDatabase(base, ephemeralName);
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
  process.env.TEST_DATABASE_URL = url;
}

export async function teardown() {
  if (!ephemeralName || !adminUrl) return;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    // Cierra conexiones abiertas a la base efímera y la elimina (sólo la creada en esta corrida).
    await admin.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${ephemeralName}' AND pid <> pg_backend_pid()`,
    );
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${ephemeralName}"`);
  } finally {
    await admin.$disconnect();
  }
}
