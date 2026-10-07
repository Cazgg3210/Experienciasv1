import "server-only";
import type { AddOn, Prisma, Quote, QuoteItem, QuoteStatus } from "@prisma/client";
import { prisma } from "@/db";
import { generateCode, generateReferralCode } from "@/lib/codes";
import { dateOnly, formatLongDate, isValidDateKey, localDateKey, toDateKey, zonedDateTime } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { OCCASION_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { formatMXN } from "@/lib/money";
import { generateToken, isPlausibleToken } from "@/lib/tokens";
import { audit } from "@/server/audit";
import { track } from "@/server/analytics";
import { can } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { getSettings } from "@/features/settings/server/settings-service";
import { notify, notifyCustomer } from "@/features/notifications/server/notification-service";
import { findCustomerByContact, lockCustomerContact, phoneForStorage } from "@/features/customers/server/customer-contact";
import { contactUpdateForExisting } from "@/features/customers/domain/contact-merge";
import { leadStatusMachine, type LeadStatus } from "@/features/leads/domain/lead-status";
import { calculateFromLines, QuoteEngineError, type QuoteResult } from "../domain/quote-engine";
import { quoteStatusMachine, isQuoteExpired } from "../domain/quote-status";
import { estimateSelection, toEngineSettings, type PricingSelection } from "./pricing";
import {
  adjustLinesForGuestCount,
  billableGuests,
  defaultQuoteTitle,
  detectPriceChanges,
  discountChanged,
  normalizeDiscount,
  splitBaseExperienceCost,
  toEngineDiscount,
  toEngineLines,
  type DiscountState,
  type PriceChange,
  type StoredLine,
} from "../domain/quote-lines";
import {
  quickCustomerSchema,
  type CatalogLineRequest,
  type CreateQuoteData,
  type EditorLine,
  type QuotePricingInput,
} from "../schemas";

/**
 * Servicio de cotizaciones (admin + público). Recibe el actor explícito para poder probarse
 * en integración; las Server Actions sólo validan, autorizan y delegan aquí.
 */

type Tx = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Errores del motor → error de validación legible (nunca 500). */
async function withEngine<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof QuoteEngineError) throw new ValidationError(`No se pudo calcular: ${error.message}`);
    throw error;
  }
}

function assertTransition(from: QuoteStatus, to: QuoteStatus, message: string) {
  if (!quoteStatusMachine.can(from, to)) throw new ConflictError(message);
}

async function uniqueQuoteCode(tx: Tx | typeof prisma = prisma): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generateCode("Q");
    const exists = await tx.quote.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new AppError("No se pudo generar el código de la cotización; intenta de nuevo.");
}

function itemData(line: QuoteResult["lines"][number], sortOrder: number) {
  return {
    type: line.type,
    refId: line.refId,
    description: line.description,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    unitCostCents: line.unitCostCents,
    totalPriceCents: line.totalPriceCents,
    totalCostCents: line.totalCostCents,
    costCategory: line.costCategory,
    sortOrder,
  };
}

function totalsData(result: QuoteResult) {
  return {
    subtotalCents: result.subtotalCents,
    discountCents: result.discountCents,
    logisticsCents: result.logisticsCents,
    taxCents: result.taxCents,
    totalCents: result.totalCents,
    estimatedCostCents: result.estimatedCostCents,
    estimatedMarginCents: result.estimatedMarginCents,
    marginBps: result.marginBps,
    depositBps: result.depositBps,
    depositCents: result.depositCents,
  };
}

function snapshot(result: QuoteResult, meta: Record<string, unknown>): Prisma.InputJsonValue {
  return toJson({ ...result, meta: { ...meta, calculatedAt: new Date().toISOString() } });
}

/** Mueve el lead a `to` si la transición es válida; registra actividad. */
async function advanceLead(
  tx: Tx,
  leadId: string,
  to: LeadStatus,
  activity: { type: "QUOTE_CREATED" | "QUOTE_SENT" | "STATUS_CHANGE" | "SYSTEM"; message: string; actorId: string | null },
) {
  const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true, status: true } });
  if (!lead) return;
  const from = lead.status as LeadStatus;
  const changes = leadStatusMachine.can(from, to);
  if (changes) {
    await tx.lead.update({ where: { id: leadId }, data: { status: to } });
  }
  await tx.leadActivity.create({
    data: {
      leadId,
      type: activity.type,
      message: activity.message,
      fromStatus: changes ? from : null,
      toStatus: changes ? to : null,
      actorId: activity.actorId,
    },
  });
}

// =============================================================================
// Preview y creación
// =============================================================================
export async function previewQuote(sel: PricingSelection): Promise<QuoteResult> {
  return withEngine(async () => (await estimateSelection(sel, { publicOnly: false })).result);
}

