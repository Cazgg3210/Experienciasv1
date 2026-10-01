import { describe, expect, it } from "vitest";
import {
  assignmentFormSchema,
  createAssignmentSchema,
  createChecklistItemSchema,
  logisticsSchema,
  staffChecklistUpdateSchema,
  templateItemSchema,
  templateSchema,
  updateChecklistItemSchema,
} from "./schemas";

describe("esquemas de operaciones", () => {
  it("asignación: la salida debe ser posterior a la entrada y el integrante es obligatorio", () => {
    const base = { staffMemberId: "abc123", function: "SERVER", startsAt: "2026-10-10T10:00", endsAt: "2026-10-10T15:00" };
    expect(assignmentFormSchema.safeParse(base).success).toBe(true);
    const inverted = assignmentFormSchema.safeParse({ ...base, endsAt: "2026-10-10T09:00" });
    expect(inverted.success).toBe(false);
    expect(inverted.error!.issues[0]!.path).toEqual(["endsAt"]);
    const noStaff = assignmentFormSchema.safeParse({ ...base, staffMemberId: "" });
    expect(noStaff.error!.issues[0]!.message).toBe("Elige a alguien del equipo.");
    expect(createAssignmentSchema.safeParse({ ...base, eventId: "ev1", amountCents: -5 }).success).toBe(false);
    expect(createAssignmentSchema.parse({ ...base, eventId: "ev1" })).toMatchObject({ confirmed: false, paid: false, notes: null });
  });

  it("logística: vacío → null; montaje no puede ser antes de la salida", () => {
    expect(logisticsSchema.parse({ eventId: "e1", departureAt: "", setupStartsAt: "", teardownAt: "" })).toEqual({
      eventId: "e1",
      departureAt: null,
      setupStartsAt: null,
      teardownAt: null,
    });
    const bad = logisticsSchema.safeParse({ eventId: "e1", departureAt: "2026-10-10T09:00", setupStartsAt: "2026-10-10T08:00" });
    expect(bad.success).toBe(false);
  });

  it("tarea personalizada: título mínimo y campos opcionales normalizados", () => {
    expect(createChecklistItemSchema.safeParse({ eventId: "e1", phase: "SETUP", area: "TABLE", title: "ab" }).success).toBe(false);
    expect(
      createChecklistItemSchema.parse({ eventId: "e1", phase: "SETUP", area: "TABLE", title: "Recoger globos", assigneeId: "", dueAt: "" }),
    ).toMatchObject({ assigneeId: null, dueAt: null, requiresEvidence: false, description: null });
  });

  it("actualización de tarea: rechaza ids con caracteres raros y estados inválidos", () => {
    expect(updateChecklistItemSchema.safeParse({ id: "../etc" }).success).toBe(false);
    expect(updateChecklistItemSchema.safeParse({ id: "abc", status: "LISTO" }).success).toBe(false);
    expect(staffChecklistUpdateSchema.safeParse({ id: "abc", status: "DONE", evidenceMediaId: null }).success).toBe(true);
  });

  it("actualización de tarea: notas ausentes NO se convierten en null (no borra notas al cambiar estado)", () => {
    // Las Server Actions validan y luego el servicio vuelve a validar: el resultado debe conservar
    // "sin cambios" (undefined) en ambos pasos.
    for (const schema of [updateChecklistItemSchema, staffChecklistUpdateSchema]) {
      const once = schema.parse({ id: "abc", status: "DONE" });
      expect(once.notes).toBeUndefined();
      expect(schema.parse(once).notes).toBeUndefined();
      expect(schema.parse({ id: "abc", notes: "" }).notes).toBeNull();
      expect(schema.parse({ id: "abc", notes: null }).notes).toBeNull();
      expect(schema.parse({ id: "abc", notes: "  Falta hielo  " }).notes).toBe("Falta hielo");
      expect(schema.safeParse({ id: "abc", notes: "x".repeat(2001) }).success).toBe(false);
    }
  });

  it("plantillas: nombre y orden con mensajes en español", () => {
    expect(templateSchema.parse({ name: "T-3 · Saldo", phase: "T_MINUS_3", experienceId: "" })).toMatchObject({
      experienceId: null,
      active: true,
      sortOrder: 0,
    });
    const nan = templateSchema.safeParse({ name: "T-3 · Saldo", phase: "T_MINUS_3", sortOrder: Number.NaN });
    expect(nan.error!.issues[0]!.message).toBe("Indica un número.");
    const item = templateItemSchema.parse({
      title: "Confirmar menú",
      area: "FOOD",
      offsetAmount: 3,
      offsetUnit: "days",
      offsetDirection: "before",
      defaultFunction: "",
    });
    expect(item.defaultFunction).toBeNull();
    expect(templateItemSchema.safeParse({ ...item, offsetAmount: 1.5 }).success).toBe(false);
  });
});
