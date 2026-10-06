/**
 * Notificaciones con efecto sobre TODA la bandeja / todos los eventos (suite E2E_SUITE=global, serial):
 * marcar todo como leído, ejecutar recordatorios ahora (sin duplicar) y el cron con secreto.
 */
import { expect, test, createUnreadNotification, uniq } from "../fixtures";
import { auditCount, createEvent, ready, toast } from "../operations/_helpers";

// E2E_SUITE=global corre con 1 worker ⇒ ejecución secuencial garantizada. Se evita mode:"serial" para que un fallo
// no deje sin ejecutar (NOT TESTED) al resto de las pruebas independientes del archivo.
test.describe.configure({ mode: "default" });

const HOUR = 3_600_000;

test.describe("Notificaciones globales", { tag: ["@module:notifications"] }, () => {
  test("[NOT-004] «Marcar todo como leído» deja la bandeja sin pendientes", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/notifications › Marcar todo como leído");
    await createUnreadNotification(db, { subject: uniq("Pendiente A E2E") });
    await createUnreadNotification(db, { subject: uniq("Pendiente B E2E") });
    const unread = await db.notificationLog.count({ where: { readAt: null } });
    expect(unread).toBeGreaterThanOrEqual(2);
    const page = await rolePage("owner");
    await page.goto("/admin/notifications");
    await (await ready(page.getByRole("button", { name: "Marcar todo como leído" }))).click();
    await expect(toast(page, `${unread} marcados como leídos`)).toBeVisible();
    await expect.poll(() => db.notificationLog.count({ where: { readAt: null } })).toBe(0);
    await expect(page.getByText("0 sin leer en total")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar todo como leído" })).toBeDisabled();
  });

  test("[NOT-005] «Ejecutar recordatorios ahora» genera 7 días y 48 h una sola vez (idempotente) y se audita", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Bandeja › Ejecutar recordatorios ahora (2 veces) con eventos propios a 5 días y a 30 h");
    const in5days = new Date(Date.now() + 5 * 24 * HOUR);
    const in30h = new Date(Date.now() + 30 * HOUR);
    const keyOf = (d: Date) => d.toISOString().slice(0, 10);
    const ev7 = await createEvent(db, { title: uniq("Recordatorio 7d E2E") });
    await db.event.update({ where: { id: ev7.id }, data: { startsAt: in5days, endsAt: new Date(in5days.getTime() + 3 * HOUR), eventDate: new Date(`${keyOf(in5days)}T00:00:00Z`) } });
    const ev48 = await createEvent(db, { title: uniq("Recordatorio 48h E2E") });
    await db.event.update({ where: { id: ev48.id }, data: { startsAt: in30h, endsAt: new Date(in30h.getTime() + 3 * HOUR), eventDate: new Date(`${keyOf(in30h)}T00:00:00Z`) } });
    const audits = await auditCount(db, "notifications.scheduler_run");
    const page = await rolePage("owner");
    await page.goto("/admin/notifications");
    await (await ready(page.getByRole("button", { name: "Ejecutar recordatorios ahora" }))).click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    await expect.poll(() => db.notificationLog.count({ where: { eventId: ev7.id, type: "EVENT_7D" } })).toBe(2);
    await expect.poll(() => db.notificationLog.count({ where: { eventId: ev48.id, type: "EVENT_48H" } })).toBe(2);
    const keys = (await db.notificationLog.findMany({ where: { eventId: ev7.id, type: "EVENT_7D" } })).map((n) => n.dedupeKey).sort();
    expect(keys).toEqual([`sched:event_7d:${ev7.id}:${in5days.getTime()}:email`, `sched:event_7d:${ev7.id}:${in5days.getTime()}:wa`]);
    expect(await auditCount(db, "notifications.scheduler_run")).toBe(audits + 1);
    // Segunda ejecución: no duplica
    await page.reload();
    await (await ready(page.getByRole("button", { name: "Ejecutar recordatorios ahora" }))).click();
    await expect.poll(() => auditCount(db, "notifications.scheduler_run")).toBe(audits + 2);
    expect(await db.notificationLog.count({ where: { eventId: ev7.id, type: "EVENT_7D" } })).toBe(2);
    expect(await db.notificationLog.count({ where: { eventId: ev48.id, type: "EVENT_48H" } })).toBe(2);
  });

  test("[NOT-006] el cron /api/cron/notifications con el secreto correcto ejecuta las reglas sin duplicar", { tag: ["@P1"] }, async ({ request, db, evidence }) => {
    evidence("anonimo", "POST /api/cron/notifications con Authorization: Bearer $CRON_SECRET (2 veces)");
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      test.info().annotations.push({ type: "blocked", description: "ENVIRONMENT ISSUE: CRON_SECRET no definido en .env" });
      test.skip(true, "BLOCKED: falta CRON_SECRET");
    }
    const in6days = new Date(Date.now() + 6 * 24 * HOUR);
    const ev = await createEvent(db, { title: uniq("Cron 7d E2E") });
    await db.event.update({ where: { id: ev.id }, data: { startsAt: in6days, endsAt: new Date(in6days.getTime() + 3 * HOUR), eventDate: new Date(`${in6days.toISOString().slice(0, 10)}T00:00:00Z`) } });
    const first = await request.post("/api/cron/notifications", { headers: { Authorization: `Bearer ${secret}` } });
    expect(first.status()).toBe(200);
    const body = await first.json();
    expect(body).toMatchObject({ ok: true });
    expect(body.counts.event7d).toBeGreaterThanOrEqual(2);
    expect(body.failedRules).toEqual([]);
    expect(await db.notificationLog.count({ where: { eventId: ev.id, type: "EVENT_7D" } })).toBe(2);
    const second = await request.get("/api/cron/notifications", { headers: { Authorization: `Bearer ${secret}` } });
    expect(second.status()).toBe(200);
    expect((await second.json()).counts.event7d).toBe(0);
    expect(await db.notificationLog.count({ where: { eventId: ev.id, type: "EVENT_7D" } })).toBe(2);
    const wrong = await request.post("/api/cron/notifications", { headers: { Authorization: "Bearer secreto-incorrecto-e2e" } });
    expect(wrong.status()).toBe(401);
  });
});