async function resolveCustomer(tx: Tx, input: CreateQuoteData): Promise<{ id: string; name: string }> {
  if (input.customerMode === "existing") {
    const c = await tx.customer.findUnique({ where: { id: input.customerId ?? "" }, select: { id: true, name: true } });
    if (!c) throw new ValidationError("La clienta seleccionada ya no existe.", { customerId: ["Elige otra clienta"] });
    return c;
  }
  const nc = quickCustomerSchema.parse(input.newCustomer ?? {});
  const email = emptyToNull(nc.email)?.toLowerCase() ?? null;
  const phone = phoneForStorage(nc.phone, "newCustomer.phone");
  // Misma regla que la captura de leads: si ya existe (por correo, o por teléfono sin otro correo) se
  // reutiliza y se le completan los datos que falten (los capturó el equipo). Una clienta encontrada por
  // teléfono que tiene OTRO correo es otra persona: se crea la nueva (nunca se liga la cotización a otra).
  await lockCustomerContact(tx, { email, phone });
  const match = await findCustomerByContact(tx, { email, phone });
  if (match) {
    const existing = match.customer;
    const { fill } = contactUpdateForExisting("team", existing, { email, phone });
    if (Object.keys(fill).length) await tx.customer.update({ where: { id: existing.id }, data: fill });
    return { id: existing.id, name: existing.name };
  }
  return tx.customer.create({
    data: {
      name: nc.name.trim(),
      email,
      phone,
      whatsapp: phone,
      source: "MANUAL",
      referralCode: generateReferralCode(nc.name),
    },
    select: { id: true, name: true },
  });
}

export async function createQuote(
  actor: SessionUser,
  input: CreateQuoteData,
  now: Date = new Date(),
): Promise<{ id: string; code: string }> {
  const pricing = await getSettings("pricing");
  const lead = input.leadId
    ? await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: { id: true, code: true, honoreeName: true, customerId: true },
      })
    : null;
  if (input.leadId && !lead) throw new NotFoundError("El lead ya no existe.");

  const eventDateKey = emptyToNull(input.eventDate);
  if (eventDateKey && !isValidDateKey(eventDateKey)) {
    throw new ValidationError("Fecha inválida.", { eventDate: ["Fecha inválida"] });
  }
  if (input.styleId) {
    const style = await prisma.style.findUnique({ where: { id: input.styleId }, select: { id: true } });
    if (!style) throw new ValidationError("El estilo ya no existe.", { styleId: ["Elige otro estilo"] });
  }

  const selection: PricingSelection = {
    experienceId: input.experienceId,
    guestCount: input.guestCount,
    menuId: input.menuId || null,
    serviceAreaId: input.serviceAreaId || null,
    addOns: input.addOns,
    depositBps: input.depositBps,
  };
  const result = await previewQuote(selection);
  const code = await uniqueQuoteCode();

  const created = await prisma.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, input);
    const title =
      emptyToNull(input.title) ??
      defaultQuoteTitle(OCCASION_LABELS[input.occasion], lead?.honoreeName ?? customer.name);

    const quote = await tx.quote.create({
      data: {
        code,
        publicToken: generateToken(),
        status: "DRAFT",
        leadId: lead?.id ?? null,
        customerId: customer.id,
        experienceId: input.experienceId,
        menuId: input.menuId || null,
        styleId: input.styleId || null,
        serviceAreaId: input.serviceAreaId || null,
        occasion: input.occasion,
        title,
        eventDate: eventDateKey ? dateOnly(eventDateKey) : null,
        startTime: emptyToNull(input.startTime),
        guestCount: input.guestCount,
        ...totalsData(result),
        pricingSnapshot: snapshot(result, { source: "catalog", selection }),
        notesForCustomer: emptyToNull(input.notesForCustomer),
        internalNotes: emptyToNull(input.internalNotes),
        validUntil: new Date(now.getTime() + pricing.quoteValidityDays * DAY_MS),
        createdById: actor.id,
        items: { create: result.lines.map((l, i) => itemData(l, i)) },
      },
      select: { id: true, code: true, totalCents: true },
    });

    if (lead) {
      if (!lead.customerId) await tx.lead.update({ where: { id: lead.id }, data: { customerId: customer.id } });
      await advanceLead(tx, lead.id, "QUOTED", {
        type: "QUOTE_CREATED",
        message: `Cotización ${quote.code} creada por ${formatMXN(quote.totalCents)}.`,
        actorId: actor.id,
      });
    }
    await audit(
      {
        action: "quote.created",
        entityType: "Quote",
        entityId: quote.id,
        after: { code: quote.code, totalCents: result.totalCents, marginBps: result.marginBps, leadId: lead?.id ?? null },
        actor,
      },
      tx,
    );
    return quote;
  });
  return { id: created.id, code: created.code };
}

