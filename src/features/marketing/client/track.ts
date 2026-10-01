/**
 * Utilidades de analítica para el navegador (sin dependencias de servidor).
 * Úsalas sólo dentro de efectos/handlers del cliente.
 *
 *   sendTrackEvent({ type: "START_CONFIGURATOR", path: location.pathname });
 */
import type { ClientTrackableType } from "../domain/analytics";

const SESSION_KEY = "ir_sid";
const ENDPOINT = "/api/analytics/track";

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  } catch {
    // ignorar: usamos el respaldo
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Id anónimo persistente por navegador (localStorage). Si no hay storage, uno por pestaña. */
let memorySessionId: string | null = null;
export function getAnonymousSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = randomId();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    memorySessionId ??= randomId();
    return memorySessionId;
  }
}

export type ClientTrackPayload = {
  type: ClientTrackableType;
  experienceId?: string | null;
  path?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

/** Envía el evento sin bloquear la navegación (sendBeacon → fetch keepalive). Nunca lanza. */
export function sendTrackEvent(payload: ClientTrackPayload): void {
  try {
    const body = JSON.stringify({
      ...payload,
      path: payload.path ?? window.location.pathname,
      sessionId: getAnonymousSessionId(),
    });
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, blob)) {
        return;
      }
    } catch {
      // Algunos navegadores rechazan sendBeacon con JSON: usamos fetch keepalive.
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    // La analítica nunca debe romper la experiencia
  }
}
