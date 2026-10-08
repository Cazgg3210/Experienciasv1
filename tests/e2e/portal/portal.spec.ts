/**
 * Portal de la clienta (/mi-evento, /mi-evento/[token], /resumen): lectura, acceso por correo,
 * preferencias, dirección, mensajes, invitadas de la anfitriona, opinión y aislamiento por token.
 * Paquete 4 · carril 4 · prefijo PORT.
 */
import { expect, scanA11y, test, TOKENS, uniq, uniqEmail } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  addDaysKey,
  callAction,
  createEventFixture,
  createGuestFixture,
  describe as d,
  expectGuardedBeforeHydration,
  fillBeforeHydration,
  fillGuestList,
  formatMXN,
  holdPageChunk,
  lastAudit,
  todayKey,
  token,
  trySubmitBeforeHydration,
  waitHydrated,
  watchRequests,
} from "../events/_helpers";

const portalPath = (t: string) => `/mi-evento/${t}`;

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "sin scroll horizontal").toBeLessThanOrEqual(1);
}

test.describe("Portal · lectura", { tag: ["@module:portal"] }, () => {
  test("[PORT-001] portal de Sofía (confirmado): datos del evento, pago, invitadas y sin datos internos", { tag: ["@P0", "@critical", "@mobile"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", `/mi-evento/${TOKENS.portalSofia}`);
    const ev = await db.event.findUniqueOrThrow({
      where: { portalToken: TOKENS.portalSofia },
      include: { booking: { include: { payments: true } }, guests: true },
    });
    const page = await anonPage();
    const res = await page.goto(portalPath(TOKENS.portalSofia));
    expect(res?.status()).toBe(200);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(page.getByText("¡Fecha confirmada!")).toBeVisible();
    const pago = page.getByRole("region", { name: "Pago" });
    await expect(pago).toContainText(formatMXN(ev.booking!.totalCents));
    const net = ev.booking!.payments
      .filter((p) => p.kind !== "REFUND" && ["PAID", "PARTIAL_REFUND", "REFUNDED"].includes(p.status))
      .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
    await expect(pago).toContainText(formatMXN(net));
    await expect(pago).toContainText(formatMXN(Math.max(0, ev.booking!.totalCents - net)));
    const invitadas = page.getByRole("region", { name: "Invitadas" });
    const attending = ev.guests.filter((g) => g.rsvpStatus === "ATTENDING").length;
    await expect(invitadas).toContainText(`${attending} confirmadas de ${ev.guests.length} invitadas`);
    await expect(page.getByRole("region", { name: "Programa del día" })).toBeVisible();
    // Aislamiento: el HTML no trae notas internas ni datos de otros eventos
    const html = await page.content();
    if (ev.internalNotes) expect(html).not.toContain(ev.internalNotes);
    const other = await db.event.findUniqueOrThrow({ where: { portalToken: TOKENS.portalFernandaPendingPayment } });
    expect(html).not.toContain(other.title);
    expect(html).not.toContain(other.portalToken);
    await noHorizontalScroll(page);
  });

  test("[PORT-002] portal de Fernanda (pendiente de pago): anticipo pendiente y CTA de pago con el monto correcto", { tag: ["@P1", "@mobile"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", `/mi-evento/${TOKENS.portalFernandaPendingPayment} (sólo lectura)`);
    const ev = await db.event.findUniqueOrThrow({
      where: { portalToken: TOKENS.portalFernandaPendingPayment },
      include: { booking: { include: { payments: true } } },
    });
    const net = ev.booking!.payments
      .filter((p) => p.kind !== "REFUND" && ["PAID", "PARTIAL_REFUND", "REFUNDED"].includes(p.status))
      .reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
    const deposit = ev.booking!.depositRequiredCents - net;
    const page = await anonPage();
    await page.goto(portalPath(TOKENS.portalFernandaPendingPayment));
    await expect(page.getByText("Falta tu anticipo")).toBeVisible();
    const pago = page.getByRole("region", { name: "Pago" });
    await expect(pago).toContainText(`Anticipo para confirmar tu fecha: ${formatMXN(deposit)}.`);
    const cta = pago.getByRole("button", { name: `Pagar anticipo · ${formatMXN(deposit)}` });
    await expect(cta).toBeVisible();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();
    await noHorizontalScroll(page);
  });

  test("[PORT-003] tokens inválidos, inexistentes o rotados responden 404 genérico", { tag: ["@P1", "@negative", "@permissions"] }, async ({ anonPage, guard, evidence }) => {
    evidence("anonimo", "/mi-evento/<basura> · /mi-evento/<token aleatorio> · /resumen");
    guard.allow(/status of 404/); // las respuestas 404 son el comportamiento esperado
    const page = await anonPage();
    for (const path of [portalPath("abc"), portalPath(token()), `${portalPath(token())}/resumen`, portalPath(`${TOKENS.portalSofia}x`)]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { name: "Este enlace no es válido" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Pedir mi enlace" })).toHaveAttribute("href", "/mi-evento");
    }
  });

  test("[PORT-004] resumen imprimible del evento", { tag: ["@P2"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", "/mi-evento/[token]/resumen");
    const ev = await createEventFixture(db, { status: "CONFIRMED", booking: { totalCents: 800_000, depositCents: 400_000 }, timeline: [{ time: "12:00", title: "Brindis resumen" }] });
    await createGuestFixture(db, ev, { name: "Lucía Resumen", rsvpStatus: "ATTENDING" });
    const page = await anonPage();
    const res = await page.goto(`${ev.portalPath}/resumen`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(ev.title);
    await expect(page.getByRole("region", { name: /Invitadas/ })).toContainText("Lucía Resumen");
    await expect(page.getByRole("region", { name: /Programa/ })).toContainText("Brindis resumen");
    await expect(page.getByText(formatMXN(800_000)).first()).toBeVisible();
  });
});

test.describe("Portal · acceso por correo", { tag: ["@module:portal"] }, () => {
  test("[PORT-005] solicitar acceso: respuesta neutral y enlace enviado sólo a correos registrados (sin enumeración)", { tag: ["@P1", "@auth"] }, async ({ anonPage, db, evidence }) => {
    evidence("anonimo", "/mi-evento › Enviarme mi enlace (correo registrado y no registrado)");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const unknown = uniqEmail("nadie");
    const page = await anonPage();
    const messages: string[] = [];
    for (const email of [unknown, ev.customer.email!]) {
      await page.goto("/mi-evento");
      const input = page.getByLabel("Tu correo");
      await waitHydrated(input);
      await input.fill(email);
      await page.getByRole("button", { name: "Enviarme mi enlace" }).click();
      const status = page.getByRole("status").filter({ hasText: "Revisa tu correo" });
      await expect(status).toBeVisible();
      await expect(status).toContainText(email);
      messages.push((await status.textContent())!.replace(email, "<email>"));
    }
    expect(messages[0], "misma respuesta exista o no la cuenta").toBe(messages[1]);
    await expect.poll(() => db.notificationLog.count({ where: { type: "PORTAL_ACCESS", to: ev.customer.email! } })).toBe(1);
    const log = await db.notificationLog.findFirst({ where: { type: "PORTAL_ACCESS", to: ev.customer.email! } });
    expect(log?.body).toContain(ev.portalToken);
    expect(await db.notificationLog.count({ where: { to: unknown } }), "no se envía nada a un correo no registrado").toBe(0);
  });

  test("[PORT-006] solicitar acceso valida el correo en el formulario y en el backend", { tag: ["@P2", "@negative"] }, async ({ anonPage, apiAs, evidence }) => {
    evidence("anonimo", "/mi-evento con correo vacío / inválido");
    const page = await anonPage();
    await page.goto("/mi-evento");
    const submit = page.getByRole("button", { name: "Enviarme mi enlace" });
    await waitHydrated(submit);
    await submit.click();
    await expect(page.getByText("Escribe tu correo.")).toBeVisible();
    await page.getByLabel("Tu correo").fill("correo@");
    await submit.click();
    await expect(page.getByText("Escribe un correo válido.")).toBeVisible();
    const api = await apiAs(null);
    const r = await callAction(api, "requestPortalAccessAction", { email: "no-es-correo" }, { path: "/mi-evento" });
    expect(r.fieldErrors?.email?.[0], d(r)).toBe("Escribe un correo válido.");
  });

  test("[PORT-021] el correo escrito antes de que /mi-evento hidrate no se borra y el enlace llega", { tag: ["@P1", "@regression", "@mobile"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", "/mi-evento con el JS de la página retenido › Tu correo › hidrata › Enviarme mi enlace");
    // react-hook-form con defaultValues { email: "" } escribía "" en el DOM al registrar el campo durante la
    // hidratación: en un celular lento se borraba el correo ya escrito y el envío pedía «Escribe tu correo.».
    test.info().annotations.push({ type: "regression", description: "texto escrito antes de hidratar se borraba (react-hook-form + defaultValues \"\")" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const email = ev.customer.email!;
    const page = await anonPage();
    const held = await holdPageChunk(page, "(experience)/mi-evento");
    await page.goto("/mi-evento", { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    await page.getByLabel("Tu correo").fill(email);

    held.release();
    const submit = page.getByRole("button", { name: "Enviarme mi enlace" });
    await waitHydrated(submit);
    // Al enviar ya hidratado, el formulario valida con lo que tiene registrado: si se hubiera borrado, pediría el correo.
    await submit.click();
    const status = page.getByRole("status").filter({ hasText: "Revisa tu correo" });
    await expect(status).toBeVisible();
    await expect(status).toContainText(email);
    await expect.poll(() => db.notificationLog.count({ where: { type: "PORTAL_ACCESS", to: email } })).toBe(1);
    const log = await db.notificationLog.findFirstOrThrow({ where: { type: "PORTAL_ACCESS", to: email } });
    expect(log.body).toContain(ev.portalToken);
  });

  test("[PORT-023] antes de que /mi-evento hidrate el acceso no se envía de forma nativa: el correo nunca termina en la URL", { tag: ["@P1", "@regression", "@mobile"] }, async ({ anonPage, db, evidence, browserName }) => {
    evidence("clienta", "/mi-evento con el JS de la página retenido › Tu correo › Enter y clic en «Enviarme mi enlace» › hidrata › Enviarme mi enlace");
    // Sin method y con el botón activo antes de hidratar, el navegador enviaba el formulario por GET:
    // /mi-evento?email=… quedaba en el historial, en los logs del servidor y del proxy y en el Referer.
    test.info().annotations.push({ type: "regression", description: "envío nativo por GET antes de hidratar dejaba datos personales en la URL" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const email = ev.customer.email!;
    const page = await anonPage();
    const requests = watchRequests(page);
    const held = await holdPageChunk(page, "(experience)/mi-evento");
    await page.goto("/mi-evento", { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    const field = page.getByLabel("Tu correo");
    const submit = page.getByRole("button", { name: "Enviarme mi enlace" });
    await fillBeforeHydration(field, email, browserName);
    await trySubmitBeforeHydration({ enterIn: field, submit, requests }, browserName);
    await expectGuardedBeforeHydration(page.locator("form").filter({ has: field }), submit);

    held.release();
    await expect(submit).toBeEnabled();
    expect(requests.documents, "ningún envío nativo: la pestaña sólo cargó /mi-evento").toEqual([{ method: "GET", path: "/mi-evento" }]);
    expect(new URL(page.url()).search, "la URL no lleva query").toBe("");
    await expect(field, "lo escrito sigue ahí").toHaveValue(email);

    // Ya hidratado, el envío normal funciona.
    await submit.click();
    const status = page.getByRole("status").filter({ hasText: "Revisa tu correo" });
    await expect(status).toContainText(email);
    await expect.poll(() => db.notificationLog.count({ where: { type: "PORTAL_ACCESS", to: email } })).toBe(1);
    const log = await db.notificationLog.findFirstOrThrow({ where: { type: "PORTAL_ACCESS", to: email } });
    expect(log.body).toContain(ev.portalToken);
    expect(requests.documents, "sigue sin navegaciones nativas").toEqual([{ method: "GET", path: "/mi-evento" }]);
    expect(requests.leaking(email), "ninguna URL pedida lleva el correo").toEqual([]);
  });
});

test.describe("Portal · cambios de la anfitriona", { tag: ["@module:portal"] }, () => {
  test("[PORT-007] editar preferencias guarda, avisa al equipo en la conversación, audita y se refleja en la invitación", { tag: ["@P1"] }, async ({ anonPage, rolePage, db, evidence }) => {
    evidence("clienta", "Portal › Preferencias › Editar preferencias › Guardar");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const msg = `¡Las espero con mucho cariño! ${uniq("msg")}`;
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Preferencias" });
    const edit = section.getByRole("button", { name: "Editar preferencias" });
    await waitHydrated(edit);
    await edit.click();
    await section.getByLabel("Código de vestimenta").fill("Blanco y dorado");
    await section.getByLabel("Mensaje para tus invitadas").fill(msg);
    await section.getByRole("button", { name: "Guardar preferencias" }).click();
    await expect(page.getByText("Preferencias guardadas. Le avisamos al equipo.")).toBeVisible();
    await expect(section).toContainText("Blanco y dorado");
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after).toMatchObject({ dressCode: "Blanco y dorado", hostMessage: msg });
    const system = await db.eventMessage.findFirst({ where: { eventId: ev.id, authorType: "SYSTEM" }, orderBy: { createdAt: "desc" } });
    expect(system?.body).toBe("La anfitriona actualizó el código de vestimenta y el mensaje de anfitriona.");
    const audit = await lastAudit(db, "event.host_preferences_updated", ev.id);
    expect(audit?.after).toMatchObject({ dressCode: "Blanco y dorado", hostMessage: msg });
    await page.reload();
    await expect(page.getByRole("region", { name: "Preferencias" })).toContainText(msg);
    const guest = await anonPage();
    await guest.goto(ev.invitePath);
    await expect(guest.getByText(msg)).toBeVisible();
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}`);
    await expect(owner.getByRole("region", { name: /Conversación con/ })).toContainText("La anfitriona actualizó el código de vestimenta");
  });

  test("[PORT-008] preferencias inválidas (playlist, colores, enlace javascript:) se rechazan", { tag: ["@P2", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "Preferencias con URL inválida (UI) + updatePreferencesAction directo");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Preferencias" });
    const edit = section.getByRole("button", { name: "Editar preferencias" });
    await waitHydrated(edit);
    await edit.click();
    await section.getByLabel("Playlist (Spotify, Apple Music, YouTube…)").fill("no es un enlace");
    await section.getByRole("button", { name: "Guardar preferencias" }).click();
    await expect(section.getByText("Pega un enlace válido (Spotify, Apple Music, YouTube…).")).toBeVisible();

    const api = await apiAs(null);
    const base = { token: ev.portalToken, colors: [], honoreeName: "", dressCode: "", hostMessage: "", customerNotes: "", playlistUrl: "" };
    const js = await callAction(api, "updatePreferencesAction", { ...base, playlistUrl: "javascript:alert(1)" }, { path: ev.portalPath });
    expect(js.fieldErrors?.playlistUrl?.[0], d(js)).toBe("Pega un enlace válido (Spotify, Apple Music, YouTube…).");
    const colors = await callAction(api, "updatePreferencesAction", { ...base, colors: ["#ZZZZZZ"] }, { path: ev.portalPath });
    expect(JSON.stringify(colors.fieldErrors), d(colors)).toContain("Color inválido.");
    const many = await callAction(api, "updatePreferencesAction", { ...base, colors: Array(7).fill("#A3B18A") }, { path: ev.portalPath });
    expect(many.fieldErrors?.colors?.[0], d(many)).toBe("Elige hasta 6 colores.");
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after?.playlistUrl).toBeNull();
    expect(after?.colors).toEqual([]);
  });

  test("[PORT-009] editar la dirección (más de 48 h antes) actualiza el evento y lo audita", { tag: ["@P1"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", "Portal › Ubicación › Editar dirección › Guardar dirección");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Ubicación" });
    const edit = section.getByRole("button", { name: "Editar dirección" });
    await waitHydrated(edit);
    await edit.click();
    await section.getByLabel("Calle, número e interior").fill("Av. Álvaro Obregón 99 int 4");
    await section.getByRole("textbox", { name: "Colonia", exact: true }).fill("Condesa");
    await section.getByLabel("Código postal").fill("06140");
    await section.getByLabel("Indicaciones de acceso").fill("Tocar el timbre 4");
    await section.getByRole("button", { name: "Guardar dirección" }).click();
    await expect(page.getByText("Dirección actualizada")).toBeVisible();
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after).toMatchObject({ addressLine: "Av. Álvaro Obregón 99 int 4", neighborhood: "Condesa", postalCode: "06140", addressNotes: "Tocar el timbre 4" });
    const audit = await lastAudit(db, "event.host_address_updated", ev.id);
    expect(audit?.after).toMatchObject({ addressLine: "Av. Álvaro Obregón 99 int 4", neighborhood: "Condesa" });
    await page.reload();
    await expect(page.getByRole("region", { name: "Ubicación" })).toContainText("Av. Álvaro Obregón 99 int 4");
  });

  test("[PORT-010] a menos de 48 h la dirección ya no se puede editar (UI y backend)", { tag: ["@P1", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "Evento mañana › Ubicación sin «Editar dirección» + updateAddressAction directo");
    const ev = await createEventFixture(db, { status: "CONFIRMED", dateKey: addDaysKey(todayKey(), 1), start: "11:00", end: "14:00" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Ubicación" });
    await expect(section).toContainText("Faltan menos de 48 horas");
    await expect(section.getByRole("button", { name: "Editar dirección" })).toHaveCount(0);
    const api = await apiAs(null);
    const r = await callAction(api, "updateAddressAction", { token: ev.portalToken, addressLine: "Otra calle 1", neighborhood: "Centro", postalCode: "", addressNotes: "", mapsUrl: "" }, { path: ev.portalPath });
    expect(r.code, d(r)).toBe("ADDRESS_LOCKED");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.addressLine).not.toBe("Otra calle 1");
  });

  test("[PORT-011] mensaje de la anfitriona llega al equipo (conversación del admin + aviso)", { tag: ["@P0", "@critical"] }, async ({ anonPage, rolePage, db, evidence }) => {
    evidence("clienta", "Portal › Mensajes › Enviar → admin › Conversación");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const body = `¿Pueden agregar una opción sin gluten? ${uniq("msg")}`;
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Mensajes" });
    const box = section.getByRole("textbox", { name: "Escribe tu mensaje" });
    await waitHydrated(box);
    await box.fill(body);
    await section.getByRole("button", { name: "Enviar" }).click();
    await expect(section.getByRole("list", { name: "Mensajes con el equipo" })).toContainText(body);
    const msg = await db.eventMessage.findFirst({ where: { eventId: ev.id, body } });
    expect(msg).toMatchObject({ kind: "HOST_THREAD", authorType: "CUSTOMER", authorName: ev.customer.name });
    await expect.poll(() => db.notificationLog.count({ where: { eventId: ev.id, type: "GENERIC", body: { contains: "escribió en el portal" } } })).toBe(1);
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}`);
    await expect(owner.getByRole("region", { name: /Conversación con/ })).toContainText(body);
  });

  test("[PORT-022] el mensaje escrito antes de que el portal hidrate no se borra y llega al equipo", { tag: ["@P0", "@regression", "@mobile"] }, async ({ anonPage, db, evidence, browserName }) => {
    evidence("clienta", "Portal con el JS de la página retenido › Mensajes › escribe › hidrata › Enviar");
    // react-hook-form con defaultValues { body: "" } escribía "" en el DOM al registrar el campo durante la
    // hidratación: en un celular lento se borraba el mensaje ya escrito.
    test.info().annotations.push({ type: "regression", description: "texto escrito antes de hidratar se borraba (react-hook-form + defaultValues \"\")" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const body = `Escrito antes de que cargara todo ${uniq("msg")}`;
    const page = await anonPage();
    const held = await holdPageChunk(page, "(experience)/mi-evento/[token]");
    await page.goto(ev.portalPath, { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    // Antes de hidratar, en WebKit el portal (segmento en streaming) existe pero sigue oculto: ver fillBeforeHydration.
    const before = page.getByRole("region", { name: "Mensajes", includeHidden: true });
    await fillBeforeHydration(before.getByRole("textbox", { name: "Escribe tu mensaje", includeHidden: true }), body, browserName);

    held.release();
    const section = page.getByRole("region", { name: "Mensajes" });
    const box = section.getByRole("textbox", { name: "Escribe tu mensaje" });
    const send = section.getByRole("button", { name: "Enviar" });
    await waitHydrated(send);
    // Al enviar ya hidratado, el formulario valida con lo que tiene registrado: si se hubiera borrado, pediría el mensaje.
    await send.click();
    await expect(section.getByRole("list", { name: "Mensajes con el equipo" })).toContainText(body);
    await expect(box, "tras enviar, el campo se limpia (reset)").toHaveValue("");
    const msg = await db.eventMessage.findFirst({ where: { eventId: ev.id, body } });
    expect(msg).toMatchObject({ kind: "HOST_THREAD", authorType: "CUSTOMER", authorName: ev.customer.name });
  });

  test("[PORT-024] antes de que el portal hidrate, la dirección y el mensaje no se envían de forma nativa ni terminan en la URL", { tag: ["@P1", "@regression"] }, async ({ anonPage, db, evidence, browserName }) => {
    evidence("clienta", "Portal (evento sin dirección) con el JS retenido › calle, colonia y mensaje › Enter y clic en «Guardar dirección», clic en «Enviar» › hidrata › Guardar dirección › Enviar");
    // Sin method y con el botón activo antes de hidratar, el navegador enviaba cada formulario por GET a la URL del
    // portal: /mi-evento/<token>?addressLine=…&neighborhood=… o ?body=… (historial, logs, Referer).
    test.info().annotations.push({ type: "regression", description: "envío nativo por GET antes de hidratar dejaba datos personales en la URL" });
    // Sin dirección, el formulario de dirección llega abierto desde el servidor (visible antes de hidratar).
    const ev = await createEventFixture(db, { status: "CONFIRMED", addressLine: null, neighborhood: null, postalCode: null });
    const street = `Durango ${uniq("Num")} int 2`;
    const neighborhood = "Roma Norte";
    const body = `Mensaje antes de que cargara todo ${uniq("msg")}`;
    const page = await anonPage();
    const requests = watchRequests(page);
    const held = await holdPageChunk(page, "(experience)/mi-evento/[token]");
    await page.goto(ev.portalPath, { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    // Antes de hidratar, en WebKit el portal (segmento en streaming) existe pero sigue oculto: ver fillBeforeHydration.
    const locationBefore = page.getByRole("region", { name: "Ubicación", includeHidden: true });
    const messagesBefore = page.getByRole("region", { name: "Mensajes", includeHidden: true });
    const streetBefore = locationBefore.getByLabel("Calle, número e interior");
    const saveBefore = locationBefore.getByRole("button", { name: "Guardar dirección", includeHidden: true });
    const sendBefore = messagesBefore.getByRole("button", { name: "Enviar", includeHidden: true });
    await fillBeforeHydration(streetBefore, street, browserName);
    await fillBeforeHydration(locationBefore.getByRole("textbox", { name: /^Colonia/, includeHidden: true }), neighborhood, browserName);
    await fillBeforeHydration(messagesBefore.getByRole("textbox", { name: "Escribe tu mensaje", includeHidden: true }), body, browserName);
    await trySubmitBeforeHydration({ enterIn: streetBefore, submit: saveBefore, requests }, browserName);
    // El mensaje es un textarea (Enter agrega un salto de línea): sólo el clic.
    await trySubmitBeforeHydration({ submit: sendBefore, requests }, browserName);
    await expectGuardedBeforeHydration(locationBefore.locator("form"), saveBefore);
    await expectGuardedBeforeHydration(messagesBefore.locator("form"), sendBefore);

    held.release();
    const location = page.getByRole("region", { name: "Ubicación" });
    const messages = page.getByRole("region", { name: "Mensajes" });
    const save = location.getByRole("button", { name: "Guardar dirección" });
    const send = messages.getByRole("button", { name: "Enviar" });
    await expect(save).toBeEnabled();
    await expect(send).toBeEnabled();
    expect(requests.documents, "ningún envío nativo: la pestaña sólo cargó el portal").toEqual([{ method: "GET", path: ev.portalPath }]);
    expect(new URL(page.url()).search, "la URL no lleva query").toBe("");
    await expect(location.getByLabel("Calle, número e interior"), "lo escrito sigue ahí").toHaveValue(street);
    await expect(messages.getByRole("textbox", { name: "Escribe tu mensaje" })).toHaveValue(body);

    // Ya hidratado, el envío normal funciona y se guarda.
    await save.click();
    await expect(page.getByText("Dirección actualizada")).toBeVisible();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.addressLine).toBe(street);
    expect(await db.event.findUnique({ where: { id: ev.id } })).toMatchObject({ neighborhood });
    await send.click();
    await expect(messages.getByRole("list", { name: "Mensajes con el equipo" })).toContainText(body);
    const msg = await db.eventMessage.findFirst({ where: { eventId: ev.id, body } });
    expect(msg).toMatchObject({ kind: "HOST_THREAD", authorType: "CUSTOMER" });
    expect(requests.documents, "sigue sin navegaciones nativas").toEqual([{ method: "GET", path: ev.portalPath }]);
    expect(requests.leaking(street, body), "ninguna URL pedida lleva la dirección ni el mensaje").toEqual([]);
  });

  test("[PORT-012] la anfitriona agrega invitadas; duplicados y contactos inválidos se rechazan", { tag: ["@P1"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", "Portal › Invitadas › Agregar invitada (válida, duplicada, contacto inválido)");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const name = `Camila ${uniq("Host")}`;
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Invitadas" });
    const add = section.getByRole("button", { name: "Agregar invitada" });
    await waitHydrated(add);
    await add.click();
    const dialog = page.getByRole("dialog", { name: "Agregar invitada" });
    await dialog.getByRole("textbox", { name: "Nombre" }).fill(name);
    await dialog.getByLabel("Teléfono o email (opcional)").fill("55 1234 5678");
    await dialog.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByText(`Agregamos a ${name} a tu lista`)).toBeVisible();
    await expect(dialog.getByRole("status")).toContainText(name);
    const guest = await db.eventGuest.findFirst({ where: { eventId: ev.id, name } });
    expect(guest).toMatchObject({ source: "HOST", rsvpStatus: "PENDING", phone: "55 1234 5678", email: null });
    expect(guest?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Duplicado (mismo nombre normalizado, con acentos/mayúsculas distintas)
    await dialog.getByRole("textbox", { name: "Nombre" }).fill(name.toUpperCase());
    await dialog.getByRole("button", { name: "Agregar" }).click();
    await expect(dialog.getByText("Ya está en tu lista. Si es otra persona, agrega su apellido o inicial.")).toBeVisible();
    // Contacto inválido
    await dialog.getByRole("textbox", { name: "Nombre" }).fill(`Otra ${uniq("Host")}`);
    await dialog.getByLabel("Teléfono o email (opcional)").fill("abc");
    await dialog.getByRole("button", { name: "Agregar" }).click();
    await expect(dialog.getByText("Escribe un teléfono de 10 dígitos o un email válido.")).toBeVisible();
    await dialog.getByRole("button", { name: "Listo" }).click();
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(1);
    await page.reload();
    await expect(page.getByRole("list", { name: "Lista de invitadas" })).toContainText(name);
  });

  test("[PORT-013] la anfitriona sólo puede quitar invitadas pendientes que ella agregó", { tag: ["@P1", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "Portal › Quitar invitada (pendiente) + removeHostGuestAction sobre invitada que ya respondió");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const pending = await createGuestFixture(db, ev, { name: "Pendiente Quitable", source: "HOST" });
    const answered = await createGuestFixture(db, ev, { name: "Ya Confirmó", source: "HOST", rsvpStatus: "ATTENDING" });
    const self = await createGuestFixture(db, ev, { name: "Se Registró Sola", source: "SELF_RSVP", rsvpStatus: "PENDING" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const list = page.getByRole("list", { name: "Lista de invitadas" });
    await expect(list.getByRole("button", { name: "Quitar a Ya Confirmó de la lista" })).toHaveCount(0);
    await expect(list.getByRole("button", { name: "Quitar a Se Registró Sola de la lista" })).toHaveCount(0);
    const remove = list.getByRole("button", { name: "Quitar a Pendiente Quitable de la lista" });
    await waitHydrated(remove);
    await remove.click();
    const confirm = page.getByRole("alertdialog", { name: "¿Quitar a Pendiente Quitable?" });
    await expect(confirm).toContainText("Su link personal dejará de funcionar. Puedes volver a agregarla cuando quieras.");
    await confirm.getByRole("button", { name: "Quitar de la lista" }).click();
    await expect(page.getByText("Pendiente Quitable ya no está en tu lista")).toBeVisible();
    expect(await db.eventGuest.count({ where: { id: pending.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "event.guest_removed_by_host", entityId: pending.id } })).toBe(1);

    const api = await apiAs(null);
    const r1 = await callAction(api, "removeHostGuestAction", { token: ev.portalToken, guestId: answered.id }, { path: ev.portalPath });
    expect(r1.error, d(r1)).toBe("Esta invitada ya respondió. Si necesitas quitarla, escríbenos.");
    const r2 = await callAction(api, "removeHostGuestAction", { token: ev.portalToken, guestId: self.id }, { path: ev.portalPath });
    expect(r2.error, d(r2)).toBe("Esta invitada confirmó por su cuenta; si necesitas quitarla, escríbenos.");
    expect(await db.eventGuest.count({ where: { id: { in: [answered.id, self.id] } } })).toBe(2);
  });

  test("[PORT-014] la lista de la anfitriona tiene un máximo de 60 invitadas", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("clienta", "addHostGuestAction con 60 invitadas ya registradas");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    await db.eventGuest.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({ eventId: ev.id, name: `Invitada Límite ${i + 1}`, token: token(), source: "HOST" as const })),
    });
    const api = await apiAs(null);
    const r = await callAction(api, "addHostGuestAction", { token: ev.portalToken, name: "La 61", contact: "" }, { path: ev.portalPath });
    expect(r.code, d(r)).toBe("GUEST_LIMIT");
    expect(r.error).toBe("Tu lista llegó al máximo de 60 invitadas. Escríbenos si necesitas más.");
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(60);
  });

  test("[PORT-026] con la lista en el tope del link general, la anfitriona ve el aviso, ya no se le ofrece copiar la invitación general y sigue agregando invitadas que confirman con su link personal; en el techo de 60 el aviso le pide escribirnos", { tag: ["@P1", "@regression", "@mobile"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", "Evento de 6 personas: portal con 10 en la lista (copiar invitación) y con 11 (aviso de tope, sin copiar) › Agregar invitada → la invitada confirma con su link personal › lista en 60 (aviso del techo)");
    test.info().annotations.push({ type: "regression", description: "BUG-003 · pendiente #6: el tope sólo frena al link general; revisión: sin «Copiar invitación/link» del link general en el tope, aviso de registros que no reconoce y del techo de 60" });
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 6 }); // tope = 6 + máx(5, ⌈3⌉) = 11
    await fillGuestList(db, ev.id, 10);
    const name = `Regina ${uniq("TopeHost")}`;
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "Invitadas" });
    // Control: con lugar se ofrece copiar la invitación general (cuadro y barra de acciones) y no hay aviso
    const shareGeneral = [
      page.getByRole("button", { name: "Copiar invitación", exact: true }),
      page.getByRole("button", { name: "Copiar link", exact: true }),
      page.getByRole("button", { name: "Copiar invitación para compartir" }),
      page.getByRole("button", { name: "Copiar link de la invitación" }),
    ];
    for (const b of shareGeneral) await expect(b).toHaveCount(1);
    await expect(section).not.toContainText("ya no recibe más respuestas");

    await fillGuestList(db, ev.id, 1); // 11: en el tope
    await page.reload();
    await expect(section).toContainText(
      "Tu invitación general ya no recibe más respuestas: llegó al tope de registros para tu experiencia. Si alguien más quiere confirmar, agrégala a tu lista y mándale su link personal. Si ves registros que no reconoces, escríbenos y los quitamos para liberar lugares.",
    );
    await expect(section.getByRole("link", { name: "Ir a Mensajes" })).toHaveAttribute("href", "#mensajes");
    // Ya no se ofrece copiar la invitación general (quien la reciba no podría responder); verla sí
    for (const b of shareGeneral) await expect(b).toHaveCount(0);
    await expect(section.getByRole("link", { name: /Ver invitación/ })).toHaveAttribute("href", ev.invitePath);
    // Los links personales de su lista se siguen compartiendo
    await expect(section.getByRole("button", { name: /^Copiar link personal de / })).toHaveCount(11);

    // En el celular el botón también vive en la barra inferior: se usa el visible
    const add = page.getByRole("button", { name: "Agregar invitada" }).filter({ visible: true }).first();
    await waitHydrated(add);
    await add.click();
    const dialog = page.getByRole("dialog", { name: "Agregar invitada" });
    await dialog.getByRole("textbox", { name: "Nombre" }).fill(name);
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText(`Agregamos a ${name} a tu lista`)).toBeVisible();
    const added = await db.eventGuest.findFirstOrThrow({ where: { eventId: ev.id, name } });
    expect(added).toMatchObject({ source: "HOST", rsvpStatus: "PENDING" });
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(12);
    await dialog.getByRole("button", { name: "Listo" }).click();
    await page.reload();
    await expect(page.getByRole("list", { name: "Lista de invitadas" }).getByText(name, { exact: true })).toBeVisible();

    // Su link personal funciona aunque el general ya no reciba respuestas
    const guest = await anonPage();
    await guest.goto(`/e/${ev.micrositeSlug}/${added.token}`);
    const rsvp = guest.getByRole("region", { name: "Confirmación de asistencia" });
    const send = rsvp.getByRole("button", { name: "Enviar mi respuesta" });
    await waitHydrated(send);
    await rsvp.getByText("¡Sí, ahí estaré!").click();
    await send.click();
    await expect(rsvp.getByRole("heading", { name: "¡Gracias, Regina! Te esperamos" })).toBeVisible();
    await expect.poll(async () => (await db.eventGuest.findUniqueOrThrow({ where: { id: added.id } })).rsvpStatus).toBe("ATTENDING");
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(12);

    // En el techo de 60 tampoco puede agregar: el aviso ya no le pide «agrégala a tu lista», le pide escribirnos
    await fillGuestList(db, ev.id, 48);
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(60);
    await page.reload();
    await expect(section).toContainText(
      "Tu invitación general ya no recibe más respuestas y tu lista llegó al máximo de 60 invitadas. Si alguien más quiere venir, escríbenos y lo vemos juntas. Si ves registros que no reconoces, escríbenos y los quitamos para liberar lugares.",
    );
    await expect(section).not.toContainText("agrégala a tu lista");
    for (const b of shareGeneral) await expect(b).toHaveCount(0);
  });

  test("[PORT-027] aviso de posible duplicado en el portal: pide confirmarlo con su invitada y nunca quitar el registro que ella agregó", { tag: ["@P1", "@regression"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", "Portal › Invitadas: un auto-registro con el nombre de una amiga que ella agregó y dos auto-registros que sólo coinciden entre sí › Quitar a su amiga (diálogo) › Cancelar");
    test.info().annotations.push({ type: "regression", description: "BUG-003 · pendiente #7: texto del aviso de posible duplicado; revisión: si sí es suyo, escribirnos para dejar un solo registro, y el diálogo de quitar no promete volver a agregarla" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const friendName = `Mariana Sol ${uniq("Host")}`;
    const friend = await createGuestFixture(db, ev, { name: friendName, email: uniqEmail("mariana"), source: "HOST" }); // pendiente
    const impostor = friendName.toLowerCase();
    await createGuestFixture(db, ev, { name: impostor, source: "SELF_RSVP", rsvpStatus: "ATTENDING" });
    const loneName = `Inés Robles ${uniq("Self")}`;
    await createGuestFixture(db, ev, { name: loneName, source: "SELF_RSVP", rsvpStatus: "ATTENDING" });
    await createGuestFixture(db, ev, { name: loneName.toUpperCase(), source: "SELF_RSVP", rsvpStatus: "MAYBE" });
    const before = await db.eventGuest.findUniqueOrThrow({ where: { id: friend.id } });

    const page = await anonPage();
    await page.goto(ev.portalPath);
    const list = page.getByRole("list", { name: "Lista de invitadas" });
    // Nombre exacto (sensible a mayúsculas): el aviso de las marcadas también contiene el nombre con que coinciden
    const item = (name: string) => list.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
    await expect(list.getByText("Posible duplicado")).toHaveCount(3);
    // Coincide con alguien que ella agregó: confirmarlo con ella, lo quitamos nosotras si no es suyo, y conservar el suyo
    await expect(item(impostor)).toContainText(
      `Coincide con «${friendName}» de tu lista. Primero confírmalo con ella: si este registro no es suyo, escríbenos y lo quitamos; si sí es suyo, pídele que responda desde su link personal y escríbenos para dejar un solo registro: el que agregaste tú. No quites el registro de «${friendName}».`,
    );
    // Sólo coincide con otro auto-registro: confirmarlo y escribirnos para dejar uno
    await expect(item(loneName)).toContainText(
      `Coincide con «${loneName.toUpperCase()}» de tu lista. Primero confírmalo con ella y, si es la misma persona, escríbenos y dejamos un solo registro.`,
    );
    await expect(item(loneName.toUpperCase())).toContainText(
      `Coincide con «${loneName}» de tu lista. Primero confírmalo con ella y, si es la misma persona, escríbenos y dejamos un solo registro.`,
    );
    // Su amiga no lleva marca y ningún aviso le sugiere quitarla
    await expect(item(friendName)).toHaveCount(1);
    await expect(item(friendName)).not.toContainText("Posible duplicado");
    await expect(list).not.toContainText("quita el registro pendiente");
    // Los auto-registros no tienen «Quitar» para ella (sólo su pendiente, PORT-013)
    await expect(list.getByRole("button", { name: `Quitar a ${impostor} de la lista`, exact: true })).toHaveCount(0);
    const remove = list.getByRole("button", { name: `Quitar a ${friendName} de la lista`, exact: true });
    await expect(remove).toHaveCount(1);
    // El diálogo para quitar a su amiga advierte que su registro es el confiable y le pide escribirnos; ya no promete
    // «Puedes volver a agregarla» (addGuestAsHost la rechazaría: el auto-registro ocupa su nombre)
    await waitHydrated(remove);
    await remove.click();
    const confirm = page.getByRole("alertdialog", { name: `¿Quitar a ${friendName}?` });
    await expect(confirm).toContainText(
      "Su link personal dejará de funcionar. Ojo: un registro de la invitación general coincide con ella, y el confiable es este, el que agregaste tú. Si es la misma persona, no la quites: escríbenos y dejamos un solo registro.",
    );
    await expect(confirm).not.toContainText("Puedes volver a agregarla");
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toHaveCount(0);
    expect(await db.eventGuest.findUniqueOrThrow({ where: { id: friend.id } }), "mostrar el aviso y cancelar no toca a nadie").toEqual(before);
  });

  test("[PORT-015] el token de un evento no permite tocar invitadas ni datos de otro evento (IDOR)", { tag: ["@P0", "@permissions"] }, async ({ apiAs, db, evidence }) => {
    evidence("clienta", "removeHostGuestAction con token del evento A y guestId del evento B; tokens inexistentes");
    const a = await createEventFixture(db, { status: "CONFIRMED" });
    const b = await createEventFixture(db, { status: "CONFIRMED" });
    const guestB = await createGuestFixture(db, b, { name: "Invitada de B", source: "HOST" });
    const api = await apiAs(null);
    const idor = await callAction(api, "removeHostGuestAction", { token: a.portalToken, guestId: guestB.id }, { path: a.portalPath });
    expect(idor.code, d(idor)).toBe("NOT_FOUND");
    const ghostAdd = await callAction(api, "addHostGuestAction", { token: token(), name: "Fantasma", contact: "" }, { path: a.portalPath });
    expect(ghostAdd.code, d(ghostAdd)).toBe("NOT_FOUND");
    const ghostPrefs = await callAction(api, "updatePreferencesAction", { token: token(), colors: [], honoreeName: "x", dressCode: "", hostMessage: "", customerNotes: "", playlistUrl: "" }, { path: a.portalPath });
    expect(ghostPrefs.code, d(ghostPrefs)).toBe("NOT_FOUND");
    const ghostMsg = await callAction(api, "sendHostMessageAction", { token: token(), body: "hola" }, { path: a.portalPath });
    expect(ghostMsg.code, d(ghostMsg)).toBe("NOT_FOUND");
    const badFormat = await callAction(api, "sendHostMessageAction", { token: "short", body: "hola" }, { path: a.portalPath });
    expect(badFormat.code, d(badFormat)).toBe("VALIDATION_ERROR");
    expect(await db.eventGuest.count({ where: { id: guestB.id } })).toBe(1);
    expect(await db.eventGuest.count({ where: { name: "Fantasma" } })).toBe(0);
  });

  test("[PORT-016] evento cancelado: aviso amable y sin cambios posibles desde el portal", { tag: ["@P1", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "Portal de evento CANCELLED + acciones directas");
    const ev = await createEventFixture(db, { status: "CANCELLED" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    await expect(page.getByText("Evento cancelado", { exact: true })).toBeVisible();
    await expect(page.getByText(/esta celebración fue cancelada/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Mensajes" })).toHaveCount(0);
    const api = await apiAs(null);
    const msg = await callAction(api, "sendHostMessageAction", { token: ev.portalToken, body: "¿Siguen?" }, { path: ev.portalPath });
    expect(msg.code, d(msg)).toBe("EVENT_CLOSED");
    const prefs = await callAction(api, "updatePreferencesAction", { token: ev.portalToken, colors: [], honoreeName: "Nueva", dressCode: "", hostMessage: "", customerNotes: "", playlistUrl: "" }, { path: ev.portalPath });
    expect(prefs.code, d(prefs)).toBe("EVENT_CLOSED");
    const add = await callAction(api, "addHostGuestAction", { token: ev.portalToken, name: "Tardía", contact: "" }, { path: ev.portalPath });
    expect(add.code, d(add)).toBe("EVENT_CLOSED");
    expect(await db.eventMessage.count({ where: { eventId: ev.id } })).toBe(0);
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(0);
  });
});

test.describe("Portal · opinión", { tag: ["@module:portal"] }, () => {
  test("[PORT-017] tras un evento completado la clienta deja su opinión una sola vez", { tag: ["@P1"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "Portal de evento COMPLETED › ¿Cómo lo vivieron? › Enviar mi opinión (2.º envío por backend)");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    const section = page.getByRole("region", { name: "¿Cómo lo vivieron?" });
    await expect(section).toBeVisible();
    const five = section.getByRole("radio", { name: "5 estrellas: ¡Me encantó!" });
    await waitHydrated(five);
    await five.check({ force: true }); // input sr-only dentro de la etiqueta con la estrella
    await section.getByRole("radio", { name: "10", exact: true }).check({ force: true });
    await section.getByLabel("Cuéntanos más (opcional)").fill("Todo precioso, gracias");
    await section.getByRole("checkbox", { name: /Pueden publicar mi opinión/ }).check();
    await section.getByRole("button", { name: "Enviar mi opinión" }).click();
    await expect(page.getByText("¡Gracias por tu opinión!")).toBeVisible();
    await expect(page.getByRole("region", { name: "Gracias por tu opinión" })).toContainText("Todo precioso, gracias");
    const review = await db.review.findUnique({ where: { eventId: ev.id } });
    expect(review).toMatchObject({ rating: 5, npsScore: 10, comment: "Todo precioso, gracias", publishable: true, customerId: ev.customer.id });
    const api = await apiAs(null);
    const again = await callAction(api, "submitReviewAction", { token: ev.portalToken, rating: 1, npsScore: 0, comment: "otra", publishable: false }, { path: ev.portalPath });
    expect(again.code, d(again)).toBe("CONFLICT");
    expect(again.error).toBe("Ya recibimos tu opinión. ¡Gracias por tomarte el tiempo!");
    expect(await db.review.findUnique({ where: { eventId: ev.id } })).toMatchObject({ rating: 5 });
  });

  test("[PORT-025] antes de que el portal hidrate, la opinión no se envía de forma nativa: el comentario nunca termina en la URL", { tag: ["@P1", "@regression"] }, async ({ anonPage, db, evidence, browserName }) => {
    evidence("clienta", "Portal de evento COMPLETED con el JS retenido › Cuéntanos más › clic en «Enviar mi opinión» › hidrata › 4 estrellas › Enviar mi opinión");
    // Sin method y con el botón activo antes de hidratar, el navegador enviaba la opinión por GET a la URL del portal
    // (/mi-evento/<token>?comment=…): historial, logs, Referer.
    test.info().annotations.push({ type: "regression", description: "envío nativo por GET antes de hidratar dejaba datos personales en la URL" });
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const comment = `Opinión escrita antes de hidratar ${uniq("rev")}`;
    const page = await anonPage();
    const requests = watchRequests(page);
    const held = await holdPageChunk(page, "(experience)/mi-evento/[token]");
    await page.goto(ev.portalPath, { waitUntil: "domcontentloaded" }); // "load" esperaría al chunk retenido
    await held.requested();
    const before = page.getByRole("region", { name: "¿Cómo lo vivieron?", includeHidden: true });
    const submitBefore = before.getByRole("button", { name: "Enviar mi opinión", includeHidden: true });
    await fillBeforeHydration(before.getByLabel("Cuéntanos más (opcional)"), comment, browserName);
    // El comentario es un textarea (Enter agrega un salto de línea): sólo el clic.
    await trySubmitBeforeHydration({ submit: submitBefore, requests }, browserName);
    await expectGuardedBeforeHydration(before.locator("form"), submitBefore);

    held.release();
    const section = page.getByRole("region", { name: "¿Cómo lo vivieron?" });
    const submit = section.getByRole("button", { name: "Enviar mi opinión" });
    await expect(submit).toBeEnabled();
    expect(requests.documents, "ningún envío nativo: la pestaña sólo cargó el portal").toEqual([{ method: "GET", path: ev.portalPath }]);
    expect(new URL(page.url()).search, "la URL no lleva query").toBe("");
    await expect(section.getByLabel("Cuéntanos más (opcional)"), "lo escrito sigue ahí").toHaveValue(comment);

    // Ya hidratado, el envío normal funciona y se guarda.
    await section.getByRole("radio", { name: "4 estrellas: Muy bien" }).check({ force: true }); // input sr-only dentro de la etiqueta
    await submit.click();
    await expect(page.getByText("¡Gracias por tu opinión!")).toBeVisible();
    await expect.poll(async () => (await db.review.findUnique({ where: { eventId: ev.id } }))?.comment).toBe(comment);
    expect(await db.review.findUnique({ where: { eventId: ev.id } })).toMatchObject({ rating: 4, publishable: false, customerId: ev.customer.id });
    expect(requests.documents, "sigue sin navegaciones nativas").toEqual([{ method: "GET", path: ev.portalPath }]);
    expect(requests.leaking(comment), "ninguna URL pedida lleva el comentario").toEqual([]);
  });

  test("[PORT-018] antes de completarse el evento no se puede opinar (UI y backend)", { tag: ["@P1", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "Portal CONFIRMED sin sección de opinión + submitReviewAction directo; rating fuera de rango");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const done = await createEventFixture(db, { status: "COMPLETED" });
    const page = await anonPage();
    await page.goto(ev.portalPath);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(page.getByRole("region", { name: "¿Cómo lo vivieron?" })).toHaveCount(0);
    const api = await apiAs(null);
    const early = await callAction(api, "submitReviewAction", { token: ev.portalToken, rating: 5, npsScore: null, comment: "", publishable: false }, { path: ev.portalPath });
    expect(early.code, d(early)).toBe("REVIEW_NOT_AVAILABLE");
    const out = await callAction(api, "submitReviewAction", { token: done.portalToken, rating: 6, npsScore: 11, comment: "", publishable: false }, { path: done.portalPath });
    expect(Object.keys(out.fieldErrors ?? {}).sort(), d(out)).toEqual(["npsScore", "rating"]);
    expect(await db.review.count({ where: { eventId: { in: [ev.id, done.id] } } })).toBe(0);
  });
});

test.describe("Portal · calidad", { tag: ["@module:portal"] }, () => {
  test("[PORT-019] texto con HTML en las preferencias se muestra escapado en portal e invitación", { tag: ["@P2", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("clienta", "updatePreferencesAction con <img onerror> en el mensaje");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const payload = `<img src=x onerror="window.__xss=1"> Hola`;
    const api = await apiAs(null);
    const r = await callAction(api, "updatePreferencesAction", { token: ev.portalToken, colors: [], honoreeName: "", dressCode: "", hostMessage: payload, customerNotes: "", playlistUrl: "" }, { path: ev.portalPath });
    expect(r.outcome, d(r)).toBe("accepted");
    const page = await anonPage();
    await page.goto(ev.portalPath);
    await expect(page.getByRole("region", { name: "Preferencias" })).toContainText(payload);
    await page.goto(ev.invitePath);
    await expect(page.getByText(payload)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("[PORT-020] accesibilidad (WCAG 2.1 AA) del portal y del acceso por correo", { tag: ["@P2", "@a11y"] }, async ({ anonPage, evidence }, testInfo) => {
    evidence("clienta", "axe en /mi-evento y /mi-evento/[token] (Sofía)");
    const page = await anonPage();
    const found: string[] = [];
    for (const url of ["/mi-evento", portalPath(TOKENS.portalSofia)]) {
      await page.goto(url);
      await expect(page.getByRole("main")).toBeVisible();
      const { blocking } = await scanA11y(page, testInfo);
      found.push(...blocking.map((v) => `${url}: ${v.id} (${v.impact}) ${v.help}`));
    }
    expect(found, found.join("\n")).toEqual([]);
  });
});