// =============================================================================
// Edición (sólo borradores)
// =============================================================================
async function loadDraft(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      experience: {
        select: {
          id: true,
          baseGuests: true,
          extraGuestPriceCents: true,
          extraGuestCostCents: true,
          costComponents: { select: { category: true, amountCents: true, perGuest: true } },
        },
      },
      menu: { select: { pricingType: true } },
    },
  });
  if (!quote) throw new NotFoundError("La cotización no existe.");
  if (quote.status !== "DRAFT") {
    throw new ConflictError("Sólo puedes editar borradores. Crea una nueva versión para hacer cambios.");
  }
  return quote;
}
type DraftQuote = Awaited<ReturnType<typeof loadDraft>>;

/** Recalcula desde líneas (motor) conservando el desglose de costos por componente de la experiencia base. */
async function calculateDraftLines(
  quote: DraftQuote,
  params: Omit<Parameters<typeof calculateFromLines>[0], "settings">,
): Promise<QuoteResult> {
  const settings = await engineSettings();
  const result = await withEngine(() => calculateFromLines({ ...params, settings }));
  if (!quote.experience) return result;
  return {
    ...result,
    costBreakdown: splitBaseExperienceCost(
      result.costBreakdown,
      result.lines.filter((l) => l.type === "BASE_EXPERIENCE"),
      quote.experience.costComponents,
      quote.experience.baseGuests,
    ),
  };
}

function storedFromItem(item: QuoteItem): StoredLine {
  return {
    id: item.id,
    type: item.type,
    refId: item.refId,
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    unitCostCents: item.unitCostCents,
    costCategory: item.costCategory,
  };
}

function quoteDiscount(q: Pick<Quote, "discountType" | "discountValue" | "discountReason">): DiscountState {
  return normalizeDiscount({ type: q.discountType, value: q.discountValue, reason: q.discountReason });
}

async function engineSettings() {
  return toEngineSettings(await getSettings("pricing"));
}

/** Reemplaza las líneas de una cotización conservando IDs existentes y guarda totales. */
async function persistLines(
  tx: Tx,
  quote: Pick<Quote, "id">,
  lines: StoredLine[],
  result: QuoteResult,
  extra: Prisma.QuoteUpdateInput = {},
) {
  const keepIds = lines.map((l) => l.id).filter((x): x is string => !!x);
  await tx.quoteItem.deleteMany({ where: { quoteId: quote.id, id: { notIn: keepIds } } });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const data = itemData(result.lines[i]!, i);
    if (line.id) await tx.quoteItem.update({ where: { id: line.id }, data });
    else await tx.quoteItem.create({ data: { ...data, quoteId: quote.id } });
  }
  await tx.quote.update({
    where: { id: quote.id },
    data: { ...totalsData(result), pricingSnapshot: snapshot(result, { source: "lines" }), ...extra },
  });
}

type ResolvedLines = { lines: StoredLine[]; priceChanges: PriceChange[] };
const FIXED_QUANTITY_TYPES: ReadonlySet<QuoteItem["type"]> = new Set(["BASE_EXPERIENCE", "MENU", "LOGISTICS"]);

