/**
 * Ivonne & Rosa — inicializa el almacenamiento S3 compatible (crea el bucket si no existe).
 *
 *   pnpm storage:init              → crea/verifica el bucket configurado en .env
 *   pnpm storage:init --verify     → además escribe, lee y borra un objeto de prueba
 *
 * Usa S3StorageProvider.ensureBucket (src/server/providers/storage/s3-provider.ts).
 * - STORAGE_DRIVER=local → aviso y salida 0 (no hay bucket que crear).
 * - Faltan credenciales → aviso y salida 0 (la app usará el driver local en desarrollo).
 * - Almacenamiento inaccesible → error y salida 1 (db:setup lo trata como aviso).
 *
 * En producción el bucket se crea desde el panel del proveedor (Spaces / R2 / S3):
 * ver docs/DEPLOY_DOKPLOY.md, sección 9.
 */
import { S3StorageProvider, type S3Config } from "../src/server/providers/storage/s3-provider";

type StorageEnv = Partial<Record<string, string | undefined>>;

export type StorageInitPlan =
  { kind: "skip"; reason: string } | { kind: "s3"; config: S3Config; endpointLabel: string };

const truthy = (v: string | undefined) => v === "true" || v === "1";

/** Decide qué hacer a partir de las variables de entorno (función pura, testeable). */
export function planStorageInit(env: StorageEnv): StorageInitPlan {
  const driver = (env.STORAGE_DRIVER || "s3").toLowerCase();
  if (driver === "local") {
    return {
      kind: "skip",
      reason: "STORAGE_DRIVER=local: los archivos se guardan en ./.uploads (sólo desarrollo).",
    };
  }
  if (driver !== "s3") {
    return { kind: "skip", reason: `STORAGE_DRIVER="${driver}" no es válido (usa s3 o local).` };
  }
  if (!env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) {
    return {
      kind: "skip",
      reason:
        "Faltan STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY: la app usará el driver local (sólo desarrollo).",
    };
  }
  const bucket = (env.STORAGE_BUCKET || "ivonne-rosa").trim();
  return {
    kind: "s3",
    endpointLabel: env.STORAGE_ENDPOINT || `AWS S3 (${env.STORAGE_REGION || "us-east-1"})`,
    config: {
      endpoint: env.STORAGE_ENDPOINT || undefined,
      region: env.STORAGE_REGION || "us-east-1",
      bucket,
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
      forcePathStyle: truthy(env.STORAGE_FORCE_PATH_STYLE),
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: sin respuesta tras ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Mensaje legible aun para errores de red sin `message` (p. ej. AggregateError ECONNREFUSED del SDK). */
export function describeError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const parts = errorParts(error, 0);
  return [...new Set(parts)].join(" · ") || "error desconocido";
}

function errorParts(error: unknown, depth: number): string[] {
  if (!error || typeof error !== "object" || depth > 3) return error ? [String(error)] : [];
  const e = error as { message?: string; name?: string; code?: string; errors?: unknown[]; cause?: unknown };
  const parts = [
    e.code,
    e.name && !["Error", "AggregateError"].includes(e.name) ? e.name : undefined,
    e.message,
  ].filter(Boolean) as string[];
  if (e.errors?.length) parts.push(...errorParts(e.errors[0], depth + 1));
  else if (parts.length === 0 && e.cause) parts.push(...errorParts(e.cause, depth + 1));
  return parts;
}

async function loadDotEnv(): Promise<void> {
  try {
    const { config } = await import("dotenv");
    config({ path: ".env", quiet: true });
  } catch {
    try {
      process.loadEnvFile?.(".env");
    } catch {
      /* sin .env: variables del entorno */
    }
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  await loadDotEnv();
  const verify = argv.includes("--verify");
  const plan = planStorageInit(process.env);
  if (plan.kind === "skip") {
    console.warn(`[storage] AVISO: ${plan.reason} Se omite la creación del bucket.`);
    return 0;
  }

  const provider = new S3StorageProvider(plan.config);
  console.log(`[storage] Verificando bucket "${plan.config.bucket}" en ${plan.endpointLabel}…`);
  try {
    await withTimeout(provider.ensureBucket(), 15_000, "ensureBucket");
    console.log(
      `[storage] Bucket "${plan.config.bucket}" listo (privado; los archivos se sirven con URLs firmadas).`,
    );

    if (verify) {
      const key = `_healthchecks/storage-init-${Date.now()}.txt`;
      const body = Buffer.from(`ok ${new Date().toISOString()}`);
      await withTimeout(provider.put({ key, body, contentType: "text/plain" }), 15_000, "put");
      const read = await withTimeout(provider.get(key), 15_000, "get");
      await withTimeout(provider.delete(key), 15_000, "delete");
      if (!read || !read.body.equals(body)) throw new Error("el objeto de prueba no se pudo leer de vuelta");
      console.log("[storage] Verificación escritura/lectura/borrado: OK.");
    }
    return 0;
  } catch (error) {
    console.error(
      `[storage] ERROR: no se pudo preparar el bucket "${plan.config.bucket}": ${describeError(error)}`,
    );
    console.error(
      "[storage] Revisa STORAGE_ENDPOINT / credenciales y que el servicio esté arriba (docker compose up -d storage).",
    );
    return 1;
  }
}

// Sólo se ejecuta como script (tsx scripts/storage-init.ts), no al importarlo en pruebas.
const invokedDirectly = /storage-init\.ts$/.test(process.argv[1] ?? "");
if (invokedDirectly) {
  void main().then((code) => process.exit(code));
}
