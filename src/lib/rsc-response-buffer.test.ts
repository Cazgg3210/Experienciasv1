import { describe, expect, it } from "vitest";
import {
  bufferFlightResponse,
  createRouterTransitions,
  createRscFetch,
  isRscRequest,
  isFlightResponse,
  isLazySegmentFetch,
  noopFlightResponse,
  routerUrlKey,
  RSC_CONTENT_TYPE,
} from "./rsc-response-buffer";

const BASE = "http://localhost:3000/admin/settings";
const base = () => BASE;
const enc = new TextEncoder();

/** Respuesta cuyo cuerpo llega en varias partes (como el streaming RSC); `closed` indica si ya terminó. */
function streamedResponse(parts: string[], init: ResponseInit = {}) {
  const state = { closed: false };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise((r) => setTimeout(r, 5));
      if (i < parts.length) controller.enqueue(enc.encode(parts[i++]));
      else {
        state.closed = true;
        controller.close();
      }
    },
  });
  const res = new Response(body, {
    status: 200,
    ...init,
    headers: { "content-type": RSC_CONTENT_TYPE, ...(init.headers as Record<string, string> | undefined) },
  });
  return { res, state };
}

/** Árbol de estado del router tal como lo manda Next en `Next-Router-State-Tree`. */
function stateTree(refetchAt: "page" | "root" | "none") {
  const page = ["__PAGE__", {}, null, refetchAt === "page" ? "refetch" : null];
  const settings = ["settings", { children: page }, null, null];
  const tree = ["", { children: ["(admin)", { children: ["admin", { children: settings }] }] }, null, refetchAt === "root" ? "refetch" : null, true];
  return encodeURIComponent(JSON.stringify(tree));
}

const lazyInit = (refetchAt: "page" | "root" | "none" = "page"): RequestInit => ({
  headers: { RSC: "1", "Next-Router-State-Tree": stateTree(refetchAt) },
});

const PAYLOAD = '1:"$Sreact.fragment"\n0:{"b":"build-123","f":[["children","settings"]],"S":false}\n2:["$","p",null,{}]\n';

describe("isFlightResponse", () => {
  it("reconoce respuestas text/x-component con cuerpo", () => {
    expect(isFlightResponse(new Response("0:{}", { headers: { "content-type": "text/x-component" } }))).toBe(true);
    expect(isFlightResponse(new Response("0:{}", { headers: { "content-type": "text/x-component; charset=utf-8" } }))).toBe(true);
  });

  it("ignora otros tipos de contenido y respuestas sin cuerpo", () => {
    expect(isFlightResponse(new Response("<html>", { headers: { "content-type": "text/html" } }))).toBe(false);
    expect(isFlightResponse(new Response("{}", { headers: { "content-type": "application/json" } }))).toBe(false);
    expect(isFlightResponse(new Response(null, { status: 204, headers: { "content-type": RSC_CONTENT_TYPE } }))).toBe(false);
    expect(isFlightResponse(new Response(null, { status: 200, headers: { "content-type": RSC_CONTENT_TYPE } }))).toBe(false);
  });
});

describe("bufferFlightResponse", () => {
  it("espera el cuerpo completo antes de resolver y conserva el contenido", async () => {
    const { res, state } = streamedResponse(['0:{"b":"x"}\n', "2:[1]\n", "3:[2]\n"]);
    const out = await bufferFlightResponse(res);
    expect(state.closed).toBe(true);
    expect(await out.text()).toBe('0:{"b":"x"}\n2:[1]\n3:[2]\n');
  });

  it("conserva estado, cabeceras, url y redirected (detección de redirecciones del router)", async () => {
    const { res } = streamedResponse(["0:{}\n"], { status: 404, statusText: "Not Found", headers: { vary: "rsc" } });
    Object.defineProperties(res, {
      url: { value: "http://localhost:3000/login?callbackUrl=%2Fadmin" },
      redirected: { value: true },
    });
    const out = await bufferFlightResponse(res);
    expect(out).not.toBe(res);
    expect(out.status).toBe(404);
    expect(out.statusText).toBe("Not Found");
    expect(out.ok).toBe(false);
    expect(out.headers.get("content-type")).toBe(RSC_CONTENT_TYPE);
    expect(out.headers.get("vary")).toBe("rsc");
    expect(out.url).toBe("http://localhost:3000/login?callbackUrl=%2Fadmin");
    expect(out.redirected).toBe(true);
    expect(out.body).not.toBeNull();
  });

  it("devuelve intactas las respuestas que no son RSC (sin leer su cuerpo)", async () => {
    const res = new Response("hola", { headers: { "content-type": "text/plain" } });
    const out = await bufferFlightResponse(res);
    expect(out).toBe(res);
    expect(out.bodyUsed).toBe(false);
  });

  it("propaga el error si el stream se corta a la mitad", async () => {
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(enc.encode("0:{}\n"));
        } else controller.error(new TypeError("network error"));
      },
    });
    const res = new Response(body, { headers: { "content-type": RSC_CONTENT_TYPE } });
    await expect(bufferFlightResponse(res)).rejects.toThrow("network error");
  });
});

