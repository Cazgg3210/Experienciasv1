/**
 * Portal de staff (/staff): sólo eventos asignados, detalle, tareas propias (marcar, notas, evidencia),
 * sólo lectura para tareas de otras personas y eventos no asignados denegados.
 * Los recorridos que mutan usan eventos PROPIOS con Lupita (staff) asignada por Prisma.
 */
import { captureServerAction, expect, replayServerAction, scanA11y, test } from "../fixtures";
import {
  actionError,
  assignStaff,
  blocked,
  createChecklistItem,
  createEvent,
  createStaffMember,
  dayKey,
  formatMXN,
  horizontalOverflow,
  PNG_1PX,
  ready,
  staffMemberOf,
  storageAvailable,
  swapInBody,
  toast,
  userIdOf,
} from "../operations/_helpers";

const SEED_LUPITA_EVENTS = ["Cumpleaños de Sofía", "Karaoke & Mimosas de Daniela"];
const SEED_NOT_ASSIGNED = "Bridal Brunch de Mariana";

async function upcomingTitlesFor(db: import("@prisma/client").PrismaClient, staffMemberId: string) {
  const rows = await db.staffAssignment.findMany({
    where: { staffMemberId, event: { status: { notIn: ["CANCELLED", "COMPLETED"] }, endsAt: { gte: new Date() } } },
    select: { event: { select: { title: true } } },
  });
  return new Set(rows.map((r) => r.event.title));
}

