/**
 * Memory Capsule con el flag MEMORY_CAPSULE_ENABLED apagado (ESTADO GLOBAL).
 * Suite aparte (E2E_SUITE=global, 1 worker, serial). El valor original del Setting "flags" se
 * restaura en `finally`.
 * Paquete 4 · carril 4 · prefijo MEM.
 */
import { expect, test } from "../fixtures";
import type { Prisma } from "@prisma/client";
import { callAction, createCapsuleFixture, createEventFixture, describe as d, uploadGuestPhoto } from "../events/_helpers";

test.describe.configure({ mode: "serial" });

test.describe("Memory Capsule · flag apagado", { tag: ["@module:memory"] }, () => {
  test("[MEM-020] con MEMORY_CAPSULE_ENABLED=false la cápsula pública, la subida y el libro de visitas quedan cerrados", { tag: ["@P1"] }, async ({ anonPage, rolePage, apiAs, db, evidence }) => {
    evidence("anonimo", "Setting flags.MEMORY_CAPSULE_ENABLED=false → /memory/[token], upload, guestbook, admin y portal");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const original = await db.setting.findUnique({ where: { key: "flags" } });
    try {
      const flags = { ...((original?.value as Record<string, unknown>) ?? {}), MEMORY_CAPSULE_ENABLED: false };
      await db.setting.upsert({
        where: { key: "flags" },
        create: { key: "flags", value: flags as Prisma.InputJsonValue },
        update: { value: flags as Prisma.InputJsonValue },
      });
      const page = await anonPage();
      const res = await page.goto(cap.path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Las Memory Capsules no están disponibles por ahora" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: cap.title })).toHaveCount(0);
      const api = await apiAs(null);
      const up = await uploadGuestPhoto(api, cap.shareToken, { name: "Con Flag Apagado" });
      expect(up.status).toBe(404);
      const gb = await callAction(api, "submitGuestbookMessageAction", { token: cap.shareToken, name: "Ana", body: "Hola con flag apagado" }, { path: cap.path });
      expect(gb.code, d(gb)).toBe("NOT_FOUND");
      expect(await db.mediaAsset.count({ where: { memoryCapsuleId: cap.id } })).toBe(0);
      expect(await db.eventMessage.count({ where: { eventId: ev.id, kind: "GUESTBOOK" } })).toBe(0);
      // El admin ve el aviso y el portal no ofrece el enlace
      const owner = await rolePage("owner");
      await owner.goto(`/admin/events/${ev.id}/memory`);
      await expect(owner.getByText("La Memory Capsule está desactivada")).toBeVisible();
      await page.goto(ev.portalPath);
      await expect(page.getByRole("link", { name: "Ver mi Memory Capsule" })).toHaveCount(0);
    } finally {
      if (original) await db.setting.update({ where: { key: "flags" }, data: { value: original.value as Prisma.InputJsonValue } });
      else await db.setting.delete({ where: { key: "flags" } }).catch(() => undefined);
    }
    // Restaurado: la cápsula vuelve a estar disponible
    const page = await anonPage();
    await page.goto(cap.path);
    await expect(page.getByRole("heading", { level: 1, name: cap.title })).toBeVisible();
  });
});