describe("noopFlightResponse", () => {
  it("arma un payload sin datos con el mismo buildId, estado 200 y la url original", async () => {
    const source = new Response("x", { status: 404, headers: { "content-type": RSC_CONTENT_TYPE } });
    Object.defineProperty(source, "url", { value: "http://localhost:3000/admin/settings?_rsc=abc" });
    const out = noopFlightResponse(source, PAYLOAD);
    expect(out).not.toBeNull();
    expect(out!.status).toBe(200);
    expect(out!.headers.get("content-type")).toBe(RSC_CONTENT_TYPE);
    expect(out!.url).toBe("http://localhost:3000/admin/settings?_rsc=abc");
    expect(await out!.text()).toBe('0:{"b":"build-123","f":[]}\n');
  });

  it("devuelve null si no reconoce la fila raíz (se usa la respuesta real)", () => {
    const source = new Response("x", { headers: { "content-type": RSC_CONTENT_TYPE } });
    expect(noopFlightResponse(source, '1:"$Sreact.fragment"\n')).toBeNull();
    expect(noopFlightResponse(source, '0:{"f":[],"b":"x"}\n')).toBeNull();
  });
});

describe("routerUrlKey", () => {
  it("compara pathname + query sin _rsc ni hash, con URLs relativas o absolutas", () => {
    expect(routerUrlKey("/admin/calendar?month=2026-11", BASE)).toBe("/admin/calendar?month=2026-11");
    expect(routerUrlKey("http://localhost:3000/admin/calendar?month=2026-11&_rsc=x1#hoy", BASE)).toBe("/admin/calendar?month=2026-11");
    expect(routerUrlKey(new URL("http://localhost:3000/admin/settings?_rsc=abc"), BASE)).toBe("/admin/settings");
  });
});

describe("isLazySegmentFetch", () => {
  it("reconoce el lazy fetch del layout-router (refetch debajo de la raíz)", () => {
    expect(isLazySegmentFetch(new URL("http://localhost:3000/admin/settings?_rsc=a"), lazyInit("page"))).toBe(true);
    expect(isLazySegmentFetch("/admin/settings", { headers: new Headers({ rsc: "1", "next-router-state-tree": stateTree("page") }) })).toBe(true);
  });

  it("descarta refresh (refetch en la raíz), navegaciones normales, prefetch, Server Actions y otros fetch", () => {
    expect(isLazySegmentFetch("/admin/settings", lazyInit("root"))).toBe(false);
    expect(isLazySegmentFetch("/admin/settings", lazyInit("none"))).toBe(false);
    expect(isLazySegmentFetch("/admin/settings", { headers: { ...(lazyInit().headers as Record<string, string>), "Next-Router-Prefetch": "1" } })).toBe(false);
    expect(isLazySegmentFetch("/admin/settings", { method: "POST", headers: { ...(lazyInit().headers as Record<string, string>), "Next-Action": "abc" } })).toBe(false);
    expect(isLazySegmentFetch("/api/health")).toBe(false);
    expect(isLazySegmentFetch("/admin/settings", { headers: { RSC: "1", "Next-Router-State-Tree": "%%no-json" } })).toBe(false);
  });
});

