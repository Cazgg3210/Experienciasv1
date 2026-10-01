import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { ForbiddenError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { can } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { estimateSelection } from "@/features/quotes/server/pricing";
import {
  INTERNAL_WARNING_CODES,
  parseAiDesignOutput,
  parseSnapshotData,
  parseSnapshotEstimate,
  type CatalogRef,
  type SnapshotDataView,
} from "../domain/snapshot";

const detailInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true, referralCode: true } },
  experience: { select: { id: true, name: true, slug: true } },
  style: { select: { id: true, name: true } },
  menu: { select: { id: true, name: true } },
  serviceArea: { select: { id: true, name: true, active: true } },
  budgetRange: { select: { id: true, label: true } },
  assignedTo: { select: { id: true, name: true } },
  snapshot: true,
  aiDesigns: { orderBy: { createdAt: "desc" }, take: 3 },
  quotes: {
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, status: true, totalCents: true, version: true, createdAt: true, sentAt: true, title: true },
  },
  activities: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    include: { actor: { select: { id: true, name: true } } },
  },
} satisfies Prisma.LeadInclude;

export type LeadDetail = Prisma.LeadGetPayload<{ include: typeof detailInclude }>;

export async function getLeadDetail(actor: SessionUser, leadId: string): Promise<LeadDetail | null> {
  if (!can(actor.role, "leads:read")) throw new ForbiddenError();
  if (!/^[a-z0-9_-]{1,64}$/i.test(leadId)) return null;
  return prisma.lead.findUnique({ where: { id: leadId }, include: detailInclude });
}

/** Opciones de catálogo para formularios (incluye inactivas marcadas para no perder valores existentes). */
export async function getLeadFormOptions() {
  const [experiences, styles, menus, serviceAreas, budgetRanges] = await Promise.all([
    prisma.experience.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.style.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.menu.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.serviceArea.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.budgetRange.findMany({ select: { id: true, label: true, active: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }] }),
  ]);
  const opt = (rows: Array<{ id: string; name?: string; label?: string; active: boolean }>) =>
    rows.map((r) => ({ value: r.id, label: `${r.name ?? r.label ?? ""}${r.active ? "" : " (inactivo)"}`, active: r.active }));
  return {
    experiences: opt(experiences),
    styles: opt(styles),
    menus: opt(menus),
    serviceAreas: opt(serviceAreas),
    budgetRanges: opt(budgetRanges),
  };
}
export type LeadFormOptions = Awaited<ReturnType<typeof getLeadFormOptions>>;

type Named = { name: string } | null;

export type ResolvedSnapshot = {
  createdAt: Date;
  pricingVersion: string;
  data: SnapshotDataView;
  names: { experience: string | null; menu: string | null; style: string | null; serviceArea: string | null };
  addOns: Array<{ name: string; quantity: number }>;
  estimate: ReturnType<typeof parseSnapshotEstimate>;
  /** Costo/margen internos (sólo con financials:read). Del snapshot o recalculado con precios vigentes. */
  internal:
    | {
        source: "snapshot" | "recalculated";
        estimatedCostCents: number | null;
        estimatedMarginCents: number | null;
        marginBps: number | null;
        totalCents: number | null;
        belowMinMargin?: boolean;
        /** Avisos internos del motor (margen bajo, descuento topado…). */
        warnings: string[];
      }
    | null;
};

async function findByRef<T extends "experience" | "menu" | "style" | "serviceArea">(
  model: T,
  ref: CatalogRef | null,
): Promise<{ id: string; name: string } | null> {
  if (!ref) return null;
  const where = ref.id ? { id: ref.id } : { slug: ref.slug! };
  const select = { id: true, name: true } as const;
  switch (model) {
    case "experience":
      return prisma.experience.findFirst({ where, select });
    case "menu":
      return prisma.menu.findFirst({ where, select });
    case "style":
      return prisma.style.findFirst({ where, select });
    default:
      return prisma.serviceArea.findFirst({ where, select });
  }
}

