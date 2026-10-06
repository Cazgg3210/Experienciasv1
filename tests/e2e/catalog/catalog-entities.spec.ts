/**
 * Paquete 3 · Catálogo — menús y platillos, add-ons, estilos, zonas de servicio, rangos de presupuesto
 * y navegación por secciones. Cada prueba usa entidades propias (slugs/etiquetas únicas).
 */
import { ACCOUNTS, createLead, expect, test, uniq } from "../fixtures";
import { callAction, createQuoteViaAction, gotoReady, waitForDetail } from "../quotes/_helpers";
import { createCustomer } from "../fixtures";
import {
  addOnPayload,
  areaPayload,
  budgetPayload,
  createExperienceViaAction,
  createVia,
  menuPayload,
  stylePayload,
  uniqSlug,
} from "./_helpers";

async function pickOption(page: import("@playwright/test").Page, scope: import("@playwright/test").Locator, label: string, option: string) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("Catálogo · navegación", { tag: ["@module:catalog"] }, () => {
  test("[CAT-034] las pestañas del catálogo cargan cada sección y marcan la activa", { tag: ["@P3", "@smoke"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Catálogo › pestañas");
    const page = await rolePage("owner");
    const tabs: Array<[string, string, string]> = [
      ["Menús", "/admin/catalog/menus", "Menús"],
      ["Add-ons", "/admin/catalog/addons", "Add-ons"],
      ["Estilos", "/admin/catalog/styles", "Estilos"],
      ["Zonas", "/admin/catalog/areas", "Zonas de servicio"],
      ["Presupuestos", "/admin/catalog/budgets", "Rangos de presupuesto"],
      ["Experiencias", "/admin/catalog", "Experiencias"],
    ];
    for (const [tab, url, heading] of tabs) {
      await gotoReady(page, url);
      const nav = page.getByRole("navigation", { name: "Secciones del catálogo" });
      await expect(nav.getByRole("link", { name: tab, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: tab, exact: true })).toHaveAttribute("href", url);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });
});

test.describe("Catálogo · menús y platillos", { tag: ["@module:catalog"] }, () => {
  test("[CAT-016] crear menú por UI con upgrade por persona (precio y costo en centavos)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Menús › Nuevo menú");
    const name = uniq("Menu Prueba");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/menus/new");
    const form = page.getByRole("form", { name: "Nuevo menú" });
    await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await expect(form.getByText("Disponible ✓", { exact: false })).toBeVisible();
    const slug = await form.getByRole("textbox", { name: "Slug", exact: true }).inputValue();
    await pickOption(page, form, "Tipo de precio", "Upgrade por persona");
    await form.getByRole("textbox", { name: "Precio por persona" }).fill("250");
    await form.getByRole("textbox", { name: "Costo por persona" }).fill("120.40");
    await form.getByRole("button", { name: "Crear menú" }).click();
    await expect(page.getByText("Menú creado. Ahora agrega sus platillos.")).toBeVisible();
    await waitForDetail(page, "/admin/catalog/menus");
    const menu = await db.menu.findUniqueOrThrow({ where: { slug } });
    expect(menu).toMatchObject({ name, pricingType: "PER_GUEST", priceCents: 25_000, costPerGuestCents: 12_040, active: true });
    expect(await db.auditLog.count({ where: { entityId: menu.id, action: "catalog.created", actorEmail: ACCOUNTS.owner.email } })).toBe(1);
    await expect(page.getByRole("heading", { name: "Este menú aún no tiene platillos" })).toBeVisible();
  });

  test("[CAT-017] un menú 'Incluido' guarda precio $0 aunque se envíe otro monto (sin cobros fantasma)", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createMenuAction pricingType=INCLUDED priceCents=5000");
    const created = await createVia(await apiAs("owner"), "createMenuAction", menuPayload({ pricingType: "INCLUDED", priceCents: 5_000 }));
    expect((await db.menu.findUniqueOrThrow({ where: { id: created.id } })).priceCents).toBe(0);
  });

  test("[CAT-018] platillos: agregar, editar y eliminar con persistencia", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Menú › Platillos");
    const menu = await createVia(await apiAs("owner"), "createMenuAction", menuPayload());
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/menus/${menu.id}`);
    for (const [dish, course] of [["Chilaquiles verdes", "Plato fuerte"], ["Agua de jamaica", "Bebidas"]] as const) {
      await page.getByRole("button", { name: /Agregar (el primer )?platillo/ }).first().click();
      const dialog = page.getByRole("dialog", { name: "Nuevo platillo" });
      await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(dish);
      await pickOption(page, dialog, "Tiempo", course);
      await dialog.getByRole("button", { name: "Agregar platillo" }).click();
      await expect(page.getByText("Platillo agregado")).toBeVisible();
      await expect(dialog).toBeHidden();
    }
    await expect.poll(() => db.menuItem.count({ where: { menuId: menu.id } })).toBe(2);
    let items = await db.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => [i.name, i.course])).toEqual([["Chilaquiles verdes", "MAIN"], ["Agua de jamaica", "DRINK"]]);

    await page.getByRole("button", { name: "Editar Chilaquiles verdes" }).click();
    const edit = page.getByRole("dialog", { name: "Editar platillo" });
    await edit.getByRole("textbox", { name: "Nombre", exact: true }).fill("Chilaquiles rojos");
    await edit.getByRole("textbox", { name: "Descripción" }).fill("Con crema y queso fresco");
    await edit.getByRole("button", { name: "Guardar platillo" }).click();
    await expect(page.getByText("Platillo actualizado")).toBeVisible();
    await expect.poll(async () => (await db.menuItem.findUniqueOrThrow({ where: { id: items[0]!.id } })).name).toBe("Chilaquiles rojos");

    await page.getByRole("button", { name: "Eliminar Agua de jamaica" }).click();
    await page.getByRole("alertdialog", { name: '¿Eliminar "Agua de jamaica"?' }).getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Platillo eliminado")).toBeVisible();
    await expect.poll(() => db.menuItem.count({ where: { menuId: menu.id } })).toBe(1);
    await page.reload();
    await expect(page.getByText("Chilaquiles rojos")).toBeVisible();
    await expect(page.getByText("Con crema y queso fresco")).toBeVisible();
    await expect(page.getByText("Agua de jamaica")).toHaveCount(0);
    items = await db.menuItem.findMany({ where: { menuId: menu.id } });
    expect(items).toHaveLength(1);
  });

  test("[CAT-019] reordenar platillos (subir/bajar y 'Ordenar por tiempo') persiste el orden", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Menú › Platillos › ordenar");
    const api = await apiAs("owner");
    const menu = await createVia(api, "createMenuAction", menuPayload());
    for (const [name, course] of [["Postre E2E", "DESSERT"], ["Entrada E2E", "STARTER"], ["Bebida E2E", "DRINK"]]) {
      await createVia(api, "createMenuItemAction", { menuId: menu.id, name, description: "", course, dietaryTags: [] });
    }
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/menus/${menu.id}`);
    await page.getByRole("button", { name: "Subir Entrada E2E" }).click();
    const order = async () => (await db.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } })).map((i) => i.name);
    await expect.poll(order).toEqual(["Entrada E2E", "Postre E2E", "Bebida E2E"]);
    await page.getByRole("button", { name: "Ordenar por tiempo" }).click();
    await expect(page.getByText("Platillos ordenados por tiempo")).toBeVisible();
    await expect.poll(order).toEqual(["Bebida E2E", "Entrada E2E", "Postre E2E"]);
  });

  test("[CAT-020] backend: reordenar con ids ajenos o incompletos se rechaza sin cambiar el orden", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "reorderMenuItemsAction con lista que no es permutación");
    const api = await apiAs("owner");
    const menu = await createVia(api, "createMenuAction", menuPayload());
    const a = await createVia(api, "createMenuItemAction", { menuId: menu.id, name: "Uno", description: "", course: "MAIN", dietaryTags: [] });
    const b = await createVia(api, "createMenuItemAction", { menuId: menu.id, name: "Dos", description: "", course: "MAIN", dietaryTags: [] });
    const other = await db.menuItem.findFirstOrThrow({ where: { menuId: { not: menu.id } } });
    for (const orderedIds of [[b.id], [b.id, other.id], [b.id, a.id, other.id], [a.id, a.id]]) {
      const r = await callAction(api, "catalog", "reorderMenuItemsAction", { menuId: menu.id, orderedIds });
      expect(r.result, JSON.stringify(orderedIds)).toMatchObject({ ok: false, code: "VALIDATION_ERROR", error: "El menú cambió en otra pestaña. Recarga la página para ordenar los platillos." });
    }
    const items = await db.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: other.id } })).menuId).not.toBe(menu.id);
  });

  test("[CAT-021] eliminar menú: sin uso se borra; ligado a una experiencia se desactiva", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Menú › Eliminar (libre y en uso)");
    const api = await apiAs("owner");
    const free = await createVia<{ id: string; slug: string }>(api, "createMenuAction", menuPayload());
    const usedPayload = menuPayload();
    const used = await createVia<{ id: string; slug: string }>(api, "createMenuAction", usedPayload);
    await createExperienceViaAction(api, { menuIds: [used.id] });
    const page = await rolePage("owner");

    await gotoReady(page, `/admin/catalog/menus/${free.id}`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Menú eliminado.")).toBeVisible();
    await page.waitForURL(/\/admin\/catalog\/menus$/);
    expect(await db.menu.findUnique({ where: { id: free.id } })).toBeNull();

    await gotoReady(page, `/admin/catalog/menus/${used.id}`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("No eliminamos el menú porque está ligado a 1 experiencia. Lo desactivamos para que deje de ofrecerse; el historial queda intacto.")).toBeVisible();
    expect((await db.menu.findUniqueOrThrow({ where: { id: used.id } })).active).toBe(false);
    expect(await db.auditLog.count({ where: { entityId: used.id, action: "catalog.deactivated" } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: free.id, action: "catalog.deleted" } })).toBe(1);
  });
});

