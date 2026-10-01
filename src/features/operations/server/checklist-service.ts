import "server-only";
import type { ChecklistItemStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { can, isBackofficeRole, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import {
  completionFields,
  EVIDENCE_REQUIRED_MESSAGE,
  evidenceBlocksDone,
  partsToOffset,
  planChecklistItems,
  staffCanEditItem,
} from "../domain/checklist";
import { parseLocalDateTime } from "../domain/assignment";
import {
  createChecklistItemSchema,
  createTemplateItemSchema,
  staffChecklistUpdateSchema,
  templateSchema,
  updateChecklistItemSchema,
  updateTemplateItemSchema,
  updateTemplateSchema,
  type CreateChecklistItemInput,
  type StaffChecklistUpdateInput,
  type TemplateFormValues,
  type UpdateChecklistItemInput,
} from "../schemas";
import type { z } from "zod";

type Actor = Pick<SessionUser, "id" | "email" | "role">;

function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

const MAX_OFFSET_MINUTES = 365 * 24 * 60;

// =============================================================================
// Instanciación desde plantillas
// =============================================================================

/**
 * Crea (idempotente) los EventChecklistItem del evento a partir de los ChecklistTemplate activos
 * (generales + específicos de la experiencia), con dueAt = startsAt + offsetMinutes y responsable
 * según la función por defecto (si hay staff asignado con esa función).
 * Devuelve cuántos ítems se crearon (0 si ya existían).
 */
export async function instantiateChecklistsForEvent(eventId: string): Promise<{ created: number }> {
  return prisma.$transaction(async (tx) => {
    // Candado por evento: dos llamadas concurrentes no duplican ítems.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`checklist:${eventId}`}))) AS l`;

    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        startsAt: true,
        experienceId: true,
        staffAssignments: {
          select: { staffMemberId: true, function: true, confirmed: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!event) throw new NotFoundError("No encontramos el evento.");

    const [templateItems, existing] = await Promise.all([
      tx.checklistTemplateItem.findMany({
        where: {
          template: {
            active: true,
            OR: [{ experienceId: null }, ...(event.experienceId ? [{ experienceId: event.experienceId }] : [])],
          },
        },
        include: { template: { select: { phase: true, sortOrder: true, experienceId: true, active: true } } },
      }),
      tx.eventChecklistItem.findMany({
        where: { eventId, templateItemId: { not: null } },
        select: { templateItemId: true },
      }),
    ]);

    const planned = planChecklistItems({
      startsAt: event.startsAt,
      experienceId: event.experienceId,
      templateItems,
      existingTemplateItemIds: existing.map((e) => e.templateItemId!).filter(Boolean),
      assignments: event.staffAssignments,
    });
    if (!planned.length) return { created: 0 };

    const res = await tx.eventChecklistItem.createMany({
      data: planned.map((p) => ({ ...p, eventId, status: "PENDING" as const })),
    });
    return { created: res.count };
  });
}

// =============================================================================
// Edición de ítems (admin)
// =============================================================================

async function validateEvidence(
  evidenceMediaId: string,
  eventId: string,
  opts: { uploadedById?: string } = {},
): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: evidenceMediaId },
    select: { id: true, purpose: true, eventId: true, uploadedById: true },
  });
  if (!media || media.purpose !== "CHECKLIST_EVIDENCE" || media.eventId !== eventId) {
    throw new ValidationError("La evidencia no corresponde a este evento.", {
      evidenceMediaId: ["Sube la foto desde esta tarea."],
    });
  }
  if (opts.uploadedById && media.uploadedById !== opts.uploadedById) {
    throw new ForbiddenError("Sólo puedes adjuntar fotos que tú subiste.");
  }
}

async function validateAssignee(assigneeId: string): Promise<void> {
  const member = await prisma.staffMember.findUnique({ where: { id: assigneeId }, select: { id: true } });
  if (!member) throw new ValidationError("Selecciona un integrante válido.", { assigneeId: ["Integrante no encontrado."] });
}

type ItemRow = Prisma.EventChecklistItemGetPayload<object>;

async function applyItemChanges(
  actor: Actor,
  item: ItemRow,
  changes: {
    status?: ChecklistItemStatus;
    assigneeId?: string | null;
    notes?: string | null;
    evidenceMediaId?: string | null;
    dueAt?: Date | null;
  },
): Promise<ItemRow> {
  const nextEvidence = changes.evidenceMediaId !== undefined ? changes.evidenceMediaId : item.evidenceMediaId;
  const nextStatus = changes.status ?? item.status;

  if (nextStatus === "DONE" && evidenceBlocksDone({ requiresEvidence: item.requiresEvidence, evidenceMediaId: nextEvidence })) {
    throw new ValidationError(EVIDENCE_REQUIRED_MESSAGE, { status: [EVIDENCE_REQUIRED_MESSAGE] });
  }

  const data: Prisma.EventChecklistItemUncheckedUpdateInput = {};
  if (changes.status !== undefined) {
    data.status = changes.status;
    Object.assign(data, completionFields(changes.status, item, actor.id));
  }
  if (changes.assigneeId !== undefined) data.assigneeId = changes.assigneeId;
  if (changes.notes !== undefined) data.notes = changes.notes;
  if (changes.evidenceMediaId !== undefined) data.evidenceMediaId = changes.evidenceMediaId;
  if (changes.dueAt !== undefined) data.dueAt = changes.dueAt;

  return prisma.eventChecklistItem.update({ where: { id: item.id }, data });
}

