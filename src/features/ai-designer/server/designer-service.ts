import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/db";
import { localDateKey } from "@/lib/dates";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { ADDON_CATEGORY_LABELS, DIETARY_LABELS, OCCASION_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { track } from "@/server/analytics";
import type { SessionUser } from "@/server/auth/session";
import { getAIProvider } from "@/server/providers";
import type { AIProvider } from "@/server/providers/ai/types";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { createInboundLead } from "@/features/leads/server/lead-intake";
import { estimateSelection, publicEstimate, type PublicEstimate } from "@/features/quotes/server/pricing";
import type { QuoteResult } from "@/features/quotes/domain/quote-engine";
import { getSettings } from "@/features/settings/server/settings-service";
import { BUDGET_UNKNOWN, OTHER_AREA, PROMPT_VERSION, VIBE_LABELS } from "../constants";
import type { DesignerCatalog, DesignProposal, DesignSelection } from "../domain/types";
import { designerInputSchema, type ConvertDesignInput, type DesignerInput } from "../schemas";
import type { ConvertDesignResult, DesignView } from "../types";
import { loadDesignerCatalog } from "./catalog";
import { runDesigner, type DesignerRun } from "./designer-runner";

/** Antigüedad máxima de un diseño para convertirlo en solicitud. */
const DESIGN_MAX_AGE_DAYS = 30;

export type GenerateDesignOptions = {
  provider?: AIProvider;
  catalog?: DesignerCatalog;
  actor?: SessionUser | null;
  sessionId?: string | null;
  timeoutMs?: number;
};

/** Lo que se persiste en AiDesign.output */
type StoredOutput = {
  design: DesignProposal;
  view: Omit<DesignView, "id">;
  pricing: PublicEstimate;
  budget: { id: string | null; label: string | null; overBudget: boolean; suggestion: string | null };
  fallbackReason: string | null;
  dropped: string[];
};

const storedOutputSchema = z.object({
  design: z.object({
    name: z.string(),
    concept: z.string(),
    experienceId: z.string(),
    styleId: z.string().nullable(),
    menuId: z.string().nullable(),
    addOnIds: z.array(z.string()),
    activities: z.array(z.string()),
    palette: z.array(z.object({ name: z.string(), hex: z.string() })),
    tableDesign: z.string(),
    playlistVibe: z.string(),
  }),
  budget: z.object({ overBudget: z.boolean(), suggestion: z.string().nullable() }).partial().optional(),
});

function validateReferences(input: DesignerInput, catalog: DesignerCatalog) {
  const fieldErrors: Record<string, string[]> = {};
  if (input.budgetRangeId !== BUDGET_UNKNOWN && !catalog.budgets.some((b) => b.id === input.budgetRangeId)) {
    fieldErrors.budgetRangeId = ["Ese rango de presupuesto ya no está disponible. Elige otro."];
  }
  if (input.serviceArea !== OTHER_AREA && !catalog.areas.some((a) => a.id === input.serviceArea)) {
    fieldErrors.serviceArea = ["Esa zona ya no está disponible. Elige otra o «Otra zona»."];
  }
  if (Object.keys(fieldErrors).length) throw new ValidationError("Revisa los datos marcados.", fieldErrors);
}

/**
 * Cotiza la selección con el motor real (estimateSelection, catálogo público).
 * Si algún extra dejó de estar disponible, vuelve a intentar sin extras (y luego sin menú).
 */
async function priceSelection(
  sel: DesignSelection,
  input: Pick<DesignerInput, "guestCount" | "serviceArea">,
): Promise<{ result: QuoteResult; selection: DesignSelection }> {
  const serviceAreaId = input.serviceArea !== OTHER_AREA ? input.serviceArea : null;
  const attempts: DesignSelection[] = [sel];
  if (sel.addOnIds.length) attempts.push({ ...sel, addOnIds: [] });
  if (sel.menuId) attempts.push({ ...sel, menuId: null, addOnIds: [] });
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const { result } = await estimateSelection(
        {
          experienceId: attempt.experienceId,
          guestCount: input.guestCount,
          menuId: attempt.menuId,
          addOns: attempt.addOnIds.map((addOnId) => ({ addOnId, quantity: 1 })),
          serviceAreaId,
        },
        { publicOnly: true },
      );
      return { result, selection: attempt };
    } catch (error) {
      lastError = error;
      logger.warn("ai_designer.pricing_retry", { experienceId: attempt.experienceId, error });
    }
  }
  throw lastError;
}

