/**
 * Lógica pura del editor de cotizaciones (sin I/O). Complementa al QuoteEngine:
 *  - normaliza líneas editadas por el admin y detecta cambios sensibles (precio / descuento)
 *  - ajusta conceptos dependientes de invitadas cuando cambia el número de invitadas
 *  - utilidades de vigencia, margen y título por defecto
 */
import type { CostCategory, EngineDiscount, QuoteLine, QuoteLineType } from "./quote-engine";

export type StoredLine = {
  id?: string | null;
  type: QuoteLineType;
  refId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  costCategory: CostCategory;
};

/** Línea en el formato que espera `calculateFromLines`. */
export type EngineLineInput = Omit<QuoteLine, "totalPriceCents" | "totalCostCents"> & { totalCostCents?: number };

export function toEngineLines(lines: StoredLine[]): EngineLineInput[] {
  return lines.map((l) => ({
    type: l.type,
    refId: l.refId,
    description: l.description,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    unitCostCents: l.unitCostCents,
    costCategory: l.costCategory,
  }));
}

// -----------------------------------------------------------------------------
// Descuentos
// -----------------------------------------------------------------------------
export type DiscountState = {
  type: "PERCENT" | "AMOUNT" | null;
  value: number | null;
  reason: string | null;
};

export function normalizeDiscount(input: {
  type: "NONE" | "PERCENT" | "AMOUNT" | null | undefined;
  value: number | null | undefined;
  reason?: string | null;
}): DiscountState {
  if (!input.type || input.type === "NONE" || !input.value || input.value <= 0) {
    return { type: null, value: null, reason: null };
  }
  const value = input.type === "PERCENT" ? Math.min(Math.round(input.value), 10_000) : Math.round(input.value);
  return { type: input.type, value, reason: input.reason?.trim() || null };
}

export function discountChanged(before: DiscountState, after: DiscountState): boolean {
  return (
    (before.type ?? null) !== (after.type ?? null) ||
    (before.value ?? null) !== (after.value ?? null) ||
    (before.reason ?? null) !== (after.reason ?? null)
  );
}

export function toEngineDiscount(d: DiscountState): EngineDiscount | null {
  if (!d.type || !d.value) return null;
  return { type: d.type, value: d.value, reason: d.reason ?? undefined };
}

// -----------------------------------------------------------------------------
// Overrides de precio
// -----------------------------------------------------------------------------
export type PriceChange = {
  type: QuoteLineType;
  refId: string | null;
  description: string;
  fromCents: number;
  toCents: number;
};

/**
 * Detecta cambios de precio unitario respecto a la referencia (precio guardado o de catálogo).
 * Los conceptos personalizados (CUSTOM) son libres: no cuentan como override.
 */
export function detectPriceChanges(
  lines: Array<{ type: QuoteLineType; refId: string | null; description: string; unitPriceCents: number; referencePriceCents: number | null }>,
): PriceChange[] {
  return lines
    .filter((l) => l.type !== "CUSTOM" && l.referencePriceCents != null && l.referencePriceCents !== l.unitPriceCents)
    .map((l) => ({
      type: l.type,
      refId: l.refId,
      description: l.description,
      fromCents: l.referencePriceCents!,
      toCents: l.unitPriceCents,
    }));
}

// -----------------------------------------------------------------------------
// Invitadas
// -----------------------------------------------------------------------------
export function billableGuests(guestCount: number, baseGuests: number): number {
  return Math.max(guestCount, baseGuests);
}

/** Unidades de un add-on por persona a partir de la cantidad de la línea (cantidad = invitadas × unidades). */
export function perGuestUnits(lineQuantity: number, billable: number): number {
  if (billable <= 0) return Math.max(1, lineQuantity);
  return Math.max(1, Math.round(lineQuantity / billable));
}

export type GuestAdjustOptions = {
  oldGuestCount: number;
  newGuestCount: number;
  /** Invitadas incluidas en el precio base de la experiencia */
  baseGuests: number;
  /** Precio/costo de invitada adicional (para crear la línea si no existía) */
  extraGuest: { unitPriceCents: number; unitCostCents: number; refId: string | null } | null;
  /** Precio del menú por persona (true) o por evento */
  menuPerGuest: boolean;
  /** IDs de add-ons cobrados por persona */
  perGuestAddOnIds: ReadonlySet<string>;
};

/**
 * Ajusta las líneas que dependen del número de invitadas, conservando precios unitarios
 * (incluidos overrides): invitadas adicionales, menú (cantidad o costo) y add-ons por persona.
 * La experiencia base, logística y conceptos personalizados no cambian.
 */
