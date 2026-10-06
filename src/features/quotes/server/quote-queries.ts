import "server-only";
import type { Occasion, Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/db";
import { isPlausibleToken } from "@/lib/tokens";
import { localTime, toDateKey } from "@/lib/dates";
import { phoneSearchDigits } from "@/lib/phone";
import { getSettings } from "@/features/settings/server/settings-service";
import type { QuoteListFilters } from "../schemas";

export const QUOTES_PAGE_SIZE = 20;

// -----------------------------------------------------------------------------
// Listado
// -----------------------------------------------------------------------------
export async function listQuotes(filters: QuoteListFilters, now: Date = new Date()) {
  const page = filters.page ?? 1;
  const where: Prisma.QuoteWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.expiring === "1") {
    where.status = "SENT";
    where.validUntil = { gte: now, lte: new Date(now.getTime() + 48 * 3_600_000) };
  }
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q.replace(/[^\d+]/g, "") || q } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * QUOTES_PAGE_SIZE,
      take: QUOTES_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        version: true,
        status: true,
        title: true,
        eventDate: true,
        startTime: true,
        guestCount: true,
        totalCents: true,
        estimatedMarginCents: true,
        marginBps: true,
        validUntil: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        experience: { select: { name: true } },
      },
    }),
    prisma.quote.count({ where }),
  ]);
  return { rows, total, page, pageSize: QUOTES_PAGE_SIZE };
}
export type QuoteListRow = Awaited<ReturnType<typeof listQuotes>>["rows"][number];

export async function getQuoteStats(now: Date = new Date()) {
  const [byStatus, expiring, acceptedRecent] = await Promise.all([
    prisma.quote.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.quote.count({
      where: { status: "SENT", validUntil: { gte: now, lte: new Date(now.getTime() + 48 * 3_600_000) } },
    }),
    prisma.quote.aggregate({
      where: { status: "ACCEPTED", acceptedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
  ]);
  const count = (s: QuoteStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    draft: count("DRAFT"),
    sent: count("SENT"),
    accepted: count("ACCEPTED"),
    expiring,
    acceptedLast30: acceptedRecent._count._all,
    acceptedLast30Cents: acceptedRecent._sum.totalCents ?? 0,
  };
}

// -----------------------------------------------------------------------------
// Detalle admin
// -----------------------------------------------------------------------------
export async function getQuoteForAdmin(id: string) {
  if (!id || id.length > 64) return null;
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      lead: { select: { id: true, code: true, status: true, honoreeName: true, name: true } },
      experience: {
        select: {
          id: true,
          name: true,
          baseGuests: true,
          minGuests: true,
          maxGuests: true,
          durationMinutes: true,
          coverImageUrl: true,
          active: true,
        },
      },
      menu: { select: { id: true, name: true, pricingType: true } },
      style: { select: { id: true, name: true } },
      serviceArea: { select: { id: true, name: true } },
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      createdBy: { select: { name: true, email: true } },
      booking: {
        select: {
          id: true,
          code: true,
          depositRequiredCents: true,
          totalCents: true,
          acceptedByName: true,
          termsAcceptedAt: true,
          balanceDueAt: true,
          cancelledAt: true,
          payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
        },
      },
      event: { select: { id: true, code: true, status: true, portalToken: true, micrositeSlug: true } },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, type: true, channel: true, status: true, to: true, createdAt: true },
      },
    },
  });
}
export type AdminQuote = NonNullable<Awaited<ReturnType<typeof getQuoteForAdmin>>>;

export async function getQuoteHistory(quoteId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "Quote", entityId: quoteId },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, action: true, actorEmail: true, createdAt: true, before: true, after: true },
  });
}

