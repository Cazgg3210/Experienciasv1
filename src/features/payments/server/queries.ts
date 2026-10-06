import "server-only";
import { cache } from "react";
import type { PaymentKind, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { summarizeBooking, type BookingPaymentSummary } from "../domain/amounts";

/**
 * Consultas de lectura del módulo Pagos (admin, finanzas, checkout simulado, resultado).
 */

const paymentRowSelect = {
  id: true,
  kind: true,
  status: true,
  method: true,
  provider: true,
  providerCheckoutId: true,
  providerPaymentId: true,
  amountCents: true,
  feeCents: true,
  refundedCents: true,
  currency: true,
  refundOfId: true,
  paidAt: true,
  failedAt: true,
  failureReason: true,
  notes: true,
  createdAt: true,
  receiptMediaId: true,
  recordedBy: { select: { name: true } },
} satisfies Prisma.PaymentSelect;

export type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentRowSelect }>;

/** Resumen de cobranza de una reserva (total, anticipo, pagado neto, saldo...). */
export async function getBookingPaymentSummary(
  bookingId: string,
): Promise<(BookingPaymentSummary & { bookingId: string; balanceDueAt: Date | null }) | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      totalCents: true,
      depositRequiredCents: true,
      balanceDueAt: true,
      payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true, feeCents: true } },
    },
  });
  if (!booking) return null;
  return { bookingId: booking.id, balanceDueAt: booking.balanceDueAt, ...summarizeBooking(booking, booking.payments) };
}

/** Datos completos del panel de pagos de un evento (admin). */
export async function getPaymentsPanelData(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      status: true,
      eventDate: true,
      portalToken: true,
      customer: { select: { name: true, phone: true, whatsapp: true, email: true } },
      booking: {
        select: {
          id: true,
          code: true,
          totalCents: true,
          depositRequiredCents: true,
          balanceDueAt: true,
          cancelledAt: true,
          payments: { select: paymentRowSelect, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!event) return null;
  const summary = event.booking ? summarizeBooking(event.booking, event.booking.payments) : null;
  return { event, booking: event.booking, summary };
}

export type PaymentsPanelData = NonNullable<Awaited<ReturnType<typeof getPaymentsPanelData>>>;

/** Lista de pagos recientes (para /admin/finance y reportes). */
export async function listRecentPayments(
  opts: {
    limit?: number;
    skip?: number;
    status?: PaymentStatus | PaymentStatus[];
    kind?: PaymentKind | PaymentKind[];
    from?: Date;
    to?: Date;
  } = {},
) {
  const where: Prisma.PaymentWhereInput = {
    ...(opts.status ? { status: Array.isArray(opts.status) ? { in: opts.status } : opts.status } : {}),
    ...(opts.kind ? { kind: Array.isArray(opts.kind) ? { in: opts.kind } : opts.kind } : {}),
    ...(opts.from || opts.to ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } : {}),
  };
  const take = Math.min(Math.max(opts.limit ?? 25, 1), 200);
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip: opts.skip ?? 0,
      select: {
        ...paymentRowSelect,
        booking: {
          select: {
            id: true,
            code: true,
            customer: { select: { id: true, name: true } },
            event: { select: { id: true, title: true, code: true, eventDate: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}

export type RecentPayment = Awaited<ReturnType<typeof listRecentPayments>>["items"][number];

/** Checkout simulado: datos mínimos para la página /pago/mock/[checkoutId]. */
export const getMockCheckout = cache(async (checkoutId: string) => {
  return prisma.payment.findUnique({
    where: { provider_providerCheckoutId: { provider: "mock", providerCheckoutId: checkoutId } },
    select: {
      id: true,
      kind: true,
      status: true,
      amountCents: true,
      createdAt: true,
      booking: {
        select: {
          code: true,
          totalCents: true,
          depositRequiredCents: true,
          cancelledAt: true,
          payments: { select: { kind: true, status: true, amountCents: true, refundedCents: true } },
          customer: { select: { name: true } },
          quote: { select: { publicToken: true } },
          event: { select: { title: true, status: true, eventDate: true, portalToken: true, guestCount: true } },
        },
      },
    },
  });
});

/** Resultado de pago (ya autorizado por firma HMAC). */
export async function getPaymentResult(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      kind: true,
      status: true,
      amountCents: true,
      failureReason: true,
      notes: true,
      paidAt: true,
      booking: {
        select: {
          cancelledAt: true,
          event: { select: { id: true, title: true, status: true, eventDate: true, portalToken: true } },
          customer: { select: { name: true } },
        },
      },
    },
  });
}