test.describe("Catálogo · add-ons", { tag: ["@module:catalog"] }, () => {
  test("[CAT-022] crear add-on por persona por UI (precio/costo en centavos, categoría de costo)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Add-ons › Nuevo add-on");
    const name = uniq("Barra de cafe");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/addons/new");
    const form = page.getByRole("form", { name: "Nuevo add-on" });
    await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await expect(form.getByText("Disponible ✓", { exact: false })).toBeVisible();
    const slug = await form.getByRole("textbox", { name: "Slug", exact: true }).inputValue();
    await pickOption(page, form, "Categoría", "Bebidas");
    await pickOption(page, form, "Tipo de precio", "Por persona");
    await form.getByRole("textbox", { name: "Precio por persona" }).fill("125.50");
    await form.getByRole("textbox", { name: "Costo por persona" }).fill("60");
    await pickOption(page, form, "Categoría de costo", "Alimentos");
    await form.getByRole("spinbutton", { name: "Cantidad máxima" }).fill("3");
    await form.getByRole("button", { name: "Crear add-on" }).click();
    await expect(page.getByText("Add-on creado")).toBeVisible();
    await waitForDetail(page, "/admin/catalog/addons");
    const addOn = await db.addOn.findUniqueOrThrow({ where: { slug } });
    expect(addOn).toMatchObject({ name, category: "DRINKS", pricingType: "PER_GUEST", priceCents: 12_550, costCents: 6_000, costCategory: "FOOD", maxQuantity: 3, active: true });
    await gotoReady(page, "/admin/catalog/addons");
    await expect(page.getByRole("switch", { name: `Desactivar ${name}` })).toBeChecked();
  });

  test("[CAT-023] editar precio de un add-on queda auditado (catalog.price_changed)", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Add-on › Guardar");
    const payload = addOnPayload();
    const addOn = await createVia(await apiAs("owner"), "createAddOnAction", payload);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/addons/${addOn.id}`);
    const form = page.getByRole("form", { name: "Editar add-on" });
    await form.getByRole("textbox", { name: "Precio", exact: true }).fill("1,350");
    await form.getByRole("button", { name: /Guardar/ }).click();
    await expect(page.getByText("Add-on guardado")).toBeVisible();
    await expect.poll(async () => (await db.addOn.findUniqueOrThrow({ where: { id: addOn.id } })).priceCents).toBe(135_000);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: addOn.id, action: "catalog.price_changed" } });
    expect(audit.before).toMatchObject({ priceCents: 100_000 });
    expect(audit.after).toMatchObject({ priceCents: 135_000, name: payload.name });
  });

  test("[CAT-024] backend rechaza montos/cantidades inválidas en add-ons", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createAddOnAction con datos inválidos");
    const api = await apiAs("owner");
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ priceCents: -500 }, "priceCents", "El monto no puede ser negativo"],
      [{ priceCents: 99.99 }, "priceCents", "El monto debe tener máximo 2 decimales"],
      [{ costCents: 1e12 }, "costCents", "El monto es demasiado alto"],
      [{ maxQuantity: 0 }, "maxQuantity", "Cantidad máxima: mínimo 1"],
      [{ maxQuantity: 101 }, "maxQuantity", "Cantidad máxima: máximo 100"],
      [{ leadTimeDays: -1 }, "leadTimeDays", "Días de anticipación: mínimo 0"],
      [{ pricingType: "POR_HORA" }, "pricingType", "Elige un tipo de precio"],
      [{ imageUrl: "javascript:alert(1)" }, "imageUrl", "Usa una ruta local (/images/...) o una URL https://"],
    ];
    const slugs: string[] = [];
    for (const [over, field, message] of cases) {
      const payload = addOnPayload(over);
      slugs.push(payload.slug as string);
      const r = await callAction(api, "catalog", "createAddOnAction", payload);
      expect(r.result?.ok, JSON.stringify(over)).toBe(false);
      if (r.result && !r.result.ok) expect(r.result.fieldErrors?.[field], JSON.stringify(r.result.fieldErrors)).toContain(message);
    }
    expect(await db.addOn.count({ where: { slug: { in: slugs } } })).toBe(0);
  });

  test("[CAT-025] eliminar add-on usado en una cotización lo desactiva; sin uso se borra", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Add-on › Eliminar (en cotización / libre)");
    const api = await apiAs("owner");
    const usedPayload = addOnPayload();
    const used = await createVia(api, "createAddOnAction", usedPayload);
    const free = await createVia(api, "createAddOnAction", addOnPayload());
    const customer = await createCustomer(db, { name: uniq("Clienta AddOn") });
    await createQuoteViaAction(api, db, { customerId: customer.id, addOns: [{ slug: usedPayload.slug as string, quantity: 1 }] });
    expect(await db.quoteItem.count({ where: { type: "ADDON", refId: used.id } })).toBe(1);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/addons/${used.id}`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("No eliminamos el add-on porque está ligado a 1 concepto de cotización. Lo desactivamos para que deje de ofrecerse; el historial queda intacto.")).toBeVisible();
    expect((await db.addOn.findUniqueOrThrow({ where: { id: used.id } })).active).toBe(false);

    await gotoReady(page, `/admin/catalog/addons/${free.id}`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Add-on eliminado.")).toBeVisible();
    await page.waitForURL(/\/admin\/catalog\/addons$/);
    expect(await db.addOn.findUnique({ where: { id: free.id } })).toBeNull();
  });
});