/** Edición completa de un ítem desde el panel (checklists:write). */
export async function updateChecklistItem(actor: Actor, raw: UpdateChecklistItemInput): Promise<ItemRow> {
  assertCan(actor, "checklists:write");
  const input = updateChecklistItemSchema.parse(raw);
  const item = await prisma.eventChecklistItem.findUnique({ where: { id: input.id } });
  if (!item) throw new NotFoundError("La tarea ya no existe.");

  if (input.evidenceMediaId) await validateEvidence(input.evidenceMediaId, item.eventId);
  if (input.assigneeId) await validateAssignee(input.assigneeId);

  let dueAt: Date | null | undefined;
  if (input.dueAt !== undefined) {
    dueAt = input.dueAt === "" ? null : parseLocalDateTime(input.dueAt);
    if (input.dueAt !== "" && !dueAt) throw new ValidationError("Fecha inválida.", { dueAt: ["Fecha inválida."] });
  }

  return applyItemChanges(actor, item, {
    status: input.status,
    assigneeId: input.assigneeId,
    notes: input.notes,
    evidenceMediaId: input.evidenceMediaId,
    dueAt,
  });
}

/**
 * Edición desde el portal staff (checklists:update_assigned). STAFF sólo puede tocar tareas de
 * eventos a los que está asignada y que estén asignadas a ella o sin asignar.
 * SUPER_ADMIN/OWNER pueden editar cualquiera.
 */
export async function updateChecklistItemAsStaff(actor: Actor, raw: StaffChecklistUpdateInput): Promise<ItemRow> {
  assertCan(actor, "checklists:update_assigned");
  const input = staffChecklistUpdateSchema.parse(raw);
  const item = await prisma.eventChecklistItem.findUnique({
    where: { id: input.id },
    include: { event: { select: { status: true } } },
  });
  if (!item) throw new NotFoundError("La tarea ya no existe.");

  const backoffice = isBackofficeRole(actor.role);
  if (!backoffice) {
    const member = await prisma.staffMember.findUnique({ where: { userId: actor.id }, select: { id: true } });
    const assignment = member
      ? await prisma.staffAssignment.findFirst({
          where: { eventId: item.eventId, staffMemberId: member.id },
          select: { id: true },
        })
      : null;
    if (!member || !assignment || item.event.status === "CANCELLED") {
      throw new ForbiddenError("No estás asignada a este evento.");
    }
    if (!staffCanEditItem(item, member.id)) {
      throw new ForbiddenError("Esta tarea está asignada a otra persona del equipo.");
    }
    if (input.status === "SKIPPED") {
      throw new ForbiddenError("Sólo coordinación puede omitir tareas.");
    }
    if (item.status === "SKIPPED" && input.status !== undefined) {
      throw new ForbiddenError("Coordinación omitió esta tarea; pídele que la reabra si hace falta.");
    }
  }

  if (input.evidenceMediaId) {
    await validateEvidence(input.evidenceMediaId, item.eventId, backoffice ? {} : { uploadedById: actor.id });
  }

  const { event: _event, ...row } = item;
  return applyItemChanges(actor, row, {
    status: input.status,
    notes: input.notes,
    evidenceMediaId: input.evidenceMediaId,
  });
}

