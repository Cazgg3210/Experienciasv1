/**
 * Portal staff: sólo eventos asignados (UI + backend).
 *  - Páginas: /staff lista sólo lo asignado; /staff/events/[id] de un evento ajeno → "No encontramos este evento" sin fugas.
 *  - IDOR de acción: staffUpdateChecklistItemAction capturada en SU evento y repetida con el id de una tarea ajena.
 *  - Acciones de administración que el build expone en /staff/events/[id] (mismo módulo `features/staff/server/actions`):
 *    sólo las detiene el RBAC de la acción → deben responder FORBIDDEN y no tocar la base.
 * Fuente: src/features/staff/server/portal-queries.ts, src/features/operations/server/checklist-service.ts (updateChecklistItemAsStaff).
 */
import {
  captureServerAction,
  expect,
  replayServerAction,
  test,
  uniq,
  uniqEmail,
  wasAccepted,
  wasDenied,
} from "../fixtures";
import { actionResult, actionWorkers, buildAction, createEventGraph, createTeamUser, seedIds, withInput } from "./_helpers";

test.describe("Portal staff — acceso por asignación", { tag: ["@module:staff", "@permissions"] }, () => {
  test("[PERM-100] /staff muestra sólo los eventos asignados a la persona (y ninguno ajeno)", { tag: ["@P0"] }, async ({ rolePage, db, evidence }) => {
    const ids = await seedIds(db);
    const mine = await createEventGraph(db, { assignStaffMemberIds: [ids.staffMemberId], daysAhead: 15 });
    const other = await createEventGraph(db, { daysAhead: 16 }); // sin asignar
    evidence("staff", `asignado: ${mine.title} · no asignado: ${other.title}`);
    const page = await rolePage("staff");
    await page.goto("/staff");
    const list = page.getByRole("list", { name: "Eventos próximos" });
    await expect(list.getByRole("heading", { name: mine.title })).toBeVisible();
    await expect(page.getByText(other.title)).toHaveCount(0);
    await expect(page.getByText("Bridal Brunch de Mariana")).toHaveCount(0); // seed, no asignado a Lupita
    // Base: cada tarjeta corresponde a una asignación real de Lupita
    const hrefs = await list.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    const assigned = new Set(
      (await db.staffAssignment.findMany({ where: { staffMemberId: ids.staffMemberId }, select: { eventId: true } })).map((a) => a.eventId),
    );
    for (const h of hrefs) expect(assigned.has(h.split("/").pop()!), h).toBe(true);
  });

  test("[PERM-101] staff en /staff/events/<evento NO asignado> → no encontrado y sin datos del evento", { tag: ["@P0"] }, async ({ rolePage, apiAs, db, evidence }) => {
    const other = await createEventGraph(db, { daysAhead: 17, checklist: [{}] });
    evidence("staff", `evento ajeno ${other.eventId}`);
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${other.eventId}`);
    await expect(page.getByRole("heading", { name: "No encontramos este evento" })).toBeVisible();
    const html = await (await (await apiAs("staff")).get(`/staff/events/${other.eventId}`)).text();
    for (const secret of [other.title, "Calle Privada E2E 123", other.checklist[0]!.title]) expect(html).not.toContain(secret);
  });

  test("[PERM-102] staff2 no ve un evento asignado sólo a staff (y staff sí)", { tag: ["@P0"] }, async ({ rolePage, db, evidence }) => {
    const ids = await seedIds(db);
    const ev = await createEventGraph(db, { assignStaffMemberIds: [ids.staffMemberId], daysAhead: 18 });
    evidence("staff2", `evento ${ev.eventId} asignado sólo a Lupita`);
    const lupita = await rolePage("staff");
    await lupita.goto(`/staff/events/${ev.eventId}`);
    await expect(lupita.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
    const carlos = await rolePage("staff2");
    await carlos.goto(`/staff/events/${ev.eventId}`);
    await expect(carlos.getByRole("heading", { name: "No encontramos este evento" })).toBeVisible();
    await expect(carlos.getByText(ev.title)).toHaveCount(0);
  });

  test("[PERM-103] evento asignado pero CANCELADO deja de ser visible para staff", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    const ids = await seedIds(db);
    const ev = await createEventGraph(db, { assignStaffMemberIds: [ids.staffMemberId], daysAhead: 19, status: "CANCELLED" });
    evidence("staff", `evento cancelado ${ev.eventId}`);
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${ev.eventId}`);
    await expect(page.getByRole("heading", { name: "No encontramos este evento" })).toBeVisible();
    await page.goto("/staff");
    await expect(page.getByText(ev.title)).toHaveCount(0);
  });

  test("[PERM-104] id inexistente o malformado en /staff/events/[id] → no encontrado (sin error 500)", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("staff");
    const page = await rolePage("staff");
    for (const id of ["cxxxxxxxxxxxxxxxxxxxxxxxx", "..%2F..%2Fadmin", "' OR 1=1 --"]) {
      const res = await page.goto(`/staff/events/${encodeURIComponent(id)}`);
      expect(res!.status(), id).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: /No encontramos este evento|Esta mesa no está puesta/ })).toBeVisible();
    }
  });

  test("[PERM-105] owner/superadmin pueden abrir la vista staff de cualquier evento (sin montos)", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    const ev = await createEventGraph(db, { daysAhead: 20, withBooking: true, totalCents: 1_234_500 });
    evidence("owner", `evento ${ev.eventId} no asignado a nadie`);
    for (const role of ["owner", "superadmin"] as const) {
      const page = await rolePage(role);
      await page.goto(`/staff/events/${ev.eventId}`);
      await expect(page.getByRole("heading", { level: 1, name: ev.title })).toBeVisible();
      await expect(page.getByText(/\$\s?12,345/)).toHaveCount(0); // nunca montos en el portal staff
    }
  });
});

