/**
 * Rastreo de enlaces internos: ningún <a href> interno debe llevar a 404/500 (ni a un soft-404 con 200).
 *  - Sitio público (anónimo), panel admin (owner: sidebar + enlaces de cada sección), portal staff (staff),
 *    experiencias por token (anónimo) y enlaces de acción del buzón mock (NotificationLog.actionUrl).
 * Las rutas con ids se agrupan por patrón (hasta 3 URLs por patrón) para mantener el tiempo acotado.
 */
import { TOKENS, expect, test, type E2ERole } from "../fixtures";
import { baseUrl, seedIds } from "../permissions/_helpers";
import type { APIRequestContext, Page } from "@playwright/test";

const SOFT_404 = /NEXT_HTTP_ERROR_FALLBACK;404/;

async function internalLinks(page: Page): Promise<string[]> {
  const origin = new URL(baseUrl()).origin;
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  return [...new Set(hrefs.filter((h) => h.startsWith(origin)).map((h) => h.split("#")[0]!))].map((h) => h.slice(origin.length) || "/");
}

function pattern(path: string): string {
  return path
    .split("?")[0]!
    .replace(/\/c[a-z0-9]{20,30}(?=\/|$)/g, "/:id")
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, "/:token");
}

async function check(api: APIRequestContext, urls: string[]): Promise<string[]> {
  const broken: string[] = [];
  const perPattern = new Map<string, number>();
  for (const u of urls) {
    const p = pattern(u);
    const n = perPattern.get(p) ?? 0;
    if (n >= 3) continue;
    perPattern.set(p, n + 1);
    const res = await api.get(u, { failOnStatusCode: false });
    const ct = res.headers()["content-type"] ?? "";
    const body = ct.includes("text/html") ? await res.text() : "";
    if (res.status() >= 400) broken.push(`${res.status()} ${u}`);
    else if (SOFT_404.test(body)) broken.push(`soft-404 ${u}`);
  }
  return broken;
}

async function crawl(page: Page, starts: string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const s of starts) {
    await page.goto(s);
    await expect(page.locator("h1").first()).toBeVisible();
    for (const l of await internalLinks(page)) found.add(l);
  }
  return [...found].sort();
}

