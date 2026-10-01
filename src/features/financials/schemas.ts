import { z } from "zod";
import { COST_CATEGORIES } from "./domain/event-financials";

const id = z.string().trim().min(1, "Falta el identificador.").max(64);

/** Máximo razonable para un costo manual: $1,000,000 MXN */
export const MAX_COST_CENTS = 100_000_000;

export const eventCostFormSchema = z.object({
  category: z.enum(COST_CATEGORIES, { errorMap: () => ({ message: "Elige una categoría." }) }),
  description: z
    .string()
    .trim()
    .min(3, "Describe el costo (mínimo 3 caracteres).")
    .max(200, "Máximo 200 caracteres."),
  amountCents: z
    .number({ invalid_type_error: "Escribe un monto.", required_error: "Escribe un monto." })
    .int("Monto inválido.")
    .min(1, "El monto debe ser mayor a $0.")
    .max(MAX_COST_CENTS, "El monto es demasiado alto. Revisa la cifra."),
});
export type EventCostFormValues = z.infer<typeof eventCostFormSchema>;

export const createEventCostSchema = eventCostFormSchema.extend({ eventId: id });
export type CreateEventCostInput = z.infer<typeof createEventCostSchema>;

export const updateEventCostSchema = eventCostFormSchema.extend({ costId: id });
export type UpdateEventCostInput = z.infer<typeof updateEventCostSchema>;

export const deleteEventCostSchema = z.object({ costId: id });
export type DeleteEventCostInput = z.infer<typeof deleteEventCostSchema>;

export const closeEventSchema = z.object({ eventId: id });
export type CloseEventInput = z.infer<typeof closeEventSchema>;

/** Filtros de /admin/finance (searchParams). Valores inválidos se ignoran. */
export const FINANCE_STATUS_FILTERS = [
  "ALL",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PLANNING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "OPEN",
  "CLOSED",
] as const;
export type FinanceStatusFilter = (typeof FINANCE_STATUS_FILTERS)[number];

export const financeFiltersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  status: z.enum(FINANCE_STATUS_FILTERS).optional().catch(undefined),
});
export type FinanceFilters = { month?: string; status?: FinanceStatusFilter };

export function parseFinanceFilters(sp: Record<string, string | string[] | undefined>): FinanceFilters {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = financeFiltersSchema.safeParse({
    month: pick(sp.month) || undefined,
    status: pick(sp.status) || undefined,
  });
  if (!parsed.success) return {};
  const out: FinanceFilters = {};
  if (parsed.data.month) out.month = parsed.data.month;
  if (parsed.data.status && parsed.data.status !== "ALL") out.status = parsed.data.status;
  return out;
}
