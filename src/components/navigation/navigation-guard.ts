/**
 * BUG-006 — Instalador (efectos globales) de la mitigación de navegaciones colgadas. Lo llama
 * src/instrumentation-client.ts antes de hidratar; la lógica pura está en src/lib/rsc-response-buffer.ts
 * (partes A y B en `fetch`) y src/lib/navigation-guard.ts (red de seguridad y recuperación).
 *
 * - Envuelve `window.fetch` (A: respuestas RSC completas; B: lazy fetch obsoletos sin datos).
 * - Lleva la cuenta de la actividad que puede retrasar legítimamente una navegación: peticiones RSC en
 *   curso y scripts/hojas de estilo que se agregan a <head> (chunks de webpack, CSS de React Float).
 * - Recupera con `router.refresh()`, que entrega <NavigationGuardBridge /> (layout raíz).
 */
import {
  createNavigationGuard,
  type NavigationGuard,
  type NavigationGuardEvent,
  type NavigationType,
} from "@/lib/navigation-guard";
import { createRouterTransitions, createRscFetch } from "@/lib/rsc-response-buffer";

export type InstalledNavigationGuard = NavigationGuard & {
  /** Registra (o quita, con `null`) el `router.refresh()` del App Router. */
  setRefresh(refresh: (() => void) | null): void;
};

/** Lo que el instalador usa de `window` (inyectable en pruebas). */
export type NavigationGuardHost = {
  fetch: typeof fetch;
  location: { href: string; assign(url: string): void; replace(url: string): void };
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
  addEventListener?(type: "pagehide", listener: () => void): void;
  document?: Document;
  MutationObserver?: typeof MutationObserver;
  console?: Pick<Console, "error" | "warn">;
};

const INSTALLED = Symbol.for("ivonne-rosa.navigation-guard");
// Webpack abandona un chunk a los 120 s (lo quita de <head> sin `load`/`error`): mismo tope aquí.
const RESOURCE_TIMEOUT_MS = 120_000;

type Marked = NavigationGuardHost & { [INSTALLED]?: InstalledNavigationGuard };

/**
 * Scripts (`src`) y hojas de estilo que se agregan a <head> y aún no terminan de cargar: un chunk JS o
 * CSS pendiente retrasa la confirmación de una navegación sin que esté colgada.
 */
function trackHeadResources(host: NavigationGuardHost, now: () => number, touch: () => void): () => number {
  const head = host.document?.head;
  const Observer = host.MutationObserver;
  if (!head || !Observer) return () => 0;
  const pending = new Map<Element, number>();
  const settle = (el: Element) => {
    if (pending.delete(el)) touch();
  };
  const isLoading = (el: Element) =>
    (el.nodeName === "SCRIPT" && Boolean((el as HTMLScriptElement).src)) ||
    (el.nodeName === "LINK" && (el as HTMLLinkElement).rel === "stylesheet" && !(el as HTMLLinkElement).sheet);
  new Observer((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        const el = node as Element;
        if (node.nodeType !== 1 || !isLoading(el)) return;
        pending.set(el, now());
        touch();
        el.addEventListener("load", () => settle(el), { once: true });
        el.addEventListener("error", () => settle(el), { once: true });
      });
      record.removedNodes.forEach((node) => settle(node as Element));
    }
  }).observe(head, { childList: true });
  return () => {
    const t = now();
    for (const [el, since] of pending) if (t - since > RESOURCE_TIMEOUT_MS) pending.delete(el);
    return pending.size;
  };
}

function report(log: Pick<Console, "error" | "warn"> | undefined, event: NavigationGuardEvent): void {
  if (!log) return;
  if (event.kind === "stalled") {
    // Error a propósito: con la parte A no debería ocurrir; el guard de E2E lo convierte en fallo.
    log.error(
      `[navegación] La navegación a ${event.url} no se confirmó tras ${Math.round(event.waitedMs / 1000)} s con la red en reposo; se recurre a una carga completa (BUG-006).`,
    );
  } else {
    log.warn(`[navegación] ${event.url}: su segmento se había descartado por obsoleto; se recupera con ${event.via === "refresh" ? "router.refresh()" : "una carga completa"} (BUG-006).`);
  }
}

/**
 * Instala la mitigación en `host` (en el navegador, `window`). Idempotente: una segunda llamada devuelve
 * la misma instancia sin anidar envoltorios de `fetch`.
 */
export function installNavigationGuard(host: NavigationGuardHost): InstalledNavigationGuard {
  const marked = host as Marked;
  const existing = marked[INSTALLED];
  if (existing) return existing;

  const now = () => Date.now();
  const href = () => host.location?.href ?? "http://localhost/";
  let rscInFlight = 0;
  let lastActivity = 0;
  const touch = () => {
    lastActivity = now();
  };
  const pendingResources = trackHeadResources(host, now, touch);
  let refresh: (() => void) | null = null;

  const transitions = createRouterTransitions(href);
  const guard = createNavigationGuard(
    {
      now,
      href,
      schedule(task, ms) {
        const id = host.setTimeout(task, ms);
        return () => host.clearTimeout(id);
      },
      busy: () => rscInFlight > 0 || pendingResources() > 0,
      lastActivity: () => lastActivity,
      refresh() {
        if (!refresh) return false;
        refresh();
        return true;
      },
      hardNavigate: (url: string, type: NavigationType) => (type === "push" ? host.location.assign(url) : host.location.replace(url)),
      report: (event) => report(host.console, event),
    },
    transitions,
  );

  const original = host.fetch;
  host.fetch = createRscFetch((input, init) => original.call(host, input, init), transitions, href, {
    onActivity(delta) {
      rscInFlight = Math.max(0, rscInFlight + delta);
      touch();
    },
    onDiscard: (key) => guard.discarded(key),
  });
  host.addEventListener?.("pagehide", () => guard.stop());

  const installed: InstalledNavigationGuard = {
    ...guard,
    setRefresh(fn) {
      refresh = fn;
    },
  };
  Object.defineProperty(marked, INSTALLED, { value: installed });
  return installed;
}

/** La instancia instalada en `host`, si la hay (la usa <NavigationGuardBridge />). */
export function getNavigationGuard(host: object = globalThis): InstalledNavigationGuard | null {
  return (host as Marked)[INSTALLED] ?? null;
}
