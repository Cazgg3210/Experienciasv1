import "server-only";
import type { LeadActivityType, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { dateOnly, toDateKey } from "@/lib/dates";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { LEAD_STATUS_LABELS } from "@/lib/labels";
import { samePhone } from "@/lib/phone";
import { InvalidTransitionError } from "@/lib/state-machine";
import { audit } from "@/server/audit";
import { can, type Permission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { getSettings } from "@/features/settings/server/settings-service";
import { createInboundLead, type InboundLeadResult } from "@/features/leads/server/lead-intake";
import { phoneForStorage } from "@/features/customers/server/customer-contact";
import { leadStatusMachine } from "../domain/lead-status";
import {
  LEAD_STATUS_VALUES,
  buildLeadOrderBy,
  buildLeadWhere,
  type LeadFilters,
} from "../domain/lead-filters";
import type { LeadExportRecord } from "../domain/lead-export";
import { isContactActivity, shouldAutoContact, type LoggableActivityType } from "../domain/lead-workflow";
import type { CreateLeadInput, UpdateLeadInput } from "../schemas";

type Ctx = { ip?: string | null };

/** Holgura para transacciones interactivas (el default de Prisma, 5 s, se agota con la BD bajo carga). */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

function assertCan(actor: SessionUser, permission: Permission) {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

function clean(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

// -----------------------------------------------------------------------------
// LECTURA
// -----------------------------------------------------------------------------

const listSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  occasion: true,
  occasionOther: true,
  eventDate: true,
  guestCount: true,
  status: true,
  source: true,
  outOfArea: true,
  specialRequest: true,
  zoneText: true,
  estimatedTotalCents: true,
  lostReason: true,
  lastContactedAt: true,
  createdAt: true,
  customerId: true,
  experience: { select: { id: true, name: true } },
  budgetRange: { select: { id: true, label: true } },
  serviceArea: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

export type LeadListItem = Prisma.LeadGetPayload<{ select: typeof listSelect }>;

export type LeadListResult = { items: LeadListItem[]; total: number; page: number; pageSize: number };

export const LEADS_PAGE_SIZE = 25;

/** Listado paginado y filtrado (tabla de /admin/leads). */
export async function listLeads(
  actor: SessionUser,
  filters: LeadFilters,
  opts: { page?: number; pageSize?: number } = {},
): Promise<LeadListResult> {
  assertCan(actor, "leads:read");
  const pageSize = Math.min(Math.max(opts.pageSize ?? LEADS_PAGE_SIZE, 1), 200);
  const where = buildLeadWhere(filters);
  const total = await prisma.lead.count({ where });
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(opts.page ?? 1, 1), lastPage);
  const items = await prisma.lead.findMany({
    where,
    orderBy: buildLeadOrderBy(filters.sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: listSelect,
  });
  return { items, total, page, pageSize };
}

/** Conteo por estado (ignora el filtro de estado para que el resumen siempre muestre todo el embudo). */
export async function countLeadsByStatus(actor: SessionUser, filters: LeadFilters): Promise<Record<LeadStatus, number>> {
  assertCan(actor, "leads:read");
  const rows = await prisma.lead.groupBy({
    by: ["status"],
    where: buildLeadWhere(filters, { ignoreStatus: true }),
    _count: { _all: true },
  });
  const out = Object.fromEntries(LEAD_STATUS_VALUES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const row of rows) out[row.status] = row._count._all;
  return out;
}

export type KanbanColumn = { status: LeadStatus; items: LeadListItem[]; total: number };

/** Columnas del kanban (un query por estado, limitado por columna). */
export async function listLeadsForKanban(
  actor: SessionUser,
  filters: LeadFilters,
  opts: { perColumn?: number; counts?: Record<LeadStatus, number> } = {},
): Promise<KanbanColumn[]> {
  const perColumn = opts.perColumn ?? 40;
  assertCan(actor, "leads:read");
  const statuses = filters.statuses.length ? LEAD_STATUS_VALUES.filter((s) => filters.statuses.includes(s)) : [...LEAD_STATUS_VALUES];
  const base = buildLeadWhere(filters, { ignoreStatus: true });
  // Totales en un solo groupBy; tarjetas por columna en secuencia (pocas conexiones simultáneas).
  const counts = opts.counts ?? (await countLeadsByStatus(actor, filters));
  const columns: KanbanColumn[] = [];
  for (const status of statuses) {
    const items = counts[status]
      ? await prisma.lead.findMany({
          where: { AND: [base, { status }] },
          orderBy: buildLeadOrderBy(filters.sort),
          take: perColumn,
          select: listSelect,
        })
      : [];
    columns.push({ status, items, total: counts[status] });
  }
  return columns;
}

export const LEADS_EXPORT_LIMIT = 5000;

/** Leads filtrados para exportar a CSV (máx. 5,000 filas). */
export async function listLeadsForExport(actor: SessionUser, filters: LeadFilters): Promise<LeadExportRecord[]> {
  assertCan(actor, "leads:read");
  const rows = await prisma.lead.findMany({
    where: buildLeadWhere(filters),
    orderBy: buildLeadOrderBy(filters.sort),
    take: LEADS_EXPORT_LIMIT,
    select: listSelect,
  });
  return rows.map((l) => ({
    code: l.code,
    name: l.name,
    phone: l.phone,
    email: l.email,
    occasion: l.occasion,
    occasionOther: l.occasionOther,
    experienceName: l.experience?.name ?? null,
    eventDate: l.eventDate,
    guestCount: l.guestCount,
    budgetLabel: l.budgetRange?.label ?? null,
    estimatedTotalCents: l.estimatedTotalCents,
    status: l.status,
    source: l.source,
    zone: l.serviceArea?.name ?? l.zoneText,
    outOfArea: l.outOfArea,
    specialRequest: l.specialRequest,
    assignedToName: l.assignedTo?.name ?? null,
    lostReason: l.lostReason,
    createdAt: l.createdAt,
    lastContactedAt: l.lastContactedAt,
  }));
}

/** Personas del equipo a las que se puede asignar un lead (fundadoras y administradoras activas). */
export async function listAssignableUsers() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ["OWNER", "SUPER_ADMIN"] } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
}
export type AssignableUser = Awaited<ReturnType<typeof listAssignableUsers>>[number];

// -----------------------------------------------------------------------------
// ESCRITURA
// -----------------------------------------------------------------------------

/**
 * Captura manual desde el panel. Reutiliza la captura única (clienta, timeline, snapshot).
 * Canal "team": no dispara avisos de lead entrante aunque el origen sea Instagram, WhatsApp, etc.
 */
export async function createManualLead(actor: SessionUser, input: CreateLeadInput): Promise<InboundLeadResult> {
  assertCan(actor, "leads:write");
  const serviceAreaId = clean(input.serviceAreaId);
  return createInboundLead(
    {
      name: input.name,
      email: clean(input.email),
      phone: clean(input.phone),
      occasion: input.occasion,
      occasionOther: input.occasion === "OTHER" ? clean(input.occasionOther) : null,
      eventDate: clean(input.eventDate),
      guestCount: input.guestCount ?? null,
      serviceAreaId,
      zoneText: serviceAreaId ? null : clean(input.zoneText),
      experienceId: clean(input.experienceId),
      budgetRangeId: clean(input.budgetRangeId),
      notes: clean(input.notes),
      source: input.source ?? "MANUAL",
      assignedToId: actor.role === "OWNER" || actor.role === "SUPER_ADMIN" ? actor.id : null,
    },
    { actor, channel: "team" },
  );
}

export type ChangeStatusResult = { leadId: string; fromStatus: LeadStatus; toStatus: LeadStatus };

/**
 * Cambia el estado respetando `leadStatusMachine`. LOST exige motivo.
 * Deja LeadActivity STATUS_CHANGE (from/to) y auditoría. Protegido contra cambios concurrentes.
 */
export async function changeLeadStatus(
  actor: SessionUser,
  input: { leadId: string; toStatus: LeadStatus; lostReason?: string | null; note?: string | null },
  ctx: Ctx = {},
): Promise<ChangeStatusResult> {
  assertCan(actor, "leads:write");
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, code: true, status: true, lostReason: true },
  });
  if (!lead) throw new NotFoundError("No encontramos ese lead.");

  const from = lead.status;
  const to = input.toStatus;
  try {
    leadStatusMachine.assert(from, to);
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      throw new ConflictError(
        from === to
          ? `El lead ya está en “${LEAD_STATUS_LABELS[to]}”.`
          : `No es posible mover un lead de “${LEAD_STATUS_LABELS[from]}” a “${LEAD_STATUS_LABELS[to]}”.`,
      );
    }
    throw error;
  }

  const lostReason = clean(input.lostReason);
  if (to === "LOST" && !lostReason) {
    throw new ValidationError("Indica el motivo por el que se perdió el lead.", {
      lostReason: ["Cuéntanos por qué se perdió"],
    });
  }
  const note = clean(input.note);
  const message = [to === "LOST" ? `Motivo: ${lostReason}` : null, note].filter(Boolean).join(" — ") || null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.updateMany({
      where: { id: lead.id, status: from },
      data: { status: to, lostReason: to === "LOST" ? lostReason : null },
    });
    if (updated.count !== 1) {
      throw new ConflictError("El lead cambió mientras lo editabas. Recarga la página e intenta de nuevo.");
    }
    await tx.leadActivity.create({
      data: { leadId: lead.id, type: "STATUS_CHANGE", fromStatus: from, toStatus: to, message, actorId: actor.id },
    });
    await audit(
      {
        action: "lead.status_changed",
        entityType: "Lead",
        entityId: lead.id,
        before: { status: from, lostReason: lead.lostReason },
        after: { status: to, lostReason: to === "LOST" ? lostReason : null },
        actor,
        ip: ctx.ip,
      },
      tx,
    );
  }, TX_OPTIONS);

  return { leadId: lead.id, fromStatus: from, toStatus: to };
}

