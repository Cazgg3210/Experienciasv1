import "server-only";
import { prisma } from "@/db";
import { dateOnly, localDateKey, toDateKey } from "@/lib/dates";
import { CAPACITY_STATUSES } from "@/features/events/domain/event-status";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { normalizeWeeklyRules, validateWeeklyRules, type WeeklyRule } from "../domain/weekly-rules";
import type { AvailabilityExceptionInput } from "../schemas";

/** Reglas por día de la semana (siempre 7, lunes→domingo; los faltantes con defaults). */
export async function getWeeklyRules(): Promise<WeeklyRule[]> {
  const rows = await prisma.availabilityRule.findMany({
    select: { weekday: true, isOpen: true, maxEvents: true, earliestStart: true, latestEnd: true },
  });
  return normalizeWeeklyRules(rows);
}

export async function saveWeeklyRules(rules: WeeklyRule[], actor: SessionUser): Promise<WeeklyRule[]> {
  const errors = validateWeeklyRules(rules);
  const messages = Object.values(errors);
  if (messages.length) throw new ValidationError(messages[0]);

  const before = await getWeeklyRules();
  await prisma.$transaction(async (tx) => {
    for (const r of rules) {
      const data = {
        isOpen: r.isOpen,
        maxEvents: r.maxEvents,
        earliestStart: r.earliestStart,
        latestEnd: r.latestEnd,
      };
      await tx.availabilityRule.upsert({
        where: { weekday: r.weekday },
        create: { weekday: r.weekday, ...data },
        update: data,
      });
    }
    await audit(
      {
        action: "availability.rules_changed",
        entityType: "AvailabilityRule",
        entityId: null,
        before,
        after: normalizeWeeklyRules(rules),
        actor,
      },
      tx,
    );
  });
  return getWeeklyRules();
}

/** Excepciones desde una fecha (incluida), con el nombre de la zona si aplica. */
export async function listExceptions(fromKey: string, take = 100) {
  const rows = await prisma.availabilityException.findMany({
    where: { date: { gte: dateOnly(fromKey) } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take,
  });
  const areaIds = Array.from(new Set(rows.map((r) => r.serviceAreaId).filter((x): x is string => !!x)));
  const areas = areaIds.length
    ? await prisma.serviceArea.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(areas.map((a) => [a.id, a.name]));
  return rows.map((r) => ({
    id: r.id,
    date: toDateKey(r.date),
    type: r.type,
    maxEvents: r.maxEvents,
    reason: r.reason,
    serviceAreaId: r.serviceAreaId,
    serviceAreaName: r.serviceAreaId ? (names.get(r.serviceAreaId) ?? "Zona eliminada") : null,
  }));
}
export type AvailabilityExceptionRow = Awaited<ReturnType<typeof listExceptions>>[number];

export async function createAvailabilityException(
  input: AvailabilityExceptionInput,
  actor: SessionUser,
): Promise<{ id: string; eventsThatDay: number }> {
  if (input.date < localDateKey()) {
    throw new ValidationError("Elige hoy o una fecha futura.", {
      date: ["Elige hoy o una fecha futura."],
    });
  }
  const serviceAreaId = input.serviceAreaId.trim() || null;
  if (serviceAreaId) {
    const area = await prisma.serviceArea.findUnique({ where: { id: serviceAreaId }, select: { id: true } });
    if (!area)
      throw new ValidationError("La zona ya no existe.", { serviceAreaId: ["La zona ya no existe."] });
  }
  const date = dateOnly(input.date);
  const duplicate = await prisma.availabilityException.findFirst({
    where: { date, type: input.type, serviceAreaId },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError("Ya existe una excepción igual para esa fecha.");

  const maxEvents = input.type === "CAPACITY_OVERRIDE" ? (input.maxEvents ?? 0) : null;
  const created = await prisma.availabilityException.create({
    data: { date, type: input.type, maxEvents, reason: input.reason.trim() || null, serviceAreaId },
    select: { id: true },
  });
  await audit({
    action: "availability.exception_created",
    entityType: "AvailabilityException",
    entityId: created.id,
    after: {
      date: input.date,
      type: input.type,
      maxEvents,
      reason: input.reason.trim() || null,
      serviceAreaId,
    },
    actor,
  });
  // Aviso para la UI: el bloqueo no cancela eventos que ya ocupan ese día.
  const eventsThatDay = await prisma.event.count({
    where: {
      eventDate: date,
      status: { in: CAPACITY_STATUSES },
      ...(serviceAreaId ? { serviceAreaId } : {}),
    },
  });
  return { id: created.id, eventsThatDay };
}

export async function deleteAvailabilityException(id: string, actor: SessionUser): Promise<void> {
  const row = await prisma.availabilityException.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Esa excepción ya no existe.");
  await prisma.availabilityException.delete({ where: { id } });
  await audit({
    action: "availability.exception_deleted",
    entityType: "AvailabilityException",
    entityId: id,
    before: {
      date: toDateKey(row.date),
      type: row.type,
      maxEvents: row.maxEvents,
      reason: row.reason,
      serviceAreaId: row.serviceAreaId,
    },
    actor,
  });
}
