/**
 * Rate limit de acciones públicas (suite E2E_SUITE=ratelimit, carril 9, limitador encendido).
 *  - Contacto: 5 envíos / 10 min por IP (src/features/marketing/server/actions.ts).
 *  - Envío del configurador: 5 / 10 min por IP (src/features/configurator/server/actions.ts).
 * El limitador se evalúa ANTES de validar el esquema (src/server/action.ts → run): también frena payloads basura.
 * Cada cubeta (por IP) se ejercita en UNA sola prueba: la base del carril se re-siembra (TRUNCATE) por invocación.
 */
import { expect, replayServerAction, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { actionResult, buildAction } from "../permissions/_helpers";

test.describe("Acciones públicas — rate limit", { tag: ["@module:api"] }, () => {
  test.describe.configure({ mode: "serial" });

  test("[API-080] contacto: 5 envíos reales crean 5 leads; el 6º se rechaza con mensaje de límite y no crea lead", { tag: ["@P1", "@negative"] }, async ({ anonPage, db, evidence }) => {
    evidence("anonimo", "/contacto × 6");
    const page = await anonPage();
    const created: string[] = [];
    const before = await db.lead.count();
    for (let i = 1; i <= 6; i++) {
      await page.goto("/contacto");
      const name = uniq(`Contacto RL ${i}`);
      const email = uniqEmail("rl-contacto");
      await page.getByLabel("Nombre").fill(name);
      await page.getByLabel("WhatsApp o teléfono").fill(uniqPhone());
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("¿Qué quieres celebrar?").selectOption({ index: 1 });
      await page.getByLabel("Mensaje").fill("Queremos una celebración para 10 amigas en Polanco.");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Enviar mensaje" }).click();
      if (i <= 5) {
        await expect(page.getByRole("heading", { name: new RegExp(`¡Gracias, ${name.split(" ")[0]}!`) })).toBeVisible();
        created.push(email);
      } else {
        await expect(page.getByText("Demasiados intentos. Intenta de nuevo en unos minutos.")).toBeVisible();
        await expect(page.getByRole("heading", { name: /¡Gracias/ })).toHaveCount(0);
        expect(await db.lead.count({ where: { email } })).toBe(0);
      }
    }
    expect(await db.lead.count()).toBe(before + 5);
    for (const email of created) expect(await db.lead.count({ where: { email } })).toBe(1);
  });

  test("[API-081] configurador: el 6º envío en 10 min responde RATE_LIMITED aunque el payload sea inválido", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("anonimo", "submitConfiguratorAction × 6 (payload incompleto)");
    const anon = await apiAs(null);
    const action = buildAction("submitConfiguratorAction", "/crear-experiencia", { invalido: true });
    const before = await db.lead.count();
    const codes: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const res = await replayServerAction(anon, action);
      codes.push(actionResult(res.text)?.code ?? `?${res.status}`);
    }
    expect(codes.slice(0, 5)).toEqual(Array(5).fill("VALIDATION_ERROR"));
    expect(codes[5]).toBe("RATE_LIMITED");
    expect(await db.lead.count()).toBe(before);
  });
});
