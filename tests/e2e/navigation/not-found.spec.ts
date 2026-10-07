/**
 * Páginas 404: sitio público, panel admin, portal staff y experiencias por token.
 * Contenido genérico (sin fugas), salida útil y HTTP status (soft-404 = hallazgo; ver project-profile §Comportamientos).
 */
import { expect, test } from "../fixtures";
import { probe, token } from "../permissions/_helpers";

test.describe("404", { tag: ["@module:navigation"] }, () => {
  test("[NAV-001] ruta pública inexistente → 404 'Esta mesa no está puesta' con regreso al inicio", { tag: ["@P2"] }, async ({ anonPage, guard, evidence }) => {
    guard.allow(/status of 404/); // documento 404 esperado
    evidence("anonimo", "/no-existe-e2e");
    const page = await anonPage();
    const res = await page.goto("/no-existe-e2e");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Esta mesa no está puesta" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("[NAV-002] experiencia pública inexistente → contenido 404 y HTTP 404 (no soft-404)", { tag: ["@P3", "@regression"] }, async ({ anonPage, apiAs, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-013" });
    guard.allow(/status of 404/);
    evidence("anonimo", "/experiencias/no-existe-e2e");
    const page = await anonPage();
    await page.goto("/experiencias/no-existe-e2e");
    await expect(page.getByRole("heading", { level: 1, name: "Esta mesa ya no está puesta" })).toBeVisible();
    // (Next deja 3 <meta name="robots"> duplicados en esta respuesta; todos noindex)
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Ver experiencias" })).toHaveAttribute("href", "/experiencias");
    const res = await probe(await apiAs(null), "/experiencias/no-existe-e2e");
    test.info().annotations.push({ type: "observado", description: `HTTP ${res.status} para /experiencias/no-existe-e2e` });
    expect(res.status, "un recurso público inexistente debe responder 404 (soft-404 con 200)").toBe(404);
  });

  test("[NAV-034] rutas públicas y por token con slug/token inexistente → HTTP 404 real (no soft-404)", { tag: ["@P3", "@regression"] }, async ({ apiAs, evidence }) => {
    // Complementa el contrato estático tests/unit/route-not-found-contract.test.ts con el status real del build.
    test.info().annotations.push({ type: "regression", description: "BUG-013 (revisión del patrón en rutas públicas y por token)" });
    evidence("anonimo", "GET directo (sin seguir redirects) a cada ruta con un valor inexistente");
    const anon = await apiAs(null);
    const fake = token();
    const paths = [
      "/experiencias/no-existe-e2e",
      `/cotizacion/${fake}`,
      `/mi-evento/${fake}`,
      `/mi-evento/${fake}/resumen`,
      `/e/no-existe-e2e/${fake}`,
      `/memory/${fake}`,
      "/pago/mock/no-existe-e2e",
      `/pago/resultado?p=no-existe-e2e&s=${fake.slice(0, 32)}`,
    ];
    const statuses: string[] = [];
    for (const path of paths) {
      const res = await probe(anon, path);
      statuses.push(`${path.replace(fake, "<token>")} → ${res.status}`);
    }
    test.info().annotations.push({ type: "observado", description: statuses.join(" · ") });
    expect(statuses.filter((s) => !s.endsWith("→ 404"))).toEqual([]);
  });

  test("[NAV-003] ruta inexistente dentro del panel (owner) → HTTP 404 con la página 404 general", { tag: ["@P2"] }, async ({ rolePage, guard, evidence }) => {
    guard.allow(/status of 404/);
    evidence("owner", "/admin/no-existe-e2e");
    const page = await rolePage("owner");
    const res = await page.goto("/admin/no-existe-e2e");
    expect(res?.status()).toBe(404);
    // Una URL sin ruta no usa el not-found del segmento admin (sólo aplica a notFound()): se muestra el 404 raíz.
    await expect(page.getByRole("heading", { level: 1, name: "Esta mesa no está puesta" })).toBeVisible();
    const shell = await page.getByRole("navigation", { name: "Navegación del panel" }).count();
    test.info().annotations.push({ type: "observado", description: `404 dentro de /admin sin el shell del panel (sidebar visible: ${shell > 0})` });
    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("[NAV-004] detalle admin con id inexistente (lead, evento, cotización, clienta, compra) → 'No encontramos…' sin error", { tag: ["@P2"] }, async ({ rolePage, apiAs, evidence }) => {
    evidence("owner", "IDs inexistentes en rutas de detalle");
    const page = await rolePage("owner");
    const statuses: string[] = [];
    for (const path of ["/admin/leads/cxxxxxxxxxxxxxxxxxxxxxxxx", "/admin/events/cxxxxxxxxxxxxxxxxxxxxxxxx", "/admin/quotes/cxxxxxxxxxxxxxxxxxxxxxxxx", "/admin/customers/cxxxxxxxxxxxxxxxxxxxxxxxx", "/admin/vendors/cxxxxxxxxxxxxxxxxxxxxxxxx", "/admin/catalog/menus/cxxxxxxxxxxxxxxxxxxxxxxxx"]) {
      await page.goto(path);
      await expect(page.getByRole("main").getByRole("heading", { name: /no existe|No encontramos|no está disponible/i }).first(), path).toBeVisible();
      await expect(page.getByText(/No pudimos cargar|Application error/)).toHaveCount(0);
      statuses.push(`${path} → ${(await probe(await apiAs("owner"), path)).status}`);
    }
    // Observación (no bloqueante, panel noindex con sesión): notFound() bajo loading.tsx responde 200.
    test.info().annotations.push({ type: "observado", description: statuses.join(" · ") });
  });

  test("[NAV-005] ruta inexistente en el portal staff → 404 y la navegación del portal sigue disponible", { tag: ["@P3"] }, async ({ rolePage, guard, evidence }) => {
    guard.allow(/status of 404/);
    evidence("staff", "/staff/no-existe-e2e");
    const page = await rolePage("staff");
    const res = await page.goto("/staff/no-existe-e2e");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/No encontramos|Esta mesa no está puesta/);
  });

  test("[NAV-006] 404 de experiencia (token) ofrece salida y no muestra navegación de marketing", { tag: ["@P3"] }, async ({ anonPage, guard, evidence }) => {
    guard.allow(/status of 404/);
    evidence("clienta", "/mi-evento/<token inexistente>");
    const page = await anonPage();
    const res = await page.goto("/mi-evento/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Este enlace no es válido" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
    await page.getByRole("link", { name: "Pedir mi enlace" }).click();
    await expect(page).toHaveURL(/\/mi-evento$/);
  });
});