export function adjustLinesForGuestCount<L extends StoredLine>(lines: L[], opts: GuestAdjustOptions): StoredLine[] {
  const oldBillable = billableGuests(opts.oldGuestCount, opts.baseGuests);
  const newBillable = billableGuests(opts.newGuestCount, opts.baseGuests);
  const newExtra = Math.max(0, opts.newGuestCount - opts.baseGuests);
  if (oldBillable === newBillable && opts.oldGuestCount === opts.newGuestCount) return lines.map((l) => ({ ...l }));

  const out: StoredLine[] = [];
  let hasExtra = false;
  for (const line of lines) {
    switch (line.type) {
      case "EXTRA_GUEST": {
        hasExtra = true;
        if (newExtra > 0) out.push({ ...line, quantity: newExtra, description: `Invitada adicional (${newExtra})` });
        break;
      }
      case "MENU": {
        if (opts.menuPerGuest) {
          out.push({ ...line, quantity: newBillable });
        } else {
          // Menú incluido / por evento: cantidad 1, el costo de comida escala con las invitadas.
          const perGuestCost = oldBillable > 0 ? line.unitCostCents / oldBillable : 0;
          out.push({ ...line, unitCostCents: Math.round(perGuestCost * newBillable) });
        }
        break;
      }
      case "ADDON": {
        if (line.refId && opts.perGuestAddOnIds.has(line.refId)) {
          const units = perGuestUnits(line.quantity, oldBillable);
          out.push({ ...line, quantity: units * newBillable });
        } else {
          out.push({ ...line });
        }
        break;
      }
      default:
        out.push({ ...line });
    }
  }
  if (!hasExtra && newExtra > 0 && opts.extraGuest) {
    // Insertar después de la experiencia base
    const idx = out.findIndex((l) => l.type === "BASE_EXPERIENCE");
    const extraLine: StoredLine = {
      id: null,
      type: "EXTRA_GUEST",
      refId: opts.extraGuest.refId,
      description: `Invitada adicional (${newExtra})`,
      quantity: newExtra,
      unitPriceCents: opts.extraGuest.unitPriceCents,
      unitCostCents: opts.extraGuest.unitCostCents,
      costCategory: "FOOD",
    };
    out.splice(idx >= 0 ? idx + 1 : out.length, 0, extraLine);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Margen y vigencia
// -----------------------------------------------------------------------------
export type MarginLevel = "ok" | "low" | "negative";

export function marginLevel(marginBps: number, estimatedMarginCents: number, minMarginBps: number): MarginLevel {
  if (estimatedMarginCents < 0 || marginBps < 0) return "negative";
  if (marginBps < minMarginBps) return "low";
  return "ok";
}

export function isExpiringSoon(validUntil: Date | null, now: Date = new Date(), hours = 48): boolean {
  if (!validUntil) return false;
  const diff = validUntil.getTime() - now.getTime();
  return diff >= 0 && diff <= hours * 3_600_000;
}

export type Countdown = { expired: boolean; days: number; hours: number; minutes: number; totalMs: number };

export function countdown(validUntil: Date, now: Date = new Date()): Countdown {
  const totalMs = validUntil.getTime() - now.getTime();
  if (totalMs <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, totalMs: 0 };
  const totalMinutes = Math.floor(totalMs / 60_000);
  return {
    expired: false,
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    totalMs,
  };
}

/** "Vence en 3 días" / "Vence en 5 h" / "Vence en 20 min" / "Venció" */
export function validityLabel(validUntil: Date | null, now: Date = new Date()): string {
  if (!validUntil) return "Sin vigencia";
  const c = countdown(validUntil, now);
  if (c.expired) return "Venció";
  if (c.days >= 1) return `Vence en ${c.days} ${c.days === 1 ? "día" : "días"}`;
  if (c.hours >= 1) return `Vence en ${c.hours} h`;
  return `Vence en ${Math.max(1, c.minutes)} min`;
}

/**
 * ¿El total ya incluye el IVA? (precios con IVA, default B2C). Se deriva de los montos guardados
 * de la propia cotización, no de la configuración actual, para que una propuesta vieja se siga
 * mostrando como se calculó aunque después cambie `pricesIncludeTax`.
 */
export function isTaxIncluded(t: { subtotalCents: number; discountCents: number; totalCents: number }): boolean {
  return t.totalCents === t.subtotalCents - t.discountCents;
}

// -----------------------------------------------------------------------------
// Textos
// -----------------------------------------------------------------------------
export function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || "";
}

/** "<Ocasión> de <homenajeada/nombre>" */
export function defaultQuoteTitle(occasionLabel: string, honoreeOrName: string | null | undefined): string {
  const who = firstName(honoreeOrName);
  return who ? `${occasionLabel} de ${who}` : occasionLabel;
}

/** Sufijo aleatorio para el slug del micrositio (4 caracteres a-z0-9). */
export function randomSlugSuffix(random: () => number = Math.random, length = 4): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
  return out;
}