test.describe("Portal staff — IDOR en tareas del checklist", { tag: ["@module:staff", "@permissions"] }, () => {
  async function setup(db: import("@prisma/client").PrismaClient) {
    const ids = await seedIds(db);
    const lupita = ids.staffMemberId;
    const otherMember = await createTeamUser(db, { role: "STAFF" });
    const mine = await createEventGraph(db, {
      daysAhead: 21,
      assignStaffMemberIds: [lupita, otherMember.staffMemberId!],
      checklist: [{ assigneeStaffMemberId: lupita }, { assigneeStaffMemberId: lupita }, { assigneeStaffMemberId: otherMember.staffMemberId }],
    });
    const foreign = await createEventGraph(db, { daysAhead: 22, checklist: [{}], assignStaffMemberIds: [otherMember.staffMemberId!] });
    return { ids, lupita, otherMember, mine, foreign };
  }

  test("[PERM-110] staff repite 'Empezar tarea' con el id de una tarea de un evento NO asignado → FORBIDDEN y la base no cambia", { tag: ["@P0", "@critical"] }, async ({ rolePage, apiAs, db, evidence }) => {
    const { mine, foreign } = await setup(db);
    evidence("staff", `captura en ${mine.eventId}; replay con tarea ${foreign.checklist[0]!.id} de ${foreign.eventId}`);
    const page = await rolePage("staff");
    await page.goto(`/staff/events/${mine.eventId}`);
    const myItem = page.getByRole("listitem").filter({ hasText: mine.checklist[0]!.title });
    const captured = await captureServerAction(page, () => myItem.getByRole("button", { name: "Empezar" }).click());
    await expect.poll(async () => (await db.eventChecklistItem.findUniqueOrThrow({ where: { id: mine.checklist[0]!.id } })).status).toBe("IN_PROGRESS");

    const body = captured.body!.toString();
    expect(body).toContain(mine.checklist[0]!.id);
    const before = await db.eventChecklistItem.findUniqueOrThrow({ where: { id: foreign.checklist[0]!.id } });
    const staffApi = await apiAs("staff");
    const res = await replayServerAction(staffApi, captured, { body: body.replace(mine.checklist[0]!.id, foreign.checklist[0]!.id) });
    expect(wasDenied(res), `${res.outcome} ${res.status} ${res.text.slice(0, 200)}`).toBe(true);
    expect(actionResult(res.text)?.code).toBe("FORBIDDEN");
    const after = await db.eventChecklistItem.findUniqueOrThrow({ where: { id: foreign.checklist[0]!.id } });
    expect(after.status).toBe(before.status);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());

    // Control positivo: mismo request con OTRA tarea propia sí se aplica
    const ok = await replayServerAction(staffApi, captured, { body: body.replace(mine.checklist[0]!.id, mine.checklist[1]!.id) });
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    await expect.poll(async () => (await db.eventChecklistItem.findUniqueOrThrow({ where: { id: mine.checklist[1]!.id } })).status).toBe("IN_PROGRESS");
  });

  test("[PERM-111] staff no puede cambiar una tarea asignada a otra persona del mismo evento", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { mine } = await setup(db);
    const othersItem = mine.checklist[2]!;
    evidence("staff", `tarea ${othersItem.id} asignada a otra persona en evento asignado`);
    const action = buildAction("staffUpdateChecklistItemAction", `/staff/events/${mine.eventId}`, { id: othersItem.id, status: "DONE" });
    const res = await replayServerAction(await apiAs("staff"), action);
    expect(actionResult(res.text)?.code, res.text.slice(0, 200)).toBe("FORBIDDEN");
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: othersItem.id } })).status).toBe("PENDING");
  });

  test("[PERM-112] staff no puede OMITIR (SKIPPED) tareas aunque sean suyas", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    const { mine } = await setup(db);
    evidence("staff", "status=SKIPPED forzado en el request");
    const action = buildAction("staffUpdateChecklistItemAction", `/staff/events/${mine.eventId}`, { id: mine.checklist[0]!.id, status: "SKIPPED" });
    const res = await replayServerAction(await apiAs("staff"), action);
    expect(actionResult(res.text)?.code, res.text.slice(0, 200)).toBe("FORBIDDEN");
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: mine.checklist[0]!.id } })).status).toBe("PENDING");
  });

  test("[PERM-113] staff2 repitiendo el request de Lupita sobre un evento donde no está asignado → FORBIDDEN", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { mine } = await setup(db);
    evidence("staff2", `evento ${mine.eventId} no asignado a Carlos`);
    const action = buildAction("staffUpdateChecklistItemAction", `/staff/events/${mine.eventId}`, { id: mine.checklist[0]!.id, notes: "intrusión" });
    const res = await replayServerAction(await apiAs("staff2"), action);
    expect(actionResult(res.text)?.code, res.text.slice(0, 200)).toBe("FORBIDDEN");
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: mine.checklist[0]!.id } })).notes).toBeNull();
  });

  test("[PERM-114] staff no puede adjuntar como evidencia una foto subida por otra persona", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { mine, otherMember } = await setup(db);
    const media = await db.mediaAsset.create({
      data: {
        driver: "EXTERNAL",
        url: "https://images.unsplash.com/photo-1519741497674-611481863552",
        mimeType: "image/jpeg",
        visibility: "PRIVATE",
        purpose: "CHECKLIST_EVIDENCE",
        eventId: mine.eventId,
        uploadedById: otherMember.id,
      },
    });
    evidence("staff", `evidenceMediaId=${media.id} (subida por ${otherMember.email})`);
    const action = buildAction("staffUpdateChecklistItemAction", `/staff/events/${mine.eventId}`, { id: mine.checklist[0]!.id, evidenceMediaId: media.id });
    const res = await replayServerAction(await apiAs("staff"), action);
    const r = actionResult(res.text);
    expect(r?.ok, res.text.slice(0, 200)).toBe(false);
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: mine.checklist[0]!.id } })).evidenceMediaId).toBeNull();
  });

  test("[PERM-115] tarea inexistente → NOT_FOUND controlado; anónimo → redirigido a login", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    const { mine } = await setup(db);
    evidence("staff", "id inexistente + replay anónimo");
    const action = buildAction("staffUpdateChecklistItemAction", `/staff/events/${mine.eventId}`, { id: "cxxxxxxxxxxxxxxxxxxxxxxxx", status: "DONE" });
    const res = await replayServerAction(await apiAs("staff"), action);
    expect(res.status).toBeLessThan(500);
    expect(actionResult(res.text)?.code).toBe("NOT_FOUND");
    const anon = await replayServerAction(await apiAs(null), withInput(action, { id: mine.checklist[0]!.id, status: "DONE" }));
    expect(wasDenied(anon), `${anon.outcome} ${anon.status}`).toBe(true);
    expect(anon.redirectedTo).toContain("/login");
    expect((await db.eventChecklistItem.findUniqueOrThrow({ where: { id: mine.checklist[0]!.id } })).status).toBe("PENDING");
  });
});

