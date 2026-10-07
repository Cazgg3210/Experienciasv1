/**
 * Inventario: artículos (alta, edición, inactivos, umbral), ajustes de stock (nunca negativos),
 * reservas por evento (recalcular, agregar, cantidad, salida, regreso con daños, liberar) y conflictos.
 * Todas las pruebas usan artículos/eventos PROPIOS para no depender del stock del seed.
 */
import { captureServerAction, expect, replayServerAction, test } from "../fixtures";
import {
  actionError,
  auditCount,
  confirmAlert,
  createEvent,
  createExperienceWithReqs,
  createInventoryItem,
  createReservation,
  dayKey,
  pickRadixOption,
  ready,
  swapInBody,
  routerRefreshed,
  toast,
  uniq,
} from "../operations/_helpers";
import { randomBytes } from "node:crypto";

const resUrl = (eventId: string) => `/admin/inventory/events/${eventId}`;

test.describe("Inventario · artículos y stock", { tag: ["@module:inventory"] }, () => {
  test("[INV-001] el inventario lista artículos con indicadores y la búsqueda filtra por SKU", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/inventory › Buscar");
    const item = await createInventoryItem(db, { name: uniq("Florero E2E") });
    const page = await rolePage("owner");
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { level: 1, name: "Inventario" })).toBeVisible();
    await expect(page.getByText("Valor de reposición")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "PLT-DIN-01" })).toBeVisible();
    await page.goto(`/admin/inventory?q=${item.sku}`);
    await expect(page.getByRole("searchbox", { name: "Buscar" })).toHaveValue(item.sku);
    await expect(page.getByRole("row").filter({ hasText: item.sku })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "PLT-DIN-01" })).toHaveCount(0);
    await page.goto("/admin/inventory?q=zzz-nada-e2e");
    await expect(page.getByText("Nada coincide con los filtros")).toBeVisible();
  });

  test("[INV-002] alta de artículo: SKU en mayúsculas, movimiento de alta y auditoría; aparece al recargar", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Inventario › Nuevo artículo");
    const sku = `e2e-${randomBytes(3).toString("hex")}`;
    const name = uniq("Copa coupé E2E");
    const page = await rolePage("owner");
    await page.goto("/admin/inventory");
    await (await ready(page.getByRole("button", { name: "Nuevo artículo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo artículo" });
    await dialog.getByLabel("SKU").fill(sku);
    await pickRadixOption(dialog, page, "Categoría", "Cristalería");
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByLabel("Unidad").fill("pz");
    await dialog.getByLabel("Cantidad inicial").fill("18");
    await dialog.getByLabel("Umbral bajo").fill("4");
    await dialog.getByRole("textbox", { name: /Costo de reposición/ }).fill("185.50");
    await dialog.getByLabel("Ubicación").fill("Bodega E2E · A1");
    await dialog.getByRole("button", { name: "Crear artículo" }).click();
    await expect(toast(page, "Artículo creado")).toBeVisible();
    const item = await db.inventoryItem.findFirstOrThrow({ where: { name } });
    expect(item).toMatchObject({ sku: sku.toUpperCase(), category: "GLASSWARE", totalQuantity: 18, lowStockThreshold: 4, replacementCostCents: 18_550, maintenanceQuantity: 0, active: true });
    const mv = await db.inventoryMovement.findMany({ where: { inventoryItemId: item.id } });
    expect(mv).toHaveLength(1);
    expect(mv[0]).toMatchObject({ type: "ADJUSTMENT", quantity: 18 });
    expect(await auditCount(db, "inventory.item_created", item.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: sku.toUpperCase() })).toBeVisible();
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("18 pz")).toBeVisible();
  });

  test("[INV-003] el SKU es único sin distinguir mayúsculas (no crea duplicado)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo artículo con SKU existente en minúsculas");
    const existing = await createInventoryItem(db);
    const before = await db.inventoryItem.count();
    const page = await rolePage("owner");
    await page.goto("/admin/inventory");
    await (await ready(page.getByRole("button", { name: "Nuevo artículo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo artículo" });
    await dialog.getByLabel("SKU").fill(existing.sku.toLowerCase());
    await dialog.getByLabel("Nombre").fill("Duplicado E2E");
    await dialog.getByRole("button", { name: "Crear artículo" }).click();
    await expect(dialog.getByText("Ya existe un artículo con este SKU. Usa uno diferente.")).toBeVisible();
    expect(await db.inventoryItem.count()).toBe(before);
  });

  test("[INV-004] el alta valida formato de SKU y nombre (front y back)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo artículo con SKU inválido y nombre vacío");
    const before = await db.inventoryItem.count();
    const page = await rolePage("owner");
    await page.goto("/admin/inventory");
    await (await ready(page.getByRole("button", { name: "Nuevo artículo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo artículo" });
    await dialog.getByLabel("SKU").fill("SKU CON ESPACIOS!");
    await dialog.getByRole("button", { name: "Crear artículo" }).click();
    await expect(dialog.getByText("Usa sólo letras, números, guion, punto o guion bajo.")).toBeVisible();
    await expect(dialog.getByText("Escribe el nombre del artículo.")).toBeVisible();
    expect(await db.inventoryItem.count()).toBe(before);
  });

  test("[INV-005] editar un artículo cambia sus datos sin tocar cantidades y audita sólo lo que cambió", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Detalle del artículo › Editar");
    const item = await createInventoryItem(db, { totalQuantity: 12 });
    const newName = uniq("Candelabro editado E2E");
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory/${item.id}`);
    await (await ready(page.getByRole("button", { name: "Editar" }))).click();
    const dialog = page.getByRole("dialog", { name: "Editar artículo" });
    await dialog.getByLabel("Nombre").fill(newName);
    await dialog.getByLabel("Ubicación").fill("Anaquel B2");
    await dialog.getByLabel("Umbral bajo").fill("5");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Artículo actualizado")).toBeVisible();
    await expect.poll(async () => (await db.inventoryItem.findUnique({ where: { id: item.id } }))?.name).toBe(newName);
    const saved = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(saved).toMatchObject({ location: "Anaquel B2", lowStockThreshold: 5, totalQuantity: 12 });
    const auditRow = await db.auditLog.findFirstOrThrow({ where: { action: "inventory.item_updated", entityId: item.id } });
    expect(Object.keys(auditRow.after as object).sort()).toEqual(["location", "lowStockThreshold", "name"]);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
  });

  test("[INV-006] un artículo inactivo se oculta del listado y no se puede reservar (backend)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Inventario › Incluir inactivos; replay de addReservation con artículo inactivo");
    const inactive = await createInventoryItem(db, { name: uniq("Inactivo E2E"), active: false });
    const active = await createInventoryItem(db, { name: uniq("Activo E2E") });
    const ev = await createEvent(db, { dateKey: dayKey(41) });
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory?q=${inactive.sku}`);
    await expect(page.getByText("Nada coincide con los filtros")).toBeVisible();
    await page.goto(`/admin/inventory?inactive=1&q=${inactive.sku}`);
    await expect(page.getByRole("switch", { name: "Incluir inactivos" })).toBeChecked();
    const row = page.getByRole("row").filter({ hasText: inactive.sku });
    await expect(row.getByText("Inactivo", { exact: true })).toBeVisible();

    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Agregar artículo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Agregar artículo" });
    await dialog.getByRole("combobox", { name: "Artículo" }).click();
    await expect(page.getByRole("option", { name: new RegExp(inactive.sku) })).toHaveCount(0);
    await page.getByRole("option", { name: new RegExp(active.sku) }).click();
    const captured = await captureServerAction(page, () => dialog.getByRole("button", { name: "Reservar" }).click());
    await expect(toast(page, "Artículo reservado")).toBeVisible();
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, active.id, inactive.id) });
    expect(actionError(res.text).code, res.text.slice(0, 200)).toBe("VALIDATION_ERROR");
    expect(await db.inventoryReservation.count({ where: { inventoryItemId: inactive.id } })).toBe(0);
  });

  test("[INV-007] entrada por compra suma al total, registra el movimiento y audita", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Detalle › Ajustar stock › Entrada por compra +5");
    const item = await createInventoryItem(db, { totalQuantity: 10 });
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory/${item.id}`);
    await (await ready(page.getByRole("button", { name: "Ajustar stock" }))).click();
    const dialog = page.getByRole("dialog", { name: "Ajustar stock" });
    await dialog.getByRole("radio", { name: /Entrada por compra/ }).click();
    await dialog.getByLabel(/Cantidad/).fill("5");
    await dialog.getByLabel("Motivo").fill("Compra de 5 piezas E2E");
    await expect(dialog.getByText(/Total 10 → 15/)).toBeVisible();
    // stock-adjust-dialog hace router.refresh(): recargar con ese fetch en vuelo aborta en Firefox (OPS-010)
    const refreshed = routerRefreshed(page, `/admin/inventory/${item.id}`);
    await dialog.getByRole("button", { name: "Registrar movimiento" }).click();
    await expect(toast(page, "Stock actualizado")).toBeVisible();
    await expect.poll(async () => (await db.inventoryItem.findUnique({ where: { id: item.id } }))?.totalQuantity).toBe(15);
    const mv = await db.inventoryMovement.findFirstOrThrow({ where: { inventoryItemId: item.id, type: "PURCHASE_IN" } });
    expect(mv).toMatchObject({ quantity: 5, reason: "Compra de 5 piezas E2E" });
    expect(mv.actorId).not.toBeNull();
    expect(await auditCount(db, "inventory.adjusted", item.id)).toBe(1);
    await refreshed;
    await page.reload();
    await expect(page.getByText("15 pz")).toBeVisible();
  });

  test("[INV-008] una baja mayor a lo utilizable se bloquea en la UI y en el backend (nunca negativo)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Ajustar stock › Pérdida 50 de 6 utilizables; replay con LOSS 999");
    const item = await createInventoryItem(db, { totalQuantity: 8, maintenanceQuantity: 2 });
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory/${item.id}`);
    await (await ready(page.getByRole("button", { name: "Ajustar stock" }))).click();
    const dialog = page.getByRole("dialog", { name: "Ajustar stock" });
    await dialog.getByRole("radio", { name: /Pérdida o rotura/ }).click();
    await dialog.getByLabel(/Cantidad/).fill("50");
    await dialog.getByLabel("Motivo").fill("Baja masiva E2E");
    await expect(dialog.getByText("Sólo hay 6 piezas fuera de mantenimiento; no puedes dar de baja 50.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Registrar movimiento" })).toBeDisabled();
    // Backend: captura una entrada válida (+1) y la repite como pérdida de 999
    await dialog.getByRole("radio", { name: /Entrada por compra/ }).click();
    await dialog.getByLabel(/Cantidad/).fill("1");
    const captured = await captureServerAction(page, () => dialog.getByRole("button", { name: "Registrar movimiento" }).click());
    await expect(toast(page, "Stock actualizado")).toBeVisible();
    const body = (captured.body ?? Buffer.from("")).toString("utf8").replace('"PURCHASE_IN"', '"LOSS"').replace('"quantity":1', '"quantity":999');
    const res = await replayServerAction(await apiAs("owner"), captured, { body });
    expect(actionError(res.text).code, res.text.slice(0, 200)).toBe("VALIDATION_ERROR");
    const after = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.totalQuantity, "sólo la entrada válida (+1) se aplicó").toBe(9);
    expect(after.totalQuantity).toBeGreaterThanOrEqual(after.maintenanceQuantity);
    expect(await db.inventoryMovement.count({ where: { inventoryItemId: item.id, type: "LOSS" } })).toBe(0);
  });

  test("[INV-009] mantenimiento (enviar y regresar) y ajuste por conteo restando mantienen 0 ≤ mant ≤ total", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Ajustar stock › Enviar a mantenimiento 3 → Regreso 1 → Ajuste −2");
    const item = await createInventoryItem(db, { totalQuantity: 10 });
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory/${item.id}`);
    const adjust = async (radio: RegExp, qty: string, reason: string, sentido?: "Sumar" | "Restar") => {
      await (await ready(page.getByRole("button", { name: "Ajustar stock" }))).click();
      const dialog = page.getByRole("dialog", { name: "Ajustar stock" });
      await dialog.getByRole("radio", { name: radio }).click();
      if (sentido) await dialog.getByRole("radio", { name: sentido }).click();
      await dialog.getByLabel(/Cantidad/).fill(qty);
      await dialog.getByLabel("Motivo").fill(reason);
      await dialog.getByRole("button", { name: "Registrar movimiento" }).click();
      await expect(toast(page, "Stock actualizado").last()).toBeVisible();
      await expect(dialog).toBeHidden();
    };
    await adjust(/Enviar a mantenimiento/, "3", "Revisión E2E");
    await expect.poll(async () => (await db.inventoryItem.findUnique({ where: { id: item.id } }))?.maintenanceQuantity).toBe(3);
    await adjust(/Regreso de mantenimiento/, "1", "Reparada E2E");
    await expect.poll(async () => (await db.inventoryItem.findUnique({ where: { id: item.id } }))?.maintenanceQuantity).toBe(2);
    await adjust(/Ajuste por conteo/, "2", "Conteo físico E2E", "Restar");
    await expect.poll(async () => (await db.inventoryItem.findUnique({ where: { id: item.id } }))?.totalQuantity).toBe(8);
    const final = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(final.maintenanceQuantity).toBe(2);
    const types = (await db.inventoryMovement.findMany({ where: { inventoryItemId: item.id }, orderBy: { createdAt: "asc" } })).map((m) => `${m.type}:${m.quantity}`);
    expect(types).toEqual(["MAINTENANCE_OUT:3", "MAINTENANCE_IN:1", "ADJUSTMENT:-2"]);
  });

  test("[INV-010] el indicador de stock bajo aparece al llegar al umbral y desaparece al reponer", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Artículo con utilizable = umbral → Entrada por compra");
    const item = await createInventoryItem(db, { totalQuantity: 3, lowStockThreshold: 3, name: uniq("Escaso E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/inventory?q=${item.sku}`);
    await expect(page.getByRole("row").filter({ hasText: item.sku }).getByText("Stock bajo")).toBeVisible();
    await page.goto(`/admin/inventory/${item.id}`);
    await expect(page.getByText("Stock bajo")).toBeVisible();
    await (await ready(page.getByRole("button", { name: "Ajustar stock" }))).click();
    const dialog = page.getByRole("dialog", { name: "Ajustar stock" });
    await dialog.getByLabel(/Cantidad/).fill("5");
    await dialog.getByLabel("Motivo").fill("Reposición E2E");
    await dialog.getByRole("button", { name: "Registrar movimiento" }).click();
    await expect(toast(page, "Stock actualizado")).toBeVisible();
    await expect(page.getByText("Stock bajo")).toHaveCount(0);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).totalQuantity).toBe(8);
  });

  test("[INV-025] los filtros del inventario (búsqueda y «Incluir inactivos») actualizan la URL y la lista sin recargar", { tag: ["@P1", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/inventory › escribir en Buscar y activar Incluir inactivos (navegación en el cliente)");
    test.info().annotations.push({ type: "regression", description: "BUG-006" });
    const item = await createInventoryItem(db, { name: uniq("Filtro UI E2E"), active: false });
    const page = await rolePage("owner");
    await page.goto("/admin/inventory");
    await (await ready(page.getByRole("searchbox", { name: "Buscar" }))).fill(item.sku);
    await expect(page, "la búsqueda con debounce debe navegar a ?q=").toHaveURL(new RegExp(`q=${item.sku}`));
    await expect(page.getByText("Nada coincide con los filtros")).toBeVisible();
    await page.getByRole("switch", { name: "Incluir inactivos" }).click();
    await expect(page).toHaveURL(/inactive=1/);
    await expect(page.getByRole("row").filter({ hasText: item.sku }).getByText("Inactivo", { exact: true })).toBeVisible();
  });

  test("[INV-023] un artículo inexistente muestra «no encontrado»", { tag: ["@P3", "@negative"] }, async ({ rolePage, evidence, guard }) => {
    evidence("owner", "/admin/inventory/<id inexistente>");
    guard.allow(/404/);
    const page = await rolePage("owner");
    await page.goto("/admin/inventory/ckzz000000000000inexistente");
    await expect(page.getByRole("heading", { name: "No encontramos este registro" })).toBeVisible();
  });
});

