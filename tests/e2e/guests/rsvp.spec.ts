/**
 * Micrositio de invitación y RSVP público (/e/[slug]/[token]): link personal y general, cambios de
 * respuesta, mensaje a la homenajeada, privacidad, calendario .ics, límites y tokens.
 * Paquete 4 · carril 4 · prefijo GST.
 */
import { expect, scanA11y, test, TOKENS, uniq, uniqEmail } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  callAction,
  createEventFixture,
  createGuestFixture,
  describe as d,
  expectGuardedBeforeHydration,
  fillBeforeHydration,
  fillGuestList,
  holdPageChunk,
  token,
  trySubmitBeforeHydration,
  waitHydrated,
  watchRequests,
} from "../events/_helpers";

async function openRsvp(page: Page, path: string) {
  await page.goto(path);
  const section = page.getByRole("region", { name: "Confirmación de asistencia" });
  await expect(section).toBeVisible();
  await waitHydrated(section.getByRole("button").first());
  return section;
}

/** Respuesta del link general cuando la lista llegó a su tope (src/features/guests/domain/rsvp.ts). */
const GENERAL_INVITE_FULL =
  "¡Gracias por querer acompañarnos! Este enlace ya no recibe más respuestas. Pídele a la anfitriona tu link personal y confirma desde ahí.";

function rsvpInput(slug: string, tk: string, patch: Record<string, unknown> = {}) {
  return {
    slug,
    token: tk,
    rsvp: {
      name: "Invitada Backend",
      email: "",
      rsvpStatus: "ATTENDING",
      plusOne: false,
      plusOneName: "",
      dietaryRestrictions: [],
      dietaryNotes: "",
      comment: "",
      honoreeMessage: "",
      photoConsent: false,
      ...patch,
    },
  };
}

