import { describe, expect, it } from "vitest";
import {
  acceptQuoteSchema,
  createQuoteSchema,
  discountInputSchema,
  quoteDetailsSchema,
  quoteListFiltersSchema,
  quotePricingSchema,
  rejectQuoteSchema,
} from "./schemas";

const base = {
  experienceId: "exp_1",
  guestCount: 8,
  addOns: [],
  depositBps: 5000,
  occasion: "BIRTHDAY" as const,
};

describe("createQuoteSchema", () => {
  it("clienta existente requiere customerId", () => {
    const r = createQuoteSchema.safeParse({ ...base, customerMode: "existing", customerId: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["customerId"]);
    expect(createQuoteSchema.safeParse({ ...base, customerMode: "existing", customerId: "c1" }).success).toBe(true);
  });

  it("clienta nueva valida nombre y al menos un contacto, sin afectar el modo existente", () => {
    const missing = createQuoteSchema.safeParse({ ...base, customerMode: "new", newCustomer: { name: "Ana" } });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.some((i) => i.path.join(".") === "newCustomer.email")).toBe(true);
    const ok = createQuoteSchema.safeParse({
      ...base,
      customerMode: "new",
      newCustomer: { name: "Ana López", email: "ana@example.test", phone: "" },
    });
    expect(ok.success).toBe(true);
    // Datos a medias de "clienta nueva" no bloquean si se eligió una existente
    const existing = createQuoteSchema.safeParse({
      ...base,
      customerMode: "existing",
      customerId: "c1",
      newCustomer: { name: "", email: "x" },
    });
    expect(existing.success).toBe(true);
  });

  it("valida fecha, hora e invitadas", () => {
    expect(createQuoteSchema.safeParse({ ...base, customerMode: "existing", customerId: "c1", eventDate: "2026-13-40x" }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...base, customerMode: "existing", customerId: "c1", startTime: "25:00" }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...base, customerMode: "existing", customerId: "c1", guestCount: 0 }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...base, customerMode: "existing", customerId: "c1", eventDate: "", startTime: "" }).success).toBe(true);
  });
});

describe("descuento y editor", () => {
  it("exige motivo cuando hay descuento y limita porcentaje a 100%", () => {
    expect(discountInputSchema.safeParse({ type: "PERCENT", value: 1000 }).success).toBe(false);
    expect(discountInputSchema.safeParse({ type: "PERCENT", value: 1000, reason: "Promo" }).success).toBe(true);
    expect(discountInputSchema.safeParse({ type: "PERCENT", value: 10_001, reason: "x" }).success).toBe(false);
    expect(discountInputSchema.safeParse({ type: "NONE", value: 0 }).success).toBe(true);
    expect(discountInputSchema.safeParse({ type: "AMOUNT", value: -5, reason: "x" }).success).toBe(false);
  });

  it("rechaza líneas con cantidades o precios inválidos", () => {
    const line = {
      itemId: null,
      type: "CUSTOM",
      refId: null,
      description: "Letrero",
      quantity: 1,
      unitPriceCents: 45_000,
      unitCostCents: 20_000,
      costCategory: "VENDOR",
    };
    const input = { quoteId: "q1", lines: [line], discount: { type: "NONE", value: 0 }, depositBps: 5000 };
    expect(quotePricingSchema.safeParse(input).success).toBe(true);
    expect(quotePricingSchema.safeParse({ ...input, lines: [{ ...line, quantity: 0 }] }).success).toBe(false);
    expect(quotePricingSchema.safeParse({ ...input, lines: [{ ...line, unitPriceCents: 10.5 }] }).success).toBe(false);
    expect(quotePricingSchema.safeParse({ ...input, lines: [] }).success).toBe(false);
    expect(quotePricingSchema.safeParse({ ...input, depositBps: 12_000 }).success).toBe(false);
  });

  it("datos generales: título mínimo", () => {
    expect(quoteDetailsSchema.safeParse({ quoteId: "q1", title: "ab", guestCount: 8 }).success).toBe(false);
    expect(quoteDetailsSchema.safeParse({ quoteId: "q1", title: "Cumple", guestCount: 8, validUntil: "" }).success).toBe(true);
  });
});

describe("acciones públicas", () => {
  const token = "demo-quote-lucia-2026-4fq8m2zp";
  it("aceptar requiere nombre y apellido y aceptar términos", () => {
    expect(acceptQuoteSchema.safeParse({ token, fullName: "Lucía Herrera", acceptTerms: true }).success).toBe(true);
    expect(acceptQuoteSchema.safeParse({ token, fullName: "Lucía", acceptTerms: true }).success).toBe(false);
    expect(acceptQuoteSchema.safeParse({ token, fullName: "Lucía Herrera", acceptTerms: false }).success).toBe(false);
    expect(acceptQuoteSchema.safeParse({ token: "corto", fullName: "Lucía Herrera", acceptTerms: true }).success).toBe(false);
    // versión mostrada (opcional, entera positiva)
    expect(acceptQuoteSchema.safeParse({ token, fullName: "Lucía Herrera", acceptTerms: true, version: 2 }).success).toBe(true);
    expect(acceptQuoteSchema.safeParse({ token, fullName: "Lucía Herrera", acceptTerms: true, version: 0 }).success).toBe(false);
    expect(acceptQuoteSchema.safeParse({ token, fullName: "Lucía Herrera", acceptTerms: true, version: 1.5 }).success).toBe(false);
  });
  it("rechazar: motivo opcional con límite", () => {
    expect(rejectQuoteSchema.safeParse({ token }).success).toBe(true);
    expect(rejectQuoteSchema.safeParse({ token, reason: "x".repeat(501) }).success).toBe(false);
  });
});

describe("filtros del listado", () => {
  it("ignora valores inválidos en lugar de fallar", () => {
    expect(quoteListFiltersSchema.parse({ status: "HACKED", page: "-3", expiring: "yes" })).toEqual({
      status: undefined,
      page: 1,
      expiring: undefined,
      q: undefined,
    });
    expect(quoteListFiltersSchema.parse({ status: "SENT", page: "2", expiring: "1", q: " Lucía " })).toEqual({
      status: "SENT",
      page: 2,
      expiring: "1",
      q: "Lucía",
    });
  });
});
