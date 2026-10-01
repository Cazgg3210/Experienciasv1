import "server-only";
import { track } from "@/server/analytics";
import { sanitizeTrackPath } from "../domain/analytics";
import type { TrackEventInput } from "../schemas";
import { experienceExists } from "./queries";

export type RecordClientEventResult = { ok: true } | { ok: false; reason: "unknown_experience" };

/**
 * Registra un evento enviado por el navegador (ya validado con trackEventSchema).
 * Verifica que la experiencia exista y nunca guarda tokens ni query strings del path.
 */
export async function recordClientEvent(input: TrackEventInput): Promise<RecordClientEventResult> {
  if (input.experienceId && !(await experienceExists(input.experienceId))) {
    return { ok: false, reason: "unknown_experience" };
  }
  await track(input.type, {
    experienceId: input.experienceId ?? null,
    sessionId: input.sessionId ?? null,
    path: sanitizeTrackPath(input.path),
    metadata: input.metadata ? { ...input.metadata, origin: "client" } : { origin: "client" },
  });
  return { ok: true };
}
