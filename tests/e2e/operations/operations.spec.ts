/**
 * Operaciones (paquete 5): tablero, orden de producción, checklist del evento, asignaciones de staff,
 * logística y notas de add-ons. Cada prueba crea su propio evento (el seed es sólo lectura).
 */
import {
  captureServerAction,
  expect,
  replayServerAction,
  test,
  wasAccepted,
} from "../fixtures";
import {
  actionError,
  assignStaff,
  at,
  auditCount,
  confirmAlert,
  createChecklistItem,
  createEvent,
  createStaffMember,
  dayKey,
  localInput,
  ready,
  staffMemberOf,
  swapInBody,
  toast,
  userIdOf,
} from "./_helpers";

const opsUrl = (id: string) => `/admin/events/${id}/operations`;

test.describe("Operaciones · tablero y orden de producción", { tag: ["@module:operations"] }, () => {
  test("[OPS-001] el tablero muestra los eventos de los próximos 14 días y enlaza a su orden de producción", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Operaciones › tablero → Orden de producción");
    const ev = await createEvent(db, { dateKey: dayKey(6), title: `Tablero ${Date.now()}` });
    const page = await rolePage("owner");
    await page.goto("/admin/operations");
    await expect(page.getByRole("heading", { level: 1, name: "Operaciones" })).toBeVisible();
    await expect(page.getByText("Eventos próximos")).toBeVisible();
    const card = page.getByRole("article").filter({ hasText: ev.title });
    await expect(card).toBeVisible();
    await expect(card.getByText("Sin checklist generado.")).toBeVisible();
    await expect(card.getByText("Falta coordinación")).toBeVisible();
    await card.getByRole("link", { name: "Orden de producción" }).click();
    await page.waitForURL(`**${opsUrl(ev.id)}`);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Orden de producción" })).toBeVisible();
    await page.goto("/admin/operations");
    await page.getByRole("link", { name: "Plantillas de checklist" }).click();
    await page.waitForURL("**/admin/operations/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Plantillas de checklist" })).toBeVisible();
  });

  test("[OPS-002] generar checklist desde plantillas crea las tareas activas una sola vez (idempotente)", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Orden de producción › Generar desde plantillas (2 veces)");
    const ev = await createEvent(db, { dateKey: dayKey(12) });
    const expected = await db.checklistTemplateItem.count({ where: { template: { active: true, experienceId: null } } });
    expect(expected, "el seed trae plantillas generales activas").toBeGreaterThan(0);
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const checklist = page.getByRole("region", { name: "Checklist", exact: true });
    await expect(checklist.getByText("Aún no hay checklist para este evento")).toBeVisible();
    await (await ready(checklist.getByRole("button", { name: "Generar desde plantillas" }).first())).click();
    await expect(toast(page, `Agregamos ${expected} tareas desde las plantillas.`)).toBeVisible();
    await expect.poll(() => db.eventChecklistItem.count({ where: { eventId: ev.id } })).toBe(expected);
    const items = await db.eventChecklistItem.findMany({ where: { eventId: ev.id } });
    expect(items.every((i) => i.templateItemId && i.status === "PENDING" && i.dueAt)).toBe(true);
    // dueAt = inicio del evento + desfase de la plantilla
    const sample = await db.eventChecklistItem.findFirstOrThrow({ where: { eventId: ev.id }, include: { templateItem: true } });
    expect(sample.dueAt!.getTime()).toBe(ev.startsAt.getTime() + sample.templateItem!.offsetMinutes * 60_000);

    await page.reload();
    await expect(checklist.getByRole("heading", { level: 3, name: "T-7 días" })).toBeVisible();
    await expect(checklist.getByRole("heading", { level: 3, name: "Cierre" })).toBeVisible();
    await expect(checklist.getByText(`${expected} tareas ·`)).toBeVisible();
    // Segunda vez: no duplica
    await checklist.getByRole("button", { name: "Generar desde plantillas" }).first().click();
    await expect(toast(page, "El checklist ya estaba al día con las plantillas.")).toBeVisible();
    expect(await db.eventChecklistItem.count({ where: { eventId: ev.id } })).toBe(expected);
  });

  test("[OPS-003] un evento cancelado no permite generar checklist (UI oculta + backend CONFLICT)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Captura instantiateChecklist en evento activo → replay con id de evento cancelado");
    const active = await createEvent(db, { dateKey: dayKey(15) });
    const cancelled = await createEvent(db, { dateKey: dayKey(16), status: "CANCELLED" });
    const page = await rolePage("owner");
    await page.goto(opsUrl(cancelled.id));
    await expect(page.getByRole("alert").filter({ hasText: "Este evento está cancelado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generar desde plantillas" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Asignar staff" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Agregar tarea" })).toHaveCount(0);

    await page.goto(opsUrl(active.id));
    const gen = await ready(page.getByRole("region", { name: "Checklist", exact: true }).getByRole("button", { name: "Generar desde plantillas" }).first());
    const captured = await captureServerAction(page, () => gen.click());
    await expect(toast(page, /Agregamos \d+ tareas/)).toBeVisible();
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, active.id, cancelled.id) });
    const err = actionError(res.text);
    expect(err.ok, res.text.slice(0, 200)).toBe(false);
    expect(err.code).toBe("CONFLICT");
    expect(await db.eventChecklistItem.count({ where: { eventId: cancelled.id } })).toBe(0);
  });

  test("[OPS-004] agregar una tarea personalizada la guarda con fase, área y evidencia y persiste al recargar", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Checklist › Agregar tarea");
    const ev = await createEvent(db, { dateKey: dayKey(18) });
    const title = `Recoger globos E2E ${Date.now()}`;
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Agregar tarea" }).first())).click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarea personalizada" });
    await dialog.getByLabel("Título").fill(title);
    await dialog.getByLabel("Fase").selectOption("T_MINUS_1");
    await dialog.getByLabel("Área").selectOption("ADDONS");
    await dialog.getByLabel("Fecha límite").fill(localInput(dayKey(17), "10:30"));
    await dialog.getByLabel("Descripción").fill("Con el proveedor de globos");
    await dialog.getByRole("checkbox", { name: "Requiere foto de evidencia" }).click();
    await dialog.getByRole("button", { name: "Agregar tarea" }).click();
    await expect(toast(page, "Tarea agregada")).toBeVisible();
    await expect(dialog).toBeHidden();
    const item = await db.eventChecklistItem.findFirstOrThrow({ where: { eventId: ev.id, title } });
    expect(item).toMatchObject({ phase: "T_MINUS_1", area: "ADDONS", requiresEvidence: true, status: "PENDING", templateItemId: null });
    expect(item.dueAt?.getTime()).toBe(at(dayKey(17), "10:30").getTime());
    await page.reload();
    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText("Personalizada")).toBeVisible();
    await expect(row.getByText("Requiere evidencia")).toBeVisible();
  });

  test("[OPS-005] la tarea personalizada exige título de 3+ caracteres (sin registro en base)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Checklist › Agregar tarea con título corto");
    const ev = await createEvent(db, { dateKey: dayKey(19) });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Agregar tarea" }).first())).click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarea personalizada" });
    await dialog.getByLabel("Título").fill("ab");
    await dialog.getByRole("button", { name: "Agregar tarea" }).click();
    await expect(dialog.getByText("Escribe un título (mínimo 3 caracteres).")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await db.eventChecklistItem.count({ where: { eventId: ev.id } })).toBe(0);
  });

  test("[OPS-006] cambiar el estado a Hecho registra fecha y autora; reabrir la limpia", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Checklist › estado Pendiente → Hecho → Pendiente");
    const ev = await createEvent(db, { dateKey: dayKey(20) });
    const item = await createChecklistItem(db, ev.id, { title: `Confirmar menú E2E ${Date.now()}` });
    const ownerId = await userIdOf(db, "owner");
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const status = await ready(page.getByRole("combobox", { name: `Estado de la tarea ${item.title}` }));
    await status.selectOption("DONE");
    await expect(toast(page, "Tarea completada")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.status).toBe("DONE");
    const done = await db.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(done.completedAt).not.toBeNull();
    expect(done.completedById).toBe(ownerId);
    await page.reload();
    await expect(page.getByRole("combobox", { name: `Estado de la tarea ${item.title}` })).toHaveValue("DONE");
    await expect(page.getByRole("listitem").filter({ hasText: item.title }).getByText(/Hecha .*Ivonne/)).toBeVisible();
    await page.getByRole("combobox", { name: `Estado de la tarea ${item.title}` }).selectOption("PENDING");
    await expect(toast(page, "Estado actualizado")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.completedAt).toBeNull();
  });

  test("[OPS-007] una tarea con evidencia obligatoria no se puede cerrar sin foto (UI y backend)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Checklist › Hecho sin evidencia + replay de updateChecklistItem con status DONE");
    const ev = await createEvent(db, { dateKey: dayKey(21) });
    const plain = await createChecklistItem(db, ev.id, { title: `Tarea normal E2E ${Date.now()}` });
    const photo = await createChecklistItem(db, ev.id, { title: `Foto de mesa E2E ${Date.now()}`, requiresEvidence: true, sortOrder: 2 });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("combobox", { name: `Estado de la tarea ${photo.title}` }))).selectOption("DONE");
    await expect(toast(page, "Esta tarea requiere una foto de evidencia antes de marcarse como hecha.")).toBeVisible();
    await expect(page.getByRole("combobox", { name: `Estado de la tarea ${photo.title}` })).toHaveValue("PENDING");
    // Backend: captura un cambio válido y lo repite apuntando a la tarea con evidencia y estado DONE
    const captured = await captureServerAction(page, () =>
      page.getByRole("combobox", { name: `Estado de la tarea ${plain.title}` }).selectOption("IN_PROGRESS"),
    );
    await expect(toast(page, "Estado actualizado")).toBeVisible();
    const body = swapInBody(captured.body, plain.id, photo.id).replace("IN_PROGRESS", "DONE");
    const res = await replayServerAction(await apiAs("owner"), captured, { body });
    const err = actionError(res.text);
    expect(err.ok, res.text.slice(0, 200)).toBe(false);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: photo.id } })).status).toBe("PENDING");
  });

  test("[OPS-008] responsable, notas y fecha límite de una tarea se guardan por separado (las notas no se borran)", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Checklist › Detalles: responsable, notas, fecha");
    const ev = await createEvent(db, { dateKey: dayKey(22) });
    const member = await createStaffMember(db, { name: `Responsable E2E ${Date.now()}` });
    const item = await createChecklistItem(db, ev.id, { title: `Llamar a florista E2E ${Date.now()}` });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const row = page.getByRole("listitem").filter({ hasText: item.title });
    await (await ready(row.getByRole("button", { name: "Detalles" }))).click();
    await row.getByLabel("Notas").fill("Proveedor confirma a las 10:00");
    await row.getByRole("button", { name: "Guardar notas" }).click();
    await expect(toast(page, "Notas guardadas")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.notes).toBe("Proveedor confirma a las 10:00");
    await page.getByRole("combobox", { name: `Responsable de ${item.title}` }).selectOption(member.id);
    await expect(toast(page, "Responsable actualizado")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.assigneeId).toBe(member.id);
    const due = localInput(dayKey(20), "18:15");
    await row.getByLabel("Fecha límite (hora CDMX)").fill(due);
    await row.getByRole("button", { name: "Guardar fecha" }).click();
    await expect(toast(page, "Fecha actualizada")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.dueAt?.getTime()).toBe(at(dayKey(20), "18:15").getTime());
    const final = await db.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(final.notes, "cambiar responsable/fecha no borra las notas").toBe("Proveedor confirma a las 10:00");
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: item.title }).getByText(new RegExp(`· ${member.name}`))).toBeVisible();
  });

  test("[OPS-009] eliminar una tarea la quita del checklist y queda en auditoría", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Checklist › Detalles › Eliminar tarea");
    const ev = await createEvent(db, { dateKey: dayKey(23) });
    const item = await createChecklistItem(db, ev.id, { title: `Tarea a eliminar E2E ${Date.now()}` });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const row = page.getByRole("listitem").filter({ hasText: item.title });
    await (await ready(row.getByRole("button", { name: "Detalles" }))).click();
    await row.getByRole("button", { name: "Eliminar tarea" }).click();
    await confirmAlert(page, "Eliminar");
    await expect(toast(page, "Tarea eliminada")).toBeVisible();
    await expect.poll(() => db.eventChecklistItem.count({ where: { id: item.id } })).toBe(0);
    expect(await auditCount(db, "checklist.item_deleted", item.id)).toBe(1);
    await page.reload();
    await expect(page.getByText(item.title)).toHaveCount(0);
  });

  test("[OPS-021] las tareas vencidas aparecen en el tablero con enlace al checklist del evento", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Operaciones › Tareas vencidas");
    const ev = await createEvent(db, { dateKey: dayKey(5) });
    const item = await createChecklistItem(db, ev.id, { title: `Vencida E2E ${Date.now()}`, dueAt: new Date(Date.now() - 3 * 3_600_000) });
    const page = await rolePage("owner");
    await page.goto("/admin/operations");
    const row = page.getByRole("row").filter({ hasText: item.title });
    await expect(row).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: ev.title }).getByText("1 vencida")).toBeVisible();
    await row.getByRole("link", { name: ev.title }).click();
    await page.waitForURL(`**${opsUrl(ev.id)}#checklist`);
    await expect(page.getByRole("listitem").filter({ hasText: item.title }).getByText("Vencida", { exact: true })).toBeVisible();
  });
});