test.describe("RSVP · invitada", { tag: ["@module:guests"] }, () => {
  test("[GST-011] confirmar asistencia con el link personal (acompañante y restricción) se refleja en admin y portal", { tag: ["@P0", "@critical", "@mobile", "@regression"] }, async ({ anonPage, rolePage, db, evidence }) => {
    evidence("invitada", "Link personal › ¡Sí, ahí estaré! › acompañante › Vegetariana › Enviar mi respuesta");
    test.info().annotations.push({ type: "regression", description: "BUG-006" }); // confirmación tras guardar (router.refresh en transición)
    const ev = await createEventFixture(db, { status: "CONFIRMED", addressLine: "Ámsterdam 210 depto 3" });
    const g = await createGuestFixture(db, ev, { name: `Daniela ${uniq("Rsvp")}`, email: uniqEmail("dani") });
    const page = await anonPage();
    const section = await openRsvp(page, g.path);
    await expect(page.getByText("Ámsterdam 210 depto 3"), "la dirección exacta no se muestra antes de confirmar").toHaveCount(0);
    await expect(section.getByRole("heading", { name: "Daniela, ¿nos acompañas?" })).toBeVisible();
    await section.getByText("¡Sí, ahí estaré!").click();
    await section.getByRole("checkbox", { name: "Voy con acompañante" }).check();
    await section.getByLabel("Nombre de tu acompañante").fill("Pau");
    await section.getByText("Vegetariana", { exact: true }).click();
    await section.getByRole("checkbox", { name: /Acepto aparecer en las fotos/ }).check();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByRole("heading", { name: "¡Gracias, Daniela! Te esperamos" })).toBeVisible();
    await expect(section).toContainText("Asiste · con acompañante (Pau) · Vegetariana");
    const after = await db.eventGuest.findUnique({ where: { id: g.id } });
    expect(after).toMatchObject({ rsvpStatus: "ATTENDING", plusOne: true, plusOneName: "Pau", dietaryRestrictions: ["VEGETARIAN"], photoConsent: true });
    expect(after?.respondedAt).not.toBeNull();
    await expect.poll(() => db.analyticsEvent.count({ where: { type: "RSVP_SUBMIT", eventId: ev.id } })).toBeGreaterThan(0);
    // Tras confirmar, la invitada ve la dirección exacta
    await page.reload();
    await expect(page.getByText("Ámsterdam 210 depto 3")).toBeVisible();
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/guests`);
    // Tabla en escritorio, tarjetas en móvil: se valida la fila/tarjeta visible de la invitada
    const item = owner
      .getByRole("table", { name: "Invitadas del evento" })
      .getByRole("row", { name: new RegExp(g.name) })
      .or(owner.getByRole("list", { name: "Invitadas del evento" }).getByRole("listitem").filter({ hasText: g.name }));
    await expect(item).toContainText("Asiste");
    const host = await anonPage();
    await host.goto(ev.portalPath);
    await expect(host.getByRole("region", { name: "Invitadas" })).toContainText("1 confirmadas de 1 invitadas");
  });

  test("[GST-012] declinar y luego cambiar la respuesta con «Editar mi respuesta»", { tag: ["@P1", "@mobile", "@regression"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "Link personal › No podré ir › Editar mi respuesta › Tal vez");
    test.info().annotations.push({ type: "regression", description: "BUG-006" }); // confirmación tras guardar (router.refresh en transición)
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const g = await createGuestFixture(db, ev, { name: `Sara ${uniq("Rsvp")}` });
    const page = await anonPage();
    const section = await openRsvp(page, g.path);
    await section.getByText("No podré ir").click();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByRole("heading", { name: "Te vamos a extrañar" })).toBeVisible();
    expect((await db.eventGuest.findUnique({ where: { id: g.id } }))?.rsvpStatus).toBe("NOT_ATTENDING");
    await section.getByRole("button", { name: "Editar mi respuesta" }).click();
    await section.getByText("Tal vez", { exact: true }).click();
    await section.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(section.getByRole("heading", { name: "¡Gracias, Sara! Ojalá puedas acompañarnos" })).toBeVisible();
    expect((await db.eventGuest.findUnique({ where: { id: g.id } }))?.rsvpStatus).toBe("MAYBE");
    await page.reload();
    await expect(page.getByRole("region", { name: "Confirmación de asistencia" })).toContainText("Tal vez");
  });

  test("[GST-027] editar la respuesta sin cambiar «No podré ir» guarda aunque las notas para la cocina sigan ocultas", { tag: ["@P1", "@regression"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "Link personal (ya respondió «No podré ir») › Editar mi respuesta › comentario › Guardar cambios");
    // Con «No podré ir» las notas para la cocina no se montan: el formulario debe seguir siendo válido sin ellas.
    // Tras quitar los textos vacíos de defaultValues (GST-026), sólo los campos que pueden empezar ocultos conservan su "".
    test.info().annotations.push({ type: "regression", description: "GST-026: defaults del RSVP sin textos vacíos; los campos ocultos siguen válidos" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const g = await createGuestFixture(db, ev, { name: `Lorena ${uniq("Edit")}`, rsvpStatus: "NOT_ATTENDING", comment: "Estaré de viaje" });
    const page = await anonPage();
    const section = await openRsvp(page, g.path);
    await section.getByRole("button", { name: "Editar mi respuesta" }).click();
    const comment = section.getByLabel("Comentario (opcional)");
    await expect(comment, "el comentario guardado se precarga").toHaveValue("Estaré de viaje");
    await expect(section.getByRole("textbox", { name: "Tu nombre" }), "el nombre guardado se precarga").toHaveValue(g.name);
    await expect(section.getByLabel("Alergias o notas para la cocina")).toHaveCount(0);
    await comment.fill("Estaré de viaje, ¡pero las quiero!");
    await section.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(section.getByRole("heading", { name: "Te vamos a extrañar" })).toBeVisible();
    await expect.poll(async () => (await db.eventGuest.findUnique({ where: { id: g.id } }))?.comment).toBe("Estaré de viaje, ¡pero las quiero!");
    expect(await db.eventGuest.findUnique({ where: { id: g.id } })).toMatchObject({ rsvpStatus: "NOT_ATTENDING", name: g.name });
  });

  test("[GST-013] con el link general una invitada nueva se registra sola y recibe su link personal", { tag: ["@P1"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "Link general › nombre nuevo › Enviar mi respuesta → redirección al link personal");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const name = `Fernanda ${uniq("Gen")}`;
    const page = await anonPage();
    const section = await openRsvp(page, ev.invitePath);
    await section.getByRole("textbox", { name: "Tu nombre" }).fill(name);
    await section.getByText("¡Sí, ahí estaré!").click();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect.poll(() => db.eventGuest.count({ where: { eventId: ev.id, name } })).toBe(1);
    const guest = await db.eventGuest.findFirstOrThrow({ where: { eventId: ev.id, name } });
    expect(guest).toMatchObject({ source: "SELF_RSVP", rsvpStatus: "ATTENDING" });
    await page.waitForURL(new RegExp(`/e/${ev.micrositeSlug}/${guest.token}`));
    await expect(page.getByRole("heading", { name: "¡Gracias, Fernanda! Te esperamos" })).toBeVisible();
    const host = await anonPage();
    await host.goto(ev.portalPath);
    const list = host.getByRole("list", { name: "Lista de invitadas" });
    await expect(list).toContainText(name);
    await expect(list).toContainText("Confirmó con la invitación general");
  });

  test("[GST-026] lo que la invitada escribe antes de que la página hidrate no se borra y se guarda con su respuesta", { tag: ["@P0", "@regression", "@mobile"] }, async ({ anonPage, db, evidence, browserName }) => {
    evidence("invitada", "Link general con el JS de la página retenido › nombre, alergias, mensaje, comentario y email › hidrata › ¡Sí, ahí estaré! › Enviar mi respuesta");
    // react-hook-form con defaultValues "" escribía "" en el DOM al registrar cada campo durante la hidratación:
    // en un celular lento se borraba lo ya escrito (el mismo defecto que CRIT-008 en la cápsula).
    test.info().annotations.push({ type: "regression", description: "texto escrito antes de hidratar se borraba (react-hook-form + defaultValues \"\")" });
    const ev = await createEventFixture(db, { status: "CONFIRMED", honoreeName: "Regina" });
    const name = `Ximena ${uniq("PreHidr")}`;
    const email = uniqEmail("ximena");
    const notes = `Alergia a la nuez ${uniq("n")}`;
    const honoree = `¡Que cumplas muchos más, Regi! ${uniq("m")}`;
    const comment = `Llego un poco tarde ${uniq("c")}`;
    const page = await anonPage();
    // Celular lento simulado de forma determinista: el chunk de la página (el formulario de RSVP) no llega
    // hasta que la invitada ya escribió; el resto de la app sí carga.
    const held = await holdPageChunk(page, "(experience)/e/[slug]/[token]");
    await page.goto(ev.invitePath, { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    // Antes de hidratar, en WebKit el formulario (segmento en streaming) existe pero sigue oculto: ver fillBeforeHydration.
    const before = page.getByRole("region", { name: "Confirmación de asistencia", includeHidden: true });
    await fillBeforeHydration(before.getByRole("textbox", { name: "Tu nombre", includeHidden: true }), name, browserName);
    await fillBeforeHydration(before.getByLabel("Alergias o notas para la cocina"), notes, browserName);
    await fillBeforeHydration(before.getByLabel("Mensaje para Regina"), honoree, browserName);
    await fillBeforeHydration(before.getByLabel("Comentario (opcional)"), comment, browserName);
    await fillBeforeHydration(before.getByLabel("Tu email (opcional)"), email, browserName);

    held.release();
    const section = page.getByRole("region", { name: "Confirmación de asistencia" });
    const fields = {
      name: section.getByRole("textbox", { name: "Tu nombre" }),
      notes: section.getByLabel("Alergias o notas para la cocina"),
      honoree: section.getByLabel("Mensaje para Regina"),
      comment: section.getByLabel("Comentario (opcional)"),
      email: section.getByLabel("Tu email (opcional)"),
    };
    await waitHydrated(section.getByRole("button", { name: "Enviar mi respuesta" }));
    // Elegir la respuesta ya pasa por React: cuando aparece «Voy con acompañante», la hidratación terminó y el
    // formulario ya registró sus campos (ahí es donde se borraban).
    await section.getByText("¡Sí, ahí estaré!").click();
    await expect(section.getByRole("checkbox", { name: "Voy con acompañante" })).toBeVisible();
    await expect(fields.name).toHaveValue(name);
    await expect(fields.notes).toHaveValue(notes);
    await expect(fields.honoree).toHaveValue(honoree);
    await expect(fields.comment).toHaveValue(comment);
    await expect(fields.email).toHaveValue(email);
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect.poll(() => db.eventGuest.count({ where: { eventId: ev.id, name } })).toBe(1);
    const guest = await db.eventGuest.findFirstOrThrow({ where: { eventId: ev.id, name } });
    expect(guest).toMatchObject({ source: "SELF_RSVP", rsvpStatus: "ATTENDING", email, dietaryNotes: notes, comment });
    const sent = await db.eventMessage.findMany({ where: { eventId: ev.id, kind: "HONOREE", guestId: guest.id } });
    expect(sent.map((m) => m.body)).toEqual([honoree]);
    await page.waitForURL(new RegExp(`/e/${ev.micrositeSlug}/${guest.token}`));
    await expect(page.getByRole("heading", { name: "¡Gracias, Ximena! Te esperamos" })).toBeVisible();
  });

  test("[GST-028] antes de que la página hidrate el RSVP no se envía de forma nativa: el nombre y el correo de la invitada nunca terminan en la URL", { tag: ["@P1", "@regression", "@mobile"] }, async ({ anonPage, db, evidence, browserName }) => {
    evidence("invitada", "Link general con el JS de la página retenido › nombre y email › Enter y clic en «Enviar mi respuesta» › hidrata › ¡Sí, ahí estaré! › Enviar mi respuesta");
    // Sin method y con el botón activo antes de hidratar, el navegador enviaba el formulario por GET a la URL actual:
    // /e/…?name=…&email=… quedaba en el historial, en los logs del servidor y del proxy y en el Referer.
    test.info().annotations.push({ type: "regression", description: "envío nativo por GET antes de hidratar dejaba datos personales en la URL" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const name = `Valeria ${uniq("Priv")}`;
    const email = uniqEmail("valeria");
    const page = await anonPage();
    const requests = watchRequests(page);
    // Celular lento simulado de forma determinista: el chunk de la página (el formulario) no llega hasta que la
    // invitada ya escribió e intentó enviar; el resto de la app sí carga.
    const held = await holdPageChunk(page, "(experience)/e/[slug]/[token]");
    await page.goto(ev.invitePath, { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    // Antes de hidratar, en WebKit el formulario (segmento en streaming) existe pero sigue oculto: ver fillBeforeHydration.
    const before = page.getByRole("region", { name: "Confirmación de asistencia", includeHidden: true });
    const nameBefore = before.getByRole("textbox", { name: "Tu nombre", includeHidden: true });
    const submitBefore = before.getByRole("button", { name: "Enviar mi respuesta", includeHidden: true });
    await fillBeforeHydration(nameBefore, name, browserName);
    await fillBeforeHydration(before.getByLabel("Tu email (opcional)"), email, browserName);
    await trySubmitBeforeHydration({ enterIn: nameBefore, submit: submitBefore, requests }, browserName);
    await expectGuardedBeforeHydration(before.locator("form"), submitBefore);

    held.release();
    const section = page.getByRole("region", { name: "Confirmación de asistencia" });
    const submit = section.getByRole("button", { name: "Enviar mi respuesta" });
    // El botón se habilita al terminar de hidratar.
    await expect(submit).toBeEnabled();
    expect(requests.documents, "ningún envío nativo: la pestaña sólo cargó la invitación").toEqual([{ method: "GET", path: ev.invitePath }]);
    expect(new URL(page.url()).search, "la URL no lleva query").toBe("");
    await expect(section.getByRole("textbox", { name: "Tu nombre" }), "lo escrito sigue ahí").toHaveValue(name);
    await expect(section.getByLabel("Tu email (opcional)")).toHaveValue(email);

    // Ya hidratado, el envío normal funciona y se guarda.
    await section.getByText("¡Sí, ahí estaré!").click();
    await submit.click();
    await expect.poll(() => db.eventGuest.count({ where: { eventId: ev.id, name } })).toBe(1);
    const guest = await db.eventGuest.findFirstOrThrow({ where: { eventId: ev.id, name } });
    expect(guest).toMatchObject({ source: "SELF_RSVP", rsvpStatus: "ATTENDING", email });
    await page.waitForURL(new RegExp(`/e/${ev.micrositeSlug}/${guest.token}`));
    await expect(page.getByRole("heading", { name: "¡Gracias, Valeria! Te esperamos" })).toBeVisible();
    expect(requests.documents, "sólo la invitación y el link personal, sin query").toEqual([
      { method: "GET", path: ev.invitePath },
      { method: "GET", path: `/e/${ev.micrositeSlug}/${guest.token}` },
    ]);
    expect(requests.leaking(name, email), "ninguna URL pedida lleva el nombre ni el correo").toEqual([]);
  });

  test("[GST-014] con el link general, escribir el nombre de otra invitada NO debe sobrescribir su respuesta ni entregar su link personal", { tag: ["@P0", "@permissions", "@regression"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "Link general › nombre de una invitada existente (sin email) › No podré ir");
    test.info().annotations.push({ type: "regression", description: "BUG-003" });
    const ev = await createEventFixture(db, { status: "CONFIRMED", addressLine: "Privada Secreta 7" });
    const victimEmail = uniqEmail("camila");
    const victim = await createGuestFixture(db, ev, {
      name: `Camila Ruiz ${uniq("V")}`,
      email: victimEmail,
      rsvpStatus: "ATTENDING",
      dietaryRestrictions: ["VEGAN"],
      dietaryNotes: "Alergia severa a la nuez",
      comment: "Llego tarde",
    });
    const page = await anonPage();
    const section = await openRsvp(page, ev.invitePath);
    await section.getByRole("textbox", { name: "Tu nombre" }).fill(victim.name.toLowerCase());
    await section.getByText("No podré ir").click();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await page.waitForURL((u) => u.pathname !== ev.invitePath, { timeout: 15_000 }).catch(() => undefined);
    const landed = new URL(page.url()).pathname;
    const after = await db.eventGuest.findUnique({ where: { id: victim.id } });
    test.info().annotations.push({ type: "resultado", description: `URL final ${landed} · RSVP de la invitada original: ${after?.rsvpStatus}` });
    const leaked = await page.content();
    expect(after?.rsvpStatus, "la respuesta de otra invitada no debe cambiar").toBe("ATTENDING");
    expect(landed, "no debe entregarse el link personal de otra invitada").not.toBe(victim.path);
    expect(leaked, "no debe exponerse la nota alimentaria de otra invitada").not.toContain("Alergia severa a la nuez");
    // Ningún dato de la invitada original se pierde (nombre, email, restricciones, nota, comentario)
    expect(after, "los datos de la invitada original quedan intactos").toMatchObject({
      name: victim.name,
      email: victimEmail,
      dietaryRestrictions: ["VEGAN"],
      dietaryNotes: "Alergia severa a la nuez",
      comment: "Llego tarde",
    });
    // Comportamiento seguro: la respuesta se registra como invitada NUEVA y recibe SU propio link personal
    const own = await db.eventGuest.findMany({ where: { eventId: ev.id, id: { not: victim.id } } });
    expect(own, "se crea una sola invitada nueva").toHaveLength(1);
    expect(own[0]).toMatchObject({ source: "SELF_RSVP", rsvpStatus: "NOT_ATTENDING", name: victim.name.toLowerCase() });
    expect(landed, "recibe su propio link personal").toBe(`/e/${ev.micrositeSlug}/${own[0]!.token}`);
  });

  test("[GST-023] posible duplicado del link general (nombre o email de otra invitada): se marca para la anfitriona y el equipo sin tocar ni revelar a la original", { tag: ["@P1", "@regression"] }, async ({ anonPage, rolePage, apiAs, db, evidence }) => {
    evidence("invitada", "Link general › aviso de link personal + submitRsvpAction con el nombre / el email de otra invitada → admin y portal");
    test.info().annotations.push({ type: "regression", description: "BUG-003" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const victimEmail = uniqEmail("renata");
    const victim = await createGuestFixture(db, ev, {
      name: `Renata Gil ${uniq("D")}`,
      email: victimEmail,
      rsvpStatus: "ATTENDING",
      dietaryNotes: "Celiaca estricta",
    });
    const before = await db.eventGuest.findUniqueOrThrow({ where: { id: victim.id } });
    // En el link general se pide a quien ya tiene link personal que responda desde ahí
    const page = await anonPage();
    const section = await openRsvp(page, ev.invitePath);
    await expect(section.getByText(/ya te mandó tu link personal\? Responde desde ese enlace para no duplicar tu lugar en la lista/)).toBeVisible();

    const api = await apiAs(null);
    const byName = await callAction<{ personalPath: string }>(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: victim.name.toUpperCase(), rsvpStatus: "NOT_ATTENDING" }), { path: ev.invitePath });
    const byEmail = await callAction<{ personalPath: string }>(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: "Alguien Más", email: victimEmail.toUpperCase(), rsvpStatus: "MAYBE" }), { path: ev.invitePath });
    for (const r of [byName, byEmail]) {
      expect(r.outcome, d(r)).toBe("accepted");
      expect(r.data?.personalPath).not.toBe(victim.path);
      expect(r.raw, "la respuesta no revela el token de la invitada original").not.toContain(victim.token);
    }
    expect(await db.eventGuest.findUniqueOrThrow({ where: { id: victim.id } }), "la invitada original no cambia").toEqual(before);
    const created = await db.eventGuest.findMany({ where: { eventId: ev.id, id: { not: victim.id } }, orderBy: { createdAt: "asc" } });
    expect(created.map((g) => [g.source, g.rsvpStatus, `/e/${ev.micrositeSlug}/${g.token}`])).toEqual([
      ["SELF_RSVP", "NOT_ATTENDING", byName.data?.personalPath],
      ["SELF_RSVP", "MAYBE", byEmail.data?.personalPath],
    ]);
    expect(created[1]?.email).toBe(victimEmail.toLowerCase());
    const audits = await db.auditLog.findMany({ where: { action: "guest.possible_duplicate", entityId: { in: created.map((g) => g.id) } } });
    expect(audits.map((a) => (a.after as { matchedGuestIds?: string[] } | null)?.matchedGuestIds)).toEqual([[victim.id], [victim.id]]);

    // El equipo ve los auto-registros marcados (la original no) y con quién coincide cada uno.
    // Las filas se ubican por la celda con el nombre EXACTO: el aviso «Coincide con «…»» de las marcadas
    // también contiene el nombre de la original.
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/guests`);
    await expect(owner.getByText("2 invitadas que se registraron con el link general coinciden", { exact: false })).toBeVisible();
    const table = owner.getByRole("table", { name: "Invitadas del evento" });
    await expect(table.getByText("Posible duplicado")).toHaveCount(2);
    const adminRow = (name: string) => table.getByRole("row").filter({ has: owner.getByText(name, { exact: true }) });
    await expect(adminRow(victim.name)).toHaveCount(1);
    await expect(adminRow(victim.name)).not.toContainText("Posible duplicado");
    for (const name of [victim.name.toUpperCase(), "Alguien Más"]) {
      await expect(adminRow(name)).toContainText("Posible duplicado");
      await expect(adminRow(name)).toContainText(`Coincide con «${victim.name}»`);
    }

    // La anfitriona también, con la indicación de qué hacer
    const host = await anonPage();
    await host.goto(ev.portalPath);
    const list = host.getByRole("list", { name: "Lista de invitadas" });
    await expect(list.getByText("Posible duplicado")).toHaveCount(2);
    const hostItem = (name: string) => list.getByRole("listitem").filter({ has: host.getByText(name, { exact: true }) });
    // La original la agregó la anfitriona (HOST): el aviso pide confirmarlo con ella y nunca quitar su registro.
    await expect(hostItem("Alguien Más")).toContainText(
      `Coincide con «${victim.name}» de tu lista. Primero confírmalo con ella: si este registro no es suyo, escríbenos y lo quitamos; si sí es suyo, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregaste tú. No quites el registro de «${victim.name}».`,
    );
    // Nombre exacto (sensible a mayúsculas): el registro en MAYÚSCULAS es el duplicado, no la original
    await expect(hostItem(victim.name)).toHaveCount(1);
    await expect(hostItem(victim.name)).not.toContainText("Posible duplicado");
  });

  test("[GST-025] amiga agregada por la anfitriona que responde con el link general: el portal pide confirmarlo sin quitar su registro y el equipo quita el auto-registro", { tag: ["@P2", "@regression"] }, async ({ anonPage, rolePage, db, evidence }) => {
    evidence("clienta", "Portal: amiga pendiente → la amiga responde con el link general → aviso «Primero confírmalo con ella…» → owner › Invitadas › Eliminar el auto-registro → portal sin marca");
    test.info().annotations.push({ type: "regression", description: "BUG-003 (revisión: flujo legítimo de la anfitriona y marca con contexto; pendiente #7: el aviso ya no pide quitar el registro que ella agregó)" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const friendName = `Lucía Vega ${uniq("Dup")}`;
    const friend = await createGuestFixture(db, ev, { name: friendName, email: uniqEmail("lucia"), source: "HOST" }); // pendiente
    const page = await anonPage();
    const section = await openRsvp(page, ev.invitePath);
    await section.getByRole("textbox", { name: "Tu nombre" }).fill(friendName);
    await section.getByText("¡Sí, ahí estaré!").click();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect.poll(() => db.eventGuest.count({ where: { eventId: ev.id, source: "SELF_RSVP", name: friendName } })).toBe(1);
    const answered = await db.eventGuest.findFirstOrThrow({ where: { eventId: ev.id, source: "SELF_RSVP", name: friendName } });
    expect(await db.eventGuest.findUniqueOrThrow({ where: { id: friend.id } }), "el registro de la anfitriona no cambia").toMatchObject({ rsvpStatus: "PENDING" });
    expect(await db.auditLog.count({ where: { action: "guest.possible_duplicate", entityId: answered.id } })).toBe(1);

    // Portal: primero confirmarlo con su amiga; el auto-registro lo quitamos nosotras; nunca el que ella agregó
    const host = await anonPage();
    await host.goto(ev.portalPath);
    const list = host.getByRole("list", { name: "Lista de invitadas" });
    await expect(list.getByText("Posible duplicado")).toHaveCount(1);
    await expect(list).toContainText(
      `Coincide con «${friendName}» de tu lista. Primero confírmalo con ella: si este registro no es suyo, escríbenos y lo quitamos; si sí es suyo, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregaste tú. No quites el registro de «${friendName}».`,
    );
    await expect(list, "el aviso ya no sugiere quitar el registro que agregó la anfitriona").not.toContainText("quita el registro pendiente");
    // Ella sólo puede quitar su pendiente (PORT-013); el auto-registro no tiene botón para ella
    await expect(list.getByRole("button", { name: `Quitar a ${friendName} de la lista` })).toHaveCount(1);

    // Admin: con quién coincide y cuál conservar; el equipo quita el auto-registro marcado
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/guests`);
    await expect(owner.getByText("Conserva el registro que agregó la anfitriona o el equipo (tiene su link personal) y quita el marcado", { exact: false })).toBeVisible();
    const table = owner.getByRole("table", { name: "Invitadas del evento" });
    await expect(table.getByText("Posible duplicado")).toHaveCount(1);
    await expect(table.getByText(`Coincide con «${friendName}»`)).toHaveCount(1);
    // Las dos filas se llaman igual: se ubica la marcada
    const del = table.getByRole("row").filter({ hasText: "Posible duplicado" }).getByRole("button", { name: `Eliminar a ${friendName}` });
    await waitHydrated(del);
    await del.click();
    await owner.getByRole("alertdialog", { name: `¿Quitar a ${friendName}?` }).getByRole("button", { name: "Quitar invitada" }).click();
    await expect(owner.getByText(`${friendName} se quitó de la lista`)).toBeVisible();
    await expect.poll(() => db.eventGuest.count({ where: { id: answered.id } })).toBe(0);
    expect(await db.eventGuest.findUniqueOrThrow({ where: { id: friend.id } }), "se queda el registro de la anfitriona, con su link").toMatchObject({ source: "HOST", rsvpStatus: "PENDING", token: friend.token });

    // Portal tras recargar: queda su amiga, sin marca de posible duplicado
    await host.reload();
    const after = host.getByRole("list", { name: "Lista de invitadas" });
    await expect(after.getByText(friendName, { exact: true })).toHaveCount(1);
    await expect(after.getByText("Posible duplicado")).toHaveCount(0);
    await expect(after.getByRole("button", { name: `Quitar a ${friendName} de la lista` })).toHaveCount(1);
  });

  test("[GST-015] mensaje para la homenajeada: se guarda uno por invitada y se actualiza al editar", { tag: ["@P1", "@regression"] }, async ({ anonPage, rolePage, db, evidence }) => {
    evidence("invitada", "Link personal › Mensaje para <homenajeada> › editar respuesta y mensaje");
    test.info().annotations.push({ type: "regression", description: "BUG-006" }); // confirmación tras guardar (router.refresh en transición)
    const ev = await createEventFixture(db, { status: "CONFIRMED", honoreeName: "Regina" });
    const g = await createGuestFixture(db, ev, { name: `Itzel ${uniq("Msg")}` });
    const page = await anonPage();
    const section = await openRsvp(page, g.path);
    await section.getByText("¡Sí, ahí estaré!").click();
    await section.getByLabel("Mensaje para Regina").fill("¡Te queremos mucho!");
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByRole("heading", { name: /Te esperamos/ })).toBeVisible();
    const first = await db.eventMessage.findMany({ where: { eventId: ev.id, kind: "HONOREE", guestId: g.id } });
    expect(first.map((m) => m.body)).toEqual(["¡Te queremos mucho!"]);
    await section.getByRole("button", { name: "Editar mi respuesta" }).click();
    await section.getByLabel("Mensaje para Regina").fill("¡Feliz vida, Regi!");
    await section.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(async () => (await db.eventMessage.findMany({ where: { eventId: ev.id, kind: "HONOREE", guestId: g.id } })).map((m) => m.body)).toEqual(["¡Feliz vida, Regi!"]);
    // La confirmación debe volver a mostrarse tras guardar (misma ruta: router.refresh dentro de la transición)
    await expect(section.getByRole("heading", { name: /Te esperamos/ })).toBeVisible();
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/guests`);
    await expect(owner.getByRole("region", { name: "Mensajes para Regina" })).toContainText("¡Feliz vida, Regi!");
    const host = await anonPage();
    await host.goto(ev.portalPath);
    await expect(host.getByText("Hay 1 mensaje para Regina.", { exact: false })).toBeVisible();
    // El texto del mensaje es sorpresa: no aparece en el portal de la anfitriona
    await expect(host.getByText("¡Feliz vida, Regi!")).toHaveCount(0);
  });

  test("[GST-016] archivo .ics: con dirección sólo para quien confirmó; 404 para cancelado o token inválido", { tag: ["@P1"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("invitada", "GET /e/[slug]/[token]/calendar.ics (personal confirmada, general, cancelado, inválido)");
    const ev = await createEventFixture(db, { status: "CONFIRMED", addressLine: "Calle del Ics 45", dressCode: "Blanco" });
    const yes = await createGuestFixture(db, ev, { name: "Ics Confirmada", rsvpStatus: "ATTENDING" });
    const cancelled = await createEventFixture(db, { status: "CANCELLED" });
    const api = await apiAs(null);
    const res = await api.get(`${yes.path}/calendar.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    expect(res.headers()["content-disposition"]).toBe(`attachment; filename="${ev.micrositeSlug}.ics"`);
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(`SUMMARY:${ev.title}`);
    expect(ics.replace(/\r\n /g, "")).toContain("Calle del Ics 45");
    const general = await (await api.get(`${ev.invitePath}/calendar.ics`)).text();
    expect(general.replace(/\r\n /g, "")).not.toContain("Calle del Ics 45");
    expect(general.replace(/\r\n /g, "")).toContain("La dirección exacta aparece en tu invitación");
    expect((await api.get(`${cancelled.invitePath}/calendar.ics`)).status()).toBe(404);
    expect((await api.get(`/e/${ev.micrositeSlug}/${token()}/calendar.ics`)).status()).toBe(404);
    expect((await api.get(`/e/otro-slug/${ev.inviteToken}/calendar.ics`)).status()).toBe(404);
    // En la UI, tras confirmar, «Agregar a mi calendario» apunta al .ics del link personal
    const page = await anonPage();
    await page.goto(yes.path);
    await expect(page.getByRole("link", { name: "Agregar a mi calendario" })).toHaveAttribute("href", `${yes.path}/calendar.ics`);
  });

  test("[GST-017] tokens del micrositio: otro evento, slug equivocado, micrositio apagado o token inexistente → 404", { tag: ["@P1", "@permissions", "@negative"] }, async ({ anonPage, db, guard, evidence }) => {
    evidence("anonimo", "/e/<slug B>/<token invitada de A> · /e/<slug>/<random> · micrositio desactivado");
    guard.allow(/status of 404/); // respuestas 404 esperadas
    const a = await createEventFixture(db, { status: "CONFIRMED" });
    const b = await createEventFixture(db, { status: "CONFIRMED" });
    const off = await createEventFixture(db, { status: "CONFIRMED", micrositeEnabled: false });
    const guestA = await createGuestFixture(db, a, { name: "Invitada A" });
    const page = await anonPage();
    for (const path of [`/e/${b.micrositeSlug}/${guestA.token}`, `/e/${b.micrositeSlug}/${a.inviteToken}`, `/e/${a.micrositeSlug}/${token()}`, `/e/no-existe-${uniq("s").toLowerCase()}/${a.inviteToken}`, off.invitePath, `/e/${a.micrositeSlug}/corto`]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { name: "Esta invitación no está disponible" })).toBeVisible();
      await expect(page.getByText("Invitada A")).toHaveCount(0);
    }
  });

  test("[GST-018] privacidad del micrositio: sin dirección exacta antes de confirmar y sin datos de otras invitadas", { tag: ["@P1", "@permissions"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "Link personal pendiente y link general: HTML sin dirección ni otras invitadas");
    const ev = await createEventFixture(db, { status: "CONFIRMED", addressLine: "Sierra Gorda 77", neighborhood: "Lomas" });
    const g1 = await createGuestFixture(db, ev, { name: "Primera Privada", email: uniqEmail("p1") });
    const g2 = await createGuestFixture(db, ev, { name: "Segunda Privada", email: uniqEmail("p2"), dietaryNotes: "Nota privada de Segunda" });
    const page = await anonPage();
    for (const path of [g1.path, ev.invitePath]) {
      await page.goto(path);
      await expect(page.getByText("Lomas").first()).toBeVisible();
      const html = await page.content();
      expect(html, path).not.toContain("Sierra Gorda 77");
      expect(html, path).not.toContain("Segunda Privada");
      expect(html, path).not.toContain("Nota privada de Segunda");
      expect(html, path).not.toContain(g2.token);
      expect(html, path).not.toContain(ev.portalToken);
    }
    // El email propio sólo aparece enmascarado
    await page.goto(g1.path);
    const email = (await db.eventGuest.findUniqueOrThrow({ where: { id: g1.id } })).email!;
    expect(await page.content()).not.toContain(email);
    await expect(page.getByText(/Ya tenemos tu email \(.{2}•••@/)).toBeVisible();
  });

  test("[GST-019] validaciones del RSVP en el formulario y en el backend", { tag: ["@P2", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("invitada", "Enviar sin respuesta / restricción «Otra» sin nota + submitRsvpAction inválido");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await anonPage();
    const section = await openRsvp(page, ev.invitePath);
    await section.getByRole("textbox", { name: "Tu nombre" }).fill("A");
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByText("Escribe tu nombre (mínimo 2 letras).")).toBeVisible();
    await expect(section.getByText("Cuéntanos si podrás acompañarnos.")).toBeVisible();
    await section.getByRole("textbox", { name: "Tu nombre" }).fill("Ana Válida");
    await section.getByText("¡Sí, ahí estaré!").click();
    await section.getByText("Otra", { exact: true }).click();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByText("Cuéntanos cuál es tu restricción.")).toBeVisible();
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(0);
    const api = await apiAs(null);
    const pending = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { rsvpStatus: "PENDING" }), { path: ev.invitePath });
    expect(pending.code, d(pending)).toBe("VALIDATION_ERROR");
    const longMsg = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { honoreeMessage: "x".repeat(601) }), { path: ev.invitePath });
    expect(longMsg.fieldErrors?.["rsvp.honoreeMessage"]?.[0], d(longMsg)).toBe("Máximo 600 caracteres.");
    const badSlug = await callAction(api, "submitRsvpAction", rsvpInput("Slug Malo", ev.inviteToken), { path: ev.invitePath });
    expect(badSlug.code, d(badSlug)).toBe("VALIDATION_ERROR");
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(0);
  });

  test("[GST-020] RSVP cerrado en eventos completados y cancelados (UI y backend)", { tag: ["@P1", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("invitada", "Micrositio de evento COMPLETED y CANCELLED + submitRsvpAction directo");
    const done = await createEventFixture(db, { status: "COMPLETED" });
    const cancelled = await createEventFixture(db, { status: "CANCELLED" });
    const g = await createGuestFixture(db, done, { name: "Tardía Completado" });
    const page = await anonPage();
    await page.goto(g.path);
    await expect(page.getByRole("heading", { name: "Esta celebración ya sucedió" })).toBeVisible();
    await page.goto(cancelled.invitePath);
    await expect(page.getByRole("heading", { name: "Esta celebración fue cancelada" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Confirmación de asistencia" })).toHaveCount(0);
    const api = await apiAs(null);
    const closed = await callAction(api, "submitRsvpAction", rsvpInput(done.micrositeSlug, g.token), { path: g.path });
    expect(closed.code, d(closed)).toBe("RSVP_CLOSED");
    const canc = await callAction(api, "submitRsvpAction", rsvpInput(cancelled.micrositeSlug, cancelled.inviteToken), { path: cancelled.invitePath });
    expect(canc.code, d(canc)).toBe("EVENT_CANCELLED");
    expect((await db.eventGuest.findUnique({ where: { id: g.id } }))?.rsvpStatus).toBe("PENDING");
    expect(await db.eventGuest.count({ where: { eventId: cancelled.id } })).toBe(0);
  });

  test("[GST-021] el link general no admite más de 60 invitadas", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("invitada", "submitRsvpAction con link general y 60 invitadas registradas (evento de 100 personas)");
    // Con 100 personas contratadas el tope relativo (guestCount + 50 %) sería 150: lo que frena aquí es el techo de 60.
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 100 });
    await db.eventGuest.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ eventId: ev.id, name: `Llena ${i + 1}`, token: token(), source: "HOST" as const })) });
    const api = await apiAs(null);
    const r = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: "La Sesenta y Uno" }), { path: ev.invitePath });
    expect(r.code, d(r)).toBe("GUEST_LIMIT");
    expect(r.error).toBe(GENERAL_INVITE_FULL);
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(60);
  });

  test("[GST-029] link general que llega a su tope (guestCount + margen) con el formulario abierto: la respuesta se rechaza con un aviso cálido en pantalla y la base no cambia", { tag: ["@P1", "@negative", "@regression", "@mobile"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("invitada", "Evento de 6 personas con 9 en la lista › link general (formulario) › mientras tanto entran la 10.ª (nombre de una invitada: posible duplicado auditado) y la 11.ª › ¡Sí, ahí estaré! › Enviar mi respuesta (rechazo) + submitRsvpAction con el nombre de una invitada › recargar");
    test.info().annotations.push({ type: "regression", description: "BUG-003 · pendiente #6: tope del link general relativo a guestCount (el servidor valida al enviar aunque el formulario se haya pintado con lugar)" });
    const startedAt = new Date();
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 6 }); // tope = 6 + máx(5, ⌈3⌉) = 11
    const known = await createGuestFixture(db, ev, { name: `Brenda Tope ${uniq("K")}`, source: "HOST" });
    await fillGuestList(db, ev.id, 8); // 9 en la lista: el link general todavía pinta el formulario

    // La invitada abre la invitación con lugar y empieza a llenar el formulario
    const name = `Nueva ${uniq("Tope")}`;
    const page = await anonPage();
    const section = await openRsvp(page, ev.invitePath);
    await section.getByRole("textbox", { name: "Tu nombre" }).fill(name);
    await section.getByText("¡Sí, ahí estaré!").click();

    // Mientras tanto la lista llega al tope por el link general: la 10.ª con el nombre de una invitada (posible
    // duplicado: deja su auditoría) y la 11.ª, justo abajo del tope.
    const api = await apiAs(null);
    const dup = await callAction<{ personalPath: string }>(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: known.name }), { path: ev.invitePath });
    expect(dup.outcome, d(dup)).toBe("accepted");
    const below = await callAction<{ personalPath: string }>(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: `La Once ${uniq("T")}` }), { path: ev.invitePath });
    expect(below.outcome, d(below)).toBe("accepted"); // justo abajo del tope: entra
    const before = await db.eventGuest.findMany({ where: { eventId: ev.id }, orderBy: { id: "asc" } });
    expect(before).toHaveLength(11); // en el borde

    // Auditorías de ESTE evento escritas desde que empezó la prueba (cualquier acción y cualquier invitada, también
    // una que el intento rechazado hubiera creado). Control positivo: la consulta sí ve la auditoría del posible
    // duplicado que entró; si un intento rechazado dejara una, la vería igual y la prueba fallaría.
    const eventAudits = () =>
      db.auditLog.findMany({
        where: { createdAt: { gte: startedAt }, after: { path: ["eventId"], equals: ev.id } },
        orderBy: { id: "asc" },
      });
    const dupGuest = before.find((g) => g.source === "SELF_RSVP" && g.name === known.name);
    expect(dupGuest, "la 10.ª quedó como auto-registro con el nombre de la invitada").toBeDefined();
    const auditsBefore = await eventAudits();
    expect(auditsBefore.map((a) => [a.action, a.entityId]), "control positivo: se ve la auditoría del posible duplicado").toEqual([
      ["guest.possible_duplicate", dupGuest!.id],
    ]);

    // Envía con el formulario que se pintó cuando había lugar: el servidor valida y rechaza (carrera)
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByRole("alert").filter({ hasText: GENERAL_INVITE_FULL })).toBeVisible();
    await expect(section.getByRole("textbox", { name: "Tu nombre" }), "lo escrito sigue ahí").toHaveValue(name);
    expect(new URL(page.url()).pathname, "no recibe link personal: se queda en la invitación").toBe(ev.invitePath);

    // Sin enumeración: con el nombre de alguien de la lista la respuesta es la misma (y no audita un posible duplicado)
    const same = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: known.name }), { path: ev.invitePath });
    expect(same.code, d(same)).toBe("GUEST_LIMIT");
    expect(same.error).toBe(GENERAL_INVITE_FULL);

    // La base no cambia: ni invitadas ni auditorías nuevas del evento (ningún guest.possible_duplicate ni otra acción)
    expect(await db.eventGuest.findMany({ where: { eventId: ev.id }, orderBy: { id: "asc" } })).toEqual(before);
    expect(await eventAudits(), "los intentos rechazados no dejan auditoría").toEqual(auditsBefore);
    expect(await db.eventGuest.count({ where: { eventId: ev.id, name } })).toBe(0);

    // Al recargar, el servidor ya pinta el aviso en lugar del formulario (GST-031)
    await page.reload();
    const region = page.getByRole("region", { name: "Confirmación de asistencia" });
    await expect(region).toContainText(GENERAL_INVITE_FULL);
    await expect(region.getByRole("textbox", { name: "Tu nombre" })).toHaveCount(0);
  });

  test("[GST-031] con la lista en su tope, el link general muestra desde el servidor el aviso de enlace cerrado en lugar del formulario", { tag: ["@P1", "@regression", "@mobile"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("invitada", "Evento de 6 personas: link general con 10 en la lista (formulario) y con 11 (aviso en el HTML del servidor) + submitRsvpAction directo + link personal + se libera un lugar");
    test.info().annotations.push({ type: "regression", description: "BUG-003 · revisión de #6: el link general en el tope mostraba el formulario completo y sólo avisaba al enviar" });
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 6 }); // tope = 11
    const known = await createGuestFixture(db, ev, { name: `Julieta Cierre ${uniq("K")}`, source: "HOST" });
    await fillGuestList(db, ev.id, 9); // 10: una abajo del tope
    const api = await apiAs(null);

    // Con lugar, el HTML del servidor trae el formulario y no el aviso
    const open = await api.get(ev.invitePath);
    expect(open.status()).toBe(200);
    const openHtml = await open.text();
    expect(openHtml).toContain("Enviar mi respuesta");
    expect(openHtml).not.toContain(GENERAL_INVITE_FULL);

    await fillGuestList(db, ev.id, 1); // 11: en el tope
    // En el tope, el aviso llega en el HTML del servidor (render inicial, sin depender del JS) en lugar del formulario
    const closed = await api.get(ev.invitePath);
    expect(closed.status()).toBe(200);
    const html = await closed.text();
    expect(html, "el aviso viene en el HTML del servidor").toContain(GENERAL_INVITE_FULL);
    expect(html, "sin formulario").not.toContain("Enviar mi respuesta");
    expect(html, "sin campos del RSVP").not.toContain('name="rsvpStatus"');
    expect(html, "sin nombres de la lista").not.toContain(known.name);

    const page = await anonPage();
    await page.goto(ev.invitePath);
    const region = page.getByRole("region", { name: "Confirmación de asistencia" });
    await expect(region.getByRole("heading", { name: "Confirma desde tu link personal" })).toBeVisible();
    await expect(region).toContainText(GENERAL_INVITE_FULL);
    expect(await region.innerText(), "el aviso no revela cuántas personas hay ni el tope").not.toMatch(/\d/);
    await expect(region.getByRole("textbox")).toHaveCount(0);
    await expect(region.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Confirmar asistencia" }), "sin CTA para confirmar aquí").toHaveCount(0);

    // El servidor sigue validando al enviar (p. ej. un formulario abierto antes de llenarse la lista)
    const direct = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: `Directa ${uniq("T")}` }), { path: ev.invitePath });
    expect(direct.code, d(direct)).toBe("GUEST_LIMIT");
    expect(direct.error).toBe(GENERAL_INVITE_FULL);
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(11);

    // El link personal no cuenta contra el tope: sigue mostrando su formulario
    await page.goto(known.path);
    await expect(page.getByRole("heading", { name: "Julieta, ¿nos acompañas?" })).toBeVisible();
    await expect(page.getByText(GENERAL_INVITE_FULL)).toHaveCount(0);

    // Si el equipo libera un lugar, el link general vuelve a recibir respuestas
    const filler = await db.eventGuest.findFirstOrThrow({ where: { eventId: ev.id, source: "SELF_RSVP" } });
    await db.eventGuest.delete({ where: { id: filler.id } });
    const reopened = await openRsvp(page, ev.invitePath);
    await expect(reopened.getByRole("textbox", { name: "Tu nombre" })).toBeVisible();
    await expect(reopened.getByText(GENERAL_INVITE_FULL)).toHaveCount(0);
  });

  test("[GST-030] con la lista en el tope del link general, el link personal sigue respondiendo", { tag: ["@P1", "@regression", "@mobile"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "Evento de 6 personas con 13 en la lista (arriba del tope) › link personal › ¡Sí, ahí estaré! › Enviar mi respuesta");
    test.info().annotations.push({ type: "regression", description: "BUG-003 · pendiente #6: el tope sólo frena al link general" });
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 6 }); // tope = 11
    const g = await createGuestFixture(db, ev, { name: `Paola ${uniq("Tope")}`, source: "HOST" });
    await fillGuestList(db, ev.id, 12); // 13: la anfitriona puede pasar del tope del link general (techo 60)
    const page = await anonPage();
    const section = await openRsvp(page, g.path);
    await section.getByText("¡Sí, ahí estaré!").click();
    await section.getByRole("button", { name: "Enviar mi respuesta" }).click();
    await expect(section.getByRole("heading", { name: "¡Gracias, Paola! Te esperamos" })).toBeVisible();
    await expect(page.getByText("Este enlace ya no recibe más respuestas")).toHaveCount(0);
    expect(await db.eventGuest.findUniqueOrThrow({ where: { id: g.id } })).toMatchObject({ rsvpStatus: "ATTENDING", source: "HOST" });
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(13);
    await page.reload();
    await expect(page.getByRole("region", { name: "Confirmación de asistencia" })).toContainText("Asiste");
  });

  test("[GST-022] invitación sembrada de Camila (sólo lectura) y accesibilidad del micrositio", { tag: ["@P2", "@a11y", "@regression"] }, async ({ anonPage, evidence }, testInfo) => {
    evidence("invitada", `/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila} + axe`);
    test.info().annotations.push({ type: "regression", description: "BUG-010" });
    const page = await anonPage();
    const res = await page.goto(`/e/${TOKENS.micrositeSofia}/${TOKENS.guestCamila}`);
    expect(res?.status()).toBe(200);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { name: "Camila, ¿nos acompañas?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Los detalles" })).toBeVisible();
    const { blocking } = await scanA11y(page, testInfo);
    expect(blocking.map((v) => `${v.id} (${v.impact}) ${v.help}`)).toEqual([]);
  });
});
