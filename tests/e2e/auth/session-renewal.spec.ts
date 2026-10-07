/**
 * Renovación deslizante de la sesión (BUG-001): el middleware sólo deja pasar la re-emisión de la cookie de
 * sesión de Auth.js en GET y cuando el JWT ya cumplió `updateAge` (1 h); en POST (Server Actions) y con JWT
 * recientes la quita, pero conserva los borrados (token inválido). Sin esta renovación, toda sesión del equipo
 * caducaría a las 12 h aunque hubiera actividad.
 *
 * Se usan JWT forjados con AUTH_SECRET (mismo algoritmo, sal y secreto que el servidor) con `iat` de hace 2 h,
 * para no esperar una hora real. Cada prueba usa una cuenta propia (createTeamUser).
 */
import type { APIRequestContext, PlaywrightWorkerArgs } from "@playwright/test";
import { expect, test } from "../fixtures";
import { SESSION_COOKIE, buildAction, createTeamUser, type TeamUser } from "../permissions/_helpers";
import { forgeSessionToken, readSessionToken, sessionSetCookies } from "./_jwt";

type Playwright = PlaywrightWorkerArgs["playwright"];
const TWO_HOURS = 2 * 60 * 60;

function claims(user: TeamUser, sessionVersion = 0) {
  return { uid: user.id, role: user.role, name: user.name, email: user.email, sessionVersion };
}