// -----------------------------------------------------------------------------
// Opciones de formulario (catálogo completo para admin, con costos)
// -----------------------------------------------------------------------------
export async function getQuoteFormOptions() {
  const [experiences, menus, addOns, styles, serviceAreas, pricing] = await Promise.all([
    prisma.experience.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        basePriceCents: true,
        baseGuests: true,
        minGuests: true,
        maxGuests: true,
        menus: { select: { id: true } },
        addOns: { select: { id: true } },
        styles: { select: { id: true } },
        serviceAreas: { select: { id: true } },
      },
    }),
    prisma.menu.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true, pricingType: true, priceCents: true },
    }),
    prisma.addOn.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        pricingType: true,
        priceCents: true,
        costCents: true,
        maxQuantity: true,
        category: true,
      },
    }),
    prisma.style.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }], select: { id: true, name: true, active: true } }),
    prisma.serviceArea.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, active: true, logisticsFeeCents: true },
    }),
    getSettings("pricing"),
  ]);
  return {
    experiences: experiences.map((e) => ({
      id: e.id,
      name: e.name,
      active: e.active,
      basePriceCents: e.basePriceCents,
      baseGuests: e.baseGuests,
      minGuests: e.minGuests,
      maxGuests: e.maxGuests,
      menuIds: e.menus.map((m) => m.id),
      addOnIds: e.addOns.map((a) => a.id),
      styleIds: e.styles.map((s) => s.id),
      serviceAreaIds: e.serviceAreas.map((s) => s.id),
    })),
    menus,
    addOns,
    styles,
    serviceAreas,
    pricing: {
      depositBps: pricing.depositBps,
      minMarginBps: pricing.minMarginBps,
      quoteValidityDays: pricing.quoteValidityDays,
      maxStandardGuests: pricing.maxStandardGuests,
    },
  };
}
export type QuoteFormOptions = Awaited<ReturnType<typeof getQuoteFormOptions>>;

// -----------------------------------------------------------------------------
// Prefill desde lead (+ ConfigurationSnapshot)
// -----------------------------------------------------------------------------
export type LeadPrefill = {
  leadId: string;
  leadCode: string;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  contact: { name: string; email: string | null; phone: string | null };
  occasion: Occasion;
  honoreeName: string | null;
  eventDate: string;
  startTime: string;
  guestCount: number | null;
  serviceAreaId: string | null;
  experienceId: string | null;
  styleId: string | null;
  menuId: string | null;
  addOns: Array<{ addOnId: string; quantity: number }>;
  notes: string | null;
};

