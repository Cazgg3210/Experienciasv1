/**
 * Ajustes con ESTADO GLOBAL (suite E2E_SUITE=global: serial, 1 worker). Cada prueba restaura el valor
 * original en `finally` a través de la misma UI (así también se invalida la caché de settings).
 * Nota ENV-01: la caché de datos de Next se comparte entre carriles; por eso aquí NO se abren páginas
 * públicas mientras un ajuste de negocio está modificado.
 */
import type { Page } from "@playwright/test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { expect, test } from "../fixtures";
import { ready, toast } from "../operations/_helpers";

// E2E_SUITE=global corre con 1 worker ⇒ ejecución secuencial garantizada. Se evita mode:"serial" para que un fallo
// no deje sin ejecutar (NOT TESTED) al resto de las pruebas independientes del archivo.
test.describe.configure({ mode: "default" });

async function settingValue<T>(db: PrismaClient, key: string): Promise<T> {
  return ((await db.setting.findUnique({ where: { key } }))?.value ?? {}) as T;
}

async function saveField(page: Page, url: string, label: string, value: string, successToast: string) {
  await page.goto(url);
  await (await ready(page.getByLabel(label, { exact: false }).first())).fill(value);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(toast(page, successToast)).toBeVisible();
}

test.describe("Ajustes globales · negocio, precios, disponibilidad y notificaciones", { tag: ["@module:settings"] }, () => {
  test("[SET-002] datos del negocio: guardar la versión de términos persiste y queda auditado", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings › Versión de términos");
    const original = await settingValue<{ termsVersion?: string }>(db, "business");
    const page = await rolePage("owner");
    try {
      await saveField(page, "/admin/settings", "Versión de términos", "2026-10-e2e", "Datos del negocio guardados");
      await expect.poll(async () => (await settingValue<{ termsVersion: string }>(db, "business")).termsVersion).toBe("2026-10-e2e");
      const a = await db.auditLog.findFirstOrThrow({ where: { action: "settings.updated", entityId: "business" }, orderBy: { createdAt: "desc" } });
      expect((a.after as { termsVersion: string }).termsVersion).toBe("2026-10-e2e");
      await page.reload();
      await expect(page.getByLabel("Versión de términos")).toHaveValue("2026-10-e2e");
    } finally {
      await saveField(page, "/admin/settings", "Versión de términos", original.termsVersion ?? "2026-09", "Datos del negocio guardados").catch(async () => {
        await db.setting.update({ where: { key: "business" }, data: { value: original as Prisma.InputJsonValue } });
      });
    }
    expect((await settingValue<{ termsVersion: string }>(db, "business")).termsVersion).toBe(original.termsVersion ?? "2026-09");
  });

  test("[SET-003] datos del negocio: un WhatsApp con letras se rechaza sin guardar", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings › WhatsApp del negocio inválido");
    const before = await db.setting.findUniqueOrThrow({ where: { key: "business" } });
    const page = await rolePage("owner");
    await page.goto("/admin/settings");
    await (await ready(page.getByLabel("WhatsApp del negocio"))).fill("55-abc-1234");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Sólo números con lada, sin espacios (10 a 15 dígitos). Ej. 5215512345678")).toBeVisible();
    const after = await db.setting.findUniqueOrThrow({ where: { key: "business" } });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("[SET-004] precios: cambiar el IVA a 17 % se guarda en bps, se describe el cambio y se audita", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings/pricing › IVA 16 → 17; auditoría");
    const original = await settingValue<{ taxRateBps?: number }>(db, "pricing");
    const originalPct = String((original.taxRateBps ?? 1600) / 100);
    const page = await rolePage("owner");
    try {
      await page.goto("/admin/settings/pricing");
      await (await ready(page.getByRole("spinbutton", { name: "IVA", exact: true }))).fill("17");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(toast(page, "Precios y márgenes actualizados")).toBeVisible();
      await expect(toast(page, `IVA ${originalPct}% → 17%`)).toBeVisible();
      await expect.poll(async () => (await settingValue<{ taxRateBps: number }>(db, "pricing")).taxRateBps).toBe(1700);
      const a = await db.auditLog.findFirstOrThrow({ where: { action: "settings.pricing_changed", entityId: "pricing" }, orderBy: { createdAt: "desc" } });
      expect((a.before as { taxRateBps: number }).taxRateBps).toBe(original.taxRateBps ?? 1600);
      expect((a.after as { taxRateBps: number }).taxRateBps).toBe(1700);
      await page.goto("/admin/settings/audit?action=settings.pricing_changed");
      await expect(page.getByRole("listitem").filter({ hasText: "Precios y márgenes actualizados" }).first()).toBeVisible();
    } finally {
      await page.goto("/admin/settings/pricing");
      await (await ready(page.getByRole("spinbutton", { name: "IVA", exact: true }))).fill(originalPct);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(toast(page, "Precios y márgenes actualizados")).toBeVisible();
    }
    expect((await settingValue<{ taxRateBps: number }>(db, "pricing")).taxRateBps).toBe(original.taxRateBps ?? 1600);
  });

  test("[SET-005] precios: el máximo de invitadas no puede ser menor al mínimo", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings/pricing › mínimo 10, máximo 8");
    const before = await db.setting.findUniqueOrThrow({ where: { key: "pricing" } });
    const page = await rolePage("owner");
    await page.goto("/admin/settings/pricing");
    await (await ready(page.getByLabel("Mínimo de invitadas"))).fill("10");
    await page.getByLabel("Máximo de invitadas").fill("8");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Debe ser mayor o igual al mínimo")).toBeVisible();
    expect((await db.setting.findUniqueOrThrow({ where: { key: "pricing" } })).updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("[SET-006] disponibilidad: cambiar la anticipación mínima persiste y se restaura", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings/availability › Anticipación mínima");
    const original = await settingValue<{ minLeadDays?: number }>(db, "availability");
    const page = await rolePage("owner");
    try {
      await saveField(page, "/admin/settings/availability", "Anticipación mínima", "9", "Reglas de disponibilidad guardadas");
      await expect.poll(async () => (await settingValue<{ minLeadDays: number }>(db, "availability")).minLeadDays).toBe(9);
      expect(await db.auditLog.count({ where: { action: "settings.updated", entityId: "availability" } })).toBeGreaterThan(0);
    } finally {
      await saveField(page, "/admin/settings/availability", "Anticipación mínima", String(original.minLeadDays ?? 5), "Reglas de disponibilidad guardadas");
    }
    expect((await settingValue<{ minLeadDays: number }>(db, "availability")).minLeadDays).toBe(original.minLeadDays ?? 5);
  });

  test("[SET-007] disponibilidad: «Reservas con hasta» debe superar la anticipación mínima", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings/availability › mínimo 60, máximo 30");
    const before = await db.setting.findUniqueOrThrow({ where: { key: "availability" } });
    const page = await rolePage("owner");
    await page.goto("/admin/settings/availability");
    await (await ready(page.getByLabel("Anticipación mínima"))).fill("60");
    await page.getByLabel("Reservas con hasta").fill("30");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Debe ser mayor que la anticipación mínima")).toBeVisible();
    expect((await db.setting.findUniqueOrThrow({ where: { key: "availability" } })).updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("[SET-008] notificaciones: el correo del equipo se guarda (validado) y se restaura", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/settings/notifications › Correo del equipo");
    const original = await settingValue<{ ownerNotificationEmail?: string }>(db, "notifications");
    const page = await rolePage("owner");
    try {
      await page.goto("/admin/settings/notifications");
      await (await ready(page.getByLabel("Correo del equipo"))).fill("no-es-correo");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Escribe un correo válido")).toBeVisible();
      await saveField(page, "/admin/settings/notifications", "Correo del equipo", "Equipo.E2E@Ivonne-Rosa.test", "Preferencias de notificación guardadas");
      await expect.poll(async () => (await settingValue<{ ownerNotificationEmail: string }>(db, "notifications")).ownerNotificationEmail).toBe("equipo.e2e@ivonne-rosa.test");
    } finally {
      await saveField(page, "/admin/settings/notifications", "Correo del equipo", original.ownerNotificationEmail ?? "equipo@ivonne-rosa.test", "Preferencias de notificación guardadas");
    }
  });
});

test.describe("Ajustes globales · funciones (feature flags)", { tag: ["@module:settings"] }, () => {
  test("[SET-009] apagar WhatsApp deja los mensajes como OMITIDOS; restablecer vuelve al valor de entorno (auditado)", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Funciones › Mensajes por WhatsApp off → WhatsApp de prueba → Restablecer");
    const page = await rolePage("owner");
    try {
      await page.goto("/admin/settings/flags");
      const sw = await ready(page.getByRole("switch", { name: "Mensajes por WhatsApp" }));
      if ((await sw.getAttribute("aria-checked")) === "true") {
        await sw.click();
        await expect(toast(page, "Mensajes por WhatsApp: desactivado")).toBeVisible();
      }
      await expect.poll(async () => (await settingValue<{ WHATSAPP_ENABLED?: boolean }>(db, "flags")).WHATSAPP_ENABLED).toBe(false);
      expect(await db.auditLog.count({ where: { action: "settings.flag_changed", entityId: "flags.WHATSAPP_ENABLED" } })).toBeGreaterThan(0);
      const since = new Date();
      await page.goto("/admin/settings/integrations");
      await (await ready(page.getByRole("button", { name: "Enviar WhatsApp de prueba" }))).click();
      await expect(toast(page, "WhatsApp de prueba registrado (omitido)")).toBeVisible();
      const skipped = await db.notificationLog.findFirstOrThrow({ where: { channel: "WHATSAPP", type: "GENERIC", createdAt: { gte: since } } });
      expect(skipped).toMatchObject({ status: "SKIPPED", error: "WHATSAPP_ENABLED=false" });

      await page.goto("/admin/settings/flags");
      const row = page.getByRole("listitem").filter({ hasText: "Mensajes por WhatsApp" });
      await expect(row.getByText("Forzado apagado")).toBeVisible();
      await (await ready(row.getByRole("button", { name: "Restablecer a valor de entorno" }))).click();
      await expect(toast(page, "Mensajes por WhatsApp: restablecido al valor de entorno")).toBeVisible();
      await expect.poll(async () => "WHATSAPP_ENABLED" in (await settingValue<object>(db, "flags"))).toBe(false);
      expect(await db.auditLog.count({ where: { action: "settings.flag_reset", entityId: "flags.WHATSAPP_ENABLED" } })).toBe(1);
      const since2 = new Date();
      await page.goto("/admin/settings/integrations");
      await (await ready(page.getByRole("button", { name: "Enviar WhatsApp de prueba" }))).click();
      await expect(toast(page, /WhatsApp de prueba registrado \((simulado|enviado)\)/)).toBeVisible();
      const ok = await db.notificationLog.findFirstOrThrow({ where: { channel: "WHATSAPP", type: "GENERIC", createdAt: { gte: since2 } } });
      expect(["MOCKED", "SENT"]).toContain(ok.status);
    } finally {
      const flags = await settingValue<Record<string, boolean>>(db, "flags");
      if ("WHATSAPP_ENABLED" in flags) {
        delete flags.WHATSAPP_ENABLED;
        await db.setting.update({ where: { key: "flags" }, data: { value: flags } });
      }
    }
  });

  test("[SET-010] apagar el diseñador con IA muestra la pausa en el sitio; restablecerlo lo devuelve", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Funciones › Diseñador con IA off → /crear-experiencia/ai (anónima) → Restablecer");
    const page = await rolePage("owner");
    try {
      await page.goto("/admin/settings/flags");
      const sw = await ready(page.getByRole("switch", { name: "Diseñador con IA" }));
      await expect(sw).toBeChecked();
      await sw.click();
      await expect(toast(page, "Diseñador con IA: desactivado")).toBeVisible();
      await expect.poll(async () => (await settingValue<{ AI_DESIGNER_ENABLED?: boolean }>(db, "flags")).AI_DESIGNER_ENABLED).toBe(false);
      const visitor = await anonPage();
      await visitor.goto("/crear-experiencia/ai");
      await expect(visitor.getByText("El diseñador con IA está tomando una pausa")).toBeVisible();
      await expect(visitor.getByRole("link", { name: /Crear mi experiencia paso a paso/ })).toBeVisible();
      await page.getByRole("listitem").filter({ hasText: "Diseñador con IA" }).getByRole("button", { name: "Restablecer a valor de entorno" }).click();
      await expect(toast(page, "Diseñador con IA: restablecido al valor de entorno")).toBeVisible();
      await visitor.reload();
      await expect(visitor.getByText("El diseñador con IA está tomando una pausa")).toHaveCount(0);
    } finally {
      const flags = await settingValue<Record<string, boolean>>(db, "flags");
      if ("AI_DESIGNER_ENABLED" in flags) {
        delete flags.AI_DESIGNER_ENABLED;
        await db.setting.update({ where: { key: "flags" }, data: { value: flags } });
      }
    }
  });
});