/**
 * Interpreta el snapshot del configurador y resuelve nombres de catálogo.
 * Para fundadoras (financials:read) agrega costo/margen: si el snapshot no los guardó,
 * se recalculan en servidor con el motor de precios vigente (nunca en el cliente).
 */
export async function resolveLeadSnapshot(actor: SessionUser, lead: LeadDetail): Promise<ResolvedSnapshot | null> {
  const snap = lead.snapshot;
  if (!snap) return null;
  const canSeeFinancials = can(actor.role, "financials:read");
  const data = parseSnapshotData(snap.data);
  const parsedEstimate = parseSnapshotEstimate(snap.estimate);
  // Mínimo privilegio: sin financials:read no viajan costos, márgenes ni avisos internos.
  const estimate =
    parsedEstimate && !canSeeFinancials ? { ...parsedEstimate, internal: null, internalWarnings: [] } : parsedEstimate;

  const [experience, menu, style, serviceArea] = await Promise.all([
    findByRef("experience", data.experience),
    findByRef("menu", data.menu),
    findByRef("style", data.style),
    findByRef("serviceArea", data.serviceArea),
  ]);

  const addOnRows = data.addOns.length
    ? await prisma.addOn.findMany({
        where: {
          OR: [
            { id: { in: data.addOns.map((a) => a.id).filter((x): x is string => !!x) } },
            { slug: { in: data.addOns.map((a) => a.slug).filter((x): x is string => !!x) } },
          ],
        },
        select: { id: true, slug: true, name: true },
      })
    : [];
  const addOns = data.addOns.map((a) => {
    const row = addOnRows.find((r) => (a.id && r.id === a.id) || (a.slug && r.slug === a.slug));
    return { id: row?.id ?? null, name: row?.name ?? a.slug ?? a.id ?? "Extra", quantity: a.quantity };
  });

  let internal: ResolvedSnapshot["internal"] = null;
  if (canSeeFinancials) {
    if (estimate?.internal) {
      internal = { source: "snapshot", ...estimate.internal, totalCents: estimate.totalCents, warnings: estimate.internalWarnings };
    } else {
      const experienceId = experience?.id ?? lead.experienceId;
      const guestCount = data.guestCount ?? lead.guestCount;
      if (experienceId && guestCount && guestCount > 0) {
        try {
          const { result } = await estimateSelection(
            {
              experienceId,
              guestCount,
              menuId: menu?.id ?? lead.menuId ?? null,
              serviceAreaId: serviceArea?.id ?? lead.serviceAreaId ?? null,
              addOns: addOns.filter((a) => a.id).map((a) => ({ addOnId: a.id!, quantity: a.quantity })),
            },
            { publicOnly: false },
          );
          internal = {
            source: "recalculated",
            estimatedCostCents: result.estimatedCostCents,
            estimatedMarginCents: result.estimatedMarginCents,
            marginBps: result.marginBps,
            totalCents: result.totalCents,
            belowMinMargin: result.belowMinMargin,
            warnings: result.warnings.filter((w) => INTERNAL_WARNING_CODES.includes(w.code)).map((w) => w.message),
          };
        } catch (error) {
          logger.warn("leads.snapshot_internal_estimate_failed", { leadId: lead.id, error });
        }
      }
    }
  }

  const name = (x: Named) => x?.name ?? null;
  return {
    createdAt: snap.createdAt,
    pricingVersion: snap.pricingVersion,
    data,
    names: {
      experience: name(experience) ?? data.experience?.slug ?? null,
      menu: name(menu) ?? data.menu?.slug ?? null,
      style: name(style) ?? data.style?.slug ?? null,
      serviceArea: name(serviceArea) ?? data.serviceArea?.slug ?? null,
    },
    addOns: addOns.map(({ name: n, quantity }) => ({ name: n, quantity })),
    estimate,
    internal,
  };
}

export function resolveAiDesigns(lead: LeadDetail) {
  return lead.aiDesigns
    .map((d) => ({
      id: d.id,
      createdAt: d.createdAt,
      provider: d.provider,
      usedFallback: d.usedFallback,
      prompt: d.prompt,
      view: parseAiDesignOutput(d.output),
    }))
    .filter((d) => d.view != null);
}