async function resolveEditorLines(quote: DraftQuote, input: EditorLine[]): Promise<ResolvedLines> {
  const addOnIds = input.filter((l) => !l.itemId && l.type === "ADDON" && l.refId).map((l) => l.refId!);
  const addOns = addOnIds.length ? await prisma.addOn.findMany({ where: { id: { in: addOnIds } } }) : [];
  const withRef: Array<StoredLine & { referencePriceCents: number | null }> = [];
  const seenItemIds = new Set<string>();
  let extraGuestLines = 0;

  for (const line of input) {
    if (line.itemId) {
      if (seenItemIds.has(line.itemId)) throw new ValidationError("Hay conceptos duplicados; recarga la página.");
      seenItemIds.add(line.itemId);
      const existing = quote.items.find((i) => i.id === line.itemId);
      if (!existing) throw new ValidationError("Uno de los conceptos ya no existe; recarga la página.");
      const custom = existing.type === "CUSTOM";
      if (existing.type === "EXTRA_GUEST") extraGuestLines++;
      // Experiencia base, menú y logística sólo cambian de cantidad con el número de invitadas
      // (updateQuoteDetails); el editor no puede alterarlas aunque se manipule la petición.
      const quantity = FIXED_QUANTITY_TYPES.has(existing.type) ? existing.quantity : line.quantity;
      withRef.push({
        id: existing.id,
        type: existing.type,
        refId: existing.refId,
        description:
          existing.type === "EXTRA_GUEST"
            ? `Invitada adicional (${quantity})`
            : custom
              ? line.description.trim()
              : existing.description,
        quantity,
        unitPriceCents: line.unitPriceCents,
        unitCostCents: custom ? line.unitCostCents : existing.unitCostCents,
        costCategory: custom ? line.costCategory : existing.costCategory,
        referencePriceCents: custom ? null : existing.unitPriceCents,
      });
      continue;
    }
    switch (line.type) {
      case "ADDON": {
        const addOn = addOns.find((a) => a.id === line.refId);
        if (!addOn) throw new ValidationError("Uno de los add-ons ya no existe en el catálogo.");
        withRef.push({
          id: null,
          type: "ADDON",
          refId: addOn.id,
          description: addOn.pricingType === "PER_GUEST" ? `${addOn.name} (por persona)` : addOn.name,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          unitCostCents: addOn.costCents,
          costCategory: addOn.costCategory,
          referencePriceCents: addOn.priceCents,
        });
        break;
      }
      case "EXTRA_GUEST": {
        if (!quote.experience) throw new ValidationError("La cotización no tiene experiencia asociada.");
        extraGuestLines++;
        withRef.push({
          id: null,
          type: "EXTRA_GUEST",
          refId: quote.experience.id,
          description: `Invitada adicional (${line.quantity})`,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          unitCostCents: quote.experience.extraGuestCostCents,
          costCategory: "FOOD",
          referencePriceCents: quote.experience.extraGuestPriceCents,
        });
        break;
      }
      case "CUSTOM": {
        withRef.push({
          id: null,
          type: "CUSTOM",
          refId: null,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          unitCostCents: line.unitCostCents,
          costCategory: line.costCategory,
          referencePriceCents: null,
        });
        break;
      }
      default:
        throw new ValidationError("Ese tipo de concepto no se puede agregar manualmente.");
    }
  }
  if (extraGuestLines > 1) throw new ValidationError("Sólo puede haber un concepto de invitadas adicionales.");
  const priceChanges = detectPriceChanges(withRef);
  const lines = withRef.map(({ referencePriceCents: _ref, ...l }) => l);
  return { lines, priceChanges };
}

export type PricingPreview = {
  result: QuoteResult;
  priceChanges: PriceChange[];
  discountChanged: boolean;
  needsPricingPermission: boolean;
  needsDiscountPermission: boolean;
};

async function computePricing(quote: DraftQuote, input: QuotePricingInput) {
  const resolved = await resolveEditorLines(quote, input.lines);
  const before = quoteDiscount(quote);
  const after = normalizeDiscount(input.discount);
  const result = await calculateDraftLines(quote, {
    lines: toEngineLines(resolved.lines),
    discount: toEngineDiscount(after),
    depositBps: input.depositBps,
    guestCount: quote.guestCount,
  });
  return { resolved, before, after, result, changedDiscount: discountChanged(before, after) };
}

export async function previewQuotePricing(actor: SessionUser, input: QuotePricingInput): Promise<PricingPreview> {
  const quote = await loadDraft(input.quoteId);
  const { resolved, result, changedDiscount } = await computePricing(quote, input);
  return {
    result,
    priceChanges: resolved.priceChanges,
    discountChanged: changedDiscount,
    needsPricingPermission: resolved.priceChanges.length > 0 && !can(actor.role, "pricing:write"),
    needsDiscountPermission: changedDiscount && !can(actor.role, "quotes:discount"),
  };
}

export async function saveQuotePricing(
  actor: SessionUser,
  input: QuotePricingInput,
): Promise<{ totalCents: number; marginBps: number }> {
  const quote = await loadDraft(input.quoteId);
  const { resolved, before, after, result, changedDiscount } = await computePricing(quote, input);
  if (resolved.priceChanges.length > 0 && !can(actor.role, "pricing:write")) {
    throw new ForbiddenError("Necesitas permiso de precios para cambiar precios unitarios.");
  }
  if (changedDiscount && !can(actor.role, "quotes:discount")) {
    throw new ForbiddenError("No tienes permiso para aplicar descuentos.");
  }

  await prisma.$transaction(async (tx) => {
    // Guardia optimista: el borrador no cambió de estado mientras se editaba.
    const guard = await tx.quote.updateMany({ where: { id: quote.id, status: "DRAFT" }, data: { updatedAt: new Date() } });
    if (guard.count !== 1) throw new ConflictError("La cotización cambió de estado; recarga la página.");
    await persistLines(tx, quote, resolved.lines, result, {
      discountType: after.type,
      discountValue: after.value,
      discountReason: after.reason,
    });
    if (resolved.priceChanges.length) {
      await audit(
        {
          action: "quote.price_changed",
          entityType: "Quote",
          entityId: quote.id,
          before: resolved.priceChanges.map((c) => ({ description: c.description, unitPriceCents: c.fromCents })),
          after: resolved.priceChanges.map((c) => ({ description: c.description, unitPriceCents: c.toCents })),
          actor,
        },
        tx,
      );
    }
    if (changedDiscount) {
      await audit(
        {
          action: "quote.discount_applied",
          entityType: "Quote",
          entityId: quote.id,
          before: { ...before, discountCents: quote.discountCents, totalCents: quote.totalCents },
          after: { ...after, discountCents: result.discountCents, totalCents: result.totalCents },
          actor,
        },
        tx,
      );
    }
    if (quote.depositBps !== result.depositBps) {
      await audit(
        {
          action: "quote.deposit_changed",
          entityType: "Quote",
          entityId: quote.id,
          before: { depositBps: quote.depositBps },
          after: { depositBps: result.depositBps },
          actor,
        },
        tx,
      );
    }
  });
  return { totalCents: result.totalCents, marginBps: result.marginBps };
}

