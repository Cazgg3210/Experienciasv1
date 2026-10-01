/**
 * Integración — Operaciones (checklists, asignaciones) y Staff (accesos, portal).
 * Usa la base de pruebas; cada prueba crea sus propios datos con valores únicos.
 */
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/db";
import { addDaysUtc, localDateKey, weekdayOf, zonedDateTime } from "@/lib/dates";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/server/auth/session";
import {
  createChecklistItem,
  createTemplate,
  createTemplateItem,
  deleteChecklistItem,
  deleteTemplate,
  deleteTemplateItem,
  instantiateChecklistsAsAdmin,
  instantiateChecklistsForEvent,
  updateChecklistItem,
  updateChecklistItemAsStaff,
  updateTemplate,
  updateTemplateItem,
} from "@/features/operations/server/checklist-service";
import {
  createAssignment,
  deleteAssignment,
  setAssignmentFlags,
  updateAssignment,
} from "@/features/operations/server/assignment-service";
import { updateEventAddOnNotes, updateEventLogistics } from "@/features/operations/server/logistics-service";
import { getOperationsOverview, getProductionOrder } from "@/features/operations/server/ops-queries";
import {
  createStaffAccess,
  createStaffMember,
  deleteStaffMember,
  resetStaffPassword,
  setStaffAccessActive,
  updateStaffMember,
} from "@/features/staff/server/staff-service";
import { getStaffDetail, listStaff } from "@/features/staff/server/staff-queries";
import { getStaffEventView, listMyEvents } from "@/features/staff/server/portal-queries";
import { staffChecklistUpdateSchema, updateChecklistItemSchema } from "@/features/operations/schemas";
import { testOwner, testStaff, uid } from "./helpers";

let owner: SessionUser;
let customerId: string;

/** Primer día (YYYY-MM-DD, CDMX) a partir de hoy+offset que cae en el día de la semana indicado. */
function futureDateKey(weekday: number, minDaysAhead = 40): string {
  let d = addDaysUtc(new Date(), minDaysAhead);
  for (let i = 0; i < 7; i++) {
    const key = localDateKey(d);
    if (weekdayOf(key) === weekday) return key;
    d = addDaysUtc(d, 1);
  }
  throw new Error("unreachable");
}

async function makeExperience(): Promise<string> {
  const slug = uid("exp-");
  const exp = await prisma.experience.create({
    data: { name: `Experiencia ${slug}`, slug, description: "Prueba de integración", basePriceCents: 1_000_000, baseGuests: 6 },
  });
  return exp.id;
}

async function makeEvent(opts: {
  dateKey: string;
  start?: string;
  end?: string;
  experienceId?: string | null;
  status?: EventStatus;
  title?: string;
}) {
  const id = uid("ev");
  return prisma.event.create({
    data: {
      code: `EV-${id}`.toUpperCase(),
      title: opts.title ?? `Evento ${id}`,
      status: opts.status ?? "CONFIRMED",
      customerId,
      experienceId: opts.experienceId ?? null,
      eventDate: new Date(`${opts.dateKey}T00:00:00.000Z`),
      startsAt: zonedDateTime(opts.dateKey, opts.start ?? "11:00"),
      endsAt: zonedDateTime(opts.dateKey, opts.end ?? "15:00"),
      guestCount: 8,
      neighborhood: "Roma Norte",
      addressLine: "Calle de prueba 123",
      micrositeSlug: `slug-${id}`,
      inviteToken: `inv-${id}-${uid()}`,
      portalToken: `por-${id}-${uid()}`,
    },
  });
}

async function makeMember(over: Partial<{ rateCents: number; rateType: "PER_EVENT" | "PER_HOUR"; availableWeekdays: number[]; email: string | null; primaryFunction: "CHEF" | "SERVER" | "COORDINATOR" | "SETUP" }> = {}) {
  return prisma.staffMember.create({
    data: {
      name: `Integrante ${uid()}`,
      primaryFunction: over.primaryFunction ?? "SERVER",
      rateCents: over.rateCents ?? 100_000,
      rateType: over.rateType ?? "PER_EVENT",
      availableWeekdays: over.availableWeekdays ?? [0, 1, 2, 3, 4, 5, 6],
      email: over.email === undefined ? `${uid("m")}@ivonne-rosa.test` : over.email,
      phone: "5512345678",
    },
  });
}

async function makeItem(eventId: string, over: Partial<{ assigneeId: string | null; requiresEvidence: boolean }> = {}) {
  return prisma.eventChecklistItem.create({
    data: {
      eventId,
      phase: "SETUP",
      area: "TABLE",
      title: `Tarea ${uid()}`,
      requiresEvidence: over.requiresEvidence ?? false,
      assigneeId: over.assigneeId ?? null,
      dueAt: new Date(Date.now() + 86_400_000),
    },
  });
}

async function makeEvidence(eventId: string, uploadedById?: string) {
  return prisma.mediaAsset.create({
    data: {
      driver: "EXTERNAL",
      url: "/images/placeholders/brunch-table.svg",
      mimeType: "image/svg+xml",
      purpose: "CHECKLIST_EVIDENCE",
      visibility: "PRIVATE",
      eventId,
      uploadedById: uploadedById ?? null,
    },
  });
}