type SnapshotAddOn = { addOnId?: unknown; id?: unknown; slug?: unknown; quantity?: unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getLeadPrefill(leadId: string): Promise<LeadPrefill | null> {
  if (!leadId || leadId.length > 64) return null;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      snapshot: { select: { data: true } },
    },
  });
  if (!lead) return null;
  const data = asRecord(lead.snapshot?.data);

  // Add-ons del snapshot: aceptamos { addOnId | id | slug, quantity }
  const rawAddOns = Array.isArray(data.addOns) ? (data.addOns as SnapshotAddOn[]) : [];
  const ids = rawAddOns.map((a) => asString(a.addOnId) ?? asString(a.id)).filter((x): x is string => !!x);
  const slugs = rawAddOns.map((a) => asString(a.slug)).filter((x): x is string => !!x);
  const addOnRows =
    ids.length || slugs.length
      ? await prisma.addOn.findMany({
          where: { OR: [{ id: { in: ids } }, { slug: { in: slugs } }] },
          select: { id: true, slug: true },
        })
      : [];
  const addOns: LeadPrefill["addOns"] = [];
  for (const a of rawAddOns) {
    const key = asString(a.addOnId) ?? asString(a.id);
    const slug = asString(a.slug);
    const row = addOnRows.find((r) => (key && r.id === key) || (slug && r.slug === slug));
    const qty = typeof a.quantity === "number" && Number.isInteger(a.quantity) && a.quantity > 0 ? a.quantity : 1;
    if (row && !addOns.some((x) => x.addOnId === row.id)) addOns.push({ addOnId: row.id, quantity: Math.min(qty, 50) });
  }

  // Fallbacks por slug cuando el lead no guardó ids
  const slugLookup = async <T extends { id: string }>(
    current: string | null,
    slug: string | null,
    find: (slug: string) => Promise<T | null>,
  ) => current ?? (slug ? ((await find(slug))?.id ?? null) : null);
  const experienceId = await slugLookup(lead.experienceId, asString(data.experienceSlug), (slug) =>
    prisma.experience.findUnique({ where: { slug }, select: { id: true } }),
  );
  const styleId = await slugLookup(lead.styleId, asString(data.styleSlug), (slug) =>
    prisma.style.findUnique({ where: { slug }, select: { id: true } }),
  );
  const menuId = await slugLookup(lead.menuId, asString(data.menuSlug), (slug) =>
    prisma.menu.findUnique({ where: { slug }, select: { id: true } }),
  );
  const serviceAreaId = await slugLookup(lead.serviceAreaId, asString(data.serviceAreaSlug), (slug) =>
    prisma.serviceArea.findUnique({ where: { slug }, select: { id: true } }),
  );
  const startTime = asString(data.startTime);
  return {
    leadId: lead.id,
    leadCode: lead.code,
    customer: lead.customer,
    contact: { name: lead.name, email: lead.email, phone: lead.phone },
    occasion: lead.occasion,
    honoreeName: lead.honoreeName ?? asString(data.honoreeName),
    eventDate: lead.eventDate ? toDateKey(lead.eventDate) : "",
    startTime: startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ? startTime : "",
    guestCount: lead.guestCount,
    serviceAreaId,
    experienceId,
    styleId,
    menuId,
    addOns,
    notes: lead.notes,
  };
}

// -----------------------------------------------------------------------------
// Buscador de clientas
// -----------------------------------------------------------------------------
export async function searchCustomers(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = phoneSearchDigits(term);
  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, name: true, email: true, phone: true },
  });
}
export type CustomerOption = Awaited<ReturnType<typeof searchCustomers>>[number];

// -----------------------------------------------------------------------------
// Vista pública por token (SIN costos ni márgenes)
// -----------------------------------------------------------------------------
export async function findQuoteByToken(token: string) {
  if (!isPlausibleToken(token)) return null;
  return prisma.quote.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      code: true,
      version: true,
      status: true,
      title: true,
      occasion: true,
      eventDate: true,
      startTime: true,
      guestCount: true,
      subtotalCents: true,
      discountType: true,
      discountValue: true,
      discountCents: true,
      taxCents: true,
      totalCents: true,
      depositBps: true,
      depositCents: true,
      notesForCustomer: true,
      validUntil: true,
      sentAt: true,
      viewedAt: true,
      acceptedAt: true,
      rejectedAt: true,
      expiredAt: true,
      leadId: true,
      experienceId: true,
      customer: { select: { name: true } },
      experience: { select: { name: true, tagline: true, coverImageUrl: true, durationMinutes: true, includes: true } },
      menu: { select: { name: true } },
      style: { select: { name: true } },
      serviceArea: { select: { name: true } },
      items: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, type: true, description: true, quantity: true, unitPriceCents: true, totalPriceCents: true },
      },
      booking: {
        select: {
          acceptedByName: true,
          depositRequiredCents: true,
          totalCents: true,
          cancelledAt: true,
          balanceDueAt: true,
          payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
        },
      },
      event: { select: { portalToken: true, status: true, startsAt: true } },
    },
  });
}
export type PublicQuoteRecord = NonNullable<Awaited<ReturnType<typeof findQuoteByToken>>>;

/** Hora local de inicio para mostrar (evento creado o la propuesta) */
export function displayStartTime(q: Pick<PublicQuoteRecord, "startTime" | "event">): string | null {
  if (q.event?.startsAt) return localTime(q.event.startsAt);
  return q.startTime ?? null;
}
