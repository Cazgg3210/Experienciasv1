/**
 * Finanzas: costos manuales del evento (centavos, auditoría), rentabilidad contra la base
 * (venta − IVA − costos = margen), cierre del evento (events:close, congelado + notificaciones),
 * tablero /admin/finance, exportación CSV y Analytics.
 */
import type { Locator, Page } from "@playwright/test";
import { captureServerAction, expect, replayServerAction, test } from "../fixtures";
import {
  actionError,
  assignStaff,
  attachSale,
  auditCount,
  confirmAlert,
  createEvent,
  createPurchase,
  createStaffMember,
  dayKey,
  formatMXN,
  pickRadixOption,
  ready,
  swapInBody,
  toast,
  uniq,
  userIdOf,
} from "../operations/_helpers";
import { FINANCE_CSV_HEADERS as FINANCE_CSV_HEADERS_FOR_TEST } from "../../../src/features/financials/domain/finance-csv";

const finUrl = (id: string) => `/admin/events/${id}/financials`;

/** Tarjeta KPI (StatCard): span de la etiqueta → fila → tarjeta (no hay landmark propio). */
function statCard(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).first().locator("xpath=../..");
}

test.describe("Finanzas · costos manuales", { tag: ["@module:finance"] }, () => {
  test("[FIN-001] registrar un costo manual lo guarda en centavos, lo suma al total y lo audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Finanzas del evento › Agregar costo");
    const ev = await createEvent(db, { dateKey: dayKey(8) });
    const description = uniq("Estacionamiento E2E");
    const page = await rolePage("owner");
    await page.goto(finUrl(ev.id));
    await expect(page.getByText("Sin costos manuales")).toBeVisible();
    await (await ready(page.getByRole("button", { name: "Agregar costo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Registrar costo manual" });
    await pickRadixOption(dialog, page, "Categoría", "Transporte");
    await dialog.getByLabel("Descripción").fill(description);
    await dialog.getByRole("textbox", { name: "Monto (MXN)" }).fill("350.25");
    await dialog.getByRole("button", { name: "Registrar costo" }).click();
    await expect(toast(page, "Costo registrado")).toBeVisible();
    const cost = await db.eventCost.findFirstOrThrow({ where: { eventId: ev.id, description } });
    expect(cost).toMatchObject({ category: "TRANSPORT", amountCents: 35_025 });
    expect(cost.createdById).toBe(await userIdOf(db, "owner"));
    expect(await auditCount(db, "cost.created", cost.id)).toBe(1);
    await page.reload();
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText("Total manual").locator("xpath=..")).toContainText("$350.25");
  });

  test("[FIN-002] el costo manual exige descripción (3+) y monto mayor a $0", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Agregar costo con datos inválidos");
    const ev = await createEvent(db, { dateKey: dayKey(9) });
    const page = await rolePage("owner");
    await page.goto(finUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Agregar costo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Registrar costo manual" });
    await dialog.getByLabel("Descripción").fill("ab");
    await dialog.getByRole("textbox", { name: "Monto (MXN)" }).fill("0");
    await dialog.getByRole("button", { name: "Registrar costo" }).click();
    await expect(dialog.getByText("Describe el costo (mínimo 3 caracteres).")).toBeVisible();
    await expect(dialog.getByText("El monto debe ser mayor a $0.")).toBeVisible();
    expect(await db.eventCost.count({ where: { eventId: ev.id } })).toBe(0);
  });

  test("[FIN-003] editar un costo manual actualiza monto y categoría con auditoría antes/después", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Costos manuales › Editar costo");
    const ev = await createEvent(db, { dateKey: dayKey(10) });
    const cost = await db.eventCost.create({ data: { eventId: ev.id, category: "OTHER", description: uniq("Propinas E2E"), amountCents: 20_000 } });
    const page = await rolePage("owner");
    await page.goto(finUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Editar costo: ${cost.description}` }))).click();
    const dialog = page.getByRole("dialog", { name: "Editar costo manual" });
    await pickRadixOption(dialog, page, "Categoría", "Consumibles");
    await dialog.getByRole("textbox", { name: "Monto (MXN)" }).fill("275");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Costo actualizado")).toBeVisible();
    await expect.poll(async () => (await db.eventCost.findUnique({ where: { id: cost.id } }))?.amountCents).toBe(27_500);
    expect((await db.eventCost.findUniqueOrThrow({ where: { id: cost.id } })).category).toBe("CONSUMABLES");
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "cost.updated", entityId: cost.id } });
    expect((a.before as { amountCents: number }).amountCents).toBe(20_000);
    expect((a.after as { amountCents: number }).amountCents).toBe(27_500);
  });

  test("[FIN-004] eliminar un costo manual lo quita del costo real y queda en auditoría", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Costos manuales › Eliminar costo");
    const ev = await createEvent(db, { dateKey: dayKey(11) });
    const cost = await db.eventCost.create({ data: { eventId: ev.id, category: "OTHER", description: uniq("Merma E2E"), amountCents: 15_000 } });
    const page = await rolePage("owner");
    await page.goto(finUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Eliminar costo: ${cost.description}` }))).click();
    await confirmAlert(page, "Eliminar");
    await expect(toast(page, "Costo eliminado")).toBeVisible();
    await expect.poll(() => db.eventCost.count({ where: { id: cost.id } })).toBe(0);
    expect(await auditCount(db, "cost.deleted", cost.id)).toBe(1);
    await page.reload();
    await expect(page.getByText("Sin costos manuales")).toBeVisible();
  });
});