test.describe("Acciones de administración expuestas en /staff/events/[id]", { tag: ["@module:staff", "@permissions"] }, () => {
  test("[PERM-120] el build expone acciones de admin de staff en la página del portal (inventario de superficie)", { tag: ["@P2"] }, async ({ evidence }) => {
    evidence("staff", "server-reference-manifest.json");
    for (const name of ["resetStaffPasswordAction", "setStaffAccessActiveAction", "createStaffAccessAction", "createStaffMemberAction", "updateStaffMemberAction", "deleteStaffMemberAction"]) {
      expect(actionWorkers(name, /features\/staff\/server\/actions/), name).toContain("app/(staff)/staff/events/[id]/page");
    }
    test.info().annotations.push({
      type: "nota",
      description: "Next incluye TODAS las exportaciones de features/staff/server/actions.ts en la página del portal: su único freno es el RBAC de cada acción (PERM-121..126).",
    });
  });

  const exposed: Array<{ id: string; name: string; input: (ctx: { victim: Awaited<ReturnType<typeof createTeamUser>>; loose: { id: string } }) => unknown; check: (db: import("@prisma/client").PrismaClient, ctx: { victim: Awaited<ReturnType<typeof createTeamUser>>; loose: { id: string }; hashBefore: string | null }) => Promise<void> }> = [
    {
      id: "PERM-121",
      name: "resetStaffPasswordAction",
      input: ({ victim }) => ({ staffMemberId: victim.staffMemberId, password: "Hackeo123456" }),
      check: async (db, { victim, hashBefore }) => expect((await db.user.findUniqueOrThrow({ where: { id: victim.id } })).passwordHash).toBe(hashBefore),
    },
    {
      id: "PERM-122",
      name: "setStaffAccessActiveAction",
      input: ({ victim }) => ({ staffMemberId: victim.staffMemberId, active: false }),
      check: async (db, { victim }) => expect((await db.user.findUniqueOrThrow({ where: { id: victim.id } })).active).toBe(true),
    },
    {
      id: "PERM-123",
      name: "createStaffAccessAction",
      input: ({ loose }) => ({ staffMemberId: loose.id, email: "intruso-staff@e2e.ivonne-rosa.test", password: "Hackeo123456" }),
      check: async (db) => expect(await db.user.findUnique({ where: { email: "intruso-staff@e2e.ivonne-rosa.test" } })).toBeNull(),
    },
    {
      id: "PERM-124",
      name: "createStaffMemberAction",
      input: () => ({ name: "Intrusa Staff E2E", primaryFunction: "SERVER", rateCents: 0, rateType: "PER_EVENT", availableWeekdays: [], active: true }),
      check: async (db) => expect(await db.staffMember.count({ where: { name: "Intrusa Staff E2E" } })).toBe(0),
    },
    {
      id: "PERM-125",
      name: "updateStaffMemberAction",
      input: ({ loose }) => ({ id: loose.id, name: "Renombrada por staff", primaryFunction: "SERVER", rateCents: 999_999, rateType: "PER_EVENT", availableWeekdays: [], active: true }),
      check: async (db, { loose }) => expect((await db.staffMember.findUniqueOrThrow({ where: { id: loose.id } })).rateCents).toBe(0),
    },
    {
      id: "PERM-126",
      name: "deleteStaffMemberAction",
      input: ({ loose }) => ({ id: loose.id }),
      check: async (db, { loose }) => expect(await db.staffMember.findUnique({ where: { id: loose.id } })).not.toBeNull(),
    },
  ];
  for (const a of exposed) {
    test(`[${a.id}] staff ejecutando ${a.name} desde /staff/events/[id] → FORBIDDEN y sin cambios`, { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
      const ids = await seedIds(db);
      const victim = await createTeamUser(db, { role: "STAFF" });
      const loose = await db.staffMember.create({ data: { name: uniq("Ficha suelta"), email: uniqEmail("ficha"), primaryFunction: "SERVER", availableWeekdays: [] } });
      const hashBefore = (await db.user.findUniqueOrThrow({ where: { id: victim.id } })).passwordHash;
      evidence("staff", `${a.name} vía /staff/events/${ids.eventSofia}`);
      const action = buildAction(a.name, `/staff/events/${ids.eventSofia}`, a.input({ victim, loose }), { file: /features\/staff\/server\/actions/ });
      const res = await replayServerAction(await apiAs("staff"), action);
      expect(wasDenied(res), `${res.outcome} ${res.status} ${res.text.slice(0, 200)}`).toBe(true);
      expect(actionResult(res.text)?.code).toBe("FORBIDDEN");
      await a.check(db, { victim, loose, hashBefore });
    });
  }

  test("[PERM-127] control positivo: la misma acción desde /staff/events/[id] con OWNER sí se ejecuta", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    const ids = await seedIds(db);
    const loose = await db.staffMember.create({ data: { name: uniq("Ficha suelta"), primaryFunction: "SERVER", availableWeekdays: [] } });
    evidence("owner", "updateStaffMemberAction vía la página del portal staff");
    const action = buildAction(
      "updateStaffMemberAction",
      `/staff/events/${ids.eventSofia}`,
      { id: loose.id, name: "Renombrada por owner", primaryFunction: "CHEF", rateCents: 150_000, rateType: "PER_EVENT", availableWeekdays: [1, 2], active: true },
      { file: /features\/staff\/server\/actions/ },
    );
    const ok = await replayServerAction(await apiAs("owner"), action);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    const row = await db.staffMember.findUniqueOrThrow({ where: { id: loose.id } });
    expect(row.name).toBe("Renombrada por owner");
    expect(row.rateCents).toBe(150_000);
  });
});
