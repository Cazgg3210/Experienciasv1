/**
 * Eventos (admin): listado, filtros, detalle, alta manual con disponibilidad, edición y reprogramación.
 * Paquete 4 · carril 4 · prefijo EVT.
 */
import { createCustomer, expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import {
  callAction,
  createEventFixture,
  describe as d,
  lastAudit,
  pickFreeDate,
  addDaysKey,
  todayKey,
  waitHydrated,
  weekdayOfKey,
} from "./_helpers";
import type { Page } from "@playwright/test";

const NEW = "/admin/events/new";

/** Abre el alta de evento y espera a que el formulario esté hidratado. */
async function openNew(page: Page, url = NEW) {
  await page.goto(url);
  await waitHydrated(page.getByRole("button", { name: "Crear evento" }));
}

/** Abre el Resumen del evento y devuelve el formulario de detalles ya hidratado. */
async function openEventForm(page: Page, id: string) {
  await page.goto(`/admin/events/${id}`);
  const form = page.getByRole("form", { name: "Detalles del evento" });
  await waitHydrated(form);
  return form;
}

test.describe("Eventos · listado y detalle", { tag: ["@module:events"] }, () => {
  test("[EVT-001] listado muestra eventos y filtra por estado y búsqueda (URL compartible)", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Eventos › filtros estado=Confirmado + búsqueda por código");
    const ev = await createEventFixture(db, { status: "CONFIRMED", title: `Brunch ${uniq("Lista")}` });
    const other = await createEventFixture(db, { status: "INQUIRY", title: `Consulta ${uniq("Lista")}` });
    const page = await rolePage("owner");
    await page.goto("/admin/events");
    await expect(page.getByRole("heading", { level: 1, name: "Eventos" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Listado de eventos" })).toBeVisible();

    // Búsqueda por código + estado Confirmado (formulario GET)
    await page.getByRole("searchbox", { name: "Buscar", exact: true }).fill(ev.code);
    await page.getByRole("checkbox", { name: "Confirmado" }).check();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.waitForURL(/status=CONFIRMED/);
    expect(new URL(page.url()).searchParams.get("q")).toBe(ev.code);
    const table = page.getByRole("table", { name: "Listado de eventos" });
    await expect(table.getByRole("link", { name: ev.title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toContainText("1 evento");

    // El otro evento (consulta) no aparece con el filtro de estado Confirmado
    await page.goto(`/admin/events?q=${encodeURIComponent(other.code)}&status=CONFIRMED`);
    await expect(page.getByText("No hay eventos con estos filtros")).toBeVisible();
    // ...pero sí con su estado real
    await page.goto(`/admin/events?q=${encodeURIComponent(other.code)}&status=INQUIRY`);
    await expect(page.getByRole("table", { name: "Listado de eventos" }).getByRole("link", { name: other.title })).toBeVisible();
  });

  test("[EVT-038] «Limpiar filtros» regresa al listado sin filtros (navegación del cliente)", { tag: ["@P2", "@regression"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Eventos con filtros (3 sesiones nuevas) › Limpiar filtros");
    test.info().annotations.push({ type: "regression", description: "BUG-006" });
    const outcomes: string[] = [];
    for (const start of ["/admin/events?status=INQUIRY", "/admin/events?period=past", "/admin/events?q=zzz-sin-resultados"]) {
      const page = await rolePage("owner");
      await page.goto(start);
      const clear = page.getByRole("link", { name: "Limpiar filtros" }).first();
      await waitHydrated(clear);
      await clear.click();
      const ok = await page.waitForURL(/\/admin\/events$/, { timeout: 10_000 }).then(() => true).catch(() => false);
      outcomes.push(`${start} → ${ok ? "OK" : "sin navegar: " + page.url()}`);
    }
    test.info().annotations.push({ type: "intentos", description: outcomes.join(" · ") });
    expect(outcomes.filter((o) => !o.includes("→ OK")), outcomes.join("\n")).toEqual([]);
  });

  test("[EVT-039] buscar por el teléfono de la clienta en Eventos y Cotizaciones encuentra su evento en cualquier formato", { tag: ["@P2", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Eventos / Cotizaciones › Buscar «+52 1 55…», «(55) 1234-5678» y «55 1234 5678»");
    test.info().annotations.push({ type: "regression", description: "revisión BUG-008: búsqueda por teléfono tolerante a formatos" });
    const national = uniqPhone();
    // Una clienta con el teléfono guardado con separadores (dato anterior a la forma canónica) y otra canónica.
    const legacy = await createCustomer(db, { name: uniq("Tel Formato"), phone: `${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}` });
    const canonicalNational = uniqPhone();
    const canonical = await createCustomer(db, { name: uniq("Tel Canónico"), phone: `+52${canonicalNational}` });
    const evLegacy = await createEventFixture(db, { status: "CONFIRMED", customer: legacy, booking: { totalCents: 1_000_000, depositCents: 500_000 } });
    const evCanonical = await createEventFixture(db, { status: "CONFIRMED", customer: canonical, booking: { totalCents: 1_000_000, depositCents: 500_000 } });
    const quoteOf = async (eventId: string) => (await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { quote: { select: { code: true } } } })).quote!.code;
    const [qLegacy, qCanonical] = await Promise.all([quoteOf(evLegacy.id), quoteOf(evCanonical.id)]);
    const page = await rolePage("owner");
    const cases: Array<[string, typeof evLegacy, string]> = [
      [`+52 1 ${national}`, evLegacy, qLegacy],
      [`(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`, evLegacy, qLegacy],
      [`${canonicalNational.slice(0, 2)} ${canonicalNational.slice(2, 6)} ${canonicalNational.slice(6)}`, evCanonical, qCanonical],
    ];
    for (const [q, ev, quoteCode] of cases) {
      await page.goto(`/admin/events?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole("table", { name: "Listado de eventos" }).getByRole("link", { name: ev.title }), q).toBeVisible();
      await page.goto(`/admin/quotes?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole("table", { name: "Listado de cotizaciones" }).getByRole("link", { name: quoteCode }), q).toBeVisible();
    }
  });

  test("[EVT-002] periodo «Pasados» lista eventos completados y no los futuros", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Eventos › periodo Pasados");
    const past = await createEventFixture(db, { status: "COMPLETED", title: `Pasado ${uniq("E2E")}` });
    const future = await createEventFixture(db, { status: "CONFIRMED", title: `Futuro ${uniq("E2E")}` });
    const page = await rolePage("owner");
    await page.goto(`/admin/events?period=past&q=${encodeURIComponent(past.code)}`);
    await expect(page.getByRole("link", { name: past.title })).toBeVisible();
    await page.goto(`/admin/events?period=past&q=${encodeURIComponent(future.code)}`);
    await expect(page.getByText("No hay eventos con estos filtros")).toBeVisible();
    // Por defecto (próximos) el pasado no aparece
    await page.goto(`/admin/events?q=${encodeURIComponent(past.code)}`);
    await expect(page.getByText("No hay eventos con estos filtros")).toBeVisible();
  });

  test("[EVT-003] detalle: encabezado, estado y pestañas navegables sin errores", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento › Resumen → Invitadas → Operaciones → Finanzas → Memory Capsule");
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}`);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(page.getByText(ev.code).first()).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Secciones del evento" });
    await expect(nav.getByRole("link", { name: "Resumen" })).toHaveAttribute("aria-current", "page");
    for (const [tab, re] of [
      ["Invitadas", /\/guests$/],
      ["Operaciones", /\/operations$/],
      ["Finanzas", /\/financials$/],
      ["Memory Capsule", /\/memory$/],
      ["Resumen", new RegExp(`/admin/events/${ev.id}$`)],
    ] as const) {
      await nav.getByRole("link", { name: tab }).click();
      await expect(page).toHaveURL(re);
      await expect(nav.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    }
    // Panel de estado y enlaces privados
    await expect(page.getByRole("region", { name: "Estado" })).toContainText("Confirmado");
    await expect(page.getByRole("region", { name: "Enlaces privados" })).toContainText(`/mi-evento/${ev.portalToken}`);
  });

  test("[EVT-004] evento inexistente muestra «No encontramos este evento»", { tag: ["@P2", "@negative"] }, async ({ rolePage, guard, evidence }) => {
    evidence("owner", "URL manipulada /admin/events/<id inexistente>");
    // Next registra el 404 del documento como error de consola del navegador (esperado en esta prueba).
    guard.allow(/status of 404/);
    const page = await rolePage("owner");
    const res = await page.goto("/admin/events/ckzzzzzzzzzzzzzzzzzzzzzzz");
    await expect(page.getByRole("heading", { name: "No encontramos este evento" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver todos los eventos" })).toBeVisible();
    test.info().annotations.push({ type: "http-status", description: String(res?.status()) });
  });
});

test.describe("Eventos · alta manual", { tag: ["@module:events"] }, () => {
  test("[EVT-005] crear evento con nueva clienta persiste (INQUIRY, tokens, auditoría) y aparece en el listado", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Eventos › Nuevo evento › Nueva clienta › Crear evento");
    const date = await pickFreeDate(db);
    const name = `Clienta ${uniq("Alta")}`;
    const email = uniqEmail("alta");
    const phone = uniqPhone();
    const title = `Cumple ${uniq("Alta")}`;
    const page = await rolePage("owner");
    await openNew(page);
    await page.getByRole("button", { name: "Nueva clienta" }).click();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await page.getByLabel("WhatsApp").fill(phone);
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Título del evento").fill(title);
    await page.getByLabel("Homenajeada").fill("Sofi E2E");
    await page.getByLabel("Invitadas").fill("12");
    await page.getByRole("textbox", { name: "Fecha", exact: true }).fill(date);
    await expect(page.getByRole("status").filter({ hasText: "Fecha disponible." })).toBeVisible();
    await page.getByRole("button", { name: "Crear evento" }).click();
    // El aviso aparece al crear y dura 4 s; la navegación al detalle viene después (en WebKit tarda ~5 s), así que
    // se valida primero el aviso y luego la URL (mismo caso que FIN-006).
    await expect(page.getByText(/Evento EV-[A-Z0-9-]+ creado/)).toBeVisible();
    await page.waitForURL(/\/admin\/events\/(?!new)[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    const id = page.url().split("/").pop()!;
    const ev = await db.event.findUnique({ where: { id }, include: { customer: true } });
    expect(ev?.status).toBe("INQUIRY");
    expect(ev?.title).toBe(title);
    expect(ev?.guestCount).toBe(12);
    expect(ev?.honoreeName).toBe("Sofi E2E");
    expect(ev?.eventDate.toISOString().slice(0, 10)).toBe(date);
    expect(ev?.customer.name).toBe(name);
    expect(ev?.customer.email).toBe(email);
    expect(ev?.customer.source).toBe("MANUAL");
    expect(ev?.portalToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ev?.inviteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ev?.portalToken).not.toBe(ev?.inviteToken);
    const audit = await lastAudit(db, "event.created", id);
    expect(audit?.actorEmail).toBe("ivonne@ivonne-rosa.test");
    expect(audit?.after).toMatchObject({ status: "INQUIRY", eventDate: date, guestCount: 12, overrodeAvailability: false });

    await page.goto(`/admin/events?q=${encodeURIComponent(ev!.code)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByRole("table", { name: "Listado de eventos" })).toContainText("Consulta");
    await expect(page.getByRole("table", { name: "Listado de eventos" })).toContainText("Sin reserva");
  });

  test("[EVT-040] «Nueva clienta» deja Nombre, WhatsApp y Correo con su etiqueta aunque los ids del HTML y de React difieran", { tag: ["@P2", "@regression", "@a11y"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Nuevo evento › (ids pintados por el servidor ≠ ids de useId en el cliente) › Nueva clienta");
    test.info().annotations.push({ type: "regression", description: "EVT-005 (Firefox): «Nombre» sin etiqueta tras elegir Nueva clienta" });
    const page = await rolePage("owner");
    await openNew(page);
    // En Firefox, cuando la hidratación se reparte en varias pasadas, useId calcula en el cliente otro id que el
    // del HTML del servidor y React no reescribe atributos ya pintados: el <label for> y el <input id> del DOM
    // quedan con el valor del servidor y React guarda otro. Se reproduce aquí de forma determinista.
    const search = page.getByLabel("Buscar clienta");
    await search.evaluate((input) => {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (!label) throw new Error("«Buscar clienta» no tiene <label for>");
      input.id = "id-pintado-por-el-servidor";
      label.setAttribute("for", "id-pintado-por-el-servidor");
    });
    await expect(search, "el campo de búsqueda sigue etiquetado antes del cambio").toBeVisible();
    await page.getByRole("button", { name: "Nueva clienta" }).click();
    for (const name of ["Nombre", "WhatsApp", "Correo"]) {
      await expect(page.getByRole("textbox", { name, exact: true }), `«${name}» con etiqueta asociada`).toBeVisible();
    }
    // La etiqueta lleva el foco a su campo (asociación real, no sólo nombre accesible).
    await page.locator("label", { hasText: /^Nombre/ }).click();
    await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toBeFocused();
  });

  test("[EVT-006] crear evento para una clienta existente (búsqueda) la vincula sin duplicarla", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo evento › Buscar clienta › elegir resultado");
    const customer = await createCustomer(db, { name: `Mariela ${uniq("Busq")}` });
    const date = await pickFreeDate(db);
    const title = `Brunch ${uniq("Existente")}`;
    const page = await rolePage("owner");
    await openNew(page);
    await page.getByLabel("Buscar clienta").fill(customer.name);
    const results = page.getByRole("list", { name: "Resultados de búsqueda" });
    await results.getByRole("button", { name: new RegExp(customer.name) }).click();
    await expect(page.getByText(customer.name, { exact: true })).toBeVisible();
    await page.getByLabel("Título del evento").fill(title);
    await page.getByRole("textbox", { name: "Fecha", exact: true }).fill(date);
    await expect(page.getByRole("status").filter({ hasText: "Fecha disponible." })).toBeVisible();
    await page.getByRole("button", { name: "Crear evento" }).click();
    await page.waitForURL(/\/admin\/events\/(?!new)[a-z0-9]+$/);
    const ev = await db.event.findFirst({ where: { title } });
    expect(ev?.customerId).toBe(customer.id);
    expect(await db.customer.count({ where: { name: customer.name } })).toBe(1);
  });

  test("[EVT-007] fecha ocupada: aviso en vivo, confirmación explícita y auditoría del override", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo evento en fecha con capacidad llena (1/1) → Crear de todos modos");
    const busy = await createEventFixture(db, { status: "CONFIRMED" }); // martes-viernes: capacidad 1
    const customer = await createCustomer(db);
    const title = `Lleno ${uniq("E2E")}`;
    const page = await rolePage("owner");
    await openNew(page, `${NEW}?customer=${customer.id}&date=${busy.dateKey}`);
    await expect(page.getByText(customer.name, { exact: true })).toBeVisible();
    await page.getByLabel("Título del evento").fill(title);
    await expect(page.getByRole("status").filter({ hasText: "Ya no tenemos lugar ese día." })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Capacidad del día: 1 de 1 ocupados." })).toBeVisible();
    await page.getByRole("button", { name: "Crear evento" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "La fecha no está disponible" });
    await expect(alert).toContainText("Ya no tenemos lugar ese día.");
    expect(await db.event.count({ where: { title } }), "no se crea sin confirmar").toBe(0);
    await alert.getByRole("button", { name: "Crear de todos modos" }).click();
    await page.waitForURL(/\/admin\/events\/(?!new)[a-z0-9]+$/);
    const ev = await db.event.findFirst({ where: { title } });
    expect(ev?.status).toBe("INQUIRY");
    const audit = await lastAudit(db, "event.created", ev!.id);
    expect(audit?.after).toMatchObject({ availability: "FULL", overrodeAvailability: true });
  });

  test("[EVT-008] validaciones del alta en el formulario (clienta, título y fecha requeridos)", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo evento › Crear sin datos obligatorios");
    const title = `Inválido ${uniq("E2E")}`;
    const page = await rolePage("owner");
    await openNew(page);
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(page.getByText("Busca y elige a la clienta")).toBeVisible();
    await expect(page.getByText("Escribe un título (mín. 3 caracteres)")).toBeVisible();
    await expect(page.getByText("Elige una fecha válida")).toBeVisible();
    // Nueva clienta sin contacto
    await page.getByRole("button", { name: "Nueva clienta" }).click();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Ana");
    await page.getByLabel("Título del evento").fill(title);
    await page.getByLabel("Invitadas").fill("0");
    await page.getByRole("button", { name: "Crear evento" }).click();
    await expect(page.getByText("Agrega WhatsApp o correo para contactarla")).toBeVisible();
    await expect(page.getByText("Al menos 1 invitada")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/events\/new/);
    expect(await db.event.count({ where: { title } })).toBe(0);
  });

  test("[EVT-009] el backend rechaza altas inválidas aunque se salte la validación del cliente", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createEventAction directo con datos inválidos");
    const api = await apiAs("owner");
    const date = await pickFreeDate(db);
    const base = {
      customerMode: "new",
      customerId: "",
      newCustomer: { name: "Clienta Backend", email: uniqEmail("bk"), phone: "" },
      title: `Backend ${uniq("E2E")}`,
      occasion: "BIRTHDAY",
      honoreeName: "",
      date,
      startTime: "11:00",
      durationMinutes: 180,
      experienceId: "",
      guestCount: 10,
      serviceAreaId: "",
      addressLine: "",
      neighborhood: "",
      postalCode: "",
      internalNotes: "",
      confirmUnavailable: false,
    };
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ["invitadas 0", { guestCount: 0 }, "guestCount"],
      ["invitadas 201", { guestCount: 201 }, "guestCount"],
      ["duración 10 min", { durationMinutes: 10 }, "durationMinutes"],
      ["fecha imposible", { date: "2027-02-30" }, "date"],
      ["hora inválida", { startTime: "25:99" }, "startTime"],
      ["código postal", { postalCode: "123" }, "postalCode"],
      ["ocasión inexistente", { occasion: "FUNERAL" }, "occasion"],
    ];
    for (const [label, patch, field] of cases) {
      const r = await callAction(api, "createEventAction", { ...base, ...patch }, { path: NEW });
      expect(r.outcome, `${label}: ${d(r)}`).toBe("rejected");
      expect(r.code, label).toBe("VALIDATION_ERROR");
      expect(Object.keys(r.fieldErrors ?? {}), label).toContain(field);
    }
    const ghost = await callAction(api, "createEventAction", { ...base, customerMode: "existing", customerId: "ckghostcustomer000000001" }, { path: NEW });
    expect(ghost.outcome, d(ghost)).toBe("rejected");
    expect(ghost.fieldErrors?.customerId?.[0]).toBe("La clienta ya no existe.");
    expect(await db.event.count({ where: { title: base.title } }), "ninguna variante creó el evento").toBe(0);
  });

  test("[EVT-010] disponibilidad del alta: día cerrado, fecha pasada y fuera de horario", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "checkEventAvailabilityAction (lo usa el indicador en vivo del alta)");
    const api = await apiAs("owner");
    const monday = await pickFreeDate(db, { weekdays: [1] });
    const q = (date: string, startTime = "11:00", durationMinutes = 180) =>
      callAction<{ status: string; available: boolean; reason?: string }>(api, "checkEventAvailabilityAction", { date, startTime, durationMinutes, serviceAreaId: "", excludeEventId: "" }, { path: NEW });
    const closed = await q(monday);
    expect(closed.data).toMatchObject({ status: "CLOSED", available: false, reason: "No abrimos este día de la semana." });
    const past = await q(addDaysKey(todayKey(), -3));
    expect(past.data).toMatchObject({ status: "PAST", available: false });
    const sat = await pickFreeDate(db, { weekdays: [6] });
    const late = await q(sat, "20:00", 180);
    expect(late.data).toMatchObject({ status: "OUT_OF_HOURS", available: false });
    const soon = await q(addDaysKey(todayKey(), 1 + (weekdayOfKey(addDaysKey(todayKey(), 1)) === 1 ? 1 : 0)));
    expect(soon.data?.status, "anticipación mínima 5 días").toBe("TOO_SOON");
  });

  test("[EVT-011] doble clic en «Crear evento» genera un solo evento", { tag: ["@P3", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo evento › doble clic en Crear evento");
    const customer = await createCustomer(db);
    const date = await pickFreeDate(db);
    const title = `Doble ${uniq("E2E")}`;
    const page = await rolePage("owner");
    await openNew(page, `${NEW}?customer=${customer.id}&date=${date}`);
    await page.getByLabel("Título del evento").fill(title);
    await expect(page.getByRole("status").filter({ hasText: "Fecha disponible." })).toBeVisible();
    await page.getByRole("button", { name: "Crear evento" }).dblclick();
    await page.waitForURL(/\/admin\/events\/(?!new)[a-z0-9]+$/);
    await expect.poll(() => db.event.count({ where: { title } })).toBe(1);
  });

  test("[EVT-012] texto con HTML en el título se muestra escapado", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento con título <img onerror>");
    const marker = uniq("xss");
    const title = `<img src=x onerror="window.__xss='${marker}'"> Fiesta`;
    const ev = await createEventFixture(db, { title, status: "CONFIRMED" });
    const page = await rolePage("owner");
    await page.goto(`/admin/events/${ev.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.goto(`/admin/events?q=${encodeURIComponent(ev.code)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: string }).__xss)).toBeUndefined();
  });
});

