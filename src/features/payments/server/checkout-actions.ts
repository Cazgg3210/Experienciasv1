"use server";

import { z } from "zod";
import { AppError } from "@/lib/errors";
import { publicAction } from "@/server/action";

/**
 * STUB — lo implementa el módulo Pagos.
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
  async (_input): Promise<{ url: string }> => {
    throw new AppError("Los pagos en línea aún no están disponibles.");
  },
);
