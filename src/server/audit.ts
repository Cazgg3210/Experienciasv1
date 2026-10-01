import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/server/auth/session";

/**
 * Acciones sensibles auditadas (cambio de precio, descuento, cambio de evento, pago manual,
 * cancelación, eliminación, cambios de rol...). Convención: "<entidad>.<verbo>".
 */
export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  actor?: Pick<SessionUser, "id" | "email"> | null;
  ip?: string | null;
};

type Tx = Prisma.TransactionClient;

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function audit(input: AuditInput, tx: Tx = prisma): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    // La auditoría nunca debe tumbar la operación principal fuera de una transacción.
    logger.error("audit.write_failed", { error, action: input.action });
    if (tx !== prisma) throw error;
  }
}
