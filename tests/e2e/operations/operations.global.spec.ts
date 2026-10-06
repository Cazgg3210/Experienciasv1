/**
 * Plantillas ACTIVAS (estado global: afectan el checklist de cualquier evento) — suite E2E_SUITE=global.
 */
import { expect, test } from "../fixtures";
import { createEvent, dayKey, ready, toast, uniq } from "./_helpers";

// E2E_SUITE=global corre con 1 worker ⇒ ejecución secuencial garantizada. Se evita mode:"serial" para que un fallo
// no deje sin ejecutar (NOT TESTED) al resto de las pruebas independientes del archivo.
test.describe.configure({ mode: "default" });

test.describe("Operaciones · plantillas activas", { tag: ["@module:operations"] }, () => {
  test("[OPS-029] una plantilla general activa se copia al generar checklists; al desactivarla deja de copiarse", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantilla activa propia → Generar en evento A → desactivar → Generar en evento B");
    const title = uniq("Tarea plantilla activa E2E");
    const t = await db.checklistTemplate.create({
      data: { name: uniq("Plantilla activa E2E"), phase: "EVENT", active: true, sortOrder: 99, items: { create: [{ title, offsetMinutes: 30, area: "GENERAL", defaultFunction: "COORDINATOR" }] } },
    });
    const evA = await createEvent(db, { dateKey: dayKey(37) });
    const evB = await createEvent(db, { dateKey: dayKey(38) });
    const page = await rolePage("owner");
    try {
      await page.goto(`/admin/events/${evA.id}/operations`);
      await (await ready(page.getByRole("button", { name: "Generar desde plantillas" }).first())).click();
      await expect(toast(page, /Agregamos \d+ tareas/)).toBeVisible();
      const copy = await db.eventChecklistItem.findFirstOrThrow({ where: { eventId: evA.id, title } });
      expect(copy.dueAt?.getTime()).toBe(evA.startsAt.getTime() + 30 * 60_000);

      await page.goto(`/admin/operations/templates/${t.id}`);
      await (await ready(page.getByRole("switch", { name: "Plantilla activa" }))).click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(toast(page, "Plantilla guardada")).toBeVisible();
      await expect.poll(async () => (await db.checklistTemplate.findUnique({ where: { id: t.id } }))?.active).toBe(false);

      await page.goto(`/admin/events/${evB.id}/operations`);
      await (await ready(page.getByRole("button", { name: "Generar desde plantillas" }).first())).click();
      await expect(toast(page, /Agregamos \d+ tareas/)).toBeVisible();
      expect(await db.eventChecklistItem.count({ where: { eventId: evB.id, title } })).toBe(0);
    } finally {
      await db.checklistTemplate.delete({ where: { id: t.id } }).catch(() => undefined);
    }
  });
});
