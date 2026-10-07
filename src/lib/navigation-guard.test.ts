import { describe, expect, it } from "vitest";
import { createNavigationGuard, type NavigationGuardEvent, type NavigationType } from "./navigation-guard";
import { createRouterTransitions } from "./rsc-response-buffer";

const ORIGIN = "http://localhost:3000";
const TIMING = { checkEveryMs: 1_000, quietMs: 5_000 };

/** Entorno simulado: reloj y temporizadores manuales, URL, actividad de red y router. */
function setup(path = "/admin/calendar", { router = true } = {}) {
  let clock = 0;
  let href = `${ORIGIN}${path}`;
  let busy = false;
  let lastActivity = 0;
  const timers: Array<{ at: number; task: () => void; cancelled: boolean }> = [];
  const events: NavigationGuardEvent[] = [];
  const hardNavigations: Array<{ url: string; type: NavigationType }> = [];
  let refreshes = 0;
  const transitions = createRouterTransitions(() => href);
  const guard = createNavigationGuard(
    {
      now: () => clock,
      href: () => href,
      schedule(task, ms) {
        const timer = { at: clock + ms, task, cancelled: false };
        timers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
      busy: () => busy,
      lastActivity: () => lastActivity,
      refresh() {
        if (!router) return false;
        refreshes += 1;
        return true;
      },
      hardNavigate: (url, type) => hardNavigations.push({ url, type }),
      report: (event) => events.push(event),
    },
    transitions,
    TIMING,
  );
  /** Avanza el reloj `ms` ejecutando en orden los temporizadores que vencen. */
  function advance(ms: number) {
    const end = clock + ms;
    for (;;) {
      const next = timers.filter((t) => !t.cancelled && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      next.cancelled = true;
      clock = next.at;
      next.task();
    }
    clock = end;
  }
  return {
    guard,
    transitions,
    advance,
    events,
    hardNavigations,
    refreshes: () => refreshes,
    pendingTimers: () => timers.filter((t) => !t.cancelled).length,
    setHref: (p: string) => (href = `${ORIGIN}${p}`),
    setBusy(value: boolean) {
      busy = value;
      lastActivity = clock;
    },
  };
}

describe("navigation guard › navegación colgada (red de seguridad)", () => {
  it("si un push no cambia la URL y la red está en reposo, recurre a una navegación completa", () => {
    const env = setup();
    env.guard.start("/admin/calendar?month=2026-11", "push");
    env.advance(4_999);
    expect(env.hardNavigations).toEqual([]);
    env.advance(1_001);
    expect(env.hardNavigations).toEqual([{ url: `${ORIGIN}/admin/calendar?month=2026-11`, type: "push" }]);
    expect(env.events).toEqual([
      { kind: "stalled", url: `${ORIGIN}/admin/calendar?month=2026-11`, type: "push", waitedMs: 5_000 },
    ]);
    expect(env.pendingTimers()).toBe(0);
  });

  it("replace usa location.replace (type replace) y resuelve URLs relativas contra la actual", () => {
    const env = setup("/admin/inventory?q=vaso");
    env.guard.start("?q=vaso&inactive=1", "replace");
    env.advance(6_000);
    expect(env.hardNavigations).toEqual([
      { url: `${ORIGIN}/admin/inventory?q=vaso&inactive=1`, type: "replace" },
    ]);
  });

  it("no interviene si la URL cambió (confirmada o redirigida a otra parte)", () => {
    const env = setup();
    env.guard.start("/admin/calendar?month=2026-11", "push");
    env.advance(300);
    env.setHref("/login?callbackUrl=%2Fadmin%2Fcalendar");
    env.advance(60_000);
    expect(env.hardNavigations).toEqual([]);
    expect(env.pendingTimers()).toBe(0);
  });

  it("no interviene mientras haya peticiones RSC o recursos cargando (página lenta), y el plazo cuenta desde que terminan", () => {
    const env = setup();
    env.guard.start("/admin/events?period=past", "push");
    env.setBusy(true);
    env.advance(60_000);
    expect(env.hardNavigations).toEqual([]);
    env.setBusy(false); // terminó de cargar en t = 60 s
    env.advance(4_000);
    expect(env.hardNavigations).toEqual([]);
    env.advance(2_000);
    expect(env.hardNavigations).toHaveLength(1);
    expect(env.events[0]).toMatchObject({ kind: "stalled", waitedMs: 65_000 });
  });

  it("una navegación posterior (push o Atrás/Adelante) reemplaza la vigilancia de la anterior", () => {
    const env = setup();
    env.guard.start("/admin/calendar?month=2026-11", "push");
    env.advance(2_000);
    env.guard.start(`${ORIGIN}/admin/calendar`, "traverse");
    env.advance(30_000);
    expect(env.hardNavigations).toEqual([]);

    env.guard.start("/admin/calendar?month=2026-12", "push");
    env.advance(2_000);
    env.guard.start("/admin/calendar?month=2027-01", "push");
    env.advance(6_000);
    expect(env.hardNavigations).toEqual([{ url: `${ORIGIN}/admin/calendar?month=2027-01`, type: "push" }]);
  });

  it("no vigila navegaciones a la misma URL (o que sólo cambian el hash) ni Atrás/Adelante", () => {
    const env = setup("/admin/settings");
    env.guard.start("/admin/settings", "push");
    env.guard.start("/admin/settings#usuarios", "push");
    env.guard.start(`${ORIGIN}/admin/settings/pricing`, "traverse");
    env.advance(60_000);
    expect(env.hardNavigations).toEqual([]);
    expect(env.pendingTimers()).toBe(0);
  });

  it("stop() cancela la vigilancia (p. ej. al salir de la página)", () => {
    const env = setup();
    env.guard.start("/admin/calendar?month=2026-11", "push");
    env.guard.stop();
    env.advance(60_000);
    expect(env.hardNavigations).toEqual([]);
  });

  it("alimenta el registro de navegaciones de la parte B", () => {
    const env = setup();
    const mark = env.transitions.mark();
    env.guard.start("/admin/settings/pricing", "push");
    expect(env.transitions.supersedes(mark, "/admin/settings")).toBe(true);
    expect(env.transitions.supersedes(mark, "/admin/settings/pricing")).toBe(false);
  });
});

describe("navigation guard › URLs con lazy fetch descartado (parte B)", () => {
  it("al volver con Atrás a una URL descartada fuerza router.refresh() después del despacho, una sola vez", () => {
    const env = setup("/admin/settings/pricing");
    env.guard.discarded("/admin/settings");
    env.setHref("/admin/settings"); // popstate: el navegador ya cambió la URL
    env.guard.start(`${ORIGIN}/admin/settings`, "traverse");
    expect(env.refreshes()).toBe(0); // todavía no: Next despacha la navegación justo después del hook
    env.advance(0);
    expect(env.refreshes()).toBe(1);
    expect(env.events).toEqual([
      { kind: "recovered", url: `${ORIGIN}/admin/settings`, type: "traverse", via: "refresh" },
    ]);

    env.setHref("/admin/settings/pricing");
    env.guard.start(`${ORIGIN}/admin/settings/pricing`, "traverse");
    env.setHref("/admin/settings");
    env.guard.start(`${ORIGIN}/admin/settings`, "traverse");
    env.advance(0);
    expect(env.refreshes()).toBe(1); // el refresh reconstruyó el caché: no se repite
  });

  it("con un enlace (push) no refresca —Next crea un nodo nuevo— y conserva la URL para un Atrás posterior", () => {
    const env = setup("/admin/settings/pricing");
    env.guard.discarded("/admin/settings");
    env.guard.start("/admin/settings", "push");
    env.setHref("/admin/settings");
    env.advance(0);
    expect(env.refreshes()).toBe(0);
    env.guard.start("/admin/settings/pricing", "push");
    env.setHref("/admin/settings/pricing");
    env.setHref("/admin/settings");
    env.guard.start(`${ORIGIN}/admin/settings`, "traverse");
    env.advance(0);
    expect(env.refreshes()).toBe(1);
  });

  it("no hace nada al ir a otras URLs (la clave incluye la query)", () => {
    const env = setup("/admin/calendar");
    env.guard.discarded("/admin/calendar?month=2026-11");
    env.setHref("/admin/calendar?month=2026-12");
    env.guard.start(`${ORIGIN}/admin/calendar?month=2026-12`, "traverse");
    env.advance(0);
    expect(env.refreshes()).toBe(0);
  });

  it("sin router disponible recurre a una navegación completa", () => {
    const env = setup("/admin/settings/pricing", { router: false });
    env.guard.discarded("/admin/settings");
    env.setHref("/admin/settings");
    env.guard.start(`${ORIGIN}/admin/settings`, "traverse");
    env.advance(0);
    expect(env.hardNavigations).toEqual([{ url: `${ORIGIN}/admin/settings`, type: "traverse" }]);
    expect(env.events).toEqual([
      { kind: "recovered", url: `${ORIGIN}/admin/settings`, type: "traverse", via: "reload" },
    ]);
  });

  it("recuerda como máximo 50 URLs (olvida las más antiguas)", () => {
    const env = setup("/admin");
    for (let i = 0; i < 51; i++) env.guard.discarded(`/admin/leads?page=${i}`);
    env.guard.start(`${ORIGIN}/admin/leads?page=0`, "traverse");
    env.advance(0);
    expect(env.refreshes()).toBe(0);
    env.guard.start(`${ORIGIN}/admin/leads?page=50`, "traverse");
    env.advance(0);
    expect(env.refreshes()).toBe(1);
  });
});
