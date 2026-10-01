/**
 * Setup de pruebas de integración: usa SIEMPRE la base de pruebas (TEST_DATABASE_URL),
 * nunca la de desarrollo. Prepara la base con: pnpm test:integration:prepare
 */
import { afterAll } from "vitest";
import { config } from "dotenv";

config({ path: ".env" });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL no está definida (ver .env.example)");
// Pool pequeño por archivo: cada archivo de prueba usa su propio PrismaClient.
process.env.DATABASE_URL = testUrl.includes("connection_limit")
  ? testUrl
  : `${testUrl}${testUrl.includes("?") ? "&" : "?"}connection_limit=5`;
process.env.RATE_LIMIT_DISABLED = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.WHATSAPP_PROVIDER = "mock";
process.env.PAYMENT_PROVIDER = "mock";
process.env.AI_PROVIDER = "mock";
process.env.STORAGE_DRIVER = "local";

// El singleton de Prisma vive en globalThis (src/db). En un mismo proceso de pruebas los archivos
// comparten globalThis: se descarta para que cada archivo tenga un cliente limpio (los spies/mocks
// de un archivo no deben afectar a otro).
type G = typeof globalThis & { prisma?: { $disconnect: () => Promise<void> } };
delete (globalThis as G).prisma;

afterAll(async () => {
  const client = (globalThis as G).prisma;
  delete (globalThis as G).prisma;
  if (client) await client.$disconnect().catch(() => undefined);
});
