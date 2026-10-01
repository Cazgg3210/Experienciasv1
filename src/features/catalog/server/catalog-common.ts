import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { can, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { SlugEntity } from "../schemas";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Opciones para transacciones interactivas del catálogo: el editor de experiencias hace varias
 * escrituras (relaciones, costos, inventario, FAQs, auditoría); con la base cargada el default
 * de 5 s de Prisma se queda corto.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

/** Resultado de un intento de borrado (puede convertirse en desactivación). */
export type DeleteOutcome = { outcome: "deleted" | "deactivated"; message: string };

/** Conflicto de slug con error por campo para el formulario. */
export class SlugConflictError extends ConflictError {
  readonly fieldErrors: Record<string, string[]>;
  constructor(slug: string) {
    const message = `El slug "${slug}" ya está en uso. Elige otro (por ejemplo "${slug}-2").`;
    super(message);
    this.name = "SlugConflictError";
    this.fieldErrors = { slug: [message] };
  }
}

export function assertCan(actor: SessionUser, permission: Permission, message?: string): void {
  if (!can(actor.role, permission)) throw new ForbiddenError(message);
}

/** Requiere pricing:write para cualquier cambio de precio/costo. */
export function assertCanPrice(actor: SessionUser): void {
  assertCan(actor, "pricing:write", "Necesitas permiso de precios para cambiar precios o costos del catálogo.");
}

export function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export async function isSlugTaken(entity: SlugEntity, slug: string, excludeId?: string, db: Db = prisma): Promise<boolean> {
  const where = { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) };
  const select = { id: true } as const;
  switch (entity) {
    case "experience":
      return !!(await db.experience.findFirst({ where, select }));
    case "menu":
      return !!(await db.menu.findFirst({ where, select }));
    case "addOn":
      return !!(await db.addOn.findFirst({ where, select }));
    case "style":
      return !!(await db.style.findFirst({ where, select }));
    case "serviceArea":
      return !!(await db.serviceArea.findFirst({ where, select }));
  }
}

export async function ensureSlugAvailable(entity: SlugEntity, slug: string, excludeId?: string, db: Db = prisma) {
  if (await isSlugTaken(entity, slug, excludeId, db)) throw new SlugConflictError(slug);
}

/** Traduce una violación de unicidad del slug (carrera entre dos guardados) a un error amable. */
export function rethrowSlugConflict(error: unknown, slug: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta ?? {}).includes("slug")
  ) {
    throw new SlugConflictError(slug);
  }
  throw error;
}

export function isForeignKeyError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

/** Verifica que todos los IDs existan en la tabla indicada (evita errores crípticos al conectar). */
export async function assertIdsExist(
  kind: "style" | "serviceArea" | "menu" | "addOn" | "inventoryItem",
  ids: readonly string[],
  db: Db = prisma,
): Promise<void> {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const where = { id: { in: unique } };
  let count = 0;
  switch (kind) {
    case "style":
      count = await db.style.count({ where });
      break;
    case "serviceArea":
      count = await db.serviceArea.count({ where });
      break;
    case "menu":
      count = await db.menu.count({ where });
      break;
    case "addOn":
      count = await db.addOn.count({ where });
      break;
    case "inventoryItem":
      count = await db.inventoryItem.count({ where });
      break;
  }
  if (count !== unique.length) {
    throw new ValidationError("Alguno de los elementos seleccionados ya no existe. Recarga la página e inténtalo de nuevo.");
  }
}

export async function auditPriceChange(
  params: {
    entityType: "Experience" | "Menu" | "AddOn" | "ServiceArea";
    entityId: string;
    name: string;
    before: unknown;
    after: unknown;
    actor: SessionUser;
  },
  tx?: Prisma.TransactionClient,
) {
  await audit(
    {
      action: "catalog.price_changed",
      entityType: params.entityType,
      entityId: params.entityId,
      before: { name: params.name, ...(params.before as object) },
      after: { name: params.name, ...(params.after as object) },
      actor: params.actor,
    },
    tx,
  );
}

export async function auditCatalog(
  params: {
    action: "catalog.created" | "catalog.deleted" | "catalog.deactivated" | "catalog.status_changed";
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    actor: SessionUser;
  },
  tx?: Prisma.TransactionClient,
) {
  await audit(
    {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before,
      after: params.after,
      actor: params.actor,
    },
    tx,
  );
}
