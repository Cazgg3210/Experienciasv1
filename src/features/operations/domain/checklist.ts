/**
 * Lógica pura de checklists operativos (sin I/O): fechas límite, offsets de plantillas,
 * reglas de completado y progreso por fase.
 */
import type { ChecklistArea, ChecklistItemStatus, ChecklistPhase, StaffFunction } from "@prisma/client";
import { CHECKLIST_PHASE_ORDER } from "@/lib/labels";

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * 60;

/** dueAt = inicio del evento + offset (minutos, negativo = antes). */
export function computeDueAt(startsAt: Date, offsetMinutes: number): Date {
  return new Date(startsAt.getTime() + offsetMinutes * 60_000);
}

export type OffsetUnit = "days" | "hours" | "minutes";
export type OffsetDirection = "before" | "after";
export type OffsetParts = { amount: number; unit: OffsetUnit; direction: OffsetDirection };

const UNIT_MINUTES: Record<OffsetUnit, number> = { days: MINUTES_PER_DAY, hours: MINUTES_PER_HOUR, minutes: 1 };

/** Convierte offsetMinutes a la representación más legible ("N días/horas/minutos antes/después"). */
export function offsetToParts(offsetMinutes: number): OffsetParts {
  const direction: OffsetDirection = offsetMinutes < 0 ? "before" : "after";
  const abs = Math.abs(offsetMinutes);
  if (abs === 0) return { amount: 0, unit: "hours", direction: "after" };
  if (abs % MINUTES_PER_DAY === 0) return { amount: abs / MINUTES_PER_DAY, unit: "days", direction };
  if (abs % MINUTES_PER_HOUR === 0) return { amount: abs / MINUTES_PER_HOUR, unit: "hours", direction };
  return { amount: abs, unit: "minutes", direction };
}

export function partsToOffset(parts: OffsetParts): number {
  const minutes = Math.round(Math.abs(parts.amount) * UNIT_MINUTES[parts.unit]);
  return parts.direction === "before" ? -minutes : minutes;
}

const UNIT_LABELS: Record<OffsetUnit, [string, string]> = {
  days: ["día", "días"],
  hours: ["hora", "horas"],
  minutes: ["minuto", "minutos"],
};

export const OFFSET_UNIT_LABELS: Record<OffsetUnit, string> = { days: "Días", hours: "Horas", minutes: "Minutos" };
export const OFFSET_DIRECTION_LABELS: Record<OffsetDirection, string> = {
  before: "antes del inicio",
  after: "después del inicio",
};

/** "3 días antes del inicio", "Al inicio del evento", "90 minutos antes del inicio" */
export function describeOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "Al inicio del evento";
  const p = offsetToParts(offsetMinutes);
  const [one, many] = UNIT_LABELS[p.unit];
  return `${p.amount} ${p.amount === 1 ? one : many} ${OFFSET_DIRECTION_LABELS[p.direction]}`;
}

// -----------------------------------------------------------------------------
// Instanciación de plantillas
// -----------------------------------------------------------------------------

export type TemplateItemForInstantiation = {
  id: string;
  title: string;
  description: string | null;
  area: ChecklistArea;
  offsetMinutes: number;
  defaultFunction: StaffFunction | null;
  requiresEvidence: boolean;
  sortOrder: number;
  template: { phase: ChecklistPhase; sortOrder: number; experienceId: string | null; active: boolean };
};

export type AssignmentForInstantiation = { staffMemberId: string; function: StaffFunction; confirmed?: boolean };

export type PlannedChecklistItem = {
  templateItemId: string;
  phase: ChecklistPhase;
  area: ChecklistArea;
  title: string;
  description: string | null;
  dueAt: Date;
  requiresEvidence: boolean;
  assigneeId: string | null;
  sortOrder: number;
};

/** Elige a la persona asignada al evento con esa función (prefiere confirmadas). */
export function pickAssignee(
  fn: StaffFunction | null,
  assignments: AssignmentForInstantiation[],
): string | null {
  if (!fn) return null;
  const matches = assignments.filter((a) => a.function === fn);
  if (!matches.length) return null;
  const confirmed = matches.find((a) => a.confirmed);
  return (confirmed ?? matches[0]!).staffMemberId;
}

/**
 * Calcula qué ítems crear para un evento (idempotente): ignora plantillas inactivas o de otra
 * experiencia y los templateItem ya instanciados.
 */
