import { z } from "zod";

/**
 * Esquemas Zod compartidos cliente/servidor del módulo Pagos.
 */

const cuid = z.string().regex(/^[a-z0-9]{20,40}$/i, "Identificador inválido");
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD");

export const MANUAL_PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD_TERMINAL", "OTHER"] as const;
export const PAYABLE_KINDS = ["DEPOSIT", "BALANCE", "FULL"] as const;

export const manualPaymentSchema = z.object({
  eventId: cuid,
  amountCents: z
    .number({ required_error: "Indica el monto", invalid_type_error: "Indica el monto" })
    .int("El monto debe estar en centavos")
    .min(100, "El monto mínimo es $1")
    .max(100_000_000, "El monto es demasiado alto"),
  kind: z.enum(PAYABLE_KINDS, { errorMap: () => ({ message: "Elige el concepto" }) }),
  method: z.enum(MANUAL_PAYMENT_METHODS, { errorMap: () => ({ message: "Elige el método" }) }),
  paidAt: dateKey,
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  receiptMediaId: cuid.optional().or(z.literal("")),
});
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

export const refundSchema = z.object({
  paymentId: cuid,
  amountCents: z
    .number({ required_error: "Indica el monto", invalid_type_error: "Indica el monto" })
    .int()
    .min(1, "El monto debe ser mayor a cero"),
  reason: z.string().trim().min(3, "Cuéntanos el motivo (mín. 3 caracteres)").max(300, "Máximo 300 caracteres"),
});
export type RefundInput = z.infer<typeof refundSchema>;

export const paymentStatusQuerySchema = z.object({
  p: cuid,
  s: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});

export const mockCheckoutSchema = z.object({
  checkoutId: z.string().regex(/^mock_cs_[A-Za-z0-9_-]{6,80}$/),
  outcome: z.enum(["success", "failure", "cancel"]),
  from: z.enum(["quote", "portal"]).optional(),
});
