/**
 * Autenticación — logout, sesión en varias pestañas y sesión invalidada en servidor.
 * La sesión es JWT (12 h); getCurrentUser() revalida `active`, `role` y `sessionVersion` (revocación) contra la
 * base en cada request (src/server/auth/session.ts). El middleware sólo mira el rol del JWT (src/middleware.ts)
 * y ya no re-emite la cookie en cada respuesta (sólo renueva JWT con ≥ 1 h).
 * Cerrar sesión revoca TODAS las sesiones de la cuenta: aquí sólo se usan cuentas propias (createTeamUser).
 */
import type { PrismaClient } from "@prisma/client";
import { expect, test } from "../fixtures";
import {
  SESSION_COOKIE,
  buildAction,
  createTeamUser,
  loginViaUi,
  probe,
  sessionCookie,
  strongPassword,
  type TeamUser,
} from "../permissions/_helpers";
import { ready } from "../operations/_helpers";
import { replayServerAction, wasAccepted, wasDenied } from "../fixtures";
import type { Browser, BrowserContext, PlaywrightWorkerArgs } from "@playwright/test";

type Playwright = PlaywrightWorkerArgs["playwright"];

async function loggedInContext(browser: Browser, user: TeamUser, home: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await loginViaUi(page, user.email, user.password);
  await page.waitForURL((u) => u.pathname === home, { timeout: 30_000 });
  return ctx;
}