test.describe("Operaciones · staff del evento", { tag: ["@module:operations"] }, () => {
  test("[OPS-010] asignar staff crea la asignación con su tarifa, notifica y el enlace lleva a /staff/events/<id>", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Staff › Asignar staff (Lupita) → NotificationLog STAFF_ASSIGNED → staff abre el enlace");
    const ev = await createEvent(db, { dateKey: dayKey(24), title: `Asignación E2E ${Date.now()}` });
    const lupita = await staffMemberOf(db, "staff");
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const staffSection = page.getByRole("region", { name: "Staff", exact: true });
    await expect(staffSection.getByText("Nadie asignado todavía")).toBeVisible();
    await (await ready(staffSection.getByRole("button", { name: "Asignar staff" }))).click();
    const dialog = page.getByRole("dialog", { name: "Asignar staff" });
    await dialog.getByLabel("Integrante").selectOption(lupita.id);
    await expect(dialog.getByLabel("Función en este evento")).toHaveValue("COORDINATOR");
    await dialog.getByRole("button", { name: "Asignar", exact: true }).click();
    await expect(toast(page, "Staff asignado y notificado")).toBeVisible();
    const a = await db.staffAssignment.findFirstOrThrow({ where: { eventId: ev.id, staffMemberId: lupita.id } });
    expect(a.function).toBe("COORDINATOR");
    expect(a.amountCents, "tarifa por evento de Lupita").toBe(lupita.rateCents);
    expect(await auditCount(db, "staff_assignment.created", a.id)).toBe(1);
    await expect.poll(() => db.notificationLog.count({ where: { eventId: ev.id, type: "STAFF_ASSIGNED" } })).toBe(2);
    const notes = await db.notificationLog.findMany({ where: { eventId: ev.id, type: "STAFF_ASSIGNED" } });
    expect(notes.map((n) => n.channel).sort()).toEqual(["EMAIL", "WHATSAPP"]);
    for (const n of notes) {
      expect(n.actionUrl, `enlace de ${n.channel}`).toMatch(new RegExp(`/staff/events/${ev.id}$`));
    }
    await page.reload();
    await expect(staffSection.getByRole("link", { name: lupita.name })).toBeVisible();
    await expect(staffSection.getByText("Falta coordinación")).toHaveCount(0);
    // El enlace de la notificación funciona para la persona asignada
    const staff = await rolePage("staff");
    await staff.goto(new URL(notes[0]!.actionUrl!).pathname);
    await expect(staff.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
  });

  test("[OPS-011] no se puede asignar dos veces a la misma persona con la misma función", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Staff › Asignar duplicado");
    const ev = await createEvent(db, { dateKey: dayKey(25) });
    const member = await createStaffMember(db, { name: `Duplicada E2E ${Date.now()}`, primaryFunction: "SERVER" });
    await assignStaff(db, ev.id, member.id, "SERVER");
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Asignar staff" }))).click();
    const dialog = page.getByRole("dialog", { name: "Asignar staff" });
    await dialog.getByLabel("Integrante").selectOption(member.id);
    await dialog.getByRole("button", { name: "Asignar", exact: true }).click();
    await expect(dialog.getByText("Ya asignada con esta función.")).toBeVisible();
    expect(await db.staffAssignment.count({ where: { eventId: ev.id, staffMemberId: member.id } })).toBe(1);
  });

  test("[OPS-012] la hora de salida debe ser posterior a la de entrada", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Staff › Asignar con horario invertido");
    const dk = dayKey(26);
    const ev = await createEvent(db, { dateKey: dk });
    const member = await createStaffMember(db, { name: `Horario E2E ${Date.now()}` });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Asignar staff" }))).click();
    const dialog = page.getByRole("dialog", { name: "Asignar staff" });
    await dialog.getByLabel("Integrante").selectOption(member.id);
    await dialog.getByLabel("Entrada").fill(localInput(dk, "15:00"));
    await dialog.getByLabel("Salida").fill(localInput(dk, "11:00"));
    await dialog.getByRole("button", { name: "Asignar", exact: true }).click();
    await expect(dialog.getByText("La hora de salida debe ser posterior a la de entrada.")).toBeVisible();
    expect(await db.staffAssignment.count({ where: { eventId: ev.id } })).toBe(0);
  });

  test("[OPS-013] confirmar y marcar como pagada una asignación persiste y audita el pago", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Staff › switches Confirmada / Pagada");
    const ev = await createEvent(db, { dateKey: dayKey(27) });
    const member = await createStaffMember(db, { name: `Pago E2E ${Date.now()}` });
    const a = await assignStaff(db, ev.id, member.id, "SERVER", { confirmed: false, paid: false });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("switch", { name: `Confirmado: ${member.name}` }))).click();
    await expect(toast(page, "Actualizado")).toBeVisible();
    await expect.poll(async () => (await db.staffAssignment.findUnique({ where: { id: a.id } }))?.confirmed).toBe(true);
    await page.getByRole("switch", { name: `Pagado: ${member.name}` }).click();
    await expect.poll(async () => (await db.staffAssignment.findUnique({ where: { id: a.id } }))?.paid).toBe(true);
    expect(await auditCount(db, "staff_assignment.paid_changed", a.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("switch", { name: `Confirmado: ${member.name}` })).toBeChecked();
    await expect(page.getByRole("switch", { name: `Pagado: ${member.name}` })).toBeChecked();
  });

  test("[OPS-014] editar una asignación cambia función y monto acordado (centavos) y lo audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Staff › Editar asignación");
    const ev = await createEvent(db, { dateKey: dayKey(28) });
    const member = await createStaffMember(db, { name: `Edición E2E ${Date.now()}` });
    const a = await assignStaff(db, ev.id, member.id, "SERVER");
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Editar asignación de ${member.name}` }))).click();
    const dialog = page.getByRole("dialog", { name: "Editar asignación" });
    await dialog.getByLabel("Función en este evento").selectOption("HOST");
    await dialog.getByLabel("Monto acordado").fill("1,500.50");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Asignación actualizada")).toBeVisible();
    await expect.poll(async () => (await db.staffAssignment.findUnique({ where: { id: a.id } }))?.function).toBe("HOST");
    expect((await db.staffAssignment.findUniqueOrThrow({ where: { id: a.id } })).amountCents).toBe(150_050);
    expect(await auditCount(db, "staff_assignment.updated", a.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("region", { name: "Staff", exact: true }).getByText("$1,500.50").first()).toBeVisible();
  });

  test("[OPS-015] quitar una asignación libera sus tareas abiertas y el staff deja de ver el evento", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Staff › Quitar a Lupita; luego staff abre /staff/events/<id>");
    const ev = await createEvent(db, { dateKey: dayKey(29), title: `Quitar E2E ${Date.now()}` });
    const lupita = await staffMemberOf(db, "staff");
    const a = await assignStaff(db, ev.id, lupita.id, "COORDINATOR");
    const task = await createChecklistItem(db, ev.id, { title: `Tarea de Lupita E2E ${Date.now()}`, assigneeId: lupita.id });
    const staff = await rolePage("staff");
    await staff.goto(`/staff/events/${ev.id}`);
    await expect(staff.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();

    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: `Quitar a ${lupita.name}` }))).click();
    await confirmAlert(page, "Quitar");
    await expect(toast(page, "Asignación eliminada")).toBeVisible();
    await expect.poll(() => db.staffAssignment.count({ where: { id: a.id } })).toBe(0);
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: task.id } })).assigneeId).toBeNull();
    expect(await auditCount(db, "staff_assignment.deleted", a.id)).toBe(1);
    await staff.reload();
    await expect(staff.getByText("No encontramos este evento")).toBeVisible();
    await expect(staff.getByText(ev.title)).toHaveCount(0);
  });

  test("[OPS-019] la orden de un evento cancelado es de sólo referencia (sin asignar ni editar logística)", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Orden de producción de evento cancelado");
    const ev = await createEvent(db, { dateKey: dayKey(30), status: "CANCELLED" });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await expect(page.getByRole("alert").filter({ hasText: "no se pueden asignar personas ni generar tareas" })).toBeVisible();
    await expect(page.getByLabel("Salida de bodega")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Guardar logística" })).toHaveCount(0);
  });

  test("[OPS-020] la orden de producción de un evento inexistente muestra «no encontrado»", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence, guard }) => {
    evidence("owner", "/admin/events/<id inexistente>/operations");
    guard.allow(/404/); // respuesta esperada de notFound()
    const page = await rolePage("owner");
    await page.goto(opsUrl("ckinexistente000000000000"));
    await expect(page.getByRole("heading", { name: /No encontramos este (evento|registro)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Orden de producción" })).toHaveCount(0);
  });
});

test.describe("Operaciones · logística y add-ons", { tag: ["@module:operations"] }, () => {
  test("[OPS-016] guardar salida, montaje y desmontaje persiste en hora CDMX y queda en auditoría", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Transporte y montaje › Guardar logística");
    const dk = dayKey(31);
    const ev = await createEvent(db, { dateKey: dk, start: "12:00", end: "16:00" });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const section = page.getByRole("region", { name: "Transporte y montaje" });
    await (await ready(section.getByLabel("Salida de bodega"))).fill(localInput(dk, "09:00"));
    await section.getByLabel("Inicio de montaje").fill(localInput(dk, "10:00"));
    await section.getByLabel("Desmontaje").fill(localInput(dk, "16:30"));
    await section.getByRole("button", { name: "Guardar logística" }).click();
    await expect(toast(page, "Logística guardada")).toBeVisible();
    await expect.poll(async () => (await db.event.findUnique({ where: { id: ev.id } }))?.departureAt?.getTime()).toBe(at(dk, "09:00").getTime());
    const saved = await db.event.findUniqueOrThrow({ where: { id: ev.id } });
    expect(saved.setupStartsAt?.getTime()).toBe(at(dk, "10:00").getTime());
    expect(saved.teardownAt?.getTime()).toBe(at(dk, "16:30").getTime());
    expect(await auditCount(db, "event.logistics_updated", ev.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("region", { name: "Transporte y montaje" }).getByLabel("Inicio de montaje")).toHaveValue(localInput(dk, "10:00"));
  });

  test("[OPS-017] el montaje después del inicio del evento se rechaza en el servidor (sin cambios)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Transporte y montaje › montaje 13:00 para evento de 12:00");
    const dk = dayKey(32);
    const ev = await createEvent(db, { dateKey: dk, start: "12:00", end: "16:00" });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const section = page.getByRole("region", { name: "Transporte y montaje" });
    await (await ready(section.getByLabel("Inicio de montaje"))).fill(localInput(dk, "13:00"));
    await section.getByRole("button", { name: "Guardar logística" }).click();
    await expect(section.getByText("El montaje debe empezar antes del inicio del evento.")).toBeVisible();
    // Validación del cliente: salida después del montaje
    await section.getByLabel("Salida de bodega").fill(localInput(dk, "11:00"));
    await section.getByLabel("Inicio de montaje").fill(localInput(dk, "10:00"));
    await section.getByRole("button", { name: "Guardar logística" }).click();
    await expect(section.getByText("El montaje debe empezar después de la salida.")).toBeVisible();
    const saved = await db.event.findUniqueOrThrow({ where: { id: ev.id } });
    expect([saved.departureAt, saved.setupStartsAt, saved.teardownAt]).toEqual([null, null, null]);
    expect(await auditCount(db, "event.logistics_updated", ev.id)).toBe(0);
  });

  test("[OPS-018] las notas operativas de un add-on se guardan y las ve el staff asignado", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Add-ons › Guardar notas; staff (Lupita) ve la nota en su portal");
    const ev = await createEvent(db, { dateKey: dayKey(33), title: `Add-on E2E ${Date.now()}` });
    const addOn = await db.addOn.findFirstOrThrow({ where: { active: true }, select: { id: true, name: true } });
    const ea = await db.eventAddOn.create({ data: { eventId: ev.id, addOnId: addOn.id, quantity: 1, priceCents: 50_000, costCents: 20_000 } });
    const lupita = await staffMemberOf(db, "staff");
    await assignStaff(db, ev.id, lupita.id, "COORDINATOR");
    const note = `Entregar a las 9:00 en recepción ${Date.now()}`;
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    const section = page.getByRole("region", { name: "Add-ons" });
    await (await ready(section.getByLabel(`Notas operativas de ${addOn.name}`))).fill(note);
    await section.getByRole("button", { name: "Guardar notas" }).click();
    await expect(toast(page, "Notas guardadas")).toBeVisible();
    await expect.poll(async () => (await db.eventAddOn.findUnique({ where: { id: ea.id } }))?.notes).toBe(note);
    const staff = await rolePage("staff");
    await staff.goto(`/staff/events/${ev.id}`);
    await expect(staff.getByRole("region", { name: "Add-ons y estilo" }).getByText(note)).toBeVisible();
  });
});

test.describe("Operaciones · replay sanity", { tag: ["@module:operations"] }, () => {
  test("[OPS-030] la acción de asignar staff repetida por la fundadora es idempotente respecto a duplicados (backend)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Captura createAssignment y replay idéntico → rechazo por duplicado");
    const ev = await createEvent(db, { dateKey: dayKey(34) });
    const member = await createStaffMember(db, { name: `Replay E2E ${Date.now()}` });
    const page = await rolePage("owner");
    await page.goto(opsUrl(ev.id));
    await (await ready(page.getByRole("button", { name: "Asignar staff" }))).click();
    const dialog = page.getByRole("dialog", { name: "Asignar staff" });
    await dialog.getByLabel("Integrante").selectOption(member.id);
    const captured = await captureServerAction(page, () => dialog.getByRole("button", { name: "Asignar", exact: true }).click());
    await expect(toast(page, "Staff asignado y notificado")).toBeVisible();
    const res = await replayServerAction(await apiAs("owner"), captured);
    expect(wasAccepted(res), "el duplicado no debe aceptarse").toBe(false);
    expect(actionError(res.text).code).toBe("VALIDATION_ERROR");
    expect(await db.staffAssignment.count({ where: { eventId: ev.id, staffMemberId: member.id } })).toBe(1);
  });
});
