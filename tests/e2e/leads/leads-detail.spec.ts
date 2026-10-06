/**
 * Paquete 3 · Leads — captura manual, validaciones (front y back), duplicados, detalle, máquina de
 * estados, motivo de pérdida, asignación, actividad (timeline), edición, escape de HTML y auditoría.
 */
import { ACCOUNTS, createCustomer, createLead, expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { callAction, gotoReady, userByEmail, waitForDetail } from "../quotes/_helpers";

const LEAD_ACTION = "leads" as const;

test.describe("Leads · captura manual", { tag: ["@module:leads"] }, () => {
  test("[LEAD-002] crear lead manual: toast, detalle, clienta vinculada, timeline y persistencia", { tag: ["@P1", "@smoke", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Nuevo lead › Crear lead");
    const name = uniq("Clienta Manual");
    const email = uniqEmail("manual");
    const phone = uniqPhone();
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads");
    await page.getByRole("button", { name: "Nuevo lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo lead" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await dialog.getByLabel("Teléfono / WhatsApp").fill(`${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`);
    await dialog.getByLabel("Email").fill(email.toUpperCase());
    await dialog.getByLabel("Ocasión").selectOption("FRIENDS_BRUNCH");
    await dialog.getByLabel("Invitadas").fill("8");
    await dialog.getByLabel("Origen").selectOption("WHATSAPP");
    await dialog.getByRole("textbox", { name: "Notas", exact: true }).fill("Escribió por WhatsApp; quiere mimosas.");
    await dialog.getByRole("button", { name: "Crear lead" }).click();

    await waitForDetail(page, "/admin/leads");
    await expect(page.getByText(/^Lead L-[0-9A-Z]{4}-[0-9A-Z]{4} creado$/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    const lead = await db.lead.findFirst({ where: { name }, include: { customer: true, activities: true } });
    expect(lead).toBeTruthy();
    expect(lead!.status).toBe("NEW");
    expect(lead!.source).toBe("WHATSAPP");
    expect(lead!.occasion).toBe("FRIENDS_BRUNCH");
    expect(lead!.guestCount).toBe(8);
    expect(lead!.email).toBe(email.toLowerCase());
    expect(lead!.phone).toBe(phone);
    expect(lead!.code).toMatch(/^L-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const owner = await userByEmail(db, ACCOUNTS.owner.email);
    expect(lead!.assignedToId).toBe(owner.id);
    expect(lead!.customer?.email).toBe(email.toLowerCase());
    expect(lead!.customer?.source).toBe("WHATSAPP");
    expect(lead!.activities.map((a) => a.type)).toEqual(["CREATED"]);
    expect(lead!.activities[0]!.actorId).toBe(owner.id);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Escribió por WhatsApp; quiere mimosas.")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(lead!.customer!.name) })).toHaveAttribute("href", `/admin/customers/${lead!.customerId}`);
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("table").getByRole("link", { name })).toBeVisible();
  });

  test("[LEAD-003] requeridos vacíos: el formulario muestra errores y no llama al servidor", { tag: ["@P1", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Leads › Nuevo lead › Crear lead sin datos");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads");
    let actionPosts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"]) actionPosts++;
    });
    await page.getByRole("button", { name: "Nuevo lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo lead" });
    await dialog.getByRole("button", { name: "Crear lead" }).click();
    await expect(dialog.getByText("Escribe el nombre")).toBeVisible();
    await expect(dialog.getByText("Agrega al menos un teléfono o un correo")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Nombre", exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/admin\/leads$/);
    // Cancelar cierra sin crear
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    expect(actionPosts, "la validación del cliente no debe llamar al servidor").toBe(0);
  });

  test("[LEAD-004] formatos inválidos de teléfono y correo se rechazan en el formulario", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Nuevo lead › teléfono 123, correo inválido");
    const name = uniq("Formato Malo");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads");
    await page.getByRole("button", { name: "Nuevo lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo lead" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await dialog.getByLabel("Teléfono / WhatsApp").fill("123");
    await dialog.getByLabel("Email").fill("no-es-correo");
    await dialog.getByLabel("Invitadas").fill("600");
    await dialog.getByRole("button", { name: "Crear lead" }).click();
    await expect(dialog.getByText("Escribe un teléfono de 10 dígitos (puedes incluir lada +52)")).toBeVisible();
    await expect(dialog.getByText("Escribe un correo válido")).toBeVisible();
    await expect(dialog.getByText("Máximo 500")).toBeVisible();
    expect(await db.lead.count({ where: { name } })).toBe(0);
  });

  test("[LEAD-005] el servidor rechaza capturas inválidas aunque se salte el formulario", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createLeadAction directa con datos inválidos");
    const api = await apiAs("owner");
    const name = uniq("Backend Malo");
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ name: "A", email: uniqEmail(), occasion: "BIRTHDAY" }, "name", "Escribe el nombre"],
      [{ name, occasion: "BIRTHDAY" }, "phone", "Agrega al menos un teléfono o un correo"],
      [{ name, email: uniqEmail(), occasion: "BIRTHDAY", guestCount: 0 }, "guestCount", "Mínimo 1"],
      [{ name, email: uniqEmail(), occasion: "BIRTHDAY", guestCount: 501 }, "guestCount", "Máximo 500"],
      [{ name, email: uniqEmail(), occasion: "BIRTHDAY", guestCount: 7.5 }, "guestCount", "Escribe las invitadas sin decimales"],
      [{ name, email: uniqEmail(), occasion: "BIRTHDAY", eventDate: "2026-02-30" }, "eventDate", "Elige una fecha válida"],
      [{ name, email: uniqEmail(), occasion: "FIESTA" }, "occasion", ""],
      [{ name, email: "x@", occasion: "BIRTHDAY" }, "email", "Escribe un correo válido"],
      [{ name, phone: "55-12", occasion: "BIRTHDAY" }, "phone", "Escribe un teléfono de 10 dígitos (puedes incluir lada +52)"],
    ];
    for (const [payload, field, message] of cases) {
      const r = await callAction(api, LEAD_ACTION, "createLeadAction", payload);
      expect(r.result?.ok, JSON.stringify(payload)).toBe(false);
      if (r.result && !r.result.ok) {
        expect(r.result.code).toBe("VALIDATION_ERROR");
        expect(Object.keys(r.result.fieldErrors ?? {})).toContain(field);
        if (message) expect(r.result.fieldErrors?.[field]).toContain(message);
      }
    }
    expect(await db.lead.count({ where: { name } })).toBe(0);
  });

  test("[LEAD-006] duplicados: la misma clienta (correo con otra capitalización o mismo teléfono) se reutiliza", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createLeadAction con correo/teléfono de una clienta existente");
    const existing = await createCustomer(db, { name: uniq("Clienta Existente") });
    const api = await apiAs("owner");
    const byEmail = await callAction<{ leadId: string }>(api, LEAD_ACTION, "createLeadAction", {
      name: uniq("Otra Forma de Nombre"),
      email: existing.email!.toUpperCase(),
      occasion: "BIRTHDAY",
      source: "INSTAGRAM",
    });
    expect(byEmail.result?.ok, byEmail.raw.slice(0, 200)).toBe(true);
    const byPhone = await callAction<{ leadId: string }>(api, LEAD_ACTION, "createLeadAction", {
      name: uniq("Por Telefono"),
      phone: `${existing.phone!.slice(0, 2)} ${existing.phone!.slice(2, 6)} ${existing.phone!.slice(6)}`,
      occasion: "GATHERING",
    });
    expect(byPhone.result?.ok, byPhone.raw.slice(0, 200)).toBe(true);
    const leads = await db.lead.findMany({
      where: { id: { in: [byEmail.result!.ok ? byEmail.result!.data.leadId : "", byPhone.result!.ok ? byPhone.result!.data.leadId : ""] } },
    });
    expect(leads).toHaveLength(2);
    expect(new Set(leads.map((l) => l.customerId))).toEqual(new Set([existing.id]));
    expect(await db.customer.count({ where: { email: existing.email } })).toBe(1);
    const after = await db.customer.findUniqueOrThrow({ where: { id: existing.id }, include: { _count: { select: { leads: true } } } });
    expect(after._count.leads).toBe(2);
    expect(after.name).toBe(existing.name); // el nombre de la clienta no se sobrescribe
  });

  test("[LEAD-007] señales automáticas: grupo grande = consulta especial y zona escrita = fuera de cobertura", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Nuevo lead con 13 invitadas y otra zona");
    const name = uniq("Grupo Grande");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads");
    await page.getByRole("button", { name: "Nuevo lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo lead" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await dialog.getByLabel("Email").fill(uniqEmail("grande"));
    await dialog.getByLabel("Invitadas").fill("13");
    await dialog.getByLabel("Zona").selectOption("__other");
    await dialog.getByLabel("¿Dónde sería?").fill("Xochimilco");
    await dialog.getByRole("button", { name: "Crear lead" }).click();
    await waitForDetail(page, "/admin/leads");
    const lead = await db.lead.findFirstOrThrow({ where: { name } });
    expect(lead).toMatchObject({ specialRequest: true, outOfArea: true, zoneText: "Xochimilco", serviceAreaId: null, guestCount: 13 });
    await expect(page.getByText("Consulta especial", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Fuera de cobertura", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Consulta especial: el grupo supera el máximo estándar.", { exact: false })).toBeVisible();
    const created = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, type: "CREATED" } });
    expect(created.message).toContain("fuera de cobertura");
    expect(created.message).toContain("consulta especial (grupo grande)");
  });

  test("[LEAD-035] captura desde el panel con origen 'Captura manual' no envía notificaciones", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createLeadAction source=MANUAL → notificationLog");
    const r = await callAction<{ leadId: string }>(await apiAs("owner"), LEAD_ACTION, "createLeadAction", {
      name: uniq("Sin Aviso"),
      email: uniqEmail("sinaviso"),
      phone: uniqPhone(),
      occasion: "BIRTHDAY",
      source: "MANUAL",
    });
    expect(r.result?.ok).toBe(true);
    const leadId = r.result!.ok ? r.result!.data.leadId : "";
    expect(await db.notificationLog.count({ where: { leadId } })).toBe(0);
  });

  test("[LEAD-036] captura desde el panel con otro origen no avisa a la fundadora de su propio registro", { tag: ["@P3"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Nuevo lead (Origen: Instagram) → notificationLog");
    test.info().annotations.push({ type: "bug", description: "COM-BUG-01" });
    const name = uniq("Origen Insta");
    const email = uniqEmail("insta");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads");
    await page.getByRole("button", { name: "Nuevo lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo lead" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Origen").selectOption("INSTAGRAM");
    await dialog.getByRole("button", { name: "Crear lead" }).click();
    await waitForDetail(page, "/admin/leads");
    const lead = await db.lead.findFirstOrThrow({ where: { name } });
    const notes = await db.notificationLog.findMany({ where: { leadId: lead.id }, select: { type: true, channel: true, to: true, subject: true } });
    test.info().annotations.push({ type: "notificaciones", description: JSON.stringify(notes) });
    // La propia fundadora capturó el lead: un correo "Nuevo lead …" al equipo es ruido; y la clienta
    // recibe un "recibimos tu solicitud" automático por algo que el equipo registró a mano.
    expect(notes, "una captura desde el panel no debería disparar avisos de lead entrante").toEqual([]);
  });

  test("[LEAD-033] doble clic en Crear lead registra un solo lead", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Nuevo lead › doble clic en Crear lead");
    const name = uniq("Doble Click");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads");
    await page.getByRole("button", { name: "Nuevo lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo lead" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await dialog.getByLabel("Email").fill(uniqEmail("doble"));
    await dialog.getByRole("button", { name: "Crear lead" }).dblclick();
    await waitForDetail(page, "/admin/leads");
    await expect.poll(() => db.lead.count({ where: { name } })).toBe(1);
    // margen para una segunda petición tardía
    await page.reload();
    expect(await db.lead.count({ where: { name } })).toBe(1);
  });
});

test.describe("Leads · detalle y estados", { tag: ["@module:leads"] }, () => {
  test("[LEAD-015] detalle de un lead inexistente muestra 'Este lead no existe'", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/leads/<id inexistente>");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads/ckzzzzzzzzzzzzzzzzzzzzzzz");
    await expect(page.getByRole("heading", { name: "Este lead no existe" })).toBeVisible();
    await page.getByRole("link", { name: "Ver todos los leads" }).click();
    await expect(page).toHaveURL(/\/admin\/leads$/);
  });

  test("[LEAD-016] cambiar estado con nota: badge, timeline, base y auditoría", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Seguimiento › Mover a Calificado");
    const lead = await createLead(db, { name: uniq("Estado Nota") });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await page.getByLabel("Mover a").selectOption("QUALIFIED");
    await page.getByLabel("Nota (opcional)").fill("Confirmó presupuesto y fecha.");
    await page.getByRole("button", { name: "Actualizar estado" }).click();
    await expect(page.getByText("Estado actualizado a “Calificado”")).toBeVisible();
    await expect(page.getByText("Nuevo → Calificado")).toBeVisible();
    await expect(page.getByText("Confirmó presupuesto y fecha.")).toBeVisible();
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.status).toBe("QUALIFIED");
    const act = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, type: "STATUS_CHANGE" } });
    expect(act).toMatchObject({ fromStatus: "NEW", toStatus: "QUALIFIED", message: "Confirmó presupuesto y fecha." });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Lead", entityId: lead.id, action: "lead.status_changed" } });
    expect(audit.before).toMatchObject({ status: "NEW" });
    expect(audit.after).toMatchObject({ status: "QUALIFIED" });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner.email);
    await page.reload();
    // El selector ahora ofrece las transiciones desde QUALIFIED
    await expect(page.getByLabel("Mover a").getByRole("option")).toHaveText(["Elige un estado…", "Cotizado", "Perdido", "Contactado"]);
  });

  test("[LEAD-017] el selector sólo ofrece las transiciones válidas de leadStatusMachine (y WON es final)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Mover a (opciones por estado)");
    const page = await rolePage("owner");
    const expected: Record<string, string[] | null> = {
      NEW: ["Contactado", "Calificado", "Cotizado", "Perdido"],
      CONTACTED: ["Calificado", "Cotizado", "Perdido", "Nuevo"],
      QUOTED: ["Ganado", "Perdido", "Calificado"],
      LOST: ["Nuevo", "Contactado"],
      WON: null,
    };
    for (const [status, options] of Object.entries(expected)) {
      const lead = await createLead(db, { name: uniq(`Maquina ${status}`), status: status as never, lostReason: status === "LOST" ? "Sin respuesta" : null });
      await gotoReady(page, `/admin/leads/${lead.id}`);
      if (options) {
        await expect(page.getByLabel("Mover a").getByRole("option"), status).toHaveText(["Elige un estado…", ...options]);
      } else {
        await expect(page.getByText("Este lead está en “Ganado”, un estado final. Ya no admite cambios.")).toBeVisible();
        await expect(page.getByLabel("Mover a")).toHaveCount(0);
      }
    }
  });

  test("[LEAD-018] el servidor rechaza transiciones inválidas y no modifica el lead", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "changeLeadStatusAction NEW→WON, NEW→NEW, WON→NEW, LOST→QUOTED");
    const api = await apiAs("owner");
    const cases: Array<[string, string, RegExp]> = [
      ["NEW", "WON", /No es posible mover un lead de “Nuevo” a “Ganado”/],
      ["NEW", "NEW", /El lead ya está en “Nuevo”/],
      ["WON", "NEW", /No es posible mover un lead de “Ganado” a “Nuevo”/],
      ["LOST", "QUOTED", /No es posible mover un lead de “Perdido” a “Cotizado”/],
      ["QUOTED", "CONTACTED", /No es posible mover un lead de “Cotizado” a “Contactado”/],
    ];
    for (const [from, to, msg] of cases) {
      const lead = await createLead(db, { name: uniq(`Inv ${from}`), status: from as never, lostReason: from === "LOST" ? "x motivo" : null });
      const r = await callAction(api, LEAD_ACTION, "changeLeadStatusAction", { leadId: lead.id, toStatus: to }, { params: { id: lead.id } });
      expect(r.result?.ok, `${from}→${to}`).toBe(false);
      if (r.result && !r.result.ok) {
        expect(r.result.code).toBe("CONFLICT");
        expect(r.result.error).toMatch(msg);
      }
      const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(after.status).toBe(from);
      expect(await db.leadActivity.count({ where: { leadId: lead.id, type: "STATUS_CHANGE" } })).toBe(0);
    }
    // Lead inexistente
    const nf = await callAction(api, LEAD_ACTION, "changeLeadStatusAction", { leadId: "ckzzzzzzzzzzzzzzzzzzzzzz", toStatus: "CONTACTED" });
    expect(nf.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  test("[LEAD-019] Perdido sin motivo (o sólo espacios) se rechaza en el servidor", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "changeLeadStatusAction → LOST sin lostReason");
    const api = await apiAs("owner");
    const lead = await createLead(db, { name: uniq("Sin Motivo"), status: "CONTACTED" });
    for (const lostReason of [undefined, "", "   "]) {
      const r = await callAction(api, LEAD_ACTION, "changeLeadStatusAction", { leadId: lead.id, toStatus: "LOST", lostReason });
      expect(r.result?.ok, `lostReason=${JSON.stringify(lostReason)}`).toBe(false);
      if (r.result && !r.result.ok) expect(r.result.fieldErrors?.lostReason?.[0]).toBe("Cuéntanos por qué se perdió");
    }
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("CONTACTED");
  });

  test("[LEAD-020] marcar Perdido en el detalle exige motivo; reactivar limpia el motivo", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Mover a Perdido (motivo) › Mover a Nuevo");
    const lead = await createLead(db, { name: uniq("Perdida UI"), status: "QUALIFIED" });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await expect(page.getByRole("link", { name: "Crear cotización" }).first()).toBeVisible();
    await page.getByLabel("Mover a").selectOption("LOST");
    await page.getByRole("button", { name: "Actualizar estado" }).click();
    await expect(page.getByText("Cuéntanos por qué se perdió")).toBeVisible();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("QUALIFIED");
    await page.getByRole("button", { name: "Fuera de presupuesto" }).click();
    await expect(page.getByLabel("Motivo de pérdida")).toHaveValue("Fuera de presupuesto");
    await page.getByRole("button", { name: "Actualizar estado" }).click();
    await expect(page.getByText("Estado actualizado a “Perdido”")).toBeVisible();
    await expect(page.getByRole("note")).toHaveText("Motivo de pérdida: Fuera de presupuesto");
    await expect(page.getByRole("link", { name: "Crear cotización" })).toHaveCount(0);
    let db1 = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(db1).toMatchObject({ status: "LOST", lostReason: "Fuera de presupuesto" });
    const act = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, toStatus: "LOST" } });
    expect(act.message).toBe("Motivo: Fuera de presupuesto");

    await page.getByLabel("Mover a").selectOption("NEW");
    await page.getByRole("button", { name: "Actualizar estado" }).click();
    await expect(page.getByText("Estado actualizado a “Nuevo”")).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
    db1 = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(db1).toMatchObject({ status: "NEW", lostReason: null });
  });

  test("[LEAD-021] asignar y desasignar responsable: timeline y auditoría", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Seguimiento › Responsable");
    const lead = await createLead(db, { name: uniq("Asignable") });
    const rosa = await userByEmail(db, ACCOUNTS.owner2.email);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    const select = page.getByLabel("Responsable");
    await expect(select).toHaveValue("");
    await select.selectOption({ label: rosa.name });
    // Toast de confirmación y nueva entrada del timeline (la acción revalida la ruta). Antes de corregir
    // BUG-006 el timeline no se repintaba y sólo había un texto; ahora se valida cada uno por separado.
    await expect(page.getByText(`Asignado a ${rosa.name}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Asignado a ${rosa.name}.`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBe(rosa.id);
    const act = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, type: "ASSIGNED" } });
    expect(act.message).toBe(`Asignado a ${rosa.name}.`);
    await page.reload();
    await expect(page.getByLabel("Responsable")).toHaveValue(rosa.id);
    await page.getByLabel("Responsable").selectOption("");
    await expect(page.getByText("Lead sin asignar", { exact: true })).toBeVisible();
    await expect(page.getByText(`Se quitó la asignación de ${rosa.name}.`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBeNull();
    const audits = await db.auditLog.findMany({ where: { entityId: lead.id, action: "lead.assigned" }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.after)).toEqual([{ assignedToId: rosa.id }, { assignedToId: null }]);
    expect(await db.leadActivity.findFirst({ where: { leadId: lead.id, message: `Se quitó la asignación de ${rosa.name}.` } })).toBeTruthy();
  });

  test("[LEAD-022] no se puede asignar un lead a personal STAFF ni a un id inexistente (backend)", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("superadmin", "assignLeadAction con assigneeId de STAFF");
    const lead = await createLead(db, { name: uniq("Asigna Staff") });
    const staff = await userByEmail(db, ACCOUNTS.staff.email);
    const api = await apiAs("superadmin");
    for (const assigneeId of [staff.id, "ckzzzzzzzzzzzzzzzzzzzzzz"]) {
      const r = await callAction(api, LEAD_ACTION, "assignLeadAction", { leadId: lead.id, assigneeId });
      expect(r.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", error: "Sólo puedes asignar leads a fundadoras o administradoras activas." });
    }
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBeNull();
    expect(await db.leadActivity.count({ where: { leadId: lead.id, type: "ASSIGNED" } })).toBe(0);
  });
});

