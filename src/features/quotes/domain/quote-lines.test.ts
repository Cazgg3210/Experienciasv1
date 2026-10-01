import { describe, expect, it } from "vitest";
import { calculateFromLines } from "./quote-engine";
import {
  adjustLinesForGuestCount,
  billableGuests,
  costBreakdownFor,
  countdown,
  defaultQuoteTitle,
  detectPriceChanges,
  discountChanged,
  firstName,
  isExpiringSoon,
  isTaxIncluded,
  marginLevel,
  normalizeDiscount,
  perGuestUnits,
  quoteShareMessage,
  randomSlugSuffix,
  splitBaseExperienceCost,
  toEngineDiscount,
  toEngineLines,
  validityLabel,
  type StoredLine,
} from "./quote-lines";

const settings = {
  taxRateBps: 1600,
  pricesIncludeTax: true,
  depositBps: 5000,
  paymentFeeBps: 360,
  paymentFeeFixedCents: 300,
  minMarginBps: 3500,
  maxStandardGuests: 12,
};

const base: StoredLine = {
  id: "base",
  type: "BASE_EXPERIENCE",
  refId: "exp1",
  description: "Signature Brunch (incluye 6 personas)",
  quantity: 1,
  unitPriceCents: 1_200_000,
  unitCostCents: 400_000,
  costCategory: "FOOD",
};

describe("normalizeDiscount / discountChanged", () => {
  it("convierte NONE o valor 0 en sin descuento", () => {
    expect(normalizeDiscount({ type: "NONE", value: 500 })).toEqual({ type: null, value: null, reason: null });
    expect(normalizeDiscount({ type: "PERCENT", value: 0, reason: "x" })).toEqual({ type: null, value: null, reason: null });
  });
  it("limita porcentaje a 100% y recorta motivo", () => {
    expect(normalizeDiscount({ type: "PERCENT", value: 12_000, reason: "  promo  " })).toEqual({
      type: "PERCENT",
      value: 10_000,
      reason: "promo",
    });
  });
  it("detecta cambios de tipo, valor o motivo", () => {
    const a = normalizeDiscount({ type: "AMOUNT", value: 50_000, reason: "Clienta frecuente" });
    expect(discountChanged(a, { ...a })).toBe(false);
    expect(discountChanged(a, { ...a, value: 60_000 })).toBe(true);
    expect(discountChanged(a, { ...a, reason: "Otro" })).toBe(true);
    expect(discountChanged(a, normalizeDiscount({ type: "NONE", value: 0 }))).toBe(true);
  });
  it("traduce al formato del motor", () => {
    expect(toEngineDiscount({ type: null, value: null, reason: null })).toBeNull();
    expect(toEngineDiscount({ type: "PERCENT", value: 1000, reason: null })).toEqual({ type: "PERCENT", value: 1000, reason: undefined });
  });
});

describe("detectPriceChanges", () => {
  it("ignora conceptos personalizados y precios iguales", () => {
    const changes = detectPriceChanges([
      { type: "ADDON", refId: "a1", description: "Karaoke", unitPriceCents: 150_000, referencePriceCents: 150_000 },
      { type: "CUSTOM", refId: null, description: "Piñata", unitPriceCents: 90_000, referencePriceCents: null },
      { type: "BASE_EXPERIENCE", refId: "e1", description: "Base", unitPriceCents: 1_100_000, referencePriceCents: 1_200_000 },
    ]);
    expect(changes).toEqual([
      { type: "BASE_EXPERIENCE", refId: "e1", description: "Base", fromCents: 1_200_000, toCents: 1_100_000 },
    ]);
  });
});

