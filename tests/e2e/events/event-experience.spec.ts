/**
 * Eventos (admin): enlaces privados (rotación de tokens), programa del evento (timeline),
 * conversación con la anfitriona, autorización y accesibilidad.
 * Paquete 4 · carril 4 · prefijo EVT.
 */
import { expect, scanA11y, test } from "../fixtures";
import {
  callAction,
  createEventFixture,
  createGuestFixture,
  describe as d,
  lastAudit,
  waitHydrated,
} from "./_helpers";

test.describe("Eventos · enlaces, programa y mensajes", { tag: ["@module:events"] }, () => {
  test("[EVT-031] rotar el enlace del portal invalida el anterior (404) y audita sin guardar el token completo", { tag: ["@P1", "@permissions"] }, async ({ rolePage, anonPage, db, guard, evidence }) => {
    evidence("owner", "Evento › Enlaces privados › Portal de la clienta › Rotar enlace");
    guard.allow(/status of 404/); // el enlace viejo debe responder 404
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}`);
    const panel = page.getByRole("region", { name: "Enlaces privados" });
    const rotate = panel.getByRole("button", { name: "Rotar enlace" }).first();
    await waitHydrated(rotate);
    await rotate.click();
    const dialog = page.getByRole("alertdialog", { name: "¿Generar un nuevo enlace de portal?" });
    await dialog.getByRole("button", { name: "Generar nuevo enlace" }).click();
    await expect(page.getByText(/Nuevo enlace generado/)).toBeVisible();
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after?.portalToken).not.toBe(ev.portalToken);
    expect(after?.inviteToken, "la invitación no cambia").toBe(ev.inviteToken);
    await expect(panel).toContainText(`/mi-evento/${after!.portalToken}`);
    const audit = await lastAudit(db, "event.token_rotated", ev.id);
    expect(audit?.before).toEqual({ kind: "portal", tokenEnding: ev.portalToken.slice(-4) });
    expect(JSON.stringify(audit)).not.toContain(after!.portalToken);

    const client = await anonPage();
    const old = await client.goto(ev.portalPath);
    expect(old?.status()).toBe(404);
    await expect(client.getByRole("heading", { name: "Este enlace no es válido" })).toBeVisible();
    const fresh = await client.goto(`/mi-evento/${after!.portalToken}`);
    expect(fresh?.status()).toBe(200);
    await expect(client.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
  });

  test("[EVT-032] rotar la invitación general invalida el link anterior pero no los links personales", { tag: ["@P1", "@permissions"] }, async ({ rolePage, anonPage, db, guard, evidence }) => {
    evidence("owner", "Evento › Enlaces privados › Invitación › Rotar enlace");
    guard.allow(/status of 404/);
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const guest = await createGuestFixture(db, ev, { name: "Paola Invitada" });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}`);
    const panel = page.getByRole("region", { name: "Enlaces privados" });
    const rotate = panel.getByRole("button", { name: "Rotar enlace" }).nth(1);
    await waitHydrated(rotate);
    await rotate.click();
    await page.getByRole("alertdialog", { name: "¿Generar un nuevo enlace de invitación?" }).getByRole("button", { name: "Generar nuevo enlace" }).click();
    await expect(page.getByText(/Nuevo enlace generado/)).toBeVisible();
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after?.inviteToken).not.toBe(ev.inviteToken);
    expect(after?.portalToken).toBe(ev.portalToken);
    const anon = await anonPage();
    expect((await anon.goto(ev.invitePath))?.status()).toBe(404);
    expect((await anon.goto(`/e/${ev.micrositeSlug}/${after!.inviteToken}`))?.status()).toBe(200);
    expect((await anon.goto(guest.path))?.status(), "el link personal sigue activo").toBe(200);
    await expect(anon.getByRole("heading", { name: /Paola, ¿nos acompañas\?/ })).toBeVisible();
  });

  test("[EVT-033] programa del evento: agregar, editar y eliminar momentos; sólo los visibles llegan al micrositio", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Evento › Programa del evento › Agregar momento (visible y sólo equipo) › editar › eliminar");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}`);
    const section = page.getByRole("region", { name: "Programa del evento" });
    await expect(section).toContainText("Aún no hay programa.");
    const add = section.getByRole("button", { name: "Agregar momento" });
    await waitHydrated(add);

    await add.click();
    let dialog = page.getByRole("dialog", { name: "Nuevo momento del programa" });
    await dialog.getByLabel("Hora").fill("11:30");
    await dialog.getByRole("textbox", { name: "Título", exact: true }).fill("Brindis de bienvenida");
    await dialog.getByLabel("Descripción").fill("Mimosas en la terraza");
    await dialog.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByText("Momento agregado")).toBeVisible();

    await add.click();
    dialog = page.getByRole("dialog", { name: "Nuevo momento del programa" });
    await dialog.getByLabel("Hora").fill("09:00");
    await dialog.getByRole("textbox", { name: "Título", exact: true }).fill("Montaje del equipo");
    await dialog.getByRole("checkbox", { name: "Visible para invitadas" }).uncheck();
    await dialog.getByRole("button", { name: "Agregar" }).click();
    await expect(section).toContainText("Montaje del equipo");
    await expect(section).toContainText("Sólo equipo");

    const items = await db.eventTimelineItem.findMany({ where: { eventId: ev.id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => [i.time, i.title, i.visibleToGuests])).toEqual([
      ["11:30", "Brindis de bienvenida", true],
      ["09:00", "Montaje del equipo", false],
    ]);

    const anon = await anonPage();
    await anon.goto(ev.invitePath);
    await expect(anon.getByText("Brindis de bienvenida")).toBeVisible();
    await expect(anon.getByText("Montaje del equipo")).toHaveCount(0);
    await anon.goto(ev.portalPath);
    const programa = anon.getByRole("region", { name: "Programa del día" });
    await expect(programa).toContainText("Montaje del equipo");
    await expect(programa).toContainText("Preparativos del equipo");

    // Editar y eliminar
    await section.getByRole("button", { name: "Editar Brindis de bienvenida" }).click();
    dialog = page.getByRole("dialog", { name: "Editar momento" });
    await dialog.getByRole("textbox", { name: "Título", exact: true }).fill("Brindis y fotos");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Momento actualizado")).toBeVisible();
    await expect.poll(async () => (await db.eventTimelineItem.findUnique({ where: { id: items[0]!.id } }))?.title).toBe("Brindis y fotos");
    await section.getByRole("button", { name: "Eliminar Montaje del equipo" }).click();
    await page.getByRole("alertdialog", { name: "¿Eliminar este momento?" }).getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Momento eliminado del programa")).toBeVisible();
    expect(await db.eventTimelineItem.count({ where: { id: items[1]!.id } })).toBe(0);
    await page.reload();
    await expect(page.getByRole("region", { name: "Programa del evento" })).not.toContainText("Montaje del equipo");
    await expect(page.getByRole("region", { name: "Programa del evento" })).toContainText("Brindis y fotos");
  });

  test("[EVT-034] programa: el backend no permite editar ni borrar momentos de otro evento (IDOR) ni títulos vacíos", { tag: ["@P2", "@negative", "@permissions"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "saveTimelineItemAction / deleteTimelineItemAction con itemId de otro evento");
    const a = await createEventFixture(db, { status: "CONFIRMED" });
    const b = await createEventFixture(db, { status: "CONFIRMED", timeline: [{ time: "12:00", title: "Pastel de B" }] });
    const itemB = await db.eventTimelineItem.findFirstOrThrow({ where: { eventId: b.id } });
    const api = await apiAs("owner");
    const path = `/admin/events/${a.id}`;
    const edit = await callAction(
      api,
      "saveTimelineItemAction",
      { eventId: a.id, itemId: itemB.id, time: "13:00", title: "Secuestrado", description: "", visibleToGuests: true, sortOrder: 10 },
      { path },
    );
    expect(edit.code, d(edit)).toBe("NOT_FOUND");
    expect(edit.error).toBe("Ese momento del programa ya no existe.");
    const del = await callAction(api, "deleteTimelineItemAction", { eventId: a.id, itemId: itemB.id }, { path });
    expect(del.code, d(del)).toBe("NOT_FOUND");
    const short = await callAction(
      api,
      "saveTimelineItemAction",
      { eventId: a.id, itemId: "", time: "25:00", title: "x", description: "", visibleToGuests: true, sortOrder: 10 },
      { path },
    );
    expect(Object.keys(short.fieldErrors ?? {}).sort(), d(short)).toEqual(["time", "title"]);
    const untouched = await db.eventTimelineItem.findUnique({ where: { id: itemB.id } });
    expect(untouched).toMatchObject({ title: "Pastel de B", time: "12:00", eventId: b.id });
    expect(await db.eventTimelineItem.count({ where: { eventId: a.id } })).toBe(0);
  });

  test("[EVT-035] mensaje del equipo a la clienta: queda en la conversación, la notifica y lo ve en su portal", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Evento › Conversación › Responder como el equipo › Enviar (avisar a la clienta)");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const body = `Hola, confirmamos el menú vegetariano ${Date.now()}`;
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}`);
    const thread = page.getByRole("region", { name: /Conversación con/ });
    const box = thread.getByLabel("Responder como el equipo");
    await waitHydrated(box);
    await box.fill(body);
    await expect(thread.getByRole("checkbox", { name: /Avisar a la clienta/ })).toBeChecked();
    await thread.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Mensaje enviado y clienta notificada")).toBeVisible();
    await expect(thread.getByRole("list", { name: "Mensajes" })).toContainText(body);
    const msg = await db.eventMessage.findFirst({ where: { eventId: ev.id, body } });
    expect(msg).toMatchObject({ kind: "HOST_THREAD", authorType: "ADMIN" });
    expect(msg?.authorName).toMatch(/^Equipo /);
    await expect
      .poll(() => db.notificationLog.count({ where: { eventId: ev.id, type: "GENERIC", channel: "EMAIL", subject: { contains: "Nuevo mensaje" } } }))
      .toBeGreaterThan(0);
    const client = await anonPage();
    await client.goto(ev.portalPath);
    await expect(client.getByRole("list", { name: "Mensajes con el equipo" })).toContainText(body);
  });

  test("[EVT-036] staff y anónimo: sin acceso a /admin/events y sin poder crear ni cancelar por request directo", { tag: ["@P0", "@permissions"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("staff", "UI /admin/events + replay de createEventAction y cancelEventAction");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const staff = await rolePage("staff");
    await staff.goto("/admin/events");
    await expect(staff).toHaveURL(/\/staff/);
    await staff.goto(`/admin/events/${ev.id}`);
    await expect(staff).toHaveURL(/\/staff/);
    const anon = await anonPage();
    await anon.goto(`/admin/events/${ev.id}`);
    await expect(anon).toHaveURL(new RegExp(`/login\\?callbackUrl=%2Fadmin%2Fevents%2F${ev.id}`));

    for (const role of ["staff", "staff2", null] as const) {
      const api = await apiAs(role);
      const cancel = await callAction(api, "cancelEventAction", { eventId: ev.id, reason: "Cancelación forzada", notifyCustomer: false }, { path: `/admin/events/${ev.id}` });
      expect(cancel.outcome, `${role ?? "anónimo"}: ${d(cancel)}`).toBe("denied");
      const rotate = await callAction(api, "rotateEventTokenAction", { eventId: ev.id, kind: "portal" }, { path: `/admin/events/${ev.id}` });
      expect(rotate.outcome, `${role ?? "anónimo"}: ${d(rotate)}`).toBe("denied");
    }
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after?.status).toBe("CONFIRMED");
    expect(after?.portalToken).toBe(ev.portalToken);
  });

  test("[EVT-037] accesibilidad (WCAG 2.1 AA) del listado, el alta y el detalle de evento", { tag: ["@P2", "@a11y"] }, async ({ rolePage, db, evidence }, testInfo) => {
    evidence("owner", "axe en /admin/events, /admin/events/new y /admin/events/[id]");
    test.info().annotations.push({ type: "bug", description: "EVX-BUG-04" });
    const ev = await createEventFixture(db, { status: "CONFIRMED", booking: { totalCents: 900_000, depositCents: 450_000 } });
    const page = await rolePage("owner");
    const found: string[] = [];
    for (const url of ["/admin/events", "/admin/events/new", `/admin/events/${ev.id}`]) {
      await page.goto(url);
      await expect(page.getByRole("main")).toBeVisible();
      const { blocking } = await scanA11y(page, testInfo);
      found.push(...blocking.map((v) => `${url}: ${v.id} (${v.impact}) ${v.help}`));
    }
    expect(found, found.join("\n")).toEqual([]);
  });
});
