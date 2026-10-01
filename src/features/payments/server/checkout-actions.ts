"use server";

import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { publicAction } from "@/server/action";
import { paymentStatusQuerySchema } from "../schemas";
import { resolveBookingFromToken, startCheckout } from "./payment-service";
import { isValidPaymentResultSignature } from "./payment-links";
import { getPaymentResult } from "./queries";

/**
 * Inicia un checkout (anticipo, saldo o pago completo) a partir de un token público:
 *  - tokenType "quote": Quote.publicToken de una cotización ACEPTADA (anticipo tras aceptar)
 *  - tokenType "portal": Event.portalToken (pagar saldo desde el portal de la clienta)
 * Devuelve la URL del checkout del proveedor (o del checkout simulado).
 */
const schema = z.object({
  token: z.string().min(20).max(128),
  tokenType: z.enum(["quote", "portal"]),
  kind: z.enum(["DEPOSIT", "BALANCE", "FULL"]),
});

export const startCheckoutAction = publicAction(
  { name: "payments.start_checkout", schema, rateLimit: { limit: 10, windowMs: 60_000 } },
  async (input): Promise<{ url: string }> => {
    const { bookingId } = await resolveBookingFromToken(input.token, input.tokenType);
    const { url } = await startCheckout(bookingId, input.kind, { source: input.tokenType });
    return { url };
  },
);

export type PaymentStatusView = {
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIAL_REFUND";
  eventConfirmed: boolean;
  failureReason: string | null;
};

/**
 * Estado de un pago para /pago/resultado (polling). Requiere la firma HMAC del enlace.
 * Nunca expone datos de otros pagos ni de la reserva.
 */
export const getPaymentStatusAction = publicAction(
  { name: "payments.status", schema: paymentStatusQuerySchema, rateLimit: { limit: 90, windowMs: 60_000 } },
  async (input): Promise<PaymentStatusView> => {
    if (!isValidPaymentResultSignature(input.p, input.s)) throw new NotFoundError("No encontramos este pago.");
    const payment = await getPaymentResult(input.p);
    if (!payment) throw new NotFoundError("No encontramos este pago.");
    const eventStatus = payment.booking.event.status;
    return {
      status: payment.status,
      eventConfirmed: ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"].includes(eventStatus),
      failureReason: payment.status === "FAILED" ? payment.failureReason : null,
    };
  },
);
