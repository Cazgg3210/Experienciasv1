/**
 * Integración: módulo Eventos (admin), invitadas (admin) y disponibilidad (calendario).
 * Usa la base de pruebas; crea sus propios fixtures con valores únicos y no asume datos del seed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/db";
import { generateCode } from "@/lib/codes";
import { dateOnly, localDateKey, toDateKey, weekdayOf, zonedDateTime } from "@/lib/dates";
import { generateToken } from "@/lib/tokens";
import type { SessionUser } from "@/server/auth/session";
import { checkAvailability } from "@/features/bookings/server/availability-service";
import {
  createAvailabilityException,
  deleteAvailabilityException,
  getWeeklyRules,
  listExceptions,
  saveWeeklyRules,
} from "@/features/bookings/server/availability-admin-service";
import {
  addAdminMessage,
  cancelEvent,
  createManualEvent,
  deleteTimelineItem,
  rotateEventToken,
  saveTimelineItem,
  transitionEventStatus,
  updateEvent,
} from "@/features/events/server/event-service";
import {
  buildGuestsCsv,
  deleteGuest,
  getGuestsOverview,
  saveGuest,
  sendRsvpReminders,
  setHonoreeMessageHidden,
} from "@/features/events/server/guest-admin-service";
import type { GuestInput, UpdateEventInput } from "@/features/events/schemas";
import { testOwner, uid } from "./helpers";

const DAY_MS = 86_400_000;

let owner: SessionUser;
const createdEventIds: string[] = [];
const createdExceptionIds: string[] = [];
const usedDates = new Set<string>();

async function newCustomer(over: { email?: string | null; phone?: string | null } = {}) {
  const tag = uid("c");
  return prisma.customer.create({
    data: {
      name: `Clienta ${tag}`,
      email: over.email === undefined ? `${tag}@integration.test` : over.email,
      phone: over.phone === undefined ? "5512345678" : over.phone,
      whatsapp: over.phone === undefined ? "5512345678" : over.phone,
      referralCode: `IR-${tag.toUpperCase()}`,
    },
  });
}

/** Fecha aleatoria (40–330 días adelante) sin eventos ni excepciones; no repite fechas en esta corrida. */
async function freeDate(weekday?: number): Promise<string> {
  const today = dateOnly(localDateKey());
  for (let i = 0; i < 400; i++) {
    const offset = 40 + Math.floor(Math.random() * 290);
    const key = toDateKey(new Date(today.getTime() + offset * DAY_MS));
    if (usedDates.has(key)) continue;
    if (weekday !== undefined && weekdayOf(key) !== weekday) continue;
    const day = dateOnly(key);
    const [events, exceptions] = await Promise.all([
      prisma.event.count({ where: { eventDate: day } }),
      prisma.availabilityException.count({ where: { date: day } }),
    ]);
    if (events === 0 && exceptions === 0) {
      usedDates.add(key);
      return key;
    }
  }
  throw new Error("No se encontró una fecha libre para la prueba");
}

/** Abre una fecha con capacidad fija (independiente de las reglas semanales). */
async function openDate(dateKey: string, maxEvents: number) {
  const ex = await prisma.availabilityException.create({
    data: { date: dateOnly(dateKey), type: "CAPACITY_OVERRIDE", maxEvents, reason: "integration" },
  });
  createdExceptionIds.push(ex.id);
  return ex;
}

async function makeEvent(opts: {
  dateKey: string;
  status?: EventStatus;
  start?: string;
  end?: string;
  customerId?: string;
  title?: string;
}) {
  const customerId = opts.customerId ?? (await newCustomer()).id;
  const tag = uid("ev");
  const event = await prisma.event.create({
    data: {
      code: generateCode("EV"),
      title: opts.title ?? `Evento ${tag}`,
      status: opts.status ?? "INQUIRY",
      customerId,
      eventDate: dateOnly(opts.dateKey),
      startsAt: zonedDateTime(opts.dateKey, opts.start ?? "11:00"),
      endsAt: zonedDateTime(opts.dateKey, opts.end ?? "14:00"),
      guestCount: 8,
      micrositeSlug: `it-${tag}`,
      inviteToken: generateToken(),
      portalToken: generateToken(),
    },
  });
  createdEventIds.push(event.id);
  return event;
}

function updateInput(
  event: { id: string; title: string },
  over: Partial<UpdateEventInput> & { date: string },
): UpdateEventInput {
  return {
    eventId: event.id,
    title: event.title,
    occasion: "OTHER",
    startTime: "11:00",
    endTime: "14:00",
    guestCount: 8,
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
    confirmUnavailable: false,
    ...over,
  };
}

function guestInput(eventId: string, over: Partial<GuestInput> = {}): GuestInput {
  return {
    eventId,
    guestId: "",
    name: `Invitada ${uid("g")}`,
    email: "",
    phone: "",
    rsvpStatus: "PENDING",
    plusOne: false,
    plusOneName: "",
    dietaryRestrictions: [],
    dietaryNotes: "",
    comment: "",
    ...over,
  };
}

async function lastAudit(action: string, entityId: string) {
  return prisma.auditLog.findFirst({ where: { action, entityId }, orderBy: { createdAt: "desc" } });
}

beforeAll(async () => {
  owner = await testOwner();
});

