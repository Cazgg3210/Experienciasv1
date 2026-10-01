import { describe, expect, it } from "vitest";
import { changeLeadStatusSchema, createLeadSchema, logLeadActivitySchema, updateLeadSchema } from "./schemas";
import { updateCustomerSchema } from "@/features/customers/schemas";

describe("createLeadSchema", () => {
  it("valida lo mínimo y aplica MANUAL por defecto", () => {
    const r = createLeadSchema.safeParse({ name: "Sofía", phone: "55 5102 3315", occasion: "BIRTHDAY", guestCount: "8" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe("MANUAL");
      expect(r.data.guestCount).toBe(8);
    }
  });

  it("es idempotente (la salida vuelve a validar)", () => {
    const first = createLeadSchema.parse({ name: " Ana ", email: "ana@example.com", occasion: "OTHER", guestCount: "", eventDate: "2026-11-07" });
    const second = createLeadSchema.parse(first);
    expect(second).toEqual(first);
    expect(first.guestCount).toBeUndefined();
    expect(first.name).toBe("Ana");
  });

  it("exige teléfono o correo", () => {
    const r = createLeadSchema.safeParse({ name: "Ana", occasion: "BIRTHDAY" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["phone"]);
  });

  it("rechaza teléfono, correo, fecha e invitadas inválidos", () => {
    const r = createLeadSchema.safeParse({
      name: "Ana",
      phone: "123",
      email: "no-es-correo",
      occasion: "BIRTHDAY",
      eventDate: "2026-02-31",
      guestCount: "0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["phone", "email", "eventDate", "guestCount"]));
    }
  });
});

describe("updateLeadSchema", () => {
  it("requiere leadId", () => {
    expect(updateLeadSchema.safeParse({ name: "Ana", email: "a@b.mx", occasion: "BIRTHDAY" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ leadId: "abc", name: "Ana", email: "a@b.mx", occasion: "BIRTHDAY" }).success).toBe(true);
  });
});

describe("changeLeadStatusSchema", () => {
  it("LOST requiere motivo", () => {
    const r = changeLeadStatusSchema.safeParse({ leadId: "abc", toStatus: "LOST", lostReason: "  " });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["lostReason"]);
    expect(changeLeadStatusSchema.safeParse({ leadId: "abc", toStatus: "LOST", lostReason: "Presupuesto" }).success).toBe(true);
    expect(changeLeadStatusSchema.safeParse({ leadId: "abc", toStatus: "CONTACTED" }).success).toBe(true);
  });
});

describe("logLeadActivitySchema", () => {
  it("sólo tipos registrables y mensaje con contenido", () => {
    expect(logLeadActivitySchema.safeParse({ leadId: "a", type: "CALL", message: "Le marqué" }).success).toBe(true);
    expect(logLeadActivitySchema.safeParse({ leadId: "a", type: "STATUS_CHANGE", message: "x x" }).success).toBe(false);
    expect(logLeadActivitySchema.safeParse({ leadId: "a", type: "NOTE", message: " " }).success).toBe(false);
  });
});

describe("updateCustomerSchema", () => {
  it("valida correo y teléfonos opcionales", () => {
    const base = { customerId: "c1", name: "Ana", marketingOptIn: false };
    expect(updateCustomerSchema.safeParse({ ...base, email: "", phone: "", whatsapp: "" }).success).toBe(true);
    expect(updateCustomerSchema.safeParse({ ...base, email: "malo" }).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ ...base, whatsapp: "12" }).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ ...base, instagram: "@sofi.brunch" }).success).toBe(true);
  });
});
