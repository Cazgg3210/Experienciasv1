/**
 * BUG-006 — Mitigación para transiciones del App Router que se quedan colgadas (funciones puras; el
 * instalador que las conecta a `window` está en src/components/navigation/navigation-guard.ts).
 *
 * Síntoma: navegar a la MISMA ruta cambiando sólo `searchParams` (calendario, filtros, paginación),
 * `router.refresh()` o aplicar la respuesta de una Server Action que revalida deja la transición
 * pendiente para siempre: la URL y la UI no cambian y `useTransition` queda en `pending`, aunque el
 * servidor respondió 200 con el payload completo. Sólo en build de producción (`next dev` no lo reproduce).
 *
 * Causa raíz (React 19.2.0-canary-0bdb9206-20250818, el que trae Next 15.5.27; no es código de la app):
 * 1. La transición renderiza un payload RSC que todavía está llegando por streaming y React se suspende
 *    en un "lazy" de Flight (`$L…`) dentro de un Suspense ya visible (el de `loading.tsx`).
 * 2. React cede el hilo (SuspendedOnImmediate → SuspendedAndReadyToUnwind). Si la fila llega en ese
 *    intervalo, el chunk queda en `resolved_model` (dato recibido, aún sin inicializar) y
 *    `isThenableResolved` no lo considera resuelto.
 * 3. Al adjuntar el ping (`attachPingListener` → `chunk.then`) el chunk se inicializa y llama al ping de
 *    forma síncrona, en plena fase de render y con estado `RootSuspendedWithDelay`: `pingSuspendedRoot`
 *    lo descarta. La raíz queda con `suspendedLanes` y sin ping: nada vuelve a intentar el render.
 * Corrección en React: facebook/react#36134 (commit c0d218f, 2026-03-24: registra el ping en
 * `workInProgressRootPingedLanes`). La traen react-dom 19.3.0 y Next ≥ 16.3.0; ninguna 15.5.x.
 * Evidencia, experimentos y criterio de retiro: docs/qa/findings/events.md (EVX-BUG-02 › «Corrección (BUG-006)»).
 *
 * Mitigación (dos partes en el `fetch` del navegador, más la red de seguridad de navigation-guard):
 * A. Entregar a React las respuestas RSC (`text/x-component`) ya completas. Con todo el cuerpo disponible,
 *    Flight procesa todas las filas antes de que React renderice, así que React nunca se suspende
 *    esperando datos de la red y la carrera no puede ocurrir. Aplica a navegaciones, prefetch,
 *    `router.refresh()` y Server Actions (todas usan `fetch` global).
 * B. Descartar los "lazy fetch" del layout-router que quedaron obsoletos. Next 15.5 aplica su respuesta
 *    como `SERVER_PATCH` sobre el árbol vigente sin comparar `previousTree`: si mientras tanto empezó otra
 *    navegación a una ruta hermana (p. ej. /admin/settings → /admin/settings/pricing), el parche reemplaza
 *    la ruta nueva por la vieja (URL nueva, contenido viejo). El defecto ya existía, pero con (A) la
 *    ventana pasa de "primer byte" a "respuesta completa". Si otra navegación a otra URL empezó después
 *    de la petición, se entrega un payload RSC válido sin datos (`f: []`), que Next aplica sin cambios.
 *    Next sólo descarta así los parches cuya ruta ya no coincide; B lo extiende a rutas hermanas y a la
 *    misma ruta, y deja el nodo de esa URL en el caché del router sin contenido (`rsc = null` con
 *    `lazyData` ya resuelto): volver a ella mostraría el esqueleto de carga para siempre. Por eso cada
 *    descarte se avisa (`onDiscard`) y navigation-guard recupera esa URL con `router.refresh()`.
 *    Límite: sólo detecta navegaciones que empezaron DESPUÉS de emitir el lazy fetch (ver
 *    `createRouterTransitions`).
 * Costo: las navegaciones del cliente ya no pintan por partes; la carga inicial (HTML) sigue en streaming.
 *
 * Retirar cuando se actualice a Next ≥ 16.3 (React con #36134), verificando antes con tests/e2e CAL-002,
 * EVT-038, LEAD-037, INV-025, GST-011/012/015, CNT-022..024, NOT-002, SET-001, SET-023/024 y CRIT-004.
 */

export const RSC_CONTENT_TYPE = "text/x-component";

// Estados HTTP que no admiten cuerpo: `new Response(body, …)` lanzaría.
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/** ¿Es una respuesta RSC (Flight) de Next con cuerpo? */
export function isFlightResponse(res: Response): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.startsWith(RSC_CONTENT_TYPE) && res.body !== null && !NULL_BODY_STATUSES.has(res.status);
}

/**
 * Respuesta equivalente a `source` con otro cuerpo. Conserva cabeceras, `url` y `redirected` (el router
 * los usa para detectar redirecciones, p. ej. sesión vencida → /login).
 */
function rebuild(source: Response, body: BodyInit, status?: number): Response {
  const res = new Response(body, {
    status: status ?? source.status,
    statusText: status ? "" : source.statusText,
    headers: source.headers,
  });
  Object.defineProperties(res, {
    url: { value: source.url, enumerable: true },
    redirected: { value: source.redirected, enumerable: true },
  });
  return res;
}

/** Lee por completo una respuesta RSC; cualquier otra respuesta se devuelve intacta (sin leer). */
export async function bufferFlightResponse(res: Response): Promise<Response> {
  if (!isFlightResponse(res)) return res;
  return rebuild(res, await res.arrayBuffer());
}

// La fila raíz del payload empieza con el buildId: `0:{"b":"<buildId>","f":[…],…}`.
const ROOT_ROW_BUILD_ID = /(?:^|\n)0:\{"b":"([^"\\]+)"/;

