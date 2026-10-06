/**
 * RESPONSIVE (@responsive): 1440×900, 1366×768, 768×1024 y 390×844 en las páginas clave.
 * Por viewport: sin scroll horizontal del documento (tolerancia 1 px), H1 visible y CTA principal
 * usable (visible, dentro del ancho y no tapado por barras fijas/botones flotantes).
 * Cada viewport se evalúa con expect.soft para reportar TODOS los tamaños que fallan; el detalle
 * (overflow por viewport y elementos culpables) se adjunta como responsive.json.
 */
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  TOKENS,
  createBookedEvent,
  expect,
  horizontalOverflow,
  overflowCulprits,
  rx,
  test,
  toleratesStaleExperienceCache,
} from "../critical/_helpers";

const VIEWPORTS = [
  { name: "1440×900", width: 1440, height: 900 },
  { name: "1366×768", width: 1366, height: 768 },
  { name: "768×1024", width: 768, height: 1024 },
  { name: "390×844", width: 390, height: 844 },
] as const;

type Check = { cta?: (page: Page) => Locator; h1?: string | RegExp; before?: (page: Page) => Promise<void> };

/** ¿El CTA es usable? centrado en pantalla, dentro del ancho y sin otro elemento encima. */
async function ctaProblem(cta: Locator, vw: number): Promise<string | null> {
  await cta.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  const box = await cta.boundingBox();
  if (!box) return "sin caja (oculto)";
  if (box.x < -1 || box.x + box.width > vw + 1) return `fuera del ancho (x=${Math.round(box.x)}, w=${Math.round(box.width)})`;
  const covered = await cta.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || el === hit || el.contains(hit)) return null;
    const h = hit as HTMLElement;
    return `${h.tagName.toLowerCase()} "${(h.getAttribute("aria-label") ?? h.textContent ?? "").trim().slice(0, 40)}"`;
  });
  return covered ? `tapado por ${covered}` : null;
}

async function checkViewports(page: Page, testInfo: TestInfo, path: string, check: Check) {
  const report: Array<Record<string, unknown>> = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(path);
    if (check.before) await check.before(page);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect.soft(h1.first(), `H1 visible en ${vp.name}`).toBeVisible();
    if (check.h1) await expect.soft(h1.first(), `H1 correcto en ${vp.name}`).toHaveText(check.h1);
    const overflow = await horizontalOverflow(page);
    const culprits = overflow > 1 ? await overflowCulprits(page) : [];
    expect.soft(overflow, `scroll horizontal en ${vp.name} (${culprits.join(" | ")})`).toBeLessThanOrEqual(1);
    let cta: string | null = null;
    if (check.cta) {
      const loc = check.cta(page);
      await expect.soft(loc, `CTA visible en ${vp.name}`).toBeVisible();
      cta = (await loc.isVisible()) ? await ctaProblem(loc, vp.width) : "no visible";
      expect.soft(cta, `CTA usable en ${vp.name}`).toBeNull();
    }
    report.push({ viewport: vp.name, overflowPx: overflow, culprits, ctaProblem: cta });
  }
  await testInfo.attach("responsive.json", { body: JSON.stringify({ path, report }, null, 2), contentType: "application/json" });
}

