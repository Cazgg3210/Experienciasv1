import "server-only";
import { generateCode } from "@/lib/codes";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/server/auth/session";
import { createInboundLead } from "@/features/leads/server/lead-intake";
import type { ContactFormInput } from "../schemas";

export type ContactRequestResult = {
  /** Folio que ve la clienta (código del lead). */
  code: string;
  /** null cuando la solicitud se descartó silenciosamente (honeypot). */
  leadId: string | null;
};

/**
 * Formulario de contacto del sitio → lead con source CONTACT_FORM.
 * - Honeypot lleno ⇒ se responde "éxito" con un folio falso y NO se crea nada (no revelar al bot).
 * - Todo lo demás (clienta, timeline, notificaciones, analítica) lo hace createInboundLead.
 */
export async function submitContactRequest(
  input: ContactFormInput,
  ctx: { actor?: SessionUser | null; ip?: string } = {},
): Promise<ContactRequestResult> {
  if (input.website && input.website.trim() !== "") {
    logger.warn("marketing.contact_honeypot", { ip: ctx.ip });
    return { code: generateCode("L"), leadId: null };
  }

  const result = await createInboundLead(
    {
      source: "CONTACT_FORM",
      name: input.name,
      email: input.email,
      phone: input.phone,
      occasion: input.occasion,
      eventDate: input.eventDate ? input.eventDate : null,
      notes: input.message,
      sessionId: input.sessionId ?? null,
    },
    { actor: ctx.actor ?? null, channel: "public" },
  );
  return { code: result.code, leadId: result.leadId };
}
