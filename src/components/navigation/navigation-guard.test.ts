import { afterEach, describe, expect, it, vi } from "vitest";
import { getNavigationGuard, installNavigationGuard, type NavigationGuardHost } from "./navigation-guard";

const ORIGIN = "http://localhost:3000";
const RSC = "text/x-component";
const PAYLOAD = '0:{"b":"build-123","f":[["children","settings"]],"S":false}\n';

/** Árbol del router con `refetch` en la página (lazy fetch del layout-router). */
const lazyHeaders = {
  RSC: "1",
  "Next-Router-State-Tree": encodeURIComponent(
    JSON.stringify(["", { children: ["admin", { children: ["settings", { children: ["__PAGE__", {}, null, "refetch"] }] }] }, null, null, true]),
  ),
};

function host(path = "/admin/settings", fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const calls: Array<{ self: unknown; args: unknown[] }> = [];
  const location = { href: `${ORIGIN}${path}`, assign: vi.fn(), replace: vi.fn() };
  const console = { error: vi.fn(), warn: vi.fn() };
  const listeners: Record<string, () => void> = {};
  const h: NavigationGuardHost = {
    location,
    console,
    setTimeout: (handler, ms) => setTimeout(handler, ms) as unknown as number,
    clearTimeout: (id) => clearTimeout(id),
    addEventListener: (type, listener) => (listeners[type] = listener),
    fetch: function (this: unknown, ...args: unknown[]) {
      calls.push({ self: this, args });
      return fetchImpl ? fetchImpl(args[0] as RequestInfo, args[1] as RequestInit) : Promise.resolve(new Response(PAYLOAD, { headers: { "content-type": RSC } }));
    } as typeof fetch,
  };
  return { h, calls, location, console, listeners };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("installNavigationGuard", () => {
  it("envuelve fetch conservando argumentos y this, y entrega las respuestas RSC completas", async () => {
    const { h, calls } = host();
    installNavigationGuard(h);
    const init = { headers: { RSC: "1" } };
    const res = await h.fetch("/admin/calendar?_rsc=abc", init);
    expect(await res.text()).toBe(PAYLOAD);
    expect(calls[0]).toEqual({ self: h, args: ["/admin/calendar?_rsc=abc", init] });
  });

  it("es idempotente (no anida envoltorios) y la instancia queda disponible para el puente del router", async () => {
    const original = vi.fn(async () => new Response("ok", { headers: { "content-type": "text/plain" } }));
    const { h } = host();
    h.fetch = original as unknown as typeof fetch;
    const first = installNavigationGuard(h);
    const wrapped = h.fetch;
    expect(installNavigationGuard(h)).toBe(first);
    expect(h.fetch).toBe(wrapped);
    expect(getNavigationGuard(h)).toBe(first);
    expect(getNavigationGuard({})).toBeNull();
    await h.fetch("/x");
    expect(original).toHaveBeenCalledTimes(1);
  });

  it("propaga los rechazos de fetch (p. ej. AbortError al salir de la página)", async () => {
    const { h } = host("/admin", async () => Promise.reject(new DOMException("aborted", "AbortError")));
    installNavigationGuard(h);
    await expect(h.fetch("/admin?_rsc=1", { headers: { RSC: "1" } })).rejects.toThrow("aborted");
  });

  it("navegación colgada: tras 5 s de red en reposo sin cambio de URL hace location.assign y lo reporta como error", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { h, location, console } = host("/admin/calendar");
    const guard = installNavigationGuard(h);
    guard.start("/admin/calendar?month=2026-11", "push");
    await vi.advanceTimersByTimeAsync(4_000);
    expect(location.assign).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(location.assign).toHaveBeenCalledWith(`${ORIGIN}/admin/calendar?month=2026-11`);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("no se confirmó"));
  });

  it("una petición RSC en curso aplaza la red de seguridad (página lenta)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    let respond!: () => void;
    const slow = new Promise<Response>((resolve) => (respond = () => resolve(new Response(PAYLOAD, { headers: { "content-type": RSC } }))));
    const { h, location } = host("/admin/calendar", () => slow);
    const guard = installNavigationGuard(h);
    guard.start("/admin/calendar?month=2026-11", "replace");
    const pending = h.fetch("/admin/calendar?month=2026-11&_rsc=x", { headers: { RSC: "1" } });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(location.replace).not.toHaveBeenCalled();
    respond();
    await pending;
    await vi.advanceTimersByTimeAsync(4_000);
    expect(location.replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(location.replace).toHaveBeenCalledWith(`${ORIGIN}/admin/calendar?month=2026-11`);
  });

  it("pagehide cancela la vigilancia", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { h, location, listeners } = host("/admin/calendar");
    const guard = installNavigationGuard(h);
    guard.start("/admin/calendar?month=2026-11", "push");
    listeners.pagehide();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(location.assign).not.toHaveBeenCalled();
  });

  it("lazy fetch descartado (B) → al volver con Atrás usa router.refresh() del puente", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    let respond!: () => void;
    const slow = new Promise<Response>((resolve) => (respond = () => resolve(new Response(PAYLOAD, { headers: { "content-type": RSC } }))));
    const { h, location, console } = host("/admin/settings", () => slow);
    const guard = installNavigationGuard(h);
    const refresh = vi.fn();
    guard.setRefresh(refresh);

    guard.start("/admin/settings", "push"); // clic en «Negocio» (misma URL) → lazy fetch
    const lazy = h.fetch(`${ORIGIN}/admin/settings?_rsc=a`, { headers: lazyHeaders });
    guard.start("/admin/settings/pricing", "push"); // «Precios» antes de que llegue la respuesta
    location.href = `${ORIGIN}/admin/settings/pricing`;
    respond();
    expect(await (await lazy).text()).toBe('0:{"b":"build-123","f":[]}\n'); // descartado

    location.href = `${ORIGIN}/admin/settings`; // Atrás
    guard.start(location.href, "traverse");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(location.assign).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("router.refresh()"));
    expect(console.error).not.toHaveBeenCalled();
  });

  it("sin el puente del router (o tras desmontarlo) la recuperación es una navegación completa", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { h, location } = host("/admin/settings/pricing");
    const guard = installNavigationGuard(h);
    guard.setRefresh(vi.fn());
    guard.setRefresh(null);
    guard.discarded("/admin/settings");
    location.href = `${ORIGIN}/admin/settings`;
    guard.start(location.href, "traverse");
    await vi.advanceTimersByTimeAsync(0);
    expect(location.replace).toHaveBeenCalledWith(`${ORIGIN}/admin/settings`);
  });
});