beforeAll(async () => {
  owner = await testOwner();
  const customer = await prisma.customer.create({
    data: { name: `Clienta ${uid()}`, referralCode: uid("REF").toUpperCase(), phone: "5598765432" },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// =============================================================================
describe("instantiateChecklistsForEvent", () => {
  it("es idempotente, calcula dueAt y respeta plantillas por experiencia", async () => {
    const expA = await makeExperience();
    const expB = await makeExperience();
    const general = await prisma.checklistTemplate.create({
      data: {
        name: `General ${uid()}`,
        phase: "T_MINUS_3",
        sortOrder: 900,
        items: {
          create: [
            { title: "Compras de cocina", area: "FOOD", offsetMinutes: -3 * 24 * 60, defaultFunction: "CHEF", sortOrder: 1 },
            { title: "Foto de mesa", area: "TABLE", offsetMinutes: 90, requiresEvidence: true, sortOrder: 2 },
          ],
        },
      },
      include: { items: true },
    });
    const onlyA = await prisma.checklistTemplate.create({
      data: { name: `Sólo A ${uid()}`, phase: "SETUP", experienceId: expA, items: { create: [{ title: "Karaoke A", area: "ADDONS", offsetMinutes: -45 }] } },
      include: { items: true },
    });
    const onlyB = await prisma.checklistTemplate.create({
      data: { name: `Sólo B ${uid()}`, phase: "SETUP", experienceId: expB, items: { create: [{ title: "Algo de B", offsetMinutes: -30 }] } },
      include: { items: true },
    });
    const inactive = await prisma.checklistTemplate.create({
      data: { name: `Inactiva ${uid()}`, phase: "EVENT", active: false, items: { create: [{ title: "No debe salir", offsetMinutes: 0 }] } },
      include: { items: true },
    });

    const dateKey = futureDateKey(6);
    const event = await makeEvent({ dateKey, start: "11:00", experienceId: expA });
    const chef = await makeMember({ primaryFunction: "CHEF" });
    await prisma.staffAssignment.create({
      data: { eventId: event.id, staffMemberId: chef.id, function: "CHEF", startsAt: event.startsAt, endsAt: event.endsAt },
    });

    const first = await instantiateChecklistsForEvent(event.id);
    expect(first.created).toBeGreaterThanOrEqual(3);

    const mine = await prisma.eventChecklistItem.findMany({
      where: {
        eventId: event.id,
        templateItemId: { in: [...general.items, ...onlyA.items, ...onlyB.items, ...inactive.items].map((i) => i.id) },
      },
    });
    expect(mine.map((i) => i.title).sort()).toEqual(["Compras de cocina", "Foto de mesa", "Karaoke A"]);

    const compras = mine.find((i) => i.title === "Compras de cocina")!;
    expect(compras.dueAt!.toISOString()).toBe(new Date(event.startsAt.getTime() - 3 * 86_400_000).toISOString());
    expect(compras.assigneeId).toBe(chef.id);
    expect(compras.phase).toBe("T_MINUS_3");
    const foto = mine.find((i) => i.title === "Foto de mesa")!;
    expect(foto.dueAt!.getTime()).toBe(event.startsAt.getTime() + 90 * 60_000);
    expect(foto.requiresEvidence).toBe(true);
    expect(foto.assigneeId).toBeNull();
    expect(mine.find((i) => i.title === "Karaoke A")!.phase).toBe("SETUP");

    const totalAfterFirst = await prisma.eventChecklistItem.count({ where: { eventId: event.id } });
    expect(totalAfterFirst).toBe(first.created);

    // Invariante de idempotencia: ningún templateItem instanciado dos veces en el mismo evento.
    // (Se valida sobre los datos del evento y no sobre `created`, porque otras suites pueden
    // crear plantillas generales en la base de pruebas al mismo tiempo.)
    const duplicates = async () => {
      const rows = await prisma.eventChecklistItem.groupBy({
        by: ["templateItemId"],
        where: { eventId: event.id, templateItemId: { not: null } },
        _count: { _all: true },
      });
      return rows.filter((r) => r._count._all > 1).length;
    };
    const myItemIds = [...general.items, ...onlyA.items].map((i) => i.id);
    const countMine = () => prisma.eventChecklistItem.count({ where: { eventId: event.id, templateItemId: { in: myItemIds } } });

    // Segunda vez: no duplica
    await instantiateChecklistsForEvent(event.id);
    expect(await countMine()).toBe(3);
    expect(await duplicates()).toBe(0);
    // Concurrencia: dos llamadas simultáneas tampoco duplican
    await Promise.all([instantiateChecklistsForEvent(event.id), instantiateChecklistsForEvent(event.id)]);
    expect(await countMine()).toBe(3);
    expect(await duplicates()).toBe(0);

    // Un ítem nuevo en la plantilla se agrega sin tocar los existentes
    const nuevo = await prisma.checklistTemplateItem.create({ data: { templateId: general.id, title: "Nueva tarea", offsetMinutes: -60 } });
    myItemIds.push(nuevo.id);
    const third = await instantiateChecklistsForEvent(event.id);
    expect(third.created).toBeGreaterThanOrEqual(1);
    expect(await countMine()).toBe(4);
    expect(await duplicates()).toBe(0);
    expect(compras.id).toBe((await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: compras.id } })).id);

    // Limpieza de plantillas propias (para no contaminar otras pruebas)
    await prisma.checklistTemplate.deleteMany({ where: { id: { in: [general.id, onlyA.id, onlyB.id, inactive.id] } } });
  });

  it("falla con evento inexistente", async () => {
    await expect(instantiateChecklistsForEvent("no-existe-123")).rejects.toThrow();
  });
});

// =============================================================================
describe("checklist: evidencia y completado", () => {
  it("no permite DONE sin evidencia cuando la tarea la requiere", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(5) });
    const item = await makeItem(event.id, { requiresEvidence: true });

    await expect(updateChecklistItem(owner, { id: item.id, status: "DONE" })).rejects.toBeInstanceOf(ValidationError);

    const otherEvent = await makeEvent({ dateKey: futureDateKey(5) });
    const foreign = await makeEvidence(otherEvent.id);
    await expect(updateChecklistItem(owner, { id: item.id, evidenceMediaId: foreign.id })).rejects.toBeInstanceOf(ValidationError);

    const media = await makeEvidence(event.id, owner.id);
    await updateChecklistItem(owner, { id: item.id, evidenceMediaId: media.id });
    const done = await updateChecklistItem(owner, { id: item.id, status: "DONE", notes: "Mesa lista" });
    expect(done.status).toBe("DONE");
    expect(done.completedAt).toBeInstanceOf(Date);
    expect(done.completedById).toBe(owner.id);
    expect(done.notes).toBe("Mesa lista");

    // Quitar la evidencia de una tarea DONE que la requiere no está permitido
    await expect(updateChecklistItem(owner, { id: item.id, evidenceMediaId: null })).rejects.toBeInstanceOf(ValidationError);

    const reopened = await updateChecklistItem(owner, { id: item.id, status: "PENDING" });
    expect(reopened.completedAt).toBeNull();
    expect(reopened.completedById).toBeNull();
    expect(reopened.notes).toBe("Mesa lista"); // no se borran notas si no se envían
  });

  it("DONE sin requisito de evidencia funciona directo", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(5) });
    const item = await makeItem(event.id);
    const res = await updateChecklistItem(owner, { id: item.id, status: "DONE" });
    expect(res.status).toBe("DONE");
  });
});

