import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Prepara la base E2E: migraciones + datos demo frescos antes de cada corrida. */
export default async function globalSetup() {
  config({ path: ".env" });
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL no está definida");
  if (process.env.E2E_SKIP_SEED === "1") return;
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url, NODE_ENV: "development" };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
