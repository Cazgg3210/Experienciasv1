import { describe, expect, it } from "vitest";
import type { ChecklistArea, ChecklistItemStatus, ChecklistPhase } from "@prisma/client";
import {
  completionFields,
  computeDueAt,
  computeProgress,
  describeOffset,
  evidenceBlocksDone,
  groupChecklist,
  isOverdue,
  offsetToParts,
  partsToOffset,
  pickAssignee,
  planChecklistItems,
  staffCanEditItem,
  type TemplateItemForInstantiation,
} from "./checklist";

const D = 24 * 60;

function ti(
  id: string,
  over: Partial<TemplateItemForInstantiation> & { phase?: TemplateItemForInstantiation["template"]["phase"]; experienceId?: string | null; active?: boolean } = {},
): TemplateItemForInstantiation {
  return {
    id,
    title: over.title ?? `Tarea ${id}`,
    description: null,
    area: over.area ?? "GENERAL",
    offsetMinutes: over.offsetMinutes ?? 0,
    defaultFunction: over.defaultFunction ?? null,
    requiresEvidence: over.requiresEvidence ?? false,
    sortOrder: over.sortOrder ?? 0,
    template: {
      phase: over.phase ?? "SETUP",
      sortOrder: 0,
      experienceId: over.experienceId ?? null,
      active: over.active ?? true,
    },
  };
}

describe("offsets de plantillas", () => {
  it("dueAt = inicio + offset (negativo = antes)", () => {
    const start = new Date("2026-10-10T17:00:00.000Z");
    expect(computeDueAt(start, -7 * D).toISOString()).toBe("2026-10-03T17:00:00.000Z");
    expect(computeDueAt(start, 90).toISOString()).toBe("2026-10-10T18:30:00.000Z");
    expect(computeDueAt(start, 0).getTime()).toBe(start.getTime());
  });

  it("convierte offset ↔ partes legibles (días, horas, minutos)", () => {
    expect(offsetToParts(-3 * D)).toEqual({ amount: 3, unit: "days", direction: "before" });
    expect(offsetToParts(-180)).toEqual({ amount: 3, unit: "hours", direction: "before" });
    expect(offsetToParts(-15)).toEqual({ amount: 15, unit: "minutes", direction: "before" });
    expect(offsetToParts(-7 * D + 60)).toEqual({ amount: 167, unit: "hours", direction: "before" });
    for (const v of [0, 15, -15, 60, -60, 2 * D, -7 * D + 120, 270, -1 * D + 300]) {
      expect(partsToOffset(offsetToParts(v))).toBe(v);
    }
  });

  it("describe el offset en español", () => {
    expect(describeOffset(0)).toBe("Al inicio del evento");
    expect(describeOffset(-D)).toBe("1 día antes del inicio");
    expect(describeOffset(-3 * D)).toBe("3 días antes del inicio");
    expect(describeOffset(120)).toBe("2 horas después del inicio");
    expect(describeOffset(-15)).toBe("15 minutos antes del inicio");
  });
});

