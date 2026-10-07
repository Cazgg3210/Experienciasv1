/**
 * Compras: alta ligada a evento, ciclo de estados (purchaseStatusMachine), monto real auditado,
 * comprobante (upload), transiciones inválidas en backend y eventos cerrados (costos congelados).
 */
import { captureServerAction, expect, replayServerAction, test } from "../fixtures";
import {
  actionError,
  auditCount,
  blocked,
  confirmAlert,
  createEvent,
  createPurchase,
  createVendor,
  dayKey,
  FAKE_PNG,
  PNG_1PX,
  ready,
  routerRefreshed,
  storageAvailable,
  swapInBody,
  toast,
  uniq,
  userIdOf,
} from "../operations/_helpers";

const detail = (id: string) => `/admin/purchases/${id}`;

test.describe("Compras · alta y ciclo de vida", { tag: ["@module:purchases"] }, () => {
  test("[PUR-001] la lista de compras muestra totales y filtra por evento", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/purchases y /admin/purchases?event=<id>");
    const ev = await createEvent(db, { dateKey: dayKey(14), title: uniq("Compras evento E2E") });
    const p = await createPurchase(db, { eventId: ev.id, concept: uniq("Rosas E2E") });
    const page = await rolePage("owner");
    await page.goto("/admin/purchases");
    await expect(page.getByRole("heading", { level: 1, name: "Compras" })).toBeVisible();
    await expect(page.getByText("Real (recibidas)")).toBeVisible();
    await page.goto(`/admin/purchases?event=${ev.id}`);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(page.getByRole("link", { name: p.concept })).toBeVisible();
    const rows = await page.getByRole("table").getByRole("row").count();
    expect(rows, "sólo la compra del evento (+ encabezado)").toBe(2);
  });

  test("[PUR-002] registrar una compra para un evento guarda el monto en centavos y se audita", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/purchases/new?eventId=<id> › Registrar compra");
    const ev = await createEvent(db, { dateKey: dayKey(15) });
    const concept = uniq("Peonías blush E2E");
    const ownerId = await userIdOf(db, "owner");
    const page = await rolePage("owner");
    await page.goto(`/admin/purchases/new?eventId=${ev.id}`);
    const submit = page.getByRole("button", { name: "Registrar compra" });
    await expect(submit).toBeEnabled(); // se habilita al hidratar
    await expect(page.getByRole("combobox", { name: "Evento" })).toContainText(ev.title);
    await page.getByLabel("Concepto").fill(concept);
    await page.getByRole("textbox", { name: "Monto esperado" }).fill("1,234.50");
    await page.getByLabel("Necesario para").fill(dayKey(14));
    await page.getByLabel("Notas").fill("Entregar en bodega E2E");
    await submit.click();
    await expect(toast(page, "Compra registrada")).toBeVisible();
    await page.waitForURL(/\/admin\/purchases\/[a-z0-9]+$/);
    const p = await db.purchase.findFirstOrThrow({ where: { concept } });
    expect(p).toMatchObject({ eventId: ev.id, status: "REQUESTED", expectedAmountCents: 123_450, category: "VENDOR", createdById: ownerId, notes: "Entregar en bodega E2E" });
    expect(p.neededBy).not.toBeNull();
    expect(await auditCount(db, "purchase.created", p.id)).toBe(1);
    await expect(page.getByRole("heading", { level: 1, name: concept })).toBeVisible();
    await expect(page.getByText("$1,234.50").first()).toBeVisible();
    await expect(page.getByText("Compra registrada").last()).toBeVisible(); // historial auditado
  });

  test("[PUR-003] la compra exige concepto (3+) y monto esperado", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nueva compra vacía");
    const before = await db.purchase.count();
    const page = await rolePage("owner");
    await page.goto("/admin/purchases/new");
    await (await ready(page.getByLabel("Concepto"))).fill("ab");
    const submit = page.getByRole("button", { name: "Registrar compra" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText("Describe qué se compra (mín. 3 caracteres).")).toBeVisible();
    await expect(page.getByText(/El monto esperado/)).toBeVisible();
    expect(await db.purchase.count()).toBe(before);
  });

  test("[PUR-004] marcar como ordenada y volver a solicitada actualiza estado y fecha de orden", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Compra › Marcar como ordenada → Volver a solicitada");
    const p = await createPurchase(db, { concept: uniq("Mantel E2E") });
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await (await ready(page.getByRole("button", { name: "Marcar como ordenada" }))).click();
    await confirmAlert(page, "Marcar ordenada", { toast: "Compra ordenada" });
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.status).toBe("ORDERED");
    expect((await db.purchase.findUniqueOrThrow({ where: { id: p.id } })).orderedAt).not.toBeNull();
    await page.getByRole("button", { name: "Volver a solicitada" }).click();
    await confirmAlert(page, "Regresar", { toast: "Compra regresada a solicitada" });
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.status).toBe("REQUESTED");
    expect((await db.purchase.findUniqueOrThrow({ where: { id: p.id } })).orderedAt).toBeNull();
    expect(await auditCount(db, "purchase.status_changed", p.id)).toBe(2);
  });

  test("[PUR-005] recibir con monto real lo guarda en centavos y suma al costo real del evento", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Compra › Marcar como recibida ($1,450.75) → Finanzas del evento");
    const ev = await createEvent(db, { dateKey: dayKey(16) });
    const p = await createPurchase(db, { eventId: ev.id, concept: uniq("Pastel E2E"), category: "FOOD", expectedAmountCents: 120_000 });
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await (await ready(page.getByRole("button", { name: "Marcar como recibida" }))).click();
    const dialog = page.getByRole("dialog", { name: "Registrar recepción" });
    await dialog.getByRole("textbox", { name: "Monto real pagado" }).fill("1450.75");
    await expect(dialog.getByText(/\$250\.75 por encima de lo esperado/)).toBeVisible();
    const refreshed = routerRefreshed(page, detail(p.id));
    await dialog.getByRole("button", { name: "Confirmar recepción" }).click();
    await expect(toast(page, "Compra recibida")).toBeVisible();
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.status).toBe("RECEIVED");
    const r = await db.purchase.findUniqueOrThrow({ where: { id: p.id } });
    expect(r.actualAmountCents).toBe(145_075);
    expect(r.receivedAt).not.toBeNull();
    expect(r.orderedAt, "recibir directo desde solicitada fija también la fecha de orden").not.toBeNull();
    // Recibir llama router.refresh(): navegar con ese fetch RSC en vuelo hace que Firefox aborte el page.goto
    // (NS_BINDING_ABORTED, mismo caso que OPS-010). Se espera a que el refresh termine.
    await refreshed;
    await page.goto(`/admin/events/${ev.id}/financials`);
    await expect(page.getByText(p.concept)).toBeVisible();
    await expect(page.getByText("$1,450.75").first()).toBeVisible();
  });

  test("[PUR-006] cancelar con motivo lo deja en notas e historial; reabrir la regresa a solicitada", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Compra › Cancelar compra (motivo) → Reabrir compra");
    const p = await createPurchase(db, { concept: uniq("Carpa E2E"), notes: "Nota previa" });
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await (await ready(page.getByRole("button", { name: "Cancelar compra" }))).click();
    const dialog = page.getByRole("dialog", { name: "Cancelar compra" });
    await dialog.getByLabel("Motivo").fill("La terraza es techada E2E");
    await dialog.getByRole("button", { name: "Cancelar compra" }).click();
    await expect(toast(page, "Compra cancelada")).toBeVisible();
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.status).toBe("CANCELLED");
    const c = await db.purchase.findUniqueOrThrow({ where: { id: p.id } });
    expect(c.cancelledAt).not.toBeNull();
    expect(c.notes).toMatch(/^Nota previa\nCancelada \(.+\): La terraza es techada E2E$/);
    expect(await auditCount(db, "purchase.cancelled", p.id)).toBe(1);
    await expect(page.getByText(/motivo: La terraza es techada E2E/)).toBeVisible();
    await page.getByRole("button", { name: "Reabrir compra" }).click();
    await confirmAlert(page, "Reabrir", { toast: "Compra reabierta" });
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.status).toBe("REQUESTED");
    expect((await db.purchase.findUniqueOrThrow({ where: { id: p.id } })).cancelledAt).toBeNull();
  });

  test("[PUR-007] transiciones inválidas (recibida→ordenada, cancelada→recibida) se rechazan en el backend", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Replay de markPurchaseOrdered y receivePurchase con ids de compras RECEIVED / CANCELLED");
    const open1 = await createPurchase(db, { concept: uniq("Abierta 1 E2E") });
    const received = await createPurchase(db, { concept: uniq("Recibida E2E"), status: "RECEIVED", actualAmountCents: 100_000, receivedAt: new Date(), orderedAt: new Date() });
    const page = await rolePage("owner");
    await page.goto(detail(received.id));
    await expect(page.getByRole("button", { name: "Marcar como ordenada" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancelar compra" })).toHaveCount(0);
    await page.goto(detail(open1.id));
    await (await ready(page.getByRole("button", { name: "Marcar como ordenada" }))).click();
    const ordered = await captureServerAction(page, () => page.getByRole("alertdialog").getByRole("button", { name: "Marcar ordenada" }).click());
    await expect(toast(page, "Compra ordenada")).toBeVisible();
    const api = await apiAs("owner");
    const r1 = await replayServerAction(api, ordered, { body: swapInBody(ordered.body, open1.id, received.id) });
    expect(actionError(r1.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await db.purchase.findUniqueOrThrow({ where: { id: received.id } })).status).toBe("RECEIVED");

    const open2 = await createPurchase(db, { concept: uniq("Abierta 2 E2E") });
    const cancelledP = await createPurchase(db, { concept: uniq("Cancelada E2E"), status: "CANCELLED", cancelledAt: new Date() });
    await page.goto(detail(open2.id));
    await (await ready(page.getByRole("button", { name: "Marcar como recibida" }))).click();
    const receive = await captureServerAction(page, () => page.getByRole("dialog", { name: "Registrar recepción" }).getByRole("button", { name: "Confirmar recepción" }).click());
    await expect(toast(page, "Compra recibida")).toBeVisible();
    const r2 = await replayServerAction(api, receive, { body: swapInBody(receive.body, open2.id, cancelledP.id) });
    expect(actionError(r2.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    const still = await db.purchase.findUniqueOrThrow({ where: { id: cancelledP.id } });
    expect([still.status, still.actualAmountCents]).toEqual(["CANCELLED", null]);
  });

  test("[PUR-008] corregir el monto real de una compra recibida exige motivo y queda auditado", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Compra recibida › Corregir monto real");
    const p = await createPurchase(db, { concept: uniq("Insumos E2E"), status: "RECEIVED", actualAmountCents: 200_000, receivedAt: new Date(), orderedAt: new Date() });
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await (await ready(page.getByRole("button", { name: "Corregir monto real" }))).click();
    const dialog = page.getByRole("dialog", { name: "Corregir monto real" });
    await dialog.getByRole("textbox", { name: "Monto real" }).fill("2100");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Explica el motivo del cambio (mín. 3 caracteres).")).toBeVisible();
    await dialog.getByLabel("Motivo del cambio").fill("Llegó la factura final E2E");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(toast(page, "Monto real actualizado")).toBeVisible();
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.actualAmountCents).toBe(210_000);
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "purchase.amount_changed", entityId: p.id } });
    expect(a.before).toEqual({ actualAmountCents: 200_000 });
    expect(a.after).toEqual({ actualAmountCents: 210_000, reason: "Llegó la factura final E2E" });
    await expect(page.getByText(/nuevo real \$2,100/)).toBeVisible();
  });

  test("[PUR-009] corregir el monto real de una compra no recibida se rechaza en el backend", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Replay de updateActualAmount con id de compra REQUESTED");
    const received = await createPurchase(db, { concept: uniq("Recibida monto E2E"), status: "RECEIVED", actualAmountCents: 50_000, receivedAt: new Date() });
    const requested = await createPurchase(db, { concept: uniq("Solicitada monto E2E") });
    const page = await rolePage("owner");
    await page.goto(detail(received.id));
    await (await ready(page.getByRole("button", { name: "Corregir monto real" }))).click();
    const dialog = page.getByRole("dialog", { name: "Corregir monto real" });
    await dialog.getByRole("textbox", { name: "Monto real" }).fill("600");
    await dialog.getByLabel("Motivo del cambio").fill("Ajuste E2E");
    const captured = await captureServerAction(page, () => dialog.getByRole("button", { name: "Guardar" }).click());
    await expect(toast(page, "Monto real actualizado")).toBeVisible();
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, received.id, requested.id) });
    expect(actionError(res.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await db.purchase.findUniqueOrThrow({ where: { id: requested.id } })).actualAmountCents).toBeNull();
  });

  test("[PUR-010] adjuntar un comprobante (imagen) lo liga a la compra y se puede quitar", { tag: ["@P1"] }, async ({ rolePage, db, evidence, request }) => {
    evidence("owner", "Compra › Adjuntar ticket o factura → Quitar");
    if (!(await storageAvailable(request))) blocked(test, "S3 local (RustFS :9000) no responde");
    const ev = await createEvent(db, { dateKey: dayKey(17) });
    const p = await createPurchase(db, { eventId: ev.id, concept: uniq("Con ticket E2E") });
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await ready(page.getByRole("button", { name: "Marcar como ordenada" }));
    await page.getByLabel("Adjuntar ticket o factura").setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: PNG_1PX });
    await expect(toast(page, "Comprobante adjunto")).toBeVisible();
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.receiptMediaId).not.toBeNull();
    const withReceipt = await db.purchase.findUniqueOrThrow({ where: { id: p.id }, include: { receiptMedia: true } });
    expect(withReceipt.receiptMedia).toMatchObject({ purpose: "RECEIPT", eventId: ev.id, mimeType: "image/png" });
    expect(await auditCount(db, "purchase.receipt_attached", p.id)).toBe(1);
    await expect(page.getByRole("link", { name: "Ver imagen" })).toBeVisible();
    await page.getByRole("button", { name: "Quitar" }).click();
    await confirmAlert(page, "Quitar", { toast: "Comprobante quitado" });
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.receiptMediaId).toBeNull();
  });

  test("[PUR-011] un archivo que no es imagen ni PDF se rechaza como comprobante", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence, request, guard }) => {
    evidence("owner", "Compra › Adjuntar archivo de texto con extensión .png");
    if (!(await storageAvailable(request))) blocked(test, "S3 local (RustFS :9000) no responde");
    guard.allow(/status of 422/); // el navegador registra en consola el 422 esperado de /api/media/upload (archivo rechazado)
    const p = await createPurchase(db, { concept: uniq("Ticket falso E2E") });
    const before = await db.mediaAsset.count({ where: { purpose: "RECEIPT" } });
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await ready(page.getByRole("button", { name: "Marcar como ordenada" }));
    const upload = page.waitForResponse((r) => r.url().includes("/api/media/upload"));
    await page.getByLabel("Adjuntar ticket o factura").setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: FAKE_PNG });
    const res = await upload;
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    await expect(page.locator("[data-sonner-toast][data-type='error']").first()).toBeVisible();
    expect(await db.mediaAsset.count({ where: { purpose: "RECEIPT" } })).toBe(before);
    expect((await db.purchase.findUniqueOrThrow({ where: { id: p.id } })).receiptMediaId).toBeNull();
  });

  test("[PUR-012] en un evento cerrado no se puede recibir una compra (UI + backend)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Compra de evento cerrado; replay de receivePurchase");
    const closed = await createEvent(db, { dateKey: dayKey(-10), status: "COMPLETED", closedAt: new Date() });
    const open = await createEvent(db, { dateKey: dayKey(18) });
    const frozen = await createPurchase(db, { eventId: closed.id, concept: uniq("Congelada E2E") });
    const normal = await createPurchase(db, { eventId: open.id, concept: uniq("Normal E2E") });
    const page = await rolePage("owner");
    await page.goto(detail(frozen.id));
    await expect(page.getByText("El evento ya está cerrado: sus costos quedaron congelados")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como recibida" })).toHaveCount(0);
    await page.goto(detail(normal.id));
    await (await ready(page.getByRole("button", { name: "Marcar como recibida" }))).click();
    const captured = await captureServerAction(page, () => page.getByRole("dialog", { name: "Registrar recepción" }).getByRole("button", { name: "Confirmar recepción" }).click());
    await expect(toast(page, "Compra recibida")).toBeVisible();
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, normal.id, frozen.id) });
    expect(actionError(res.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await db.purchase.findUniqueOrThrow({ where: { id: frozen.id } })).status).toBe("REQUESTED");
  });

  test("[PUR-013] editar los detalles de una compra persiste y aparece en el historial", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Compra › Detalles › Guardar cambios");
    const p = await createPurchase(db, { concept: uniq("Editable E2E") });
    const newConcept = uniq("Concepto editado E2E");
    const page = await rolePage("owner");
    await page.goto(detail(p.id));
    await (await ready(page.getByLabel("Concepto"))).fill(newConcept);
    await page.getByLabel("Notas").fill("Nota editada E2E");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Compra actualizada")).toBeVisible();
    await expect.poll(async () => (await db.purchase.findUnique({ where: { id: p.id } }))?.concept).toBe(newConcept);
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "purchase.updated", entityId: p.id } });
    expect(Object.keys(a.after as object).sort()).toEqual(["concept", "notes"]);
    await page.reload();
    await expect(page.getByText(/Cambió: (concepto, notas|notas, concepto)/)).toBeVisible(); // el orden de llaves lo decide jsonb
  });

  test("[PUR-014] un proveedor bloqueado no se ofrece ni se acepta en el backend al registrar compras", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Nueva compra: combo de proveedores + replay con vendorId bloqueado");
    const blockedVendor = await createVendor(db, { name: uniq("Bloqueado E2E"), status: "BLOCKED" });
    const page = await rolePage("owner");
    await page.goto("/admin/purchases/new");
    await (await ready(page.getByRole("combobox", { name: "Proveedor" }))).click();
    await expect(page.getByRole("option", { name: new RegExp(blockedVendor.name) })).toHaveCount(0);
    await page.keyboard.press("Escape");
    const concept = uniq("Sin proveedor E2E");
    await page.getByLabel("Concepto").fill(concept);
    await page.getByRole("textbox", { name: "Monto esperado" }).fill("300");
    const captured = await captureServerAction(page, () => page.getByRole("button", { name: "Registrar compra" }).click());
    await expect(toast(page, "Compra registrada")).toBeVisible();
    const body = (captured.body ?? Buffer.from("")).toString("utf8").replace('"vendorId":null', `"vendorId":"${blockedVendor.id}"`);
    expect(body).toContain(blockedVendor.id);
    const res = await replayServerAction(await apiAs("owner"), captured, { body });
    expect(actionError(res.text)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(await db.purchase.count({ where: { vendorId: blockedVendor.id } })).toBe(0);
  });
});
