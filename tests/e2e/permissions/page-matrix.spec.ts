/**
 * Matriz rol × página: TODAS las páginas del inventario (docs/qa/.discovery/inventory.json) para
 * anónimo / staff / owner / superadmin. Rutas dinámicas con IDs reales del seed DEMO (sólo lectura).
 *
 * Nivel HTTP (sin seguir redirects) para los 4 roles: status + Location exactos.
 * Nivel UI (navegador, con guard de consola/red) para el rol "principal" de cada zona:
 *   admin → owner · staff → staff · resto → anónimo.
 * Cada prueba anota la fila observada ("matriz") para docs/qa/findings/access-role-matrix.md.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { TOKENS, expect, test, type E2ERole } from "../fixtures";
import { ROOT, paymentResultPath, probe, seedIds } from "./_helpers";

type InvPage = { route: string; group: string; permission?: string; dynamic: boolean };
const inventory: InvPage[] = JSON.parse(readFileSync(path.join(ROOT, "docs/qa/.discovery/inventory.json"), "utf8")).pages;

type Ids = Awaited<ReturnType<typeof seedIds>>;
type Role = "anon" | "staff" | "owner" | "superadmin";
const ROLES: Role[] = ["anon", "staff", "owner", "superadmin"];

/** URL concreta de cada ruta del inventario (dinámicas con IDs reales). */
function resolve(route: string, ids: Ids): string {
  const map: Record<string, string> = {
    "/admin/catalog/addons/[id]": `/admin/catalog/addons/${ids.addOnId}`,
    "/admin/catalog/experiences/[id]": `/admin/catalog/experiences/${ids.experienceId}`,
    "/admin/catalog/menus/[id]": `/admin/catalog/menus/${ids.menuId}`,
    "/admin/customers/[id]": `/admin/customers/${ids.customerId}`,
    "/admin/events/[id]/financials": `/admin/events/${ids.eventSofia}/financials`,
    "/admin/events/[id]/guests": `/admin/events/${ids.eventSofia}/guests`,
    "/admin/events/[id]/memory": `/admin/events/${ids.eventValeria}/memory`,
    "/admin/events/[id]/operations": `/admin/events/${ids.eventSofia}/operations`,
    "/admin/events/[id]": `/admin/events/${ids.eventSofia}`,
    "/admin/inventory/events/[eventId]": `/admin/inventory/events/${ids.eventSofia}`,
    "/admin/inventory/[id]": `/admin/inventory/${ids.inventoryId}`,
    "/admin/leads/[id]": `/admin/leads/${ids.leadId}`,
    "/admin/operations/templates/[id]": `/admin/operations/templates/${ids.templateId}`,
    "/admin/purchases/[id]": `/admin/purchases/${ids.purchaseId}`,
    "/admin/quotes/[id]": `/admin/quotes/${ids.quoteId}`,
    "/admin/quotes/[id]/print": `/admin/quotes/${ids.quoteId}/print`,
    "/admin/staff/[id]": `/admin/staff/${ids.staffMemberId}`,
    "/admin/vendors/[id]/edit": `/admin/vendors/${ids.vendorId}/edit`,
    "/admin/vendors/[id]": `/admin/vendors/${ids.vendorId}`,
    "/cotizacion/[token]": `/cotizacion/${TOKENS.quoteLucia}`,
    "/e/[slug]/[token]": `/e/${TOKENS.micrositeSofia}/${TOKENS.inviteSofia}`,
    "/memory/[token]": `/memory/${TOKENS.memoryValeria}`,
    "/mi-evento/[token]": `/mi-evento/${TOKENS.portalSofia}`,
    "/mi-evento/[token]/resumen": `/mi-evento/${TOKENS.portalSofia}/resumen`,
    "/pago/mock/[checkoutId]": `/pago/mock/${ids.mockCheckoutId}`,
    "/pago/resultado": paymentResultPath(ids.paymentIdPending),
    "/experiencias/[slug]": `/experiencias/${ids.experienceSlug}`,
    "/staff/events/[id]": `/staff/events/${ids.eventSofia}`,
  };
  const url = map[route] ?? route;
  if (url.includes("[")) throw new Error(`Ruta dinámica sin resolver en la matriz: ${route}`);
  return url;
}

type Expected = { status: 200 } | { status: 307; location: string };

function expected(zone: string, role: Role, url: string): Expected {
  const login = { status: 307 as const, location: `/login?callbackUrl=${encodeURIComponent(url)}` };
  if (zone === "admin") {
    if (role === "anon") return login;
    if (role === "staff") return { status: 307, location: "/staff" };
    return { status: 200 };
  }
  if (zone === "staff") return role === "anon" ? login : { status: 200 };
  if (zone === "auth") {
    if (role === "anon") return { status: 200 };
    return { status: 307, location: role === "staff" ? "/staff" : "/admin" };
  }
  return { status: 200 };
}