/** Asigna (o desasigna con null) el lead a una fundadora/administradora activa. */
export async function assignLead(
  actor: SessionUser,
  input: { leadId: string; assigneeId: string | null },
  ctx: Ctx = {},
): Promise<{ changed: boolean; assigneeId: string | null }> {
  assertCan(actor, "leads:write");
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, assignedToId: true, assignedTo: { select: { name: true } } },
  });
  if (!lead) throw new NotFoundError("No encontramos ese lead.");

  const assigneeId = clean(input.assigneeId);
  let assigneeName: string | null = null;
  if (assigneeId) {
    const user = await prisma.user.findFirst({
      where: { id: assigneeId, active: true, role: { in: ["OWNER", "SUPER_ADMIN"] } },
      select: { id: true, name: true },
    });
    if (!user) {
      throw new ValidationError("Sólo puedes asignar leads a fundadoras o administradoras activas.", {
        assigneeId: ["Elige a alguien del equipo"],
      });
    }
    assigneeName = user.name;
  }
  if (lead.assignedToId === assigneeId) return { changed: false, assigneeId };

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { assignedToId: assigneeId } });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "ASSIGNED",
        actorId: actor.id,
        message: assigneeName
          ? `Asignado a ${assigneeName}${lead.assignedTo ? ` (antes: ${lead.assignedTo.name})` : ""}.`
          : `Se quitó la asignación${lead.assignedTo ? ` de ${lead.assignedTo.name}` : ""}.`,
      },
    });
    await audit(
      {
        action: "lead.assigned",
        entityType: "Lead",
        entityId: lead.id,
        before: { assignedToId: lead.assignedToId },
        after: { assignedToId: assigneeId },
        actor,
        ip: ctx.ip,
      },
      tx,
    );
  }, TX_OPTIONS);
  return { changed: true, assigneeId };
}

