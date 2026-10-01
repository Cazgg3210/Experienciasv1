import { describe, expect, it } from "vitest";
import { createPurchaseSchema, purchaseFiltersSchema, receivePurchaseSchema } from "./schemas";
import { vendorBaseSchema, vendorFiltersSchema } from "@/features/vendors/schemas";
import { createInventoryItemSchema, inventoryFiltersSchema, stockAdjustmentSchema } from "@/features/inventory/schemas";

describe("esquemas de compras", () => {
  it("normaliza opcionales y valida montos/fechas", () => {
    const ok = createPurchaseSchema.parse({
      eventId: "none",
      vendorId: "",
      concept: "  Rosas blush  ",
      category: "FLOWERS",
      expectedAmountCents: 150_000,
      neededBy: "",
      notes: "",
    });
    expect(ok).toEqual({
      eventId: null,
      vendorId: null,
      concept: "Rosas blush",
      category: "FLOWERS",
      expectedAmountCents: 150_000,
      neededBy: null,
      notes: null,
    });
    const bad = createPurchaseSchema.safeParse({
      concept: "x",
      category: "NOPE",
      expectedAmountCents: 10.5,
      neededBy: "2026-02-30",
    });
    expect(bad.success).toBe(false);
    const fields = bad.success ? [] : bad.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["concept", "category", "expectedAmountCents", "neededBy"]));
  });

  it("recibir exige monto real", () => {
    expect(receivePurchaseSchema.safeParse({ id: "p1" }).success).toBe(false);
    expect(receivePurchaseSchema.parse({ id: "p1", actualAmountCents: 0 })).toEqual({
      id: "p1",
      actualAmountCents: 0,
      receiptMediaId: null,
    });
  });

  it("filtros ignoran valores inválidos", () => {
    expect(purchaseFiltersSchema.parse({ status: "NOPE", from: "ayer", to: "2026-10-31", category: "FOOD" })).toEqual({
      q: undefined,
      status: undefined,
      category: "FOOD",
      event: undefined,
      vendor: undefined,
      from: undefined,
      to: "2026-10-31",
    });
  });
});

describe("esquemas de proveedores", () => {
  const base = { name: "Florería Luz", category: "FLOWERS", status: "ACTIVE" } as const;
  it("valida teléfono, email y calificación", () => {
    expect(vendorBaseSchema.parse({ ...base, email: "Pedidos@Flor.MX", phone: "55 1234 5678", rating: 5 })).toMatchObject({
      email: "pedidos@flor.mx",
      phone: "55 1234 5678",
      whatsapp: null,
      rating: 5,
    });
    expect(vendorBaseSchema.safeParse({ ...base, email: "no-es-correo" }).success).toBe(false);
    expect(vendorBaseSchema.safeParse({ ...base, phone: "12-34" }).success).toBe(false);
    expect(vendorBaseSchema.safeParse({ ...base, rating: 6 }).success).toBe(false);
    expect(vendorBaseSchema.parse({ ...base, rating: null }).rating).toBeNull();
  });
  it("el WhatsApp debe permitir armar el enlace wa.me (10+ dígitos)", () => {
    expect(vendorBaseSchema.parse({ ...base, whatsapp: "55 1234 5678" }).whatsapp).toBe("55 1234 5678");
    expect(vendorBaseSchema.parse({ ...base, whatsapp: "+52 1 55 1234 5678" }).whatsapp).toBe("+52 1 55 1234 5678");
    const short = vendorBaseSchema.safeParse({ ...base, whatsapp: "5512 3456" });
    expect(short.success).toBe(false);
    expect(short.error?.issues.map((i) => i.path.join("."))).toEqual(["whatsapp"]);
    // Un teléfono de 8 dígitos sigue siendo válido como teléfono fijo.
    expect(vendorBaseSchema.safeParse({ ...base, phone: "5512 3456" }).success).toBe(true);
  });
  it("filtros", () => {
    expect(vendorFiltersSchema.parse({ status: "BLOCKED", category: "x" })).toEqual({
      q: undefined,
      status: "BLOCKED",
      category: undefined,
    });
  });
});

describe("esquemas de inventario", () => {
  it("normaliza el SKU y exige enteros no negativos", () => {
    const item = createInventoryItemSchema.parse({
      sku: " cop-cha-02 ",
      name: "Copa",
      category: "GLASSWARE",
      unit: "pz",
      totalQuantity: 12,
      lowStockThreshold: 3,
      replacementCostCents: 9_000,
      location: "",
      active: true,
    });
    expect(item.sku).toBe("COP-CHA-02");
    expect(item.location).toBeNull();
    expect(
      createInventoryItemSchema.safeParse({ ...item, sku: "con espacio", totalQuantity: -1 }).success,
    ).toBe(false);
  });
  it("ajustes requieren motivo y cantidad positiva", () => {
    expect(stockAdjustmentSchema.safeParse({ itemId: "i", type: "LOSS", quantity: 0, reason: "rota" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ itemId: "i", type: "LOSS", quantity: 1, reason: "" }).success).toBe(false);
    expect(stockAdjustmentSchema.parse({ itemId: "i", type: "ADJUSTMENT", quantity: 2, reason: "conteo" }).direction).toBe("IN");
  });
  it("filtros", () => {
    expect(inventoryFiltersSchema.parse({ category: "LINENS", conflict: "1", inactive: "si" })).toEqual({
      q: undefined,
      category: "LINENS",
      conflict: "1",
      inactive: undefined,
    });
  });
});
