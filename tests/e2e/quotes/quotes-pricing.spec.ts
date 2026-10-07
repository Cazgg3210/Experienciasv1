/**
 * Paquete 3 · Cotizaciones — editor de conceptos y precios (borradores): totales mostrados = base,
 * líneas de catálogo calculadas en servidor, conceptos personalizados, descuentos (porcentaje/monto,
 * tope al subtotal, motivo obligatorio, auditoría before/after), negativas de cantidades/precios,
 * protección de líneas fijas, cambio de invitadas y vigencia.
 */
import { ACCOUNTS, createCustomer, expect, test, uniq } from "../fixtures";
import { formatMXN } from "../../../src/lib/money";
import {
  addOnBySlug,
  callAction,
  createQuoteViaAction,
  dateKeyFromToday,
  expectedTotals,
  experienceBySlug,
  gotoReady,
  mustCall,
  pricingPayload,
  pricingSettings,
  quoteState,
  totalsValue,
} from "./_helpers";

async function newDraft(api: import("@playwright/test").APIRequestContext, db: import("@prisma/client").PrismaClient, over: Parameters<typeof createQuoteViaAction>[2] extends infer T ? Partial<T> : never = {}) {
  const c = await createCustomer(db, { name: uniq("Clienta Precio") });
  const q = await createQuoteViaAction(api, db, { customerId: c.id, ...over });
  return { ...q, customer: c };
}

async function itemsSum(db: import("@prisma/client").PrismaClient, quoteId: string) {
  const items = await db.quoteItem.findMany({ where: { quoteId } });
  return items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
}