/** Línea nueva desde catálogo: el precio/costo lo define el servidor. */
export async function buildCatalogLine(req: CatalogLineRequest): Promise<EditorLine> {
  const quote = await loadDraft(req.quoteId);
  const baseGuests = quote.experience?.baseGuests ?? 1;
  const billable = billableGuests(quote.guestCount, baseGuests);
  if (req.kind === "EXTRA_GUEST") {
    if (!quote.experience) throw new ValidationError("La cotización no tiene experiencia asociada.");
    return {
      itemId: null,
      type: "EXTRA_GUEST",
      refId: quote.experience.id,
      description: `Invitada adicional (${req.units})`,
      quantity: req.units,
      unitPriceCents: quote.experience.extraGuestPriceCents,
      unitCostCents: quote.experience.extraGuestCostCents,
      costCategory: "FOOD",
    };
  }
  const addOn: AddOn | null = req.addOnId ? await prisma.addOn.findUnique({ where: { id: req.addOnId } }) : null;
  if (!addOn) throw new ValidationError("Elige un add-on del catálogo.");
  const units = addOn.maxQuantity > 0 ? Math.min(req.units, addOn.maxQuantity) : req.units;
  return {
    itemId: null,
    type: "ADDON",
    refId: addOn.id,
    description: addOn.pricingType === "PER_GUEST" ? `${addOn.name} (por persona)` : addOn.name,
    quantity: addOn.pricingType === "PER_GUEST" ? billable * units : units,
    unitPriceCents: addOn.priceCents,
    unitCostCents: addOn.costCents,
    costCategory: addOn.costCategory,
  };
}

export type QuoteDetailsData = {
  quoteId: string;
  title: string;
  eventDate?: string;
  startTime?: string;
  guestCount: number;
  styleId?: string | null;
  validUntil?: string;
  notesForCustomer?: string;
  internalNotes?: string;
};

