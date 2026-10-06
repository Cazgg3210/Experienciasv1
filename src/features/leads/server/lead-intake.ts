import "server-only";
import type { LeadSource, Occasion, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { generateCode, generateReferralCode } from "@/lib/codes";
import { dateOnly, formatLongDate, isValidDateKey } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { track } from "@/server/analytics";
import { getSettings } from "@/features/settings/server/settings-service";
import { notify, notifyCustomer } from "@/features/notifications/server/notification-service";
import type { SessionUser } from "@/server/auth/session";
import { notifiesInboundLead, type LeadIntakeChannel } from "../domain/lead-workflow";

/**
 * Captura única de leads (configurador, diseñador IA, formulario de contacto, captura manual).
 * Encuentra o crea a la clienta, crea el lead con su timeline y snapshot, notifica y mide.
 */
export type InboundLeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  occasion: Occasion;
  occasionOther?: string | null;
  eventDate?: string | null; // YYYY-MM-DD
  guestCount?: number | null;
  serviceAreaId?: string | null;
  zoneText?: string | null;
  experienceId?: string | null;
  styleId?: string | null;
  menuId?: string | null;
  budgetRangeId?: string | null;
  budgetNotes?: string | null;
  honoreeName?: string | null;
  colors?: string[];
  inspiration?: string | null;
  notes?: string | null;
  source: LeadSource;
  referredByCode?: string | null;
  utmSource?: string | null;
  marketingOptIn?: boolean;
  estimatedTotalCents?: number | null;
  snapshot?: { data: unknown; estimate: unknown; pricingVersion: string } | null;
  assignedToId?: string | null;
  sessionId?: string | null;
};

export type InboundLeadResult = { leadId: string; code: string; customerId: string; outOfArea: boolean; specialRequest: boolean };

function normEmail(email?: string | null) {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

function normPhone(phone?: string | null) {
  const p = phone?.replace(/[^\d+]/g, "");
  return p ? p : null;
}

async function findOrCreateCustomer(
  tx: Prisma.TransactionClient,
  input: { name: string; email: string | null; phone: string | null; source: LeadSource; marketingOptIn?: boolean },
) {
  let customer = input.email ? await tx.customer.findUnique({ where: { email: input.email } }) : null;
  if (!customer && input.phone) customer = await tx.customer.findFirst({ where: { phone: input.phone } });
  if (customer) {
    return tx.customer.update({
      where: { id: customer.id },
      data: {
        phone: customer.phone ?? input.phone,
        whatsapp: customer.whatsapp ?? input.phone,
        email: customer.email ?? input.email,
        marketingOptIn: customer.marketingOptIn || !!input.marketingOptIn,
      },
    });
  }
  return tx.customer.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      whatsapp: input.phone,
      source: input.source,
      referralCode: generateReferralCode(input.name),
      marketingOptIn: !!input.marketingOptIn,
    },
  });
}

/**
 * `channel` es el canal por el que entró: "public" (lo envió la clienta desde el sitio) o "team" (lo
 * capturó el equipo en el panel). Decide los avisos de lead entrante; el origen comercial (`source`) no.
 */