describe("adjustLinesForGuestCount", () => {
  const lines: StoredLine[] = [
    base,
    { id: "x", type: "EXTRA_GUEST", refId: "exp1", description: "Invitada adicional (2)", quantity: 2, unitPriceCents: 150_000, unitCostCents: 50_000, costCategory: "FOOD" },
    { id: "m", type: "MENU", refId: "menu1", description: "Menú: Clásico (incluido)", quantity: 1, unitPriceCents: 0, unitCostCents: 8 * 20_000, costCategory: "FOOD" },
    { id: "p", type: "ADDON", refId: "mimosa", description: "Mimosa bar (por persona)", quantity: 8, unitPriceCents: 25_000, unitCostCents: 9_000, costCategory: "FOOD" },
    { id: "f", type: "ADDON", refId: "karaoke", description: "Karaoke", quantity: 1, unitPriceCents: 150_000, unitCostCents: 60_000, costCategory: "VENDOR" },
    { id: "c", type: "CUSTOM", refId: null, description: "Letrero", quantity: 1, unitPriceCents: 45_000, unitCostCents: 20_000, costCategory: "VENDOR" },
  ];
  const opts = {
    oldGuestCount: 8,
    baseGuests: 6,
    extraGuest: { unitPriceCents: 160_000, unitCostCents: 55_000, refId: "exp1" },
    menuPerGuest: false,
    perGuestAddOnIds: new Set(["mimosa"]),
  };

  it("escala invitadas adicionales, menú incluido y add-ons por persona conservando precios", () => {
    const out = adjustLinesForGuestCount(lines, { ...opts, newGuestCount: 10 });
    const by = (id: string) => out.find((l) => l.id === id)!;
    expect(by("x").quantity).toBe(4);
    expect(by("x").unitPriceCents).toBe(150_000); // conserva precio (override incluido)
    expect(by("x").description).toBe("Invitada adicional (4)");
    expect(by("m").quantity).toBe(1);
    expect(by("m").unitCostCents).toBe(10 * 20_000);
    expect(by("p").quantity).toBe(10);
    expect(by("f").quantity).toBe(1);
    expect(by("c")).toEqual(lines[5]);
    expect(by("base")).toEqual(base);
  });

  it("elimina la línea de invitadas adicionales si ya no aplica", () => {
    const out = adjustLinesForGuestCount(lines, { ...opts, newGuestCount: 5 });
    expect(out.some((l) => l.type === "EXTRA_GUEST")).toBe(false);
    // billable mínimo = invitadas base
    expect(out.find((l) => l.id === "p")!.quantity).toBe(6);
  });

  it("crea la línea de invitadas adicionales después de la base cuando hace falta", () => {
    const noExtra = lines.filter((l) => l.type !== "EXTRA_GUEST");
    const out = adjustLinesForGuestCount(noExtra, { ...opts, oldGuestCount: 6, newGuestCount: 9 });
    expect(out[1]!.type).toBe("EXTRA_GUEST");
    expect(out[1]!.quantity).toBe(3);
    expect(out[1]!.unitPriceCents).toBe(160_000);
    expect(out[1]!.id).toBeNull();
  });

  it("menú por persona ajusta cantidad", () => {
    const perGuestMenu: StoredLine[] = [
      base,
      { id: "m", type: "MENU", refId: "menu2", description: "Menú: Premium", quantity: 6, unitPriceCents: 30_000, unitCostCents: 18_000, costCategory: "FOOD" },
    ];
    const out = adjustLinesForGuestCount(perGuestMenu, { ...opts, oldGuestCount: 6, newGuestCount: 11, menuPerGuest: true });
    expect(out.find((l) => l.id === "m")!.quantity).toBe(11);
  });

  it("los totales recalculados con el motor reflejan el ajuste", () => {
    const out = adjustLinesForGuestCount(lines, { ...opts, newGuestCount: 10 });
    const r = calculateFromLines({ lines: toEngineLines(out), settings, guestCount: 10 });
    const expectedSubtotal = 1_200_000 + 4 * 150_000 + 0 + 10 * 25_000 + 150_000 + 45_000;
    expect(r.subtotalCents).toBe(expectedSubtotal);
    expect(r.totalCents).toBe(expectedSubtotal);
    expect(r.depositCents).toBe(Math.round(expectedSubtotal / 2));
  });
});

describe("invitadas facturables", () => {
  it("usa mínimo las invitadas base", () => {
    expect(billableGuests(4, 6)).toBe(6);
    expect(billableGuests(9, 6)).toBe(9);
  });
  it("calcula unidades por persona", () => {
    expect(perGuestUnits(16, 8)).toBe(2);
    expect(perGuestUnits(3, 0)).toBe(3);
    expect(perGuestUnits(1, 8)).toBe(1);
  });
});

describe("margen y vigencia", () => {
  it("clasifica el margen", () => {
    expect(marginLevel(4000, 100, 3500)).toBe("ok");
    expect(marginLevel(2000, 100, 3500)).toBe("low");
    expect(marginLevel(-500, -100, 3500)).toBe("negative");
  });
  it("detecta vigencias por vencer en 48 h", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(isExpiringSoon(new Date("2026-10-02T12:00:00Z"), now)).toBe(true);
    expect(isExpiringSoon(new Date("2026-10-05T12:00:00Z"), now)).toBe(false);
    expect(isExpiringSoon(new Date("2026-09-30T12:00:00Z"), now)).toBe(false);
    expect(isExpiringSoon(null, now)).toBe(false);
  });
  it("cuenta regresiva y etiqueta", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(countdown(new Date("2026-10-03T15:30:00Z"), now)).toMatchObject({ expired: false, days: 2, hours: 3, minutes: 30 });
    expect(countdown(new Date("2026-09-30T00:00:00Z"), now).expired).toBe(true);
    expect(validityLabel(new Date("2026-10-03T15:30:00Z"), now)).toBe("Vence en 2 días");
    expect(validityLabel(new Date("2026-10-02T11:00:00Z"), now)).toBe("Vence en 23 h");
    expect(validityLabel(new Date("2026-10-01T12:10:00Z"), now)).toBe("Vence en 10 min");
    expect(validityLabel(new Date("2026-09-01T12:00:00Z"), now)).toBe("Venció");
    expect(validityLabel(null, now)).toBe("Sin vigencia");
  });
});