/**
 * Payload RSC válido que no aplica nada (`f: []`), con el mismo buildId que `payloadText` para que el
 * router no lo trate como un despliegue nuevo (navegación completa). `null` si no se reconoce el formato.
 */
export function noopFlightResponse(source: Response, payloadText: string): Response | null {
  const match = ROOT_ROW_BUILD_ID.exec(payloadText);
  if (!match) return null;
  return rebuild(source, `0:${JSON.stringify({ b: match[1], f: [] })}\n`, 200);
}

/** Clave de destino del router: pathname + query, sin el parámetro `_rsc` ni el hash. */
export function routerUrlKey(url: string | URL, base: string): string {
  const u = new URL(String(url), base);
  u.searchParams.delete("_rsc");
  u.hash = "";
  return `${u.pathname}${u.search}`;
}

/** Método y cabeceras efectivos de `fetch(input, init)` (las de `init` mandan sobre las del `Request`). */
function requestInfo(input: RequestInfo | URL, init?: RequestInit): { method: string; headers: Headers } {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const headers = new Headers(request?.headers);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return { method: (init?.method ?? request?.method ?? "GET").toUpperCase(), headers };
}

/** ¿Es una petición del router de Next (navegación, prefetch, refresh, lazy fetch) o una Server Action? */
export function isRscRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const { headers } = requestInfo(input, init);
  return headers.get("rsc") === "1" || headers.has("next-action");
}

type FlightRouterState = [unknown, Record<string, FlightRouterState>, ...unknown[]];

function hasNestedRefetch(tree: FlightRouterState, depth = 0): boolean {
  if (depth > 0 && tree[3] === "refetch") return true;
  const children = tree[1];
  if (!children || typeof children !== "object") return false;
  return Object.values(children).some((child) => Array.isArray(child) && hasNestedRefetch(child, depth + 1));
}

/**
 * ¿Es el "lazy fetch" con el que el layout-router pide un segmento que le falta? (GET RSC sin prefetch
 * ni Server Action, con el marcador `refetch` debajo de la raíz; `router.refresh()` lo pone en la raíz).
 */
export function isLazySegmentFetch(input: RequestInfo | URL, init?: RequestInit): boolean {
  const { method, headers } = requestInfo(input, init);
  if (method !== "GET") return false;
  if (headers.get("rsc") !== "1" || headers.has("next-router-prefetch") || headers.has("next-action")) return false;
  const rawTree = headers.get("next-router-state-tree");
  if (!rawTree) return false;
  try {
    const tree: unknown = JSON.parse(decodeURIComponent(rawTree));
    return Array.isArray(tree) && hasNestedRefetch(tree as FlightRouterState);
  } catch {
    return false;
  }
}

/** Registro de navegaciones del router (lo alimenta `onRouterTransitionStart`). */
export type RouterTransitions = {
  /** Nueva navegación (push, replace o atrás/adelante) hacia `url`. */
  start(url: string): void;
  /** Marca (secuencia de la última navegación) para comparar después con `supersedes`. */
  mark(): number;
  /** ¿Empezó después de `mark` una navegación hacia una URL distinta de `key`? */
  supersedes(mark: number, key: string): boolean;
};

/**
 * Límite conocido (revisión adversarial, tercer menor): sólo cuentan las navegaciones que empezaron DESPUÉS
 * de emitir el lazy fetch. Si React renderiza un estado ya superado después de que empezó la navegación Y,
 * el lazy fetch de ese render toma la marca de Y y no se descarta (se aplica el parche obsoleto, como sin
 * la mitigación). No se compara la URL del lazy fetch con el destino vigente porque no son equivalentes:
 * tras una redirección (HTTP seguida por `fetch`, o de una Server Action, que no pasa por
 * `onRouterTransitionStart`) la URL canónica del estado difiere del destino pedido, y descartar ese lazy
 * fetch legítimo dejaría la página en el esqueleto de carga. Detalle en docs/qa/findings/events.md.
 */
export function createRouterTransitions(base: () => string): RouterTransitions {
  let seq = 0;
  let target: string | null = null;
  return {
    start(url) {
      seq += 1;
      target = routerUrlKey(url, base());
    },
    mark: () => seq,
    supersedes: (mark, key) => seq !== mark && target !== null && target !== key,
  };
}

export type RscFetchHooks = {
  /** Empezó (+1) o terminó (−1) una petición RSC: el cuerpo ya se leyó completo o falló. */
  onActivity?(delta: 1 | -1): void;
  /** Se descartó (B) la respuesta del lazy fetch de `key` (clave de `routerUrlKey`). */
  onDiscard?(key: string): void;
};

/** `fetch` con las dos partes de la mitigación (A: bufferizar RSC; B: descartar lazy fetch obsoletos). */
export function createRscFetch(
  original: typeof fetch,
  transitions: RouterTransitions,
  base: () => string,
  hooks: RscFetchHooks = {},
): typeof fetch {
  return async (input, init) => {
    const tracked = isRscRequest(input, init);
    const lazyKey = isLazySegmentFetch(input, init)
      ? routerUrlKey(input instanceof Request ? input.url : input, base())
      : null;
    const mark = transitions.mark();
    if (tracked) hooks.onActivity?.(1);
    try {
      const res = await original(input, init);
      if (!isFlightResponse(res)) return res;
      const body = await res.arrayBuffer();
      if (lazyKey !== null && transitions.supersedes(mark, lazyKey)) {
        const noop = noopFlightResponse(res, new TextDecoder().decode(body));
        if (noop) {
          hooks.onDiscard?.(lazyKey);
          return noop;
        }
      }
      return rebuild(res, body);
    } finally {
      if (tracked) hooks.onActivity?.(-1);
    }
  };
}
