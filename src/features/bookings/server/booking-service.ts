import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { generateCode } from "@/lib/codes";
import { formatLongDate, toDateKey, zonedDateTime } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { formatMXN } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { generateToken, isPlausibleToken } from "@/lib/tokens";
import { audit } from "@/server/audit";
import { track } from "@/server/analytics";
import { getSettings } from "@/features/settings/server/settings-service";
import { notify, notifyCustomer } from "@/features/notifications/server/notification-service";
import { leadStatusMachine, type LeadStatus } from "@/features/leads/domain/lead-status";
import { quoteStatusMachine, isQuoteExpired } from "@/features/quotes/domain/quote-status";
import { perGuestUnits, billableGuests, randomSlugSuffix } from "@/features/quotes/domain/quote-lines";
import type { AvailabilityResult } from "../domain/availability";
import { checkAvailability } from "./availability-service";

/**
 * Reserva: aceptar una cotización crea Booking + Event (PENDING_PAYMENT) en una sola transacción.
 * El evento ocupa capacidad del calendario desde ese momento (CAPACITY_STATUSES).
 */

type Tx = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

/** Estados de "política" (anticipación/horario) que la fundadora ya aceptó al enviar la propuesta. */
const SOFT_STATUSES: ReadonlyArray<AvailabilityResult["status"]> = ["TOO_SOON", "TOO_FAR", "OUT_OF_HOURS"];

/** ¿La fecha sigue reservable? Capacidad y bloqueos son duros; anticipación/horario no. */
export function isBookable(r: AvailabilityResult): boolean {
  if (r.available) return true;
  if (SOFT_STATUSES.includes(r.status)) return r.capacity > r.booked;
  return false;
}

export const UNAVAILABLE_MESSAGE = "La fecha ya no está disponible; te contactaremos para buscar alternativa";

async function uniqueValue(
  gen: () => string,
  exists: (v: string) => Promise<boolean>,
  label: string,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const v = gen();
    if (!(await exists(v))) return v;
  }
  throw new AppError(`No se pudo generar ${label}; intenta de nuevo.`);
}

function micrositeSlugBase(title: string): string {
  return (slugify(title) || "celebracion").slice(0, 60).replace(/-+$/g, "");
}

/** La clienta quiso aceptar pero la fecha ya no está libre: avisar al equipo (máx. 1 vez al día por propuesta). */
async function reportUnavailableDate(
  quote: { id: string; code: string; title: string; leadId: string | null; customer: { name: string } },
  dateKey: string,
) {
  try {
    if (quote.leadId) {
      await prisma.leadActivity.create({
        data: {
          leadId: quote.leadId,
          type: "SYSTEM",
          message: `La clienta intentó aceptar la propuesta ${quote.code}, pero el ${dateKey} ya no está disponible. Contactarla para proponer alternativa.`,
        },
      });
    }
    const notifications = await getSettings("notifications");
    await notify({
      type: "GENERIC",
      channel: "EMAIL",
      to: notifications.ownerNotificationEmail,
      quoteId: quote.id,
      leadId: quote.leadId,
      dedupeKey: `quote-unavailable:${quote.id}:${new Date().toISOString().slice(0, 10)}`,
      data: {
        eventTitle: `Fecha no disponible — ${quote.code}`,
        message: `${quote.customer.name} quiso aceptar “${quote.title}” pero el ${dateKey} ya no tiene disponibilidad. Contáctala para ofrecer otra fecha.`,
        url: appUrl(`/admin/quotes/${quote.id}`),
      },
    });
  } catch (error) {
    logger.warn("booking.unavailable_report_failed", { error });
  }
}

export type CreateBookingResult = { bookingId: string; eventId: string; portalToken: string };

