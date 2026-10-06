/**
 * Proveedores: listado y búsqueda, alta con validaciones, edición de estado (bloqueado), eliminación
 * permitida sólo sin compras (UI + backend).
 */
import { captureServerAction, expect, replayServerAction, test } from "../fixtures";
import {
  actionError,
  auditCount,
  confirmAlert,
  createPurchase,
  createVendor,
  pickRadixOption,
  ready,
  swapInBody,
  toast,
  uniq,
  uniqEmail,
} from "../operations/_helpers";

test.describe("Proveedores", { tag: ["@module:vendors"] }, () => {
  test("[PUR-020] la lista de proveedores muestra los del seed y filtra por búsqueda", { tag: ["@P1", "@smoke"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/vendors y ?q=");
    const page = await rolePage("owner");
    await page.goto("/admin/vendors");
    await expect(page.getByRole("heading", { level: 1, name: "Proveedores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Flores La Merced Rivera" }).first()).toBeVisible();
    await page.goto("/admin/vendors?q=Pasteler%C3%ADa");
    await expect(page.getByRole("link", { name: "Pastelería Dulce Alondra" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Flores La Merced Rivera" })).toHaveCount(0);
    await page.goto("/admin/vendors?q=zzz-nadie-e2e");
    await expect(page.getByText("Ningún proveedor coincide")).toBeVisible();
  });

  test("[PUR-021] alta de proveedor con contacto y calificación persiste y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/vendors/new › Crear proveedor");
    const name = uniq("Florería E2E");
    const email = uniqEmail("prov");
    const page = await rolePage("owner");
    await page.goto("/admin/vendors/new");
    const submit = page.getByRole("button", { name: "Crear proveedor" });
    await expect(submit).toBeEnabled(); // se habilita al hidratar
    await page.getByLabel("Nombre").fill(name);
    await pickRadixOption(page, page, "Categoría", "Repostería");
    await page.getByRole("radio", { name: "4 de 5" }).click();
    await page.getByLabel("Persona de contacto").fill("Ana Contacto");
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByLabel("Teléfono").fill("55 1234 5678");
    await page.getByLabel("WhatsApp").fill("5512345678");
    await page.getByLabel("SLA / condiciones").fill("Pedidos con 72 h E2E");
    await submit.click();
    await expect(toast(page, "Proveedor creado")).toBeVisible();
    await page.waitForURL(/\/admin\/vendors\/[a-z0-9]+$/);
    const v = await db.vendor.findFirstOrThrow({ where: { name } });
    expect(v).toMatchObject({ category: "PASTRY", status: "ACTIVE", rating: 4, email, whatsapp: "5512345678", slaNotes: "Pedidos con 72 h E2E" });
    expect(await auditCount(db, "vendor.created", v.id)).toBe(1);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute("href", /wa\.me\/(52)?5512345678/);
  });

  test("[PUR-022] el alta valida correo, teléfono y WhatsApp (sin crear registro)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/vendors/new con datos inválidos");
    const before = await db.vendor.count();
    const page = await rolePage("owner");
    await page.goto("/admin/vendors/new");
    const submit = page.getByRole("button", { name: "Crear proveedor" });
    await expect(submit).toBeEnabled(); // se habilita al hidratar
    await page.getByLabel("Nombre").fill("Proveedor inválido E2E");
    await page.getByLabel("Email").fill("correo-malo");
    await page.getByLabel("Teléfono").fill("abc");
    await page.getByLabel("WhatsApp").fill("551234567");
    await submit.click();
    await expect(page.getByText("Escribe un correo válido.")).toBeVisible();
    await expect(page.getByText("Escribe un teléfono válido (sólo números, espacios, +, guiones).")).toBeVisible();
    await expect(page.getByText("Escribe el WhatsApp a 10 dígitos (o con lada internacional).")).toBeVisible();
    expect(await db.vendor.count()).toBe(before);
  });

  test("[PUR-023] bloquear un proveedor queda auditado y oculta «Nueva compra»", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/vendors/<id>/edit › Estado = Bloqueado");
    const v = await createVendor(db, { name: uniq("A bloquear E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/vendors/${v.id}`);
    await expect(page.getByRole("link", { name: "Nueva compra" })).toBeVisible();
    await page.getByRole("link", { name: "Editar" }).click();
    await page.waitForURL(`**/admin/vendors/${v.id}/edit`);
    const submit = page.getByRole("button", { name: "Guardar cambios" });
    await expect(submit).toBeEnabled(); // se habilita al hidratar
    await pickRadixOption(page, page, "Estado", "Bloqueado");
    await submit.click();
    await expect(toast(page, "Proveedor actualizado")).toBeVisible();
    await page.waitForURL(`**/admin/vendors/${v.id}`);
    expect((await db.vendor.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("BLOCKED");
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "vendor.status_changed", entityId: v.id } });
    expect(a.after).toEqual({ status: "BLOCKED" });
    await expect(page.getByText("Bloqueado").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva compra" })).toHaveCount(0);
  });

  test("[PUR-024] eliminar un proveedor sin compras lo borra y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Detalle de proveedor › Eliminar");
    const v = await createVendor(db, { name: uniq("Borrable prov E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/vendors/${v.id}`);
    await (await ready(page.getByRole("button", { name: "Eliminar" }))).click();
    await confirmAlert(page, "Eliminar proveedor");
    await expect(toast(page, "Proveedor eliminado")).toBeVisible();
    await page.waitForURL(/\/admin\/vendors$/);
    expect(await db.vendor.count({ where: { id: v.id } })).toBe(0);
    expect(await auditCount(db, "vendor.deleted", v.id)).toBe(1);
  });

  test("[PUR-025] un proveedor con compras no se puede borrar (botón deshabilitado + backend CONFLICT)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Proveedor con compras; replay de deleteVendor");
    const withPurchases = await createVendor(db, { name: uniq("Con compras E2E") });
    await createPurchase(db, { vendorId: withPurchases.id });
    const disposable = await createVendor(db, { name: uniq("Desechable prov E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/vendors/${withPurchases.id}`);
    await expect(page.getByRole("button", { name: "Eliminar" })).toBeDisabled();
    await page.goto(`/admin/vendors/${disposable.id}`);
    await (await ready(page.getByRole("button", { name: "Eliminar" }))).click();
    const captured = await captureServerAction(page, () => page.getByRole("alertdialog").getByRole("button", { name: "Eliminar proveedor" }).click());
    await page.waitForURL(/\/admin\/vendors$/);
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, disposable.id, withPurchases.id) });
    expect(actionError(res.text)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await db.vendor.count({ where: { id: withPurchases.id } })).toBe(1);
    expect(await auditCount(db, "vendor.deleted", withPurchases.id)).toBe(0);
  });
});