/** Mensaje de WhatsApp para compartir la propuesta. */
export function quoteShareMessage(params: { customerName: string; title: string; url: string; validUntil?: string | null }): string {
  const hi = firstName(params.customerName);
  const vig = params.validUntil ? ` Está vigente hasta el ${params.validUntil}.` : "";
  return `Hola${hi ? ` ${hi}` : ""}, te compartimos tu propuesta para ${params.title}.${vig}\n\nAquí puedes revisarla y aceptarla: ${params.url}`;
}

// -----------------------------------------------------------------------------
// Desglose de costos para mostrar (snapshot del motor o derivado de las líneas)
// -----------------------------------------------------------------------------
const COST_KEYS: CostCategory[] = ["FOOD", "FLOWERS", "STAFF", "TRANSPORT", "VENDOR", "CONSUMABLES", "PAYMENT_FEE", "OTHER"];

export type BaseCostComponent = { category: CostCategory; amountCents: number; perGuest: boolean };

/**
 * `calculateFromLines` asigna todo el costo de la experiencia base a una sola categoría (la
 * dominante), mientras que el motor completo lo desglosa por componente. Para que el desglose no
 * "salte" al editar, reparte el costo de las líneas BASE_EXPERIENCE en proporción a los componentes
 * de la experiencia (misma regla que el motor: los componentes por persona cuentan las invitadas
 * incluidas). Nunca cambia el costo total; si no hay componentes deja el desglose igual.
 */
export function splitBaseExperienceCost(
  breakdown: Record<CostCategory, number>,
  baseLines: Array<{ costCategory: CostCategory; totalCostCents: number }>,
  components: BaseCostComponent[],
  includedGuests: number,
): Record<CostCategory, number> {
  const weights = new Map<CostCategory, number>();
  for (const c of components) {
    const w = c.perGuest ? c.amountCents * Math.max(1, includedGuests) : c.amountCents;
    if (w > 0) weights.set(c.category, (weights.get(c.category) ?? 0) + w);
  }
  const totalWeight = [...weights.values()].reduce((s, w) => s + w, 0);
  const out = { ...breakdown };
  if (totalWeight <= 0) return out;
  const largest = [...weights.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  for (const line of baseLines) {
    const total = line.totalCostCents;
    if (total <= 0 || out[line.costCategory] < total) continue;
    out[line.costCategory] -= total;
    let assigned = 0;
    for (const [cat, w] of weights) {
      const share = Math.floor((total * w) / totalWeight);
      out[cat] += share;
      assigned += share;
    }
    out[largest] += total - assigned;
  }
  return out;
}

/**
 * Usa el `costBreakdown` del snapshot si corresponde a los totales guardados; si no (datos antiguos
 * o editados), lo deriva de las líneas y asigna la diferencia a la comisión de pago.
 */
export function costBreakdownFor(
  snapshot: unknown,
  saved: { totalCents: number; estimatedCostCents: number },
  items: Array<{ costCategory: CostCategory; totalCostCents: number }>,
): Record<CostCategory, number> {
  const snap = snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : null;
  const sb = snap?.costBreakdown;
  if (
    snap &&
    sb &&
    typeof sb === "object" &&
    snap.totalCents === saved.totalCents &&
    snap.estimatedCostCents === saved.estimatedCostCents &&
    COST_KEYS.every((k) => typeof (sb as Record<string, unknown>)[k] === "number")
  ) {
    return { ...(sb as Record<CostCategory, number>) };
  }
  const out = Object.fromEntries(COST_KEYS.map((k) => [k, 0])) as Record<CostCategory, number>;
  for (const i of items) out[i.costCategory] += i.totalCostCents;
  const linesCost = items.reduce((s, i) => s + i.totalCostCents, 0);
  const fee = saved.estimatedCostCents - linesCost;
  if (fee > 0) out.PAYMENT_FEE += fee;
  return out;
}