test.describe("Responsive · páginas clave", { tag: ["@responsive"] }, () => {
  // ------------------------------------------------------------------ público
  test("[RESP-001] inicio", { tag: ["@P1", "@module:public"] }, async ({ page, evidence }, testInfo) => {
    evidence("anonimo", "/ en 4 viewports");
    await checkViewports(page, testInfo, "/", {
      cta: (p) => p.getByRole("main").getByRole("link", { name: "Diseña tu experiencia" }).first(),
    });
  });

  test("[RESP-002] catálogo de experiencias", { tag: ["@P1", "@module:public"] }, async ({ page, evidence }, testInfo) => {
    evidence("anonimo", "/experiencias");
    await checkViewports(page, testInfo, "/experiencias", {
      cta: (p) => p.getByRole("main").getByRole("link", { name: /Signature Brunch/ }).first(),
    });
  });

  test("[RESP-003] detalle de experiencia", { tag: ["@P1", "@module:public"] }, async ({ page, db, guard, evidence }, testInfo) => {
    evidence("anonimo", "/experiencias/signature-brunch");
    await checkViewports(page, testInfo, "/experiencias/signature-brunch", {
      h1: "Signature Brunch",
      cta: (p) => p.getByRole("link", { name: "Diseña esta experiencia" }).filter({ visible: true }).first(),
      before: async (p) => {
        await toleratesStaleExperienceCache(p, db, guard, "signature-brunch");
      },
    });
  });

  test("[RESP-004] configurador (paso 1)", { tag: ["@P1", "@module:configurator"] }, async ({ page, evidence }, testInfo) => {
    evidence("anonimo", "/crear-experiencia");
    await checkViewports(page, testInfo, "/crear-experiencia", {
      h1: "Diseñemos juntas tu celebración",
      cta: (p) => p.getByRole("button", { name: "Siguiente", exact: true }),
    });
  });

  test("[RESP-005] contacto", { tag: ["@P1", "@module:public"] }, async ({ page, evidence }, testInfo) => {
    evidence("anonimo", "/contacto");
    await checkViewports(page, testInfo, "/contacto", { cta: (p) => p.getByRole("button", { name: "Enviar mensaje" }) });
  });

  test("[RESP-006] login del equipo", { tag: ["@P1", "@module:auth"] }, async ({ page, evidence }, testInfo) => {
    evidence("anonimo", "/login");
    await checkViewports(page, testInfo, "/login", { h1: "Bienvenida de vuelta", cta: (p) => p.getByRole("button", { name: "Entrar" }) });
  });

  test("[RESP-007] menú móvil público abre, navega y cierra (390 y 768)", { tag: ["@P1", "@module:public"] }, async ({ page, evidence }) => {
    evidence("anonimo", "Abrir menú → Cerrar menú → Abrir → Contacto");
    for (const vp of [VIEWPORTS[3], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByRole("navigation", { name: "Principal", exact: true })).toBeHidden();
      const open = page.getByRole("button", { name: "Abrir menú" });
      await open.click();
      const nav = page.getByRole("navigation", { name: "Principal (móvil)" });
      await expect(nav).toBeVisible();
      // Con el panel modal abierto el resto queda aria-hidden: se consulta el disparador incluyendo ocultos.
      await expect(page.getByRole("button", { name: "Abrir menú", includeHidden: true })).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("button", { name: "Cerrar menú" }).click();
      await expect(nav).toBeHidden();
      await expect(open).toBeFocused();
      await open.click();
      await nav.getByRole("link", { name: "Contacto" }).click();
      await page.waitForURL("**/contacto");
      await expect(nav).toBeHidden();
    }
    // En escritorio la navegación es visible y no hay botón de menú
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Principal", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeHidden();
  });

  // ------------------------------------------------------------------ experiencia por token
  test("[RESP-008] cotización por token", { tag: ["@P1", "@module:quotes"] }, async ({ page, evidence }, testInfo) => {
    evidence("clienta", "/cotizacion/[Lucía]");
    await checkViewports(page, testInfo, `/cotizacion/${TOKENS.quoteLucia}`, {
      h1: "Cumpleaños de Lucía",
      cta: (p) => p.getByRole("button", { name: "Aceptar propuesta" }).first(),
    });
  });

  test("[RESP-009] pago simulado (checkout del anticipo)", { tag: ["@P1", "@module:payments"] }, async ({ page, db, evidence }, testInfo) => {
    evidence("clienta", "cotización aceptada → Pagar anticipo → /pago/mock/[checkoutId]");
    const { quote } = await createBookedEvent(db, { status: "PENDING_PAYMENT", depositPaid: false });
    await page.goto(`/cotizacion/${quote.publicToken}`);
    await page.getByRole("button", { name: rx("Pagar anticipo · ") }).click();
    await page.waitForURL(/\/pago\/mock\/mock_cs_/);
    const url = new URL(page.url());
    await checkViewports(page, testInfo, url.pathname + url.search, { cta: (p) => p.getByRole("button", { name: /\(simulado\)$/ }) });
  });

  test("[RESP-010] portal de la clienta", { tag: ["@P1", "@module:portal"] }, async ({ page, evidence }, testInfo) => {
    evidence("clienta", "/mi-evento/[Sofía]");
    await checkViewports(page, testInfo, `/mi-evento/${TOKENS.portalSofia}`, {
      h1: "Cumpleaños de Sofía",
      cta: (p) => p.getByRole("button", { name: "Agregar invitada" }).filter({ visible: true }).first(),
    });
  });

  test("[RESP-011] RSVP de invitada", { tag: ["@P1", "@module:guests"] }, async ({ page, evidence }, testInfo) => {
    evidence("invitada", "/e/cumple-sofia/[Camila]");
    await checkViewports(page, testInfo, `/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila}`, {
      h1: "Cumpleaños de Sofía",
      cta: (p) => p.getByRole("button", { name: "Enviar mi respuesta" }),
    });
  });

  test("[RESP-012] Memory Capsule pública", { tag: ["@P1", "@module:memory"] }, async ({ page, evidence }, testInfo) => {
    evidence("invitada", "/memory/[Valeria]");
    await checkViewports(page, testInfo, `/memory/${TOKENS.memoryValeria}`, {
      h1: "Perú x México de Valeria",
      cta: (p) => p.getByRole("button", { name: "Dejar mi mensaje" }),
    });
  });

  test("[RESP-013] acceso a Mi evento (solicitar enlace)", { tag: ["@P2", "@module:portal"] }, async ({ page, evidence }, testInfo) => {
    evidence("clienta", "/mi-evento");
    await checkViewports(page, testInfo, "/mi-evento", { h1: "Entra a tu evento", cta: (p) => p.getByRole("button", { name: "Enviarme mi enlace" }) });
  });

  // ------------------------------------------------------------------ panel admin y staff
  test("[RESP-014] dashboard admin", { tag: ["@P2", "@module:analytics"] }, async ({ rolePage, evidence }, testInfo) => {
    evidence("owner", "/admin");
    const page = await rolePage("owner");
    await checkViewports(page, testInfo, "/admin", { h1: /^Hola, / });
  });

  test("[RESP-015] leads (tabla/lista contenida)", { tag: ["@P2", "@module:leads"] }, async ({ rolePage, evidence }, testInfo) => {
    evidence("owner", "/admin/leads");
    const page = await rolePage("owner");
    await checkViewports(page, testInfo, "/admin/leads", {
      h1: "Leads",
      cta: (p) => p.getByRole("main").getByRole("button", { name: /Nuevo lead/ }).first(),
    });
  });

  test("[RESP-016] detalle de evento", { tag: ["@P2", "@module:events"] }, async ({ rolePage, db, evidence }, testInfo) => {
    evidence("owner", "/admin/events/[Sofía]");
    const ev = await db.event.findFirstOrThrow({ where: { portalToken: TOKENS.portalSofia } });
    const page = await rolePage("owner");
    await checkViewports(page, testInfo, `/admin/events/${ev.id}`, { h1: ev.title });
  });

  test("[RESP-017] calendario", { tag: ["@P2", "@module:calendar"] }, async ({ rolePage, evidence }, testInfo) => {
    evidence("owner", "/admin/calendar");
    const page = await rolePage("owner");
    await checkViewports(page, testInfo, "/admin/calendar", { h1: "Calendario" });
  });

  test("[RESP-018] finanzas (tablas anchas con scroll contenido)", { tag: ["@P2", "@module:finance"] }, async ({ rolePage, evidence }, testInfo) => {
    evidence("owner", "/admin/finance");
    const page = await rolePage("owner");
    await checkViewports(page, testInfo, "/admin/finance", { h1: "Finanzas" });
    // En 768 la tabla de eventos (min-w 960 px) desborda SU contenedor (scroll interno), no la página
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin/finance");
    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    const contained = await table.evaluate((t) => {
      let el: HTMLElement | null = t.parentElement;
      while (el && el !== document.body) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowX)) return { ok: true, scroller: el.className.slice(0, 60) };
        el = el.parentElement;
      }
      return { ok: t.scrollWidth <= document.documentElement.clientWidth, scroller: null };
    });
    expect(contained.ok, `tabla con scroll contenido (${contained.scroller})`).toBe(true);
  });

  test("[RESP-019] menú del panel admin abre y cierra en móvil/tablet", { tag: ["@P2", "@module:navigation"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Abrir menú (lg:hidden) → Leads → menú cerrado");
    const page = await rolePage("owner");
    for (const vp of [VIEWPORTS[3], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/admin");
      const open = page.getByRole("button", { name: "Abrir menú" });
      await expect(open).toBeVisible();
      await open.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("navigation", { name: "Navegación del panel" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await open.click();
      await dialog.getByRole("link", { name: "Leads", exact: true }).click();
      await page.waitForURL("**/admin/leads");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    }
  });

  test("[RESP-020] portal staff", { tag: ["@P1", "@module:staff"] }, async ({ rolePage, evidence }, testInfo) => {
    evidence("staff", "/staff");
    const page = await rolePage("staff");
    await checkViewports(page, testInfo, "/staff", {
      h1: "Mis próximos eventos",
      cta: (p) => p.getByRole("link", { name: /Cumpleaños de Sofía/ }).first(),
    });
  });
});
