/**
 * Autenticación — callbackUrl tras el login: se respeta sólo si es una ruta interna (sin open redirect)
 * y un STAFF nunca termina en /admin aunque lo pida. Fuente: safeCallbackPath() en src/features/auth/domain/callback-url.ts.
 */
import { expect, test } from "../fixtures";
import { baseUrl, createTeamUser, loginViaUi } from "../permissions/_helpers";

test.describe("callbackUrl", { tag: ["@module:auth", "@auth"] }, () => {
  test("[AUTH-040] ruta privada sin sesión → login con callbackUrl → tras entrar vuelve a esa ruta", { tag: ["@P0", "@critical"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("owner", "/admin/quotes?status=SENT → login → regreso con query");
    const page = await anonPage();
    await page.goto("/admin/quotes?status=SENT");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fquotes%3Fstatus%3DSENT/);
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === "/admin/quotes");
    expect(new URL(page.url()).searchParams.get("status")).toBe("SENT");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("[AUTH-041] STAFF con callbackUrl a /admin termina en /staff", { tag: ["@P1", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("staff", "callbackUrl=/admin/finance");
    const page = await anonPage();
    await loginViaUi(page, user.email, user.password, "/admin/finance");
    await page.waitForURL((u) => u.pathname === "/staff");
    await expect(page.getByRole("navigation", { name: "Staff" })).toBeVisible();
  });

  test("[AUTH-042] STAFF con callbackUrl interno permitido (/staff/...) lo respeta", { tag: ["@P2"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("staff", "callbackUrl=/staff?vista=hoy");
    const page = await anonPage();
    await loginViaUi(page, user.email, user.password, "/staff?vista=hoy");
    await page.waitForURL((u) => u.pathname === "/staff" && u.searchParams.get("vista") === "hoy");
  });

  const evil: Array<[string, string]> = [
    ["AUTH-043", "https://evil.example/robo"],
    ["AUTH-044", "//evil.example/robo"],
    ["AUTH-045", "/\\evil.example/robo"],
    ["AUTH-046", "\\\\evil.example"],
    ["AUTH-047", "javascript:alert(document.domain)"],
    ["AUTH-048", "/%2F%2Fevil.example"],
    ["AUTH-049", "/\t/evil.example"],
    ["AUTH-050", `${"http://localhost"}@evil.example/`],
  ];
  for (const [id, target] of evil) {
    const controlChars = /[\t\r\n]/.test(target);
    test(`[${id}] callbackUrl malicioso ${JSON.stringify(target)} no redirige fuera de la app`, { tag: ["@P0", "@negative", ...(controlChars ? ["@regression"] : [])] }, async ({ anonPage, db, guard, evidence }) => {
      const user = await createTeamUser(db, { role: "OWNER" });
      // El destino neutralizado puede ser una ruta inexistente del MISMO origen (p. ej. /%2F%2Fevil.example): 404 esperado.
      guard.allow(/status of 404/);
      evidence("owner", `open redirect: callbackUrl=${JSON.stringify(target)}`);
      const page = await anonPage();
      const offsite: string[] = [];
      page.on("request", (r) => {
        const host = new URL(r.url()).hostname;
        if (r.isNavigationRequest() && host !== "localhost" && host !== "127.0.0.1") offsite.push(r.url());
      });
      // Nunca salir a la red (sólo hosts evil.example; una ruta /%2F%2Fevil.example del mismo origen sí se carga).
      await page.route((u) => u.hostname.endsWith("evil.example"), (route) => route.abort());
      if (controlChars) test.info().annotations.push({ type: "regression", description: "BUG-005" });
      await loginViaUi(page, user.email, user.password, target);
      await page.waitForURL((u) => u.origin === new URL(baseUrl()).origin && u.pathname !== "/login", { timeout: 30_000 });
      expect(offsite, "navegación fuera del origen").toEqual([]);
      expect(new URL(page.url()).origin).toBe(new URL(baseUrl()).origin);
      // Sesión válida (la redirección sólo se neutralizó)
      await page.goto("/admin");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
    });
  }

  test("[AUTH-051] el middleware conserva ruta + query en callbackUrl y no acepta hosts", { tag: ["@P2"] }, async ({ apiAs, evidence }) => {
    evidence("anonimo", "Location de la redirección del middleware");
    const anon = await apiAs(null);
    const res = await anon.get("/admin/leads?status=NEW&q=%3Cscript%3E", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = res.headers()["location"]!;
    expect(loc.startsWith("/login?callbackUrl=")).toBe(true);
    const cb = new URL(loc, baseUrl()).searchParams.get("callbackUrl");
    expect(cb).toBe("/admin/leads?status=NEW&q=%3Cscript%3E");
  });
});
