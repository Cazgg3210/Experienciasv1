import { createStateMachine } from "@/lib/state-machine";

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export const quoteStatusMachine = createStateMachine<QuoteStatus>("Quote", {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"], // DRAFT = volver a editar (nueva versión)
  ACCEPTED: [],
  REJECTED: ["DRAFT"],
  EXPIRED: ["DRAFT", "SENT"], // reactivar / reenviar con nueva vigencia
});

/** Sólo los borradores son editables; editar una enviada la regresa a borrador con nueva versión. */
export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === "DRAFT";
}

export function isQuoteExpired(validUntil: Date | null, now: Date = new Date()): boolean {
  return !!validUntil && validUntil.getTime() < now.getTime();
}