afterAll(async () => {
  // Liberar capacidad y fechas usadas por estas pruebas (sin borrar datos ajenos)
  await prisma.event.updateMany({
    where: { id: { in: createdEventIds }, status: { notIn: ["CANCELLED", "COMPLETED"] } },
    data: { status: "CANCELLED", cancellationReason: "integration cleanup" },
  });
  await prisma.availabilityException.deleteMany({ where: { id: { in: createdExceptionIds } } });
});

// -----------------------------------------------------------------------------

describe("alta manual de eventos", () => {
  it("pide confirmación si la fecha no está disponible y crea el evento INQUIRY al confirmar", async () => {
    const dateKey = await freeDate();
    const blocked = await prisma.availabilityException.create({
      data: { date: dateOnly(dateKey), type: "BLOCKED", reason: "integration" },
    });
    createdExceptionIds.push(blocked.id);
    const customer = await newCustomer();
    const input = {
      customerMode: "existing" as const,
      customerId: customer.id,
      newCustomer: { name: "", email: "", phone: "" },
      title: "Cumpleaños de Integración",
      occasion: "BIRTHDAY" as const,
      honoreeName: "Inte",
      date: dateKey,
      startTime: "11:00",
      durationMinutes: 180,
      experienceId: "",
      guestCount: 9,
      serviceAreaId: "",
      addressLine: "Calle 1",
      neighborhood: "Roma",
      postalCode: "06700",
      internalNotes: "",
      confirmUnavailable: false,
    };

    const first = await createManualEvent(input, owner);
    expect(first.status).toBe("needs_confirmation");
    if (first.status !== "needs_confirmation") return;
    expect(first.availability.status).toBe("BLOCKED");

    const created = await createManualEvent({ ...input, confirmUnavailable: true }, owner);
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    createdEventIds.push(created.id);
    const event = await prisma.event.findUniqueOrThrow({ where: { id: created.id } });
    expect(event.status).toBe("INQUIRY");
    expect(event.code).toMatch(/^EV-\d{4}-[A-Z0-9]{4}$/);
    expect(event.micrositeSlug.startsWith("cumpleanos-de-integracion")).toBe(true);
    expect(event.inviteToken).not.toBe(event.portalToken);
    expect(event.inviteToken.length).toBeGreaterThanOrEqual(40);
    expect(toDateKey(event.eventDate)).toBe(dateKey);
    expect(event.endsAt.getTime() - event.startsAt.getTime()).toBe(180 * 60_000);
    expect(event.customerId).toBe(customer.id);
    const audit = await lastAudit("event.created", event.id);
    expect(audit?.actorId).toBe(owner.id);

    // Mismo título => slug distinto
    const again = await createManualEvent({ ...input, confirmUnavailable: true }, owner);
    if (again.status !== "created") throw new Error("esperaba created");
    createdEventIds.push(again.id);
    const second = await prisma.event.findUniqueOrThrow({ where: { id: again.id } });
    expect(second.micrositeSlug).not.toBe(event.micrositeSlug);
  });

  it("crea (o reutiliza) a una clienta nueva por correo", async () => {
    const dateKey = await freeDate();
    await openDate(dateKey, 3);
    const email = `${uid("nueva")}@integration.test`;
    const base = {
      customerMode: "new" as const,
      customerId: "",
      newCustomer: { name: "Nueva Clienta", email: email.toUpperCase(), phone: "" },
      title: "Brunch nuevo",
      occasion: "FRIENDS_BRUNCH" as const,
      honoreeName: "",
      date: dateKey,
      startTime: "11:00",
      durationMinutes: 180,
      experienceId: "",
      guestCount: 6,
      serviceAreaId: "",
      addressLine: "",
      neighborhood: "",
      postalCode: "",
      internalNotes: "",
      confirmUnavailable: true,
    };
    const r1 = await createManualEvent(base, owner);
    const r2 = await createManualEvent(base, owner);
    if (r1.status !== "created" || r2.status !== "created") throw new Error("esperaba created");
    createdEventIds.push(r1.id, r2.id);
    const [e1, e2] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: r1.id }, include: { customer: true } }),
      prisma.event.findUniqueOrThrow({ where: { id: r2.id } }),
    ]);
    expect(e1.customer.email).toBe(email);
    expect(e1.customer.source).toBe("MANUAL");
    expect(e2.customerId).toBe(e1.customerId);
  });
});