test.describe("Leads · actividad y edición", { tag: ["@module:leads"] }, () => {
  test("[LEAD-023] registrar un WhatsApp sobre un lead nuevo lo pasa a Contactado automáticamente", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Registrar contacto (WhatsApp)");
    const lead = await createLead(db, { name: uniq("Primer Contacto") });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await expect(page.getByText("Al guardar, el lead pasará automáticamente a “Contactado”.")).toBeVisible();
    await page.getByLabel("Resumen del contacto").fill("Le compartí opciones de menú y fechas.");
    await page.getByRole("button", { name: "Registrar contacto" }).click();
    await expect(page.getByText("Contacto registrado. El lead pasó a “Contactado”.")).toBeVisible();
    await expect(page.getByText("Nuevo → Contactado")).toBeVisible();
    await expect(page.getByText("Movido automáticamente al registrar el primer contacto.")).toBeVisible();
    await expect(page.getByText("Le compartí opciones de menú y fechas.")).toBeVisible();
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.status).toBe("CONTACTED");
    expect(after.lastContactedAt).not.toBeNull();
    const acts = await db.leadActivity.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });
    expect(acts.map((a) => a.type)).toEqual(["WHATSAPP", "STATUS_CHANGE"]);
    await expect(page.getByLabel("Resumen del contacto")).toHaveValue("");
  });

  test("[LEAD-024] una nota interna no cambia estado ni último contacto; mensaje corto se rechaza", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Registrar contacto › Nota");
    const lead = await createLead(db, { name: uniq("Nota Interna") });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await page.getByRole("group", { name: "Tipo" }).getByText("Nota", { exact: true }).click();
    await page.getByRole("textbox", { name: "Nota", exact: true }).fill("x");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("Escribe un breve resumen")).toBeVisible();
    expect(await db.leadActivity.count({ where: { leadId: lead.id } })).toBe(0);
    await page.getByRole("textbox", { name: "Nota", exact: true }).fill("Prefiere que la contacten por la tarde.");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("Nota guardada")).toBeVisible();
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.status).toBe("NEW");
    expect(after.lastContactedAt).toBeNull();
    expect(await db.leadActivity.findFirst({ where: { leadId: lead.id, type: "NOTE", message: "Prefiere que la contacten por la tarde." } })).toBeTruthy();
  });

  test("[LEAD-025] editar datos del lead: campos cambiados en timeline y auditoría; sin cambios avisa", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Editar datos › Guardar cambios");
    const lead = await createLead(db, { name: uniq("Editable") });
    const newName = uniq("Editada");
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await page.getByRole("button", { name: "Editar datos" }).click();
    let dialog = page.getByRole("dialog", { name: "Editar lead" });
    await dialog.getByRole("textbox", { name: "Nombre", exact: true }).fill(newName);
    await dialog.getByLabel("Invitadas").fill("10");
    await dialog.getByLabel("Colores").fill("salvia,  marfil , dorado");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Datos del lead guardados")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    await expect(page.getByText("Datos actualizados: nombre, invitadas, colores.")).toBeVisible();
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ name: newName, guestCount: 10, colors: ["salvia", "marfil", "dorado"] });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: lead.id, action: "lead.updated" } });
    expect(audit.before).toMatchObject({ name: lead.name, guestCount: 8 });
    expect(audit.after).toMatchObject({ name: newName, guestCount: 10 });

    await page.getByRole("button", { name: "Editar datos" }).click();
    dialog = page.getByRole("dialog", { name: "Editar lead" });
    await expect(dialog.getByLabel("Colores")).toHaveValue("salvia, marfil, dorado");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("No hubo cambios")).toBeVisible();
    expect(await db.auditLog.count({ where: { entityId: lead.id, action: "lead.updated" } })).toBe(1);
  });

  test("[LEAD-026] HTML/script en notas e inspiración se muestra escapado (sin ejecutar)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Editar datos con <img onerror>");
    const lead = await createLead(db, { name: uniq("XSS") });
    const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await page.getByRole("button", { name: "Editar datos" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar lead" });
    await dialog.getByRole("textbox", { name: "Notas", exact: true }).fill(payload);
    await dialog.getByLabel("Inspiración").fill(payload);
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Datos del lead guardados")).toBeVisible();
    await page.reload();
    await expect(page.getByText(payload, { exact: true })).toHaveCount(2);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).notes).toBe(payload);
  });

  test("[LEAD-027] editar con referencias de catálogo inexistentes se rechaza en el servidor", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "updateLeadAction con experienceId/menuId inexistentes");
    const lead = await createLead(db, { name: uniq("Ref Rota") });
    const api = await apiAs("owner");
    const r = await callAction(api, LEAD_ACTION, "updateLeadAction", {
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      occasion: "BIRTHDAY",
      experienceId: "ckzzzzzzzzzzzzzzzzzzzzzz",
      menuId: "ckyyyyyyyyyyyyyyyyyyyyyy",
    });
    expect(r.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", error: "Revisa las opciones elegidas." });
    if (r.result && !r.result.ok) {
      expect(r.result.fieldErrors?.experienceId).toEqual(["Esa experiencia ya no existe"]);
      expect(r.result.fieldErrors?.menuId).toEqual(["Ese menú ya no existe"]);
    }
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.experienceId).toBeNull();
    expect(after.menuId).toBeNull();
  });

  test("[LEAD-034] otra fundadora (Rosa) ve y opera el lead creado por Ivonne; la auditoría registra a quien actuó", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner2", "Ivonne crea (acción) · Rosa cambia estado (UI)");
    const created = await callAction<{ leadId: string; code: string }>(await apiAs("owner"), LEAD_ACTION, "createLeadAction", {
      name: uniq("Compartido"),
      email: uniqEmail("compartido"),
      occasion: "BRIDAL",
    });
    expect(created.result?.ok).toBe(true);
    const leadId = created.result!.ok ? created.result!.data.leadId : "";
    const page = await rolePage("owner2");
    await gotoReady(page, `/admin/leads/${leadId}`);
    await page.getByLabel("Mover a").selectOption("CONTACTED");
    await page.getByRole("button", { name: "Actualizar estado" }).click();
    await expect(page.getByText("Estado actualizado a “Contactado”")).toBeVisible();
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: leadId, action: "lead.status_changed" } });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner2.email);
    const timelineActor = await db.leadActivity.findFirstOrThrow({ where: { leadId, type: "STATUS_CHANGE" }, include: { actor: true } });
    expect(timelineActor.actor?.email).toBe(ACCOUNTS.owner2.email);
  });
});
