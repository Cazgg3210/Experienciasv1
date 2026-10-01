import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { addDaysUtc, dateOnly, toDateKey, zonedDateTime } from "@/lib/dates";
import type { AuditFilters } from "../domain/filters";

export const AUDIT_PAGE_SIZE = 25;

export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  ip: string | null;
  createdAt: Date;
  actorEmail: string | null;
  actor: { id: string; name: string; email: string } | null;
};

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.action) where.action = f.action;
  if (f.entityType) where.entityType = f.entityType;
  if (f.entityId) where.entityId = f.entityId;
  if (f.actor === "system") where.actorId = null;
  else if (f.actor) where.actorId = f.actor;
  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = zonedDateTime(f.from, "00:00");
    if (f.to) where.createdAt.lt = zonedDateTime(toDateKey(addDaysUtc(dateOnly(f.to), 1)), "00:00");
  }
  return where;
}

export async function listAuditLogs(
  filters: AuditFilters,
  page: number,
  pageSize = AUDIT_PAGE_SIZE,
): Promise<{ items: AuditRow[]; total: number }> {
  const where = auditWhere(filters);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        ip: true,
        createdAt: true,
        actorEmail: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total };
}

/** Opciones para los filtros (acciones, entidades y personas que aparecen en la bitácora). */
export async function getAuditFilterOptions(): Promise<{
  actions: string[];
  entityTypes: string[];
  actors: Array<{ id: string; label: string }>;
}> {
  const [actions, entityTypes, actorGroups] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: { actorId: { not: null } } }),
  ]);
  const ids = actorGroups.map((a) => a.actorId).filter((x): x is string => !!x);
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  return {
    actions: actions.map((a) => a.action),
    entityTypes: entityTypes.map((e) => e.entityType),
    actors: users
      .map((u) => ({ id: u.id, label: `${u.name} · ${u.email}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "es")),
  };
}