describe("transiciones de estado", () => {
  it("recorre el ciclo válido y marca completedAt", async () => {
    const dateKey = await freeDate();
    await openDate(dateKey, 3);
    const event = await makeEvent({ dateKey });
    const steps: EventStatus[] = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"];
    for (const to of steps) {
      const r = await transitionEventStatus({ eventId: event.id, to }, owner);
      expect(r).toMatchObject({ status: "updated", to });
    }
    const done = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBeInstanceOf(Date);
    const audit = await lastAudit("event.status_changed", event.id);
    expect(audit?.before).toEqual({ status: "IN_PROGRESS" });
    expect(audit?.after).toMatchObject({ status: "COMPLETED" });
  });

  it("rechaza transiciones inválidas y la cancelación sin motivo", async () => {
    const dateKey = await freeDate();
    await openDate(dateKey, 3);
    const event = await makeEvent({ dateKey, status: "CONFIRMED" });
    await expect(transitionEventStatus({ eventId: event.id, to: "COMPLETED" }, owner)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await expect(transitionEventStatus({ eventId: event.id, to: "INQUIRY" }, owner)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await expect(transitionEventStatus({ eventId: event.id, to: "CANCELLED" }, owner)).rejects.toMatchObject({
      code: "REASON_REQUIRED",
    });
    await expect(
      transitionEventStatus({ eventId: "noexiste123456", to: "READY" }, owner),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const unchanged = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(unchanged.status).toBe("CONFIRMED");
  });

  it("al ocupar capacidad en un día lleno pide confirmación", async () => {
    const dateKey = await freeDate();
    await openDate(dateKey, 1);
    await makeEvent({ dateKey, status: "CONFIRMED", start: "10:00", end: "13:00" });
    const inquiry = await makeEvent({ dateKey, status: "INQUIRY", start: "16:00", end: "19:00" });

    const r = await transitionEventStatus({ eventId: inquiry.id, to: "CONFIRMED" }, owner);
    expect(r.status).toBe("needs_confirmation");
    if (r.status === "needs_confirmation") expect(r.availability.status).toBe("FULL");
    expect((await prisma.event.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe("INQUIRY");

    const forced = await transitionEventStatus(
      { eventId: inquiry.id, to: "CONFIRMED", confirmUnavailable: true },
      owner,
    );
    expect(forced.status).toBe("updated");
    const audit = await lastAudit("event.status_changed", inquiry.id);
    expect(audit?.after).toMatchObject({ status: "CONFIRMED", overrodeAvailability: true });
  });
});

describe("cancelación", () => {
  it("requiere motivo, cancela reservas de inventario y la reserva comercial, audita y notifica", async () => {
    const dateKey = await freeDate();
    await openDate(dateKey, 3);
    const customer = await newCustomer();
    const event = await makeEvent({ dateKey, status: "CONFIRMED", customerId: customer.id });

    // Reserva comercial (booking) ligada
    const quote = await prisma.quote.create({
      data: {
        code: generateCode("Q"),
        publicToken: generateToken(),
        customerId: customer.id,
        title: event.title,
        guestCount: 8,
        status: "ACCEPTED",
      },
    });
    const booking = await prisma.booking.create({
      data: {
        code: generateCode("B"),
        quoteId: quote.id,
        customerId: customer.id,
        eventId: event.id,
        totalCents: 1_000_000,
        depositRequiredCents: 500_000,
        termsVersion: "test",
        termsAcceptedAt: new Date(),
        acceptedByName: customer.name,
      },
    });

    // Inventario reservado + uno ya devuelto (no debe tocarse)
    const [itemA, itemB] = await Promise.all(
      ["A", "B"].map((s) =>
        prisma.inventoryItem.create({
          data: { sku: `IT-${uid()}-${s}`, name: `Copa ${s}`, category: "GLASSWARE", totalQuantity: 50 },
        }),
      ),
    );
    await prisma.inventoryReservation.createMany({
      data: [
        { inventoryItemId: itemA!.id, eventId: event.id, quantity: 10, status: "RESERVED" },
        { inventoryItemId: itemB!.id, eventId: event.id, quantity: 4, status: "RETURNED" },
      ],
    });

    await expect(
      cancelEvent({ eventId: event.id, reason: "  ", notifyCustomer: false }, owner),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const r = await cancelEvent(
      { eventId: event.id, reason: "La clienta cambió de planes", notifyCustomer: true },
      owner,
    );
    expect(r).toEqual({ status: "cancelled", releasedReservations: 1, notified: true });

    const after = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { inventoryReservations: true, booking: true },
    });
    expect(after.status).toBe("CANCELLED");
    expect(after.cancelledAt).toBeInstanceOf(Date);
    expect(after.cancellationReason).toBe("La clienta cambió de planes");
    const byItem = Object.fromEntries(after.inventoryReservations.map((x) => [x.inventoryItemId, x.status]));
    expect(byItem[itemA!.id]).toBe("CANCELLED");
    expect(byItem[itemB!.id]).toBe("RETURNED");
    expect(after.booking?.id).toBe(booking.id);
    expect(after.booking?.cancelledAt).toBeInstanceOf(Date);

    const movement = await prisma.inventoryMovement.findFirst({
      where: { eventId: event.id, inventoryItemId: itemA!.id, type: "RELEASE" },
    });
    expect(movement?.quantity).toBe(10);

    const audit = await lastAudit("event.cancelled", event.id);
    expect(audit?.after).toMatchObject({
      status: "CANCELLED",
      reason: "La clienta cambió de planes",
      releasedReservations: 1,
    });
    expect(audit?.actorId).toBe(owner.id);

    const notifications = await prisma.notificationLog.findMany({
      where: { eventId: event.id, type: "GENERIC" },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications.some((n) => n.to === customer.email)).toBe(true);

    // Ya cancelado: no se puede cancelar otra vez
    await expect(
      cancelEvent({ eventId: event.id, reason: "Otra vez", notifyCustomer: false }, owner),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("reprogramación", () => {
  it("respeta la disponibilidad excluyendo al propio evento y audita cambios sensibles", async () => {
    const d1 = await freeDate();
    const d2 = await freeDate();
    await openDate(d1, 1);
    await openDate(d2, 1);
    const event = await makeEvent({ dateKey: d1, status: "CONFIRMED" });
    await makeEvent({ dateKey: d2, status: "CONFIRMED" });

    // Mismo día, otro horario: el evento no cuenta contra sí mismo
    const sameDay = await updateEvent(
      updateInput(event, { date: d1, startTime: "15:00", endTime: "18:00" }),
      owner,
    );
    expect(sameDay.status).toBe("updated");
    let audit = await lastAudit("event.updated", event.id);
    expect(audit?.after).toMatchObject({ changed: expect.arrayContaining(["startsAt", "endsAt"]) });

    // Otro día lleno: pide confirmación y no cambia nada
    const toFull = await updateEvent(
      updateInput(event, { date: d2, startTime: "15:00", endTime: "18:00" }),
      owner,
    );
    expect(toFull.status).toBe("needs_confirmation");
    if (toFull.status === "needs_confirmation") expect(toFull.availability.status).toBe("FULL");
    expect(toDateKey((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).eventDate)).toBe(d1);

    const forced = await updateEvent(
      updateInput(event, { date: d2, startTime: "15:00", endTime: "18:00", confirmUnavailable: true }),
      owner,
    );
    expect(forced.status).toBe("updated");
    const moved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(toDateKey(moved.eventDate)).toBe(d2);
    expect(moved.startsAt.toISOString()).toBe(zonedDateTime(d2, "15:00").toISOString());
    audit = await lastAudit("event.updated", event.id);
    expect(audit?.before).toMatchObject({ eventDate: `${d1}T00:00:00.000Z` });
    expect(audit?.after).toMatchObject({ eventDate: `${d2}T00:00:00.000Z`, overrodeAvailability: true });
  });

  it("invitadas se auditan; cambios no sensibles no; sin cambios devuelve unchanged", async () => {
    const d = await freeDate();
    await openDate(d, 2);
    const event = await makeEvent({ dateKey: d, status: "PLANNING" });

    const guests = await updateEvent(updateInput(event, { date: d, guestCount: 11 }), owner);
    expect(guests).toMatchObject({ status: "updated", audited: true });
    const audit = await lastAudit("event.updated", event.id);
    expect(audit?.before).toMatchObject({ guestCount: 8 });
    expect(audit?.after).toMatchObject({ guestCount: 11 });

    const before = await prisma.auditLog.count({ where: { entityId: event.id, action: "event.updated" } });
    const cosmetic = await updateEvent(
      updateInput(event, {
        date: d,
        guestCount: 11,
        hostMessage: "¡Las esperamos!",
        colors: "rosa, salvia, rosa",
      }),
      owner,
    );
    expect(cosmetic).toMatchObject({ status: "updated", audited: false });
    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.colors).toEqual(["rosa", "salvia"]);
    expect(reloaded.hostMessage).toBe("¡Las esperamos!");
    expect(await prisma.auditLog.count({ where: { entityId: event.id, action: "event.updated" } })).toBe(
      before,
    );

    const same = await updateEvent(
      updateInput(event, { date: d, guestCount: 11, hostMessage: "¡Las esperamos!", colors: "rosa, salvia" }),
      owner,
    );
    expect(same.status).toBe("unchanged");
  });

  it("no permite reprogramar eventos cancelados ni horarios inválidos", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d, status: "CANCELLED" });
    const other = await freeDate();
    await expect(updateEvent(updateInput(event, { date: other }), owner)).rejects.toMatchObject({
      code: "SCHEDULE_LOCKED",
    });
    await expect(
      updateEvent(updateInput(event, { date: d, startTime: "14:00", endTime: "12:00" }), owner),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { endTime: expect.any(Array) } });
  });
});

describe("invitadas (admin)", () => {
  it("CRUD, resumen RSVP y CSV con contenido correcto", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d, status: "CONFIRMED" });

    const ana = await saveGuest(
      guestInput(event.id, {
        name: "Ana, la del brunch",
        email: "ANA@Integration.test",
        phone: "5511112222",
        rsvpStatus: "ATTENDING",
        plusOne: true,
        plusOneName: "Luis",
        dietaryRestrictions: ["VEGAN", "VEGAN", "GLUTEN_FREE"],
        comment: '=HYPERLINK("http://x")',
      }),
      owner,
    );
    expect(ana.created).toBe(true);
    const bea = await saveGuest(guestInput(event.id, { name: "Bea", phone: "5533334444" }), owner);
    await saveGuest(guestInput(event.id, { name: "Caro", rsvpStatus: "NOT_ATTENDING" }), owner);

    const stored = await prisma.eventGuest.findUniqueOrThrow({ where: { id: ana.id } });
    expect(stored.source).toBe("ADMIN");
    expect(stored.email).toBe("ana@integration.test");
    expect(stored.dietaryRestrictions.sort()).toEqual(["GLUTEN_FREE", "VEGAN"]);
    expect(stored.respondedAt).toBeInstanceOf(Date);
    expect(stored.token.length).toBeGreaterThanOrEqual(40);

    // Cambiar estado: PENDING -> MAYBE registra respuesta y auditoría
    await saveGuest(
      guestInput(event.id, { guestId: bea.id, name: "Bea", phone: "5533334444", rsvpStatus: "MAYBE" }),
      owner,
    );
    const beaAfter = await prisma.eventGuest.findUniqueOrThrow({ where: { id: bea.id } });
    expect(beaAfter.rsvpStatus).toBe("MAYBE");
    expect(beaAfter.respondedAt).toBeInstanceOf(Date);
    expect((await lastAudit("guest.rsvp_changed", bea.id))?.after).toMatchObject({ rsvpStatus: "MAYBE" });

    // No se puede editar una invitada de otro evento
    const otherEvent = await makeEvent({ dateKey: d, status: "INQUIRY" });
    await expect(
      saveGuest(guestInput(otherEvent.id, { guestId: bea.id, name: "Bea" }), owner),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const overview = await getGuestsOverview(event.id);
    expect(overview?.summary).toMatchObject({
      attending: 1,
      plusOnes: 1,
      attendingTotal: 2,
      maybe: 1,
      notAttending: 1,
      total: 3,
    });
    expect(overview?.dietary.restrictions.map((r) => r.restriction)).toEqual(
      expect.arrayContaining(["VEGAN", "GLUTEN_FREE"]),
    );

    const csv = await buildGuestsCsv(event.id);
    expect(csv).not.toBeNull();
    expect(csv!.filename).toBe(`invitadas-${event.code}.csv`);
    expect(csv!.count).toBe(3);
    expect(csv!.csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv!.csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "Nombre,Email,Teléfono,Estado,Acompañante,Nombre acompañante,Restricciones,Notas alimentarias,Comentario,Origen,Respondió",
    );
    expect(lines).toHaveLength(4);
    const anaLine = lines.find((l) => l.startsWith('"Ana, la del brunch"'));
    expect(anaLine).toBeDefined();
    expect(anaLine).toContain(",Asiste,Sí,Luis,");
    expect(anaLine).toContain("Equipo");
    // Inyección de fórmulas neutralizada
    expect(anaLine).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(await buildGuestsCsv("noexiste1234567")).toBeNull();

    await deleteGuest({ eventId: event.id, guestId: bea.id }, owner);
    expect(await prisma.eventGuest.findUnique({ where: { id: bea.id } })).toBeNull();
    expect(await lastAudit("guest.deleted", bea.id)).not.toBeNull();
    await expect(deleteGuest({ eventId: event.id, guestId: bea.id }, owner)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("recordatorios RSVP: sólo pendientes con contacto y uno por día", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d, status: "CONFIRMED" });
    await saveGuest(guestInput(event.id, { name: "Pendiente WA", phone: "5544445555" }), owner);
    await saveGuest(
      guestInput(event.id, { name: "Pendiente mail", email: `${uid()}@integration.test` }),
      owner,
    );
    await saveGuest(guestInput(event.id, { name: "Sin contacto" }), owner);
    await saveGuest(
      guestInput(event.id, { name: "Ya confirmó", phone: "5566667777", rsvpStatus: "ATTENDING" }),
      owner,
    );

    const first = await sendRsvpReminders(event.id, owner);
    expect(first).toEqual({ sent: 2, failed: 0, alreadySentToday: 0, withoutContact: 1, pending: 3 });
    const logs = await prisma.notificationLog.findMany({
      where: { eventId: event.id, type: "RSVP_REMINDER" },
    });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.dedupeKey?.startsWith("rsvp-reminder:"))).toBe(true);
    expect(logs.some((l) => l.actionUrl?.includes(`/e/${event.micrositeSlug}/`))).toBe(true);

    const second = await sendRsvpReminders(event.id, owner);
    expect(second).toMatchObject({ sent: 0, alreadySentToday: 2 });
    expect(await prisma.notificationLog.count({ where: { eventId: event.id, type: "RSVP_REMINDER" } })).toBe(
      2,
    );

    await prisma.event.update({ where: { id: event.id }, data: { micrositeEnabled: false } });
    await expect(sendRsvpReminders(event.id, owner)).rejects.toMatchObject({ code: "MICROSITE_DISABLED" });
  });

  it("modera mensajes para la homenajeada sólo del propio evento", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d, status: "CONFIRMED" });
    const other = await makeEvent({ dateKey: d, status: "INQUIRY" });
    const msg = await prisma.eventMessage.create({
      data: {
        eventId: event.id,
        kind: "HONOREE",
        authorType: "GUEST",
        authorName: "Ana",
        body: "¡Te queremos!",
      },
    });
    await setHonoreeMessageHidden({ eventId: event.id, messageId: msg.id, hidden: true }, owner);
    expect((await prisma.eventMessage.findUniqueOrThrow({ where: { id: msg.id } })).hidden).toBe(true);
    await setHonoreeMessageHidden({ eventId: event.id, messageId: msg.id, hidden: false }, owner);
    expect((await prisma.eventMessage.findUniqueOrThrow({ where: { id: msg.id } })).hidden).toBe(false);
    await expect(
      setHonoreeMessageHidden({ eventId: other.id, messageId: msg.id, hidden: true }, owner),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("tokens, programa y conversación", () => {
  it("rotar tokens cambia el enlace y audita sin guardar el token completo", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d });
    const portal = await rotateEventToken({ eventId: event.id, kind: "portal" }, owner);
    const invite = await rotateEventToken({ eventId: event.id, kind: "invite" }, owner);
    const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.portalToken).not.toBe(event.portalToken);
    expect(after.inviteToken).not.toBe(event.inviteToken);
    expect(portal.url.endsWith(`/mi-evento/${after.portalToken}`)).toBe(true);
    expect(invite.url.endsWith(`/e/${after.micrositeSlug}/${after.inviteToken}`)).toBe(true);
    const audit = await lastAudit("event.token_rotated", event.id);
    expect(audit?.after).toEqual({ kind: "invite", tokenEnding: after.inviteToken.slice(-4) });
    expect(JSON.stringify(audit?.before)).not.toContain(event.inviteToken);
  });

  it("CRUD del programa del evento acotado al evento", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d });
    const other = await makeEvent({ dateKey: d });
    const base = {
      eventId: event.id,
      itemId: "",
      time: "11:00",
      title: "Llegada y mimosas",
      description: "",
      visibleToGuests: true,
      sortOrder: 10,
    };
    const { id } = await saveTimelineItem(base, owner);
    await saveTimelineItem(
      { ...base, itemId: id, title: "Llegada", visibleToGuests: false, description: "Con música" },
      owner,
    );
    const item = await prisma.eventTimelineItem.findUniqueOrThrow({ where: { id } });
    expect(item).toMatchObject({ title: "Llegada", visibleToGuests: false, description: "Con música" });
    await expect(saveTimelineItem({ ...base, eventId: other.id, itemId: id }, owner)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteTimelineItem({ eventId: other.id, itemId: id }, owner)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await deleteTimelineItem({ eventId: event.id, itemId: id }, owner);
    expect(await prisma.eventTimelineItem.findUnique({ where: { id } })).toBeNull();
  });

  it("responde en la conversación como el equipo y avisa a la clienta", async () => {
    const d = await freeDate();
    const customer = await newCustomer();
    const event = await makeEvent({ dateKey: d, customerId: customer.id });
    const r = await addAdminMessage(
      { eventId: event.id, body: "¡Hola! Ya tenemos tu menú.", notifyCustomer: true },
      owner,
    );
    expect(r.notified).toBe(true);
    const msg = await prisma.eventMessage.findUniqueOrThrow({ where: { id: r.id } });
    expect(msg).toMatchObject({
      kind: "HOST_THREAD",
      authorType: "ADMIN",
      body: "¡Hola! Ya tenemos tu menú.",
    });
    expect(msg.authorName.startsWith("Equipo ")).toBe(true);
    const log = await prisma.notificationLog.findFirst({
      where: { eventId: event.id, type: "GENERIC", channel: "EMAIL" },
    });
    expect(log?.actionUrl).toContain(`/mi-evento/${event.portalToken}`);
  });
});

