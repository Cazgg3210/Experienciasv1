/**
 * Autorización NEGATIVA real en el backend: "ocultar un botón" no es autorización.
 *
 * Técnica de captura y repetición (replay):
 *  1. Un rol autorizado ejecuta la acción en la UI y capturamos la Server Action (POST con header Next-Action).
 *  2. Repetimos EXACTAMENTE ese request con otra sesión (STAFF, anónimo, otra clienta, otro token…).
 *  3. Esperamos rechazo del servidor Y comprobamos en la base que NADA cambió (la prueba definitiva).
 *
 * Hallazgo verificado (Next 15.5): una acción enviada a una ruta cuya página NO la importa no se ejecuta
 * (responde 200 con cuerpo "{}" = acción no encontrada). Por eso:
 *  - el replay debe ir a la MISMA ruta donde vive la acción (o a otra que el atacante pueda cargar);
 *  - la barrera para roles sin acceso a /admin es el middleware + guard de la página;
 *  - la autorización propia de la acción se prueba con roles que SÍ pasan el middleware pero no tienen
 *    el permiso (p. ej. OWNER sin roles:assign_super_admin) y con accesos cruzados (IDOR) dentro de
 *    áreas permitidas (staff en eventos no asignados, tokens de otro evento).
 */
import type { APIRequestContext, Page } from "@playwright/test";

export type CapturedAction = {
  url: string;
  actionId: string;
  contentType: string;
  routerStateTree?: string;
  body: Buffer | null;
};

export async function captureServerAction(page: Page, trigger: () => Promise<unknown>): Promise<CapturedAction> {
  const requestPromise = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"], {
    timeout: 30_000,
  });
  await trigger();
  const req = await requestPromise;
  const h = req.headers();
  return {
    url: req.url(),
    actionId: h["next-action"]!,
    contentType: h["content-type"] ?? "text/plain;charset=UTF-8",
    routerStateTree: h["next-router-state-tree"],
    body: req.postDataBuffer(),
  };
}

export type ReplayOutcome = "accepted" | "denied" | "not-executed" | "server-error" | "unknown";

export type ReplayResult = {
  status: number;
  text: string;
  redirectedTo: string | null;
  outcome: ReplayOutcome;
};

function classify(status: number, text: string, redirectedTo: string | null, headers: Record<string, string>): ReplayOutcome {
  if (status >= 500) return "server-error";
  if (redirectedTo !== null) return "denied"; // middleware / guard: login, sin-acceso, staff
  if ([401, 403].includes(status)) return "denied";
  if (/"ok":true/.test(text)) return "accepted";
  if (/"ok":false/.test(text) && /(FORBIDDEN|UNAUTHORIZED|NOT_FOUND)/.test(text)) return "denied";
  if (status === 404 || headers["x-nextjs-action-not-found"] || text.trim() === "{}" || text.trim() === "")
    return "not-executed";
  return "unknown";
}

export async function replayServerAction(
  request: APIRequestContext,
  captured: CapturedAction,
  opts: { path?: string; body?: Buffer | string } = {},
): Promise<ReplayResult> {
  const target = new URL(opts.path ?? new URL(captured.url).pathname + new URL(captured.url).search, captured.url);
  const headers: Record<string, string> = {
    "Next-Action": captured.actionId,
    "Content-Type": captured.contentType,
    Accept: "text/x-component",
    Origin: target.origin,
  };
  if (captured.routerStateTree) headers["Next-Router-State-Tree"] = captured.routerStateTree;
  const res = await request.post(target.toString(), {
    headers,
    data: opts.body ?? captured.body ?? "",
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const status = res.status();
  const text = await res.text();
  const redirectedTo = status >= 300 && status < 400 ? (res.headers()["location"] ?? "") : null;
  return { status, text, redirectedTo, outcome: classify(status, text, redirectedTo, res.headers()) };
}

/**
 * ¿El servidor impidió el efecto? "denied" o "not-executed" impiden el efecto, pero sólo "denied"
 * demuestra que hubo una barrera de autorización. SIEMPRE combinar con una verificación en la base.
 */
export function wasDenied(r: ReplayResult): boolean {
  return r.outcome === "denied";
}

export function wasBlocked(r: ReplayResult): boolean {
  return r.outcome === "denied" || r.outcome === "not-executed";
}

export function wasAccepted(r: ReplayResult): boolean {
  return r.outcome === "accepted";
}
