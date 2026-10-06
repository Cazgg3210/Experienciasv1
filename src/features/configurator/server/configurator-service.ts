import "server-only";
import type { Occasion } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/db";
import { ValidationError } from "@/lib/errors";
import { localDateKey } from "@/lib/dates";
import { OCCASION_LABELS } from "@/lib/labels";
import { estimateSelection, publicEstimate } from "@/features/quotes/server/pricing";
import type { QuoteResult } from "@/features/quotes/domain/quote-engine";
import { checkAvailability, getRangeAvailability } from "@/features/bookings/server/availability-service";
import { AVAILABILITY_STATUS_LABELS, type AvailabilityStatus } from "@/features/bookings/domain/availability";
import { createInboundLead } from "@/features/leads/server/lead-intake";
import { getSettings } from "@/features/settings/server/settings-service";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import type { SessionUser } from "@/server/auth/session";
import {
  availabilityQuerySchema,
  estimateSelectionSchema,
  submitConfiguratorSchema,
  type AvailabilityQueryInput,
  type EstimateSelectionInput,
} from "../schemas";
import { diffDaysKey } from "../domain/calendar";
import { firstName, normalizeMxPhone10 } from "../domain/wizard";
import type { CalendarDay, ConfiguratorEstimate } from "../types";

function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Revisa los datos marcados.", zodFieldErrors(parsed.error));
  return parsed.data;
}

/** Une add-ons repetidos (toma la mayor cantidad). */
function dedupeAddOns(list: Array<{ addOnId: string; quantity: number }>) {
  const map = new Map<string, number>();
  for (const a of list) map.set(a.addOnId, Math.max(map.get(a.addOnId) ?? 0, a.quantity));
  return [...map.entries()].map(([addOnId, quantity]) => ({ addOnId, quantity }));
}

// -----------------------------------------------------------------------------
// Estimado público (se recalcula SIEMPRE en servidor)
// -----------------------------------------------------------------------------

export async function estimateConfiguration(input: EstimateSelectionInput): Promise<ConfiguratorEstimate> {
  const sel = parseOrThrow(estimateSelectionSchema, input);
  const { result } = await estimateSelection(
    {
      experienceId: sel.experienceId,
      guestCount: sel.guestCount,
      menuId: sel.menuId ?? null,
      addOns: dedupeAddOns(sel.addOns),
      serviceAreaId: sel.serviceAreaId ?? null,
    },
    { publicOnly: true },
  );
  return publicEstimate(result);
}

// -----------------------------------------------------------------------------
// Calendario de disponibilidad (público: sólo estado por día)
// -----------------------------------------------------------------------------

export async function getConfiguratorAvailability(input: AvailabilityQueryInput): Promise<CalendarDay[]> {
  const q = parseOrThrow(availabilityQuerySchema, input);
  const days = await getRangeAvailability(q.from, q.days, q.serviceAreaId ?? null);
  return days.map((d) => ({
    date: d.date,
    status: d.status,
    acceptsRequests: d.acceptsRequests,
    remaining: d.remaining,
  }));
}

// -----------------------------------------------------------------------------
// Envío final → Lead + ConfigurationSnapshot
// -----------------------------------------------------------------------------

export type SubmitConfiguratorResult = {
  leadId: string;
  code: string;
  customerId: string;
  firstName: string;
  whatsappUrl: string;
  outOfArea: boolean;
  specialRequest: boolean;
  availabilityStatus: AvailabilityStatus;
  totalCents: number;
  estimate: QuoteResult;
  /** true si el envío ya se había registrado (reintento con el mismo submissionId) */
  duplicate: boolean;
};

const UNAVAILABLE_MESSAGES: Partial<Record<AvailabilityStatus, string>> = {
  PAST: "Esa fecha ya pasó. Elige otra fecha, por favor.",
  CLOSED: "Ese día no tenemos servicio. ¿Te late elegir otra fecha?",
  BLOCKED: "Esa fecha no está disponible. ¿Te late elegir otra?",
};