test.describe("Cotizaciones · precios y conceptos", { tag: ["@module:quotes"] }, () => {
  test("[QUO-009] el detalle muestra subtotal, IVA incluido, total, anticipo y saldo exactamente como en la base", { tag: ["@P0", "@critical"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización (borrador) › resumen de totales");
    const q = await newDraft(await apiAs("owner"), db, { experienceSlug: "bridal-brunch", guestCount: 9, menuSlug: "brunch-premium", areaSlug: "irrigacion", depositBps: 4000 });
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    const settings = await pricingSettings(db);
    const oracle = expectedTotals(await itemsSum(db, q.id), settings, 0, 4000);
    expect({ s: row.subtotalCents, t: row.taxCents, tot: row.totalCents, d: row.depositCents }).toEqual({ s: oracle.subtotalCents, t: oracle.taxCents, tot: oracle.totalCents, d: oracle.depositCents });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const editor = page.getByRole("region", { name: "Conceptos y precio" });
    await expect(totalsValue(editor, "Subtotal")).toHaveText(formatMXN(row.subtotalCents));
    await expect(totalsValue(editor, "IVA incluido")).toHaveText(formatMXN(row.taxCents));
    await expect(totalsValue(editor, "Total")).toHaveText(formatMXN(row.totalCents));
    await expect(totalsValue(editor, "Anticipo (40%)")).toHaveText(formatMXN(row.depositCents));
    await expect(totalsValue(editor, "Saldo")).toHaveText(formatMXN(row.totalCents - row.depositCents));
    await expect(page.getByText(`${row.code}`, { exact: true })).toBeVisible();
    await expect(page.getByText("· versión 1")).toBeVisible();
  });

  test("[QUO-010] agregar add-on del catálogo y un concepto personalizado: recálculo en servidor y guardado", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Conceptos y precio › Agregar add-on + Concepto personalizado › Guardar cambios");
    const q = await newDraft(await apiAs("owner"), db, { experienceSlug: "signature-brunch", guestCount: 8 });
    const pastel = await addOnBySlug(db, "pastel-personalizado");
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const editor = page.getByRole("region", { name: "Conceptos y precio" });
    await editor.getByRole("combobox", { name: "Agregar add-on del catálogo" }).selectOption(pastel.id);
    await editor.getByRole("button", { name: "Aumentar Unidades del add-on" }).click();
    await editor.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(editor.getByRole("table").getByText(pastel.name, { exact: true })).toBeVisible();

    await editor.getByRole("button", { name: "Concepto personalizado" }).click();
    const dialog = page.getByRole("dialog", { name: "Concepto personalizado" });
    await dialog.getByRole("textbox", { name: "Descripción" }).fill("Letrero de neón personalizado");
    await dialog.getByRole("textbox", { name: "Precio unitario" }).fill("1,250.75");
    await dialog.getByRole("textbox", { name: "Costo unitario" }).fill("600");
    await dialog.getByRole("button", { name: "Agregar concepto" }).click();
    await expect(editor.getByText("Cambios sin guardar")).toBeVisible();

    const base = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    const expectedSubtotal = base.subtotalCents + pastel.priceCents * 2 + 125_075;
    const settings = await pricingSettings(db);
    const oracle = expectedTotals(expectedSubtotal, settings, 0, base.depositBps);
    await expect(totalsValue(editor, "Total")).toHaveText(formatMXN(oracle.totalCents));
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Conceptos y totales guardados")).toBeVisible();
    await expect(editor.getByText("Guardado", { exact: true })).toBeVisible();

    const after = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    expect(after).toMatchObject({ subtotalCents: expectedSubtotal, totalCents: oracle.totalCents, taxCents: oracle.taxCents, depositCents: oracle.depositCents });
    const addon = after.items.find((i) => i.type === "ADDON")!;
    expect(addon).toMatchObject({ refId: pastel.id, quantity: 2, unitPriceCents: pastel.priceCents, unitCostCents: pastel.costCents });
    const custom = after.items.find((i) => i.type === "CUSTOM")!;
    expect(custom).toMatchObject({ description: "Letrero de neón personalizado", quantity: 1, unitPriceCents: 125_075, unitCostCents: 60_000, totalPriceCents: 125_075 });
    await page.reload();
    await expect(totalsValue(page.getByRole("region", { name: "Conceptos y precio" }), "Total")).toHaveText(formatMXN(oracle.totalCents));
  });

  test("[QUO-011] líneas de catálogo: el servidor fija precio/costo, aplica invitadas facturables y tope de cantidad", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "buildCatalogLineAction (ADDON por persona, ADDON con tope, EXTRA_GUEST)");
    const api = await apiAs("owner");
    const q = await newDraft(api, db, { experienceSlug: "signature-brunch", guestCount: 8 });
    const exp = await experienceBySlug(db, "signature-brunch");
    const mimosa = await addOnBySlug(db, "mimosa-bar");
    const pastel = await addOnBySlug(db, "pastel-personalizado");
    const call = (args: Record<string, unknown>) => mustCall<Record<string, unknown>>(api, "quotes", "buildCatalogLineAction", { quoteId: q.id, ...args }, { params: { id: q.id } });
    expect(await call({ kind: "ADDON", addOnId: mimosa.id, units: 1 })).toMatchObject({ type: "ADDON", refId: mimosa.id, quantity: 8, unitPriceCents: mimosa.priceCents, unitCostCents: mimosa.costCents, description: `${mimosa.name} (por persona)` });
    expect(await call({ kind: "ADDON", addOnId: pastel.id, units: 9 })).toMatchObject({ quantity: pastel.maxQuantity, unitPriceCents: pastel.priceCents });
    expect(await call({ kind: "EXTRA_GUEST", units: 3 })).toMatchObject({ type: "EXTRA_GUEST", quantity: 3, unitPriceCents: exp.extraGuestPriceCents, unitCostCents: exp.extraGuestCostCents, costCategory: "FOOD" });
    const bad = await callAction(api, "quotes", "buildCatalogLineAction", { quoteId: q.id, kind: "ADDON", addOnId: null, units: 1 }, { params: { id: q.id } });
    expect(bad.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", error: "Elige un add-on del catálogo." });
    const zero = await callAction(api, "quotes", "buildCatalogLineAction", { quoteId: q.id, kind: "EXTRA_GUEST", units: 0 }, { params: { id: q.id } });
    expect(zero.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  test("[QUO-012] descuento por porcentaje con motivo: total recalculado y auditoría before/after", { tag: ["@P0", "@critical"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Descuento 10% › Guardar cambios");
    const q = await newDraft(await apiAs("owner"), db, { experienceSlug: "birthday-table", guestCount: 7 });
    const before = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    const settings = await pricingSettings(db);
    const discount = Math.round((before.subtotalCents * 1000) / 10_000);
    const oracle = expectedTotals(before.subtotalCents, settings, discount, before.depositBps);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const editor = page.getByRole("region", { name: "Conceptos y precio" });
    await editor.getByRole("combobox", { name: "Descuento" }).selectOption("PERCENT");
    await editor.getByRole("textbox", { name: "Porcentaje" }).fill("10");
    await editor.getByRole("textbox", { name: "Motivo del descuento" }).fill("Clienta frecuente");
    await expect(totalsValue(editor, "Descuento (10%)")).toHaveText(`−${formatMXN(discount)}`);
    await expect(totalsValue(editor, "Total")).toHaveText(formatMXN(oracle.totalCents));
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Conceptos y totales guardados")).toBeVisible();
    const after = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after).toMatchObject({ discountType: "PERCENT", discountValue: 1000, discountReason: "Clienta frecuente", discountCents: discount, totalCents: oracle.totalCents, taxCents: oracle.taxCents, depositCents: oracle.depositCents });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Quote", entityId: q.id, action: "quote.discount_applied" } });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner.email);
    expect(audit.before).toMatchObject({ type: null, value: null, discountCents: 0, totalCents: before.totalCents });
    expect(audit.after).toMatchObject({ type: "PERCENT", value: 1000, reason: "Clienta frecuente", discountCents: discount, totalCents: oracle.totalCents });
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "Descuento modificado" })).toBeVisible();
  });

  test("[QUO-013] descuento por monto mayor al subtotal: se limita al subtotal (total $0) y la propuesta no se puede enviar", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Descuento monto > subtotal › Guardar › Enviar");
    const api = await apiAs("owner");
    const q = await newDraft(api, db, { experienceSlug: "signature-brunch", guestCount: 6 });
    const before = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const editor = page.getByRole("region", { name: "Conceptos y precio" });
    await editor.getByRole("combobox", { name: "Descuento" }).selectOption("AMOUNT");
    await editor.getByRole("textbox", { name: "Monto" }).fill(String(before.subtotalCents / 100 + 5000));
    await editor.getByRole("textbox", { name: "Motivo del descuento" }).fill("Cortesía total (prueba)");
    await expect(editor.getByText("El descuento se limitó al subtotal.")).toBeVisible();
    await expect(totalsValue(editor, "Total")).toHaveText(formatMXN(0));
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Conceptos y totales guardados")).toBeVisible();
    const after = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(after).toMatchObject({ discountType: "AMOUNT", discountValue: before.subtotalCents + 500_000, discountCents: before.subtotalCents, totalCents: 0, taxCents: 0, depositCents: 0 });
    const send = await callAction(api, "quotes", "sendQuoteAction", { quoteId: q.id }, { params: { id: q.id } });
    expect(send.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", error: "La cotización no tiene conceptos con precio" });
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("DRAFT");
  });

  test("[QUO-014] descuento sin motivo, > 100% o negativo se rechaza en el servidor sin tocar la cotización", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "saveQuotePricingAction con descuentos inválidos");
    const api = await apiAs("owner");
    const q = await newDraft(api, db);
    const snap = await quoteState(db, q.id);
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ type: "PERCENT", value: 1000 }, "discount.reason", "Indica el motivo del descuento"],
      [{ type: "AMOUNT", value: 5000, reason: "   " }, "discount.reason", "Indica el motivo del descuento"],
      [{ type: "PERCENT", value: 10_001, reason: "x" }, "discount.value", "Máximo 100%"],
      [{ type: "AMOUNT", value: -100, reason: "x" }, "discount.value", "No puede ser negativo"],
      [{ type: "AMOUNT", value: 10.5, reason: "x" }, "discount.value", ""],
      [{ type: "REGALO", value: 100, reason: "x" }, "discount.type", ""],
    ];
    for (const [discount, field, message] of cases) {
      const payload = await pricingPayload(db, q.id, { discount: discount as never });
      for (const name of ["saveQuotePricingAction", "previewQuotePricingAction"]) {
        const r = await callAction(api, "quotes", name, payload, { params: { id: q.id } });
        expect(r.result?.ok, `${name} ${JSON.stringify(discount)}`).toBe(false);
        if (r.result && !r.result.ok) {
          expect(Object.keys(r.result.fieldErrors ?? {})).toContain(field);
          if (message) expect(r.result.fieldErrors?.[field]).toContain(message);
        }
      }
    }
    expect(await quoteState(db, q.id)).toEqual(snap);
    expect(await db.auditLog.count({ where: { entityId: q.id, action: "quote.discount_applied" } })).toBe(0);
  });

  test("[QUO-015] cantidades negativas/cero, precios negativos o con decimales y conceptos vacíos se rechazan", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "saveQuotePricingAction con líneas inválidas");
    const api = await apiAs("owner");
    const q = await newDraft(api, db, { addOns: [{ slug: "pastel-personalizado", quantity: 1 }] });
    const snap = await quoteState(db, q.id);
    const addonIdx = (await db.quoteItem.findMany({ where: { quoteId: q.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })).findIndex((i) => i.type === "ADDON");
    const mutate = (patch: Record<string, unknown>) => (l: Record<string, unknown>) => (l.type === "ADDON" ? { ...l, ...patch } : l);
    const cases: Array<[Parameters<typeof pricingPayload>[2], string, string]> = [
      [{ mapLine: mutate({ quantity: -1 }) }, `lines.${addonIdx}.quantity`, "Mínimo 1"],
      [{ mapLine: mutate({ quantity: 0 }) }, `lines.${addonIdx}.quantity`, "Mínimo 1"],
      [{ mapLine: mutate({ quantity: 1.5 }) }, `lines.${addonIdx}.quantity`, "Cantidad entera"],
      [{ mapLine: mutate({ unitPriceCents: -100 }) }, `lines.${addonIdx}.unitPriceCents`, "No puede ser negativo"],
      [{ mapLine: mutate({ unitPriceCents: 999.5 }) }, `lines.${addonIdx}.unitPriceCents`, ""],
      [{ mapLine: mutate({ unitPriceCents: 100_000_001 }) }, `lines.${addonIdx}.unitPriceCents`, ""],
      [{ extraLines: [{ itemId: null, type: "CUSTOM", refId: null, description: "", quantity: 1, unitPriceCents: 100, unitCostCents: 0, costCategory: "OTHER" }] }, `lines.${snap.items.length}.description`, "Describe el concepto"],
      [{ extraLines: [{ itemId: null, type: "CUSTOM", refId: null, description: "Negativo", quantity: 1, unitPriceCents: 100, unitCostCents: -1, costCategory: "OTHER" }] }, `lines.${snap.items.length}.unitCostCents`, "No puede ser negativo"],
    ];
    for (const [over, field, message] of cases) {
      const payload = await pricingPayload(db, q.id, over);
      const r = await callAction(api, "quotes", "saveQuotePricingAction", payload, { params: { id: q.id } });
      expect(r.result?.ok, field).toBe(false);
      if (r.result && !r.result.ok) {
        expect(Object.keys(r.result.fieldErrors ?? {}), JSON.stringify(r.result.fieldErrors)).toContain(field);
        if (message) expect(r.result.fieldErrors?.[field]).toContain(message);
      }
    }
    const empty = await callAction(api, "quotes", "saveQuotePricingAction", { ...(await pricingPayload(db, q.id)), lines: [] }, { params: { id: q.id } });
    expect(empty.result).toMatchObject({ ok: false, fieldErrors: { lines: ["Agrega al menos un concepto"] } });
    expect(await quoteState(db, q.id)).toEqual(snap);
  });

  test("[QUO-016] experiencia base, menú y logística no cambian de cantidad aunque se manipule la petición", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "saveQuotePricingAction con quantity alterada en BASE_EXPERIENCE/LOGISTICS");
    const api = await apiAs("owner");
    const q = await newDraft(api, db, { areaSlug: "polanco", menuSlug: "brunch-premium", guestCount: 8 });
    const before = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: true } });
    const payload = await pricingPayload(db, q.id, {
      mapLine: (l) => (["BASE_EXPERIENCE", "LOGISTICS", "MENU"].includes(l.type as string) ? { ...l, quantity: 50 } : l),
    });
    const r = await callAction(api, "quotes", "saveQuotePricingAction", payload, { params: { id: q.id } });
    expect(r.result?.ok, r.raw.slice(0, 200)).toBe(true);
    const after = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: true } });
    for (const t of ["BASE_EXPERIENCE", "LOGISTICS", "MENU"]) {
      expect(after.items.find((i) => i.type === t)?.quantity, t).toBe(before.items.find((i) => i.type === t)?.quantity);
    }
    expect(after.totalCents).toBe(before.totalCents);
  });

  test("[QUO-017] cambiar el precio unitario de una línea de catálogo queda auditado (quote.price_changed)", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Precio unitario de la experiencia base › Guardar cambios");
    const q = await newDraft(await apiAs("owner"), db, { experienceSlug: "signature-brunch", guestCount: 6 });
    const exp = await experienceBySlug(db, "signature-brunch");
    const baseItem = await db.quoteItem.findFirstOrThrow({ where: { quoteId: q.id, type: "BASE_EXPERIENCE" } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const editor = page.getByRole("region", { name: "Conceptos y precio" });
    const price = editor.getByRole("textbox", { name: `Precio unitario de ${baseItem.description}` });
    await price.fill("13500");
    await expect(editor.getByRole("table").getByText(`Antes ${formatMXN(exp.basePriceCents)}`)).toBeVisible();
    await editor.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Conceptos y totales guardados")).toBeVisible();
    const after = await db.quoteItem.findUniqueOrThrow({ where: { id: baseItem.id } });
    expect(after.unitPriceCents).toBe(1_350_000);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: q.id, action: "quote.price_changed" } });
    expect(audit.before).toEqual([{ description: baseItem.description, unitPriceCents: exp.basePriceCents }]);
    expect(audit.after).toEqual([{ description: baseItem.description, unitPriceCents: 1_350_000 }]);
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).subtotalCents).toBe(await itemsSum(db, q.id));
  });

  test("[QUO-018] datos de la propuesta: cambiar invitadas recalcula extras y add-ons por persona; vigencia pasada se rechaza", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Datos de la propuesta › invitadas 6→9 · vigencia ayer");
    const api = await apiAs("owner");
    const q = await newDraft(api, db, { experienceSlug: "signature-brunch", guestCount: 6, addOns: [{ slug: "mimosa-bar", quantity: 1 }] });
    const exp = await experienceBySlug(db, "signature-brunch");
    const mimosa = await addOnBySlug(db, "mimosa-bar");
    const newTitle = uniq("Título Nuevo");
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const form = page.getByRole("form", { name: "Datos de la propuesta" });
    await form.getByRole("textbox", { name: "Título", exact: true }).fill(newTitle);
    await form.getByRole("spinbutton", { name: "Invitadas" }).fill("9");
    await expect(form.getByText("Se ajustarán invitadas adicionales, menú y add-ons por persona (conservando precios).")).toBeVisible();
    await form.getByRole("button", { name: "Guardar datos" }).click();
    // El toast y la entrada del Historial (quote.updated) dicen lo mismo: se valida cada uno en su región.
    await expect(page.getByRole("region", { name: /^Notificaciones/ }).getByText("Datos actualizados")).toBeVisible();
    await expect(page.getByRole("region", { name: "Historial" }).getByText("Datos actualizados")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(newTitle);
    const after = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: true } });
    expect(after.guestCount).toBe(9);
    expect(after.items.find((i) => i.type === "EXTRA_GUEST")).toMatchObject({ quantity: 3, unitPriceCents: exp.extraGuestPriceCents });
    expect(after.items.find((i) => i.type === "ADDON" && i.refId === mimosa.id)).toMatchObject({ quantity: 9, unitPriceCents: mimosa.priceCents });
    expect(after.subtotalCents).toBe(await itemsSum(db, q.id));
    const settings = await pricingSettings(db);
    expect(after.totalCents).toBe(expectedTotals(after.subtotalCents, settings, 0, after.depositBps).totalCents);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: q.id, action: "quote.updated" } });
    expect(audit.before).toMatchObject({ guestCount: 6 });
    expect(audit.after).toMatchObject({ guestCount: 9, title: newTitle });

    // Vigencia en el pasado → rechazo del servidor (campo marcado), sin cambios
    const r = await callAction(api, "quotes", "updateQuoteDetailsAction", {
      quoteId: q.id, title: newTitle, guestCount: 9, validUntil: dateKeyFromToday(-1), eventDate: "", startTime: "", styleId: "", notesForCustomer: "", internalNotes: "",
    }, { params: { id: q.id } });
    expect(r.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", fieldErrors: { validUntil: ["La vigencia no puede estar en el pasado"] } });
    const titleMin = await callAction(api, "quotes", "updateQuoteDetailsAction", { quoteId: q.id, title: "ab", guestCount: 9 }, { params: { id: q.id } });
    expect(titleMin.result).toMatchObject({ ok: false, fieldErrors: { title: ["Mínimo 3 caracteres"] } });
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).validUntil?.getTime()).toBe(after.validUntil?.getTime());
  });

  test("[QUO-033] otra fundadora (Rosa) aplica un descuento y la auditoría registra su correo", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner2", "saveQuotePricingAction con descuento como Rosa");
    const q = await newDraft(await apiAs("owner"), db);
    const payload = await pricingPayload(db, q.id, { discount: { type: "AMOUNT", value: 50_000, reason: "Ajuste comercial" } });
    const r = await callAction(await apiAs("owner2"), "quotes", "saveQuotePricingAction", payload, { params: { id: q.id } });
    expect(r.result?.ok, r.raw.slice(0, 200)).toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: q.id, action: "quote.discount_applied" } });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner2.email);
    expect(audit.after).toMatchObject({ type: "AMOUNT", value: 50_000, discountCents: 50_000 });
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).discountCents).toBe(50_000);
  });
});
