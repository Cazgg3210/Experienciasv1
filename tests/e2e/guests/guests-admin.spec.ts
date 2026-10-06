/**
 * Invitadas (admin): alta/edición/baja, duplicados, validación, CSV, recordatorios RSVP,
 * moderación de mensajes para la homenajeada y autorización.
 * Paquete 4 · carril 4 · prefijo GST.
 */
import { expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  callAction,
  createEventFixture,
  createGuestFixture,
  describe as d,
  lastAudit,
  waitHydrated,
} from "../events/_helpers";

async function openGuests(page: Page, eventId: string) {
  await page.goto(`/admin/events/${eventId}/guests`);
  await expect(page.getByRole("heading", { level: 2, name: "Invitadas y RSVP" })).toBeVisible();
  const section = page.getByRole("region", { name: "Lista de invitadas" });
  await waitHydrated(section.getByRole("button").first());
  return section;
}

test.describe("Invitadas · admin", { tag: ["@module:guests"] }, () => {
  test("[GST-001] agregar una invitada desde el admin genera su link personal y persiste", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Evento › Invitadas › Agregar invitada");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const name = `Renata ${uniq("Adm")}`;
    const email = uniqEmail("renata");
    const page = await rolePage("owner");
    const section = await openGuests(page, ev.id);
    await section.getByRole("button", { name: /Agregar la primera|Agregar invitada/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Agregar invitada" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await dialog.getByLabel("Correo").fill(email.toUpperCase());
    await dialog.getByRole("button", { name: "Agregar invitada" }).click();
    await expect(page.getByText("Invitada agregada")).toBeVisible();
    const guest = await db.eventGuest.findFirst({ where: { eventId: ev.id, name } });
    expect(guest).toMatchObject({ source: "ADMIN", rsvpStatus: "PENDING", email, respondedAt: null });
    expect(guest?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await page.reload();
    const table = page.getByRole("table", { name: "Invitadas del evento" });
    await expect(table.getByRole("row", { name: new RegExp(name) })).toContainText("Pendiente");
    const anon = await anonPage();
    const res = await anon.goto(`/e/${ev.micrositeSlug}/${guest!.token}`);
    expect(res?.status()).toBe(200);
    await expect(anon.getByRole("heading", { name: new RegExp(`${name.split(" ")[0]}, ¿nos acompañas\\?`) })).toBeVisible();
  });

  test("[GST-002] editar asistencia, acompañante y restricciones actualiza el resumen y audita el cambio de RSVP", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Invitadas › Editar a … › Asiste + acompañante + Vegana");
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 12 });
    const g = await createGuestFixture(db, ev, { name: `Mónica ${uniq("Ed")}` });
    const page = await rolePage("owner");
    const section = await openGuests(page, ev.id);
    await section.getByRole("button", { name: `Editar a ${g.name}` }).click();
    const dialog = page.getByRole("dialog", { name: `Editar a ${g.name}` });
    await dialog.getByRole("combobox", { name: "Asistencia" }).selectOption("ATTENDING");
    await dialog.getByRole("switch", { name: "Viene con acompañante" }).click();
    await dialog.getByLabel("Nombre del acompañante").fill("Jorge");
    await dialog.getByRole("checkbox", { name: "Vegana" }).check();
    await dialog.getByLabel("Notas alimentarias").fill("Sin miel");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Invitada actualizada")).toBeVisible();
    const after = await db.eventGuest.findUnique({ where: { id: g.id } });
    expect(after).toMatchObject({ rsvpStatus: "ATTENDING", plusOne: true, plusOneName: "Jorge", dietaryRestrictions: ["VEGAN"], dietaryNotes: "Sin miel" });
    expect(after?.respondedAt).not.toBeNull();
    const audit = await lastAudit(db, "guest.rsvp_changed", g.id);
    expect(audit?.before).toMatchObject({ rsvpStatus: "PENDING" });
    expect(audit?.after).toMatchObject({ rsvpStatus: "ATTENDING", eventId: ev.id });
    await page.reload();
    // 1 confirmada + acompañante = 2 personas esperadas
    await expect(page.getByText("2 confirmadas de 12 planeadas.")).toBeVisible();
    await expect(page.getByRole("table", { name: "Invitadas del evento" }).getByRole("row", { name: new RegExp(g.name) })).toContainText("Asiste");
  });

  test("[GST-003] quitar una invitada la elimina, audita y desactiva su link personal", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, guard, evidence }) => {
    evidence("owner", "Invitadas › Eliminar a … › Quitar invitada");
    guard.allow(/status of 404/); // el link de la invitada eliminada debe responder 404
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const g = await createGuestFixture(db, ev, { name: `Borrar ${uniq("Del")}` });
    const page = await rolePage("owner");
    const section = await openGuests(page, ev.id);
    await section.getByRole("button", { name: `Eliminar a ${g.name}` }).click();
    await page.getByRole("alertdialog", { name: `¿Quitar a ${g.name}?` }).getByRole("button", { name: "Quitar invitada" }).click();
    await expect(page.getByText(`${g.name} se quitó de la lista`)).toBeVisible();
    expect(await db.eventGuest.count({ where: { id: g.id } })).toBe(0);
    const audit = await lastAudit(db, "guest.deleted", g.id);
    expect(audit?.before).toMatchObject({ name: g.name, eventId: ev.id });
    const anon = await anonPage();
    expect((await anon.goto(g.path))?.status()).toBe(404);
    await page.reload();
    await expect(page.getByText(g.name)).toHaveCount(0);
  });

  test("[GST-004] contacto duplicado: aviso confirmable antes de guardar a otra persona con el mismo correo", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Agregar invitada con correo ya registrado › Es otra persona, guardar");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const email = uniqEmail("familia");
    const first = await createGuestFixture(db, ev, { name: "Mamá Familia", email });
    const page = await rolePage("owner");
    const section = await openGuests(page, ev.id);
    await section.getByRole("button", { name: "Agregar invitada" }).click();
    const dialog = page.getByRole("dialog", { name: "Agregar invitada" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill("Hija Familia");
    await dialog.getByLabel("Correo").fill(email);
    await dialog.getByRole("button", { name: "Agregar invitada" }).click();
    const warn = dialog.getByRole("alert").filter({ hasText: "Parece que esta invitada ya está en la lista" });
    await expect(warn).toBeVisible();
    await expect(dialog.getByText(`${first.name} ya está en la lista con este correo.`)).toBeVisible();
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(1);
    await warn.getByRole("button", { name: "Es otra persona, guardar" }).click();
    await expect(page.getByText("Invitada agregada")).toBeVisible();
    expect(await db.eventGuest.count({ where: { eventId: ev.id, email } })).toBe(2);
  });

  test("[GST-005] validaciones de invitada en el formulario y en el backend (incluye IDOR de invitada)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Agregar invitada sin nombre/correo inválido + saveGuestAction/deleteGuestAction directos");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const other = await createEventFixture(db, { status: "CONFIRMED" });
    const foreign = await createGuestFixture(db, other, { name: "Invitada Ajena" });
    const page = await rolePage("owner");
    const section = await openGuests(page, ev.id);
    await section.getByRole("button", { name: /Agregar la primera|Agregar invitada/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Agregar invitada" });
    await dialog.getByLabel("Correo").fill("correo-malo");
    await dialog.getByLabel("WhatsApp").fill("123");
    await dialog.getByRole("button", { name: "Agregar invitada" }).click();
    await expect(dialog.getByText("Escribe el nombre")).toBeVisible();
    await expect(dialog.getByText("Correo inválido")).toBeVisible();
    await expect(dialog.getByText("Teléfono de al menos 10 dígitos")).toBeVisible();

    const api = await apiAs("owner");
    const path = `/admin/events/${ev.id}/guests`;
    const base = { eventId: ev.id, guestId: "", name: "Válida", email: "", phone: "", rsvpStatus: "PENDING", plusOne: false, plusOneName: "", dietaryRestrictions: [], dietaryNotes: "", comment: "" };
    const plus = await callAction(api, "saveGuestAction", { ...base, plusOneName: "Fantasma" }, { path });
    expect(plus.fieldErrors?.plusOneName?.[0], d(plus)).toBe("Activa el acompañante o borra el nombre");
    const diet = await callAction(api, "saveGuestAction", { ...base, dietaryRestrictions: ["CARNIVORE"] }, { path });
    expect(diet.code, d(diet)).toBe("VALIDATION_ERROR");
    const status = await callAction(api, "saveGuestAction", { ...base, rsvpStatus: "MAYBE_NOT" }, { path });
    expect(status.code, d(status)).toBe("VALIDATION_ERROR");
    // IDOR: editar/borrar una invitada de otro evento pasando este eventId
    const editForeign = await callAction(api, "saveGuestAction", { ...base, guestId: foreign.id, name: "Secuestrada" }, { path });
    expect(editForeign.code, d(editForeign)).toBe("NOT_FOUND");
    const delForeign = await callAction(api, "deleteGuestAction", { eventId: ev.id, guestId: foreign.id }, { path });
    expect(delForeign.code, d(delForeign)).toBe("NOT_FOUND");
    expect(await db.eventGuest.findUnique({ where: { id: foreign.id } })).toMatchObject({ name: "Invitada Ajena", eventId: other.id });
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(0);
  });

  test("[GST-006] exportar CSV: contenido correcto, BOM, auditoría, fórmulas neutralizadas y acceso restringido", { tag: ["@P1", "@permissions"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Invitadas › Exportar CSV (/api/events/[id]/guests.csv) + anónimo/staff");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    await createGuestFixture(db, ev, { name: "Ana Csv", email: "ana.csv@e2e.ivonne-rosa.test", phone: "5512345678", rsvpStatus: "ATTENDING", plusOne: true, plusOneName: "Luis", dietaryRestrictions: ["VEGETARIAN", "GLUTEN_FREE"], comment: 'Dice "hola", y adiós' });
    await createGuestFixture(db, ev, { name: "=HYPERLINK(\"http://evil.example\")", phone: "+525512345678" });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}/guests`);
    await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute("href", `/api/events/${ev.id}/guests.csv`);

    const owner = await apiAs("owner");
    const res = await owner.get(`/api/events/${ev.id}/guests.csv`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toBe(`attachment; filename="invitadas-${ev.code}.csv"`);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const csv = await res.text();
    expect(csv.charCodeAt(0), "BOM UTF-8 para Excel").toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Nombre,Email,Teléfono,Estado,Acompañante,Nombre acompañante,Restricciones,Notas alimentarias,Comentario,Origen,Respondió");
    const ana = lines.find((l) => l.startsWith("Ana Csv"))!;
    expect(ana).toContain("ana.csv@e2e.ivonne-rosa.test,5512345678,Asiste,Sí,Luis,Vegetariana; Sin gluten,");
    expect(ana).toContain('"Dice ""hola"", y adiós"');
    expect(ana).toContain(",Anfitriona,");
    const evil = lines.find((l) => l.includes("HYPERLINK"))!;
    expect(evil.startsWith(`"'=HYPERLINK(""http://evil.example"")"`), evil).toBe(true);
    test.info().annotations.push({ type: "observación", description: `teléfono con +: ${evil.split(",")[2]}` });
    expect(lines.filter((l) => l.trim()).length).toBe(3);
    expect(await db.auditLog.count({ where: { action: "guests.exported", entityId: ev.id } })).toBe(1);

    const anon = await apiAs(null);
    const r401 = await anon.get(`/api/events/${ev.id}/guests.csv`);
    expect(r401.status()).toBe(401);
    expect(await r401.text()).not.toContain("Ana Csv");
    const staff = await apiAs("staff");
    const r403 = await staff.get(`/api/events/${ev.id}/guests.csv`);
    expect(r403.status()).toBe(403);
    expect(await r403.text()).not.toContain("Ana Csv");
    const r404 = await owner.get(`/api/events/ckeventoinexistente000001/guests.csv`);
    expect(r404.status()).toBe(404);
  });

  test("[GST-007] recordatorio RSVP a pendientes: notificaciones por canal, auditoría y un solo envío por día", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Invitadas › Enviar recordatorio a pendientes (2 veces)");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const withEmail = await createGuestFixture(db, ev, { name: "Pendiente Correo", email: uniqEmail("pend") });
    const withPhone = await createGuestFixture(db, ev, { name: "Pendiente Tel", phone: uniqPhone() });
    await createGuestFixture(db, ev, { name: "Pendiente Sin Contacto" });
    await createGuestFixture(db, ev, { name: "Ya Confirmada", email: uniqEmail("conf"), rsvpStatus: "ATTENDING" });
    const page = await rolePage("owner");
    await openGuests(page, ev.id);
    const send = page.getByRole("button", { name: "Enviar recordatorio a pendientes" });
    await waitHydrated(send);
    await send.click();
    const dialog = page.getByRole("alertdialog", { name: "¿Enviar recordatorio a pendientes?" });
    await expect(dialog).toContainText("a 2 invitadas pendientes");
    await dialog.getByRole("button", { name: "Enviar recordatorios" }).click();
    await expect(page.getByText("2 recordatorios enviados · 1 sin teléfono ni correo")).toBeVisible();
    const logs = await db.notificationLog.findMany({ where: { eventId: ev.id, type: "RSVP_REMINDER" } });
    expect(logs.map((l) => `${l.channel}:${l.dedupeKey?.split(":")[1]}`).sort()).toEqual([`EMAIL:${withEmail.id}`, `WHATSAPP:${withPhone.id}`].sort());
    expect(logs.find((l) => l.channel === "EMAIL")?.body).toContain(withEmail.token);
    expect(await db.auditLog.count({ where: { action: "event.rsvp_reminders_sent", entityId: ev.id } })).toBe(1);

    await send.click();
    await page.getByRole("alertdialog", { name: "¿Enviar recordatorio a pendientes?" }).getByRole("button", { name: "Enviar recordatorios" }).click();
    await expect(page.getByText("No se envió ningún recordatorio nuevo · 2 ya lo recibió hoy · 1 sin teléfono ni correo")).toBeVisible();
    expect(await db.notificationLog.count({ where: { eventId: ev.id, type: "RSVP_REMINDER" } }), "deduplicado por día").toBe(2);
    expect(await db.auditLog.count({ where: { action: "event.rsvp_reminders_sent", entityId: ev.id } })).toBe(1);
  });

  test("[GST-008] recordatorios bloqueados en eventos cancelados o con micrositio apagado (UI y backend)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Invitadas de evento CANCELLED / micrositio desactivado + sendRsvpRemindersAction directo");
    const cancelled = await createEventFixture(db, { status: "CANCELLED" });
    await createGuestFixture(db, cancelled, { name: "Pend Cancel", email: uniqEmail("c") });
    const off = await createEventFixture(db, { status: "CONFIRMED", micrositeEnabled: false });
    await createGuestFixture(db, off, { name: "Pend Off", email: uniqEmail("o") });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${cancelled.id}/guests`);
    await expect(page.getByRole("button", { name: "Enviar recordatorio a pendientes" })).toBeDisabled();
    await expect(page.getByText("El evento ya no admite recordatorios.")).toBeVisible();
    await page.goto(`/admin/events/${off.id}/guests`);
    await expect(page.getByText("Activa el micrositio (pestaña Resumen) para enviar recordatorios.")).toBeVisible();
    const api = await apiAs("owner");
    const r1 = await callAction(api, "sendRsvpRemindersAction", { eventId: cancelled.id }, { path: `/admin/events/${cancelled.id}/guests` });
    expect(r1.code, d(r1)).toBe("EVENT_CLOSED");
    const r2 = await callAction(api, "sendRsvpRemindersAction", { eventId: off.id }, { path: `/admin/events/${off.id}/guests` });
    expect(r2.code, d(r2)).toBe("MICROSITE_DISABLED");
    expect(await db.notificationLog.count({ where: { eventId: { in: [cancelled.id, off.id] }, type: "RSVP_REMINDER" } })).toBe(0);
  });

  test("[GST-009] ocultar y volver a mostrar un mensaje para la homenajeada (moderación auditada)", { tag: ["@P2"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Invitadas › Mensajes para la homenajeada › Ocultar / Mostrar");
    const ev = await createEventFixture(db, { status: "CONFIRMED", honoreeName: "Valentina" });
    const g = await createGuestFixture(db, ev, { name: "Autora Mensaje", rsvpStatus: "ATTENDING" });
    const msg = await db.eventMessage.create({ data: { eventId: ev.id, kind: "HONOREE", authorType: "GUEST", authorName: g.name, guestId: g.id, body: "¡Feliz cumpleaños, Vale!" } });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}/guests`);
    const section = page.getByRole("region", { name: "Mensajes para Valentina" });
    await expect(section).toContainText("¡Feliz cumpleaños, Vale!");
    const hide = section.getByRole("button", { name: `Ocultar mensaje de ${g.name}` });
    await waitHydrated(hide);
    await hide.click();
    await expect(page.getByText("Mensaje oculto")).toBeVisible();
    expect((await db.eventMessage.findUnique({ where: { id: msg.id } }))?.hidden).toBe(true);
    expect(await db.auditLog.count({ where: { action: "message.hidden", entityId: msg.id } })).toBe(1);
    const client = await anonPage();
    await client.goto(ev.portalPath);
    await expect(client.getByText(/Hay 1 mensaje para Valentina/)).toHaveCount(0);
    await section.getByRole("button", { name: `Mostrar mensaje de ${g.name}` }).click();
    await expect(page.getByText("Mensaje visible de nuevo")).toBeVisible();
    expect((await db.eventMessage.findUnique({ where: { id: msg.id } }))?.hidden).toBe(false);
    await client.reload();
    await expect(client.getByText(/Hay 1 mensaje para Valentina/)).toBeVisible();
  });

  test("[GST-010] staff y anónimo no gestionan invitadas aunque fuercen el request", { tag: ["@P1", "@permissions"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("staff", "UI /admin/events/[id]/guests + replay saveGuestAction / deleteGuestAction / sendRsvpRemindersAction");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const g = await createGuestFixture(db, ev, { name: "Protegida", email: uniqEmail("p") });
    const staff = await rolePage("staff");
    await staff.goto(`/admin/events/${ev.id}/guests`);
    await expect(staff).toHaveURL(/\/staff/);
    const path = `/admin/events/${ev.id}/guests`;
    for (const role of ["staff", null] as const) {
      const api = await apiAs(role);
      const save = await callAction(api, "saveGuestAction", { eventId: ev.id, guestId: g.id, name: "Hackeada", email: "", phone: "", rsvpStatus: "NOT_ATTENDING", plusOne: false, plusOneName: "", dietaryRestrictions: [], dietaryNotes: "", comment: "" }, { path });
      expect(save.outcome, `${role ?? "anónimo"}: ${d(save)}`).toBe("denied");
      const del = await callAction(api, "deleteGuestAction", { eventId: ev.id, guestId: g.id }, { path });
      expect(del.outcome, `${role ?? "anónimo"}: ${d(del)}`).toBe("denied");
      const rem = await callAction(api, "sendRsvpRemindersAction", { eventId: ev.id }, { path });
      expect(rem.outcome, `${role ?? "anónimo"}: ${d(rem)}`).toBe("denied");
    }
    expect(await db.eventGuest.findUnique({ where: { id: g.id } })).toMatchObject({ name: "Protegida", rsvpStatus: "PENDING" });
    expect(await db.notificationLog.count({ where: { eventId: ev.id } })).toBe(0);
  });
});