// =============================================================================
describe("permisos del staff sobre tareas", () => {
  it("staff sólo edita tareas de sus eventos, propias o sin asignar", async () => {
    const staff = await testStaff();
    const actor: SessionUser = { id: staff.id, email: staff.email, name: staff.name, role: "STAFF" };
    const other = await makeMember();

    const assigned = await makeEvent({ dateKey: futureDateKey(6) });
    const notAssigned = await makeEvent({ dateKey: futureDateKey(6) });
    await prisma.staffAssignment.create({
      data: { eventId: assigned.id, staffMemberId: staff.staffMemberId, function: "SERVER", startsAt: assigned.startsAt, endsAt: assigned.endsAt },
    });

    const foreignEventItem = await makeItem(notAssigned.id);
    const othersItem = await makeItem(assigned.id, { assigneeId: other.id });
    const myItem = await makeItem(assigned.id, { assigneeId: staff.staffMemberId, requiresEvidence: true });
    const freeItem = await makeItem(assigned.id);

    await expect(updateChecklistItemAsStaff(actor, { id: foreignEventItem.id, status: "IN_PROGRESS" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateChecklistItemAsStaff(actor, { id: othersItem.id, status: "DONE" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateChecklistItemAsStaff(actor, { id: freeItem.id, status: "SKIPPED" })).rejects.toBeInstanceOf(ForbiddenError);

    const started = await updateChecklistItemAsStaff(actor, { id: freeItem.id, status: "IN_PROGRESS", notes: "Voy en camino" });
    expect(started.status).toBe("IN_PROGRESS");

    // Mi tarea requiere evidencia: no puedo cerrarla sin foto
    await expect(updateChecklistItemAsStaff(actor, { id: myItem.id, status: "DONE" })).rejects.toBeInstanceOf(ValidationError);
    // Foto subida por otra persona: rechazada
    const notMine = await makeEvidence(assigned.id, owner.id);
    await expect(updateChecklistItemAsStaff(actor, { id: myItem.id, evidenceMediaId: notMine.id })).rejects.toBeInstanceOf(ForbiddenError);
    const myPhoto = await makeEvidence(assigned.id, staff.id);
    await updateChecklistItemAsStaff(actor, { id: myItem.id, evidenceMediaId: myPhoto.id });
    const done = await updateChecklistItemAsStaff(actor, { id: myItem.id, status: "DONE" });
    expect(done.status).toBe("DONE");
    expect(done.completedById).toBe(staff.id);

    // La fundadora puede editar cualquier tarea desde el portal
    const byOwner = await updateChecklistItemAsStaff(owner, { id: othersItem.id, status: "SKIPPED" });
    expect(byOwner.status).toBe("SKIPPED");

    // Evento cancelado: el staff pierde acceso
    await prisma.event.update({ where: { id: assigned.id }, data: { status: "CANCELLED" } });
    await expect(updateChecklistItemAsStaff(actor, { id: freeItem.id, status: "DONE" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("una persona STAFF sin perfil de staff no puede editar", async () => {
    const user = await prisma.user.create({ data: { email: `${uid("nostaff")}@ivonne-rosa.test`, name: "Sin perfil", role: "STAFF" } });
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    const item = await makeItem(event.id);
    await expect(
      updateChecklistItemAsStaff({ id: user.id, email: user.email, role: "STAFF" }, { id: item.id, status: "DONE" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// =============================================================================
describe("asignaciones de staff", () => {
  it("monto por defecto: por hora × horas vs por evento; respeta monto manual", async () => {
    const dateKey = futureDateKey(6);
    const event = await makeEvent({ dateKey });
    const hourly = await makeMember({ rateCents: 12_000, rateType: "PER_HOUR" });
    const perEvent = await makeMember({ rateCents: 120_000, rateType: "PER_EVENT", primaryFunction: "COORDINATOR" });
    const manual = await makeMember({ rateCents: 50_000, rateType: "PER_EVENT" });

    const a1 = await createAssignment(owner, {
      eventId: event.id,
      staffMemberId: hourly.id,
      function: "SERVER",
      startsAt: `${dateKey}T10:00`,
      endsAt: `${dateKey}T15:30`,
    });
    expect(a1.assignment.amountCents).toBe(66_000);
    expect(a1.assignment.startsAt.toISOString()).toBe(zonedDateTime(dateKey, "10:00").toISOString());

    const a2 = await createAssignment(owner, {
      eventId: event.id,
      staffMemberId: perEvent.id,
      function: "COORDINATOR",
      startsAt: `${dateKey}T08:30`,
      endsAt: `${dateKey}T17:00`,
    });
    expect(a2.assignment.amountCents).toBe(120_000);

    const a3 = await createAssignment(owner, {
      eventId: event.id,
      staffMemberId: manual.id,
      function: "SETUP",
      startsAt: `${dateKey}T08:30`,
      endsAt: `${dateKey}T12:00`,
      amountCents: 75_000,
    });
    expect(a3.assignment.amountCents).toBe(75_000);

    // Misma persona + misma función en el mismo evento: rechazado
    await expect(
      createAssignment(owner, { eventId: event.id, staffMemberId: hourly.id, function: "SERVER", startsAt: `${dateKey}T10:00`, endsAt: `${dateKey}T11:00` }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Horario invertido: rechazado por el esquema
    await expect(
      createAssignment(owner, { eventId: event.id, staffMemberId: hourly.id, function: "HOST", startsAt: `${dateKey}T15:00`, endsAt: `${dateKey}T11:00` }),
    ).rejects.toThrow();

    // Notificación STAFF_ASSIGNED al correo del integrante
    const logs = await prisma.notificationLog.findMany({ where: { type: "STAFF_ASSIGNED", eventId: event.id, to: hourly.email! } });
    expect(logs.length).toBe(1);
    expect(logs[0]!.actionUrl).toContain(`/staff/events/${event.id}`);
  });

  it("avisa traslapes con otro evento y días no disponibles", async () => {
    const saturday = futureDateKey(6, 60);
    const e1 = await makeEvent({ dateKey: saturday, title: "Brunch traslape 1" });
    const e2 = await makeEvent({ dateKey: saturday, title: "Brunch traslape 2" });
    const member = await makeMember({ availableWeekdays: [0, 6] });

    const first = await createAssignment(owner, {
      eventId: e1.id,
      staffMemberId: member.id,
      function: "SERVER",
      startsAt: `${saturday}T09:00`,
      endsAt: `${saturday}T14:00`,
    });
    expect(first.warnings).toEqual([]);

    const second = await createAssignment(owner, {
      eventId: e2.id,
      staffMemberId: member.id,
      function: "SERVER",
      startsAt: `${saturday}T13:00`,
      endsAt: `${saturday}T18:00`,
    });
    expect(second.warnings.map((w) => w.kind)).toEqual(["OVERLAP"]);
    expect(second.warnings[0]!.message).toContain("Brunch traslape 1");

    // Lunes: no está en sus días disponibles
    const monday = futureDateKey(1, 60);
    const e3 = await makeEvent({ dateKey: monday });
    const third = await createAssignment(owner, {
      eventId: e3.id,
      staffMemberId: member.id,
      function: "SERVER",
      startsAt: `${monday}T09:00`,
      endsAt: `${monday}T12:00`,
    });
    expect(third.warnings.map((w) => w.kind)).toEqual(["UNAVAILABLE_WEEKDAY"]);

    // Evento cancelado no cuenta como traslape
    await prisma.event.update({ where: { id: e1.id }, data: { status: "CANCELLED" } });
    const order = await getProductionOrder(e2.id);
    expect(order!.assignments[0]!.warnings).toEqual([]);
  });

  it("asigna tareas de su función al crear y las libera al eliminar", async () => {
    const dateKey = futureDateKey(0);
    const event = await makeEvent({ dateKey });
    const template = await prisma.checklistTemplate.create({
      data: { name: `Chef ${uid()}`, phase: "T_MINUS_1", items: { create: [{ title: "Mise en place", area: "FOOD", offsetMinutes: -1440, defaultFunction: "CHEF" }] } },
      include: { items: true },
    });
    await instantiateChecklistsForEvent(event.id);
    const item = await prisma.eventChecklistItem.findFirstOrThrow({ where: { eventId: event.id, templateItemId: template.items[0]!.id } });
    expect(item.assigneeId).toBeNull();

    const chef = await makeMember({ primaryFunction: "CHEF" });
    const { assignment } = await createAssignment(owner, {
      eventId: event.id,
      staffMemberId: chef.id,
      function: "CHEF",
      startsAt: `${dateKey}T08:00`,
      endsAt: `${dateKey}T16:00`,
    });
    expect((await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id } })).assigneeId).toBe(chef.id);

    await deleteAssignment(owner, assignment.id);
    expect((await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: item.id } })).assigneeId).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "staff_assignment.deleted", entityId: assignment.id } })).toBe(1);

    await prisma.checklistTemplate.delete({ where: { id: template.id } });
  });

  it("STAFF no puede crear asignaciones", async () => {
    const staff = await testStaff();
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    await expect(
      createAssignment(
        { id: staff.id, email: staff.email, role: "STAFF" },
        { eventId: event.id, staffMemberId: staff.staffMemberId, function: "SERVER", startsAt: "2030-01-01T10:00", endsAt: "2030-01-01T12:00" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// =============================================================================
describe("portal staff", () => {
  it("lista y muestra sólo eventos asignados, sin datos financieros", async () => {
    const staff = await testStaff();
    const actor: SessionUser = { id: staff.id, email: staff.email, name: staff.name, role: "STAFF" };
    const mineDate = futureDateKey(6);
    const mine = await makeEvent({ dateKey: mineDate, title: "Mi evento asignado" });
    const notMine = await makeEvent({ dateKey: mineDate, title: "Evento ajeno" });
    const cancelled = await makeEvent({ dateKey: mineDate, title: "Evento cancelado", status: "CANCELLED" });
    const past = await makeEvent({ dateKey: localDateKey(addDaysUtc(new Date(), -20)), title: "Evento pasado", status: "COMPLETED" });
    for (const ev of [mine, cancelled, past]) {
      await prisma.staffAssignment.create({
        data: { eventId: ev.id, staffMemberId: staff.staffMemberId, function: "SERVER", startsAt: ev.startsAt, endsAt: ev.endsAt, amountCents: 99_900 },
      });
    }
    const coordinator = await makeMember({ primaryFunction: "COORDINATOR" });
    await prisma.staffAssignment.create({
      data: { eventId: mine.id, staffMemberId: coordinator.id, function: "COORDINATOR", startsAt: mine.startsAt, endsAt: mine.endsAt, amountCents: 150_000 },
    });
    await makeItem(mine.id, { assigneeId: staff.staffMemberId });
    await makeItem(mine.id, { assigneeId: coordinator.id });

    const list = await listMyEvents(actor);
    expect(list.member?.id).toBe(staff.staffMemberId);
    expect(list.upcoming.map((e) => e.id)).toEqual([mine.id]);
    expect(list.past.map((e) => e.id)).toEqual([past.id]);
    expect(list.upcoming[0]!.roles).toEqual([{ function: "SERVER", schedule: expect.stringMatching(/^\d{2}:\d{2}–\d{2}:\d{2}$/), confirmed: false }]);
    expect(list.upcoming[0]!.myTasks.total).toBe(1);

    expect(await getStaffEventView(actor, notMine.id)).toBeNull();
    expect(await getStaffEventView(actor, cancelled.id)).toBeNull();
    expect(await getStaffEventView(actor, "../../etc")).toBeNull();

    const view = await getStaffEventView(actor, mine.id);
    expect(view).not.toBeNull();
    expect(view!.coordinator?.name).toBe(coordinator.name);
    expect(view!.client.phone).toBeNull(); // mesera: sin teléfono de la clienta
    expect(view!.checklist).toHaveLength(2);
    expect(view!.checklist.filter((i) => i.canEdit)).toHaveLength(1);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/amountCents|rateCents|priceCents|costCents|totalCents|paid/);

    // La fundadora puede ver cualquier evento desde el portal
    expect(await getStaffEventView(owner, notMine.id)).not.toBeNull();
  });
});

// =============================================================================
describe("accesos de staff", () => {
  it("crea usuario STAFF con contraseña bcrypt, audita y permite restablecer", async () => {
    const member = await makeMember({ email: null });
    const email = `${uid("acceso")}@ivonne-rosa.test`;
    const res = await createStaffAccess(owner, { staffMemberId: member.id, email: email.toUpperCase(), password: "Temporal2026x" });
    expect(res.email).toBe(email);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("STAFF");
    expect(user.passwordHash).not.toBe("Temporal2026x");
    expect(await bcrypt.compare("Temporal2026x", user.passwordHash!)).toBe(true);
    const linked = await prisma.staffMember.findUniqueOrThrow({ where: { id: member.id } });
    expect(linked.userId).toBe(user.id);
    expect(linked.email).toBe(email);
    const auditRow = await prisma.auditLog.findFirst({ where: { action: "user.created", entityId: user.id } });
    expect(auditRow).not.toBeNull();
    expect(JSON.stringify(auditRow!.after)).not.toContain("Temporal2026x");

    // Segundo acceso para el mismo integrante: rechazado
    await expect(createStaffAccess(owner, { staffMemberId: member.id, email: `${uid()}@ivonne-rosa.test`, password: "OtraClave2026" })).rejects.toThrow();
    // Correo ya usado por otra cuenta: rechazado
    const other = await makeMember();
    await expect(createStaffAccess(owner, { staffMemberId: other.id, email, password: "OtraClave2026" })).rejects.toBeInstanceOf(ValidationError);
    // Contraseña corta: rechazada
    await expect(createStaffAccess(owner, { staffMemberId: other.id, email: `${uid()}@ivonne-rosa.test`, password: "corta1" })).rejects.toThrow();

    await resetStaffPassword(owner, { staffMemberId: member.id, password: "NuevaClave2026" });
    const updated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await bcrypt.compare("NuevaClave2026", updated.passwordHash!)).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "user.password_reset", entityId: user.id } })).toBe(1);
  });

  it("STAFF no puede crear accesos", async () => {
    const staff = await testStaff();
    const member = await makeMember();
    await expect(
      createStaffAccess({ id: staff.id, email: staff.email, role: "STAFF" }, { staffMemberId: member.id, email: `${uid()}@x.test`, password: "Temporal2026x" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// =============================================================================
describe("logística y tablero", () => {
  it("actualiza salida/montaje/desmontaje con auditoría", async () => {
    const dateKey = futureDateKey(6);
    const event = await makeEvent({ dateKey, start: "11:00", end: "15:00" });
    await updateEventLogistics(owner, {
      eventId: event.id,
      departureAt: `${dateKey}T08:00`,
      setupStartsAt: `${dateKey}T08:30`,
      teardownAt: `${dateKey}T15:00`,
    });
    const updated = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.departureAt!.toISOString()).toBe(zonedDateTime(dateKey, "08:00").toISOString());
    expect(await prisma.auditLog.count({ where: { action: "event.logistics_updated", entityId: event.id } })).toBe(1);

    await expect(
      updateEventLogistics(owner, { eventId: event.id, departureAt: null, setupStartsAt: `${dateKey}T12:00`, teardownAt: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("el tablero calcula avance, vencidas, coordinación y faltantes de inventario", async () => {
    const dateKey = localDateKey(addDaysUtc(new Date(), 3));
    const e1 = await makeEvent({ dateKey, title: "Tablero A" });
    const e2 = await makeEvent({ dateKey, title: "Tablero B" });
    const item = await prisma.inventoryItem.create({
      data: { sku: uid("SKU-").toUpperCase(), name: "Copa de prueba", category: "GLASSWARE", totalQuantity: 10, maintenanceQuantity: 2 },
    });
    await prisma.inventoryReservation.create({ data: { inventoryItemId: item.id, eventId: e1.id, quantity: 5 } });
    await prisma.inventoryReservation.create({ data: { inventoryItemId: item.id, eventId: e2.id, quantity: 5 } });
    await prisma.eventChecklistItem.createMany({
      data: [
        { eventId: e1.id, phase: "T_MINUS_7", title: "Hecha", status: "DONE" },
        { eventId: e1.id, phase: "T_MINUS_3", title: "Vencida", status: "PENDING", dueAt: new Date(Date.now() - 3_600_000) },
        { eventId: e1.id, phase: "SETUP", title: "Futura", status: "PENDING", dueAt: new Date(Date.now() + 3_600_000) },
        { eventId: e1.id, phase: "SETUP", title: "Omitida", status: "SKIPPED" },
      ],
    });
    const coord = await makeMember({ primaryFunction: "COORDINATOR" });
    await prisma.staffAssignment.create({
      data: { eventId: e2.id, staffMemberId: coord.id, function: "COORDINATOR", startsAt: e2.startsAt, endsAt: e2.endsAt },
    });

    const overview = await getOperationsOverview();
    const a = overview.board.find((e) => e.id === e1.id)!;
    const b = overview.board.find((e) => e.id === e2.id)!;
    expect(a.progress).toMatchObject({ done: 1, total: 4, skipped: 1, percent: 33 });
    expect(a.overdueCount).toBe(1);
    expect(a.hasCoordinator).toBe(false);
    expect(b.hasCoordinator).toBe(true);
    expect(a.shortages).toEqual([{ name: "Copa de prueba", sku: item.sku, reserved: 10, available: 8 }]);
    expect(b.shortages).toHaveLength(1);
    expect(overview.overdueTotal).toBeGreaterThanOrEqual(1);
    expect(overview.overdueItems.length).toBeLessThanOrEqual(50);
  });
});

// =============================================================================
describe("plantillas (CRUD)", () => {
  it("crea, edita, convierte el desfase y elimina con auditoría", async () => {
    const exp = await makeExperience();
    const t = await createTemplate(owner, { name: `QA plantilla ${uid()}`, phase: "SETUP", experienceId: "", sortOrder: 5 });
    expect(t.experienceId).toBeNull();
    const updated = await updateTemplate(owner, { id: t.id, name: t.name, phase: "TEARDOWN", experienceId: exp, active: false, sortOrder: 7 });
    expect(updated).toMatchObject({ phase: "TEARDOWN", experienceId: exp, active: false, sortOrder: 7 });

    const item = await createTemplateItem(owner, {
      templateId: t.id,
      title: "Probar micrófonos",
      area: "ADDONS",
      offsetAmount: 2,
      offsetUnit: "hours",
      offsetDirection: "before",
      defaultFunction: "SETUP",
      requiresEvidence: true,
    });
    expect(item.offsetMinutes).toBe(-120);
    const edited = await updateTemplateItem(owner, {
      id: item.id,
      title: "Probar micrófonos y bocina",
      area: "ADDONS",
      offsetAmount: 3,
      offsetUnit: "days",
      offsetDirection: "after",
      defaultFunction: "",
    });
    expect(edited.offsetMinutes).toBe(3 * 24 * 60);
    expect(edited.defaultFunction).toBeNull();

    await expect(
      createTemplateItem(owner, {
        templateId: t.id,
        title: "Demasiado lejos",
        area: "GENERAL",
        offsetAmount: 400,
        offsetUnit: "days",
        offsetDirection: "before",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(updateTemplate(owner, { id: t.id, name: "QA", phase: "SETUP" })).rejects.toThrow(); // nombre corto

    const staff = await testStaff();
    await expect(
      createTemplate({ id: staff.id, email: staff.email, role: "STAFF" }, { name: "No permitida", phase: "SETUP" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await deleteTemplateItem(owner, edited.id);
    await deleteTemplate(owner, t.id);
    expect(await prisma.checklistTemplate.findUnique({ where: { id: t.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: t.id, action: { startsWith: "checklist_template." } } })).toBe(3);
  });
});

// =============================================================================
describe("checklist: tareas personalizadas y edición admin", () => {
  it("crea, asigna, cambia fecha límite y elimina (auditado)", async () => {
    const dateKey = futureDateKey(6);
    const event = await makeEvent({ dateKey });
    const member = await makeMember();
    const item = await createChecklistItem(owner, {
      eventId: event.id,
      phase: "T_MINUS_1",
      area: "FLOWERS",
      title: "Recoger globos",
      dueAt: `${dateKey}T09:30`,
      assigneeId: member.id,
      requiresEvidence: true,
    });
    expect(item.dueAt!.toISOString()).toBe(zonedDateTime(dateKey, "09:30").toISOString());
    expect(item.assigneeId).toBe(member.id);
    expect(item.templateItemId).toBeNull();

    const moved = await updateChecklistItem(owner, { id: item.id, dueAt: `${dateKey}T10:00`, assigneeId: null });
    expect(moved.dueAt!.toISOString()).toBe(zonedDateTime(dateKey, "10:00").toISOString());
    expect(moved.assigneeId).toBeNull();
    const cleared = await updateChecklistItem(owner, { id: item.id, dueAt: "" });
    expect(cleared.dueAt).toBeNull();
    await expect(updateChecklistItem(owner, { id: item.id, assigneeId: "no-existe" })).rejects.toBeInstanceOf(ValidationError);

    await deleteChecklistItem(owner, item.id);
    expect(await prisma.eventChecklistItem.findUnique({ where: { id: item.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "checklist.item_deleted", entityId: item.id } })).toBe(1);
  });

  it("no genera checklist en eventos cancelados desde el panel", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(6), status: "CANCELLED" });
    await expect(instantiateChecklistsAsAdmin(owner, event.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

// =============================================================================
describe("asignaciones: edición, banderas y notas de add-ons", () => {
  it("recalcula el monto al editar sin monto manual y audita el cambio de pago", async () => {
    const dateKey = futureDateKey(6);
    const event = await makeEvent({ dateKey });
    const hourly = await makeMember({ rateCents: 10_000, rateType: "PER_HOUR" });
    const { assignment } = await createAssignment(owner, {
      eventId: event.id,
      staffMemberId: hourly.id,
      function: "SERVER",
      startsAt: `${dateKey}T10:00`,
      endsAt: `${dateKey}T12:00`,
    });
    expect(assignment.amountCents).toBe(20_000);
    const longer = await updateAssignment(owner, {
      id: assignment.id,
      staffMemberId: hourly.id,
      function: "SERVER",
      startsAt: `${dateKey}T10:00`,
      endsAt: `${dateKey}T14:30`,
      amountCents: null,
      confirmed: true,
    });
    expect(longer.assignment.amountCents).toBe(45_000);
    expect(longer.assignment.confirmed).toBe(true);

    const paid = await setAssignmentFlags(owner, { id: assignment.id, paid: true });
    expect(paid.paid).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "staff_assignment.paid_changed", entityId: assignment.id } })).toBe(1);

    // Turno de más de 24 h: rechazado
    const twoDaysLater = localDateKey(addDaysUtc(zonedDateTime(dateKey, "12:00"), 2));
    await expect(
      updateAssignment(owner, {
        id: assignment.id,
        staffMemberId: hourly.id,
        function: "SERVER",
        startsAt: `${dateKey}T10:00`,
        endsAt: `${twoDaysLater}T10:00`,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("guarda notas operativas de un add-on del evento", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    const slug = uid("addon-");
    const addOn = await prisma.addOn.create({ data: { name: "Upgrade floral QA", slug, priceCents: 100_000 } });
    const ea = await prisma.eventAddOn.create({ data: { eventId: event.id, addOnId: addOn.id, priceCents: 100_000, costCents: 50_000 } });
    const res = await updateEventAddOnNotes(owner, { id: ea.id, notes: "Entrega 8:00 en la bodega" });
    expect(res.notes).toBe("Entrega 8:00 en la bodega");
    const cleared = await updateEventAddOnNotes(owner, { id: ea.id, notes: "" });
    expect(cleared.notes).toBeNull();
    const staff = await testStaff();
    await expect(
      updateEventAddOnNotes({ id: staff.id, email: staff.email, role: "STAFF" }, { id: ea.id, notes: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// =============================================================================
describe("staff (CRUD y accesos)", () => {
  it("crea, edita, lista, desactiva acceso y sólo elimina sin historial", async () => {
    const name = `Integrante QA ${uid()}`;
    const created = await createStaffMember(owner, {
      name,
      primaryFunction: "CHEF",
      phone: "55 1234 5678",
      email: `${uid("chef")}@ivonne-rosa.test`,
      rateCents: 150_000,
      rateType: "PER_EVENT",
      availableWeekdays: [6, 0],
      active: true,
    });
    expect(created.availableWeekdays).toEqual([0, 6]);
    const updated = await updateStaffMember(owner, {
      id: created.id,
      name: created.name,
      primaryFunction: created.primaryFunction,
      phone: created.phone,
      email: created.email,
      rateCents: 160_000,
      rateType: "PER_EVENT",
      availableWeekdays: [5, 6, 0],
      availabilityNotes: "Sábados sólo por la mañana",
      active: true,
    });
    expect(updated.rateCents).toBe(160_000);
    expect(await prisma.auditLog.count({ where: { entityId: created.id, action: { in: ["staff.created", "staff.updated"] } } })).toBe(2);

    const list = await listStaff({ q: name });
    expect(list.map((m) => m.id)).toEqual([created.id]);
    expect((await listStaff({ q: name, status: "inactive" })).length).toBe(0);

    // Con historial no se puede eliminar
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    await prisma.staffAssignment.create({
      data: {
        eventId: event.id,
        staffMemberId: created.id,
        function: "CHEF",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        amountCents: 160_000,
        paid: true,
      },
    });
    await expect(deleteStaffMember(owner, created.id)).rejects.toBeInstanceOf(ConflictError);
    const detail = await getStaffDetail(created.id);
    expect(detail!.upcoming).toHaveLength(1);
    expect(detail!.totals).toMatchObject({ total: 160_000, paid: 160_000, pending: 0 });

    // Acceso: crear, desactivar, reactivar
    await createStaffAccess(owner, { staffMemberId: created.id, email: `${uid("acc")}@ivonne-rosa.test`, password: "Temporal2026x" });
    expect(await setStaffAccessActive(owner, { staffMemberId: created.id, active: false })).toEqual({ active: false });
    const linked = await prisma.staffMember.findUniqueOrThrow({ where: { id: created.id }, include: { user: true } });
    expect(linked.user!.active).toBe(false);
    await setStaffAccessActive(owner, { staffMemberId: created.id, active: true });
    expect(
      await prisma.auditLog.count({ where: { entityId: linked.userId!, action: { in: ["user.deactivated", "user.activated"] } } }),
    ).toBe(2);

    // Sin historial sí se elimina
    const temp = await createStaffMember(owner, {
      name: `Temporal ${uid()}`,
      primaryFunction: "SERVER",
      rateCents: 0,
      rateType: "PER_EVENT",
      availableWeekdays: [],
    });
    await deleteStaffMember(owner, temp.id);
    expect(await prisma.staffMember.findUnique({ where: { id: temp.id } })).toBeNull();
  });

  it("valida datos del integrante y permisos", async () => {
    await expect(
      createStaffMember(owner, { name: "X", primaryFunction: "SERVER", rateCents: 0, rateType: "PER_EVENT", availableWeekdays: [] }),
    ).rejects.toThrow();
    await expect(
      createStaffMember(owner, {
        name: "Teléfono malo",
        primaryFunction: "SERVER",
        phone: "123",
        rateCents: 0,
        rateType: "PER_EVENT",
        availableWeekdays: [],
      }),
    ).rejects.toThrow();
    const staff = await testStaff();
    await expect(
      createStaffMember(
        { id: staff.id, email: staff.email, role: "STAFF" },
        { name: "No permitido", primaryFunction: "SERVER", rateCents: 0, rateType: "PER_EVENT", availableWeekdays: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // Restablecer sin acceso previo: conflicto
    const member = await makeMember();
    await expect(resetStaffPassword(owner, { staffMemberId: member.id, password: "NuevaClave2026" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

// =============================================================================
describe("revisión QA: regresiones", () => {
  it("cambiar estado/responsable/evidencia por la ruta de la Server Action no borra las notas", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    const item = await makeItem(event.id);
    // Igual que la acción: el input llega ya validado por el esquema y el servicio lo vuelve a validar.
    const viaAction = (input: Parameters<typeof updateChecklistItem>[1]) =>
      updateChecklistItem(owner, updateChecklistItemSchema.parse(input));

    await viaAction({ id: item.id, notes: "Llamar a la florería antes de las 9" });
    const started = await viaAction({ id: item.id, status: "IN_PROGRESS" });
    expect(started.notes).toBe("Llamar a la florería antes de las 9");
    const member = await makeMember();
    const reassigned = await viaAction({ id: item.id, assigneeId: member.id });
    expect(reassigned.notes).toBe("Llamar a la florería antes de las 9");
    const media = await makeEvidence(event.id, owner.id);
    const withPhoto = await viaAction({ id: item.id, evidenceMediaId: media.id });
    expect(withPhoto.notes).toBe("Llamar a la florería antes de las 9");
    const cleared = await viaAction({ id: item.id, notes: "" });
    expect(cleared.notes).toBeNull();

    // Portal staff: misma garantía
    const staff = await testStaff();
    const actor: SessionUser = { id: staff.id, email: staff.email, name: staff.name, role: "STAFF" };
    await prisma.staffAssignment.create({
      data: { eventId: event.id, staffMemberId: staff.staffMemberId, function: "SERVER", startsAt: event.startsAt, endsAt: event.endsAt },
    });
    const free = await makeItem(event.id);
    const staffViaAction = (input: Parameters<typeof updateChecklistItemAsStaff>[1]) =>
      updateChecklistItemAsStaff(actor, staffChecklistUpdateSchema.parse(input));
    await staffViaAction({ id: free.id, notes: "Faltaron 2 copas" });
    const done = await staffViaAction({ id: free.id, status: "DONE" });
    expect(done.status).toBe("DONE");
    expect(done.notes).toBe("Faltaron 2 copas");
  });

  it("el staff no puede reabrir una tarea que coordinación omitió", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    const staff = await testStaff();
    const actor: SessionUser = { id: staff.id, email: staff.email, name: staff.name, role: "STAFF" };
    await prisma.staffAssignment.create({
      data: { eventId: event.id, staffMemberId: staff.staffMemberId, function: "SERVER", startsAt: event.startsAt, endsAt: event.endsAt },
    });
    const item = await makeItem(event.id, { assigneeId: staff.staffMemberId });
    await updateChecklistItem(owner, { id: item.id, status: "SKIPPED" });
    await expect(updateChecklistItemAsStaff(actor, { id: item.id, status: "PENDING" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateChecklistItemAsStaff(actor, { id: item.id, status: "DONE" })).rejects.toBeInstanceOf(ForbiddenError);
    // Una nota sí puede dejarla
    const noted = await updateChecklistItemAsStaff(actor, { id: item.id, notes: "No aplicó: la clienta trajo su pastel" });
    expect(noted.status).toBe("SKIPPED");
    // Coordinación sí puede reabrirla
    expect((await updateChecklistItem(owner, { id: item.id, status: "PENDING" })).status).toBe("PENDING");
  });

  it("al cambiar a la persona de una asignación, sus tareas abiertas pasan a quien entra", async () => {
    const dateKey = futureDateKey(6);
    const event = await makeEvent({ dateKey });
    const outgoing = await makeMember({ primaryFunction: "CHEF" });
    const incoming = await makeMember({ primaryFunction: "CHEF" });
    const inactive = await makeMember({ primaryFunction: "CHEF" });
    await prisma.staffMember.update({ where: { id: inactive.id }, data: { active: false } });
    const { assignment } = await createAssignment(owner, {
      eventId: event.id,
      staffMemberId: outgoing.id,
      function: "CHEF",
      startsAt: `${dateKey}T08:00`,
      endsAt: `${dateKey}T16:00`,
    });
    const open = await makeItem(event.id, { assigneeId: outgoing.id });
    const closed = await makeItem(event.id, { assigneeId: outgoing.id });
    await updateChecklistItem(owner, { id: closed.id, status: "DONE" });

    await expect(
      updateAssignment(owner, {
        id: assignment.id,
        staffMemberId: inactive.id,
        function: "CHEF",
        startsAt: `${dateKey}T08:00`,
        endsAt: `${dateKey}T16:00`,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await updateAssignment(owner, {
      id: assignment.id,
      staffMemberId: incoming.id,
      function: "CHEF",
      startsAt: `${dateKey}T08:00`,
      endsAt: `${dateKey}T16:00`,
    });
    expect((await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: open.id } })).assigneeId).toBe(incoming.id);
    // Las tareas ya hechas conservan a quien las hizo
    expect((await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: closed.id } })).assigneeId).toBe(outgoing.id);
    expect(await prisma.auditLog.count({ where: { action: "staff_assignment.updated", entityId: assignment.id } })).toBe(1);
  });

  it("tarea personalizada: rechaza fechas imposibles y eventos cancelados", async () => {
    const event = await makeEvent({ dateKey: futureDateKey(6) });
    await expect(
      createChecklistItem(owner, { eventId: event.id, phase: "SETUP", area: "GENERAL", title: "Fecha imposible", dueAt: "2026-02-30T10:00" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(updateChecklistItem(owner, { id: (await makeItem(event.id)).id, dueAt: "2026-02-30T10:00" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const cancelled = await makeEvent({ dateKey: futureDateKey(6), status: "CANCELLED" });
    await expect(
      createChecklistItem(owner, { eventId: cancelled.id, phase: "SETUP", area: "GENERAL", title: "En cancelado" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("revisión QA: tablero", () => {
  it("cuenta personas distintas (no asignaciones) en el staff de cada evento", async () => {
    const dateKey = localDateKey(addDaysUtc(new Date(), 2));
    const event = await makeEvent({ dateKey, title: "Tablero personas" });
    const member = await makeMember({ primaryFunction: "COORDINATOR" });
    for (const fn of ["COORDINATOR", "DRIVER"] as const) {
      await prisma.staffAssignment.create({
        data: { eventId: event.id, staffMemberId: member.id, function: fn, startsAt: event.startsAt, endsAt: event.endsAt },
      });
    }
    const overview = await getOperationsOverview();
    const card = overview.board.find((e) => e.id === event.id)!;
    expect(card.staffCount).toBe(1);
    expect(card.hasCoordinator).toBe(true);
  });
});
