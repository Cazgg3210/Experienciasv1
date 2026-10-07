/**
 * Reglas puras para reutilizar a una clienta que YA existía cuando llega una captura nueva (lead del sitio,
 * lead capturado por el equipo, «Clienta nueva» de cotización o de evento). Sin I/O.
 */
import { samePhone } from "@/lib/phone";

/** Quién escribió los datos: la propia visitante en el sitio ("public") o el equipo en el panel ("team"). */
export type ContactSource = "public" | "team";

export type ExistingContact = { email: string | null; phone: string | null; whatsapp: string | null };
export type IncomingContact = { email: string | null; phone: string | null };

export type ContactUpdate = {
  /** Campos vacíos del perfil que se completan con lo capturado. */
  fill: Partial<ExistingContact>;
  /** Datos capturados distintos a los del perfil que NO se guardaron en él (quedan en el lead para revisión). */
  unsaved: { email?: string; phone?: string };
};

/**
 * Qué datos de contacto de una captura se guardan en el perfil de una clienta que ya existía.
 *  - "team": el equipo los capturó en el panel → se completan los que faltan (nunca se sobrescriben).
 *  - "public": cualquiera puede escribir en el sitio el teléfono o el correo de otra persona, así que NUNCA
 *    se agregan al perfil: si se completaran, los avisos con enlaces privados (cotización, portal, pagos)
 *    le llegarían a quien los escribió. Se devuelven en `unsaved` para que el equipo los revise (quedan
 *    guardados en el propio lead) antes de actualizar el perfil.
 */
export function contactUpdateForExisting(
  source: ContactSource,
  existing: ExistingContact,
  incoming: IncomingContact,
): ContactUpdate {
  if (source === "team") {
    const fill: Partial<ExistingContact> = {};
    if (!existing.phone && incoming.phone) fill.phone = incoming.phone;
    if (!existing.whatsapp && incoming.phone) fill.whatsapp = incoming.phone;
    if (!existing.email && incoming.email) fill.email = incoming.email;
    return { fill, unsaved: {} };
  }
  const unsaved: ContactUpdate["unsaved"] = {};
  if (incoming.email && incoming.email !== existing.email) unsaved.email = incoming.email;
  if (incoming.phone && !samePhone(incoming.phone, existing.phone) && !samePhone(incoming.phone, existing.whatsapp)) {
    unsaved.phone = incoming.phone;
  }
  return { fill: {}, unsaved };
}

/** Nota para el timeline del lead cuando una captura pública trae datos de contacto que no se guardaron. */
export function unsavedContactNote(unsaved: ContactUpdate["unsaved"]): string | null {
  const parts = [unsaved.email ? `correo ${unsaved.email}` : null, unsaved.phone ? `teléfono ${unsaved.phone}` : null].filter(Boolean);
  if (!parts.length) return null;
  return `La clienta ya estaba registrada y escribió datos de contacto distintos a los de su perfil (${parts.join(", ")}). No se agregaron a su perfil: confírmalos con ella antes de actualizarlo.`;
}
