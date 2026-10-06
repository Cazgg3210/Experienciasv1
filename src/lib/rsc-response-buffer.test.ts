import { describe, expect, it, vi } from "vitest";
import {
  bufferFlightResponse,
  createRouterTransitions,
  createRscFetch,
  installRscResponseBuffer,
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

describe("installRscResponseBuffer", () => {
  it("envuelve fetch conservando argumentos y this, y devuelve el registro de navegaciones", async () => {
    const calls: Array<{ self: unknown; args: unknown[] }> = [];
    const host = {
      location: { href: BASE },
      fetch: function (this: unknown, ...args: unknown[]) {
        calls.push({ self: this, args });
        return Promise.resolve(streamedResponse(["0:{}\n", "1:[]\n"]).res);
      } as unknown as typeof fetch,
    };
    const transitions = installRscResponseBuffer(host);
    expect(typeof transitions.start).toBe("function");
    const init = { headers: { RSC: "1" } };
    const res = await host.fetch("/admin/calendar?_rsc=abc", init);
    expect(await res.text()).toBe("0:{}\n1:[]\n");
    expect(calls[0]).toEqual({ self: host, args: ["/admin/calendar?_rsc=abc", init] });
  });

  it("es idempotente (no anida envoltorios y reutiliza el registro)", async () => {
    const original = vi.fn(async () => new Response("ok", { headers: { "content-type": "text/plain" } }));
    const host = { fetch: original as unknown as typeof fetch };
    const first = installRscResponseBuffer(host);
    const wrapped = host.fetch;
    expect(installRscResponseBuffer(host)).toBe(first);
    expect(host.fetch).toBe(wrapped);
    await host.fetch("/x");
    expect(original).toHaveBeenCalledTimes(1);
  });

  it("propaga los rechazos de fetch (p. ej. AbortError al salir de la página)", async () => {
    const host = { fetch: (async () => Promise.reject(new DOMException("aborted", "AbortError"))) as unknown as typeof fetch };
    installRscResponseBuffer(host);
    await expect(host.fetch("/admin?_rsc=1")).rejects.toThrow("aborted");
  });
});