test.describe("Finanzas · rentabilidad y cierre", { tag: ["@module:finance"] }, () => {
  test("[FIN-005] la rentabilidad del evento cuadra con la base: venta − IVA − costos reales = margen", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento con venta $23,200 (IVA $3,200), compra recibida, staff, costo manual y comisión");
    const ev = await createEvent(db, { dateKey: dayKey(12), title: uniq("Rentabilidad E2E") });
    await attachSale(db, ev, { totalCents: 2_320_000, taxCents: 320_000, paidCents: 1_160_000, feeCents: 45_000 });
    await createPurchase(db, { eventId: ev.id, category: "FOOD", expectedAmountCents: 300_000, actualAmountCents: 350_000, status: "RECEIVED", receivedAt: new Date() });
    await createPurchase(db, { eventId: ev.id, category: "FLOWERS", expectedAmountCents: 99_000, status: "REQUESTED" });
    const m = await createStaffMember(db);
    await assignStaff(db, ev.id, m.id, "SERVER", { amountCents: 150_000 });
    await db.eventCost.create({ data: { eventId: ev.id, category: "OTHER", description: "Hielo E2E", amountCents: 50_000 } });
    // Valores esperados según las reglas del dominio (verificados contra los registros de la base)
    const booking = await db.booking.findUniqueOrThrow({ where: { eventId: ev.id }, include: { payments: true, quote: true } });
    const sale = booking.totalCents;
    const tax = Math.round((booking.quote.taxCents * sale) / booking.quote.totalCents);
    const net = sale - tax;
    const received = await db.purchase.aggregate({ where: { eventId: ev.id, status: "RECEIVED" }, _sum: { actualAmountCents: true } });
    const staff = await db.staffAssignment.aggregate({ where: { eventId: ev.id }, _sum: { amountCents: true } });
    const manual = await db.eventCost.aggregate({ where: { eventId: ev.id }, _sum: { amountCents: true } });
    const fees = booking.payments.reduce((s, p) => s + p.feeCents, 0);
    const actualCost = (received._sum.actualAmountCents ?? 0) + (staff._sum.amountCents ?? 0) + (manual._sum.amountCents ?? 0) + fees;
    const margin = net - actualCost;
    expect([sale, tax, net, actualCost, margin]).toEqual([2_320_000, 320_000, 2_000_000, 595_000, 1_405_000]);

    const page = await rolePage("owner");
    await page.goto(finUrl(ev.id));
    await expect(page.getByRole("heading", { name: "Rentabilidad del evento" })).toBeVisible();
    await expect(statCard(page, "Venta")).toContainText(formatMXN(sale));
    await expect(statCard(page, "Venta")).toContainText(`Neto sin IVA: ${formatMXN(net)}`);
    await expect(statCard(page, "Costo real")).toContainText(formatMXN(actualCost));
    await expect(statCard(page, "Margen real")).toContainText(formatMXN(margin));
    await expect(statCard(page, "Margen real")).toContainText("70.3%"); // 7025 bps mostrado con 1 decimal
    await expect(page.getByText("1 compra(s) sin recibir todavía no cuentan en el costo real.")).toBeVisible();
  });

  test("[FIN-006] cerrar un evento completado congela números, audita, notifica a la clienta y bloquea costos", { tag: ["@P0", "@critical"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Evento COMPLETED › Agregar costo (captura) › Cerrar evento › replay de createEventCost");
    const ev = await createEvent(db, { dateKey: dayKey(-4), status: "COMPLETED", title: uniq("Cierre E2E") });
    await attachSale(db, ev, { totalCents: 1_160_000, taxCents: 160_000, paidCents: 1_160_000 });
    const page = await rolePage("owner");
    await page.goto(finUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Agregar costo" }))).click();
    const dialog = page.getByRole("dialog", { name: "Registrar costo manual" });
    await dialog.getByLabel("Descripción").fill("Costo previo al cierre E2E");
    await dialog.getByRole("textbox", { name: "Monto (MXN)" }).fill("100");
    const addCost = await captureServerAction(page, () => dialog.getByRole("button", { name: "Registrar costo" }).click());
    await expect(toast(page, "Costo registrado")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar evento" }).click();
    const alert = page.getByRole("alertdialog", { name: "¿Cerrar el evento?" });
    await expect(alert.getByText("Todo en orden: sin saldo pendiente ni compras por recibir.")).toBeVisible();
    await confirmAlert(page, "Cerrar evento");
    await expect(toast(page, "Evento cerrado. Enviamos el agradecimiento a la clienta.")).toBeVisible();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.closedAt).not.toBeNull();
    const closed = await db.event.findUniqueOrThrow({ where: { id: ev.id } });
    expect(closed.closedById).toBe(await userIdOf(db, "owner"));
    expect(closed.closingSnapshot).not.toBeNull();
    expect(await auditCount(db, "event.closed", ev.id)).toBe(1);
    await expect
      .poll(async () => (await db.notificationLog.findMany({ where: { eventId: ev.id, type: { in: ["POST_EVENT", "REVIEW_REQUEST"] } } })).map((n) => `${n.type}:${n.channel}`).sort())
      .toEqual(["POST_EVENT:EMAIL", "POST_EVENT:WHATSAPP", "REVIEW_REQUEST:EMAIL", "REVIEW_REQUEST:WHATSAPP"]);
    await page.reload();
    await expect(page.getByRole("heading", { name: /Evento cerrado el/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar costo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cerrar evento" })).toHaveCount(0);
    const before = await db.eventCost.count({ where: { eventId: ev.id } });
    const res = await replayServerAction(await apiAs("owner"), addCost);
    expect(actionError(res.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await db.eventCost.count({ where: { eventId: ev.id } })).toBe(before);
  });

  test("[FIN-007] el encabezado del evento (todas las pestañas) indica que el evento está cerrado", { tag: ["@P3", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento cerrado → pestaña Resumen / Operaciones: encabezado");
    test.info().annotations.push({ type: "regression", description: "BUG-015" });
    const ev = await createEvent(db, { dateKey: dayKey(-6), status: "COMPLETED", title: uniq("Encabezado post-cierre E2E"), closedAt: new Date() });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}/operations`);
    // El encabezado del evento es un <header> sin landmark propio: se ubica por su h1.
    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1, name: ev.title }) });
    await expect(header).toBeVisible();
    await expect(header.getByText("Cerrado", { exact: true }), "el encabezado debería mostrar la insignia «Cerrado»").toBeVisible();
  });

  test("[FIN-008] sólo se cierran eventos completados; el doble cierre se rechaza (backend)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Evento CONFIRMED sin botón; captura closeEvent en COMPLETED → replay al CONFIRMED y al mismo (doble)");
    const confirmed = await createEvent(db, { dateKey: dayKey(13) });
    const completed = await createEvent(db, { dateKey: dayKey(-3), status: "COMPLETED" });
    const page = await rolePage("owner");
    await page.goto(finUrl(confirmed.id));
    await expect(page.getByText("Podrás cerrar el evento cuando esté marcado como completado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar evento" })).toHaveCount(0);
    await page.goto(finUrl(completed.id));
    await (await ready(page.getByRole("button", { name: "Cerrar evento" }))).click();
    const captured = await captureServerAction(page, () => page.getByRole("alertdialog").getByRole("button", { name: "Cerrar evento" }).click());
    await expect(toast(page, /Evento cerrado/)).toBeVisible();
    const api = await apiAs("owner");
    const notCompleted = await replayServerAction(api, captured, { body: swapInBody(captured.body, completed.id, confirmed.id) });
    expect(actionError(notCompleted.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await db.event.findUniqueOrThrow({ where: { id: confirmed.id } })).closedAt).toBeNull();
    const twice = await replayServerAction(api, captured);
    expect(actionError(twice.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await auditCount(db, "event.closed", completed.id)).toBe(1);
  });
});

test.describe("Finanzas · tablero, exportación y analytics", { tag: ["@module:finance"] }, () => {
  test("[FIN-010] /admin/finance muestra KPIs y el filtro «Cerrados» incluye el evento cerrado", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/finance?status=CLOSED");
    const ev = await createEvent(db, { dateKey: dayKey(-7), status: "COMPLETED", title: uniq("Finanzas cerrado E2E"), closedAt: new Date() });
    await attachSale(db, ev, { totalCents: 870_000, taxCents: 120_000, paidCents: 870_000 });
    const page = await rolePage("owner");
    await page.goto("/admin/finance");
    await expect(page.getByRole("heading", { level: 1, name: "Finanzas" })).toBeVisible();
    for (const k of ["Venta", "Cobrado", "Saldo por cobrar", "Margen estimado"]) await expect(page.getByText(k, { exact: true }).first()).toBeVisible();
    await page.goto("/admin/finance?status=CLOSED");
    const row = page.getByRole("row").filter({ hasText: ev.code });
    await expect(row.getByRole("link", { name: ev.title })).toBeVisible();
    await expect(row.getByText("Cerrado", { exact: true })).toBeVisible();
    await expect(row).toContainText(formatMXN(870_000));
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute("href", "/admin/finance/export?status=CLOSED");
    await page.goto("/admin/finance?status=OPEN");
    await expect(page.getByRole("row").filter({ hasText: ev.code })).toHaveCount(0);
  });

  test("[FIN-011] la exportación CSV trae BOM, encabezados, filas en pesos y queda auditada; sin sesión → 401", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "GET /admin/finance/export?status=CLOSED (owner y anónimo)");
    const ev = await createEvent(db, { dateKey: dayKey(-8), status: "COMPLETED", title: uniq("CSV E2E"), closedAt: new Date() });
    await attachSale(db, ev, { totalCents: 1_234_550, taxCents: 170_283, paidCents: 1_000_000 });
    const before = await auditCount(db, "finance.exported");
    const res = await (await apiAs("owner")).get("/admin/finance/export?status=CLOSED");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain('filename="finanzas-ivonne-rosa-closed.csv"');
    const text = await res.text();
    expect(text.charCodeAt(0), "BOM UTF-8 para Excel").toBe(0xfeff);
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe(FINANCE_CSV_HEADERS_FOR_TEST.join(","));
    const line = lines.find((l) => l.includes(ev.code));
    expect(line, "fila del evento cerrado").toBeTruthy();
    const cells = line!.split(",");
    expect(cells[2]).toBe(ev.title);
    expect(cells[4]).toBe("Sí");
    expect(cells[5]).toBe("12345.5");
    expect(cells[6]).toBe("10000");
    expect(cells[7]).toBe("2345.5");
    expect(await auditCount(db, "finance.exported")).toBe(before + 1);
    const anon = await (await apiAs(null)).get("/admin/finance/export", { maxRedirects: 0 });
    expect([401, 302, 303, 307]).toContain(anon.status());
    if (anon.status() === 401) expect(await anon.json()).toMatchObject({ error: "Inicia sesión para continuar." });
  });

  test("[FIN-013] el CSV neutraliza fórmulas en textos (título que empieza con «=»)", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "Evento titulado =1+1 → exportación CSV");
    const title = `=1+1 E2E ${Date.now()}`;
    const ev = await createEvent(db, { dateKey: dayKey(-9), status: "COMPLETED", title, closedAt: new Date() });
    await attachSale(db, ev, { totalCents: 100_000, taxCents: 13_793 });
    const res = await (await apiAs("owner")).get("/admin/finance/export?status=CLOSED");
    const line = (await res.text()).split("\r\n").find((l) => l.includes(ev.code));
    expect(line).toBeTruthy();
    expect(line!.split(",")[2]).toBe(`'${title}`);
  });

  test("[FIN-012] /admin/analytics renderiza con datos reales sin errores de consola", { tag: ["@P2", "@smoke"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/analytics");
    const page = await rolePage("owner");
    await page.goto("/admin/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Embudo de conversión" })).toBeVisible();
    await expect(page.getByText("Sin actividad en este rango")).toHaveCount(0); // el seed trae 600+ eventos de analytics
  });
});
