"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import { manualPaymentSchema, refundSchema } from "../schemas";
import { recordManualPayment, refundPayment } from "./payment-service";

function revalidatePaymentPaths(eventId: string) {
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
}

/** Registrar pago manual (efectivo, transferencia, terminal...). Auditado. */
export const recordManualPaymentAction = protectedAction(
  { name: "payments.record_manual", schema: manualPaymentSchema, permission: "payments:manual" },
  async (input, { user, ip }) => {
    const result = await recordManualPayment(user, input, { ip });
    revalidatePaymentPaths(result.eventId);
    return result;
  },
);

/** Reembolso parcial o total (en línea vía proveedor o manual). Auditado. */
export const refundPaymentAction = protectedAction(
  { name: "payments.refund", schema: refundSchema, permission: "payments:manual" },
  async (input, { user, ip }) => {
    const result = await refundPayment(user, input, { ip });
    revalidatePaymentPaths(result.eventId);
    return result;
  },
);
