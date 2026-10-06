/**
 * Recorrido crítico de ACCESO (P0): login/logout por rol con el formulario real, home de cada rol,
 * barreras básicas del middleware (UI y request directo) y callbackUrl.
 * Cada prueba usa un contexto NUEVO (sin la sesión guardada) para no afectar a las demás.
 */
import { ACCOUNTS, PASSWORD, expect, loginViaUi, test, type E2ERole } from "./_helpers";

const BACKOFFICE: Array<{ id: string; role: E2ERole }> = [
  { id: "CRIT-009", role: "owner" },
  { id: "CRIT-011", role: "superadmin" },
];

test.describe("Recorridos críticos · acceso", { tag: ["@critical", "@auth"] }, () => {
  for (const { id, role } of BACKOFFICE) {
    test(
      `[${id}] ${role}: login → panel → logout → las rutas privadas vuelven a pedir login (UI y request)`,
      { tag: ["@P0", "@module:auth"] },
      async ({ page, db, evidence }) => {
        const acc = ACCOUNTS[role];
        evidence(role, "Login por formulario → /admin → Cerrar sesión → /admin pide login");
        const before = (await db.user.findUnique({ where: { email: acc.email } }))?.lastLoginAt ?? null;

        await loginViaUi(page, acc.email, PASSWORD, /^\/admin$/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hola, ${acc.name.split(" ")[0]}`);
        await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toBeVisible();
        const after = (await db.user.findUnique({ where: { email: acc.email } }))?.lastLoginAt ?? null;
        if (after) expect(after.getTime(), "lastLoginAt actualizado").toBeGreaterThan(before?.getTime() ?? 0);

        // Sesión válida en backend
        const ok = await page.request.get("/admin/leads", { maxRedirects: 0 });
        expect(ok.status()).toBe(200);

        // Logout
        await page.getByRole("button", { name: "Cerrar sesión" }).click();
        await page.waitForURL(/\/login/);
        await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

        // UI: volver a una ruta privada pide login con callbackUrl
        await page.goto("/admin/leads");
        await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fleads/);
        // Backend: el request directo ya no autoriza
        const res = await page.request.get("/admin/leads", { maxRedirects: 0 });
        expect(res.status(), "redirect a login").toBeGreaterThanOrEqual(300);
        expect(res.status()).toBeLessThan(400);
        expect(res.headers()["location"] ?? "").toContain("/login");
        // Atrás no muestra datos privados
        await page.goBack();
        await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toHaveCount(0);
      },
    );
  }

  test(
    "[CRIT-012] staff: login → /staff; /admin la regresa a /staff; logout cierra el portal",
    { tag: ["@P0", "@module:auth", "@mobile"] },
    async ({ page, evidence }) => {
      const acc = ACCOUNTS.staff;
      evidence("staff", "Login por formulario → /staff; intento /admin; Cerrar sesión");
      await loginViaUi(page, acc.email, PASSWORD, /^\/staff/);
      await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();

      await page.goto("/admin/finance");
      await expect(page).toHaveURL(/\/staff$/);
      const direct = await page.request.get("/admin/finance", { maxRedirects: 0 });
      expect(direct.status()).toBeGreaterThanOrEqual(300);
      expect(direct.headers()["location"] ?? "").toMatch(/\/staff$/);

      await page.getByRole("button", { name: "Cerrar sesión" }).click();
      await page.waitForURL(/\/login/);
      await page.goto("/staff");
      if (!/\/login/.test(page.url())) {
        // Reproducción natural de TRV-BUG-06: un prefetch RSC en vuelo re-creó la cookie de sesión.
        test.info().annotations.push({ type: "bug", description: "TRV-BUG-06 la sesión revivió tras el logout (prefetch en vuelo)" });
      }
      await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fstaff/);
    },
  );

  test(
    "[CRIT-014] logout definitivo: una respuesta que estaba en vuelo al cerrar sesión no revive la sesión",
    { tag: ["@P0", "@module:auth", "@regression"] },
    async ({ page, evidence }) => {
      evidence("staff", "Login → 2ª pestaña con petición a /staff en vuelo → Cerrar sesión → llega la respuesta → /staff");
      const acc = ACCOUNTS.staff;
      await loginViaUi(page, acc.email, PASSWORD, /^\/staff/);
      await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();

      // Una petición autenticada (prefetch RSC / otra pestaña del portal) sale ANTES del logout y su
      // respuesta llega DESPUÉS (red móvil lenta). Se retiene la respuesta REAL del servidor, sin modificarla.
      const tab2 = await page.context().newPage();
      await tab2.goto("/staff");
      let releaseAfterLogout!: () => void;
      const loggedOut = new Promise<void>((r) => (releaseAfterLogout = r));
      let delivered!: () => void;
      const fulfilled = new Promise<void>((r) => (delivered = r));
      let refreshedCookie = false;
      await tab2.route("**/staff?e2e-inflight=1", async (route) => {
        const response = await route.fetch();
        refreshedCookie = /authjs\.session-token=ey/.test(response.headers()["set-cookie"] ?? "");
        await loggedOut;
        await route.fulfill({ response });
        delivered();
      });
      await tab2.evaluate(() => {
        (window as unknown as { __inflight: Promise<number> }).__inflight = fetch("/staff?e2e-inflight=1", {
          headers: { RSC: "1" },
        }).then((r) => r.status);
      });
      await expect.poll(() => refreshedCookie, { message: "el servidor respondió con la cookie de sesión renovada" }).toBe(true);
      test.info().annotations.push({ type: "observación", description: "cada respuesta autenticada del middleware re-emite Set-Cookie authjs.session-token" });

      // Evidencia: qué respuestas (de cualquier pestaña) traen Set-Cookie de sesión después del logout
      const resurrectors: string[] = [];
      let logoutStarted = false;
      for (const p of [page, tab2]) {
        p.on("response", async (res) => {
          if (!logoutStarted) return;
          const sc = (await res.headerValue("set-cookie").catch(() => null)) ?? "";
          if (/authjs\.session-token=ey/.test(sc)) resurrectors.push(`${res.request().method()} ${new URL(res.url()).pathname}${new URL(res.url()).search.slice(0, 20)} ${res.status()}`);
        });
      }
      logoutStarted = true;
      await page.getByRole("button", { name: "Cerrar sesión" }).click();
      await page.waitForURL(/\/login/);
      const afterLogout = (await page.context().cookies()).some((c) => c.name === "authjs.session-token" && c.value);
      test.info().annotations.push({ type: "Set-Cookie de sesión tras logout", description: resurrectors.join(" ; ") || "ninguna (antes de liberar)" });
      if (afterLogout) test.info().annotations.push({ type: "bug", description: "TRV-BUG-06 la sesión sigue/reaparece justo después del logout" });
      expect.soft(afterLogout, "la cookie de sesión se borró al cerrar sesión").toBe(false);
      releaseAfterLogout();
      await fulfilled;
      // Sincronización: la pestaña 2 terminó de recibir la respuesta (cabeceras ya procesadas por el navegador)
      await tab2.evaluate(() => (window as unknown as { __inflight: Promise<number> }).__inflight);

      const revived = (await page.context().cookies()).some((c) => c.name === "authjs.session-token" && c.value);
      test.info().annotations.push({ type: "Set-Cookie de sesión tras logout (final)", description: resurrectors.join(" ; ") || "ninguna" });
      if (revived) test.info().annotations.push({ type: "bug", description: "TRV-BUG-06 respuesta en vuelo revive la sesión tras logout" });
      expect(revived, "ninguna respuesta posterior al logout vuelve a crear la cookie de sesión").toBe(false);
      await page.goto("/staff");
      await expect(page, "tras cerrar sesión /staff exige login").toHaveURL(/\/login\?callbackUrl=%2Fstaff/);
    },
  );

  test(
    "[CRIT-013] anónima: ruta privada → login con callbackUrl → tras entrar regresa a esa ruta (sólo rutas internas)",
    { tag: ["@P0", "@module:auth"] },
    async ({ page, anonPage, evidence }) => {
      evidence("anonimo", "/admin/events → login (callbackUrl) → owner entra → /admin/events");
      await page.goto("/admin/events");
      await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fevents/);
      await page.getByLabel("Correo").fill(ACCOUNTS.owner.email);
      await page.getByLabel("Contraseña").fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();
      await page.waitForURL((u) => u.pathname === "/admin/events");
      await expect(page.getByRole("heading", { level: 1, name: "Eventos" })).toBeVisible();

      // Open redirect: un callbackUrl externo nunca saca a la usuaria del sitio
      const p2 = await anonPage();
      await p2.goto("/login?callbackUrl=https%3A%2F%2Fevil.example%2Fphish");
      await p2.getByLabel("Correo").fill(ACCOUNTS.owner.email);
      await p2.getByLabel("Contraseña").fill(PASSWORD);
      await p2.getByRole("button", { name: "Entrar" }).click();
      await p2.waitForURL((u) => u.pathname.startsWith("/admin") || u.hostname !== "localhost", { timeout: 45_000 });
      expect(new URL(p2.url()).hostname, "no redirige fuera del sitio").toBe(new URL(page.url()).hostname);
    },
  );
});
