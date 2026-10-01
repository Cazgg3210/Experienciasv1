import type { AnalyticsEventType } from "@prisma/client";

/**
 * Reglas puras para eventos de analítica enviados desde el navegador.
 */

/** Únicos tipos que el cliente puede registrar (el resto sólo se emite desde el servidor). */
export const CLIENT_TRACKABLE_TYPES = [
  "VIEW_EXPERIENCE",
  "START_CONFIGURATOR",
  "COMPLETE_CONFIGURATOR",
] as const satisfies readonly AnalyticsEventType[];

export type ClientTrackableType = (typeof CLIENT_TRACKABLE_TYPES)[number];

export function isClientTrackable(type: string): type is ClientTrackableType {
  return (CLIENT_TRACKABLE_TYPES as readonly string[]).includes(type);
}

/** Rutas con token en la URL: nunca guardamos el token en analítica. */
const TOKEN_ROUTES = ["/mi-evento", "/e", "/memory", "/cotizacion", "/pago"];

/**
 * Normaliza el path recibido del cliente: sólo pathname (sin query/hash), máx. 300 chars,
 * y redacta segmentos con tokens en rutas privadas. Devuelve null si no es un path válido.
 */
export function sanitizeTrackPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  path = path.split(/[?#]/)[0]!;
  if (path.length > 300) path = path.slice(0, 300);
  // Sólo caracteres de path razonables
  if (!/^[A-Za-z0-9\-._~/%]*$/.test(path)) return null;
  const segments = path.split("/");
  const root = `/${segments[1] ?? ""}`;
  if (TOKEN_ROUTES.includes(root)) {
    return [root, ...segments.slice(2).map((s) => (s ? "[token]" : s))].join("/");
  }
  return path;
}

/** Id de sesión anónimo generado en el navegador (localStorage). */
export const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
