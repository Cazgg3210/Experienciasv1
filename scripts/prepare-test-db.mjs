// Aplica migraciones a la base de pruebas (TEST_DATABASE_URL).
import { execSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env" });
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL no está definida");
  process.exit(1);
}
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
console.log("Base de pruebas lista.");
