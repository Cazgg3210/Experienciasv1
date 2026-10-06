/**
 * Proyecto "setup": inicia sesión por la UI una vez por rol y guarda la sesión
 * (tests/e2e/.auth/<rol>.json). Las demás pruebas la reutilizan con test.use({ storageState }).
 * Si el login por UI falla, TODO lo que dependa de ese rol queda BLOCKED (no FAIL): es la primera señal.
 */
import { expect, test as setup } from "@playwright/test";
import { ACCOUNTS, PASSWORD, ROLES, storageStatePath } from "../fixtures/accounts";

for (const role of ROLES) {
  setup(`sesión de ${role}`, async ({ page }) => {
    const account = ACCOUNTS[role];
    await page.goto("/login");
    await page.getByLabel("Correo").fill(account.email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((url) => url.pathname.startsWith(account.home), { timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`${account.home}`));
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