describe("planChecklistItems", () => {
  const startsAt = new Date("2026-10-10T17:00:00.000Z");

  it("filtra plantillas inactivas y de otras experiencias; incluye generales y la propia", () => {
    const items = [
      ti("general", { experienceId: null }),
      ti("propia", { experienceId: "exp-a" }),
      ti("ajena", { experienceId: "exp-b" }),
      ti("inactiva", { active: false }),
    ];
    const plan = planChecklistItems({ startsAt, experienceId: "exp-a", templateItems: items, existingTemplateItemIds: [], assignments: [] });
    expect(plan.map((p) => p.templateItemId).sort()).toEqual(["general", "propia"]);
  });

  it("es idempotente: omite templateItems ya instanciados", () => {
    const items = [ti("a"), ti("b"), ti("c")];
    const plan = planChecklistItems({ startsAt, experienceId: null, templateItems: items, existingTemplateItemIds: ["a", "c"], assignments: [] });
    expect(plan.map((p) => p.templateItemId)).toEqual(["b"]);
  });

  it("asigna por función por defecto (prefiere confirmadas) y calcula dueAt", () => {
    const items = [ti("x", { defaultFunction: "CHEF", offsetMinutes: -D }), ti("y", { defaultFunction: "DRIVER" })];
    const plan = planChecklistItems({
      startsAt,
      experienceId: null,
      templateItems: items,
      existingTemplateItemIds: [],
      assignments: [
        { staffMemberId: "chef-1", function: "CHEF", confirmed: false },
        { staffMemberId: "chef-2", function: "CHEF", confirmed: true },
      ],
    });
    const x = plan.find((p) => p.templateItemId === "x")!;
    expect(x.assigneeId).toBe("chef-2");
    expect(x.dueAt.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(plan.find((p) => p.templateItemId === "y")!.assigneeId).toBeNull();
  });

  it("ordena por fase operativa", () => {
    const items = [ti("cierre", { phase: "CLOSING" }), ti("t7", { phase: "T_MINUS_7" }), ti("montaje", { phase: "SETUP" })];
    const plan = planChecklistItems({ startsAt, experienceId: null, templateItems: items, existingTemplateItemIds: [], assignments: [] });
    expect(plan.map((p) => p.phase)).toEqual(["T_MINUS_7", "SETUP", "CLOSING"]);
  });

  it("pickAssignee sin función devuelve null", () => {
    expect(pickAssignee(null, [{ staffMemberId: "a", function: "CHEF" }])).toBeNull();
  });
});

describe("reglas de estado", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  it("vencida sólo si está abierta y su fecha ya pasó", () => {
    const past = new Date("2026-10-04T12:00:00Z");
    expect(isOverdue({ status: "PENDING", dueAt: past }, now)).toBe(true);
    expect(isOverdue({ status: "IN_PROGRESS", dueAt: past }, now)).toBe(true);
    expect(isOverdue({ status: "DONE", dueAt: past }, now)).toBe(false);
    expect(isOverdue({ status: "SKIPPED", dueAt: past }, now)).toBe(false);
    expect(isOverdue({ status: "PENDING", dueAt: null }, now)).toBe(false);
    expect(isOverdue({ status: "PENDING", dueAt: new Date("2026-10-06T00:00:00Z") }, now)).toBe(false);
  });

  it("DONE requiere evidencia cuando la tarea la pide", () => {
    expect(evidenceBlocksDone({ requiresEvidence: true, evidenceMediaId: null })).toBe(true);
    expect(evidenceBlocksDone({ requiresEvidence: true, evidenceMediaId: "m1" })).toBe(false);
    expect(evidenceBlocksDone({ requiresEvidence: false, evidenceMediaId: null })).toBe(false);
  });

  it("DONE registra completedAt/By; otros estados lo limpian; re-guardar DONE conserva el original", () => {
    const prevOpen = { status: "PENDING" as const, completedAt: null, completedById: null };
    expect(completionFields("DONE", prevOpen, "u1", now)).toEqual({ completedAt: now, completedById: "u1" });
    const prevDone = { status: "DONE" as const, completedAt: new Date("2026-10-01T00:00:00Z"), completedById: "u0" };
    expect(completionFields("DONE", prevDone, "u1", now)).toEqual({ completedAt: prevDone.completedAt, completedById: "u0" });
    expect(completionFields("IN_PROGRESS", prevDone, "u1", now)).toEqual({ completedAt: null, completedById: null });
  });

  it("staff edita sólo tareas propias o sin asignar", () => {
    expect(staffCanEditItem({ assigneeId: null }, "s1")).toBe(true);
    expect(staffCanEditItem({ assigneeId: "s1" }, "s1")).toBe(true);
    expect(staffCanEditItem({ assigneeId: "s2" }, "s1")).toBe(false);
    expect(staffCanEditItem({ assigneeId: null }, null)).toBe(false);
  });
});

describe("progreso y agrupación", () => {
  it("hechas / (total − omitidas)", () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, skipped: 0, percent: 0 });
    expect(
      computeProgress([{ status: "DONE" }, { status: "PENDING" }, { status: "SKIPPED" }, { status: "IN_PROGRESS" }]),
    ).toEqual({ done: 1, total: 4, skipped: 1, percent: 33 });
    expect(computeProgress([{ status: "SKIPPED" }])).toMatchObject({ percent: 100 });
  });

  it("agrupa por fase en orden y sub-agrupa por área", () => {
    type Row = { id: string; phase: ChecklistPhase; area: ChecklistArea; status: ChecklistItemStatus; sortOrder: number };
    const rows: Row[] = [
      { id: "1", phase: "EVENT", area: "FOOD", status: "PENDING", sortOrder: 2 },
      { id: "2", phase: "T_MINUS_7", area: "CLIENT", status: "DONE", sortOrder: 1 },
      { id: "3", phase: "EVENT", area: "CLIENT", status: "DONE", sortOrder: 1 },
      { id: "4", phase: "EVENT", area: "FOOD", status: "DONE", sortOrder: 3 },
    ];
    const groups = groupChecklist(rows);
    expect(groups.map((g) => g.phase)).toEqual(["T_MINUS_7", "EVENT"]);
    const event = groups[1]!;
    expect(event.areas.map((a) => a.area)).toEqual(["CLIENT", "FOOD"]);
    expect(event.areas[1]!.items.map((i) => i.id)).toEqual(["1", "4"]);
    expect(event.progress).toMatchObject({ done: 2, total: 3, percent: 67 });
  });
});
