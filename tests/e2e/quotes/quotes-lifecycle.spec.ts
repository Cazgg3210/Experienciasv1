/**
 * Paquete 3 · Cotizaciones — ciclo de vida: listado y filtros, enviar (SENT, token público, vigencia,
 * notificaciones, lead → QUOTED), validaciones de envío, marcar expirada / reactivar, duplicar,
 * nueva versión, guardas de estado (aceptada/rechazada/enviada no editables), impresión e IDs inexistentes.
 * La aceptación pública por token es del paquete 2: aquí sólo se lee el enlace público.
 */
import type { APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { ACCOUNTS, createCustomer, createLead, expect, test, uniq } from "../fixtures";
import { formatMXN } from "../../../src/lib/money";
import {
  callAction,
  createQuoteViaAction,
  dateKeyFromToday,
  followLink,
  gotoReady,
  pricingPayload,
  pricingSettings,
  quoteState,
  sendQuoteViaAction,
  waitForDetail,
} from "./_helpers";

async function draftFor(api: APIRequestContext, db: PrismaClient, over: Partial<Parameters<typeof createQuoteViaAction>[2]> = {}) {
  const customer = await createCustomer(db, { name: uniq("Clienta Ciclo") });
  const q = await createQuoteViaAction(api, db, { customerId: customer.id, ...over });
  return { ...q, customer };
}

test.describe("Cotizaciones · listado", { tag: ["@module:quotes"] }, () => {
  test("[QUO-001] listado: pestañas por estado, búsqueda por código/clienta/título y estado vacío", { tag: ["@P1", "@smoke"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotizaciones › listado › pestañas y búsqueda");
    const api = await apiAs("owner");
    const prefix = uniq("Lista Cot");
    const draft = await draftFor(api, db, { title: `${prefix} Borrador` });
    const sent = await draftFor(api, db, { title: `${prefix} Enviada` });
    await sendQuoteViaAction(api, sent.id);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes?q=${encodeURIComponent(prefix)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeVisible();
    const table = page.getByRole("table", { name: "Listado de cotizaciones" });
    await expect(table.getByRole("row")).toHaveCount(3);
    const sentRow = table.getByRole("row", { name: new RegExp(sent.code) });
    await expect(sentRow.getByText("Enviada", { exact: true })).toBeVisible();
    const total = (await db.quote.findUniqueOrThrow({ where: { id: sent.id } })).totalCents;
    await expect(sentRow.getByRole("cell", { name: formatMXN(total), exact: true })).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "Filtrar por estado" });
    const href = await followLink(page, tabs.getByRole("link", { name: "Enviadas" }));
    expect(new URL(href, "http://x").searchParams.get("status")).toBe("SENT");
    expect(new URL(href, "http://x").searchParams.get("q")).toBe(prefix);
    await expect(page.getByRole("navigation", { name: "Filtrar por estado" }).getByRole("link", { name: "Enviadas" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("table", { name: "Listado de cotizaciones" }).getByRole("row")).toHaveCount(2);

    await gotoReady(page, `/admin/quotes?q=${encodeURIComponent(draft.code)}`);
    await expect(page.getByRole("table", { name: "Listado de cotizaciones" }).getByRole("link", { name: draft.code })).toBeVisible();
    await gotoReady(page, `/admin/quotes?q=${encodeURIComponent(sent.customer.name)}`);
    await expect(page.getByRole("table", { name: "Listado de cotizaciones" }).getByRole("link", { name: sent.code })).toBeVisible();
    await gotoReady(page, `/admin/quotes?status=ACCEPTED&q=${encodeURIComponent(prefix)}`);
    await expect(page.getByRole("heading", { name: "No encontramos cotizaciones con esos filtros" })).toBeVisible();
    // parámetros basura no rompen la página
    await gotoReady(page, `/admin/quotes?status=HACKED&page=-4&expiring=yes`);
    await expect(page.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeVisible();
  });

  test("[QUO-032] 'Por vencer (48 h)' sólo lista enviadas cuya vigencia termina en las próximas 48 horas", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotizaciones › Por vencer (48 h)");
    const api = await apiAs("owner");
    const prefix = uniq("Vence");
    const soon = await draftFor(api, db, { title: `${prefix} Pronto` });
    const later = await draftFor(api, db, { title: `${prefix} Tarde` });
    await sendQuoteViaAction(api, soon.id);
    await sendQuoteViaAction(api, later.id);
    await db.quote.update({ where: { id: soon.id }, data: { validUntil: new Date(Date.now() + 20 * 3_600_000) } });
    await db.quote.update({ where: { id: later.id }, data: { validUntil: new Date(Date.now() + 5 * 86_400_000) } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes?expiring=1&q=${encodeURIComponent(prefix)}`);
    const table = page.getByRole("table", { name: "Listado de cotizaciones" });
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("link", { name: soon.code })).toBeVisible();
  });
});

test.describe("Cotizaciones · envío", { tag: ["@module:quotes"] }, () => {
  test("[QUO-019] enviar: estado SENT, vigencia, lead Cotizado, notificaciones email+WhatsApp, auditoría y enlace público", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Enviar a la clienta › Enviar · anónima abre /cotizacion/<token>");
    const api = await apiAs("owner");
    const lead = await createLead(db, { name: uniq("Lead Envio"), status: "QUALIFIED" });
    const q = await createQuoteViaAction(api, db, { customerId: lead.customerId!, leadId: lead.id, title: uniq("Propuesta Enviable") });
    // createQuote ya movió el lead a QUOTED; el envío debe registrar actividad QUOTE_SENT
    const customer = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId! } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await expect(page.getByText("El enlace para la clienta se activa al enviar.")).toBeVisible();
    await page.getByRole("button", { name: "Enviar a la clienta" }).click();
    const dialog = page.getByRole("alertdialog", { name: `¿Enviar la propuesta a ${customer.name}?` });
    await expect(dialog).toContainText("Le llegará por email y/o WhatsApp");
    const t0 = Date.now();
    await dialog.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Propuesta enviada")).toBeVisible();
    await expect(page.getByText("Enviada", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar expirada" })).toBeVisible();

    const sent = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(sent.status).toBe("SENT");
    expect(sent.sentAt!.getTime()).toBeGreaterThanOrEqual(t0 - 60_000);
    const settings = await pricingSettings(db);
    expect(sent.validUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(sent.validUntil!.getTime()).toBeLessThanOrEqual(Date.now() + settings.quoteValidityDays * 86_400_000 + 60_000);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("QUOTED");
    const act = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, type: "QUOTE_SENT" } });
    expect(act.message).toContain(`Cotización ${q.code} enviada (${formatMXN(sent.totalCents)}`);
    const notes = await db.notificationLog.findMany({ where: { quoteId: q.id, type: "QUOTE_SENT" } });
    expect(notes.map((n) => n.channel).sort()).toEqual(["EMAIL", "WHATSAPP"]);
    expect(notes.find((n) => n.channel === "EMAIL")?.to).toBe(customer.email);
    // WhatsApp normaliza a formato internacional (52 + 10 dígitos)
    const waDigits = (notes.find((n) => n.channel === "WHATSAPP")?.to ?? "").replace(/\D/g, "");
    expect(waDigits.endsWith((customer.whatsapp ?? customer.phone)!.replace(/\D/g, ""))).toBe(true);
    for (const n of notes) expect(n.body + (n.actionUrl ?? "")).toContain(sent.publicToken);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: q.id, action: "quote.sent" } });
    expect(audit).toMatchObject({ actorEmail: ACCOUNTS.owner.email, before: { status: "DRAFT" }, after: { status: "SENT", totalCents: sent.totalCents } });

    await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver como clienta/ })).toHaveAttribute("href", new RegExp(`/cotizacion/${sent.publicToken}$`));
    const anon = await anonPage();
    await gotoReady(anon, `/cotizacion/${sent.publicToken}`);
    await expect(anon.getByRole("heading", { level: 1, name: sent.title })).toBeVisible();
    await expect(anon.getByText(formatMXN(sent.totalCents)).first()).toBeVisible();
    await expect(anon.getByText("Margen")).toHaveCount(0); // el público nunca ve márgenes
  });

  test("[QUO-020] no se envía sin fecha del evento ni con fecha pasada; queda en borrador y sin notificaciones", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización sin fecha › Enviar · sendQuoteAction con fecha pasada");
    const api = await apiAs("owner");
    const noDate = await draftFor(api, db, { eventDate: "" });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${noDate.id}`);
    await page.getByRole("button", { name: "Enviar a la clienta" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Antes de enviar agrega la fecha del evento en Datos de la propuesta.");
    await dialog.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Agrega la fecha del evento antes de enviar")).toBeVisible();
    expect((await db.quote.findUniqueOrThrow({ where: { id: noDate.id } })).status).toBe("DRAFT");

    const past = await draftFor(api, db, { eventDate: dateKeyFromToday(-2) });
    const r = await callAction(api, "quotes", "sendQuoteAction", { quoteId: past.id }, { params: { id: past.id } });
    expect(r.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", error: "La fecha del evento ya pasó; actualízala antes de enviar" });
    expect((await db.quote.findUniqueOrThrow({ where: { id: past.id } })).status).toBe("DRAFT");
    expect(await db.notificationLog.count({ where: { quoteId: { in: [noDate.id, past.id] } } })).toBe(0);
  });

  test("[QUO-021] reenviar una cotización enviada, aceptada o rechazada da CONFLICT y no notifica de nuevo", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "sendQuoteAction sobre SENT / ACCEPTED / REJECTED");
    const api = await apiAs("owner");
    for (const status of ["SENT", "ACCEPTED", "REJECTED"] as const) {
      const q = await draftFor(api, db);
      await sendQuoteViaAction(api, q.id);
      if (status !== "SENT") await db.quote.update({ where: { id: q.id }, data: { status } });
      const notesBefore = await db.notificationLog.count({ where: { quoteId: q.id } });
      const r = await callAction(api, "quotes", "sendQuoteAction", { quoteId: q.id }, { params: { id: q.id } });
      expect(r.result, status).toMatchObject({ ok: false, code: "CONFLICT", error: "Esta cotización ya fue enviada o cerrada." });
      expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe(status);
      expect(await db.notificationLog.count({ where: { quoteId: q.id } })).toBe(notesBefore);
    }
    const nf = await callAction(api, "quotes", "sendQuoteAction", { quoteId: "ckzzzzzzzzzzzzzzzzzzzzzz" }, { params: { id: "ckzzzzzzzzzzzzzzzzzzzzzz" } });
    expect(nf.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  test("[QUO-037] el detalle muestra historial (auditoría) y notificaciones enviadas", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización enviada › Seguimiento / Notificaciones / Historial");
    const api = await apiAs("owner");
    const q = await draftFor(api, db);
    await sendQuoteViaAction(api, q.id);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    const hist = page.getByRole("region", { name: "Historial" });
    await expect(hist.getByText("Enviada a la clienta")).toBeVisible();
    await expect(hist.getByText("Cotización creada")).toBeVisible();
    await expect(hist.getByText(ACCOUNTS.owner.email).first()).toBeVisible();
    const notif = page.getByRole("region", { name: "Notificaciones" });
    await expect(notif.getByText("Cotización enviada")).toHaveCount(2);
    await expect(notif.getByText(q.customer.email!, { exact: false })).toBeVisible();
    const seg = page.getByRole("region", { name: "Seguimiento" });
    await expect(seg.getByText("Enviada", { exact: true })).toBeVisible();
  });
});

test.describe("Cotizaciones · estados", { tag: ["@module:quotes"] }, () => {
  test("[QUO-022] marcar expirada y reactivar/reenviar con nueva vigencia", { tag: ["@P1"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Marcar expirada › Reactivar y reenviar");
    const api = await apiAs("owner");
    const q = await draftFor(api, db);
    await sendQuoteViaAction(api, q.id);
    const token = (await db.quote.findUniqueOrThrow({ where: { id: q.id } })).publicToken;
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await page.getByRole("button", { name: "Marcar expirada" }).click();
    await page.getByRole("alertdialog", { name: "¿Marcar la propuesta como expirada?" }).getByRole("button", { name: "Marcar expirada" }).click();
    await expect(page.getByText("Propuesta marcada como expirada")).toBeVisible();
    let row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.status).toBe("EXPIRED");
    expect(row.expiredAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: q.id, action: "quote.expired" } })).toBe(1);
    const anon = await anonPage();
    await gotoReady(anon, `/cotizacion/${token}`);
    await expect(anon.getByRole("heading", { level: 1, name: "Esta propuesta expiró" })).toBeVisible();

    // Simula vigencia vencida para comprobar que el reenvío la renueva
    await db.quote.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 86_400_000) } });
    await page.reload();
    await page.getByRole("button", { name: "Reactivar y reenviar" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("La vigencia se renovará");
    await dialog.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Propuesta enviada")).toBeVisible();
    row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row).toMatchObject({ status: "SENT", expiredAt: null });
    expect(row.validUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(await db.notificationLog.count({ where: { quoteId: q.id, type: "QUOTE_SENT" } })).toBe(4);
  });

  test("[QUO-023] sólo las enviadas pueden marcarse expiradas (borrador/expirada/aceptada → CONFLICT)", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "markQuoteExpiredAction sobre DRAFT / EXPIRED / ACCEPTED");
    const api = await apiAs("owner");
    for (const status of ["DRAFT", "EXPIRED", "ACCEPTED"] as const) {
      const q = await draftFor(api, db);
      if (status !== "DRAFT") await db.quote.update({ where: { id: q.id }, data: { status } });
      const r = await callAction(api, "quotes", "markQuoteExpiredAction", { quoteId: q.id }, { params: { id: q.id } });
      expect(r.result, status).toMatchObject({ ok: false, code: "CONFLICT", error: "Sólo las cotizaciones enviadas pueden marcarse como expiradas." });
      expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe(status);
    }
  });

  test("[QUO-024] duplicar crea un borrador nuevo (código y token propios) con los mismos conceptos y totales", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización enviada con descuento › Duplicar");
    const api = await apiAs("owner");
    const lead = await createLead(db, { name: uniq("Lead Duplicar") });
    const q = await createQuoteViaAction(api, db, { customerId: lead.customerId!, leadId: lead.id, addOns: [{ slug: "pastel-personalizado", quantity: 1 }] });
    const payload = await pricingPayload(db, q.id, { discount: { type: "PERCENT", value: 500, reason: "Promo" } });
    expect((await callAction(api, "quotes", "saveQuotePricingAction", payload, { params: { id: q.id } })).result?.ok).toBe(true);
    await sendQuoteViaAction(api, q.id);
    const source = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await page.getByRole("button", { name: "Duplicar" }).click();
    await expect(page.getByText("Cotización duplicada")).toBeVisible();
    await page.waitForURL((u) => u.pathname.startsWith("/admin/quotes/") && !u.pathname.endsWith(q.id));
    const copyId = new URL(page.url()).pathname.split("/").pop()!;
    const copy = await db.quote.findUniqueOrThrow({ where: { id: copyId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    expect(copy).toMatchObject({
      status: "DRAFT",
      version: 1,
      title: `${source.title} (copia)`,
      leadId: lead.id,
      customerId: source.customerId,
      totalCents: source.totalCents,
      subtotalCents: source.subtotalCents,
      discountType: "PERCENT",
      discountValue: 500,
      discountCents: source.discountCents,
      sentAt: null,
    });
    expect(copy.code).not.toBe(source.code);
    expect(copy.publicToken).not.toBe(source.publicToken);
    expect(copy.items.map((i) => [i.type, i.quantity, i.unitPriceCents, i.totalPriceCents])).toEqual(source.items.map((i) => [i.type, i.quantity, i.unitPriceCents, i.totalPriceCents]));
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: copyId, action: "quote.duplicated" } });
    expect(audit.before).toMatchObject({ sourceId: source.id, sourceCode: source.code });
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("SENT");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${source.title} (copia)`);
  });

  test("[QUO-025] nueva versión: vuelve a borrador con versión +1, mismo token y el enlace público deja de funcionar", { tag: ["@P1"] }, async ({ rolePage, anonPage, apiAs, db, evidence, guard }) => {
    evidence("owner", "Cotización enviada › Crear nueva versión · anónima abre el enlace");
    // El enlace de un borrador responde 404 real (es lo que se valida); el navegador lo registra en consola.
    guard.allow(/status of 404 \(Not Found\)/);
    const api = await apiAs("owner");
    const q = await draftFor(api, db);
    await sendQuoteViaAction(api, q.id);
    const token = (await db.quote.findUniqueOrThrow({ where: { id: q.id } })).publicToken;
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await page.getByRole("button", { name: "Crear nueva versión" }).click();
    const dialog = page.getByRole("alertdialog", { name: "¿Crear una nueva versión?" });
    await expect(dialog).toContainText("El enlace de la clienta dejará de funcionar hasta que la vuelvas a enviar.");
    await dialog.getByRole("button", { name: "Crear versión" }).click();
    await expect(page.getByText("Nueva versión en borrador")).toBeVisible();
    await expect(page.getByText("· versión 2")).toBeVisible();
    await expect(page.getByRole("region", { name: "Conceptos y precio" })).toBeVisible();
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect(row).toMatchObject({ status: "DRAFT", version: 2, publicToken: token });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: q.id, action: "quote.new_version" } });
    expect(audit).toMatchObject({ before: { status: "SENT", version: 1 }, after: { status: "DRAFT", version: 2 } });
    const anon = await anonPage();
    await gotoReady(anon, `/cotizacion/${token}`);
    await expect(anon.getByRole("heading", { level: 1, name: "No encontramos esta propuesta" })).toBeVisible();
    await gotoReady(page, `/admin/quotes?q=${encodeURIComponent(row.code)}`);
    await expect(page.getByRole("table", { name: "Listado de cotizaciones" }).getByText("v2")).toBeVisible();
  });

  test("[QUO-026] nueva versión sobre borrador o aceptada se rechaza (máquina de estados)", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createNewVersionAction sobre DRAFT / ACCEPTED");
    const api = await apiAs("owner");
    for (const status of ["DRAFT", "ACCEPTED"] as const) {
      const q = await draftFor(api, db);
      if (status === "ACCEPTED") await db.quote.update({ where: { id: q.id }, data: { status } });
      const r = await callAction(api, "quotes", "createNewVersionAction", { quoteId: q.id }, { params: { id: q.id } });
      expect(r.result, status).toMatchObject({ ok: false, code: "CONFLICT", error: "Sólo se puede crear una nueva versión de cotizaciones enviadas, expiradas o rechazadas." });
      expect(await db.quote.findUniqueOrThrow({ where: { id: q.id } })).toMatchObject({ status, version: 1 });
    }
  });

  test("[QUO-027] una cotización enviada es de sólo lectura: sin editor en la UI y el servidor rechaza cambios", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización enviada › UI · saveQuotePricingAction / updateQuoteDetailsAction / buildCatalogLineAction");
    const api = await apiAs("owner");
    const q = await draftFor(api, db);
    const payload = await pricingPayload(db, q.id, { discount: { type: "PERCENT", value: 5000, reason: "intento" } });
    await sendQuoteViaAction(api, q.id);
    const snap = await quoteState(db, q.id);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await expect(page.getByText("Esta propuesta ya se envió. Para cambiar conceptos o precios crea una nueva versión.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Conceptos y precio" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Guardar datos" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Conceptos" })).toBeVisible();
    const msg = "Sólo puedes editar borradores. Crea una nueva versión para hacer cambios.";
    for (const [name, args] of [
      ["saveQuotePricingAction", payload],
      ["previewQuotePricingAction", payload],
      ["updateQuoteDetailsAction", { quoteId: q.id, title: "Cambiado", guestCount: 20 }],
      ["buildCatalogLineAction", { quoteId: q.id, kind: "EXTRA_GUEST", units: 2 }],
    ] as const) {
      const r = await callAction(api, "quotes", name, args, { params: { id: q.id } });
      expect(r.result, name).toMatchObject({ ok: false, code: "CONFLICT", error: msg });
    }
    expect(await quoteState(db, q.id)).toEqual(snap);
  });

  test("[QUO-028] una cotización aceptada no ofrece enviar, expirar ni nueva versión", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización aceptada › acciones disponibles");
    const api = await apiAs("owner");
    const q = await draftFor(api, db);
    await sendQuoteViaAction(api, q.id);
    await db.quote.update({ where: { id: q.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await expect(page.getByText("Propuesta aceptada: es de sólo lectura.", { exact: false })).toBeVisible();
    const actions = page.getByRole("group", { name: "Acciones de la cotización" });
    await expect(actions.getByRole("button", { name: /Enviar a la clienta|Reactivar y reenviar/ })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: "Marcar expirada" })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: "Crear nueva versión" })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: "Duplicar" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Vista para imprimir" })).toHaveAttribute("href", `/admin/quotes/${q.id}/print`);
  });

  test("[QUO-029] vista de impresión: datos y totales de la base, sin costos, márgenes ni notas internas", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotización › Vista para imprimir");
    const api = await apiAs("owner");
    const q = await draftFor(api, db, { addOns: [{ slug: "mimosa-bar", quantity: 1 }], areaSlug: "polanco", notesForCustomer: "Incluye montaje 1 h antes.", internalNotes: "NOTA INTERNA: margen bajo, no compartir" });
    const row = await db.quote.findUniqueOrThrow({ where: { id: q.id }, include: { items: true, customer: true } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/quotes/${q.id}`);
    await page.getByRole("link", { name: "Vista para imprimir" }).click();
    await page.waitForURL(new RegExp(`/admin/quotes/${q.id}/print$`));
    const sheet = page.getByRole("article");
    await expect(sheet.getByText(row.code, { exact: true })).toBeVisible();
    await expect(sheet.getByText("Versión 1")).toBeVisible();
    await expect(sheet.getByText(row.customer.name, { exact: true })).toBeVisible();
    for (const item of row.items) {
      await expect(sheet.getByRole("row", { name: new RegExp(item.description.replace(/[()]/g, ".")) })).toContainText(formatMXN(item.totalPriceCents));
    }
    await expect(sheet.getByText(formatMXN(row.totalCents), { exact: true }).first()).toBeVisible();
    await expect(sheet.getByText(`Anticipo para apartar (50%)`)).toBeVisible();
    await expect(sheet.getByText("Incluye montaje 1 h antes.")).toBeVisible();
    await expect(page.getByText("Es un borrador: los montos pueden cambiar antes de enviarla.")).toBeVisible();
    const text = await sheet.innerText();
    expect(text).not.toContain("NOTA INTERNA");
    expect(text).not.toMatch(/Margen|Costo estimado|Rentabilidad/);
    await page.getByRole("link", { name: "Volver a la cotización" }).click();
    await page.waitForURL(new RegExp(`/admin/quotes/${q.id}$`));
  });

  test("[QUO-030] detalle e impresión de una cotización inexistente muestran 'No encontramos este registro'", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/quotes/<id inexistente>(/print)");
    const page = await rolePage("owner");
    for (const url of ["/admin/quotes/ckzzzzzzzzzzzzzzzzzzzzzzz", "/admin/quotes/ckzzzzzzzzzzzzzzzzzzzzzzz/print", `/admin/quotes/${"x".repeat(70)}`]) {
      await gotoReady(page, url);
      await expect(page.getByRole("heading", { name: "No encontramos este registro" }), url).toBeVisible();
    }
  });

  test("[QUO-031] crear cotización desde un lead PERDIDO: la UI no lo ofrece", { tag: ["@P3"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead perdido › sin 'Crear cotización'");
    const lead = await createLead(db, { name: uniq("Lead Perdido Cot"), status: "LOST", lostReason: "Sin respuesta" });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await expect(page.getByRole("link", { name: "Crear cotización" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Nueva versión" })).toHaveCount(0);
    await expect(page.getByText("Aún no hay cotizaciones para este lead.")).toBeVisible();
    void waitForDetail;
  });
});