export async function updateQuoteDetails(actor: SessionUser, input: QuoteDetailsData, now: Date = new Date()) {
  const quote = await loadDraft(input.quoteId);
  const eventDateKey = emptyToNull(input.eventDate);
  if (eventDateKey && !isValidDateKey(eventDateKey)) {
    throw new ValidationError("Fecha inválida.", { eventDate: ["Fecha inválida"] });
  }
  const validKey = emptyToNull(input.validUntil);
  let validUntil: Date | null = quote.validUntil;
  if (validKey) {
    if (!isValidDateKey(validKey)) throw new ValidationError("Fecha inválida.", { validUntil: ["Fecha inválida"] });
    if (validKey < localDateKey(now)) {
      throw new ValidationError("La vigencia no puede estar en el pasado.", {
        validUntil: ["La vigencia no puede estar en el pasado"],
      });
    }
    validUntil =
      quote.validUntil && localDateKey(quote.validUntil) === validKey ? quote.validUntil : zonedDateTime(validKey, "23:59");
  } else {
    validUntil = null;
  }
  if (input.styleId) {
    const style = await prisma.style.findUnique({ where: { id: input.styleId }, select: { id: true } });
    if (!style) throw new ValidationError("El estilo ya no existe.", { styleId: ["Elige otro estilo"] });
  }

  const data: Prisma.QuoteUpdateInput = {
    title: input.title.trim(),
    eventDate: eventDateKey ? dateOnly(eventDateKey) : null,
    startTime: emptyToNull(input.startTime),
    guestCount: input.guestCount,
    style: input.styleId ? { connect: { id: input.styleId } } : { disconnect: true },
    validUntil,
    notesForCustomer: emptyToNull(input.notesForCustomer),
    internalNotes: emptyToNull(input.internalNotes),
  };
  const before = {
    title: quote.title,
    eventDate: quote.eventDate ? toDateKey(quote.eventDate) : null,
    startTime: quote.startTime,
    guestCount: quote.guestCount,
    validUntil: quote.validUntil?.toISOString() ?? null,
  };
  const after = {
    title: input.title.trim(),
    eventDate: eventDateKey,
    startTime: emptyToNull(input.startTime),
    guestCount: input.guestCount,
    validUntil: validUntil?.toISOString() ?? null,
  };

  await prisma.$transaction(async (tx) => {
    const guard = await tx.quote.updateMany({ where: { id: quote.id, status: "DRAFT" }, data: { updatedAt: new Date() } });
    if (guard.count !== 1) throw new ConflictError("La cotización cambió de estado; recarga la página.");
    if (input.guestCount !== quote.guestCount && quote.items.length) {
      // Recalcular conceptos que dependen de invitadas (conservando precios unitarios)
      const addOnRefs = quote.items.filter((i) => i.type === "ADDON" && i.refId).map((i) => i.refId!);
      const perGuest = addOnRefs.length
        ? await tx.addOn.findMany({ where: { id: { in: addOnRefs }, pricingType: "PER_GUEST" }, select: { id: true } })
        : [];
      const lines = adjustLinesForGuestCount(quote.items.map(storedFromItem), {
        oldGuestCount: quote.guestCount,
        newGuestCount: input.guestCount,
        baseGuests: quote.experience?.baseGuests ?? 1,
        extraGuest: quote.experience
          ? {
              unitPriceCents: quote.experience.extraGuestPriceCents,
              unitCostCents: quote.experience.extraGuestCostCents,
              refId: quote.experience.id,
            }
          : null,
        menuPerGuest: quote.menu?.pricingType === "PER_GUEST",
        perGuestAddOnIds: new Set(perGuest.map((p) => p.id)),
      });
      const result = await calculateDraftLines(quote, {
        lines: toEngineLines(lines),
        discount: toEngineDiscount(quoteDiscount(quote)),
        depositBps: quote.depositBps,
        guestCount: input.guestCount,
      });
      await persistLines(tx, quote, lines, result, data);
    } else {
      await tx.quote.update({ where: { id: quote.id }, data });
    }
    await audit({ action: "quote.updated", entityType: "Quote", entityId: quote.id, before, after, actor }, tx);
  });
}

// =============================================================================
// Ciclo de vida (admin)
// =============================================================================
export async function sendQuote(
  actor: SessionUser,
  quoteId: string,
  now: Date = new Date(),
): Promise<{ url: string; notified: boolean }> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true, _count: { select: { items: true } } },
  });
  if (!quote) throw new NotFoundError("La cotización no existe.");
  if (quote.status !== "DRAFT" && quote.status !== "EXPIRED") {
    throw new ConflictError("Esta cotización ya fue enviada o cerrada.");
  }
  assertTransition(quote.status, "SENT", "No se puede enviar en su estado actual.");
  const missing: Record<string, string[]> = {};
  if (!quote.eventDate) missing.eventDate = ["Agrega la fecha del evento antes de enviar"];
  else if (toDateKey(quote.eventDate) < localDateKey(now)) {
    // La clienta no podría aceptarla (la fecha ya pasó): pedir actualizarla antes de enviar.
    missing.eventDate = ["La fecha del evento ya pasó; actualízala antes de enviar"];
  }
  if (!quote._count.items || quote.totalCents <= 0) missing.lines = ["La cotización no tiene conceptos con precio"];
  if (Object.keys(missing).length) {
    throw new ValidationError(Object.values(missing)[0]![0], missing);
  }
  const pricing = await getSettings("pricing");
  const validUntil =
    quote.validUntil && quote.validUntil.getTime() > now.getTime()
      ? quote.validUntil
      : new Date(now.getTime() + pricing.quoteValidityDays * DAY_MS);
  const url = appUrl(`/cotizacion/${quote.publicToken}`);

  await prisma.$transaction(async (tx) => {
    const res = await tx.quote.updateMany({
      where: { id: quote.id, status: quote.status },
      data: { status: "SENT", sentAt: now, validUntil, expiredAt: null },
    });
    if (res.count !== 1) throw new ConflictError("La cotización cambió de estado; recarga la página.");
    if (quote.leadId) {
      await advanceLead(tx, quote.leadId, "QUOTED", {
        type: "QUOTE_SENT",
        message: `Cotización ${quote.code} enviada (${formatMXN(quote.totalCents)}, vigente hasta ${formatLongDate(validUntil)}).`,
        actorId: actor.id,
      });
    }
    await audit(
      {
        action: "quote.sent",
        entityType: "Quote",
        entityId: quote.id,
        before: { status: quote.status },
        after: { status: "SENT", validUntil: validUntil.toISOString(), totalCents: quote.totalCents },
        actor,
      },
      tx,
    );
  });

  const c = quote.customer;
  const notified = !!(c.email || c.whatsapp || c.phone);
  await notifyCustomer(
    { email: c.email, phone: c.phone, whatsapp: c.whatsapp },
    {
      type: "QUOTE_SENT",
      quoteId: quote.id,
      leadId: quote.leadId,
      data: {
        name: c.name,
        eventTitle: quote.title,
        amount: formatMXN(quote.totalCents),
        validUntil: formatLongDate(validUntil),
        quoteCode: quote.code,
        url,
      },
    },
  );
  return { url, notified };
}