export type LogActivityResult = { activityId: string; autoContacted: boolean };

/**
 * Registra una nota o un contacto (llamada, WhatsApp, email).
 * Los contactos actualizan `lastContactedAt` y mueven NEW → CONTACTED automáticamente.
 */
export async function logLeadActivity(
  actor: SessionUser,
  input: { leadId: string; type: LoggableActivityType; message: string },
): Promise<LogActivityResult> {
  assertCan(actor, "leads:write");
  const message = input.message.trim();
  if (message.length < 2) throw new ValidationError("Escribe un breve resumen.", { message: ["Escribe un breve resumen"] });

  // Lectura fuera de la transacción (transacción corta); el cambio de estado es condicional (status: NEW).
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, status: true } });
  if (!lead) throw new NotFoundError("No encontramos ese lead.");

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const activity = await tx.leadActivity.create({
      data: { leadId: lead.id, type: input.type as LeadActivityType, message, actorId: actor.id, createdAt: now },
      select: { id: true },
    });

    let autoContacted = false;
    if (isContactActivity(input.type)) {
      if (shouldAutoContact(lead.status, input.type)) {
        leadStatusMachine.assert("NEW", "CONTACTED");
        const moved = await tx.lead.updateMany({
          where: { id: lead.id, status: "NEW" },
          data: { status: "CONTACTED", lastContactedAt: now },
        });
        autoContacted = moved.count === 1;
      }
      if (autoContacted) {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "STATUS_CHANGE",
            fromStatus: "NEW",
            toStatus: "CONTACTED",
            actorId: actor.id,
            message: "Movido automáticamente al registrar el primer contacto.",
            // 1 ms después para que el timeline conserve el orden lógico
            createdAt: new Date(now.getTime() + 1),
          },
        });
      } else {
        await tx.lead.update({ where: { id: lead.id }, data: { lastContactedAt: now } });
      }
    }
    return { activityId: activity.id, autoContacted };
  }, TX_OPTIONS);
}

const FIELD_LABELS: Record<string, string> = {
  name: "nombre",
  email: "email",
  phone: "teléfono",
  occasion: "ocasión",
  occasionOther: "otra ocasión",
  eventDate: "fecha",
  guestCount: "invitadas",
  budgetRangeId: "presupuesto",
  budgetNotes: "notas de presupuesto",
  serviceAreaId: "zona",
  zoneText: "zona escrita",
  experienceId: "experiencia",
  styleId: "estilo",
  menuId: "menú",
  honoreeName: "homenajeada",
  colors: "colores",
  inspiration: "inspiración",
  notes: "notas",
};

