import "server-only";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError, ConflictError, RateLimitError, newErrorId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { can, type Permission } from "@/server/auth/permissions";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string[]>;
      errorId?: string;
    };

export type ActionContext = { user: SessionUser | null; ip: string };
export type AuthedActionContext = { user: SessionUser; ip: string };

type BaseConfig<S extends z.ZodTypeAny> = {
  schema: S;
  /** Nombre para logs */
  name: string;
  /** Límite por IP+nombre (útil en acciones públicas) */
  rateLimit?: { limit: number; windowMs: number };
};

/**
 * Envuelve una Server Action con: validación Zod, RBAC server-side, rate limit,
 * manejo de errores sin filtrar stack traces (con errorId correlacionable en logs).
 */
export function protectedAction<S extends z.ZodTypeAny, T>(
  config: BaseConfig<S> & { permission: Permission },
  handler: (input: z.output<S>, ctx: AuthedActionContext) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) =>
    run(config, input, async (data, ip) => {
      const user = await getCurrentUser();
      if (!user) throw new AppError("Tu sesión expiró. Vuelve a iniciar sesión.", "UNAUTHORIZED", 401);
      if (!can(user.role, config.permission))
        throw new AppError("No tienes permiso para realizar esta acción.", "FORBIDDEN", 403);
      return handler(data, { user, ip });
    });
}

/** Acción pública (sin sesión): clientas, invitadas. Siempre con rate limit por defecto. */
export function publicAction<S extends z.ZodTypeAny, T>(
  config: BaseConfig<S>,
  handler: (input: z.output<S>, ctx: ActionContext) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  const withDefaults = { ...config, rateLimit: config.rateLimit ?? { limit: 30, windowMs: 60_000 } };
  return async (input) =>
    run(withDefaults, input, async (data, ip) => {
      const user = await getCurrentUser().catch(() => null);
      return handler(data, { user, ip });
    });
}

async function run<S extends z.ZodTypeAny, T>(
  config: BaseConfig<S>,
  input: unknown,
  exec: (data: z.output<S>, ip: string) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const ip = await clientIp().catch(() => "unknown");
    if (config.rateLimit) {
      const rl = await rateLimit(`action:${config.name}:${ip}`, config.rateLimit);
      if (!rl.ok) throw new RateLimitError();
    }
    const parsed = config.schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Revisa los datos marcados.",
        code: "VALIDATION_ERROR",
        fieldErrors: flattenZod(parsed.error),
      };
    }
    const data = await exec(parsed.data, ip);
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error); // redirect()/notFound() deben propagarse
    return toActionError(error, config.name);
  }
}

export function flattenZod(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function toActionError(error: unknown, name: string): ActionResult<never> {
  if (error instanceof AppError) {
    const fieldErrors = (error as AppError & { fieldErrors?: Record<string, string[]> }).fieldErrors;
    return { ok: false, error: error.message, code: error.code, fieldErrors };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: "Revisa los datos marcados.", code: "VALIDATION_ERROR", fieldErrors: flattenZod(error) };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const c = new ConflictError("Ya existe un registro con esos datos (valor duplicado).");
      return { ok: false, error: c.message, code: c.code };
    }
    if (error.code === "P2025") {
      return { ok: false, error: "El registro ya no existe o fue modificado.", code: "NOT_FOUND" };
    }
    if (error.code === "P2003") {
      return { ok: false, error: "No se puede completar: hay registros relacionados.", code: "CONFLICT" };
    }
  }
  const errorId = newErrorId();
  logger.error("action.failed", { action: name, errorId, error });
  return {
    ok: false,
    error: `Algo salió mal. Si el problema continúa, compártenos la referencia ${errorId}.`,
    code: "INTERNAL_ERROR",
    errorId,
  };
}