async function withCookie(
  playwright: Playwright,
  baseURL: string | undefined,
  value: string,
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${value}` },
  });
}

test.describe("Renovación de la cookie de sesión (middleware)", { tag: ["@module:auth", "@auth"] }, () => {
  test(
    "[AUTH-053] JWT con ≥ 1 h: un GET de documento renueva la cookie (iat nuevo, mismos datos) y la renovada autoriza",
    { tag: ["@P1", "@regression"] },
    async ({ playwright, baseURL, db, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-001 (renovación deslizante)" });
      const user = await createTeamUser(db, { role: "OWNER" });
      evidence("owner", "GET /admin con un JWT de hace 2 h");
      const old = await forgeSessionToken(claims(user), TWO_HOURS);
      const oldIat = (await readSessionToken(old))?.iat as number;
      expect(Math.floor(Date.now() / 1000) - oldIat, "el JWT forjado tiene ~2 h").toBeGreaterThanOrEqual(
        TWO_HOURS - 60,
      );

      const api = await withCookie(playwright, baseURL, old);
      const res = await api.get("/admin", { maxRedirects: 0 });
      expect(res.status(), "la sesión antigua (vigente) entra al panel").toBe(200);
      const renewed = sessionSetCookies(res.headersArray()).filter(Boolean);
      expect(renewed, "Set-Cookie con la cookie de sesión renovada").toHaveLength(1);

      const payload = await readSessionToken(renewed[0]!);
      expect(payload, "la cookie renovada es un JWT válido del servidor").not.toBeNull();
      expect(payload).toMatchObject({ uid: user.id, role: "OWNER", sessionVersion: 0, email: user.email });
      expect(payload!.iat as number, "iat renovado").toBeGreaterThanOrEqual(
        Math.floor(Date.now() / 1000) - 120,
      );
      expect(payload!.exp as number, "expira 12 h después de la renovación").toBeGreaterThan(
        Math.floor(Date.now() / 1000) + 11 * 3600,
      );
      await api.dispose();

      // La cookie renovada abre el panel y, por ser reciente, ya no se vuelve a emitir
      const next = await withCookie(playwright, baseURL, renewed[0]!);
      const again = await next.get("/admin/leads", { maxRedirects: 0 });
      expect(again.status()).toBe(200);
      expect(
        sessionSetCookies(again.headersArray()).filter(Boolean),
        "sin nueva renovación antes de 1 h",
      ).toEqual([]);
      await next.dispose();
    },
  );

  test(
    "[AUTH-054] JWT con ≥ 1 h: un GET RSC (navegación del cliente) también renueva la cookie",
    { tag: ["@P2", "@regression"] },
    async ({ playwright, baseURL, db, evidence }) => {
      const user = await createTeamUser(db, { role: "STAFF" });
      evidence("staff", "GET /staff con RSC: 1 y un JWT de hace 2 h");
      const api = await withCookie(playwright, baseURL, await forgeSessionToken(claims(user), TWO_HOURS));
      const res = await api.get("/staff", { maxRedirects: 0, headers: { RSC: "1" } });
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/x-component");
      const renewed = sessionSetCookies(res.headersArray()).filter(Boolean);
      expect(renewed).toHaveLength(1);
      expect(await readSessionToken(renewed[0]!)).toMatchObject({ uid: user.id, role: "STAFF" });
      await api.dispose();
    },
  );

  test(
    "[AUTH-055] JWT con ≥ 1 h: un POST de Server Action NO re-emite la cookie (aunque la acción corre con esa sesión)",
    { tag: ["@P1", "@negative", "@regression"] },
    async ({ playwright, baseURL, db, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-001" });
      const user = await createTeamUser(db, { role: "OWNER" });
      evidence("owner", "POST setUserActiveAction (usuario inexistente: sin efectos) con un JWT de hace 2 h");
      const api = await withCookie(playwright, baseURL, await forgeSessionToken(claims(user), TWO_HOURS));
      const action = buildAction("setUserActiveAction", "/admin/settings/users", {
        userId: "no-existe-e2e",
        active: true,
      });
      const res = await api.post(action.url, {
        headers: {
          "Next-Action": action.actionId,
          "Content-Type": action.contentType,
          Accept: "text/x-component",
          Origin: new URL(action.url).origin,
        },
        data: action.body!,
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      const text = await res.text();
      // Control positivo: la acción se ejecutó autenticada (NOT_FOUND del servicio, no UNAUTHORIZED)
      expect(res.status()).toBe(200);
      expect(text).toMatch(/"ok":false/);
      expect(text).toContain("NOT_FOUND");
      expect(sessionSetCookies(res.headersArray()), "un POST nunca re-escribe la cookie de sesión").toEqual(
        [],
      );
      await api.dispose();
    },
  );

  test(
    "[AUTH-056] JWT reciente: un GET no re-emite la cookie de sesión",
    { tag: ["@P2", "@regression"] },
    async ({ playwright, baseURL, db, evidence }) => {
      const user = await createTeamUser(db, { role: "OWNER" });
      evidence("owner", "GET /admin y GET RSC con un JWT recién emitido");
      const api = await withCookie(playwright, baseURL, await forgeSessionToken(claims(user), 60));
      const variants: Array<Record<string, string>> = [{}, { RSC: "1" }];
      for (const headers of variants) {
        const res = await api.get("/admin", { maxRedirects: 0, headers });
        expect(res.status()).toBe(200);
        expect(sessionSetCookies(res.headersArray()), JSON.stringify(headers)).toEqual([]);
      }
      await api.dispose();
    },
  );

  test(
    "[AUTH-057] cookie de sesión inválida: el middleware conserva su borrado y manda a login",
    { tag: ["@P2", "@negative"] },
    async ({ playwright, baseURL, evidence }) => {
      evidence("anonimo", "GET /admin con authjs.session-token basura");
      const api = await withCookie(playwright, baseURL, "no-es-un-jwt");
      const res = await api.get("/admin", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers()["location"]).toContain("/login");
      expect(sessionSetCookies(res.headersArray()), "Set-Cookie que borra la cookie inválida").toContain("");
      await api.dispose();
    },
  );

  test(
    "[AUTH-058] JWT con ≥ 1 h pero revocado: aunque un GET lo renueve, la cookie renovada sigue sin autorizar",
    { tag: ["@P1", "@negative", "@regression"] },
    async ({ playwright, baseURL, db, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-004" });
      const user = await createTeamUser(db, { role: "OWNER" });
      await db.user.update({ where: { id: user.id }, data: { sessionVersion: 1 } }); // p. ej. cerró sesión después
      evidence("owner", "GET /admin con un JWT de hace 2 h y sessionVersion vieja");
      const api = await withCookie(playwright, baseURL, await forgeSessionToken(claims(user, 0), TWO_HOURS));
      const res = await api.get("/admin", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers()["location"]).toContain("/login");
      const renewed = sessionSetCookies(res.headersArray()).filter(Boolean);
      for (const value of renewed) {
        expect(await readSessionToken(value), "la renovación conserva la versión revocada").toMatchObject({
          sessionVersion: 0,
        });
        const replay = await withCookie(playwright, baseURL, value);
        const probe = await replay.get("/admin/customers", { maxRedirects: 0 });
        expect(probe.status()).toBe(307);
        expect(probe.headers()["location"]).toContain("/login");
        await replay.dispose();
      }
      await api.dispose();
    },
  );

  test(
    "[AUTH-059] GET /api/auth/session devuelve la sesión pero no re-emite la cookie (ni reciente ni antigua)",
    { tag: ["@P2", "@negative", "@regression"] },
    async ({ playwright, baseURL, db, evidence }) => {
      test
        .info()
        .annotations.push({
          type: "regression",
          description: "BUG-001 (endpoint fuera del matcher del middleware)",
        });
      const user = await createTeamUser(db, { role: "OWNER" });
      evidence("owner", "GET /api/auth/session con JWT reciente y con JWT de hace 2 h");
      for (const age of [60, TWO_HOURS]) {
        const api = await withCookie(playwright, baseURL, await forgeSessionToken(claims(user), age));
        const res = await api.get("/api/auth/session");
        expect(res.status()).toBe(200);
        const body = (await res.json()) as { user?: { email?: string } };
        expect(body.user?.email, `sesión leída (iat hace ${age} s)`).toBe(user.email);
        expect(sessionSetCookies(res.headersArray()), `sin Set-Cookie de sesión (iat hace ${age} s)`).toEqual(
          [],
        );
        await api.dispose();
      }
      // Un token inválido sí se sigue borrando
      const bad = await withCookie(playwright, baseURL, "no-es-un-jwt");
      const res = await bad.get("/api/auth/session");
      expect(res.status()).toBe(200);
      expect(sessionSetCookies(res.headersArray())).toContain("");
      await bad.dispose();
    },
  );
});