export function planChecklistItems(input: {
  startsAt: Date;
  experienceId: string | null;
  templateItems: TemplateItemForInstantiation[];
  existingTemplateItemIds: Iterable<string>;
  assignments: AssignmentForInstantiation[];
}): PlannedChecklistItem[] {
  const existing = new Set(input.existingTemplateItemIds);
  return input.templateItems
    .filter((ti) => ti.template.active)
    .filter((ti) => ti.template.experienceId === null || ti.template.experienceId === input.experienceId)
    .filter((ti) => !existing.has(ti.id))
    .sort(
      (a, b) =>
        phaseIndex(a.template.phase) - phaseIndex(b.template.phase) ||
        a.template.sortOrder - b.template.sortOrder ||
        a.sortOrder - b.sortOrder,
    )
    .map((ti) => ({
      templateItemId: ti.id,
      phase: ti.template.phase,
      area: ti.area,
      title: ti.title,
      description: ti.description,
      dueAt: computeDueAt(input.startsAt, ti.offsetMinutes),
      requiresEvidence: ti.requiresEvidence,
      assigneeId: pickAssignee(ti.defaultFunction, input.assignments),
      sortOrder: ti.template.sortOrder * 1000 + ti.sortOrder,
    }));
}

// -----------------------------------------------------------------------------
// Estado de un ítem
// -----------------------------------------------------------------------------

export const OPEN_STATUSES: ChecklistItemStatus[] = ["PENDING", "IN_PROGRESS"];

export function isOpenStatus(status: ChecklistItemStatus): boolean {
  return status === "PENDING" || status === "IN_PROGRESS";
}

export function isOverdue(item: { status: ChecklistItemStatus; dueAt: Date | null }, now: Date = new Date()): boolean {
  return isOpenStatus(item.status) && !!item.dueAt && item.dueAt.getTime() < now.getTime();
}

/** Regla: un ítem que requiere evidencia no puede marcarse DONE sin foto. */
export function evidenceBlocksDone(item: {
  requiresEvidence: boolean;
  evidenceMediaId: string | null;
}): boolean {
  return item.requiresEvidence && !item.evidenceMediaId;
}

export const EVIDENCE_REQUIRED_MESSAGE = "Esta tarea requiere una foto de evidencia antes de marcarse como hecha.";

/** Campos de completado derivados del cambio de estado. */
export function completionFields(
  status: ChecklistItemStatus,
  previous: { status: ChecklistItemStatus; completedAt: Date | null; completedById: string | null },
  actorId: string,
  now: Date = new Date(),
): { completedAt: Date | null; completedById: string | null } {
  if (status === "DONE") {
    if (previous.status === "DONE") return { completedAt: previous.completedAt ?? now, completedById: previous.completedById ?? actorId };
    return { completedAt: now, completedById: actorId };
  }
  return { completedAt: null, completedById: null };
}

// -----------------------------------------------------------------------------
// Progreso
// -----------------------------------------------------------------------------

export type Progress = { done: number; total: number; skipped: number; percent: number };

/** Progreso: hechas / (total − omitidas). Las omitidas no aplican y no restan avance. */
export function computeProgress(items: Array<{ status: ChecklistItemStatus }>): Progress {
  let done = 0;
  let skipped = 0;
  for (const i of items) {
    if (i.status === "DONE") done++;
    else if (i.status === "SKIPPED") skipped++;
  }
  const total = items.length;
  const applicable = total - skipped;
  const percent = applicable <= 0 ? (total > 0 ? 100 : 0) : Math.round((done / applicable) * 100);
  return { done, total, skipped, percent };
}

export function phaseIndex(phase: ChecklistPhase): number {
  const i = CHECKLIST_PHASE_ORDER.indexOf(phase);
  return i === -1 ? CHECKLIST_PHASE_ORDER.length : i;
}

export type PhaseGroup<T> = {
  phase: ChecklistPhase;
  progress: Progress;
  areas: Array<{ area: ChecklistArea; items: T[] }>;
};

/** Agrupa por fase (orden CHECKLIST_PHASE_ORDER) y sub-agrupa por área (orden de aparición). */
export function groupChecklist<
  T extends { phase: ChecklistPhase; area: ChecklistArea; status: ChecklistItemStatus; sortOrder: number },
>(items: T[]): PhaseGroup<T>[] {
  const groups: PhaseGroup<T>[] = [];
  for (const phase of CHECKLIST_PHASE_ORDER) {
    const inPhase = items.filter((i) => i.phase === phase).sort((a, b) => a.sortOrder - b.sortOrder);
    if (!inPhase.length) continue;
    const areas: Array<{ area: ChecklistArea; items: T[] }> = [];
    for (const item of inPhase) {
      let bucket = areas.find((a) => a.area === item.area);
      if (!bucket) {
        bucket = { area: item.area, items: [] };
        areas.push(bucket);
      }
      bucket.items.push(item);
    }
    groups.push({ phase, progress: computeProgress(inPhase), areas });
  }
  return groups;
}

/** Puede una persona STAFF editar este ítem: asignado a ella o sin asignar. */
export function staffCanEditItem(item: { assigneeId: string | null }, staffMemberId: string | null): boolean {
  if (!staffMemberId) return false;
  return item.assigneeId === null || item.assigneeId === staffMemberId;
}