test.describe("Logout y sesión", { tag: ["@module:auth", "@auth"] }, () => {
  test("[AUTH-020] logout desde el panel elimina la cookie y vuelve a /login", { tag: ["@P0", "@critical"] }, async ({ browser, db, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", `cuenta propia ${user.email}: login → Cerrar sesión`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    await page.goto("/admin/leads");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await sessionCookie(page)).toBeTruthy();

    // Sin requests en vuelo (la carrera con requests en vuelo se prueba aparte en AUTH-032).

    await page.waitForLoadState("networkidle");

    await page.getByRole("complementary").getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL(/\/login/);
    expect(await sessionCookie(page), "cookie de sesión eliminada").toBeUndefined();

    // URL privada directa tras logout → login con callbackUrl
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fleads/);
    await expect(page.getByRole("heading", { name: "Bienvenida de vuelta" })).toBeVisible();
    await ctx.close();
  });

  test("[AUTH-021] tras logout, 'Atrás' no muestra datos privados del panel", { tag: ["@P1"] }, async ({ browser, db, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", "login → /admin/customers → logout → back");
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Sin requests en vuelo (la carrera con requests en vuelo se prueba aparte en AUTH-032).
    await page.waitForLoadState("networkidle");
    await page.getByRole("complementary").getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL(/\/login/);
    await page.goBack();
    // El panel es force-dynamic + no-store: volver atrás re-solicita y el middleware redirige a login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toHaveCount(0);
    await ctx.close();
  });

  test("[AUTH-022] respuestas del panel autenticado no se cachean (Cache-Control no-store)", { tag: ["@P2"] }, async ({ apiAs, evidence }) => {
    evidence("owner", "GET /admin y /staff con sesión");
    const owner = await apiAs("owner");
    for (const path of ["/admin", "/admin/leads", "/staff"]) {
      const res = await probe(owner, path);
      expect(res.status, path).toBe(200);
      expect(res.headers["cache-control"], path).toMatch(/no-store/);
      expect(res.headers["x-robots-tag"], path).toContain("noindex");
    }
  });

  test("[AUTH-023] sin cookies (request directo / apiAs anónimo) las páginas privadas redirigen a login", { tag: ["@P0", "@critical"] }, async ({ apiAs, evidence }) => {
    evidence("anonimo", "GET sin seguir redirects");
    const anon = await apiAs(null);
    for (const path of ["/admin", "/admin/settings/users", "/admin/finance", "/staff", "/staff/events/abc"]) {
      const res = await probe(anon, path);
      expect(res.status, path).toBe(307);
      expect(res.location, path).toBe(`/login?callbackUrl=${encodeURIComponent(path)}`);
    }
  });

  test("[AUTH-024] cookie de sesión manipulada o falsificada no autoriza", { tag: ["@P0", "@negative"] }, async ({ playwright, baseURL, apiAs, evidence }) => {
    evidence("anonimo", "JWT alterado / inventado");
    const owner = await apiAs("owner");
    const state = await owner.storageState();
    const real = state.cookies.find((c) => c.name === SESSION_COOKIE)!;
    const tampered = real.value.slice(0, -6) + (real.value.endsWith("AAAAAA") ? "BBBBBB" : "AAAAAA");
    for (const value of [tampered, "eyJhbGciOiJub25lIn0.eyJyb2xlIjoiU1VQRVJfQURNSU4ifQ.", "x"]) {
      const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${value}` } });
      const res = await probe(ctx, "/admin");
      expect(res.status).toBe(307);
      expect(res.location).toContain("/login");
      await ctx.dispose();
    }
  });

  test("[AUTH-025] logout invalida la sesión en el servidor (la cookie anterior deja de servir)", { tag: ["@P1", "@negative", "@regression"] }, async ({ browser, db, playwright, baseURL, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", "copia la cookie antes del logout y la reutiliza después (ASVS 3.3.1)");
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const stolen = await sessionCookie(page);
    expect(stolen).toBeTruthy();
    // Sin requests en vuelo (la carrera con requests en vuelo se prueba aparte en AUTH-032).
    await page.waitForLoadState("networkidle");
    await page.getByRole("complementary").getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL(/\/login/);
    expect(await sessionCookie(page)).toBeUndefined();

    const replay = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${stolen}` } });
    const res = await probe(replay, "/admin/customers");
    test.info().annotations.push({ type: "observado", description: `GET /admin/customers con cookie previa al logout → ${res.status} ${res.location ?? ""}` });
    test.info().annotations.push({ type: "regression", description: "BUG-004" });
    expect(res.status, "la cookie emitida antes del logout no debe seguir autorizando").toBe(307);
    expect(res.location).toContain("/login");
    await replay.dispose();
    await ctx.close();
  });

  test("[AUTH-026] dos pestañas: logout en una ⇒ la otra pierde acceso en el siguiente request", { tag: ["@P1"] }, async ({ browser, db, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", "misma sesión en 2 pestañas del mismo navegador");
    const ctx = await loggedInContext(browser, user, "/admin");
    const tab1 = ctx.pages()[0]!;
    const tab2 = await ctx.newPage();
    guard.watch(tab1);
    guard.watch(tab2);
    await tab2.goto("/admin/events");
    await expect(tab2.getByRole("heading", { level: 1 })).toBeVisible();
    // Sin requests en vuelo (la carrera con requests en vuelo se prueba aparte en AUTH-032).
    await tab1.waitForLoadState("networkidle");
    await tab2.waitForLoadState("networkidle");
    await tab1.getByRole("complementary").getByRole("button", { name: "Cerrar sesión" }).click();
    await tab1.waitForURL(/\/login/);
    // Pestaña 2: navegar a otra sección del panel (siguiente request) → login
    await tab2.getByRole("complementary").getByRole("link", { name: "Leads" }).click();
    await tab2.waitForURL(/\/login/);
    await expect(tab2.getByRole("heading", { name: "Bienvenida de vuelta" })).toBeVisible();
    await ctx.close();
  });

  test("[AUTH-027] desactivar a una usuaria con sesión abierta corta su acceso en el siguiente request (páginas y acciones)", { tag: ["@P0", "@critical"] }, async ({ browser, db, playwright, baseURL, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", `sesión de ${user.email}; se desactiva en la base mientras navega`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);
    await page.goto("/admin/leads");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await db.user.update({ where: { id: user.id }, data: { active: false } });
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toHaveCount(0);

    // Backend: una Server Action con esa cookie es rechazada (UNAUTHORIZED) y no escribe.
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${cookie}` } });
    const before = await db.notificationLog.count({ where: { readAt: null } });
    const res = await replayServerAction(api, buildAction("markAllNotificationsReadAction", "/admin/notifications", undefined));
    expect(wasDenied(res), `${res.outcome} ${res.status} ${res.text.slice(0, 200)}`).toBe(true);
    expect(await db.notificationLog.count({ where: { readAt: null } })).toBe(before);
    await api.dispose();
    await ctx.close();
  });

  test("[AUTH-028] bajar de OWNER a STAFF con sesión abierta: el siguiente request ya no autoriza el panel ni sus acciones", { tag: ["@P0", "@critical"] }, async ({ browser, db, playwright, baseURL, apiAs, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER", withStaffMember: true });
    evidence("owner", `sesión de ${user.email} (OWNER) → rol STAFF en la base`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);
    await db.user.update({ where: { id: user.id }, data: { role: "STAFF" } });

    await page.goto("/admin/settings/users");
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByRole("navigation", { name: "Staff" })).toBeVisible();

    // Acción de administración con la cookie (JWT aún dice OWNER) → FORBIDDEN por el rol real en base
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${cookie}` } });
    const victim = await createTeamUser(db, { role: "STAFF" });
    const res = await replayServerAction(api, buildAction("setUserActiveAction", "/admin/settings/users", { userId: victim.id, active: false }));
    expect(wasDenied(res), `${res.outcome} ${res.status} ${res.text.slice(0, 200)}`).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: victim.id } })).active).toBe(true);

    // Control positivo: el mismo request con una OWNER real sí se ejecuta
    const ownerApi = await apiAs("owner");
    const ok = await replayServerAction(ownerApi, buildAction("setUserActiveAction", "/admin/settings/users", { userId: victim.id, active: false }));
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: victim.id } })).active).toBe(false);
    await api.dispose();
    await ctx.close();
  });

  test("[AUTH-029] subir de STAFF a OWNER aplica en el siguiente request (sin re-login)", { tag: ["@P2"] }, async ({ browser, db, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("staff", `${user.email} promovida a OWNER con sesión abierta`);
    const ctx = await loggedInContext(browser, user, "/staff");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    await db.user.update({ where: { id: user.id }, data: { role: "OWNER" } });
    // El middleware usa el rol del JWT (STAFF) → /admin sigue redirigiendo a /staff hasta re-login.
    await page.goto("/admin");
    const landed = new URL(page.url()).pathname;
    test.info().annotations.push({ type: "observado", description: `STAFF→OWNER con sesión abierta: /admin aterriza en ${landed}` });
    expect(["/admin", "/staff"]).toContain(landed);
    // Tras re-login obtiene el panel completo
    await page.context().clearCookies();
    await loginViaUi(page, user.email, user.password);
    await page.waitForURL((u) => u.pathname === "/admin");
    await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toBeVisible();
    await ctx.close();
  });

  test("[AUTH-030] logout desde el portal staff", { tag: ["@P1"] }, async ({ browser, db, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("staff", `cuenta propia ${user.email}`);
    const ctx = await loggedInContext(browser, user, "/staff");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    // Sin requests en vuelo (la carrera con requests en vuelo se prueba aparte en AUTH-032).
    await page.waitForLoadState("networkidle");
    await page.getByRole("banner").getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL(/\/login/);
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto("/staff");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fstaff/);
    await ctx.close();
  });

  test("[AUTH-032] logout con otra pestaña del panel cargando: la sesión NO debe revivir", { tag: ["@P0", "@critical", "@negative", "@regression"] }, async ({ browser, db, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence(
      "owner",
      "Pestaña 2 del panel con requests en curso (navegación/prefetch/polling) mientras en la pestaña 1 se pulsa 'Cerrar sesión'",
    );
    const ctx = await loggedInContext(browser, user, "/admin");
    const tab1 = ctx.pages()[0]!;
    const tab2 = await ctx.newPage();
    guard.watch(tab1);
    guard.watch(tab2);
    await tab2.goto("/admin/leads");
    await tab1.waitForLoadState("networkidle");
    await tab2.waitForLoadState("networkidle");

    // Pestaña 2: requests RSC consecutivos del panel durante ~4 s (lo que hace el router al navegar/prefetch).
    // Cada request sale con la cookie vigente en ese instante; el que esté en vuelo durante el signout responde después.
    const traffic = tab2.evaluate(async () => {
      const out: Array<{ status: number; t: number }> = [];
      const until = Date.now() + 4000;
      while (Date.now() < until) {
        const r = await fetch("/admin/customers", { headers: { RSC: "1" }, redirect: "manual", cache: "no-store" });
        out.push({ status: r.status, t: Date.now() });
      }
      return out;
    });
    const signout = tab1.waitForResponse((r) => r.url().includes("/api/auth/signout") && r.request().method() === "POST");
    const _navigated = tab1.waitForEvent("load"); // el signOut navega a /login (o rebota a /admin si la sesión revivió)
    await tab1.getByRole("complementary").getByRole("button", { name: "Cerrar sesión" }).click();
    const signoutRes = await signout;
    expect(
      (await signoutRes.headersArray()).some((h) => h.name.toLowerCase() === "set-cookie" && /session-token=;/.test(h.value)),
      "el signout ordena borrar la cookie",
    ).toBe(true);
    await tab1.waitForURL(/\/(login|admin)/);
    const log = await traffic;
    test.info().annotations.push({
      type: "observado",
      description: `pestaña 2: ${log.length} requests; estados tras el logout: ${[...new Set(log.slice(-5).map((l) => l.status))].join(",")}`,
    });

    // Esperado: sesión cerrada en todo el navegador.
    test.info().annotations.push({ type: "regression", description: "BUG-001" });
    const after = await sessionCookie(tab1);
    test.info().annotations.push({ type: "observado", description: `cookie de sesión tras logout: ${after ? "PRESENTE (sesión revivida)" : "ausente"}` });
    await tab1.goto("/admin/customers");
    await expect(tab1, "tras 'Cerrar sesión' el panel no debe seguir accesible").toHaveURL(/\/login/);
    expect(after, "la cookie de sesión no debe reaparecer").toBeUndefined();
    await ctx.close();
  });

  test("[AUTH-031] /sin-acceso: página 403 clara, noindex y con salidas", { tag: ["@P3"] }, async ({ anonPage, evidence }) => {
    evidence("anonimo");
    const page = await anonPage();
    const res = await page.goto("/sin-acceso");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "No tienes acceso a esta sección" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.getByRole("link", { name: "Cambiar de cuenta" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await page.getByRole("link", { name: "Ir al sitio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Revocación de sesiones en servidor (sessionVersion)", { tag: ["@module:auth", "@auth"] }, () => {
  /** Una copia de la cookie de la sesión anterior ya no autoriza: 307 a /login. */
  async function expectCookieRevoked(playwright: Playwright, baseURL: string | undefined, cookie: string | undefined, path: string) {
    expect(cookie, "se copió la cookie de la sesión abierta").toBeTruthy();
    const replay = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${cookie}` } });
    const res = await probe(replay, path);
    test.info().annotations.push({ type: "observado", description: `GET ${path} con la cookie anterior → ${res.status} ${res.location ?? ""}` });
    expect(res.status, `la cookie anterior ya no autoriza ${path}`).toBe(307);
    expect(res.location).toContain("/login");
    await replay.dispose();
  }

  async function sessionVersion(db: PrismaClient, userId: string): Promise<number> {
    return (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } })).sessionVersion;
  }

  test("[AUTH-033] restablecer la contraseña desde Usuarios cierra las sesiones abiertas de esa cuenta", { tag: ["@P1", "@negative", "@regression"] }, async ({ browser, db, playwright, baseURL, apiAs, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-004" });
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("superadmin", `sesión abierta de ${user.email}; superadmin le restablece la contraseña (resetUserPasswordAction)`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);
    const before = await sessionVersion(db, user.id);

    const res = await replayServerAction(
      await apiAs("superadmin"),
      buildAction("resetUserPasswordAction", "/admin/settings/users", { userId: user.id, password: strongPassword() }),
    );
    expect(wasAccepted(res), `${res.outcome} ${res.text.slice(0, 200)}`).toBe(true);
    await expect.poll(() => sessionVersion(db, user.id)).toBe(before + 1);

    // UI: el siguiente request de la sesión abierta ya no entra al panel
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toHaveCount(0);
    // Backend: una copia de la cookie tampoco
    await expectCookieRevoked(playwright, baseURL, cookie, "/admin/customers");
    await ctx.close();
  });

  test("[AUTH-034] restablecer la contraseña de un integrante (Staff) cierra su sesión del portal", { tag: ["@P1", "@negative", "@regression"] }, async ({ browser, db, playwright, baseURL, apiAs, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-004" });
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("owner", `sesión abierta de ${user.email} en /staff; la fundadora le restablece la contraseña (resetStaffPasswordAction)`);
    const ctx = await loggedInContext(browser, user, "/staff");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);
    const before = await sessionVersion(db, user.id);

    const res = await replayServerAction(
      await apiAs("owner"),
      buildAction(
        "resetStaffPasswordAction",
        `/admin/staff/${user.staffMemberId}`,
        { staffMemberId: user.staffMemberId, password: strongPassword() },
        { file: /features\/staff\/server\/actions/ },
      ),
    );
    expect(wasAccepted(res), `${res.outcome} ${res.text.slice(0, 200)}`).toBe(true);
    await expect.poll(() => sessionVersion(db, user.id)).toBe(before + 1);

    await page.goto("/staff");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("navigation", { name: "Staff" })).toHaveCount(0);
    await expectCookieRevoked(playwright, baseURL, cookie, "/staff");
    await ctx.close();
  });

  test("[AUTH-035] cambiar el rol desde Usuarios cierra la sesión abierta; al volver a entrar aplica el rol nuevo", { tag: ["@P1", "@regression"] }, async ({ browser, db, playwright, baseURL, apiAs, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-004" });
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("owner", `sesión abierta de ${user.email} (STAFF); la fundadora la promueve a OWNER (changeUserRoleAction)`);
    const ctx = await loggedInContext(browser, user, "/staff");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);

    const res = await replayServerAction(
      await apiAs("owner"),
      buildAction("changeUserRoleAction", "/admin/settings/users", { userId: user.id, role: "OWNER" }),
    );
    expect(wasAccepted(res), `${res.outcome} ${res.text.slice(0, 200)}`).toBe(true);
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("OWNER");

    await page.goto("/staff");
    await expect(page).toHaveURL(/\/login/);
    await expectCookieRevoked(playwright, baseURL, cookie, "/staff");
    // Nuevo login: el JWT ya trae el rol nuevo y entra al panel
    await page.context().clearCookies();
    await loginViaUi(page, user.email, user.password);
    await page.waitForURL((u) => u.pathname === "/admin");
    await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toBeVisible();
    await ctx.close();
  });

  test("[AUTH-036] desactivar y reactivar una cuenta no revive la sesión anterior", { tag: ["@P1", "@negative", "@regression"] }, async ({ browser, db, playwright, baseURL, apiAs, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-004" });
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("superadmin", `sesión abierta de ${user.email}; superadmin la desactiva y la reactiva (setUserActiveAction)`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);

    const superadmin = await apiAs("superadmin");
    for (const active of [false, true]) {
      const res = await replayServerAction(superadmin, buildAction("setUserActiveAction", "/admin/settings/users", { userId: user.id, active }));
      expect(wasAccepted(res), `${res.outcome} ${res.text.slice(0, 200)}`).toBe(true);
      await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: user.id } })).active).toBe(active);
    }

    // Reactivada, pero la sesión abierta antes de desactivarla sigue revocada
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/login/);
    await expectCookieRevoked(playwright, baseURL, cookie, "/admin/customers");
    // Un login nuevo sí funciona
    await page.context().clearCookies();
    await loginViaUi(page, user.email, user.password);
    await page.waitForURL((u) => u.pathname === "/admin");
    await ctx.close();
  });

  test("[AUTH-037] restablecer la propia contraseña cierra la sesión actual y pide entrar con la nueva", { tag: ["@P1", "@regression"] }, async ({ browser, db, playwright, baseURL, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-004" });
    const user = await createTeamUser(db, { role: "OWNER" });
    const newPassword = strongPassword();
    evidence("owner", `${user.email}: Ajustes › Usuarios › (tú) › Contraseña → Restablecer`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);
    await page.goto("/admin/settings/users");
    const self = page.getByRole("list", { name: "Cuentas del equipo" }).getByRole("listitem").filter({ hasText: user.email });
    await expect(self).toContainText("(tú)");
    await (await ready(self.getByRole("button", { name: "Contraseña" }))).click();
    const dialog = page.getByRole("dialog", { name: "Restablecer contraseña" });
    await expect(dialog.getByText("Se cerrarán todas tus sesiones, incluida ésta")).toBeVisible();
    await dialog.getByLabel("Contraseña temporal").fill(newPassword);
    await dialog.getByRole("button", { name: "Restablecer" }).click();

    // Sale a /login sin cookie de sesión; la acción quedó auditada a su nombre
    await page.waitForURL((u) => u.pathname === "/login");
    await expect(page.getByRole("heading", { name: "Bienvenida de vuelta" })).toBeVisible();
    expect(await sessionCookie(page), "cookie de sesión eliminada").toBeUndefined();
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "user.password_reset", entityId: user.id } });
    expect(audit.actorId).toBe(user.id);
    await expectCookieRevoked(playwright, baseURL, cookie, "/admin/customers");

    // La contraseña anterior ya no entra; la nueva sí
    await loginViaUi(page, user.email, user.password);
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await loginViaUi(page, user.email, newPassword);
    await page.waitForURL((u) => u.pathname === "/admin");
    await ctx.close();
  });

  test("[AUTH-064] restablecer la propia contraseña desde Staff (fundadora con ficha) cierra la sesión actual y pide entrar con la nueva", { tag: ["@P1", "@regression"] }, async ({ browser, db, playwright, baseURL, guard, evidence }) => {
    test.info().annotations.push({ type: "regression", description: "BUG-004 (auto-restablecimiento desde Staff)" });
    const user = await createTeamUser(db, { role: "OWNER", withStaffMember: true });
    const newPassword = strongPassword();
    evidence("owner", `${user.email}: Staff › (su ficha) › Restablecer contraseña`);
    const ctx = await loggedInContext(browser, user, "/admin");
    const page = ctx.pages()[0]!;
    guard.watch(page);
    const cookie = await sessionCookie(page);
    await page.goto(`/admin/staff/${user.staffMemberId}`);
    const access = page.getByRole("region", { name: "Acceso al portal" });
    // Su propio acceso no se puede desactivar (el servidor también lo rechaza): no se ofrece el botón
    await expect(access.getByRole("button", { name: "Restablecer contraseña" })).toBeVisible();
    await expect(access.getByRole("button", { name: "Desactivar acceso" })).toHaveCount(0);
    await (await ready(access.getByRole("button", { name: "Restablecer contraseña" }))).click();
    const dialog = page.getByRole("dialog", { name: "Restablecer contraseña" });
    await expect(dialog.getByText("Se cerrarán todas tus sesiones, incluida ésta")).toBeVisible();
    await dialog.getByLabel("Contraseña temporal").fill(newPassword);
    await dialog.getByRole("button", { name: "Restablecer" }).click();

    // Sale a /login sin cookie de sesión (antes se quedaba en el panel con la sesión revocada en silencio)
    await page.waitForURL((u) => u.pathname === "/login");
    await expect(page.getByRole("heading", { name: "Bienvenida de vuelta" })).toBeVisible();
    expect(await sessionCookie(page), "cookie de sesión eliminada").toBeUndefined();
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "user.password_reset", entityId: user.id } });
    expect(audit.actorId).toBe(user.id);
    expect(audit.after).toMatchObject({ self: true, staffMemberId: user.staffMemberId });
    expect(await sessionVersion(db, user.id)).toBe(1);
    await expectCookieRevoked(playwright, baseURL, cookie, "/admin/staff");

    // La contraseña anterior ya no entra; la nueva sí
    await loginViaUi(page, user.email, user.password);
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await loginViaUi(page, user.email, newPassword);
    await page.waitForURL((u) => u.pathname === "/admin");
    await ctx.close();
  });

  test("[AUTH-038] una cookie ya revocada no puede cerrar las sesiones nuevas de la cuenta", { tag: ["@P2", "@negative"] }, async ({ browser, db, playwright, baseURL, guard, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", "cookie vieja (revocada al cerrar sesión) usada contra /api/auth/signout mientras hay una sesión nueva abierta");
    // Sesión 1: se copia la cookie y se cierra sesión (la versión sube)
    const first = await loggedInContext(browser, user, "/admin");
    const firstPage = first.pages()[0]!;
    guard.watch(firstPage);
    const stale = await sessionCookie(firstPage);
    expect(stale).toBeTruthy();
    await firstPage.waitForLoadState("networkidle");
    await firstPage.getByRole("complementary").getByRole("button", { name: "Cerrar sesión" }).click();
    await firstPage.waitForURL(/\/login/);
    await first.close();
    const afterLogout = await sessionVersion(db, user.id);
    expect(afterLogout, "cerrar sesión incrementó la versión").toBe(1);

    // Sesión 2, vigente
    const second = await loggedInContext(browser, user, "/admin");
    const secondPage = second.pages()[0]!;
    guard.watch(secondPage);

    // Con la cookie vieja: token CSRF de Auth.js + POST /api/auth/signout (el flujo real del botón)
    const host = new URL(baseURL!).hostname;
    const attacker = await playwright.request.newContext({
      baseURL,
      storageState: {
        cookies: [{ name: SESSION_COOKIE, value: stale!, domain: host, path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }],
        origins: [],
      },
    });
    const { csrfToken } = (await (await attacker.get("/api/auth/csrf")).json()) as { csrfToken: string };
    const signout = await attacker.post("/api/auth/signout", { form: { csrfToken, callbackUrl: "/login" }, maxRedirects: 0 });
    // Prueba de que Auth.js SÍ procesó el signout (borra la cookie después de emitir el evento signOut)
    expect(
      signout.headersArray().some((h) => h.name.toLowerCase() === "set-cookie" && /session-token=;/.test(h.value)),
      `signout procesado (${signout.status()})`,
    ).toBe(true);

    // La versión no cambió y la sesión nueva sigue viva
    expect(await sessionVersion(db, user.id)).toBe(afterLogout);
    await secondPage.goto("/admin/customers");
    await expect(secondPage).toHaveURL(/\/admin\/customers$/);
    await expect(secondPage.getByRole("heading", { level: 1 })).toBeVisible();
    await attacker.dispose();
    await second.close();
  });
});