test.describe("Inventario · reservas por evento", { tag: ["@module:inventory"] }, () => {
  test("[INV-011] agregar un artículo a un evento crea la reserva y su movimiento", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas del evento › Agregar artículo");
    const item = await createInventoryItem(db, { totalQuantity: 10 });
    const ev = await createEvent(db, { dateKey: dayKey(42) });
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await expect(page.getByText("Este evento aún no tiene piezas reservadas")).toBeVisible();
    await (await ready(page.getByRole("button", { name: "Agregar artículo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Agregar artículo" });
    await pickRadixOption(dialog, page, "Artículo", new RegExp(item.sku));
    await dialog.getByLabel("Cantidad").fill("4");
    await dialog.getByRole("button", { name: "Reservar" }).click();
    await expect(toast(page, "Artículo reservado")).toBeVisible();
    const r = await db.inventoryReservation.findFirstOrThrow({ where: { eventId: ev.id, inventoryItemId: item.id } });
    expect(r).toMatchObject({ quantity: 4, status: "RESERVED" });
    expect(await db.inventoryMovement.count({ where: { eventId: ev.id, inventoryItemId: item.id, type: "RESERVE", quantity: 4 } })).toBe(1);
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: item.sku });
    await expect(row.getByText("Reservado")).toBeVisible();
    await expect(row.getByText("Cubierto")).toBeVisible();
  });

  test("[INV-024] no se puede reservar dos veces el mismo artículo en el evento", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Agregar artículo ya reservado");
    const item = await createInventoryItem(db);
    const ev = await createEvent(db, { dateKey: dayKey(43) });
    await createReservation(db, ev.id, item.id, 2);
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Agregar artículo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Agregar artículo" });
    await pickRadixOption(dialog, page, "Artículo", new RegExp(item.sku));
    await dialog.getByRole("button", { name: "Reservar" }).click();
    await expect(toast(page, "Este artículo ya tiene una reserva en el evento; edita su cantidad.")).toBeVisible();
    expect(await db.inventoryReservation.count({ where: { eventId: ev.id, inventoryItemId: item.id } })).toBe(1);
  });

  test("[INV-012] editar la cantidad reservada registra el delta y lo audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas › Editar cantidad 3 → 7");
    const item = await createInventoryItem(db, { totalQuantity: 10 });
    const ev = await createEvent(db, { dateKey: dayKey(44) });
    const r = await createReservation(db, ev.id, item.id, 3);
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Editar cantidad de ${item.name}` }))).click();
    const dialog = page.getByRole("dialog", { name: "Editar cantidad" });
    await dialog.getByLabel(/Cantidad/).fill("7");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(toast(page, "Cantidad actualizada")).toBeVisible();
    await expect.poll(async () => (await db.inventoryReservation.findUnique({ where: { id: r.id } }))?.quantity).toBe(7);
    expect(await db.inventoryMovement.count({ where: { eventId: ev.id, inventoryItemId: item.id, type: "RESERVE", quantity: 4 } })).toBe(1);
    expect(await auditCount(db, "inventory.reservation_updated", r.id)).toBe(1);
  });

  test("[INV-013] salida y regreso con piezas dañadas: reserva RETURNED, baja del total y auditoría de merma", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas › Entregar → Regreso (4 buenas + 1 dañada)");
    const item = await createInventoryItem(db, { totalQuantity: 10 });
    const ev = await createEvent(db, { dateKey: dayKey(45) });
    const r = await createReservation(db, ev.id, item.id, 5);
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Registrar salida de ${item.name}` }))).click();
    await expect(toast(page, "Salida registrada")).toBeVisible();
    await expect.poll(async () => (await db.inventoryReservation.findUnique({ where: { id: r.id } }))?.status).toBe("CHECKED_OUT");
    await page.getByRole("button", { name: `Registrar regreso de ${item.name}` }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar regreso" });
    await dialog.getByLabel("Dañadas o perdidas").fill("1");
    await expect(dialog.getByLabel("En buen estado")).toHaveValue("4");
    await dialog.getByLabel("Notas").fill("1 copa rota E2E");
    await dialog.getByRole("button", { name: "Registrar regreso" }).click();
    await expect(toast(page, "Regreso registrado")).toBeVisible();
    await expect.poll(async () => (await db.inventoryReservation.findUnique({ where: { id: r.id } }))?.status).toBe("RETURNED");
    expect(await db.inventoryReservation.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ returnedQuantity: 4, damagedQuantity: 1 });
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).totalQuantity).toBe(9);
    const types = (await db.inventoryMovement.findMany({ where: { eventId: ev.id, inventoryItemId: item.id } })).map((m) => `${m.type}:${m.quantity}`).sort();
    expect(types).toEqual(["CHECK_OUT:5", "LOSS:1", "RETURN:4"]);
    expect(await auditCount(db, "inventory.loss_recorded", item.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: item.sku }).getByText("1 dañadas/perdidas")).toBeVisible();
  });

  test("[INV-014] el regreso exige que buenas + dañadas sumen lo que salió", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Registrar regreso con suma incorrecta");
    const item = await createInventoryItem(db, { totalQuantity: 10 });
    const ev = await createEvent(db, { dateKey: dayKey(46) });
    const r = await createReservation(db, ev.id, item.id, 5, "CHECKED_OUT");
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Registrar regreso de ${item.name}` }))).click();
    const dialog = page.getByRole("dialog", { name: "Registrar regreso" });
    await dialog.getByLabel("En buen estado").fill("9");
    await dialog.getByLabel("Dañadas o perdidas").fill("9");
    await expect(dialog.getByText("Suma 18 de 5 piezas.")).toBeVisible();
    await dialog.getByRole("button", { name: "Registrar regreso" }).click();
    await expect(dialog.getByText(/deben sumar las 5 piezas que salieron/)).toBeVisible();
    expect((await db.inventoryReservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CHECKED_OUT");
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).totalQuantity).toBe(10);
  });

  test("[INV-015] liberar una reserva la cancela, registra RELEASE y la lista como liberada", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas › Liberar reserva");
    const item = await createInventoryItem(db);
    const ev = await createEvent(db, { dateKey: dayKey(47) });
    const r = await createReservation(db, ev.id, item.id, 3);
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Liberar reserva de ${item.name}` }))).click();
    await confirmAlert(page, "Liberar", { toast: "Reserva liberada" });
    await expect.poll(async () => (await db.inventoryReservation.findUnique({ where: { id: r.id } }))?.status).toBe("CANCELLED");
    expect(await db.inventoryMovement.count({ where: { eventId: ev.id, inventoryItemId: item.id, type: "RELEASE", quantity: 3 } })).toBe(1);
    expect(await auditCount(db, "inventory.reservation_cancelled", r.id)).toBe(1);
    await expect(page.getByText("Reservas liberadas (1)")).toBeVisible();
  });

  test("[INV-016] «Entregar todo» pasa todas las reservas pendientes a En evento", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas › Entregar todo (2)");
    const a = await createInventoryItem(db);
    const b = await createInventoryItem(db);
    const ev = await createEvent(db, { dateKey: dayKey(48) });
    await createReservation(db, ev.id, a.id, 2);
    await createReservation(db, ev.id, b.id, 1);
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Entregar todo (2)" }))).click();
    await confirmAlert(page, "Registrar salida", { toast: "Salida registrada para 2 artículos." });
    await expect.poll(() => db.inventoryReservation.count({ where: { eventId: ev.id, status: "CHECKED_OUT" } })).toBe(2);
    expect(await db.inventoryMovement.count({ where: { eventId: ev.id, type: "CHECK_OUT" } })).toBe(2);
  });

  test("[INV-017] un evento cancelado que aún aparta piezas se libera con «Liberar todo»", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas de evento CANCELLED › Liberar todo");
    const a = await createInventoryItem(db);
    const b = await createInventoryItem(db);
    const ev = await createEvent(db, { dateKey: dayKey(49), status: "CANCELLED" });
    await createReservation(db, ev.id, a.id, 2);
    await createReservation(db, ev.id, b.id, 2);
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await expect(page.getByRole("alert").filter({ hasText: "El evento está cancelado pero aún aparta piezas" })).toBeVisible();
    await (await ready(page.getByRole("button", { name: "Liberar todo (2)" }))).click();
    await confirmAlert(page, "Liberar todo", { toast: "Se liberaron 2 reservas." });
    await expect.poll(() => db.inventoryReservation.count({ where: { eventId: ev.id, status: "CANCELLED" } })).toBe(2);
    expect(await auditCount(db, "inventory.reservations_released", ev.id)).toBe(1);
  });

  test("[INV-018] recalcular desde requerimientos reserva por invitada y fijos según la experiencia", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Reservas › Recalcular desde requerimientos (experiencia propia: 1/invitada + 2 fijos)");
    const perGuest = await createInventoryItem(db, { totalQuantity: 20, name: uniq("Plato por invitada E2E") });
    const fixed = await createInventoryItem(db, { totalQuantity: 5, name: uniq("Pizarrón fijo E2E") });
    const exp = await createExperienceWithReqs(db, [
      { inventoryItemId: perGuest.id, quantity: 1, perGuest: true },
      { inventoryItemId: fixed.id, quantity: 2, perGuest: false },
    ]);
    const ev = await createEvent(db, { dateKey: dayKey(50), guestCount: 9, experienceId: exp.id });
    const page = await rolePage("owner");
    await page.goto(resUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Recalcular desde requerimientos" }).first())).click();
    await confirmAlert(page, "Recalcular", { toast: "Listo: 2 artículos reservados sin faltantes." });
    const rows = await db.inventoryReservation.findMany({ where: { eventId: ev.id } });
    const byItem = Object.fromEntries(rows.map((r) => [r.inventoryItemId, r]));
    expect(byItem[perGuest.id]).toMatchObject({ quantity: 9, status: "RESERVED" });
    expect(byItem[fixed.id]).toMatchObject({ quantity: 2, status: "RESERVED" });
    expect(await auditCount(db, "inventory.reservations_recalculated", ev.id)).toBe(1);
    // Idempotente: recalcular otra vez no crea movimientos nuevos
    const movements = await db.inventoryMovement.count({ where: { eventId: ev.id } });
    await page.reload();
    await (await ready(page.getByRole("button", { name: "Recalcular desde requerimientos" }).first())).click();
    await confirmAlert(page, "Recalcular", { toast: "Listo: 2 artículos reservados sin faltantes." });
    expect(await db.inventoryMovement.count({ where: { eventId: ev.id } })).toBe(movements);
  });

  test("[INV-019] un evento completado no se recalcula (botón oculto + backend CONFLICT)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Captura recalculate en evento activo → replay con id de evento COMPLETED");
    const item = await createInventoryItem(db);
    const exp = await createExperienceWithReqs(db, [{ inventoryItemId: item.id, quantity: 1, perGuest: false }]);
    const active = await createEvent(db, { dateKey: dayKey(51), experienceId: exp.id });
    const completed = await createEvent(db, { dateKey: dayKey(-5), status: "COMPLETED", experienceId: exp.id });
    const page = await rolePage("owner");
    await page.goto(resUrl(completed.id));
    await expect(page.getByRole("heading", { level: 1, name: completed.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recalcular desde requerimientos" })).toHaveCount(0);
    await page.goto(resUrl(active.id));
    await (await ready(page.getByRole("button", { name: "Recalcular desde requerimientos" }).first())).click();
    const captured = await captureServerAction(page, () => page.getByRole("alertdialog").getByRole("button", { name: "Recalcular" }).click());
    await expect(toast(page, /artículo reservado/)).toBeVisible();
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, active.id, completed.id) });
    expect(actionError(res.text).code, res.text.slice(0, 200)).toBe("CONFLICT");
    expect(await db.inventoryReservation.count({ where: { eventId: completed.id } })).toBe(0);
  });

  test("[INV-020] dos eventos el mismo día que sobre-reservan un artículo aparecen en Conflictos", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Conflictos de inventario (artículo propio: 5 utilizables, 3 + 3 reservados)");
    const item = await createInventoryItem(db, { totalQuantity: 5, name: uniq("Mesa escasa E2E") });
    const dk = dayKey(20 + (randomBytes(1)[0]! % 30));
    const e1 = await createEvent(db, { dateKey: dk, title: uniq("Conflicto A E2E") });
    const e2 = await createEvent(db, { dateKey: dk, title: uniq("Conflicto B E2E"), start: "17:00", end: "20:00" });
    await createReservation(db, e1.id, item.id, 3);
    await createReservation(db, e2.id, item.id, 3);
    const page = await rolePage("owner");
    await page.goto("/admin/inventory/conflicts");
    await expect(page.getByRole("heading", { level: 1, name: "Conflictos de inventario" })).toBeVisible();
    const entry = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: item.name }) }).last();
    await expect(entry.getByText("Requerido")).toBeVisible();
    await expect(entry.getByRole("definition").nth(0)).toHaveText("6");
    await expect(entry.getByRole("definition").nth(1)).toHaveText("5");
    await expect(entry.getByRole("definition").nth(2)).toHaveText("1");
    await expect(entry.getByRole("link", { name: e1.title })).toBeVisible();
    await expect(entry.getByRole("link", { name: e2.title })).toBeVisible();
    await page.goto(`/admin/inventory?q=${item.sku}`);
    await expect(page.getByRole("row").filter({ hasText: item.sku }).getByText(/Conflicto/)).toBeVisible();
    await page.goto(resUrl(e1.id));
    await expect(page.getByRole("alert").filter({ hasText: "No alcanza 1 artículo ese día" })).toBeVisible();
  });

  test("[INV-021] el rango de conflictos se elige entre 30, 60 y 90 días", { tag: ["@P3"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Conflictos › 30 / 60 / 90 días");
    const page = await rolePage("owner");
    await page.goto("/admin/inventory/conflicts");
    const nav = page.getByRole("navigation", { name: "Rango de días" });
    await expect(nav.getByRole("link", { name: "60 días" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "90 días" }).click();
    await expect(page).toHaveURL(/dias=90/);
    await expect(page.getByRole("navigation", { name: "Rango de días" }).getByRole("link", { name: "90 días" })).toHaveAttribute("aria-current", "page");
    await page.goto("/admin/inventory/conflicts?dias=999");
    await expect(page.getByRole("navigation", { name: "Rango de días" }).getByRole("link", { name: "60 días" })).toHaveAttribute("aria-current", "page");
  });

  test("[INV-022] «Reservas por evento» lista el evento próximo con su conteo y abre su detalle", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/inventory/events");
    const item = await createInventoryItem(db);
    const ev = await createEvent(db, { dateKey: dayKey(52), title: uniq("Reservas lista E2E") });
    await createReservation(db, ev.id, item.id, 2);
    const page = await rolePage("owner");
    await page.goto("/admin/inventory/events");
    const link = page.getByRole("link").filter({ hasText: ev.title });
    await expect(link.getByText("1 artículo reservado")).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${resUrl(ev.id)}$`));
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
  });
});