test.describe("Eventos · edición", { tag: ["@module:events"] }, () => {
  test("[EVT-013] editar título, invitadas y notas persiste y audita los cambios sensibles", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento › Resumen › Detalles › Guardar cambios");
    const ev = await createEventFixture(db, { status: "CONFIRMED", guestCount: 10 });
    const newTitle = `${ev.title} (editado)`;
    const page = await rolePage("owner");
    const form = await openEventForm(page, ev.id);
    await form.getByRole("textbox", { name: "Título", exact: true }).fill(newTitle);
    await form.getByLabel("Invitadas").fill("14");
    await form.getByLabel("Notas internas").fill("Nota interna E2E");
    await expect(form.getByText("Tienes cambios sin guardar")).toBeVisible();
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Evento actualizado (invitadas quedó registrado en bitácora)")).toBeVisible();
    const after = await db.event.findUnique({ where: { id: ev.id } });
    expect(after).toMatchObject({ title: newTitle, guestCount: 14, internalNotes: "Nota interna E2E" });
    const audit = await lastAudit(db, "event.updated", ev.id);
    expect(audit?.before).toMatchObject({ guestCount: 10 });
    expect(audit?.after).toMatchObject({ guestCount: 14 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: newTitle })).toBeVisible();
    await expect(form.getByLabel("Invitadas")).toHaveValue("14");
  });

  test("[EVT-014] reprogramar a una fecha llena pide confirmación y mueve el horario", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Evento › cambiar fecha a día lleno → Guardar de todos modos");
    const busy = await createEventFixture(db, { status: "CONFIRMED" });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await rolePage("owner");
    const form = await openEventForm(page, ev.id);
    await form.getByRole("textbox", { name: "Fecha", exact: true }).fill(busy.dateKey);
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "El nuevo horario no está disponible" });
    await expect(alert).toContainText("Ya no tenemos lugar ese día.");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.eventDate.toISOString().slice(0, 10)).toBe(ev.dateKey);
    await alert.getByRole("button", { name: "Guardar de todos modos" }).click();
    await expect(page.getByText(/Evento actualizado \(fecha/)).toBeVisible();
    const moved = await db.event.findUnique({ where: { id: ev.id } });
    expect(moved?.eventDate.toISOString().slice(0, 10)).toBe(busy.dateKey);
    const audit = await lastAudit(db, "event.updated", ev.id);
    expect(audit?.after).toMatchObject({ overrodeAvailability: true });
    expect((audit?.after as { changed: string[] }).changed).toContain("eventDate");
  });

  test("[EVT-015] un evento completado o cancelado no se puede reprogramar (UI y backend)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Evento COMPLETED › fecha de sólo lectura + updateEventAction directo");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const page = await rolePage("owner");
    const form = await openEventForm(page, ev.id);
    await expect(form.getByText("Este evento ya no se puede reprogramar.")).toBeVisible();
    await expect(form.getByRole("textbox", { name: "Fecha", exact: true })).toHaveAttribute("readonly", "");
    const api = await apiAs("owner");
    const r = await callAction(
      api,
      "updateEventAction",
      {
        eventId: ev.id,
        title: ev.title,
        occasion: "BIRTHDAY",
        date: addDaysKey(ev.dateKey, 7),
        startTime: "11:00",
        endTime: "14:00",
        guestCount: 10,
        experienceId: "",
        menuId: "",
        styleId: "",
        serviceAreaId: "",
        addressLine: "",
        neighborhood: "",
        postalCode: "",
        mapsUrl: "",
        addressNotes: "",
        honoreeName: "",
        colors: "",
        dressCode: "",
        hostMessage: "",
        playlistUrl: "",
        customerNotes: "",
        internalNotes: "",
        micrositeEnabled: true,
        confirmUnavailable: true,
      },
      { path: `/admin/events/${ev.id}` },
    );
    expect(r.outcome, d(r)).toBe("rejected");
    expect(r.code).toBe("SCHEDULE_LOCKED");
    expect(r.error).toBe("No se puede reprogramar un evento completado.");
    expect((await db.event.findUnique({ where: { id: ev.id } }))?.eventDate.toISOString().slice(0, 10)).toBe(ev.dateKey);
  });

  test("[EVT-016] desactivar el micrositio deja sin efecto el link de invitación; reactivarlo lo restablece", { tag: ["@P2"] }, async ({ rolePage, anonPage, db, guard, evidence }) => {
    evidence("owner", "Evento › Micrositio activo (switch) → invitación 404");
    guard.allow(/status of 404/); // la invitación desactivada responde 404 a propósito
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const page = await rolePage("owner");
    const form = await openEventForm(page, ev.id);
    await form.getByRole("switch", { name: "Micrositio activo" }).click();
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Evento actualizado", { exact: true })).toBeVisible();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.micrositeEnabled).toBe(false);
    const guest = await anonPage();
    const res = await guest.goto(ev.invitePath);
    expect(res?.status()).toBe(404);
    await expect(guest.getByRole("heading", { name: "Esta invitación no está disponible" })).toBeVisible();
    await form.getByRole("switch", { name: "Micrositio activo" }).click();
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.micrositeEnabled).toBe(true);
    const ok = await guest.goto(ev.invitePath);
    expect(ok?.status()).toBe(200);
  });
});