/** Tarea personalizada (fuera de plantillas). */
export async function createChecklistItem(actor: Actor, raw: CreateChecklistItemInput): Promise<ItemRow> {
  assertCan(actor, "checklists:write");
  const input = createChecklistItemSchema.parse(raw);
  const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true, status: true } });
  if (!event) throw new NotFoundError("No encontramos el evento.");
  if (event.status === "CANCELLED") throw new ConflictError("El evento está cancelado.");
  if (input.assigneeId) await validateAssignee(input.assigneeId);
  const dueAt = input.dueAt ? parseLocalDateTime(input.dueAt) : null;
  if (input.dueAt && !dueAt) throw new ValidationError("Fecha inválida.", { dueAt: ["Fecha y hora inválidas."] });
  const last = await prisma.eventChecklistItem.aggregate({
    where: { eventId: input.eventId, phase: input.phase },
    _max: { sortOrder: true },
  });
  return prisma.eventChecklistItem.create({
    data: {
      eventId: input.eventId,
      phase: input.phase,
      area: input.area,
      title: input.title,
      description: input.description,
      dueAt,
      assigneeId: input.assigneeId,
      requiresEvidence: input.requiresEvidence,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function deleteChecklistItem(actor: Actor, id: string): Promise<{ eventId: string }> {
  assertCan(actor, "checklists:write");
  const item = await prisma.eventChecklistItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError("La tarea ya no existe.");
  await prisma.eventChecklistItem.delete({ where: { id } });
  await audit({
    action: "checklist.item_deleted",
    entityType: "EventChecklistItem",
    entityId: id,
    before: { eventId: item.eventId, title: item.title, phase: item.phase, status: item.status },
    actor,
  });
  return { eventId: item.eventId };
}

// =============================================================================
// Plantillas
// =============================================================================

async function validateExperience(experienceId: string | null): Promise<void> {
  if (!experienceId) return;
  const exp = await prisma.experience.findUnique({ where: { id: experienceId }, select: { id: true } });
  if (!exp) throw new ValidationError("Selecciona una experiencia válida.", { experienceId: ["Experiencia no encontrada."] });
}

export async function createTemplate(actor: Actor, raw: TemplateFormValues) {
  assertCan(actor, "checklists:write");
  const input = templateSchema.parse(raw);
  await validateExperience(input.experienceId);
  const template = await prisma.checklistTemplate.create({ data: input });
  await audit({ action: "checklist_template.created", entityType: "ChecklistTemplate", entityId: template.id, after: input, actor });
  return template;
}

export async function updateTemplate(actor: Actor, raw: z.input<typeof updateTemplateSchema>) {
  assertCan(actor, "checklists:write");
  const { id, ...input } = updateTemplateSchema.parse(raw);
  const before = await prisma.checklistTemplate.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("La plantilla ya no existe.");
  await validateExperience(input.experienceId);
  const template = await prisma.checklistTemplate.update({ where: { id }, data: input });
  await audit({
    action: "checklist_template.updated",
    entityType: "ChecklistTemplate",
    entityId: id,
    before: {
      name: before.name,
      phase: before.phase,
      active: before.active,
      experienceId: before.experienceId,
      sortOrder: before.sortOrder,
    },
    after: input,
    actor,
  });
  return template;
}

export async function deleteTemplate(actor: Actor, id: string): Promise<void> {
  assertCan(actor, "checklists:write");
  const before = await prisma.checklistTemplate.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
  if (!before) throw new NotFoundError("La plantilla ya no existe.");
  await prisma.checklistTemplate.delete({ where: { id } });
  await audit({
    action: "checklist_template.deleted",
    entityType: "ChecklistTemplate",
    entityId: id,
    before: { name: before.name, phase: before.phase, items: before._count.items },
    actor,
  });
}

function templateItemData(input: z.output<typeof createTemplateItemSchema> | z.output<typeof updateTemplateItemSchema>) {
  const offsetMinutes = partsToOffset({
    amount: input.offsetAmount,
    unit: input.offsetUnit,
    direction: input.offsetDirection,
  });
  if (Math.abs(offsetMinutes) > MAX_OFFSET_MINUTES) {
    throw new ValidationError("El desfase máximo es de 365 días.", { offsetAmount: ["Máximo 365 días."] });
  }
  return {
    title: input.title,
    description: input.description,
    area: input.area,
    offsetMinutes,
    defaultFunction: input.defaultFunction,
    requiresEvidence: input.requiresEvidence,
    sortOrder: input.sortOrder,
  };
}

export async function createTemplateItem(actor: Actor, raw: z.input<typeof createTemplateItemSchema>) {
  assertCan(actor, "checklists:write");
  const input = createTemplateItemSchema.parse(raw);
  const template = await prisma.checklistTemplate.findUnique({ where: { id: input.templateId }, select: { id: true } });
  if (!template) throw new NotFoundError("La plantilla ya no existe.");
  return prisma.checklistTemplateItem.create({ data: { templateId: input.templateId, ...templateItemData(input) } });
}

export async function updateTemplateItem(actor: Actor, raw: z.input<typeof updateTemplateItemSchema>) {
  assertCan(actor, "checklists:write");
  const input = updateTemplateItemSchema.parse(raw);
  const existing = await prisma.checklistTemplateItem.findUnique({ where: { id: input.id }, select: { templateId: true } });
  if (!existing) throw new NotFoundError("La tarea de plantilla ya no existe.");
  return prisma.checklistTemplateItem.update({ where: { id: input.id }, data: templateItemData(input) });
}

export async function deleteTemplateItem(actor: Actor, id: string): Promise<{ templateId: string }> {
  assertCan(actor, "checklists:write");
  const existing = await prisma.checklistTemplateItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("La tarea de plantilla ya no existe.");
  await prisma.checklistTemplateItem.delete({ where: { id } });
  await audit({
    action: "checklist_template.item_deleted",
    entityType: "ChecklistTemplateItem",
    entityId: id,
    before: { templateId: existing.templateId, title: existing.title },
    actor,
  });
  return { templateId: existing.templateId };
}

/** Evita instanciar en eventos cancelados desde la UI. */
export async function instantiateChecklistsAsAdmin(actor: Actor, eventId: string): Promise<{ created: number }> {
  assertCan(actor, "checklists:write");
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event) throw new NotFoundError("No encontramos el evento.");
  if (event.status === "CANCELLED") throw new ConflictError("El evento está cancelado.");
  return instantiateChecklistsForEvent(eventId);
}