function comparable(value: unknown): string {
  if (value instanceof Date) return toDateKey(value);
  if (Array.isArray(value)) return value.join("|");
  return value == null ? "" : String(value);
}

async function assertCatalogRefs(input: {
  experienceId: string | null;
  styleId: string | null;
  menuId: string | null;
  serviceAreaId: string | null;
  budgetRangeId: string | null;
}) {
  const checks: Array<[keyof typeof input, Promise<number> | null, string]> = [
    ["experienceId", input.experienceId ? prisma.experience.count({ where: { id: input.experienceId } }) : null, "Esa experiencia ya no existe"],
    ["styleId", input.styleId ? prisma.style.count({ where: { id: input.styleId } }) : null, "Ese estilo ya no existe"],
    ["menuId", input.menuId ? prisma.menu.count({ where: { id: input.menuId } }) : null, "Ese menú ya no existe"],
    ["serviceAreaId", input.serviceAreaId ? prisma.serviceArea.count({ where: { id: input.serviceAreaId } }) : null, "Esa zona ya no existe"],
    ["budgetRangeId", input.budgetRangeId ? prisma.budgetRange.count({ where: { id: input.budgetRangeId } }) : null, "Ese rango ya no existe"],
  ];
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, promise, message] of checks) {
    if (promise && (await promise) === 0) fieldErrors[key] = [message];
  }
  if (Object.keys(fieldErrors).length) throw new ValidationError("Revisa las opciones elegidas.", fieldErrors);
}

/** Edita los datos del lead. Recalcula banderas (fuera de cobertura / consulta especial). */
export async function updateLead(
  actor: SessionUser,
  input: UpdateLeadInput,
  ctx: Ctx = {},
): Promise<{ changed: string[] }> {
  assertCan(actor, "leads:write");
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new NotFoundError("No encontramos ese lead.");

  const serviceAreaId = clean(input.serviceAreaId);
  const next = {
    name: input.name.trim(),
    email: clean(input.email)?.toLowerCase() ?? null,
    phone: phoneForStorage(input.phone),
    occasion: input.occasion,
    occasionOther: input.occasion === "OTHER" ? clean(input.occasionOther) : null,
    eventDate: clean(input.eventDate) ? dateOnly(input.eventDate!.trim()) : null,
    guestCount: input.guestCount ?? null,
    budgetRangeId: clean(input.budgetRangeId),
    budgetNotes: clean(input.budgetNotes),
    serviceAreaId,
    // Igual que la captura: la zona escrita sólo aplica cuando no hay zona de servicio elegida
    zoneText: serviceAreaId ? null : clean(input.zoneText),
    experienceId: clean(input.experienceId),
    styleId: clean(input.styleId),
    menuId: clean(input.menuId),
    honoreeName: clean(input.honoreeName),
    colors: (input.colors ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 12),
    inspiration: clean(input.inspiration),
    notes: clean(input.notes),
  };

  await assertCatalogRefs(next);

  // Un teléfono que sólo pasa a la forma canónica (mismo número) no cuenta como cambio.
  const changedKeys = (Object.keys(next) as Array<keyof typeof next>).filter((k) =>
    k === "phone" ? !samePhone(next.phone, lead.phone) : comparable(next[k]) !== comparable(lead[k as keyof typeof lead]),
  );
  if (!changedKeys.length) return { changed: [] };

  // Banderas derivadas (misma regla que la captura de leads)
  let outOfArea = false;
  if (serviceAreaId) {
    const area = await prisma.serviceArea.findUnique({ where: { id: serviceAreaId }, select: { active: true } });
    outOfArea = !area?.active;
  } else if (next.zoneText) {
    outOfArea = true;
  }
  const pricing = await getSettings("pricing");
  const specialRequest = (next.guestCount ?? 0) > pricing.maxStandardGuests;

  const before = Object.fromEntries(changedKeys.map((k) => [k, lead[k as keyof typeof lead]]));
  const after = Object.fromEntries(changedKeys.map((k) => [k, next[k]]));

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { ...next, outOfArea, specialRequest } });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "SYSTEM",
        actorId: actor.id,
        message: `Datos actualizados: ${changedKeys.map((k) => FIELD_LABELS[k] ?? k).join(", ")}.`,
      },
    });
    await audit({ action: "lead.updated", entityType: "Lead", entityId: lead.id, before, after, actor, ip: ctx.ip }, tx);
  }, TX_OPTIONS);
  return { changed: changedKeys };
}