export async function createInboundLead(
  input: InboundLeadInput,
  ctx: { actor?: SessionUser | null; channel: LeadIntakeChannel },
): Promise<InboundLeadResult> {
  const pricing = await getSettings("pricing");
  const email = normEmail(input.email);
  const phone = normPhone(input.phone);

  let outOfArea = false;
  if (input.serviceAreaId) {
    const area = await prisma.serviceArea.findUnique({ where: { id: input.serviceAreaId } });
    if (!area || !area.active) outOfArea = true;
  } else if (input.zoneText) {
    outOfArea = true;
  }
  const specialRequest = (input.guestCount ?? 0) > pricing.maxStandardGuests;
  const eventDate = input.eventDate && isValidDateKey(input.eventDate) ? dateOnly(input.eventDate) : null;
  const flags = [outOfArea ? "fuera de cobertura" : null, specialRequest ? "consulta especial (grupo grande)" : null]
    .filter(Boolean)
    .join(", ");

  const created = await prisma.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, {
      name: input.name.trim(),
      email,
      phone,
      source: input.source,
      marketingOptIn: input.marketingOptIn,
    });

    let lead: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 4 && !lead; attempt++) {
      try {
        lead = await tx.lead.create({
          data: {
            code: generateCode("L"),
            customerId: customer.id,
            name: input.name.trim(),
            email,
            phone,
            occasion: input.occasion,
            occasionOther: input.occasionOther ?? null,
            eventDate,
            guestCount: input.guestCount ?? null,
            serviceAreaId: outOfArea ? null : (input.serviceAreaId ?? null),
            zoneText: input.zoneText ?? null,
            outOfArea,
            specialRequest,
            experienceId: input.experienceId ?? null,
            styleId: input.styleId ?? null,
            menuId: input.menuId ?? null,
            budgetRangeId: input.budgetRangeId ?? null,
            budgetNotes: input.budgetNotes ?? null,
            honoreeName: input.honoreeName ?? null,
            colors: input.colors ?? [],
            inspiration: input.inspiration ?? null,
            notes: input.notes ?? null,
            source: input.source,
            referredByCode: input.referredByCode ?? null,
            utmSource: input.utmSource ?? null,
            estimatedTotalCents: input.estimatedTotalCents ?? null,
            assignedToId: input.assignedToId ?? null,
          },
          select: { id: true, code: true },
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "P2002" || attempt === 3) throw error;
      }
    }
    if (!lead) throw new Error("No se pudo generar el código del lead");

    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "CREATED",
        toStatus: "NEW",
        actorId: ctx.actor?.id ?? null,
        message: `Lead recibido vía ${input.source}${flags ? ` — ${flags}` : ""}.`,
      },
    });

    if (input.snapshot) {
      await tx.configurationSnapshot.create({
        data: {
          leadId: lead.id,
          data: input.snapshot.data as Prisma.InputJsonValue,
          estimate: input.snapshot.estimate as Prisma.InputJsonValue,
          pricingVersion: input.snapshot.pricingVersion,
        },
      });
    }
    return { lead, customer };
  });

  await track("SUBMIT_LEAD", {
    leadId: created.lead.id,
    experienceId: input.experienceId ?? null,
    sessionId: input.sessionId ?? null,
    metadata: { source: input.source, outOfArea, specialRequest },
  });

  // Notificaciones (no bloquean el flujo). Sólo en capturas públicas: si el equipo lo registró en el
  // panel, ni la clienta espera un «recibimos tu solicitud» ni la fundadora un aviso de su propio registro.
  try {
    if (notifiesInboundLead(ctx.channel)) {
      await notifyCustomer(
        { email, phone },
        {
          type: "LEAD_RECEIVED",
          leadId: created.lead.id,
          data: {
            name: input.name,
            eventDate: eventDate ? formatLongDate(eventDate) : undefined,
          },
          dedupeKey: `lead-received:${created.lead.id}`,
        },
      );
      const ns = await getSettings("notifications");
      await notify({
        type: "GENERIC",
        channel: "EMAIL",
        to: ns.ownerNotificationEmail,
        leadId: created.lead.id,
        data: {
          eventTitle: `Nuevo lead ${created.lead.code}`,
          message: `${input.name} pidió disponibilidad${eventDate ? ` para el ${formatLongDate(eventDate)}` : ""} (${input.guestCount ?? "?"} personas).${flags ? ` Atención: ${flags}.` : ""}`,
          url: appUrl(`/admin/leads/${created.lead.id}`),
        },
      });
    }
  } catch (error) {
    logger.warn("lead_intake.notify_failed", { error });
  }

  return {
    leadId: created.lead.id,
    code: created.lead.code,
    customerId: created.customer.id,
    outOfArea,
    specialRequest,
  };
}