test.describe("Enlaces internos sin 404/500", { tag: ["@module:navigation"] }, () => {
  test("[NAV-010] sitio público: todos los enlaces internos de las páginas públicas responden", { tag: ["@P1"] }, async ({ anonPage, apiAs, db, guard, evidence }) => {
    // ENVIRONMENT ISSUE (ENV-01 en access.md): la Data Cache de Next (.next-e2e/cache/fetch-cache) es compartida por
    // todos los carriles y sobrevive a la re-siembra; /experiencias/[slug] puede servir un experienceId de OTRA base y
    // el beacon de analítica responde 422 (unknown_experience). No afecta a los enlaces que valida esta prueba.
    guard.allow(/status of 422/);
    const ids = await seedIds(db);
    const slugs = (await db.experience.findMany({ where: { active: true }, select: { slug: true } })).map((e) => `/experiencias/${e.slug}`);
    evidence("anonimo", "home, navegación, legales, configurador, contacto y fichas de experiencias");
    const page = await anonPage();
    const links = await crawl(page, ["/", "/experiencias", "/como-funciona", "/nuestra-historia", "/contacto", "/privacidad", "/terminos", "/crear-experiencia", "/mi-evento", ...slugs.slice(0, 4), `/experiencias/${ids.experienceSlug}`]);
    test.info().annotations.push({ type: "observado", description: `${links.length} enlaces internos únicos` });
    expect(links.length).toBeGreaterThan(10);
    expect(await check(await apiAs(null), links)).toEqual([]);
  });

  test("[NAV-011] panel admin (owner): sidebar y enlaces de cada sección responden sin 404/500", { tag: ["@P1"] }, async ({ rolePage, apiAs, evidence }) => {
    test.setTimeout(240_000);
    evidence("owner", "17 secciones del sidebar + enlaces encontrados en cada una");
    const page = await rolePage("owner");
    await page.goto("/admin");
    const sidebar = await page.getByRole("navigation", { name: "Navegación del panel" }).getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(sidebar.length).toBe(17);
    const links = await crawl(page, sidebar);
    test.info().annotations.push({ type: "observado", description: `${links.length} enlaces internos únicos en el panel` });
    expect(await check(await apiAs("owner"), links)).toEqual([]);
  });

  test("[NAV-012] secciones de detalle del panel (evento, cotización, lead, clienta, catálogo, configuración) sin enlaces rotos", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    test.setTimeout(240_000);
    const ids = await seedIds(db);
    evidence("owner", "páginas de detalle con sub-navegación");
    const page = await rolePage("owner");
    const links = await crawl(page, [
      `/admin/events/${ids.eventSofia}`,
      `/admin/events/${ids.eventSofia}/guests`,
      `/admin/events/${ids.eventSofia}/operations`,
      `/admin/events/${ids.eventSofia}/financials`,
      `/admin/events/${ids.eventValeria}/memory`,
      `/admin/quotes/${ids.quoteId}`,
      `/admin/leads/${ids.leadId}`,
      `/admin/customers/${ids.customerId}`,
      `/admin/catalog/experiences/${ids.experienceId}`,
      `/admin/inventory/${ids.inventoryId}`,
      `/admin/purchases/${ids.purchaseId}`,
      `/admin/vendors/${ids.vendorId}`,
      `/admin/staff/${ids.staffMemberId}`,
      "/admin/settings/users",
      "/admin/settings/audit",
    ]);
    expect(await check(await apiAs("owner"), links)).toEqual([]);
  });

  test("[NAV-013] portal staff: enlaces de 'Mis eventos' y del detalle responden para staff", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    const ids = await seedIds(db);
    evidence("staff", "/staff + detalle de evento asignado");
    const page = await rolePage("staff");
    const links = await crawl(page, ["/staff", `/staff/events/${ids.eventSofia}`]);
    expect(links.some((l) => l.startsWith("/staff/events/"))).toBe(true);
    // Para staff sólo cuentan los enlaces de su zona (un enlace a /admin redirigiría a /staff, no es 404)
    expect(await check(await apiAs("staff"), links)).toEqual([]);
  });

  test("[NAV-014] experiencias por token (cotización, portal, micrositio, cápsula): enlaces internos responden", { tag: ["@P2"] }, async ({ anonPage, apiAs, evidence }) => {
    evidence("clienta", "páginas por token del seed (sólo lectura)");
    const page = await anonPage();
    const links = await crawl(page, [
      `/cotizacion/${TOKENS.quoteLucia}`,
      `/mi-evento/${TOKENS.portalSofia}`,
      `/mi-evento/${TOKENS.portalSofia}/resumen`,
      `/e/${TOKENS.micrositeSofia}/${TOKENS.inviteSofia}`,
      `/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila}`,
      `/memory/${TOKENS.memoryValeria}`,
    ]);
    expect(await check(await apiAs(null), links)).toEqual([]);
  });

  test("[NAV-015] enlaces de acción del buzón (NotificationLog.actionUrl) apuntan a rutas existentes", { tag: ["@P3"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "actionUrl de notificaciones del seed y generadas por la app");
    const rows = await db.notificationLog.findMany({ where: { actionUrl: { not: null } }, select: { type: true, actionUrl: true } });
    const byPattern = new Map<string, { type: string; path: string }>();
    for (const r of rows) {
      const u = new URL(r.actionUrl!, baseUrl());
      const p = `${r.type} ${pattern(u.pathname)}`;
      if (!byPattern.has(p)) byPattern.set(p, { type: r.type, path: u.pathname + u.search });
    }
    const roleFor = (p: string): E2ERole | null => (p.startsWith("/admin") ? "owner" : p.startsWith("/staff") ? "staff" : null);
    const broken: string[] = [];
    for (const { type, path } of byPattern.values()) {
      const api = await apiAs(roleFor(path) ?? null);
      const res = await api.get(path, { failOnStatusCode: false });
      const body = (res.headers()["content-type"] ?? "").includes("html") ? await res.text() : "";
      if (res.status() >= 400 || SOFT_404.test(body)) broken.push(`${type} → ${res.status()} ${path}`);
    }
    test.info().annotations.push({ type: "observado", description: `${byPattern.size} patrones de actionUrl revisados` });
    if (broken.length) test.info().annotations.push({ type: "bug", description: "ACC-BUG-05" });
    expect(broken).toEqual([]);
  });
});
