/**
 * ESTADO GLOBAL — flag AI_DESIGNER_ENABLED apagado (Setting "flags").
 * Corre sólo con E2E_SUITE=global (1 worker) y restaura el valor original en `finally`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { expect, test, uniqPhone } from "../fixtures";
import { callAction, failure, okData } from "../configurator/_helpers";

test.describe.configure({ mode: "serial" });

async function withFlags<T>(db: PrismaClient, patch: Record<string, boolean>, fn: () => Promise<T>): Promise<T> {
  const before = await db.setting.findUnique({ where: { key: "flags" } });
  const current = (before?.value ?? {}) as Record<string, unknown>;
  await db.setting.upsert({
    where: { key: "flags" },
    create: { key: "flags", value: { ...current, ...patch } as Prisma.InputJsonValue },
    update: { value: { ...current, ...patch } as Prisma.InputJsonValue },
  });
  try {
    return await fn();
  } finally {
    if (before) await db.setting.update({ where: { key: "flags" }, data: { value: before.value as Prisma.InputJsonValue } });
    else await db.setting.delete({ where: { key: "flags" } });
  }
}

const ROUTE = "/crear-experiencia/ai";

test.describe("Diseñador IA con el flag apagado", { tag: ["@module:ai"] }, () => {
  test(
    "[AI-009] AI_DESIGNER_ENABLED=false: la página muestra la pausa, el configurador oculta el acceso y el backend rechaza generar y convertir",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("anonimo", "Flag apagado en Setting flags (se restaura al final)");
      const area = await db.serviceArea.findFirstOrThrow({ where: { active: true }, orderBy: { sortOrder: "asc" } });
      const input = {
        occasion: "BIRTHDAY",
        profile: "Perfil de prueba con flag apagado",
        guestCount: 8,
        budgetRangeId: "sin-definir",
        colors: [],
        vibes: ["relajado"],
        serviceArea: area.id,
        dietary: [],
      };
      // Diseño previo (flag encendido) para probar también la conversión con el flag apagado.
      const design = okData(await callAction<{ id: string }>(request, baseURL!, "generateDesignAction", input, ROUTE));
      const designsBefore = await db.aiDesign.count();
      const leadsBefore = await db.lead.count();

      await withFlags(db, { AI_DESIGNER_ENABLED: false }, async () => {
        await page.goto(ROUTE);
        await expect(page.getByRole("heading", { name: "El diseñador con IA está tomando una pausa" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Diseñar mi experiencia" })).toHaveCount(0);
        await page.getByRole("link", { name: "Crear mi experiencia paso a paso" }).click();
        await expect(page).toHaveURL(/\/crear-experiencia$/);
        await expect(page.getByRole("link", { name: /Prueba el diseñador con IA/ })).toHaveCount(0);

        const gen = failure(await callAction(request, baseURL!, "generateDesignAction", input, ROUTE));
        expect(gen.code).toBe("FEATURE_DISABLED");
        const conv = failure(
          await callAction(request, baseURL!, "convertDesignToLeadAction", { designId: design.id, name: "Flag Apagado", phone: uniqPhone(), email: "", eventDate: "", consent: true }, ROUTE),
        );
        expect(conv.code).toBe("FEATURE_DISABLED");
        expect(await db.aiDesign.count()).toBe(designsBefore);
        expect(await db.lead.count()).toBe(leadsBefore);
      });

      // Restaurado: vuelve a estar disponible.
      await page.goto(ROUTE);
      await expect(page.getByRole("button", { name: "Diseñar mi experiencia" })).toBeVisible();
    },
  );
});