export async function createBookingFromQuote(
  quoteToken: string,
  opts: {
    acceptedByName: string;
    ip?: string | null;
    now?: Date;
    /** Versión que la clienta tenía en pantalla: si el equipo la reemplazó, no aceptar montos que no vio. */
    expectedVersion?: number | null;
  },
): Promise<CreateBookingResult> {
  const now = opts.now ?? new Date();
  if (!isPlausibleToken(quoteToken)) throw new NotFoundError("No encontramos esta propuesta.");
  const quote = await prisma.quote.findUnique({
    where: { publicToken: quoteToken },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } },
      lead: { select: { id: true, status: true, honoreeName: true, colors: true, inspiration: true } },
      experience: { select: { id: true, durationMinutes: true, baseGuests: true } },
      items: { where: { type: "ADDON" }, select: { refId: true, quantity: true, totalPriceCents: true, totalCostCents: true } },
    },
  });
  if (!quote || quote.status === "DRAFT") throw new NotFoundError("No encontramos esta propuesta.");
  if (quote.status === "ACCEPTED") throw new ConflictError("Esta propuesta ya fue aceptada.");
  if (quote.status !== "SENT") throw new ConflictError("Esta propuesta ya no está disponible para aceptarse.");
  if (opts.expectedVersion != null && opts.expectedVersion !== quote.version) {
    throw new ConflictError("La propuesta se actualizó mientras la revisabas; recarga la página para ver la versión vigente.");
  }
  if (isQuoteExpired(quote.validUntil, now)) {
    await prisma.quote.updateMany({ where: { id: quote.id, status: "SENT" }, data: { status: "EXPIRED", expiredAt: now } });
    throw new ConflictError("Esta propuesta expiró. Escríbenos y con gusto la actualizamos.");
  }
  quoteStatusMachine.assert("SENT", "ACCEPTED");
  if (!quote.eventDate) {
    throw new AppError("La propuesta no tiene fecha de evento; escríbenos para confirmarla.");
  }

  const [business, pricing, availabilitySettings] = await Promise.all([
    getSettings("business"),
    getSettings("pricing"),
    getSettings("availability"),
  ]);
  const dateKey = toDateKey(quote.eventDate);
  const startTime = quote.startTime ?? availabilitySettings.defaultStartTime;
  const durationMinutes = quote.experience?.durationMinutes ?? 180;
  const startsAt = zonedDateTime(dateKey, startTime);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const balanceDueAt = new Date(startsAt.getTime() - pricing.balanceDueDaysBefore * DAY_MS);

  // Add-ons del evento (agrupados por add-on; la FK exige que existan en catálogo)
  const addOnIds = [...new Set(quote.items.map((i) => i.refId).filter((x): x is string => !!x))];
  const addOnRows = addOnIds.length
    ? await prisma.addOn.findMany({ where: { id: { in: addOnIds } }, select: { id: true, pricingType: true } })
    : [];
  const billable = billableGuests(quote.guestCount, quote.experience?.baseGuests ?? 1);
  const eventAddOns = new Map<string, { quantity: number; priceCents: number; costCents: number; notes: string | null }>();
  for (const item of quote.items) {
    const row = addOnRows.find((r) => r.id === item.refId);
    if (!row) continue;
    const perGuest = row.pricingType === "PER_GUEST";
    const units = perGuest ? perGuestUnits(item.quantity, billable) : item.quantity;
    const prev = eventAddOns.get(row.id);
    eventAddOns.set(row.id, {
      quantity: (prev?.quantity ?? 0) + units,
      priceCents: (prev?.priceCents ?? 0) + item.totalPriceCents,
      costCents: (prev?.costCents ?? 0) + item.totalCostCents,
      notes: perGuest ? `${billable} invitadas × precio por invitada` : null,
    });
  }

  const result = await prisma
    .$transaction(
    async (tx: Tx) => {
      // Serializa aceptaciones concurrentes para la misma fecha (evita double-booking)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`availability:${dateKey}`}))`;
      const availability = await checkAvailability({
        date: dateKey,
        serviceAreaId: quote.serviceAreaId,
        startTime,
        durationMinutes,
      });
      if (!isBookable(availability)) {
        logger.warn("booking.date_unavailable", { quoteId: quote.id, dateKey, status: availability.status });
        throw new AppError(UNAVAILABLE_MESSAGE, "DATE_UNAVAILABLE", 409);
      }

      // Guardia optimista: sólo una aceptación gana. La versión evita aceptar con montos viejos si,
      // mientras tanto, el equipo creó una nueva versión y la reenvió (vuelve a estar SENT).
      const guard = await tx.quote.updateMany({
        where: { id: quote.id, status: "SENT", version: quote.version },
        data: { status: "ACCEPTED", acceptedAt: now },
      });
      if (guard.count !== 1) {
        const current = await tx.quote.findUnique({ where: { id: quote.id }, select: { status: true } });
        throw new ConflictError(
          current?.status === "ACCEPTED"
            ? "Esta propuesta ya fue aceptada."
            : "La propuesta se actualizó mientras la revisabas; recarga la página para ver la versión vigente.",
        );
      }

      const eventCode = await uniqueValue(
        () => generateCode("EV", now),
        async (v) => !!(await tx.event.findUnique({ where: { code: v }, select: { id: true } })),
        "el código del evento",
      );
      const base = micrositeSlugBase(quote.title);
      const micrositeSlug = await uniqueValue(
        () => `${base}-${randomSlugSuffix(() => randomInt(0, 1_000_000) / 1_000_000)}`,
        async (v) => !!(await tx.event.findUnique({ where: { micrositeSlug: v }, select: { id: true } })),
        "el enlace del micrositio",
      );
      const bookingCode = await uniqueValue(
        () => generateCode("B", now),
        async (v) => !!(await tx.booking.findUnique({ where: { code: v }, select: { id: true } })),
        "el código de la reserva",
      );
      const portalToken = generateToken();

      const event = await tx.event.create({
        data: {
          code: eventCode,
          title: quote.title,
          status: "PENDING_PAYMENT",
          customerId: quote.customerId,
          quoteId: quote.id,
          experienceId: quote.experienceId,
          menuId: quote.menuId,
          styleId: quote.styleId,
          serviceAreaId: quote.serviceAreaId,
          occasion: quote.occasion,
          honoreeName: quote.lead?.honoreeName ?? null,
          colors: quote.lead?.colors ?? [],
          inspiration: quote.lead?.inspiration ?? null,
          eventDate: quote.eventDate!,
          startsAt,
          endsAt,
          guestCount: quote.guestCount,
          micrositeSlug,
          inviteToken: generateToken(),
          portalToken,
        },
        select: { id: true, code: true },
      });

      if (eventAddOns.size) {
        await tx.eventAddOn.createMany({
          data: [...eventAddOns.entries()].map(([addOnId, a]) => ({
            eventId: event.id,
            addOnId,
            quantity: Math.max(1, a.quantity),
            priceCents: a.priceCents,
            costCents: a.costCents,
            notes: a.notes,
          })),
        });
      }

      const booking = await tx.booking.create({
        data: {
          code: bookingCode,
          quoteId: quote.id,
          customerId: quote.customerId,
          eventId: event.id,
          totalCents: quote.totalCents,
          depositRequiredCents: quote.depositCents,
          currency: quote.currency,
          termsVersion: business.termsVersion,
          termsAcceptedAt: now,
          acceptedByName: opts.acceptedByName.trim().slice(0, 120),
          acceptedIp: opts.ip ?? null,
          balanceDueAt,
        },
        select: { id: true, code: true },
      });

      if (quote.lead) {
        const from = quote.lead.status as LeadStatus;
        const changes = leadStatusMachine.can(from, "WON");
        if (changes) await tx.lead.update({ where: { id: quote.lead.id }, data: { status: "WON" } });
        await tx.leadActivity.create({
          data: {
            leadId: quote.lead.id,
            type: changes ? "STATUS_CHANGE" : "SYSTEM",
            fromStatus: changes ? from : null,
            toStatus: changes ? "WON" : null,
            message: `La clienta aceptó la propuesta ${quote.code} (${formatMXN(quote.totalCents)}). Evento ${event.code} pendiente de anticipo.`,
          },
        });
      }

      await audit(
        {
          action: "quote.accepted",
          entityType: "Quote",
          entityId: quote.id,
          before: { status: "SENT" },
          after: {
            status: "ACCEPTED",
            bookingId: booking.id,
            bookingCode: booking.code,
            eventId: event.id,
            eventCode: event.code,
            acceptedByName: opts.acceptedByName,
            totalCents: quote.totalCents,
            depositCents: quote.depositCents,
          },
          ip: opts.ip ?? null,
        },
        tx,
      );
      return { bookingId: booking.id, eventId: event.id, portalToken, eventCode: event.code };
    },
    { timeout: 20_000, maxWait: 10_000 },
    )
    .catch(async (error: unknown) => {
      if (error instanceof AppError && error.code === "DATE_UNAVAILABLE") {
        await reportUnavailableDate(quote, dateKey);
      }
      throw error;
    });

  // Efectos posteriores (no bloquean ni revierten la aceptación)
  await track("ACCEPT_QUOTE", {
    quoteId: quote.id,
    eventId: result.eventId,
    leadId: quote.leadId,
    experienceId: quote.experienceId,
    metadata: { totalCents: quote.totalCents, depositCents: quote.depositCents },
  });
  const c = quote.customer;
  await notifyCustomer(
    { email: c.email, phone: c.phone, whatsapp: c.whatsapp },
    {
      type: "QUOTE_ACCEPTED",
      quoteId: quote.id,
      eventId: result.eventId,
      leadId: quote.leadId,
      dedupeKey: `quote-accepted:${quote.id}`,
      data: {
        name: c.name,
        eventTitle: quote.title,
        eventDate: formatLongDate(quote.eventDate),
        amount: formatMXN(quote.depositCents),
        quoteCode: quote.code,
        url: appUrl(`/cotizacion/${quote.publicToken}`),
      },
    },
  );
  try {
    const notifications = await getSettings("notifications");
    await notify({
      type: "GENERIC",
      channel: "EMAIL",
      to: notifications.ownerNotificationEmail,
      quoteId: quote.id,
      eventId: result.eventId,
      leadId: quote.leadId,
      dedupeKey: `quote-accepted-owner:${quote.id}`,
      data: {
        eventTitle: `¡Propuesta ${quote.code} aceptada!`,
        message: `${c.name} aceptó “${quote.title}” para el ${formatLongDate(quote.eventDate)} (${formatMXN(quote.totalCents)}). Evento ${result.eventCode} pendiente de anticipo de ${formatMXN(quote.depositCents)}.`,
        url: appUrl(`/admin/events/${result.eventId}`),
      },
    });
  } catch (error) {
    logger.warn("booking.owner_notify_failed", { error });
  }
  return { bookingId: result.bookingId, eventId: result.eventId, portalToken: result.portalToken };
}