const symbol = (e: { status: number; location: string | null }) =>
  e.status === 200
    ? "✅"
    : e.status === 307 && e.location?.startsWith("/login")
      ? "↪ login"
      : e.status === 307 && e.location === "/staff"
        ? "↪ /staff"
        : e.status === 307 && e.location === "/sin-acceso"
          ? "⛔ sin-acceso"
          : e.status === 307
            ? `↪ ${e.location}`
            : String(e.status);

// Marcadores que Next deja en el HTML cuando un notFound()/redirect() ocurre ya iniciado el streaming (HTTP 200).
const STREAM_FAILURE = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_REDIRECT;/;
// Encabezados de not-found / error boundary de la app: la página "permitida" no debe mostrarlos.
const NOT_OK_HEADINGS = /No pudimos cargar|Esta mesa (no|ya no) está puesta|No encontramos (este|esta)|Esta invitación no está disponible|Este enlace no es válido|Application error|No tienes acceso/;

const zoneRole: Record<string, E2ERole | null> = { admin: "owner", staff: "staff" };

test.describe("Matriz rol × página", { tag: ["@module:auth", "@permissions"] }, () => {
  let ids: Ids;
  test.beforeAll(async ({ db }) => {
    ids = await seedIds(db);
  });

  inventory
    .slice()
    .sort((a, b) => a.route.localeCompare(b.route))
    .forEach((p, i) => {
      const id = `PERM-${String(i + 1).padStart(3, "0")}`;
      const zone = p.group;
      const prio = zone === "admin" || zone === "staff" ? "@P0" : zone === "experience" ? "@P1" : "@P2";
      test(`[${id}] ${p.route} — anónimo/staff/owner/superadmin`, { tag: [prio] }, async ({ apiAs, rolePage, anonPage, evidence }) => {
        const url = resolve(p.route, ids);
        evidence("owner", `URL ${url} · zona ${zone}${p.permission ? ` · permiso ${p.permission}` : ""}`);
        const observed: Record<string, string> = {};
        const failures: string[] = [];
        for (const role of ROLES) {
          const api = await apiAs(role === "anon" ? null : role);
          const res = await probe(api, url);
          observed[role] = symbol(res);
          const exp = expected(zone, role, url);
          if (res.status !== exp.status) failures.push(`${role}: status ${res.status} (esperado ${exp.status}) ${res.location ?? ""}`);
          else if (exp.status === 307 && res.location !== exp.location)
            failures.push(`${role}: Location ${res.location} (esperado ${exp.location})`);
          else if (exp.status === 200) {
            const html = await res.text();
            if (STREAM_FAILURE.test(html)) {
              observed[role] = `**200 con ${html.match(STREAM_FAILURE)![0]}**`;
              failures.push(`${role}: HTML con ${html.match(STREAM_FAILURE)![0]}`);
            }
            if (zone === "admin" || zone === "staff" || zone === "experience" || url.startsWith("/login")) {
              if (!/noindex/.test(res.headers["x-robots-tag"] ?? "")) failures.push(`${role}: falta X-Robots-Tag noindex`);
            }
          }
        }
        test.info().annotations.push({ type: "matriz", description: JSON.stringify({ id, route: p.route, url, zone, permission: p.permission ?? null, ...observed }) });

        // Nivel UI con el rol principal de la zona
        const primary = zoneRole[zone] ?? null;
        const page = primary ? await rolePage(primary) : await anonPage();
        const resp = await page.goto(url);
        expect(resp?.status(), `UI ${primary ?? "anónimo"}: status`).toBe(200);
        expect(new URL(page.url()).pathname, "sin redirección inesperada").toBe(new URL(url, "http://x").pathname);
        // La vista de impresión no tiene encabezados (observación a11y en access.md): se valida su <article>.
        if (p.route.endsWith("/print")) await expect(page.getByRole("main").getByRole("article")).toBeVisible();
        const h1 = page.locator(p.route.endsWith("/print") ? "article" : "h1").first();
        await expect(h1, "encabezado principal visible").toBeVisible();
        if (p.route !== "/sin-acceso") await expect(h1, "no es una pantalla de error/no encontrado").not.toHaveText(NOT_OK_HEADINGS);
        await expect(page.getByText(/Application error|No pudimos cargar/)).toHaveCount(0);

        expect(failures, `divergencias en ${url}`).toEqual([]);
      });
    });

  test("[PERM-090] el inventario cubre las 83 páginas y todas tienen fila en la matriz", { tag: ["@P2"] }, async ({ evidence }) => {
    evidence("owner", "coherencia inventario ↔ matriz");
    expect(inventory.length).toBe(83);
    for (const p of inventory) expect(() => resolve(p.route, ids), p.route).not.toThrow();
  });
});
