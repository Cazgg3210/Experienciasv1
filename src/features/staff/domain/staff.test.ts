import { describe, expect, it } from "vitest";
import { formatRate, formatWeekdays, generateTempPassword, initials, normalizeWeekdays, summarizeAmounts } from "./staff";
import { createAccessSchema, staffMemberSchema } from "../schemas";

describe("días disponibles", () => {
  it("normaliza (lunes primero, sin duplicados ni valores inválidos)", () => {
    expect(normalizeWeekdays([0, 6, 1, 1, 9, -1])).toEqual([1, 6, 0]);
  });
  it("formatea en español", () => {
    expect(formatWeekdays([])).toBe("Sin días registrados");
    expect(formatWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Todos los días");
    expect(formatWeekdays([5, 6, 0])).toBe("Vie, Sáb, Dom");
  });
});

describe("tarifas y totales", () => {
  it("formatea tarifa", () => {
    expect(formatRate(120_000, "PER_EVENT")).toMatch(/1,200 por evento$/);
    expect(formatRate(12_000, "PER_HOUR")).toMatch(/120 por hora$/);
  });
  it("totales pagado vs pendiente excluyen cancelados", () => {
    expect(
      summarizeAmounts([
        { amountCents: 100_00, paid: true, eventStatus: "COMPLETED" },
        { amountCents: 50_00, paid: false, eventStatus: "CONFIRMED" },
        { amountCents: 999_00, paid: false, eventStatus: "CANCELLED" },
      ]),
    ).toEqual({ total: 150_00, paid: 100_00, pending: 50_00, count: 2 });
  });
});

describe("contraseña temporal", () => {
  it("≥ 10 caracteres, con letras y números, y pasa la validación del esquema", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw.length).toBeGreaterThanOrEqual(10);
      expect(createAccessSchema.safeParse({ staffMemberId: "abc", email: "a@b.mx", password: pw }).success).toBe(true);
    }
  });
  it("rechaza contraseñas cortas o sin números", () => {
    expect(createAccessSchema.safeParse({ staffMemberId: "abc", email: "a@b.mx", password: "corta1" }).success).toBe(false);
    expect(createAccessSchema.safeParse({ staffMemberId: "abc", email: "a@b.mx", password: "solamenteletras" }).success).toBe(false);
  });
});

describe("esquema de integrante", () => {
  it("valida teléfono, correo y normaliza días", () => {
    const ok = staffMemberSchema.parse({
      name: "Alma Juárez",
      primaryFunction: "SERVER",
      phone: "55 1234 5678",
      email: "ALMA@Example.com",
      rateCents: 12_000,
      rateType: "PER_HOUR",
      availableWeekdays: [6, 0, 6],
      availabilityNotes: "",
      active: true,
    });
    expect(ok.email).toBe("alma@example.com");
    expect(ok.availableWeekdays).toEqual([0, 6]);
    expect(ok.availabilityNotes).toBeNull();
    expect(staffMemberSchema.safeParse({ ...ok, phone: "123" }).success).toBe(false);
    expect(staffMemberSchema.safeParse({ ...ok, email: "no-es-correo" }).success).toBe(false);
    expect(staffMemberSchema.safeParse({ ...ok, rateCents: -1 }).success).toBe(false);
  });
  it("iniciales", () => {
    expect(initials("Lupita Hernández López")).toBe("LH");
  });
});
