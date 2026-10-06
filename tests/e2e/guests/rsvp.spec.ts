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
  token,
  waitHydrated,
} from "../events/_helpers";

async function openRsvp(page: Page, path: string) {
  await page.goto(path);
  const section = page.getByRole("region", { name: "Confirmación de asistencia" });
  await expect(section).toBeVisible();
  await waitHydrated(section.getByRole("button").first());
  return section;
}

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

    // El equipo ve los auto-registros marcados (la original no)
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/guests`);
    await expect(owner.getByText("2 invitadas que se registraron con el link general coinciden", { exact: false })).toBeVisible();
    const table = owner.getByRole("table", { name: "Invitadas del evento" });
    await expect(table.getByText("Posible duplicado")).toHaveCount(2);
    await expect(table.getByRole("row", { name: new RegExp(victim.name) })).not.toContainText("Posible duplicado");
    await expect(table.getByRole("row", { name: /Alguien Más/ })).toContainText("Posible duplicado");

    // La anfitriona también, con la indicación de qué hacer
    const host = await anonPage();
    await host.goto(ev.portalPath);
    const list = host.getByRole("list", { name: "Lista de invitadas" });
    await expect(list.getByText("Posible duplicado")).toHaveCount(2);
    await expect(list.getByRole("listitem").filter({ hasText: "Alguien Más" })).toContainText("Si es la misma persona, escríbenos y dejamos un solo registro.");
    // RegExp (sensible a mayúsculas): el registro en MAYÚSCULAS es el duplicado, no la original
    await expect(list.getByRole("listitem").filter({ hasText: new RegExp(victim.name) })).not.toContainText("Posible duplicado");
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
    evidence("invitada", "submitRsvpAction con link general y 60 invitadas registradas");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    await db.eventGuest.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ eventId: ev.id, name: `Llena ${i + 1}`, token: token(), source: "HOST" as const })) });
    const api = await apiAs(null);
    const r = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, { name: "La Sesenta y Uno" }), { path: ev.invitePath });
    expect(r.code, d(r)).toBe("GUEST_LIMIT");
    expect(r.error).toBe("La lista de invitadas ya está completa. Escríbele a la anfitriona.");
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(60);
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