/** Notas públicas del estimado sin redundancias (grupo grande = una sola nota). */
function estimateNotes(result: QuoteResult, pricing: PublicEstimate): string[] {
  const special = result.warnings.some((w) => w.code === "SPECIAL_REQUEST_GUESTS");
  const redundant = new Set(
    result.warnings.filter((w) => special && w.code === "GUESTS_ABOVE_EXPERIENCE_MAX").map((w) => w.message),
  );
  return [...new Set(pricing.warnings.filter((m) => !redundant.has(m)))];
}

function buildView(args: {
  input: DesignerInput;
  catalog: DesignerCatalog;
  design: DesignProposal;
  dietaryNote: string | null;
  pricing: PublicEstimate;
  depositBps: number;
  notes: string[];
  overBudget: boolean;
  suggestion: string | null;
}): Omit<DesignView, "id"> {
  const { input, catalog, design, pricing } = args;
  const experience = catalog.experiences.find((e) => e.id === design.experienceId)!;
  const style = design.styleId ? catalog.styles.find((s) => s.id === design.styleId) : null;
  const menu = design.menuId ? catalog.menus.find((m) => m.id === design.menuId) : null;
  const budget =
    input.budgetRangeId !== BUDGET_UNKNOWN
      ? (catalog.budgets.find((b) => b.id === input.budgetRangeId) ?? null)
      : null;
  // Porcentaje real del anticipo (bps del motor), no un redondeo de centavos.
  const depositPercent = Math.round(args.depositBps) / 100;
  return {
    name: design.name,
    concept: design.concept,
    description: design.description,
    palette: design.palette,
    activities: design.activities,
    tableDesign: design.tableDesign,
    playlistVibe: design.playlistVibe,
    occasion: input.occasion,
    occasionLabel:
      input.occasion === "OTHER" && input.occasionOther
        ? input.occasionOther
        : OCCASION_LABELS[input.occasion],
    guestCount: input.guestCount,
    experience: {
      id: experience.id,
      slug: experience.slug,
      name: experience.name,
      tagline: experience.tagline,
      href: `/experiencias/${experience.slug}`,
    },
    style: style ? { id: style.id, name: style.name } : null,
    menu: menu ? { id: menu.id, name: menu.name, description: menu.description } : null,
    dietaryNote: args.dietaryNote,
    addOns: design.addOnIds
      .map((id) => catalog.addOns.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        categoryLabel: ADDON_CATEGORY_LABELS[a.category],
      })),
    estimate: {
      totalCents: pricing.totalCents,
      depositCents: pricing.depositCents,
      depositPercent,
      taxIncluded: pricing.totalCents === pricing.subtotalCents - pricing.discountCents,
      subtotalCents: pricing.subtotalCents,
      discountCents: pricing.discountCents,
      taxCents: pricing.taxCents,
      lines: pricing.lines.map((l) => ({ description: l.description, totalPriceCents: l.totalPriceCents })),
      notes: args.notes,
      pricingVersion: pricing.pricingVersion,
    },
    budget: budget
      ? {
          label: budget.label,
          withinBudget: !args.overBudget,
          suggestion: args.overBudget ? args.suggestion : null,
        }
      : null,
    configuratorHref: `/crear-experiencia?experiencia=${encodeURIComponent(experience.slug)}&ocasion=${input.occasion}`,
  };
}

/**
 * Genera una propuesta (LLM con validación o motor de reglas), la cotiza con el motor real,
 * la persiste como AiDesign y registra AI_DESIGN_GENERATED.
 */
