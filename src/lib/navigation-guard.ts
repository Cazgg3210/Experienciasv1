/**
 * BUG-006 — Red de seguridad de las navegaciones del App Router (lógica pura; el entorno se inyecta).
 * La conecta a `window` src/components/navigation/navigation-guard.ts y la alimenta `onRouterTransitionStart`
 * de src/instrumentation-client.ts. Contexto de la falla en src/lib/rsc-response-buffer.ts.
 *
 * 1. Navegación colgada. Si un push/replace hacia otra URL no se confirma (la URL no cambia y no empezó otra
 *    navegación) y la red lleva `quietMs` en reposo (sin peticiones RSC ni scripts/hojas de estilo cargando),
 *    se recurre a una navegación completa. Cubre los disparadores que la parte A no elimina (p. ej. un chunk
 *    JS de un componente cliente que termina de cargar mientras React cede el hilo) y cualquier cuelgue no
 *    previsto. Mientras haya algo cargando no se cuenta el plazo: una página lenta nunca dispara la red de
 *    seguridad. Se reporta como error: con la parte A no debería ocurrir nunca.
 * 2. Nodo vacío por un lazy fetch descartado (parte B). Al volver con Atrás/Adelante (`traverse`) a una URL
 *    cuyo lazy fetch se descartó, Next restaura ese nodo sin contenido y se quedaría en el esqueleto de
 *    carga: se fuerza `router.refresh()`, que reconstruye el caché del router desde la raíz (o, si el
 *    router aún no está disponible, una navegación completa).
 */
import { routerUrlKey, type RouterTransitions } from "./rsc-response-buffer";

export type NavigationType = "push" | "replace" | "traverse";

export type NavigationGuardEvent =
  | { kind: "stalled"; url: string; type: Exclude<NavigationType, "traverse">; waitedMs: number }
  | { kind: "recovered"; url: string; type: NavigationType; via: "refresh" | "reload" };

export type NavigationGuardEnv = {
  now(): number;
  /** URL actual del documento (`location.href`). */
  href(): string;
  /** Programa `task` en `ms`; devuelve la función que lo cancela. */
  schedule(task: () => void, ms: number): () => void;
  /** ¿Hay peticiones RSC o recursos (scripts, hojas de estilo) cargando? */
  busy(): boolean;
  /** Momento (`now()`) del último inicio o fin de esa actividad. */
  lastActivity(): number;
  /** `router.refresh()`; `false` si el router todavía no está disponible. */
  refresh(): boolean;
  /** Navegación completa: `location.assign` para push, `location.replace` para replace y traverse. */
  hardNavigate(url: string, type: NavigationType): void;
  report(event: NavigationGuardEvent): void;
};

export type NavigationGuard = {
  /** Hook `onRouterTransitionStart(url, navigationType)`. */
  start(url: string, type: NavigationType): void;
  /** La parte B descartó la respuesta del lazy fetch de `key` (clave de `routerUrlKey`). */
  discarded(key: string): void;
  /** Deja de vigilar la navegación en curso (p. ej. en `pagehide`). */
  stop(): void;
};

/**
 * Plazos. Un cuelgue es permanente, así que cualquier plazo finito lo resuelve; 5 s de red en reposo es
 * más de 5 veces lo que tarda en confirmarse una navegación con los datos y los chunks ya cargados, y el
 * plazo sólo corre cuando no hay nada cargando (sin falsos positivos en páginas lentas).
 */
export const NAVIGATION_GUARD_TIMING = { checkEveryMs: 1_000, quietMs: 5_000 } as const;

/** Máximo de URLs con lazy fetch descartado que se recuerdan (las más antiguas se olvidan). */
const MAX_STALE_URLS = 50;

type Watch = {
  seq: number;
  url: string;
  type: Exclude<NavigationType, "traverse">;
  from: string;
  since: number;
  cancel: () => void;
};

export function createNavigationGuard(
  env: NavigationGuardEnv,
  transitions: RouterTransitions,
  timing: { checkEveryMs: number; quietMs: number } = NAVIGATION_GUARD_TIMING,
): NavigationGuard {
  const staleUrls = new Set<string>();
  let watch: Watch | null = null;

  const keyOf = (url: string) => routerUrlKey(url, env.href());

  function stop() {
    watch?.cancel();
    watch = null;
  }

  function recover(url: string, type: NavigationType) {
    // Después de que Next despache la navegación (el hook corre justo antes): el refresh queda en la cola
    // del router detrás de ella y reconstruye el caché de la URL de destino.
    env.schedule(() => {
      const via = env.refresh() ? "refresh" : "reload";
      if (via === "reload") env.hardNavigate(url, type);
      env.report({ kind: "recovered", url, type, via });
    }, 0);
  }

  function check() {
    const w = watch;
    if (!w) return;
    // Empezó otra navegación, o la URL cambió (confirmada, o redirigida a otra parte): nada que hacer.
    if (transitions.mark() !== w.seq || keyOf(env.href()) !== w.from) {
      watch = null;
      return;
    }
    const quietFor = env.now() - Math.max(w.since, env.lastActivity());
    if (env.busy() || quietFor < timing.quietMs) {
      w.cancel = env.schedule(check, timing.checkEveryMs);
      return;
    }
    watch = null;
    env.report({ kind: "stalled", url: w.url, type: w.type, waitedMs: env.now() - w.since });
    env.hardNavigate(w.url, w.type);
  }

  return {
    start(url, type) {
      stop();
      transitions.start(url);
      const here = env.href();
      const target = new URL(url, here).href;
      const key = keyOf(target);
      // Atrás/Adelante restaura el árbol sobre el caché vigente y reutiliza el nodo vacío. (Un push/replace
      // no: el prefetch "auto" de Next ya está vencido —staleTimes.dynamic = 0— y crea un nodo nuevo; se
      // conserva la URL por si después se vuelve a ella con Atrás.) El navegador ya cambió la URL: no hay
      // confirmación que esperar.
      if (type === "traverse") {
        if (staleUrls.delete(key)) recover(target, type);
        return;
      }
      const from = keyOf(here);
      // Misma URL (o sólo cambia el hash): la URL no va a cambiar, no hay forma de saber si se confirmó.
      if (key === from) return;
      watch = {
        seq: transitions.mark(),
        url: target,
        type,
        from,
        since: env.now(),
        cancel: env.schedule(check, timing.checkEveryMs),
      };
    },
    discarded(key) {
      staleUrls.delete(key);
      staleUrls.add(key);
      if (staleUrls.size > MAX_STALE_URLS) staleUrls.delete(staleUrls.values().next().value as string);
    },
    stop,
  };
}
