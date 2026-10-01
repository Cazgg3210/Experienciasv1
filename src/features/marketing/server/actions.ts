"use server";

import { publicAction } from "@/server/action";
import { contactFormSchema } from "../schemas";
import { submitContactRequest } from "./contact-service";

/** Formulario de /contacto (público, 5 envíos por IP cada 10 minutos). */
export const submitContactForm = publicAction(
  {
    name: "marketing.contact",
    schema: contactFormSchema,
    rateLimit: { limit: 5, windowMs: 10 * 60_000 },
  },
  async (input, { user, ip }) => {
    const result = await submitContactRequest(input, { actor: user, ip });
    return { code: result.code };
  },
);
