import "server-only";
import { cache } from "react";
import { isPlausibleToken } from "@/lib/tokens";
import { getCurrentUser } from "@/server/auth/session";
import { isBackofficeRole } from "@/server/auth/permissions";
import { openPublicQuote } from "./quote-service";
import { findQuoteByToken } from "./quote-queries";

/**
 * Carga (una vez por request) la propuesta pública: valida el token, expira si la vigencia
 * pasó y marca la primera vista de la clienta. null => 404 genérico.
 * Se usa desde el layout del segmento (para responder 404 real antes del streaming) y la página.
 */
export const loadPublicQuote = cache(async (token: string) => {
  if (!isPlausibleToken(token)) return null;
  const viewer = await getCurrentUser().catch(() => null);
  // El equipo puede revisar la propuesta sin marcarla como "vista por la clienta".
  const opened = await openPublicQuote(token, { markViewed: !isBackofficeRole(viewer?.role) });
  if (!opened) return null;
  const quote = await findQuoteByToken(token);
  if (!quote || quote.status === "DRAFT") return null;
  return quote;
});
