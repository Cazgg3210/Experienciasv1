import { describe, expect, it } from "vitest";
import {
  canDeleteCustomer,
  customerDeletionBlockers,
  latestActivity,
  normalizeEmail,
  normalizeInstagram,
  normalizeOptional,
  totalPaidByCustomer,
} from "./customer-rules";

describe("customerDeletionBlockers", () => {
  it("permite eliminar sin relaciones comerciales", () => {
    expect(customerDeletionBlockers({ quotes: 0, bookings: 0, events: 0 })).toEqual([]);
    expect(canDeleteCustomer({ quotes: 0, bookings: 0, events: 0 })).toBe(true);
  });

  it("explica por qué está bloqueada (singular/plural)", () => {
    expect(customerDeletionBlockers({ quotes: 1, bookings: 2, events: 1 })).toEqual([
      "Tiene 1 cotización.",
      "Tiene 2 reservas con historial de pagos.",
      "Tiene 1 evento.",
    ]);
    expect(canDeleteCustomer({ quotes: 0, bookings: 0, events: 3 })).toBe(false);
  });
});

describe("totalPaidByCustomer", () => {
  it("suma pagos cobrados netos de reembolsos y no cuenta registros REFUND", () => {
    const totals = totalPaidByCustomer([
      { customerId: "a", kind: "DEPOSIT", status: "PAID", amountCents: 500_00, refundedCents: 0 },
      { customerId: "a", kind: "BALANCE", status: "PARTIAL_REFUND", amountCents: 500_00, refundedCents: 100_00 },
      { customerId: "a", kind: "REFUND", status: "PAID", amountCents: 100_00, refundedCents: 0 },
      { customerId: "a", kind: "FULL", status: "PENDING", amountCents: 999_00, refundedCents: 0 },
      { customerId: "b", kind: "FULL", status: "REFUNDED", amountCents: 300_00, refundedCents: 300_00 },
      { customerId: "c", kind: "FULL", status: "FAILED", amountCents: 300_00, refundedCents: 0 },
    ]);
    expect(totals.get("a")).toBe(900_00);
    expect(totals.get("b")).toBe(0);
    expect(totals.get("c")).toBe(0);
    expect(totals.get("z")).toBeUndefined();
  });
});

describe("latestActivity", () => {
  it("toma la fecha más reciente ignorando vacíos", () => {
    const a = new Date("2026-09-01");
    const b = new Date("2026-10-01");
    expect(latestActivity([a, null, undefined, b, new Date("invalid")])).toEqual(b);
    expect(latestActivity([])).toBeNull();
  });
});

describe("normalización", () => {
  it("email en minúsculas y vacíos a null", () => {
    expect(normalizeEmail("  Sofi@Example.COM ")).toBe("sofi@example.com");
    expect(normalizeEmail("  ")).toBeNull();
    expect(normalizeOptional(" hola ")).toBe("hola");
    expect(normalizeOptional("")).toBeNull();
  });

  it("instagram sin @ ni URL", () => {
    expect(normalizeInstagram("@sofi.brunch")).toBe("sofi.brunch");
    expect(normalizeInstagram("https://www.instagram.com/sofi.brunch/?hl=es")).toBe("sofi.brunch");
    expect(normalizeInstagram("instagram.com/ana_r")).toBe("ana_r");
    expect(normalizeInstagram("")).toBeNull();
  });
});