export async function markQuoteExpired(actor: SessionUser, quoteId: string, now: Date = new Date()) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, status: true } });
  if (!quote) throw new NotFoundError("La cotización no existe.");
  if (quote.status !== "SENT") throw new ConflictError("Sólo las cotizaciones enviadas pueden marcarse como expiradas.");
  assertTransition(quote.status, "EXPIRED", "No se puede expirar en su estado actual.");
  await prisma.$transaction(async (tx) => {
    const res = await tx.quote.updateMany({
      where: { id: quote.id, status: "SENT" },
      data: { status: "EXPIRED", expiredAt: now },
    });
    if (res.count !== 1) throw new ConflictError("La cotización cambió de estado; recarga la página.");
    await audit(
      { action: "quote.expired", entityType: "Quote", entityId: quote.id, before: { status: "SENT" }, after: { status: "EXPIRED" }, actor },
      tx,
    );
  });
}

export async function duplicateQuote(actor: SessionUser, quoteId: string, now: Date = new Date()) {
  const source = await prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
  if (!source) throw new NotFoundError("La cotización no existe.");
  const pricing = await getSettings("pricing");
  const code = await uniqueQuoteCode();
  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        code,
        publicToken: generateToken(),
        version: 1,
        status: "DRAFT",
        leadId: source.leadId,
        customerId: source.customerId,
        experienceId: source.experienceId,
        menuId: source.menuId,
        styleId: source.styleId,
        serviceAreaId: source.serviceAreaId,
        occasion: source.occasion,
        title: `${source.title} (copia)`.slice(0, 140),
        eventDate: source.eventDate,
        startTime: source.startTime,
        guestCount: source.guestCount,
        subtotalCents: source.subtotalCents,
        discountType: source.discountType,
        discountValue: source.discountValue,
        discountReason: source.discountReason,
        discountCents: source.discountCents,
        logisticsCents: source.logisticsCents,
        taxCents: source.taxCents,
        totalCents: source.totalCents,
        estimatedCostCents: source.estimatedCostCents,
        estimatedMarginCents: source.estimatedMarginCents,
        marginBps: source.marginBps,
        depositBps: source.depositBps,
        depositCents: source.depositCents,
        currency: source.currency,
        pricingSnapshot: source.pricingSnapshot ?? undefined,
        notesForCustomer: source.notesForCustomer,
        internalNotes: source.internalNotes,
        validUntil: new Date(now.getTime() + pricing.quoteValidityDays * DAY_MS),
        createdById: actor.id,
        items: {
          create: source.items
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((i, idx) => ({
              type: i.type,
              refId: i.refId,
              description: i.description,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
              unitCostCents: i.unitCostCents,
              totalPriceCents: i.totalPriceCents,
              totalCostCents: i.totalCostCents,
              costCategory: i.costCategory,
              sortOrder: idx,
            })),
        },
      },
      select: { id: true, code: true },
    });
    await audit(
      {
        action: "quote.duplicated",
        entityType: "Quote",
        entityId: created.id,
        before: { sourceId: source.id, sourceCode: source.code },
        after: { code: created.code },
        actor,
      },
      tx,
    );
    return created;
  });
  return copy;
}

export async function createNewVersion(actor: SessionUser, quoteId: string, now: Date = new Date()) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true, version: true, code: true },
  });
  if (!quote) throw new NotFoundError("La cotización no existe.");
  if (!["SENT", "EXPIRED", "REJECTED"].includes(quote.status)) {
    throw new ConflictError("Sólo se puede crear una nueva versión de cotizaciones enviadas, expiradas o rechazadas.");
  }
  assertTransition(quote.status, "DRAFT", "No se puede crear una nueva versión en su estado actual.");
  const pricing = await getSettings("pricing");
  await prisma.$transaction(async (tx) => {
    const res = await tx.quote.updateMany({
      where: { id: quote.id, status: quote.status },
      data: {
        status: "DRAFT",
        version: { increment: 1 },
        viewedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        expiredAt: null,
        validUntil: new Date(now.getTime() + pricing.quoteValidityDays * DAY_MS),
      },
    });
    if (res.count !== 1) throw new ConflictError("La cotización cambió de estado; recarga la página.");
    await audit(
      {
        action: "quote.new_version",
        entityType: "Quote",
        entityId: quote.id,
        before: { status: quote.status, version: quote.version },
        after: { status: "DRAFT", version: quote.version + 1 },
        actor,
      },
      tx,
    );
  });
  return { version: quote.version + 1 };
}