describe("textos", () => {
  it("título por defecto con primer nombre", () => {
    expect(defaultQuoteTitle("Cumpleaños", "Sofía Martínez")).toBe("Cumpleaños de Sofía");
    expect(defaultQuoteTitle("Reunión", "")).toBe("Reunión");
    expect(firstName("  Ana   Paula ")).toBe("Ana");
  });
  it("sufijo de slug con alfabeto seguro", () => {
    const s = randomSlugSuffix();
    expect(s).toMatch(/^[a-z2-9]{4}$/);
    expect(randomSlugSuffix(() => 0)).toBe("aaaa");
  });
  it("mensaje de WhatsApp incluye link y vigencia", () => {
    const msg = quoteShareMessage({ customerName: "Lucía Herrera", title: "Cumpleaños de Lucía", url: "https://x.test/cotizacion/abc", validUntil: "8 oct 2026" });
    expect(msg).toContain("Hola Lucía");
    expect(msg).toContain("https://x.test/cotizacion/abc");
    expect(msg).toContain("8 oct 2026");
  });
});

describe("costBreakdownFor", () => {
  const items = [
    { costCategory: "FOOD" as const, totalCostCents: 100_000 },
    { costCategory: "VENDOR" as const, totalCostCents: 50_000 },
  ];
  it("usa el snapshot si coincide con los totales guardados", () => {
    const snapshot = {
      totalCents: 500_000,
      estimatedCostCents: 170_000,
      costBreakdown: { FOOD: 60_000, FLOWERS: 40_000, STAFF: 0, TRANSPORT: 0, VENDOR: 50_000, CONSUMABLES: 0, PAYMENT_FEE: 20_000, OTHER: 0 },
    };
    expect(costBreakdownFor(snapshot, { totalCents: 500_000, estimatedCostCents: 170_000 }, items).FLOWERS).toBe(40_000);
  });
  it("deriva de las líneas cuando el snapshot no coincide", () => {
    const b = costBreakdownFor({ totalCents: 1 }, { totalCents: 500_000, estimatedCostCents: 170_000 }, items);
    expect(b.FOOD).toBe(100_000);
    expect(b.VENDOR).toBe(50_000);
    expect(b.PAYMENT_FEE).toBe(20_000);
  });
});

describe("isTaxIncluded", () => {
  const lines = toEngineLines([base]);
  it("precios con IVA: el total es subtotal − descuento", () => {
    const r = calculateFromLines({ lines, settings, guestCount: 6, discount: { type: "PERCENT", value: 1000 } });
    expect(isTaxIncluded(r)).toBe(true);
    expect(r.taxCents).toBeGreaterThan(0);
  });
  it("precios más IVA: el IVA se suma al total", () => {
    const r = calculateFromLines({ lines, settings: { ...settings, pricesIncludeTax: false }, guestCount: 6 });
    expect(r.totalCents).toBe(r.subtotalCents + r.taxCents);
    expect(isTaxIncluded(r)).toBe(false);
  });
});

describe("splitBaseExperienceCost", () => {
  const empty = { FOOD: 0, FLOWERS: 0, STAFF: 0, TRANSPORT: 0, VENDOR: 0, CONSUMABLES: 0, PAYMENT_FEE: 0, OTHER: 0 };
  const components = [
    { category: "STAFF" as const, amountCents: 200_000, perGuest: false },
    { category: "FLOWERS" as const, amountCents: 150_000, perGuest: false },
    { category: "FOOD" as const, amountCents: 10_000, perGuest: true },
  ];
  it("reparte el costo de la línea base por componente sin cambiar el total", () => {
    // 200,000 + 150,000 + 6 × 10,000 = 410,000 asignados por el motor de líneas a STAFF (dominante)
    const breakdown = { ...empty, STAFF: 410_000, FOOD: 50_000, PAYMENT_FEE: 9_000 };
    const out = splitBaseExperienceCost(breakdown, [{ costCategory: "STAFF", totalCostCents: 410_000 }], components, 6);
    expect(out.STAFF).toBe(200_000);
    expect(out.FLOWERS).toBe(150_000);
    expect(out.FOOD).toBe(50_000 + 60_000);
    expect(out.PAYMENT_FEE).toBe(9_000);
    const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);
    expect(sum(out)).toBe(sum(breakdown));
  });
  it("si el costo de la línea cambió, reparte proporcionalmente y asigna el redondeo", () => {
    const breakdown = { ...empty, STAFF: 100_001 };
    const out = splitBaseExperienceCost(breakdown, [{ costCategory: "STAFF", totalCostCents: 100_001 }], components, 6);
    expect(out.STAFF + out.FLOWERS + out.FOOD).toBe(100_001);
    expect(out.FLOWERS).toBeGreaterThan(0);
  });
  it("sin componentes deja el desglose igual", () => {
    const breakdown = { ...empty, STAFF: 5_000 };
    expect(splitBaseExperienceCost(breakdown, [{ costCategory: "STAFF", totalCostCents: 5_000 }], [], 6)).toEqual(breakdown);
  });
});
