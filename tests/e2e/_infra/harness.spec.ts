/**
 * Autoverificación de la infraestructura E2E (@infra). NO cuenta para el quality gate:
 * confirma que servidor, base, sesiones por rol, vigilante de errores y replay de acciones funcionan
 * antes de confiar en cualquier otro resultado. Si algo aquí falla => PROBLEMA DEL ENTORNO, no bug de la app.
 */
import {
  captureServerAction,
  createUnreadNotification,
  expect,
  replayServerAction,
  test,
  wasAccepted,
  wasBlocked,
  wasDenied,
} from "../fixtures";

test.describe("infraestructura E2E", { tag: "@infra" }, () => {
  test("servidor y base de datos responden", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const db = await request.get("/api/health/db");
    expect(db.status()).toBe(200);
    expect(await db.json()).toMatchObject({ status: "ok", database: "up" });
  });

  test("sesiones por rol y barreras de acceso", async ({ rolePage, anonPage, evidence }) => {
    evidence("owner", "también valida staff y anónimo");
    const owner = await rolePage("owner");
    await owner.goto("/admin");
    await expect(owner.getByRole("heading", { level: 1 })).toContainText(/Hola/);

    const staff = await rolePage("staff");
    await staff.goto("/admin");
    await expect(staff).toHaveURL(/\/staff/);

    const anon = await anonPage();
    await anon.goto("/admin/leads");
    await expect(anon).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fleads/);
  });

  test("replay de Server Actions: acepta al rol autorizado y rechaza al resto", async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "acción: Bandeja › Marcar todo como leído; replay como staff y anónimo");
    const first = await createUnreadNotification(db);

    const owner = await rolePage("owner");
    await owner.goto("/admin/notifications");
    const captured = await captureServerAction(owner, () =>
      owner.getByRole("button", { name: "Marcar todo como leído" }).click(),
    );
    await expect.poll(async () => (await db.notificationLog.findUnique({ where: { id: first.id } }))?.readAt).not.toBeNull();

    // Nuevo aviso sin leer: ningún rol sin permiso debe poder marcarlo.
    const second = await createUnreadNotification(db);
    const staffApi = await apiAs("staff");
    const anonApi = await apiAs(null);

    const staffReplay = await replayServerAction(staffApi, captured); // misma ruta: middleware + guard
    const anonReplay = await replayServerAction(anonApi, captured);
    const viaRoot = await replayServerAction(staffApi, captured, { path: "/" }); // ruta que no contiene la acción
    expect(wasDenied(staffReplay), `staff: ${staffReplay.outcome} ${staffReplay.status} ${staffReplay.redirectedTo}`).toBe(true);
    expect(wasDenied(anonReplay), `anónimo: ${anonReplay.outcome} ${anonReplay.status} ${anonReplay.redirectedTo}`).toBe(true);
    // Next 15.5 no ejecuta una acción enviada a una página que no la importa (outcome "not-executed").
    // Si una actualización de Next cambiara esto, debe convertirse en "denied" por el RBAC de la acción.
    expect(wasBlocked(viaRoot), `staff vía "/": ${viaRoot.outcome} ${viaRoot.status} ${viaRoot.text.slice(0, 120)}`).toBe(true);
    test.info().annotations.push({ type: "replay vía /", description: viaRoot.outcome });
    expect((await db.notificationLog.findUnique({ where: { id: second.id } }))?.readAt, "nada cambió en la base").toBeNull();

    // Control positivo: el mismo request con la sesión de la fundadora sí funciona.
    const ownerApi = await apiAs("owner");
    const ok = await replayServerAction(ownerApi, captured);
    expect(wasAccepted(ok), `owner: ${ok.outcome} ${ok.status} ${ok.text.slice(0, 160)}`).toBe(true);
    await expect.poll(async () => (await db.notificationLog.findUnique({ where: { id: second.id } }))?.readAt).not.toBeNull();
  });
});
