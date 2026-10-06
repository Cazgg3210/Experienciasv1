/**
 * Autenticación — login del equipo (Auth.js v5 Credentials + JWT).
 * Fuente: src/features/auth/server/actions.ts (loginAction), src/auth.ts (authorize), src/app/(auth)/login/page.tsx.
 */
import { ACCOUNTS, PASSWORD, expect, scanA11y, test, uniqEmail, type E2ERole } from "../fixtures";
import { SESSION_COOKIE, createTeamUser, loginViaUi, sessionCookie } from "../permissions/_helpers";

const GENERIC_ERROR = "Correo o contraseña incorrectos.";

test.describe("Login del equipo", { tag: ["@module:auth", "@auth"] }, () => {
  const homeByRole: Array<[string, E2ERole]> = [
    ["AUTH-001", "superadmin"],
    ["AUTH-002", "owner"],
    ["AUTH-003", "owner2"],
    ["AUTH-004", "staff"],
    ["AUTH-005", "staff2"],
  ];
  for (const [id, role] of homeByRole) {
    test(`[${id}] login válido de ${role} redirige a su inicio con sesión httpOnly`, { tag: ["@P0", "@critical", "@smoke"] }, async ({ anonPage, db, evidence }) => {
      const account = ACCOUNTS[role];
      evidence(role, `Login › ${account.email} → ${account.home}`);
      const before = await db.user.findUniqueOrThrow({ where: { email: account.email }, select: { lastLoginAt: true } });
      const page = await anonPage();
      await loginViaUi(page, account.email, PASSWORD);
      await page.waitForURL((u) => u.pathname === account.home, { timeout: 30_000 });
      // UI: shell del portal correcto con el nombre de la persona
      if (account.home === "/admin") {
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
        await expect(page.getByRole("navigation", { name: "Navegación del panel" })).toBeVisible();
      } else {
        // Saludo del encabezado del portal (exacto: la página de inicio repite «Hola, <nombre>. Aquí ves…»
        // y, desde la corrección de BUG-006, ambos llegan juntos en la misma respuesta RSC)
        await expect(page.getByText(`Hola, ${account.name.split(" ")[0]}`, { exact: true })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Staff" })).toBeVisible();
      }
      // Cookie de sesión: httpOnly + SameSite=Lax (no accesible desde JS)
      const cookie = (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
      expect(cookie, "cookie de sesión").toBeTruthy();
      expect(cookie!.httpOnly).toBe(true);
      expect(cookie!.sameSite).toBe("Lax");
      expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
      // Base: lastLoginAt actualizado
      const after = await db.user.findUniqueOrThrow({ where: { email: account.email }, select: { lastLoginAt: true } });
      expect(after.lastLoginAt!.getTime()).toBeGreaterThan(before.lastLoginAt?.getTime() ?? 0);
      // Persistencia: la sesión sobrevive a recargar
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`${account.home}$`));
    });
  }

  test("[AUTH-006] contraseña incorrecta: mensaje genérico, sin sesión y sin lastLoginAt", { tag: ["@P0", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("anonimo", `cuenta propia ${user.email} con contraseña errónea`);
    const page = await anonPage();
    await loginViaUi(page, user.email, `${user.password}x`);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(GENERIC_ERROR);
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionCookie(page)).toBeUndefined();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).toBeNull();
    // Sigue sin acceso al panel
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);
  });

  test("[AUTH-007] usuario inexistente recibe exactamente el mismo mensaje (sin enumeración)", { tag: ["@P0", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("anonimo", "compara respuesta de cuenta existente (contraseña mala) vs. inexistente");
    const page = await anonPage();
    await loginViaUi(page, user.email, "contraseña-equivocada-123");
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toHaveText(GENERIC_ERROR);
    const existingHtml = await page.getByRole("main").innerHTML();

    const ghost = uniqEmail("no-existe");
    await loginViaUi(page, ghost, "contraseña-equivocada-123");
    await expect(alert).toHaveText(GENERIC_ERROR);
    const ghostHtml = await page.getByRole("main").innerHTML();
    // Mismo DOM (salvo valores de inputs, que no se reflejan en el HTML) => no revela si el correo existe
    expect(ghostHtml).toBe(existingHtml);
    expect(await db.user.findUnique({ where: { email: ghost } })).toBeNull();
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("[AUTH-008] campos vacíos: el navegador exige ambos y el servidor también valida", { tag: ["@P1", "@negative"] }, async ({ anonPage, evidence }) => {
    evidence("anonimo", "envío vacío con validación HTML y luego saltando la validación del cliente");
    const page = await anonPage();
    await page.goto("/login");
    const email = page.getByLabel("Correo");
    const password = page.getByLabel("Contraseña");
    await expect(email).toHaveAttribute("required", "");
    await expect(password).toHaveAttribute("required", "");
    await page.getByRole("button", { name: "Entrar" }).click();
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    await expect(page).toHaveURL(/\/login$/);

    // Saltando la validación del navegador: el servidor responde con su propio mensaje y no crea sesión.
    await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Correo inválido");
    await email.fill("alguien@ivonne-rosa.test");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Escribe tu contraseña");
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("[AUTH-009] correo con formato inválido es rechazado en servidor", { tag: ["@P2", "@negative"] }, async ({ anonPage, evidence }) => {
    evidence("anonimo", "form.noValidate para forzar el valor en el servidor");
    const page = await anonPage();
    await page.goto("/login");
    // Saltar la validación HTML (type=email) para que el valor llegue al servidor.
    await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await loginViaUiNoNav(page, "no-es-un-correo", "algo123456");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Correo inválido");
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("[AUTH-010] usuaria desactivada no puede iniciar sesión (mensaje genérico)", { tag: ["@P0", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER", active: false });
    evidence("anonimo", `cuenta desactivada ${user.email} con contraseña correcta`);
    const page = await anonPage();
    await loginViaUi(page, user.email, user.password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(GENERIC_ERROR);
    expect(await sessionCookie(page)).toBeUndefined();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).toBeNull();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("[AUTH-011] cuenta con rol CUSTOMER no entra al equipo aunque la contraseña sea correcta", { tag: ["@P1", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "CUSTOMER" });
    evidence("anonimo", `rol CUSTOMER ${user.email}`);
    const page = await anonPage();
    await loginViaUi(page, user.email, user.password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(GENERIC_ERROR);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("[AUTH-012] cuenta sin contraseña (ficha sin acceso) no puede iniciar sesión", { tag: ["@P2", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    await db.user.update({ where: { id: user.id }, data: { passwordHash: null } });
    evidence("anonimo", `cuenta STAFF sin passwordHash ${user.email}`);
    const page = await anonPage();
    await loginViaUi(page, user.email, user.password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(GENERIC_ERROR);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("[AUTH-013] con sesión abierta, /login redirige al inicio del rol", { tag: ["@P2"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "también staff");
    const owner = await rolePage("owner");
    await owner.goto("/login");
    await expect(owner).toHaveURL(/\/admin$/);
    const staff = await rolePage("staff");
    await staff.goto("/login");
    await expect(staff).toHaveURL(/\/staff$/);
  });

  test("[AUTH-014] correo con mayúsculas y espacios se normaliza y permite entrar", { tag: ["@P2"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("anonimo", `"  ${user.email.toUpperCase()}  "`);
    const page = await anonPage();
    await page.goto("/login");
    await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await loginViaUiNoNav(page, `  ${user.email.toUpperCase()}  `, user.password);
    await page.waitForURL((u) => u.pathname === "/admin");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).not.toBeNull();
  });

  test("[AUTH-015] formulario de login accesible y operable con teclado", { tag: ["@P2", "@a11y"] }, async ({ anonPage, db, evidence }, testInfo) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("anonimo", "axe WCAG 2.1 AA + Tab/Enter");
    const page = await anonPage();
    await page.goto("/login");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Bienvenida de vuelta" })).toBeVisible();
    const { blocking } = await scanA11y(page, testInfo);
    expect(blocking.map((v) => `${v.id}: ${v.help}`), "violaciones critical/serious").toEqual([]);
    // Teclado: foco llega a correo, contraseña y botón; Enter envía
    await page.getByLabel("Correo").focus();
    await page.keyboard.type(user.email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Contraseña")).toBeFocused();
    await page.keyboard.type(user.password);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname === "/staff");
  });

  test("[AUTH-016] página de login: noindex, contraseña enmascarada y autocompletado correcto", { tag: ["@P3"] }, async ({ anonPage, request, evidence }) => {
    evidence("anonimo");
    const res = await request.get("/login");
    expect(res.status()).toBe(200);
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    const page = await anonPage();
    await page.goto("/login");
    await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "password");
    await expect(page.getByLabel("Contraseña")).toHaveAttribute("autocomplete", "current-password");
    await expect(page.getByLabel("Correo")).toHaveAttribute("autocomplete", "email");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // Enlace para clientas a /mi-evento (no hay login de clientas)
    await page.getByRole("link", { name: "Mi evento" }).click();
    await expect(page).toHaveURL(/\/mi-evento$/);
  });

  test("[AUTH-017] recuperación pública de contraseña: no existe (restablecimiento sólo por admin)", { tag: ["@P3"] }, async ({ anonPage, request, evidence }) => {
    evidence("anonimo", "verifica que no haya flujo público de recuperación");
    const page = await anonPage();
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /olvid|recuperar|restablecer/i })).toHaveCount(0);
    for (const path of ["/recuperar", "/olvide-mi-contrasena", "/reset-password"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    test.info().annotations.push({
      type: "nota",
      description: "NOT APPLICABLE como flujo: no hay recuperación pública; el restablecimiento lo hace un admin (Configuración › Usuarios).",
    });
  });
});

/** Igual que loginViaUi pero sin navegar a /login (para conservar cambios hechos al formulario). */
async function loginViaUiNoNav(page: import("@playwright/test").Page, email: string, password: string) {
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
