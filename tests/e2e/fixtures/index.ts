/**
 * `test` y `expect` del proyecto para E2E. Importar SIEMPRE desde aquí:
 *   import { test, expect } from "../fixtures";
 *
 * Fixtures:
 *  - guard (auto): vigila consola/red de `page` y de toda página creada con rolePage(); falla la prueba
 *    ante errores no declarados y adjunta el detalle al reporte.
 *  - db: PrismaClient de la base E2E (persistencia real, factories, "nada cambió").
 *  - rolePage(role): página nueva con la sesión guardada de ese rol (owner, staff, superadmin…).
 *  - anonPage(): página nueva sin sesión.
 *  - apiAs(role | null): cliente HTTP con la sesión del rol (o anónimo) para rutas de API y replay de acciones.
 *  - evidence(role, steps?): anota rol/entorno en el reporte (evidencia de fallos).
 *
 * Para usar una sesión en todo un archivo:  test.use({ storageState: storageStatePath("owner") });
 */
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { storageStatePath, type E2ERole, ACCOUNTS } from "./accounts";
import { disconnectDb, getDb } from "./db";
import { ErrorGuard } from "./guard";

type Fixtures = {
  guard: ErrorGuard;
  rolePage: (role: E2ERole) => Promise<Page>;
  anonPage: () => Promise<Page>;
  apiAs: (role: E2ERole | null) => Promise<APIRequestContext>;
  evidence: (role: E2ERole | "anonimo" | "clienta" | "invitada", note?: string) => void;
};
type WorkerFixtures = { db: PrismaClient };

export const test = base.extend<Fixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      await use(getDb());
      await disconnectDb();
    },
    { scope: "worker" },
  ],

  guard: [
    async ({ page }, use, testInfo) => {
      const guard = new ErrorGuard();
      guard.watch(page);
      await use(guard);
      const report = guard.report();
      if (report.all.length) {
        await testInfo.attach("console-network.json", {
          body: JSON.stringify(report, null, 2),
          contentType: "application/json",
        });
      }
      const violations = report.violations;
      // Sólo convierte en fallo una prueba que, por lo demás, pasó (no tapa el error original).
      if (violations.length && testInfo.status === testInfo.expectedStatus) {
        throw new Error(
          `Errores de consola/red no esperados (${violations.length}):\n` +
            violations.map((v) => ` - [${v.kind}] ${v.text}`).join("\n") +
            `\nSi alguno es esperado, decláralo con guard.allow(/patrón/) y justifícalo.`,
        );
      }
    },
    { auto: true },
  ],

  rolePage: async ({ browser, guard }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (role) => {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      contexts.push(context);
      const page = await context.newPage();
      guard.watch(page);
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },

  anonPage: async ({ browser, guard }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async () => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      contexts.push(context);
      const page = await context.newPage();
      guard.watch(page);
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },

  apiAs: async ({ playwright, baseURL }, use) => {
    const created: APIRequestContext[] = [];
    await use(async (role) => {
      const ctx = await playwright.request.newContext({
        baseURL,
        storageState: role ? storageStatePath(role) : { cookies: [], origins: [] },
      });
      created.push(ctx);
      return ctx;
    });
    await Promise.all(created.map((c) => c.dispose()));
  },

  evidence: async ({}, use, testInfo) => {
    await use((role, note) => {
      const who = role in ACCOUNTS ? `${role} (${ACCOUNTS[role as E2ERole].email})` : role;
      testInfo.annotations.push({ type: "rol", description: who });
      if (note) testInfo.annotations.push({ type: "nota", description: note });
    });
  },
});

export { expect };
export { storageStatePath, ACCOUNTS, TOKENS, PASSWORD } from "./accounts";
export type { E2ERole } from "./accounts";
export { captureServerAction, replayServerAction, wasDenied, wasBlocked, wasAccepted } from "./server-actions";
export type { CapturedAction, ReplayResult, ReplayOutcome } from "./server-actions";
export { scanA11y } from "./a11y";
export * from "./data";