test.describe("Catálogo · estilos, zonas y presupuestos", { tag: ["@module:catalog"] }, () => {
  test("[CAT-026] estilo: crear con paleta, editar y eliminar (sin uso)", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Estilos › Nuevo / Editar / Eliminar");
    const name = uniq("Estilo Jardin");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/styles");
    await page.getByRole("button", { name: "Nuevo estilo" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo estilo" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await expect(dialog.getByText("Disponible ✓", { exact: false })).toBeVisible();
    const slug = await dialog.getByRole("textbox", { name: "Slug", exact: true }).inputValue();
    await dialog.getByRole("textbox", { name: "Nuevo color (hex)" }).fill("#A3B18A");
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await dialog.getByRole("button", { name: "Crear estilo" }).click();
    await expect(page.getByText("Estilo creado")).toBeVisible();
    const style = await db.style.findUniqueOrThrow({ where: { slug } });
    expect(style.palette.map((c) => c.toLowerCase())).toEqual(["#a3b18a"]);

    await page.getByRole("button", { name: `Editar ${name}` }).click();
    const edit = page.getByRole("dialog", { name: "Editar estilo" });
    await edit.getByRole("textbox", { name: "Descripción" }).fill("Verdes suaves y flores silvestres");
    await edit.getByRole("button", { name: "Guardar estilo" }).click();
    await expect(page.getByText("Estilo guardado")).toBeVisible();
    await expect.poll(async () => (await db.style.findUniqueOrThrow({ where: { id: style.id } })).description).toBe("Verdes suaves y flores silvestres");

    await page.getByRole("button", { name: `Eliminar ${name}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Estilo eliminado.")).toBeVisible();
    await expect.poll(() => db.style.findUnique({ where: { id: style.id } })).toBeNull();
    await page.reload();
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  });

  test("[CAT-027] backend: paleta con colores no hex y slug inválido se rechazan", { tag: ["@P3", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createStyleAction con palette inválida");
    const api = await apiAs("owner");
    const p1 = stylePayload({ palette: ["#zzz", "rojo"] });
    const r1 = await callAction(api, "catalog", "createStyleAction", p1);
    expect(r1.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    if (r1.result && !r1.result.ok) expect(r1.result.fieldErrors?.["palette.0"]).toContain("Usa colores hex como #a3b18a");
    const p2 = stylePayload({ slug: "-mal-" });
    const r2 = await callAction(api, "catalog", "createStyleAction", p2);
    expect(r2.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(await db.style.count({ where: { slug: { in: [p1.slug as string, "-mal-"] } } })).toBe(0);
  });

  test("[CAT-028] zona: crear con códigos postales y tarifa; un CP inválido se marca y no se agrega", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Zonas › Nueva zona");
    const name = uniq("Zona Coyoacan");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/areas");
    await page.getByRole("button", { name: "Nueva zona" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva zona" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await expect(dialog.getByText("Disponible ✓", { exact: false })).toBeVisible();
    const slug = await dialog.getByRole("textbox", { name: "Slug", exact: true }).inputValue();
    const cp = dialog.getByRole("textbox", { name: /Códigos postales/ });
    await cp.fill("04100 04000 123");
    await cp.press("Enter");
    await expect(dialog.getByText('"123" no es un código postal de 5 dígitos.')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Quitar código postal 04000" })).toBeVisible();
    await cp.fill("");
    await dialog.getByRole("textbox", { name: "Tarifa de logística (precio)" }).fill("350");
    await dialog.getByRole("textbox", { name: "Costo de logística" }).fill("420");
    await expect(dialog.getByText("La logística en esta zona pierde $70 por evento.")).toBeVisible();
    await dialog.getByRole("button", { name: "Crear zona" }).click();
    await expect(page.getByText("Zona creada")).toBeVisible();
    const area = await db.serviceArea.findUniqueOrThrow({ where: { slug } });
    expect(area).toMatchObject({ name, postalCodes: ["04000", "04100"], logisticsFeeCents: 35_000, logisticsCostCents: 42_000, active: true });
    await page.reload();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  });

  test("[CAT-029] zona con códigos postales que ya cubre otra zona: se guarda y avisa del traslape", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "createServiceAreaAction con CP repetido + UI de aviso");
    const cpA = String(90000 + Math.floor(Math.random() * 9999)).padStart(5, "0");
    const api = await apiAs("owner");
    const a = areaPayload({ postalCodes: [cpA] });
    await createVia(api, "createServiceAreaAction", a);
    const r = await callAction<{ id: string; overlaps: Array<{ name: string; codes: string[] }> }>(api, "catalog", "createServiceAreaAction", areaPayload({ postalCodes: [cpA, "99999"] }));
    expect(r.result?.ok).toBe(true);
    if (r.result?.ok) expect(r.result.data.overlaps).toEqual([expect.objectContaining({ name: a.name, codes: [cpA] })]);
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/areas");
    await page.getByRole("button", { name: "Nueva zona" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva zona" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(uniq("Zona Traslape"));
    const cp = dialog.getByRole("textbox", { name: /Códigos postales/ });
    await cp.fill(cpA);
    await cp.press("Enter");
    await dialog.getByRole("button", { name: "Crear zona" }).click();
    await expect(page.getByText(/Algunos códigos postales también están en:/)).toBeVisible();
    expect(await db.serviceArea.count({ where: { postalCodes: { has: cpA } } })).toBe(3);
  });

  test("[CAT-030] eliminar zona: ligada a un lead se desactiva; libre se borra", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Zonas › Eliminar");
    const api = await apiAs("owner");
    const usedP = areaPayload();
    const used = await createVia(api, "createServiceAreaAction", usedP);
    const freeP = areaPayload();
    const free = await createVia(api, "createServiceAreaAction", freeP);
    await createLead(db, { name: uniq("Lead con zona"), serviceAreaId: used.id });
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/areas");
    await page.getByRole("button", { name: `Eliminar ${usedP.name}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("No eliminamos la zona porque está ligada a 1 lead. La desactivamos para que deje de ofrecerse; el historial queda intacto.")).toBeVisible();
    expect((await db.serviceArea.findUniqueOrThrow({ where: { id: used.id } })).active).toBe(false);
    await page.getByRole("button", { name: `Eliminar ${freeP.name}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Zona eliminada.")).toBeVisible();
    await expect.poll(() => db.serviceArea.findUnique({ where: { id: free.id } })).toBeNull();
  });

  test("[CAT-031] rango de presupuesto: crear (con etiqueta sugerida), editar y eliminar", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Presupuestos › Nuevo rango / Editar / Eliminar");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/budgets");
    await page.getByRole("button", { name: "Nuevo rango" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo rango de presupuesto" });
    const min = 70_000 + Math.floor(Math.random() * 9_000);
    await dialog.getByRole("textbox", { name: "Mínimo" }).fill(String(min));
    await dialog.getByRole("checkbox", { name: /Sin máximo/ }).click();
    await dialog.getByRole("textbox", { name: "Máximo" }).fill(String(min + 10_000));
    await dialog.getByRole("button", { name: /Sugerir/ }).click();
    const label = await dialog.getByRole("textbox", { name: "Etiqueta" }).inputValue();
    expect(label).toMatch(/\$\d/);
    await dialog.getByRole("button", { name: "Crear rango" }).click();
    await expect(page.getByText("Rango creado")).toBeVisible();
    const range = await db.budgetRange.findFirstOrThrow({ where: { minCents: min * 100 } });
    expect(range).toMatchObject({ label, maxCents: (min + 10_000) * 100, active: true });

    const newLabel = uniq("Rango Editado");
    await page.getByRole("button", { name: `Editar ${label}` }).click();
    const edit = page.getByRole("dialog", { name: "Editar rango" });
    await edit.getByRole("textbox", { name: "Etiqueta" }).fill(newLabel);
    await edit.getByRole("button", { name: "Guardar rango" }).click();
    await expect(page.getByText("Rango guardado")).toBeVisible();
    await expect.poll(async () => (await db.budgetRange.findUniqueOrThrow({ where: { id: range.id } })).label).toBe(newLabel);

    await page.getByRole("button", { name: `Eliminar ${newLabel}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Rango eliminado.")).toBeVisible();
    await expect.poll(() => db.budgetRange.findUnique({ where: { id: range.id } })).toBeNull();
  });

  test("[CAT-032] rango de presupuesto inválido: máximo ≤ mínimo (UI) y montos negativos (backend)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Presupuestos › validaciones");
    const label = uniq("Rango Malo");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/budgets");
    await page.getByRole("button", { name: "Nuevo rango" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo rango de presupuesto" });
    await dialog.getByRole("textbox", { name: "Mínimo" }).fill("20000");
    await dialog.getByRole("checkbox", { name: /Sin máximo/ }).click();
    await dialog.getByRole("textbox", { name: "Máximo" }).fill("15000");
    await dialog.getByRole("textbox", { name: "Etiqueta" }).fill(label);
    await dialog.getByRole("button", { name: "Crear rango" }).click();
    await expect(dialog.getByText("El máximo debe ser mayor que el mínimo")).toBeVisible();
    expect(await db.budgetRange.count({ where: { label } })).toBe(0);
    const api = await apiAs("owner");
    for (const over of [{ minCents: -1 }, { minCents: 100, maxCents: 100 }, { minCents: 1.5 }]) {
      const p = budgetPayload({ label, ...over });
      const r = await callAction(api, "catalog", "createBudgetRangeAction", p);
      expect(r.result, JSON.stringify(over)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    }
    expect(await db.budgetRange.count({ where: { label } })).toBe(0);
  });

  test("[CAT-033] eliminar un rango ligado a un lead lo desactiva", { tag: ["@P3"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Presupuestos › Eliminar rango en uso");
    const p = budgetPayload();
    const range = await createVia(await apiAs("owner"), "createBudgetRangeAction", p);
    await createLead(db, { name: uniq("Lead con rango"), budgetRangeId: range.id });
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/budgets");
    await page.getByRole("button", { name: `Eliminar ${p.label}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("No eliminamos el rango porque está ligado a 1 lead. Lo desactivamos para que deje de ofrecerse; el historial queda intacto.")).toBeVisible();
    expect((await db.budgetRange.findUniqueOrThrow({ where: { id: range.id } })).active).toBe(false);
    void uniqSlug;
  });
});