/** Ventana en la que un reintento con el mismo submissionId devuelve el lead ya creado. */
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function buildWhatsappUrl(name: string, code: string): Promise<string> {
  const business = await getSettings("business");
  return whatsappLink(
    business.whatsappNumber,
    `Hola, soy ${name}. Acabo de armar mi experiencia en la web (folio ${code}) y me encantaría confirmar disponibilidad.`,
  );
}

/**
 * Idempotencia: si el mismo envío (submissionId + teléfono) ya creó un lead en las últimas 24 h,
 * devuelve ese resultado en lugar de duplicar lead, clienta y notificaciones.
 */
async function findPriorSubmission(
  submissionId: string,
  phone: string,
): Promise<SubmitConfiguratorResult | null> {
  const snap = await prisma.configurationSnapshot.findFirst({
    where: {
      createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
      data: { path: ["meta", "submissionId"], equals: submissionId },
      lead: { source: "CONFIGURATOR", phone },
    },
    select: {
      data: true,
      estimate: true,
      lead: {
        select: {
          id: true,
          code: true,
          name: true,
          customerId: true,
          outOfArea: true,
          specialRequest: true,
          estimatedTotalCents: true,
        },
      },
    },
  });
  if (!snap) return null;
  const meta = (snap.data as { meta?: { availability?: { status?: AvailabilityStatus } } } | null)?.meta;
  const estimate = snap.estimate as unknown as QuoteResult;
  const name = firstName(snap.lead.name);
  return {
    leadId: snap.lead.id,
    code: snap.lead.code,
    customerId: snap.lead.customerId ?? "",
    firstName: name,
    whatsappUrl: await buildWhatsappUrl(name, snap.lead.code),
    outOfArea: snap.lead.outOfArea,
    specialRequest: snap.lead.specialRequest,
    availabilityStatus: meta?.availability?.status ?? "AVAILABLE",
    totalCents: snap.lead.estimatedTotalCents ?? estimate?.totalCents ?? 0,
    estimate,
    duplicate: true,
  };
}

/**
 * Revalida todo en servidor (catálogo, compatibilidad, disponibilidad), RECALCULA el estimado
 * (ignorando cualquier precio enviado por el cliente) y crea el lead con su snapshot.
 */
