/**
 * Acceso directo a la base E2E para:
 *  - verificar persistencia real (lo que la UI dice ↔ lo que quedó en PostgreSQL),
 *  - preparar datos propios de cada prueba (factories),
 *  - comprobar que una acción denegada NO cambió nada.
 * Nunca apunta a dev ni producción: exige una base local "*_e2e" (mismo candado que global-setup).
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env" });

let client: PrismaClient | null = null;

export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL no está definida");
  const u = new URL(url);
  if (!/e2e/i.test(u.pathname)) throw new Error(`Base no E2E (${u.pathname}). Abortado.`);
  return url;
}

export function getDb(): PrismaClient {
  client ??= new PrismaClient({ datasources: { db: { url: e2eDatabaseUrl() } } });
  return client;
}

export async function disconnectDb(): Promise<void> {
  if (client) await client.$disconnect();
  client = null;
}