test.describe("Portal de staff · eventos asignados", { tag: ["@module:staff"] }, () => {
  test("[STF-001] Lupita ve sólo sus eventos asignados (Sofía y Daniela, no Mariana)", { tag: ["@P0", "@critical", "@smoke", "@mobile"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "/staff");
    const lupita = await staffMemberOf(db, "staff");
    const page = await rolePage("staff");
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
    await expect(page.getByText("Hola, Lupita.")).toBeVisible();
    const list = page.getByRole("list", { name: "Eventos próximos" });
    for (const t of SEED_LUPITA_EVENTS) await expect(list.getByRole("heading", { name: t })).toBeVisible();
    await expect(page.getByText(SEED_NOT_ASSIGNED)).toHaveCount(0);
    const shown = await list.getByRole("heading", { level: 2 }).allInnerTexts();
    const allowed = await upcomingTitlesFor(db, lupita.id);
    for (const title of shown) expect(allowed.has(title.trim()), `"${title}" debe estar asignado a Lupita`).toBe(true);
  });

  test("[STF-002] Carlos (staff2) ve sus eventos asignados y no los ajenos", { tag: ["@P1", "@mobile"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff2", "/staff");
    const carlos = await staffMemberOf(db, "staff2");
    const page = await rolePage("staff2");
    await page.goto("/staff");
    await expect(page.getByText("Hola, Carlos.")).toBeVisible();
    const list = page.getByRole("list", { name: "Eventos próximos" });
    await expect(list.getByRole("heading", { name: "Cumpleaños de Sofía" })).toBeVisible();
    await expect(page.getByText(SEED_NOT_ASSIGNED)).toHaveCount(0);
    const shown = await list.getByRole("heading", { level: 2 }).allInnerTexts();
    const allowed = await upcomingTitlesFor(db, carlos.id);
    for (const title of shown) expect(allowed.has(title.trim()), `"${title}" debe estar asignado a Carlos`).toBe(true);
  });

  test("[STF-008] un evento no asignado abierto por URL responde «No encontramos este evento» sin filtrar datos", { tag: ["@P0", "@negative"] }, async ({ rolePage, db, evidence, guard }) => {
    evidence("staff", "/staff/events/<id de Bridal Brunch de Mariana>");
    guard.allow(/404/); // notFound() esperado
    const mariana = await db.event.findFirstOrThrow({ where: { title: SEED_NOT_ASSIGNED }, include: { customer: true } });
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${mariana.id}`);
    await expect(page.getByText("No encontramos este evento")).toBeVisible();
    await expect(page.getByText(SEED_NOT_ASSIGNED)).toHaveCount(0);
    await expect(page.getByText(mariana.customer.name)).toHaveCount(0);
  });

  test("[STF-023] un evento asignado pero cancelado ya no aparece ni se puede abrir", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence, guard }) => {
    evidence("staff", "Evento propio CANCELLED con Lupita asignada");
    guard.allow(/404/);
    const ev = await createEvent(db, { dateKey: dayKey(9), status: "CANCELLED", title: `Cancelado staff E2E ${Date.now()}` });
    const lupita = await staffMemberOf(db, "staff");
    await assignStaff(db, ev.id, lupita.id, "COORDINATOR");
    const page = await rolePage("staff");
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
    await expect(page.getByText(ev.title)).toHaveCount(0);
    await page.goto(`/staff/events/${ev.id}`);
    await expect(page.getByText("No encontramos este evento")).toBeVisible();
  });

  test("[STF-009] el detalle muestra horario y equipo pero nunca montos; el teléfono de la clienta sólo a coordinación/chofer", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "Lupita (COORDINATOR) y Carlos (CHEF) en el mismo evento propio");
    const ev = await createEvent(db, { dateKey: dayKey(11), title: `Privacidad staff E2E ${Date.now()}`, customer: { phone: "5512345678", whatsapp: null } });
    const lupita = await staffMemberOf(db, "staff");
    const carlos = await staffMemberOf(db, "staff2");
    await assignStaff(db, ev.id, lupita.id, "COORDINATOR", { amountCents: 123_400 });
    await assignStaff(db, ev.id, carlos.id, "CHEF", { amountCents: 98_700 });
    const coord = await rolePage("staff");
    await coord.goto(`/staff/events/${ev.id}`);
    await expect(coord.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(coord.getByRole("region", { name: "Mi horario" }).getByText("Coordinación")).toBeVisible();
    await expect(coord.getByRole("link", { name: "Llamar a Clienta" })).toBeVisible();
    const coordText = await coord.locator("main").innerText();
    expect(coordText).not.toContain(formatMXN(123_400));
    expect(coordText).not.toContain(formatMXN(98_700));

    const chef = await rolePage("staff2");
    await chef.goto(`/staff/events/${ev.id}`);
    await expect(chef.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    await expect(chef.getByRole("link", { name: "Llamar a Lupita Hernández" }), "el chef sí ve a coordinación").toBeVisible();
    await expect(chef.getByRole("link", { name: "Llamar a Clienta" }), "el chef no ve el teléfono de la clienta").toHaveCount(0);
    expect(await chef.locator("main").innerText()).not.toContain("5512345678");
    expect(await chef.locator("main").innerText()).not.toContain(formatMXN(98_700));
  });
});

test.describe("Portal de staff · tareas", { tag: ["@module:staff"] }, () => {
  async function setup(db: import("@prisma/client").PrismaClient, extra: { requiresEvidence?: boolean } = {}) {
    const ev = await createEvent(db, { dateKey: dayKey(13), title: `Portal staff E2E ${Date.now()}` });
    const lupita = await staffMemberOf(db, "staff");
    await assignStaff(db, ev.id, lupita.id, "COORDINATOR");
    const item = await createChecklistItem(db, ev.id, {
      title: `Tarea de Lupita E2E ${Date.now()}`,
      assigneeId: lupita.id,
      requiresEvidence: extra.requiresEvidence ?? false,
    });
    return { ev, lupita, item };
  }

  test("[STF-003] marcar una tarea como hecha persiste y la fundadora la ve completada por Lupita", { tag: ["@P0", "@critical", "@mobile"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "Portal › Marcar como hecha; owner revisa la orden de producción");
    const { ev, item } = await setup(db);
    const lupitaUser = await userIdOf(db, "staff");
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.id}`);
    const card = page.getByRole("listitem").filter({ hasText: item.title });
    await (await ready(card.getByRole("button", { name: "Marcar como hecha" }))).click();
    await expect(toast(page, "¡Tarea hecha!")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.status).toBe("DONE");
    const done = await db.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(done.completedById).toBe(lupitaUser);
    expect(done.completedAt).not.toBeNull();
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: item.title }).getByRole("button", { name: "Reabrir" })).toBeVisible();

    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/operations`);
    await expect(owner.getByRole("combobox", { name: `Estado de la tarea ${item.title}` })).toHaveValue("DONE");
    await expect(owner.getByRole("listitem").filter({ hasText: item.title }).getByText(/Hecha .*Lupita/)).toBeVisible();
  });

  test("[STF-004] empezar, volver a pendiente y reabrir cambian el estado en la base", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "Portal › Empezar → Volver a pendiente");
    const { ev, item } = await setup(db);
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.id}`);
    const card = () => page.getByRole("listitem").filter({ hasText: item.title });
    await (await ready(card().getByRole("button", { name: "Empezar" }))).click();
    await expect(toast(page, "Tarea en proceso")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.status).toBe("IN_PROGRESS");
    await card().getByRole("button", { name: "Volver a pendiente" }).click();
    await expect(toast(page, "Tarea reabierta")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.status).toBe("PENDING");
  });

  test("[STF-005] la nota para coordinación se guarda y la ve la fundadora", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "Portal › Agregar nota; owner › Detalles de la tarea");
    const { ev, item } = await setup(db);
    const note = `Faltaron 2 copas E2E ${Date.now()}`;
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.id}`);
    const card = page.getByRole("listitem").filter({ hasText: item.title });
    await (await ready(card.getByRole("button", { name: "Agregar nota" }))).click();
    await card.getByLabel("Nota para coordinación").fill(note);
    await card.getByRole("button", { name: "Guardar nota" }).click();
    await expect(toast(page, "Nota guardada")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.notes).toBe(note);
    await expect(page.getByRole("listitem").filter({ hasText: item.title }).getByText(note)).toBeVisible();
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/operations`);
    const row = owner.getByRole("listitem").filter({ hasText: item.title });
    await (await ready(row.getByRole("button", { name: "Detalles" }))).click();
    await expect(row.getByLabel("Notas")).toHaveValue(note);
  });

  test("[STF-006] una tarea asignada a otra persona es de sólo lectura y el backend rechaza el cambio", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("staff", "Portal › tarea de otra integrante (lectura) + replay de staffUpdateChecklistItem con su id");
    const { ev, item } = await setup(db);
    const other = await createStaffMember(db, { name: `Otra integrante E2E ${Date.now()}` });
    await assignStaff(db, ev.id, other.id, "SERVER");
    const foreign = await createChecklistItem(db, ev.id, { title: `Tarea ajena E2E ${Date.now()}`, assigneeId: other.id, sortOrder: 3 });
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.id}`);
    await (await ready(page.getByRole("button", { name: /^Todas \(/ }))).click();
    const foreignCard = page.getByRole("listitem").filter({ hasText: foreign.title });
    await expect(foreignCard.getByText(`Asignada a ${other.name}: sólo lectura.`)).toBeVisible();
    await expect(foreignCard.getByRole("button", { name: "Marcar como hecha" })).toHaveCount(0);
    const mine = page.getByRole("listitem").filter({ hasText: item.title });
    const captured = await captureServerAction(page, () => mine.getByRole("button", { name: "Empezar" }).click());
    await expect(toast(page, "Tarea en proceso")).toBeVisible();
    const res = await replayServerAction(await apiAs("staff"), captured, { body: swapInBody(captured.body, item.id, foreign.id) });
    const err = actionError(res.text);
    expect(err.ok, res.text.slice(0, 200)).toBe(false);
    expect(err.code).toBe("FORBIDDEN");
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("PENDING");
  });

  test("[STF-007] una tarea con foto obligatoria no se marca como hecha sin evidencia", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "Portal › Marcar como hecha sin foto");
    const { ev, item } = await setup(db, { requiresEvidence: true });
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.id}`);
    const card = page.getByRole("listitem").filter({ hasText: item.title });
    await expect(card.getByText("Requiere foto")).toBeVisible();
    await (await ready(card.getByRole("button", { name: "Marcar como hecha" }))).click();
    await expect(toast(page, "Esta tarea requiere una foto de evidencia antes de marcarse como hecha.")).toBeVisible();
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("PENDING");
  });

  test("[STF-010] subir la foto de evidencia la liga a la tarea y entonces sí se puede cerrar", { tag: ["@P1"] }, async ({ rolePage, db, evidence, request }) => {
    evidence("staff", "Portal › Tomar o subir foto (obligatoria) → Marcar como hecha");
    if (!(await storageAvailable(request))) blocked(test, "S3 local (RustFS :9000) no responde");
    const { ev, item } = await setup(db, { requiresEvidence: true });
    const lupitaUser = await userIdOf(db, "staff");
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.id}`);
    const card = page.getByRole("listitem").filter({ hasText: item.title });
    await ready(card.getByRole("button", { name: "Marcar como hecha" }));
    await card.getByLabel("Tomar o subir foto (obligatoria)").setInputFiles({ name: "evidencia.png", mimeType: "image/png", buffer: PNG_1PX });
    await expect(toast(page, "Foto lista: ya puedes marcarla como hecha")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.evidenceMediaId).not.toBeNull();
    const withPhoto = await db.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id }, include: { evidenceMedia: true } });
    expect(withPhoto.evidenceMedia).toMatchObject({ purpose: "CHECKLIST_EVIDENCE", eventId: ev.id, uploadedById: lupitaUser, visibility: "PRIVATE" });
    await expect(page.getByRole("listitem").filter({ hasText: item.title }).getByText("Foto lista")).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: item.title }).getByRole("button", { name: "Marcar como hecha" }).click();
    await expect(toast(page, "¡Tarea hecha!")).toBeVisible();
    await expect.poll(async () => (await db.eventChecklistItem.findUnique({ where: { id: item.id } }))?.status).toBe("DONE");
  });

  test("[STF-011] el portal staff se usa en celular sin scroll horizontal y con el CTA visible", { tag: ["@P2", "@mobile", "@responsive"] }, async ({ rolePage, db, evidence }) => {
    evidence("staff", "Portal en 390×844 (y 1440 en chromium)");
    const { ev, item } = await setup(db);
    const page = await rolePage("staff");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
    expect(await horizontalOverflow(page), "scroll horizontal en /staff").toBeLessThanOrEqual(1);
    await page.goto(`/staff/events/${ev.id}`);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    expect(await horizontalOverflow(page), "scroll horizontal en el detalle").toBeLessThanOrEqual(1);
    const cta = page.getByRole("listitem").filter({ hasText: item.title }).getByRole("button", { name: "Marcar como hecha" });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeInViewport();
    const box = await cta.boundingBox();
    expect(box!.height, "botón táctil ≥ 40 px").toBeGreaterThanOrEqual(40);
  });

  test("[STF-024] el portal staff (lista y detalle con checklist) no tiene violaciones WCAG 2.1 AA graves", { tag: ["@P2", "@a11y"] }, async ({ rolePage, db, evidence }, testInfo) => {
    evidence("staff", "axe en /staff y /staff/events/<id>");
    test.info().annotations.push({ type: "bug", description: "OPX-BUG-05" });
    const { ev } = await setup(db);
    const page = await rolePage("staff");
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
    const list = await scanA11y(page, testInfo);
    await page.goto(`/staff/events/${ev.id}`);
    await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    const detail = await scanA11y(page, testInfo);
    const blocking = [...list.blocking, ...detail.blocking].map((v) => `${v.id} (${v.impact}): ${v.help}`);
    expect(blocking, "violaciones critical/serious").toEqual([]);
  });
});