describe("createRscFetch", () => {
  function setup(responses: Record<string, () => Response>) {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const original = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      const key = routerUrlKey(String(input), BASE);
      const make = responses[key];
      if (!make) throw new Error(`sin respuesta para ${key}`);
      return make();
    }) as typeof fetch;
    const transitions = createRouterTransitions(base);
    return { calls, transitions, rscFetch: createRscFetch(original, transitions, base) };
  }
  const rsc = (text = PAYLOAD) => () => streamedResponse([text.slice(0, 20), text.slice(20)]).res;

  it("bufferiza las respuestas RSC y deja pasar las demás sin leerlas", async () => {
    const { rscFetch, calls } = setup({
      "/admin/calendar?month=2026-11": rsc(),
      "/api/health": () => new Response("{}", { headers: { "content-type": "application/json" } }),
    });
    const init = { headers: { RSC: "1" } };
    const nav = await rscFetch("/admin/calendar?month=2026-11&_rsc=abc", init);
    expect(await nav.text()).toBe(PAYLOAD);
    expect(calls[0]).toEqual(["/admin/calendar?month=2026-11&_rsc=abc", init]);
    const json = await rscFetch("/api/health");
    expect(json.bodyUsed).toBe(false);
  });

  it("un lazy fetch que otra navegación a otra URL dejó obsoleto se entrega sin datos (no reemplaza la ruta nueva)", async () => {
    const { rscFetch, transitions } = setup({ "/admin/settings": rsc() });
    transitions.start("/admin/settings"); // clic en «Negocio» (misma URL): el router dispara el lazy fetch
    const lazy = rscFetch(new URL("http://localhost:3000/admin/settings?_rsc=x"), lazyInit("page"));
    // La petición ya salió; antes de que termine, empieza la navegación a «Precios y márgenes»
    transitions.start("/admin/settings/pricing");
    const res = await lazy;
    expect(await res.text()).toBe('0:{"b":"build-123","f":[]}\n');
    expect(res.status).toBe(200);
  });

  it("no descarta el lazy fetch si no hubo otra navegación, si fue a la misma URL o si no es lazy", async () => {
    const { rscFetch, transitions } = setup({ "/admin/settings": rsc(), "/admin/settings?tab=1": rsc() });
    transitions.start("/admin/settings");
    // sin navegación nueva
    expect(await (await rscFetch("/admin/settings?_rsc=1", lazyInit("page"))).text()).toBe(PAYLOAD);

    // navegación nueva a la misma URL (p. ej. doble clic en el mismo enlace o sólo cambia el hash)
    const same = rscFetch("/admin/settings?_rsc=2", lazyInit("page"));
    transitions.start("http://localhost:3000/admin/settings#arriba");
    expect(await (await same).text()).toBe(PAYLOAD);

    // refresh (refetch en la raíz) y navegación normal: el router ya los descarta por su cuenta
    const refresh = rscFetch("/admin/settings?_rsc=3", lazyInit("root"));
    transitions.start("/admin/settings/pricing");
    expect(await (await refresh).text()).toBe(PAYLOAD);
    const navigation = rscFetch("/admin/settings?tab=1&_rsc=4", lazyInit("none"));
    transitions.start("/admin/settings/flags");
    expect(await (await navigation).text()).toBe(PAYLOAD);
  });

  it("si no reconoce el payload, entrega la respuesta real aunque esté obsoleta", async () => {
    const odd = '1:"$Sreact.fragment"\n';
    const { rscFetch, transitions } = setup({ "/admin/settings": rsc(odd) });
    const req = rscFetch("/admin/settings?_rsc=1", lazyInit("page"));
    transitions.start("/admin/settings/pricing");
    expect(await (await req).text()).toBe(odd);
  });
});

describe("isRscRequest", () => {
  it("reconoce las peticiones del router (RSC: 1) y las Server Actions (Next-Action)", () => {
    expect(isRscRequest("/admin?_rsc=1", { headers: { RSC: "1" } })).toBe(true);
    expect(isRscRequest("/admin", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } })).toBe(true);
    expect(isRscRequest("/admin", { method: "POST", headers: { "Next-Action": "abc" } })).toBe(true);
    expect(isRscRequest(new Request("http://localhost:3000/admin?_rsc=1", { headers: { rsc: "1" } }))).toBe(true);
  });

  it("ignora el resto de fetch", () => {
    expect(isRscRequest("/api/health")).toBe(false);
    expect(isRscRequest("/api/media/upload", { method: "POST", body: "x" })).toBe(false);
  });
});

describe("createRscFetch › avisos (onActivity, onDiscard)", () => {
  function setup(make: () => Promise<Response>) {
    const transitions = createRouterTransitions(base);
    const activity: number[] = [];
    const discarded: string[] = [];
    const rscFetch = createRscFetch((async () => make()) as typeof fetch, transitions, base, {
      onActivity: (delta) => activity.push(delta),
      onDiscard: (key) => discarded.push(key),
    });
    return { transitions, activity, discarded, rscFetch };
  }

  it("cuenta cada petición RSC desde que sale hasta que su cuerpo se leyó completo", async () => {
    const { res, state } = streamedResponse([PAYLOAD.slice(0, 20), PAYLOAD.slice(20)]);
    const { rscFetch, activity } = setup(async () => res);
    const pending = rscFetch("/admin/calendar?_rsc=1", { headers: { RSC: "1" } });
    expect(activity).toEqual([1]);
    await pending;
    expect(state.closed).toBe(true);
    expect(activity).toEqual([1, -1]);
  });

  it("también cierra la cuenta si fetch falla, y no cuenta lo que no es RSC", async () => {
    const failing = setup(async () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(failing.rscFetch("/admin?_rsc=1", { headers: { RSC: "1" } })).rejects.toThrow("Failed to fetch");
    expect(failing.activity).toEqual([1, -1]);
    const plain = setup(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    await plain.rscFetch("/api/health");
    expect(plain.activity).toEqual([]);
  });

  it("avisa la URL del lazy fetch descartado (y sólo de ese)", async () => {
    const { rscFetch, transitions, discarded } = setup(async () => streamedResponse([PAYLOAD]).res);
    transitions.start("/admin/settings");
    const stale = rscFetch("/admin/settings?_rsc=1", lazyInit("page"));
    transitions.start("/admin/settings/pricing");
    expect(await (await stale).text()).toBe('0:{"b":"build-123","f":[]}\n');
    expect(discarded).toEqual(["/admin/settings"]);
    expect(await (await rscFetch("/admin/settings/pricing?_rsc=2", lazyInit("page"))).text()).toBe(PAYLOAD);
    expect(discarded).toEqual(["/admin/settings"]);
  });
});
