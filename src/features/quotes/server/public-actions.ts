"use server";

import { revalidatePath } from "next/cache";
import { publicAction } from "@/server/action";
import { createBookingFromQuote } from "@/features/bookings/server/booking-service";
import { acceptQuoteSchema, rejectQuoteSchema } from "../schemas";
import { rejectQuoteByToken } from "./quote-service";

/** La clienta acepta la propuesta (crea reserva + evento pendiente de anticipo). */
export const acceptQuoteAction = publicAction(
  { name: "quotes.accept", schema: acceptQuoteSchema, rateLimit: { limit: 8, windowMs: 10 * 60_000 } },
  async ({ token, fullName, version }, { ip }) => {
    const res = await createBookingFromQuote(token, { acceptedByName: fullName, ip, expectedVersion: version ?? null });
    revalidatePath(`/cotizacion/${token}`);
    revalidatePath("/admin/quotes");
    revalidatePath("/admin/events");
    return { portalToken: res.portalToken };
  },
);

/** La clienta rechaza la propuesta (motivo opcional). */
export const rejectQuoteAction = publicAction(
  { name: "quotes.reject", schema: rejectQuoteSchema, rateLimit: { limit: 8, windowMs: 10 * 60_000 } },
  async ({ token, reason }, { ip }) => {
    await rejectQuoteByToken(token, { reason, ip });
    revalidatePath(`/cotizacion/${token}`);
    revalidatePath("/admin/quotes");
    return { ok: true as const };
  },
);
