/**
 * Rate limit del login (fuerza bruta). Corre SÓLO en la suite E2E_SUITE=ratelimit (carril 9, limitador encendido).
 * Fuente: src/auth.ts → rateLimit(`login:${email}`, { limit: 8, windowMs: 15 min }) antes de verificar la contraseña.
 */
import { expect, test, uniqEmail } from "../fixtures";
import { createTeamUser, loginViaUi, sessionCookie } from "../permissions/_helpers";

const GENERIC = "Correo o contraseña incorrectos.";
const LIMITED = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

test.describe("Login — fuerza bruta", { tag: ["@module:auth", "@auth"] }, () => {
  test.describe.configure({ mode: "serial" });

  test("[AUTH-060] 8 intentos fallidos permitidos; el 9º se bloquea y ni la contraseña correcta entra", { tag: ["@P0", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "OWNER" });
    evidence("anonimo", `fuerza bruta contra ${user.email}`);
    const page = await anonPage();
    const alert = page.getByRole("main").getByRole("alert");
    for (let i = 1; i <= 8; i++) {
      await loginViaUi(page, user.email, `incorrecta-${i}-xyz`);
      await expect(alert, `intento ${i}`).toHaveText(GENERIC);
    }
    await loginViaUi(page, user.email, "incorrecta-9-xyz");
    await expect(alert).toHaveText(LIMITED);
    await loginViaUi(page, user.email, user.password);
    await expect(alert, "contraseña correcta durante el bloqueo").toHaveText(LIMITED);
    expect(await sessionCookie(page)).toBeUndefined();
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).toBeNull();
    const bucket = await db.rateLimitBucket.findUniqueOrThrow({ where: { key: `login:${user.email}` } });
    expect(bucket.count).toBeGreaterThanOrEqual(10);
    expect(bucket.resetAt.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
  });

  test("[AUTH-061] el bloqueo es por cuenta: otra cuenta desde el mismo navegador entra normalmente", { tag: ["@P1"] }, async ({ anonPage, db, evidence }) => {
    const victim = await createTeamUser(db, { role: "OWNER" });
    const other = await createTeamUser(db, { role: "STAFF" });
    evidence("anonimo", `bloquea ${victim.email}; luego entra ${other.email}`);
    const page = await anonPage();
    for (let i = 1; i <= 9; i++) await loginViaUi(page, victim.email, `mala-${i}-abc`);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(LIMITED);
    await loginViaUi(page, other.email, other.password);
    await page.waitForURL((u) => u.pathname === "/staff");
    test.info().annotations.push({
      type: "nota",
      description: "El límite es sólo por correo (sin componente de IP): cualquiera puede bloquear 15 min el acceso de una cuenta conocida (riesgo de DoS dirigido, ver access.md).",
    });
  });

  test("[AUTH-062] correo inexistente también se limita con el mismo mensaje (sin enumeración por el limitador)", { tag: ["@P1", "@negative"] }, async ({ anonPage, evidence }) => {
    const ghost = uniqEmail("rl-ghost");
    evidence("anonimo", ghost);
    const page = await anonPage();
    const alert = page.getByRole("main").getByRole("alert");
    for (let i = 1; i <= 8; i++) {
      await loginViaUi(page, ghost, `x-${i}-123456`);
      await expect(alert).toHaveText(GENERIC);
    }
    await loginViaUi(page, ghost, "x-9-123456");
    await expect(alert).toHaveText(LIMITED);
  });

  test("[AUTH-063] variar mayúsculas/espacios del correo no evade el límite (misma cubeta normalizada)", { tag: ["@P2", "@negative"] }, async ({ anonPage, db, evidence }) => {
    const user = await createTeamUser(db, { role: "STAFF" });
    evidence("anonimo", "intentos alternando USER@… y user@…");
    const page = await anonPage();
    const variants = [user.email, user.email.toUpperCase(), ` ${user.email} `];
    const fresh = async () => {
      // Página nueva por intento: el formulario se reinicia tras cada envío y el mensaje anterior no cuenta.
      await page.goto("/login");
      await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    };
    for (let i = 0; i < 8; i++) {
      await fresh();
      await page.getByLabel("Correo").fill(variants[i % variants.length]!);
      await page.getByLabel("Contraseña").fill(`mala-${i}-zzz`);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(GENERIC);
    }
    await fresh();
    await page.getByLabel("Correo").fill(user.email.toUpperCase());
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(LIMITED);
    expect(await db.rateLimitBucket.count({ where: { key: { contains: user.email.toUpperCase() } } })).toBe(0);
  });
});
