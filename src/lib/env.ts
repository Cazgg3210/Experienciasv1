import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const boolDefaultTrue = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? true : v === "true" || v === "1"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** URL interna para llamadas servidor→servidor (p. ej. webhook simulado). Default: APP_URL */
  INTERNAL_APP_URL: z.string().url().optional(),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
  APP_NAME: z.string().default("Ivonne & Rosa"),
  APP_TIMEZONE: z.string().default("America/Mexico_City"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16).optional(),

  STORAGE_DRIVER: z.enum(["s3", "local"]).default("s3"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().default("ivonne-rosa"),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: bool,
  STORAGE_PUBLIC_URL: z.string().optional(),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(8),

  PAYMENT_PROVIDER: z.enum(["mock", "stripe", "mercadopago"]).default("mock"),
  PAYMENT_SECRET_KEY: z.string().optional(),
  PAYMENT_PUBLIC_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().default("dev-webhook-secret-change-me"),

  EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Ivonne & Rosa <hola@example.com>"),

  WHATSAPP_PROVIDER: z.enum(["mock", "cloud_api"]).default("mock"),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_NUMBER: z.string().default("5215512345678"),

  AI_PROVIDER: z.enum(["mock", "anthropic", "openai"]).default("mock"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  AI_DESIGNER_ENABLED: boolDefaultTrue,
  PAYMENTS_ENABLED: boolDefaultTrue,
  WHATSAPP_ENABLED: boolDefaultTrue,
  MEMORY_CAPSULE_ENABLED: boolDefaultTrue,

  CRON_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Variables de entorno validadas (lazy para no romper el build si faltan en build-time). */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuración inválida de variables de entorno: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (!parsed.data.AUTH_SECRET) throw new Error("AUTH_SECRET es obligatorio en producción");
    if (parsed.data.STORAGE_DRIVER === "local")
      console.warn("[env] STORAGE_DRIVER=local en producción: los archivos se perderán al redeplegar.");
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(path = ""): string {
  const base = env().APP_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}