export async function submitConfigurator(
  input: unknown,
  ctx: { actor?: SessionUser | null } = {},
): Promise<SubmitConfiguratorResult> {
  const data = parseOrThrow(submitConfiguratorSchema, input);
  const phone10 = normalizeMxPhone10(data.phone);
  if (!phone10)
    throw new ValidationError("Revisa los datos marcados.", { phone: ["Escribe un número de 10 dígitos."] });
  const phone = `+52${phone10}`;

  if (data.submissionId) {
    const prior = await findPriorSubmission(data.submissionId, phone);
    if (prior) return prior;
  }

  const [experience, style, activeStyles, area, budget, pricing] = await Promise.all([
    prisma.experience.findUnique({
      where: { id: data.experienceId },
      select: {
        id: true,
        name: true,
        active: true,
        maxGuests: true,
        durationMinutes: true,
        menus: { where: { active: true }, select: { id: true, name: true } },
        addOns: {
          where: { active: true },
          select: { id: true, name: true, maxQuantity: true, leadTimeDays: true },
        },
      },
    }),
    data.styleId
      ? prisma.style.findUnique({
          where: { id: data.styleId },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(null),
    data.styleId ? Promise.resolve(0) : prisma.style.count({ where: { active: true } }),
    data.serviceAreaId
      ? prisma.serviceArea.findUnique({
          where: { id: data.serviceAreaId },
          select: { id: true, name: true, active: true },
        })
      : Promise.resolve(null),
    data.budgetRangeId
      ? prisma.budgetRange.findUnique({
          where: { id: data.budgetRangeId },
          select: { id: true, label: true, active: true },
        })
      : Promise.resolve(null),
    getSettings("pricing"),
  ]);

  const fieldErrors: Record<string, string[]> = {};
  const fail = (field: string, message: string) => (fieldErrors[field] ??= []).push(message);

  if (!experience || !experience.active)
    fail("experienceId", "Esa experiencia ya no está disponible. Elige otra, por favor.");
  if (data.styleId) {
    if (!style || !style.active) fail("styleId", "Ese estilo ya no está disponible. Elige otro, por favor.");
  } else if (activeStyles > 0) {
    fail("styleId", "Elige el estilo que más te guste.");
  }
  if (data.serviceAreaId && !area)
    fail("serviceAreaId", "No encontramos esa zona. Elígela de nuevo, por favor.");
  if (data.budgetRangeId && (!budget || !budget.active))
    fail("budgetRangeId", "Elige un rango de presupuesto vigente.");

  let menu: { id: string; name: string } | null = null;
  const addOns: Array<{ addOnId: string; quantity: number; name: string; leadTimeDays: number }> = [];
  if (experience && experience.active) {
    if (data.menuId) {
      menu = experience.menus.find((m) => m.id === data.menuId) ?? null;
      if (!menu) fail("menuId", "Ese menú no es compatible con la experiencia elegida.");
    } else if (experience.menus.length > 0) {
      fail("menuId", "Elige un menú para tu experiencia.");
    }
    for (const a of dedupeAddOns(data.addOns)) {
      const row = experience.addOns.find((x) => x.id === a.addOnId);
      if (!row) {
        fail("addOns", "Uno de los extras no está disponible para esta experiencia.");
        continue;
      }
      addOns.push({
        addOnId: row.id,
        quantity: Math.min(a.quantity, Math.max(1, row.maxQuantity)),
        name: row.name,
        leadTimeDays: row.leadTimeDays,
      });
    }
  }

  const firstError = Object.values(fieldErrors)[0]?.[0];
  if (firstError || !experience) {
    throw new ValidationError(firstError ?? "Revisa los datos marcados.", fieldErrors);
  }
  const chosenStyle = style?.active ? style : null;

  // Zona: activa => logística; inactiva ("Próximamente") u "otra zona" => fuera de cobertura
  const activeAreaId = area?.active ? area.id : null;
  const zoneText = area
    ? area.active
      ? null
      : data.zoneText?.trim() || area.name
    : data.zoneText?.trim() || null;

  // Disponibilidad al momento de enviar: el día (capacidad/cierres) y el horario pedido por separado,
  // para que un horario fuera de rango no oculte que el día ya está lleno.
  const [day, slot] = await Promise.all([
    checkAvailability({ date: data.eventDate, serviceAreaId: activeAreaId }),
    checkAvailability({
      date: data.eventDate,
      serviceAreaId: activeAreaId,
      startTime: data.startTime,
      durationMinutes: experience.durationMinutes,
    }),
  ]);
  if (!day.acceptsRequests || !slot.acceptsRequests) {
    const blocking = day.acceptsRequests ? slot : day;
    const message = UNAVAILABLE_MESSAGES[blocking.status] ?? blocking.reason;
    throw new ValidationError(message, { eventDate: [message] });
  }
  const full = day.status === "FULL" || slot.status === "FULL";
  const availability = day.status === "FULL" ? day : slot;

  // Estimado recalculado en servidor (el precio del cliente se ignora)
  const { result } = await estimateSelection(
    {
      experienceId: experience.id,
      guestCount: data.guestCount,
      menuId: menu?.id ?? null,
      addOns: addOns.map(({ addOnId, quantity }) => ({ addOnId, quantity })),
      serviceAreaId: activeAreaId,
    },
    { publicOnly: true },
  );

  // Notas internas para el equipo
  const system: string[] = [`Hora de inicio preferida: ${data.startTime}.`];
  if (full) {
    system.push(`Fecha llena — ofrecer alternativa (${availability.reason.replace(/\.$/, "")}).`);
  }
  if (slot.status !== "FULL" && !slot.available) {
    system.push(
      `Disponibilidad al enviar: ${AVAILABILITY_STATUS_LABELS[slot.status]} — ${slot.reason} (sujeto a confirmación).`,
    );
  }
  if (data.guestCount > pricing.maxStandardGuests) {
    system.push(
      `Consulta especial: ${data.guestCount} personas (estándar hasta ${pricing.maxStandardGuests}).`,
    );
  } else if (data.guestCount > experience.maxGuests) {
    system.push(`Grupo mayor al máximo de la experiencia (${experience.maxGuests}).`);
  }
  if (!chosenStyle) system.push("Sin estilo elegido (no había estilos activos).");
  const leadDays = diffDaysKey(localDateKey(), data.eventDate);
  for (const a of addOns) {
    if (a.leadTimeDays > 0 && leadDays < a.leadTimeDays) {
      system.push(
        `"${a.name}" requiere ${a.leadTimeDays} días de anticipación (faltan ${Math.max(0, leadDays)}).`,
      );
    }
  }
  const notes = [data.notes?.trim(), `— Configurador —\n${system.join("\n")}`].filter(Boolean).join("\n\n");
  const budgetNotes = data.budgetUndecided ? "Prefiere platicar el presupuesto." : null;

  /**
   * Snapshot: campos PLANOS (contrato con el admin de leads `parseSnapshotData` y con el
   * prellenado de cotizaciones `getLeadPrefill`: addOns [{ addOnId, quantity }], startTime, ids…)
   * + metadatos anidados en `meta` (no se listan como campos sueltos en el admin).
   */
  const snapshotData = {
    occasion: data.occasion,
    occasionOther: data.occasion === "OTHER" ? data.occasionOther : null,
    honoreeName: data.honoreeName || null,
    guestCount: data.guestCount,
    eventDate: data.eventDate,
    startTime: data.startTime,
    colors: data.colors,
    inspiration: data.inspiration || null,
    notes: data.notes || null,
    zoneText,
    budgetNotes,
    experienceId: experience.id,
    styleId: chosenStyle?.id ?? null,
    menuId: menu?.id ?? null,
    serviceAreaId: data.serviceAreaId ?? null,
    addOns: addOns.map(({ addOnId, quantity }) => ({ addOnId, quantity })),
    budgetRangeId: budget?.id ?? null,
    sessionId: data.sessionId ?? null,
    marketingOptIn: data.marketingOptIn,
    meta: {
      version: 2,
      source: "CONFIGURATOR",
      submissionId: data.submissionId ?? null,
      budgetUndecided: data.budgetUndecided,
      labels: {
        occasion: OCCASION_LABELS[data.occasion as Occasion],
        experience: experience.name,
        style: chosenStyle?.name ?? null,
        menu: menu?.name ?? null,
        serviceArea: area?.name ?? null,
        budgetRange: budget?.label ?? null,
        addOns: addOns.map(({ name, quantity }) => ({ name, quantity })),
      },
      availability: {
        status: availability.status,
        reason: availability.reason,
        slotStatus: slot.status,
        checkedAt: new Date().toISOString(),
      },
      clientEstimateCentsIgnored: data.estimatedTotalCents ?? null,
    },
  };

  const lead = await createInboundLead(
    {
      name: data.name,
      email: data.email || null,
      phone,
      occasion: data.occasion as Occasion,
      occasionOther: data.occasion === "OTHER" ? data.occasionOther : null,
      eventDate: data.eventDate,
      guestCount: data.guestCount,
      serviceAreaId: area?.id ?? null,
      zoneText,
      experienceId: experience.id,
      styleId: chosenStyle?.id ?? null,
      menuId: menu?.id ?? null,
      budgetRangeId: budget?.id ?? null,
      budgetNotes,
      honoreeName: data.honoreeName || null,
      colors: data.colors,
      inspiration: data.inspiration || null,
      notes,
      source: "CONFIGURATOR",
      referredByCode: data.referredByCode || null,
      utmSource: data.utmSource || null,
      marketingOptIn: data.marketingOptIn,
      estimatedTotalCents: result.totalCents,
      snapshot: { data: snapshotData, estimate: result, pricingVersion: result.pricingVersion },
      sessionId: data.sessionId ?? null,
    },
    { actor: ctx.actor ?? null, channel: "public" },
  );

  const name = firstName(data.name);
  return {
    leadId: lead.leadId,
    code: lead.code,
    customerId: lead.customerId,
    firstName: name,
    whatsappUrl: await buildWhatsappUrl(name, lead.code),
    outOfArea: lead.outOfArea,
    specialRequest: lead.specialRequest,
    availabilityStatus: availability.status,
    totalCents: result.totalCents,
    estimate: result,
    duplicate: false,
  };
}
