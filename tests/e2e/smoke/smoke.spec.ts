/**
 * SMOKE (@smoke): ¿vale la pena seguir probando? Arranque, base, login por rol, páginas públicas,
 * una lectura por área admin, portal staff y un enlace por token. Rápido y SIN escrituras
 * (salvo lastLoginAt del login real). Cada lectura se contrasta con un dato real de la base.
 */
import {
  ACCOUNTS,
  PASSWORD,
  TOKENS,
  expect,
  loginViaUi,
  test,
  toleratesStaleExperienceCache,
  type E2ERole,
} from "../critical/_helpers";

const ROLES_ALL: E2ERole[] = ["superadmin", "owner", "owner2", "staff", "staff2"];

test.describe("Smoke", { tag: ["@smoke"] }, () => {
  // ---------------------------------------------------------------- infraestructura
  test("[SMK-001] health y base de datos responden", { tag: ["@P0", "@module:api"] }, async ({ request, evidence }) => {
    evidence("anonimo", "GET /api/health y /api/health/db");
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const db = await request.get("/api/health/db");
    expect(db.status()).toBe(200);
    expect(await db.json()).toMatchObject({ status: "ok", database: "up" });
  });

  // ---------------------------------------------------------------- login por rol
  for (const [i, role] of ROLES_ALL.entries()) {
    const acc = ACCOUNTS[role];
    test(
      `[SMK-00${i + 2}] login por formulario de ${role} (${acc.appRole}) llega a su home ${acc.home}`,
      { tag: ["@P0", "@module:auth"] },
      async ({ page, evidence }) => {
        evidence(role, `Login UI → ${acc.home}`);
        await loginViaUi(page, acc.email, PASSWORD, acc.home === "/admin" ? /^\/admin$/ : /^\/staff$/);
        if (acc.home === "/admin") {
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hola, ${acc.name.split(" ")[0]}`);
        } else {
          await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
        }
      },
    );
  }

  // ---------------------------------------------------------------- sitio público
  const PUBLIC: Array<{ id: string; path: string; h1: RegExp | string; p: "@P0" | "@P1" }> = [
    { id: "SMK-010", path: "/", h1: /.+/, p: "@P0" },
    { id: "SMK-011", path: "/experiencias", h1: /.+/, p: "@P0" },
    { id: "SMK-012", path: "/experiencias/signature-brunch", h1: "Signature Brunch", p: "@P0" },
    { id: "SMK-013", path: "/crear-experiencia", h1: "Diseñemos juntas tu celebración", p: "@P0" },
    { id: "SMK-014", path: "/contacto", h1: /.+/, p: "@P0" },
    { id: "SMK-015", path: "/como-funciona", h1: /.+/, p: "@P1" },
    { id: "SMK-016", path: "/nuestra-historia", h1: /.+/, p: "@P1" },
    { id: "SMK-017", path: "/privacidad", h1: /.+/, p: "@P1" },
    { id: "SMK-018", path: "/terminos", h1: /.+/, p: "@P1" },
    { id: "SMK-019", path: "/login", h1: "Bienvenida de vuelta", p: "@P0" },
  ];
  for (const pg of PUBLIC) {
    test(`[${pg.id}] página pública ${pg.path} carga con su contenido y sin errores`, { tag: [pg.p, "@module:public"] }, async ({ page, db, guard, evidence }) => {
      evidence("anonimo", `GET ${pg.path}`);
      const res = await page.goto(pg.path);
      expect(res?.status()).toBe(200);
      if (pg.path.startsWith("/experiencias/")) await toleratesStaleExperienceCache(page, db, guard, pg.path.split("/")[2]!);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(pg.h1);
      await expect(page.getByRole("main")).toBeVisible();
      if (pg.path !== "/login") await expect(page.getByRole("contentinfo")).toBeVisible();
    });
  }

  test("[SMK-020] catálogo público muestra las experiencias activas de la base", { tag: ["@P1", "@module:public"] }, async ({ page, db, evidence }) => {
    evidence("anonimo", "/experiencias vs experience.active");
    const active = await db.experience.findMany({ where: { active: true }, select: { name: true } });
    await page.goto("/experiencias");
    for (const e of active) await expect(page.getByRole("main").getByText(e.name, { exact: true }).first()).toBeVisible();
  });

  // ---------------------------------------------------------------- una lectura por área admin
  test("[SMK-021] dashboard admin con saludo y paneles", { tag: ["@P1", "@module:analytics"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin");
    const page = await rolePage("owner");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hola, ${ACCOUNTS.owner.name.split(" ")[0]}`);
    await expect(page.getByRole("heading", { name: "Próximos 7 días" })).toBeVisible();
  });

  test("[SMK-022] leads: lista y búsqueda muestran un lead real", { tag: ["@P1", "@module:leads"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/leads?q=<código>");
    const lead = await db.lead.findFirstOrThrow({ where: { status: "NEW" }, orderBy: { createdAt: "asc" } });
    const page = await rolePage("owner");
    await page.goto(`/admin/leads?q=${encodeURIComponent(lead.code)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
  });

  test("[SMK-023] cotizaciones: lista con la propuesta sembrada", { tag: ["@P1", "@module:quotes"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/quotes");
    const q = await db.quote.findUniqueOrThrow({ where: { publicToken: TOKENS.quoteLucia } });
    const page = await rolePage("owner");
    await page.goto("/admin/quotes");
    await expect(page.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /^Q-/ }).first()).toBeVisible();
    // Otras pruebas del carril crean cotizaciones y la sembrada puede quedar fuera de la 1.ª página: se busca por código.
    await page.goto(`/admin/quotes?q=${encodeURIComponent(q.code)}`);
    await expect(page.getByRole("table", { name: "Listado de cotizaciones" }).getByRole("link", { name: q.code })).toBeVisible();
  });

  test("[SMK-024] eventos: lista y detalle de un evento real", { tag: ["@P1", "@module:events"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/events → detalle");
    const ev = await db.event.findFirstOrThrow({ where: { portalToken: TOKENS.portalSofia } });
    const page = await rolePage("owner");
    await page.goto("/admin/events");
    await expect(page.getByRole("heading", { level: 1, name: "Eventos" })).toBeVisible();
    await page.goto(`/admin/events/${ev.id}`);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pagos" })).toBeVisible();
  });

  test("[SMK-025] calendario del mes", { tag: ["@P1", "@module:calendar"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/calendar");
    const page = await rolePage("owner");
    await page.goto("/admin/calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible();
  });

  test("[SMK-026] inventario muestra artículos de la base", { tag: ["@P1", "@module:inventory"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/inventory");
    const item = await db.inventoryItem.findFirstOrThrow({ where: { active: true }, orderBy: { name: "asc" } });
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory?q=${encodeURIComponent(item.name)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Inventario" })).toBeVisible();
    await expect(page.getByText(item.name).first()).toBeVisible();
  });

  test("[SMK-027] compras y proveedores", { tag: ["@P1", "@module:purchases"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/purchases y /admin/vendors");
    const vendor = await db.vendor.findFirstOrThrow({ orderBy: { name: "asc" } });
    const page = await rolePage("owner");
    await page.goto("/admin/purchases");
    await expect(page.getByRole("heading", { level: 1, name: "Compras" })).toBeVisible();
    await page.goto("/admin/vendors");
    await expect(page.getByRole("heading", { level: 1, name: "Proveedores" })).toBeVisible();
    await expect(page.getByText(vendor.name).first()).toBeVisible();
  });

  test("[SMK-028] finanzas con eventos y totales", { tag: ["@P1", "@module:finance"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/finance");
    const page = await rolePage("owner");
    await page.goto("/admin/finance");
    await expect(page.getByRole("heading", { level: 1, name: "Finanzas" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Cumpleaños de Sofía" }).first()).toBeVisible();
  });

  test("[SMK-029] ajustes del negocio cargan los valores guardados", { tag: ["@P1", "@module:settings"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings");
    const row = await db.setting.findUnique({ where: { key: "business" } });
    const brand = ((row?.value ?? {}) as { brandName?: string }).brandName ?? "Ivonne & Rosa";
    const page = await rolePage("owner");
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Configuración" })).toBeVisible();
    await expect(page.getByLabel("Nombre de la marca")).toHaveValue(brand);
  });

  // ---------------------------------------------------------------- portal staff
  test("[SMK-030] portal staff: Lupita ve sólo sus eventos asignados", { tag: ["@P1", "@module:staff", "@mobile"] }, async ({ rolePage, evidence }) => {
    evidence("staff", "/staff");
    const page = await rolePage("staff");
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Cumpleaños de Sofía/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Karaoke & Mimosas de Daniela/ })).toBeVisible();
    await expect(page.getByText("Bridal Brunch de Mariana")).toHaveCount(0);
  });

  // ---------------------------------------------------------------- enlaces por token (sólo lectura)
  test("[SMK-031] cotización por token (Lucía)", { tag: ["@P0", "@module:quotes", "@mobile"] }, async ({ page, db, evidence }) => {
    evidence("clienta", "/cotizacion/[token]");
    const q = await db.quote.findUniqueOrThrow({ where: { publicToken: TOKENS.quoteLucia } });
    await page.goto(`/cotizacion/${TOKENS.quoteLucia}`);
    await expect(page.getByRole("heading", { level: 1, name: q.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar propuesta" }).first()).toBeVisible();
  });

  test("[SMK-032] portal de la clienta por token (Sofía)", { tag: ["@P0", "@module:portal", "@mobile"] }, async ({ page, evidence }) => {
    evidence("clienta", "/mi-evento/[token]");
    await page.goto(`/mi-evento/${TOKENS.portalSofia}`);
    await expect(page.getByRole("heading", { level: 1, name: "Cumpleaños de Sofía" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pago" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Invitadas" })).toBeVisible();
  });

  test("[SMK-033] invitación general y RSVP personal (Sofía / Camila)", { tag: ["@P0", "@module:guests", "@mobile"] }, async ({ page, evidence }) => {
    evidence("invitada", "/e/[slug]/[inviteToken] y /e/[slug]/[guestToken]");
    await page.goto(`/e/${TOKENS.micrositeSofia}/${TOKENS.inviteSofia}`);
    await expect(page.getByRole("heading", { level: 1, name: "Cumpleaños de Sofía" })).toBeVisible();
    await page.goto(`/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila}`);
    await expect(page.getByRole("heading", { name: "Camila, ¿nos acompañas?" })).toBeVisible();
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Camila Torres");
  });

  test("[SMK-034] Memory Capsule pública por token (Valeria)", { tag: ["@P0", "@module:memory", "@mobile"] }, async ({ page, evidence }) => {
    evidence("invitada", "/memory/[token]");
    await page.goto(`/memory/${TOKENS.memoryValeria}`);
    await expect(page.getByRole("heading", { level: 1, name: "Perú x México de Valeria" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deja tu mensaje" })).toBeVisible();
  });

  test("[SMK-035] token inválido responde 404 genérico sin datos", { tag: ["@P1", "@module:portal", "@negative"] }, async ({ page, guard, evidence }) => {
    // Esperado: 404 en cada enlace inventado (el navegador lo registra en consola).
    guard.allow(/status of 404/);
    evidence("anonimo", "tokens inexistentes en cotización/portal/cápsula");
    for (const path of [
      "/cotizacion/token-inexistente-e2e-0000000000",
      "/mi-evento/token-inexistente-e2e-0000000000",
      "/memory/token-inexistente-e2e-0000000000",
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} → 404`).toBe(404);
      await expect(page.getByText(/Cumpleaños de|Valeria|Lucía/)).toHaveCount(0);
    }
  });
});