describe("disponibilidad: reglas semanales y excepciones", () => {
  it("las reglas y excepciones cambian el resultado de checkAvailability", async () => {
    const snapshot = await prisma.availabilityRule.findMany();
    const dateKey = await freeDate();
    const weekday = weekdayOf(dateKey);
    const rules = [0, 1, 2, 3, 4, 5, 6].map((wd) => ({
      weekday: wd,
      isOpen: wd !== weekday,
      maxEvents: wd === weekday ? 0 : 2,
      earliestStart: "08:00",
      latestEnd: "21:00",
    }));
    try {
      await saveWeeklyRules(rules, owner);
      expect((await getWeeklyRules()).find((r) => r.weekday === weekday)?.isOpen).toBe(false);
      expect((await checkAvailability({ date: dateKey })).status).toBe("CLOSED");
      const audit = await prisma.auditLog.findFirst({
        where: { action: "availability.rules_changed", actorId: owner.id },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();

      await saveWeeklyRules(
        rules.map((r) => (r.weekday === weekday ? { ...r, isOpen: true, maxEvents: 2 } : r)),
        owner,
      );
      expect((await checkAvailability({ date: dateKey })).available).toBe(true);

      // Excepción BLOCKED cierra el día; al borrarla vuelve a estar disponible
      const blocked = await createAvailabilityException(
        { date: dateKey, type: "BLOCKED", maxEvents: null, reason: "Vacaciones (test)", serviceAreaId: "" },
        owner,
      );
      createdExceptionIds.push(blocked.id);
      expect((await checkAvailability({ date: dateKey })).status).toBe("BLOCKED");
      const listed = await listExceptions(dateKey);
      expect(listed.find((e) => e.id === blocked.id)).toMatchObject({
        type: "BLOCKED",
        maxEvents: null,
        date: dateKey,
      });
      await expect(
        createAvailabilityException(
          { date: dateKey, type: "BLOCKED", maxEvents: 5, reason: "", serviceAreaId: "" },
          owner,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await deleteAvailabilityException(blocked.id, owner);
      expect((await checkAvailability({ date: dateKey })).available).toBe(true);
      expect(await lastAudit("availability.exception_deleted", blocked.id)).not.toBeNull();

      // Capacidad especial 0 => lleno
      const override = await createAvailabilityException(
        { date: dateKey, type: "CAPACITY_OVERRIDE", maxEvents: 0, reason: "", serviceAreaId: "" },
        owner,
      );
      createdExceptionIds.push(override.id);
      expect((await checkAvailability({ date: dateKey })).status).toBe("FULL");
      await deleteAvailabilityException(override.id, owner);
      await expect(deleteAvailabilityException(override.id, owner)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      // Reglas inválidas
      await expect(
        saveWeeklyRules(
          rules.map((r) => (r.weekday === 2 ? { ...r, isOpen: true, maxEvents: 1, latestEnd: "07:00" } : r)),
          owner,
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    } finally {
      // Restaurar exactamente las reglas previas (la tabla es global)
      const keep = new Set(snapshot.map((r) => r.weekday));
      await prisma.availabilityRule.deleteMany({ where: { weekday: { notIn: [...keep] } } });
      for (const r of snapshot) {
        await prisma.availabilityRule.update({
          where: { weekday: r.weekday },
          data: {
            isOpen: r.isOpen,
            maxEvents: r.maxEvents,
            earliestStart: r.earliestStart,
            latestEnd: r.latestEnd,
          },
        });
      }
    }
  });
});

// -----------------------------------------------------------------------------
// Revisión QA: efectos colaterales de reprogramar, reintentos y validaciones extra
// -----------------------------------------------------------------------------

describe("revisión QA", () => {
  it("al reprogramar mueve turnos de staff y tareas abiertas (no las terminadas)", async () => {
    const d1 = await freeDate();
    const d2 = await freeDate();
    await openDate(d1, 2);
    await openDate(d2, 2);
    const event = await makeEvent({ dateKey: d1, status: "CONFIRMED" });
    const member = await prisma.staffMember.create({ data: { name: `Staff ${uid()}` } });
    const shift = await prisma.staffAssignment.create({
      data: {
        eventId: event.id,
        staffMemberId: member.id,
        function: "SERVER",
        startsAt: zonedDateTime(d1, "09:30"),
        endsAt: zonedDateTime(d1, "15:00"),
      },
    });
    const open = await prisma.eventChecklistItem.create({
      data: { eventId: event.id, phase: "SETUP", title: "Montaje", dueAt: zonedDateTime(d1, "10:00") },
    });
    const done = await prisma.eventChecklistItem.create({
      data: {
        eventId: event.id,
        phase: "T_MINUS_7",
        title: "Compras",
        status: "DONE",
        completedAt: new Date(),
        dueAt: zonedDateTime(d1, "08:00"),
      },
    });

    try {
      const res = await updateEvent(
        updateInput(event, { date: d2, startTime: "12:00", endTime: "15:00" }),
        owner,
      );
      expect(res).toMatchObject({ status: "updated", shifted: { staffShifts: 1, checklistItems: 1 } });
      // Delta = (d2 12:00) - (d1 11:00)
      const delta = zonedDateTime(d2, "12:00").getTime() - zonedDateTime(d1, "11:00").getTime();
      const movedShift = await prisma.staffAssignment.findUniqueOrThrow({ where: { id: shift.id } });
      expect(movedShift.startsAt.getTime()).toBe(zonedDateTime(d1, "09:30").getTime() + delta);
      expect(movedShift.endsAt.getTime()).toBe(zonedDateTime(d1, "15:00").getTime() + delta);
      const movedTask = await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: open.id } });
      expect(movedTask.dueAt?.getTime()).toBe(zonedDateTime(d1, "10:00").getTime() + delta);
      const doneTask = await prisma.eventChecklistItem.findUniqueOrThrow({ where: { id: done.id } });
      expect(doneTask.dueAt?.getTime()).toBe(zonedDateTime(d1, "08:00").getTime());
      const audit = await lastAudit("event.updated", event.id);
      expect(audit?.after).toMatchObject({ shiftedStaffShifts: 1, shiftedChecklistItems: 1 });

      // Cambiar sólo invitadas no mueve nada
      const noMove = await updateEvent(
        updateInput(event, { date: d2, startTime: "12:00", endTime: "15:00", guestCount: 9 }),
        owner,
      );
      expect(noMove).toMatchObject({ status: "updated", shifted: { staffShifts: 0, checklistItems: 0 } });
    } finally {
      await prisma.staffAssignment.deleteMany({ where: { eventId: event.id } });
      await prisma.staffMember.delete({ where: { id: member.id } });
    }
  });

  it("no pisa un evento cuyo estado cambió mientras se editaba", async () => {
    const d = await freeDate();
    await openDate(d, 2);
    const event = await makeEvent({ dateKey: d, status: "CONFIRMED" });
    // Simula la carrera: el servicio ya leyó CONFIRMED y otra persona lo cancela justo antes de guardar.
    const realTransaction = prisma.$transaction.bind(prisma) as (fn: unknown) => Promise<unknown>;
    const spy = vi.spyOn(prisma, "$transaction").mockImplementationOnce((async (fn: unknown) => {
      await prisma.event.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
      return realTransaction(fn);
    }) as never);
    try {
      await expect(updateEvent(updateInput(event, { date: d, guestCount: 12 }), owner)).rejects.toMatchObject(
        {
          code: "CONFLICT",
        },
      );
    } finally {
      spy.mockRestore();
    }
    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reloaded.guestCount).toBe(8);
    expect(reloaded.status).toBe("CANCELLED");
  });

  it("recordatorio fallido se puede reintentar el mismo día; uno omitido no", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d, status: "CONFIRMED" });
    const email = `${uid()}@integration.test`;
    const g = await saveGuest(guestInput(event.id, { name: "Reintento", email }), owner);
    const skipped = await saveGuest(guestInput(event.id, { name: "Omitida", phone: "5577778888" }), owner);
    const day = localDateKey();
    // Intento previo fallido (error del proveedor) y otro omitido (canal desactivado)
    await prisma.notificationLog.create({
      data: {
        type: "RSVP_REMINDER",
        channel: "EMAIL",
        status: "FAILED",
        provider: "mock",
        to: email,
        body: "x",
        eventId: event.id,
        dedupeKey: `rsvp-reminder:${g.id}:${day}:email`,
      },
    });
    await prisma.notificationLog.create({
      data: {
        type: "RSVP_REMINDER",
        channel: "WHATSAPP",
        status: "SKIPPED",
        provider: "mock",
        to: "5577778888",
        body: "x",
        eventId: event.id,
        dedupeKey: `rsvp-reminder:${skipped.id}:${day}:wa`,
      },
    });

    const res = await sendRsvpReminders(event.id, owner);
    expect(res).toMatchObject({ sent: 1, failed: 0, alreadySentToday: 1 });
    const retry = await prisma.notificationLog.findUnique({
      where: { dedupeKey: `rsvp-reminder:${g.id}:${day}:email:r2` },
    });
    expect(retry).not.toBeNull();
    expect(retry?.status).not.toBe("FAILED");

    const again = await sendRsvpReminders(event.id, owner);
    expect(again).toMatchObject({ sent: 0, alreadySentToday: 2 });
  });

  it("avisa de invitadas duplicadas por correo o teléfono y permite confirmarlas", async () => {
    const d = await freeDate();
    const event = await makeEvent({ dateKey: d, status: "CONFIRMED" });
    const other = await makeEvent({ dateKey: d, status: "INQUIRY" });
    const email = `${uid()}@integration.test`;
    const ana = await saveGuest(guestInput(event.id, { name: "Ana", email, phone: "55 1212 3434" }), owner);

    await expect(
      saveGuest(guestInput(event.id, { name: "Ana bis", email: email.toUpperCase() }), owner),
    ).rejects.toMatchObject({ code: "DUPLICATE_GUEST", fieldErrors: { email: expect.any(Array) } });
    await expect(
      saveGuest(guestInput(event.id, { name: "Ana tel", phone: "+52 5512123434" }), owner),
    ).rejects.toMatchObject({ code: "DUPLICATE_GUEST", fieldErrors: { phone: expect.any(Array) } });
    // Editarse a sí misma con los mismos datos sí se permite; en otro evento también
    await expect(
      saveGuest(guestInput(event.id, { guestId: ana.id, name: "Ana", email, phone: "5512123434" }), owner),
    ).resolves.toMatchObject({ created: false });
    await expect(saveGuest(guestInput(other.id, { name: "Ana", email }), owner)).resolves.toMatchObject({
      created: true,
    });
    // Familia que comparte WhatsApp: con confirmación explícita sí se guarda
    const sister = await saveGuest(
      guestInput(event.id, { name: "Hermana de Ana", phone: "5512123434", allowDuplicateContact: true }),
      owner,
    );
    expect(sister.created).toBe(true);
    // Editar a la hermana sin tocar el teléfono no vuelve a bloquear
    await expect(
      saveGuest(
        guestInput(event.id, {
          guestId: sister.id,
          name: "Hermana de Ana",
          phone: "5512123434",
          rsvpStatus: "ATTENDING",
        }),
        owner,
      ),
    ).resolves.toMatchObject({ created: false });
  });

  it("no crea excepciones en fechas pasadas y avisa si el día ya tiene eventos", async () => {
    const yesterday = toDateKey(new Date(dateOnly(localDateKey()).getTime() - DAY_MS));
    await expect(
      createAvailabilityException(
        { date: yesterday, type: "BLOCKED", maxEvents: null, reason: "", serviceAreaId: "" },
        owner,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", fieldErrors: { date: expect.any(Array) } });

    const d = await freeDate();
    await makeEvent({ dateKey: d, status: "CONFIRMED" });
    await makeEvent({ dateKey: d, status: "INQUIRY" });
    const ex = await createAvailabilityException(
      { date: d, type: "BLACKOUT", maxEvents: null, reason: "Festivo (test)", serviceAreaId: "" },
      owner,
    );
    createdExceptionIds.push(ex.id);
    expect(ex.eventsThatDay).toBe(1);
  });

  it("no envía recordatorios RSVP de un evento cuya fecha ya pasó", async () => {
    const yesterday = toDateKey(new Date(dateOnly(localDateKey()).getTime() - DAY_MS));
    const event = await makeEvent({ dateKey: yesterday, status: "READY" });
    await saveGuest(guestInput(event.id, { name: "Tarde", email: `${uid()}@integration.test` }), owner);
    await expect(sendRsvpReminders(event.id, owner)).rejects.toMatchObject({ code: "EVENT_CLOSED" });
    expect(await prisma.notificationLog.count({ where: { eventId: event.id } })).toBe(0);
  });
});