export async function generateDesign(
  input: DesignerInput,
  opts: GenerateDesignOptions = {},
): Promise<DesignView> {
  const catalog = opts.catalog ?? (await loadDesignerCatalog());
  if (catalog.experiences.length === 0) {
    throw new AppError(
      "Por ahora no tenemos experiencias disponibles para diseñar. Escríbenos y la armamos contigo.",
      "NO_CATALOG",
      503,
    );
  }
  validateReferences(input, catalog);

  const run: DesignerRun = await runDesigner({
    input,
    catalog,
    provider: opts.provider ?? getAIProvider(),
    timeoutMs: opts.timeoutMs,
  });

  const priced = await priceSelection(
    { experienceId: run.design.experienceId, menuId: run.design.menuId, addOnIds: run.design.addOnIds },
    input,
  );
  const design: DesignProposal = {
    ...run.design,
    menuId: priced.selection.menuId,
    addOnIds: priced.selection.addOnIds,
  };
  const pricing = publicEstimate(priced.result);
  const budget =
    input.budgetRangeId !== BUDGET_UNKNOWN
      ? (catalog.budgets.find((b) => b.id === input.budgetRangeId) ?? null)
      : null;
  const overBudget = budget?.maxCents != null && priced.result.totalCents > budget.maxCents;
  const suggestion = overBudget
    ? (run.fit.suggestion ??
      "Se pasa un poco de tu presupuesto: te sugerimos platicarlo con nosotras para ajustar detalles.")
    : null;

  const view = buildView({
    input,
    catalog,
    design,
    dietaryNote: run.dietaryNote,
    pricing,
    depositBps: priced.result.depositBps,
    notes: estimateNotes(priced.result, pricing),
    overBudget,
    suggestion,
  });
  const output: StoredOutput = {
    design,
    view,
    pricing,
    budget: { id: budget?.id ?? null, label: budget?.label ?? null, overBudget, suggestion },
    fallbackReason: run.fallbackReason,
    dropped: run.dropped,
  };

  const record = await prisma.aiDesign.create({
    data: {
      input: input as unknown as Prisma.InputJsonValue,
      output: output as unknown as Prisma.InputJsonValue,
      provider: run.provider,
      model: run.model,
      promptVersion: run.promptVersion || PROMPT_VERSION,
      prompt: run.prompt,
      usedFallback: run.usedFallback,
    },
    select: { id: true },
  });

  await track("AI_DESIGN_GENERATED", {
    experienceId: design.experienceId,
    path: "/crear-experiencia/ai",
    sessionId: opts.sessionId ?? null,
    metadata: {
      aiDesignId: record.id,
      provider: run.provider,
      usedFallback: run.usedFallback,
      fallbackReason: run.fallbackReason,
      overBudget,
      occasion: input.occasion,
      guestCount: input.guestCount,
    },
  });

  return { id: record.id, ...view };
}

// -----------------------------------------------------------------------------
// Conversión a lead
// -----------------------------------------------------------------------------