/** Cron: SENT con vigencia vencida → EXPIRED. Devuelve cuántas se expiraron. */
export async function expireOverdueQuotes(now: Date = new Date()): Promise<number> {
  const res = await prisma.quote.updateMany({
    where: { status: "SENT", validUntil: { lt: now } },
    data: { status: "EXPIRED", expiredAt: now },
  });
  if (res.count) logger.info("quotes.expired_overdue", { count: res.count });
  return res.count;
}


// =============================================================================
// Público (por token)
// =============================================================================

/**
 * Prepara la vista pública: valida token, expira si la vigencia pasó y marca la primera vista.
 * Devuelve null para tokens inválidos o borradores (la página responde 404 genérico).
 */
export async function openPublicQuote(
  token: string,
  opts: { now?: Date; markViewed?: boolean } = {},
): Promise<{ id: string; status: QuoteStatus } | null> {
  const now = opts.now ?? new Date();
  if (!isPlausibleToken(token)) return null;
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    select: { id: true, status: true, validUntil: true, viewedAt: true, leadId: true, experienceId: true },
  });
  if (!quote || quote.status === "DRAFT") return null;
  let status: QuoteStatus = quote.status;
  if (status === "SENT" && isQuoteExpired(quote.validUntil, now)) {
    const res = await prisma.quote.updateMany({
      where: { id: quote.id, status: "SENT" },
      data: { status: "EXPIRED", expiredAt: now },
    });
    if (res.count === 1) status = "EXPIRED";
    else status = (await prisma.quote.findUnique({ where: { id: quote.id }, select: { status: true } }))?.status ?? status;
  }
  if (opts.markViewed !== false && !quote.viewedAt) {
    const res = await prisma.quote.updateMany({ where: { id: quote.id, viewedAt: null }, data: { viewedAt: now } });
    if (res.count === 1) {
      await track("VIEW_QUOTE", { quoteId: quote.id, leadId: quote.leadId, experienceId: quote.experienceId });
    }
  }
  return { id: quote.id, status };
}

export async function rejectQuoteByToken(
  token: string,
  opts: { reason?: string | null; ip?: string | null; now?: Date } = {},
): Promise<void> {
  const now = opts.now ?? new Date();
  if (!isPlausibleToken(token)) throw new NotFoundError("No encontramos esta propuesta.");
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    select: { id: true, code: true, status: true, validUntil: true, leadId: true, title: true, customer: { select: { name: true } } },
  });
  if (!quote || quote.status === "DRAFT") throw new NotFoundError("No encontramos esta propuesta.");
  if (quote.status === "REJECTED") return; // idempotente
  if (quote.status !== "SENT") throw new ConflictError("Esta propuesta ya no admite cambios.");
  if (isQuoteExpired(quote.validUntil, now)) throw new ConflictError("Esta propuesta ya expiró.");
  assertTransition("SENT", "REJECTED", "Esta propuesta ya no admite cambios.");
  const reason = emptyToNull(opts.reason)?.slice(0, 500) ?? null;

  await prisma.$transaction(async (tx) => {
    const res = await tx.quote.updateMany({
      where: { id: quote.id, status: "SENT" },
      data: { status: "REJECTED", rejectedAt: now, rejectionReason: reason },
    });
    if (res.count !== 1) throw new ConflictError("Esta propuesta ya no admite cambios.");
    if (quote.leadId) {
      await tx.leadActivity.create({
        data: {
          leadId: quote.leadId,
          type: "SYSTEM",
          message: `La clienta rechazó la propuesta ${quote.code}${reason ? `: “${reason}”` : "."}`,
        },
      });
    }
    await audit(
      {
        action: "quote.rejected",
        entityType: "Quote",
        entityId: quote.id,
        before: { status: "SENT" },
        after: { status: "REJECTED", reason },
        ip: opts.ip ?? null,
      },
      tx,
    );
  });

  try {
    const notifications = await getSettings("notifications");
    await notify({
      type: "GENERIC",
      channel: "EMAIL",
      to: notifications.ownerNotificationEmail,
      quoteId: quote.id,
      leadId: quote.leadId,
      data: {
        eventTitle: `Propuesta ${quote.code} rechazada`,
        message: `${quote.customer.name} rechazó la propuesta “${quote.title}”.${reason ? ` Motivo: ${reason}` : ""}`,
      },
    });
  } catch (error) {
    logger.warn("quotes.reject_owner_notify_failed", { error });
  }
}
