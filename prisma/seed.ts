/**
 * Ivonne & Rosa — seed de base de datos.
 *
 *   pnpm db:seed         → DEMO: borra TODO (TRUNCATE) y crea el dataset de demostración.
 *   pnpm db:seed:base    → BASE: upserts idempotentes (settings, disponibilidad, presupuestos,
 *                          estilos, zonas, checklists y SUPER_ADMIN desde SEED_ADMIN_EMAIL /
 *                          SEED_ADMIN_PASSWORD). Es lo que se corre una vez en producción.
 *
 * Todas las fechas del demo son relativas al momento de ejecución (zona America/Mexico_City),
 * así los eventos "próximos" siempre son próximos.
 */
import { PrismaClient } from "@prisma/client";
import { seedBaseCatalog, seedSuperAdminFromEnv } from "./seed-data/base";
import { DEMO_PASSWORD, DEMO_USERS } from "./seed-data/demo-catalog";
import { seedDemoSetup } from "./seed-data/demo-setup";
import { DEMO_TOKENS, seedDemoSales } from "./seed-data/demo-sales";
import { seedDemoActivity } from "./seed-data/demo-activity";
import { Clock, mulberry32 } from "./seed-data/helpers";

function loadEnvFile(): void {
  try {
    // Node >= 20.12: no sobreescribe variables ya definidas en el entorno.
    process.loadEnvFile(".env");
  } catch {
    // Sin .env (p. ej. contenedor de producción): se usan las variables del entorno.
  }
}

async function listTables(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename`;
  return rows.map((r) => r.tablename);
}

const quoteIdent = (name: string) => `"public"."${name.replace(/"/g, '""')}"`;

async function truncateAll(prisma: PrismaClient): Promise<number> {
  const tables = await listTables(prisma);
  if (tables.length === 0) return 0;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`);
  return tables.length;
}

async function tableCounts(prisma: PrismaClient): Promise<{ table: string; count: number }[]> {
  const tables = await listTables(prisma);
  if (tables.length === 0) return [];
  const sql = tables
    .map((t) => `SELECT '${t.replace(/'/g, "''")}' AS "table", COUNT(*)::int AS "count" FROM ${quoteIdent(t)}`)
    .join(" UNION ALL ");
  const rows = await prisma.$queryRawUnsafe<{ table: string; count: number }[]>(sql);
  return rows.sort((a, b) => a.table.localeCompare(b.table));
}

function printCounts(rows: { table: string; count: number }[]): void {
  const width = Math.max(...rows.map((r) => r.table.length), 10);
  const lines = rows.map((r) => `  ${r.table.padEnd(width)}  ${String(r.count).padStart(5)}`);
  const half = Math.ceil(lines.length / 2);
  console.log("\nFilas por tabla:");
  for (let i = 0; i < half; i++) {
    console.log(`${lines[i] ?? ""}${lines[i + half] ? `    ${lines[i + half]!.trimStart()}` : ""}`);
  }
}

async function runBase(prisma: PrismaClient): Promise<void> {
  console.log("[seed] Modo BASE: upserts idempotentes (no se borra nada).");
  await seedBaseCatalog(prisma);
  const admin = await seedSuperAdminFromEnv(prisma);
  if (admin.status === "created") console.log(`[seed] SUPER_ADMIN creado: ${admin.email}`);
  if (admin.status === "exists") console.log(`[seed] SUPER_ADMIN ya existía: ${admin.email} (contraseña sin cambios)`);
  printCounts(await tableCounts(prisma));
  console.log("\n[seed] BASE listo.");
}

async function runDemo(prisma: PrismaClient): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && process.env.SEED_ALLOW_DEMO_IN_PRODUCTION !== "true") {
    throw new Error(
      "NODE_ENV=production: el seed DEMO borra toda la base. Usa `pnpm db:seed:base` o define SEED_ALLOW_DEMO_IN_PRODUCTION=true si de verdad quieres datos demo.",
    );
  }
  console.log("[seed] Modo DEMO: se vacía la base y se crea el dataset de demostración.");
  const truncated = await truncateAll(prisma);
  console.log(`[seed] TRUNCATE de ${truncated} tablas (RESTART IDENTITY CASCADE).`);

  const clock = new Clock();
  const rng = mulberry32(20_260_930);
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

  await seedBaseCatalog(prisma);
  const refs = await seedDemoSetup(prisma, clock);
  const sales = await seedDemoSales(prisma, refs, clock, rng);
  await seedDemoActivity(prisma, refs, sales, clock, rng, appUrl);

  printCounts(await tableCounts(prisma));

  const { events, quotes } = sales;
  console.log(`\nHoy (CDMX): ${clock.todayKey}`);
  console.log("\nUsuarios demo (contraseña para todos: " + DEMO_PASSWORD + "):");
  for (const u of Object.values(DEMO_USERS)) console.log(`  ${u.role.padEnd(11)}  ${u.email.padEnd(30)}  ${u.name}`);

  console.log(`\nURLs demo (APP_URL = ${appUrl}):`);
  console.log(`  Cotización (aceptar → pagar):  ${appUrl}/cotizacion/${quotes.lucia!.publicToken}`);
  for (const ev of Object.values(events)) {
    console.log(`  ${ev.title} [${ev.status}, ${ev.dateKey}]`);
    console.log(`     portal:      ${appUrl}/mi-evento/${ev.portalToken}`);
    console.log(`     invitación:  ${appUrl}/e/${ev.slug}/${ev.inviteToken}`);
  }
  console.log(`  RSVP de invitada (Camila):     ${appUrl}/e/${events.e1.slug}/${DEMO_TOKENS.camilaGuest}`);
  console.log(`  Memory Capsule (Valeria):      ${appUrl}/memory/${sales.memoryShareTokens.e4}`);
  console.log("\n[seed] DEMO listo.");
}

async function main(): Promise<void> {
  loadEnvFile();
  const mode = process.argv.slice(2).includes("--base") ? "base" : "demo";
  const prisma = new PrismaClient({ log: ["warn", "error"] });
  const started = Date.now();
  try {
    if (mode === "base") await runBase(prisma);
    else await runDemo(prisma);
    console.log(`[seed] Terminado en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] Error:", error);
  process.exit(1);
});
