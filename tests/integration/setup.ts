/**
 * Setup de pruebas de integración: usa SIEMPRE la base de pruebas (TEST_DATABASE_URL),
 * nunca la de desarrollo. Prepara la base con: pnpm test:integration:prepare
 */
import { config } from "dotenv";

config({ path: ".env" });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL no está definida (ver .env.example)");
process.env.DATABASE_URL = testUrl;
process.env.RATE_LIMIT_DISABLED = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.WHATSAPP_PROVIDER = "mock";
process.env.PAYMENT_PROVIDER = "mock";
process.env.AI_PROVIDER = "mock";
process.env.STORAGE_DRIVER = "local";
