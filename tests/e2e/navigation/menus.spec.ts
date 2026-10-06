/**
 * Navegación: sidebar del panel (estado activo), menú móvil, cabecera pública, migas de pan, enlaces "volver",
 * atrás/adelante y enlace "Saltar al contenido".
 */
import { expect, test } from "../fixtures";
import { seedIds } from "../permissions/_helpers";

const SIDEBAR = [
  ["Resumen", "/admin"],
  ["Leads", "/admin/leads"],
  ["Clientes", "/admin/customers"],
  ["Experiencias", "/admin/catalog"],
  ["Cotizaciones", "/admin/quotes"],
  ["Eventos", "/admin/events"],
  ["Calendario", "/admin/calendar"],
  ["Operaciones", "/admin/operations"],
  ["Inventario", "/admin/inventory"],
  ["Compras", "/admin/purchases"],
  ["Proveedores", "/admin/vendors"],
  ["Staff", "/admin/staff"],
  ["Finanzas", "/admin/finance"],
  ["Contenido", "/admin/content"],
  ["Analytics", "/admin/analytics"],
  ["Bandeja (mock)", "/admin/notifications"],
  ["Configuración", "/admin/settings"],
] as const;

test.describe("Navegación del panel", { tag: ["@module:navigation"] }, () => {
  test("[NAV-020] sidebar (owner): cada sección navega, marca aria-current y muestra su encabezado", { tag: ["@P1"] }, async ({ rolePage, evidence }) => {
    test.setTimeout(180_000);
    evidence("owner", "17 secciones");
    const page = await rolePage("owner");
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Navegación del panel" });
    await expect(nav.getByRole("link")).toHaveText(SIDEBAR.map(([l]) => l));
    for (const [label, href] of SIDEBAR) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await page.waitForURL((u) => u.pathname === href);
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(page.getByRole("main").locator("h1").first()).toBeVisible();
    }
  });

  test("[NAV-021] superadmin ve las mismas 17 secciones; staff no ve el panel", { tag: ["@P2"] }, async ({ rolePage, evidence }) => {
    evidence("superadmin", "también staff");
    const sa = await rolePage("superadmin");
    await sa.goto("/admin");
    await expect(sa.getByRole("navigation", { name: "Navegación del panel" }).getByRole("link")).toHaveCount(17);
    const staff = await rolePage("staff");
    await staff.goto("/admin/leads");
    await expect(staff).toHaveURL(/\/staff$/);
    await expect(staff.getByRole("navigation", { name: "Navegación del panel" })).toHaveCount(0);
  });

  test("[NAV-022] menú móvil del panel (390 px): abre, navega y se cierra", { tag: ["@P2", "@mobile"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "viewport 390×844");
    const page = await rolePage("owner");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Eventos", exact: true }).click();
    await page.waitForURL(/\/admin\/events$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("main").locator("h1").first()).toBeVisible();
  });

  test("[NAV-023] atrás/adelante entre secciones del panel conserva la página correcta", { tag: ["@P2"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin → /admin/leads → /admin/events → atrás → adelante");
    const page = await rolePage("owner");
    const nav = page.getByRole("navigation", { name: "Navegación del panel" });
    await page.goto("/admin");
    await nav.getByRole("link", { name: "Leads", exact: true }).click();
    await page.waitForURL(/\/admin\/leads$/);
    const leadsH1 = await page.getByRole("main").locator("h1").first().innerText();
    await nav.getByRole("link", { name: "Eventos", exact: true }).click();
    await page.waitForURL(/\/admin\/events$/);
    await page.goBack();
    await page.waitForURL(/\/admin\/leads$/);
    await expect(page.getByRole("main").locator("h1").first()).toHaveText(leadsH1);
    await expect(nav.getByRole("link", { name: "Leads", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goForward();
    await page.waitForURL(/\/admin\/events$/);
    await expect(nav.getByRole("link", { name: "Eventos", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("[NAV-024] enlaces 'volver' de los detalles (lead, staff portal) regresan al listado", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    const ids = await seedIds(db);
    evidence("owner", `/admin/leads/${ids.leadId} y /staff/events/${ids.eventSofia}`);
    const owner = await rolePage("owner");
    await owner.goto("/admin/leads");
    await owner.goto(`/admin/leads/${ids.leadId}`);
    const back = owner.getByRole("main").getByRole("link", { name: /Leads/ }).first();
    await back.click();
    await owner.waitForURL(/\/admin\/leads(\?|$)/);
    const staff = await rolePage("staff");
    await staff.goto(`/staff/events/${ids.eventSofia}`);
    await staff.getByRole("main").getByRole("link", { name: "Mis eventos" }).click();
    await staff.waitForURL(/\/staff$/);
  });
});

test.describe("Navegación pública", { tag: ["@module:navigation"] }, () => {
  test("[NAV-030] cabecera pública: cada enlace navega y marca aria-current; CTA lleva al configurador", { tag: ["@P1"] }, async ({ anonPage, evidence }) => {
    evidence("anonimo", "1440 px");
    const page = await anonPage();
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const [label, href] of [["Experiencias", "/experiencias"], ["Cómo funciona", "/como-funciona"], ["Nuestra historia", "/nuestra-historia"], ["Contacto", "/contacto"]] as const) {
      await nav.getByRole("link", { name: label }).click();
      await page.waitForURL((u) => u.pathname === href);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
      await expect(page.locator("h1").first()).toBeVisible();
    }
    await page.getByRole("banner").getByRole("link", { name: "Diseña tu experiencia" }).click();
    await page.waitForURL(/\/crear-experiencia$/);
    await page.getByRole("banner").getByRole("link", { name: "Mi evento" }).click();
    await page.waitForURL(/\/mi-evento$/);
  });

  test("[NAV-031] menú móvil público (390 px): abre, navega y cierra", { tag: ["@P2", "@mobile"] }, async ({ anonPage, evidence }) => {
    evidence("anonimo", "390×844");
    const page = await anonPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const nav = page.getByRole("navigation", { name: "Principal (móvil)" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Cómo funciona" }).click();
    await page.waitForURL(/\/como-funciona$/);
    await expect(nav).toBeHidden();
  });

  test("[NAV-032] migas de pan en la ficha de experiencia: Inicio › Experiencias › nombre", { tag: ["@P2"] }, async ({ anonPage, db, evidence }) => {
    const exp = await db.experience.findFirstOrThrow({ where: { active: true }, orderBy: { createdAt: "asc" } });
    evidence("anonimo", `/experiencias/${exp.slug}`);
    const page = await anonPage();
    await page.goto(`/experiencias/${exp.slug}`);
    const crumbs = page.getByRole("navigation", { name: "Migas de pan" });
    await expect(crumbs.getByRole("listitem")).toHaveCount(3);
    await expect(crumbs).toContainText(exp.name);
    await expect(crumbs.getByRole("link")).toHaveCount(2);
    await crumbs.getByRole("link", { name: "Experiencias" }).click();
    await page.waitForURL(/\/experiencias$/);
    await page.goBack();
    await page.waitForURL(new RegExp(`/experiencias/${exp.slug}$`));
    await page.getByRole("navigation", { name: "Migas de pan" }).getByRole("link", { name: "Inicio" }).click();
    await page.waitForURL((u) => u.pathname === "/");
  });

  test("[NAV-033] 'Saltar al contenido' es el primer foco y lleva al <main>", { tag: ["@P2", "@a11y"] }, async ({ anonPage, rolePage, evidence }) => {
    evidence("anonimo", "también panel owner");
    for (const [page, path] of [[await anonPage(), "/"], [await rolePage("owner"), "/admin"]] as const) {
      await page.goto(path);
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Saltar al contenido" });
      await expect(skip).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#contenido$/);
      await expect(page.locator("#contenido")).toBeVisible();
    }
  });
});