function buildLeadNotes(args: {
  designId: string;
  input: DesignerInput;
  design: z.infer<typeof storedOutputSchema>["design"];
  addOnNames: string[];
  budgetLabel: string | null;
  overBudget: boolean;
  suggestion: string | null;
}): string {
  const { input, design } = args;
  const lines = [
    `Propuesta del Diseñador IA: «${design.name}»`,
    `Concepto: ${design.concept}`,
    `Perfil: ${input.profile}${input.honoreeAge ? ` (${input.honoreeAge} años)` : ""}`,
    `Vibras: ${input.vibes.map((v) => VIBE_LABELS[v]).join(", ")}`,
    input.tastes ? `Gustos: ${input.tastes}` : null,
    input.dietary.length ? `Restricciones: ${input.dietary.map((d) => DIETARY_LABELS[d]).join(", ")}` : null,
    `Extras sugeridos: ${args.addOnNames.length ? args.addOnNames.join(", ") : "ninguno"}`,
    `Actividades: ${design.activities.join(" · ")}`,
    `Mesa: ${design.tableDesign}`,
    `Playlist: ${design.playlistVibe}`,
    `Paleta: ${design.palette.map((c) => `${c.name} (${c.hex})`).join(", ")}`,
    `Presupuesto: ${args.budgetLabel ?? "sin definir"}${args.overBudget ? ` — la propuesta se pasa del rango. ${args.suggestion ?? ""}` : ""}`,
    input.serviceArea === OTHER_AREA
      ? `Zona indicada: ${input.zoneText?.trim() || "otra zona (sin detalle)"}`
      : null,
    `Referencia de diseño: ${args.designId}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Conversiones en curso por diseño (doble clic / reintentos simultáneos en esta instancia). */
const conversionsInFlight = new Map<string, Promise<ConvertDesignResult>>();

/**
 * "Quiero esta experiencia": crea el lead (source AI_DESIGNER) con snapshot del diseño
 * y del estimado completo recalculado en servidor, y liga AiDesign.leadId.
 * Idempotente: si el diseño ya se convirtió (o se está convirtiendo), devuelve el folio existente.
 */
export async function convertDesignToLead(
  data: ConvertDesignInput,
  ctx: { actor?: SessionUser | null; sessionId?: string | null } = {},
): Promise<ConvertDesignResult> {
  const pending = conversionsInFlight.get(data.designId);
  if (pending) {
    try {
      return { ...(await pending), alreadySubmitted: true };
    } catch {
      // La primera falló: este intento sigue por su cuenta (vuelve a revisar el estado en DB).
    }
  }
  const attempt = convertDesignToLeadOnce(data, ctx);
  conversionsInFlight.set(data.designId, attempt);
  try {
    return await attempt;
  } finally {
    if (conversionsInFlight.get(data.designId) === attempt) conversionsInFlight.delete(data.designId);
  }
}

async function convertDesignToLeadOnce(
  data: ConvertDesignInput,
  ctx: { actor?: SessionUser | null; sessionId?: string | null },
): Promise<ConvertDesignResult> {
  const record = await prisma.aiDesign.findUnique({
    where: { id: data.designId },
    include: { lead: { select: { code: true } } },
  });
  if (!record) throw new NotFoundError("No encontramos ese diseño. Genera uno nuevo, por favor.");

  const business = await getSettings("business");
  const contactLink = (code: string, designName: string) =>
    whatsappLink(
      business.whatsappNumber,
      `Hola, soy ${data.name.trim()}. Acabo de diseñar «${designName}» en su sitio (folio ${code}). ¿Me ayudan a hacerla realidad?`,
    );

  const parsedOutput = storedOutputSchema.safeParse(record.output);
  const parsedInput = designerInputSchema.safeParse(record.input);
  if (!parsedOutput.success || !parsedInput.success) {
    logger.error("ai_designer.corrupt_design", { designId: record.id });
    throw new AppError(
      "No pudimos recuperar ese diseño. Genera uno nuevo, por favor.",
      "CORRUPT_DESIGN",
      422,
    );
  }
  const design = parsedOutput.data.design;
  const input = parsedInput.data;

  if (record.leadId && record.lead) {
    return {
      code: record.lead.code,
      whatsappUrl: contactLink(record.lead.code, design.name),
      alreadySubmitted: true,
    };
  }
  const ageDays = (Date.now() - record.createdAt.getTime()) / 86_400_000;
  if (ageDays > DESIGN_MAX_AGE_DAYS) {
    throw new AppError(
      "Este diseño ya expiró. Genera uno nuevo y con gusto lo cotizamos.",
      "DESIGN_EXPIRED",
      410,
    );
  }
  if (data.eventDate && data.eventDate < localDateKey()) {
    throw new ValidationError("Revisa los datos marcados.", {
      eventDate: ["Elige una fecha a partir de hoy."],
    });
  }

  // Referencias vigentes (el catálogo pudo cambiar desde que se generó el diseño).
  const [experience, style, menu, addOns, area, budget] = await Promise.all([
    prisma.experience.findFirst({ where: { id: design.experienceId, active: true }, select: { id: true } }),
    design.styleId ? prisma.style.findFirst({ where: { id: design.styleId }, select: { id: true } }) : null,
    design.menuId ? prisma.menu.findFirst({ where: { id: design.menuId }, select: { id: true } }) : null,
    prisma.addOn.findMany({ where: { id: { in: design.addOnIds } }, select: { id: true, name: true } }),
    input.serviceArea !== OTHER_AREA
      ? prisma.serviceArea.findFirst({ where: { id: input.serviceArea }, select: { id: true } })
      : null,
    input.budgetRangeId !== BUDGET_UNKNOWN
      ? prisma.budgetRange.findFirst({
          where: { id: input.budgetRangeId },
          select: { id: true, label: true, maxCents: true },
        })
      : null,
  ]);

  let estimate: QuoteResult | null = null;
  if (experience) {
    try {
      const priced = await priceSelection(
        {
          experienceId: experience.id,
          menuId: menu?.id ?? null,
          addOnIds: addOns.map((a) => a.id),
        },
        { guestCount: input.guestCount, serviceArea: area ? area.id : OTHER_AREA },
      );
      estimate = priced.result;
    } catch (error) {
      logger.warn("ai_designer.convert_pricing_failed", { designId: record.id, error });
    }
  }
  const overBudget = !!(estimate && budget?.maxCents != null && estimate.totalCents > budget.maxCents);
  const suggestion = parsedOutput.data.budget?.suggestion ?? null;

  const lead = await createInboundLead(
    {
      name: data.name,
      email: data.email || null,
      phone: data.phone,
      occasion: input.occasion,
      occasionOther: input.occasion === "OTHER" ? (input.occasionOther ?? null) : null,
      eventDate: data.eventDate || null,
      guestCount: input.guestCount,
      serviceAreaId: area?.id ?? null,
      zoneText: area ? null : input.zoneText?.trim() || "Otra zona (sin detalle)",
      experienceId: experience?.id ?? null,
      styleId: style?.id ?? null,
      menuId: menu?.id ?? null,
      budgetRangeId: budget?.id ?? null,
      budgetNotes: overBudget ? suggestion : null,
      colors: design.palette.map((c) => c.hex),
      inspiration: `${design.name} — ${design.concept}`,
      notes: buildLeadNotes({
        designId: record.id,
        input,
        design,
        addOnNames: addOns.map((a) => a.name),
        budgetLabel: budget?.label ?? null,
        overBudget,
        suggestion,
      }),
      source: "AI_DESIGNER",
      marketingOptIn: !!data.marketingOptIn,
      estimatedTotalCents: estimate?.totalCents ?? null,
      snapshot: {
        data: { design, input, aiDesignId: record.id, promptVersion: record.promptVersion },
        estimate: estimate ?? { unavailable: true },
        pricingVersion: estimate?.pricingVersion ?? "n/a",
      },
      sessionId: ctx.sessionId ?? null,
    },
    { actor: ctx.actor ?? null },
  );

  // Liga sólo si nadie lo ligó antes (pestañas paralelas u otra instancia del servidor).
  const linked = await prisma.aiDesign.updateMany({
    where: { id: record.id, leadId: null },
    data: { leadId: lead.leadId },
  });
  if (linked.count === 0) {
    const current = await prisma.aiDesign.findUnique({
      where: { id: record.id },
      select: { lead: { select: { id: true, code: true } } },
    });
    if (current?.lead && current.lead.id !== lead.leadId) {
      // Otra solicitud ganó la carrera: se responde con su folio y se deja rastro para fusionar el duplicado.
      logger.warn("ai_designer.duplicate_lead", {
        designId: record.id,
        keptLeadId: current.lead.id,
        duplicateLeadId: lead.leadId,
      });
      return {
        code: current.lead.code,
        whatsappUrl: contactLink(current.lead.code, design.name),
        alreadySubmitted: true,
      };
    }
  }

  return { code: lead.code, whatsappUrl: contactLink(lead.code, design.name), alreadySubmitted: false };
}
