/**
 * Bandeja de notificaciones (/admin/notifications): filtros, abrir un mensaje lo marca leído,
 * marcar como no leído, y enlaces de notificaciones al staff hacia rutas reales.
 * «Marcar todo como leído» y los recordatorios (estado de toda la bandeja) están en notifications.global.spec.ts.
 */
import { expect, test } from "../fixtures";
import { createUnreadNotification, uniq } from "../fixtures";
import { ready, toast } from "../operations/_helpers";

test.describe("Notificaciones · bandeja", { tag: ["@module:notifications"] }, () => {
  test("[NOT-001] la bandeja busca por asunto y filtra por canal, tipo y estado", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/notifications?q=…&channel=…&status=…");
    const subject = uniq("Aviso bandeja E2E");
    await createUnreadNotification(db, { subject, channel: "EMAIL", status: "MOCKED", type: "GENERIC" });
    const page = await rolePage("owner");
    await page.goto("/admin/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Bandeja" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "Modo demo" })).toBeVisible();
    await page.goto(`/admin/notifications?q=${encodeURIComponent(subject)}`);
    const list = page.getByRole("list", { name: "Mensajes" });
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByText(subject)).toBeVisible();
    await expect(page.getByText(/^1 mensaje con estos filtros/)).toBeVisible();
    await page.goto(`/admin/notifications?q=${encodeURIComponent(subject)}&channel=EMAIL&type=GENERIC&status=MOCKED`);
    await expect(page.getByRole("list", { name: "Mensajes" }).getByText(subject)).toBeVisible();
    await page.goto(`/admin/notifications?q=${encodeURIComponent(subject)}&channel=WHATSAPP`);
    await expect(page.getByText("Ningún mensaje coincide")).toBeVisible();
    await page.goto(`/admin/notifications?q=${encodeURIComponent(subject)}&status=FAILED`);
    await expect(page.getByText("Ningún mensaje coincide")).toBeVisible();
  });

  test("[NOT-002] abrir un mensaje lo marca como leído y se puede volver a marcar como no leído", { tag: ["@P1", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/notifications?id=<id> → Marcar como no leído");
    test.info().annotations.push({ type: "regression", description: "BUG-006" }); // router.refresh() de AutoMarkRead
    const n = await createUnreadNotification(db, { subject: uniq("Abrir aviso E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/notifications?id=${n.id}&q=${encodeURIComponent(n.subject!)}`);
    await expect(page.getByRole("heading", { level: 2, name: n.subject! })).toBeVisible();
    await expect.poll(async () => (await db.notificationLog.findUnique({ where: { id: n.id } }))?.readAt).not.toBeNull();
    await (await ready(page.getByRole("button", { name: "Marcar como no leído" }))).click();
    await expect(toast(page, "Marcado como no leído")).toBeVisible();
    await expect.poll(async () => (await db.notificationLog.findUnique({ where: { id: n.id } }))?.readAt).toBeNull();
  });

  test("[NOT-003] el filtro «sin leer» muestra sólo pendientes y respeta la lectura", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/notifications?unread=1&q=…");
    const tag = uniq("Sin leer E2E");
    const unread = await createUnreadNotification(db, { subject: `${tag} A` });
    await createUnreadNotification(db, { subject: `${tag} B`, readAt: new Date() });
    const page = await rolePage("owner");
    await page.goto(`/admin/notifications?unread=1&q=${encodeURIComponent(tag)}`);
    const list = page.getByRole("list", { name: "Mensajes" });
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByText(unread.subject!)).toBeVisible();
    await db.notificationLog.update({ where: { id: unread.id }, data: { readAt: new Date() } });
    await page.reload();
    await expect(page.getByText("Ningún mensaje coincide")).toBeVisible();
  });

  test("[NOT-007] los avisos STAFF_ASSIGNED de la bandeja enlazan a una ruta real del portal (/staff/events/<id>)", { tag: ["@P3"] }, async ({ rolePage, db, evidence, guard }) => {
    evidence("staff", "Cada STAFF_ASSIGNED de la base → su actionUrl abierto por la persona asignada (Lupita)");
    test.info().annotations.push({ type: "bug", description: "OPX-BUG-04 (DATA ISSUE del seed DEMO)" });
    guard.allow(/404/); // enlaces rotos esperados si el defecto existe: se reportan abajo
    // Sólo los avisos dirigidos a Lupita (correo o WhatsApp): así su sesión puede abrir cada enlace.
    const lupitaRows = await db.notificationLog.findMany({
      where: { type: "STAFF_ASSIGNED", OR: [{ to: { contains: "33011101" } }, { to: "staff@ivonne-rosa.test" }] },
    });
    expect(lupitaRows.length, "el seed trae avisos STAFF_ASSIGNED").toBeGreaterThan(0);
    const broken: string[] = [];
    for (const n of lupitaRows) {
      const path = n.actionUrl ? new URL(n.actionUrl).pathname : "(sin enlace)";
      if (!/^\/staff\/events\/[a-z0-9]+$/.test(path)) broken.push(`${n.id}: ${path}`);
    }
    const page = await rolePage("staff");
    for (const n of lupitaRows.filter((r) => r.actionUrl)) {
      await page.goto(new URL(n.actionUrl!).pathname);
      if (await page.getByText(/No encontramos/).count()) broken.push(`${n.id}: ${new URL(n.actionUrl!).pathname} → no encontrado`);
    }
    test.info().annotations.push({ type: "enlaces", description: broken.join(" | ") || "todos válidos" });
    expect(broken, "avisos con enlace roto").toEqual([]);
  });
});
