/**
 * Integración: portal de la clienta (/mi-evento) + micrositio y RSVP (/e/[slug]/[token]).
 * Usa la base de pruebas (TEST_DATABASE_URL). Cada prueba crea sus propios datos únicos.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EventStatus } from "@prisma/client";
import { prisma } from "@/db";
import { generateToken } from "@/lib/tokens";
import { dateOnly, zonedDateTime, localDateKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { testOwner, uid } from "./helpers";
import { getPortalDashboard, requestPortalAccess, resolveInvite, resolvePortalEvent } from "@/features/portal/server/portal-service";
import {
  sendHostMessage,
  submitHostReview,
  updateHostAddress,
  updateHostPreferences,
} from "@/features/portal/server/host-service";
import { addGuestAsHost, removeGuestAsHost } from "@/features/guests/server/guest-service";
import { submitRsvp } from "@/features/guests/server/rsvp-service";
import { deleteGuest, getGuestsOverview } from "@/features/events/server/guest-admin-service";
import { getInviteCalendar, getInviteView } from "@/features/guests/server/invite-queries";
import { PORTAL_ACCESS_NEUTRAL_MESSAGE } from "@/features/portal/domain/portal";
import type { RsvpFormValues } from "@/features/guests/schemas";

const DAY = 24 * 60 * 60 * 1000;
const createdCustomerIds: string[] = [];
const createdEventIds: string[] = [];

async function makeCustomer(email?: string) {
  const c = await prisma.customer.create({
    data: {
      name: "Sofía Prueba",
      email: email ?? `${uid("cliente")}@example.test`,
      referralCode: uid("REF").toUpperCase(),
    },
  });
  createdCustomerIds.push(c.id);
  return c;
}

async function makeEvent(opts: {
  customerId?: string;
  status?: EventStatus;
  daysFromNow?: number;
  micrositeEnabled?: boolean;
  guestCount?: number;
} = {}) {
  const customerId = opts.customerId ?? (await makeCustomer()).id;
  const startsAt = new Date(Date.now() + (opts.daysFromNow ?? 20) * DAY);
  const dateKey = localDateKey(startsAt);
  const start = zonedDateTime(dateKey, "11:00");
  const event = await prisma.event.create({
    data: {
      code: uid("EV-").toUpperCase(),
      title: "Cumpleaños de prueba",
      status: opts.status ?? "CONFIRMED",
      customerId,
      eventDate: dateOnly(dateKey),
      startsAt: start,
      endsAt: new Date(start.getTime() + 4 * 60 * 60 * 1000),
      guestCount: opts.guestCount ?? 8,
      addressLine: "Lope de Vega 214, depto. 5",
      neighborhood: "Polanco V Sección",
      postalCode: "11560",
      addressNotes: "Portón negro",
      colors: ["#E9C9BE"],
      honoreeName: "Sofía",
      micrositeSlug: `t-${uid()}`,
      micrositeEnabled: opts.micrositeEnabled ?? true,
      inviteToken: generateToken(),
      portalToken: generateToken(),
      timeline: {
        create: [
          { time: "08:00", title: "Salida de bodega", visibleToGuests: false, sortOrder: 0 },
          { time: "11:00", title: "Bienvenida", visibleToGuests: true, sortOrder: 1 },
        ],
      },
    },
  });
  createdEventIds.push(event.id);
  return event;
}

function rsvp(overrides: Partial<RsvpFormValues> = {}): RsvpFormValues {
  return {
    name: "Camila Torres",
    email: "",
    rsvpStatus: "ATTENDING",
    plusOne: false,
    plusOneName: "",
    dietaryRestrictions: [],
    dietaryNotes: "",
    comment: "",
    honoreeMessage: "",
    photoConsent: true,
    ...overrides,
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Limpieza de lo creado por esta suite (nunca truncar tablas).
  await prisma.notificationLog.deleteMany({ where: { eventId: { in: createdEventIds } } });
  await prisma.review.deleteMany({ where: { eventId: { in: createdEventIds } } });
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.$disconnect();
});

describe("resolución de tokens", () => {
  it("resolvePortalEvent encuentra por portalToken y rechaza tokens inválidos", async () => {
    const ev = await makeEvent();
    expect((await resolvePortalEvent(ev.portalToken))?.id).toBe(ev.id);
    expect(await resolvePortalEvent(generateToken())).toBeNull();
    expect(await resolvePortalEvent("corto")).toBeNull();
    expect(await resolvePortalEvent("../../etc/passwd-aaaaaaaaaaaaaaaa")).toBeNull();
    // el token de invitación NO abre el portal
    expect(await resolvePortalEvent(ev.inviteToken)).toBeNull();
  });

  it("resolveInvite: slug incorrecto, micrositio deshabilitado o token ajeno → null", async () => {
    const ev = await makeEvent();
    const other = await makeEvent();
    expect((await resolveInvite(ev.micrositeSlug, ev.inviteToken))?.via).toBe("invite");
    expect(await resolveInvite(other.micrositeSlug, ev.inviteToken)).toBeNull();
    expect(await resolveInvite("no-existe-este-slug", ev.inviteToken)).toBeNull();
    expect(await resolveInvite("SLUG INVALIDO", ev.inviteToken)).toBeNull();
    // el portalToken no sirve como invitación
    expect(await resolveInvite(ev.micrositeSlug, ev.portalToken)).toBeNull();

    const guest = await prisma.eventGuest.create({
      data: { eventId: other.id, name: "De otro evento", token: generateToken() },
    });
    expect(await resolveInvite(ev.micrositeSlug, guest.token)).toBeNull();
    expect((await resolveInvite(other.micrositeSlug, guest.token))?.guest?.id).toBe(guest.id);

    const disabled = await makeEvent({ micrositeEnabled: false });
    expect(await resolveInvite(disabled.micrositeSlug, disabled.inviteToken)).toBeNull();
  });
});

describe("RSVP del micrositio", () => {
  // BUG-003: el link general ya NO re-identifica por nombre/email (permitía sobrescribir la respuesta de
  // otra invitada y recibir su link personal). Cada respuesta con el link general es una invitada nueva.
  it("link general crea invitada SELF_RSVP; otra respuesta con el mismo nombre crea otra (posible duplicado) sin tocar la primera", async () => {
    const ev = await makeEvent();
    const first = await submitRsvp({
      slug: ev.micrositeSlug,
      token: ev.inviteToken,
      rsvp: rsvp({ name: "Camila Torres", dietaryRestrictions: ["VEGAN"], honoreeMessage: "¡Feliz cumple!" }),
    });
    expect(first.outcome).toBe("created");
    expect(first.via).toBe("invite");
    expect(first.possibleDuplicate).toBe(false);
    expect(first.guestToken).not.toBe(ev.inviteToken);

    const created = await prisma.eventGuest.findUniqueOrThrow({ where: { id: first.guestId } });
    expect(created.source).toBe("SELF_RSVP");
    expect(created.rsvpStatus).toBe("ATTENDING");
    expect(created.respondedAt).not.toBeNull();
    expect(created.dietaryRestrictions).toEqual(["VEGAN"]);

    const second = await submitRsvp(
      {
        slug: ev.micrositeSlug,
        token: ev.inviteToken,
        rsvp: rsvp({ name: "  camila   TORRES ", rsvpStatus: "NOT_ATTENDING", honoreeMessage: "Te quiero" }),
      },
      { ip: "203.0.113.7" },
    );
    expect(second.outcome).toBe("created");
    expect(second.possibleDuplicate).toBe(true);
    expect(second.guestId).not.toBe(first.guestId);
    expect(second.guestToken).not.toBe(first.guestToken);
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(2);
    // La primera invitada queda intacta
    expect(await prisma.eventGuest.findUniqueOrThrow({ where: { id: first.guestId } })).toEqual(created);
    const other = await prisma.eventGuest.findUniqueOrThrow({ where: { id: second.guestId } });
    expect(other).toMatchObject({ source: "SELF_RSVP", rsvpStatus: "NOT_ATTENDING", name: "camila TORRES", plusOne: false });

    // mensaje para la homenajeada: uno por invitada, cada una el suyo
    const honoree = await prisma.eventMessage.findMany({ where: { eventId: ev.id, kind: "HONOREE" }, orderBy: { createdAt: "asc" } });
    expect(honoree.map((m) => [m.guestId, m.body, m.authorType])).toEqual([
      [first.guestId, "¡Feliz cumple!", "GUEST"],
      [second.guestId, "Te quiero", "GUEST"],
    ]);

    // Rastro para el equipo (al registrarse la segunda) y marca visible para la anfitriona. Las dos se
    // registraron solas con el link general: ninguna probó ser quien dice, así que se marcan las DOS y
    // cada una dice con quién coincide (el orden de llegada no decide cuál es la original).
    const audits = await prisma.auditLog.findMany({ where: { action: "guest.possible_duplicate", entityId: second.guestId } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.ip).toBe("203.0.113.7");
    expect(audits[0]!.after).toMatchObject({ eventId: ev.id, matchedGuestIds: [first.guestId] });
    expect(await prisma.auditLog.count({ where: { action: "guest.possible_duplicate", entityId: first.guestId } })).toBe(0);
    const dashboard = await getPortalDashboard(ev.portalToken);
    expect(dashboard?.guests.map((g) => [g.id, g.possibleDuplicate, g.duplicateHint])).toEqual([
      [first.guestId, true, "Coincide con «camila TORRES» de tu lista. Primero confírmalo con ella y, si es la misma persona, escríbenos y dejamos un solo registro."],
      [second.guestId, true, "Coincide con «Camila Torres» de tu lista. Primero confírmalo con ella y, si es la misma persona, escríbenos y dejamos un solo registro."],
    ]);

    const tracked = await prisma.analyticsEvent.count({ where: { type: "RSVP_SUBMIT", eventId: ev.id } });
    expect(tracked).toBe(2);
  });

  it("link general nunca toma a una invitada existente por nombre ni por email: no la modifica ni entrega su token", async () => {
    const ev = await makeEvent();
    const added = await addGuestAsHost(ev.portalToken, { name: "Valentina Ortega", contact: "vale@example.test" });
    await prisma.eventGuest.update({
      where: { id: added.id },
      data: {
        rsvpStatus: "ATTENDING",
        dietaryRestrictions: ["VEGAN"],
        dietaryNotes: "Alergia severa a la nuez",
        comment: "Llego tarde",
        respondedAt: new Date(),
      },
    });
    const before = await prisma.eventGuest.findUniqueOrThrow({ where: { id: added.id } });

    const byName = await submitRsvp({
      slug: ev.micrositeSlug,
      token: ev.inviteToken,
      rsvp: rsvp({ name: "valentina ortega", rsvpStatus: "NOT_ATTENDING" }),
    });
    const byEmail = await submitRsvp({
      slug: ev.micrositeSlug,
      token: ev.inviteToken,
      rsvp: rsvp({ name: "Otra Persona", email: "VALE@example.test", rsvpStatus: "MAYBE" }),
    });
    for (const res of [byName, byEmail]) {
      expect(res.outcome).toBe("created");
      expect(res.possibleDuplicate).toBe(true);
      expect(res.guestId).not.toBe(added.id);
      expect(res.guestToken).not.toBe(added.token);
    }
    expect(await prisma.eventGuest.findUniqueOrThrow({ where: { id: added.id } })).toEqual(before);
    expect(await prisma.eventGuest.findUniqueOrThrow({ where: { id: byEmail.guestId } })).toMatchObject({
      source: "SELF_RSVP",
      email: "vale@example.test",
      rsvpStatus: "MAYBE",
    });
    // El link personal recibido es el de la invitada nueva: no muestra datos de la original
    const view = await getInviteView(ev.micrositeSlug, byName.guestToken);
    expect(view?.guest).toMatchObject({ name: "valentina ortega", rsvpStatus: "NOT_ATTENDING", dietaryNotes: null, comment: null });
    expect(JSON.stringify(view)).not.toContain("Alergia severa a la nuez");
  });

  it("amiga agregada por la anfitriona que responde con el link general: se marca con quién coincide y el aviso pide confirmarlo y conservar el registro de la anfitriona", async () => {
    const ev = await makeEvent();
    const friend = await addGuestAsHost(ev.portalToken, { name: "Lucía Vega", contact: "lucia.vega@example.test" });
    const answered = await submitRsvp({
      slug: ev.micrositeSlug,
      token: ev.inviteToken,
      rsvp: rsvp({ name: "Lucía Vega", rsvpStatus: "ATTENDING" }),
    });
    expect(answered.possibleDuplicate).toBe(true);
    // La auditoría se escribe en la misma transacción que la invitada (visible en cuanto responde).
    expect(await prisma.auditLog.count({ where: { action: "guest.possible_duplicate", entityId: answered.guestId } })).toBe(1);

    const rows = new Map((await getPortalDashboard(ev.portalToken))!.guests.map((g) => [g.id, g]));
    expect(rows.get(friend.id)).toMatchObject({ possibleDuplicate: false, duplicateHint: null, canRemove: true });
    expect(rows.get(answered.guestId)).toMatchObject({
      possibleDuplicate: true,
      canRemove: false,
      duplicateHint:
        "Coincide con «Lucía Vega» de tu lista. Primero confírmalo con ella: si este registro no es suyo, escríbenos y lo quitamos; si sí es suyo, pídele que responda desde su link personal. No quites el registro de «Lucía Vega».",
    });
    // El equipo ve lo mismo en el admin (con quién coincide), sin marcar a la que agregó la anfitriona.
    const overview = await getGuestsOverview(ev.id);
    expect(overview!.possibleDuplicates.get(answered.guestId)).toEqual(["Lucía Vega"]);
    expect(overview!.possibleDuplicates.has(friend.id)).toBe(false);

    // Si el auto-registro no era de ella, el equipo lo quita (la anfitriona no puede): queda el registro que ella
    // agregó, con su link personal, y ya no hay posible duplicado.
    await deleteGuest({ eventId: ev.id, guestId: answered.guestId }, await testOwner());
    const after = await getPortalDashboard(ev.portalToken);
    expect(after!.guests.map((g) => [g.id, g.possibleDuplicate, g.duplicateHint, g.canRemove])).toEqual([[friend.id, false, null, true]]);
  });

  // Tope del link general (pendiente #6 de BUG-003): la lista no pasa de guestCount + margen (techo 60).
  async function fillGuests(eventId: string, count: number, source: "HOST" | "SELF_RSVP" = "SELF_RSVP") {
    await prisma.eventGuest.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        eventId,
        name: `Relleno ${source} ${i + 1} ${uid()}`,
        token: generateToken(),
        source,
        rsvpStatus: source === "SELF_RSVP" ? ("ATTENDING" as const) : ("PENDING" as const),
      })),
    });
  }

  it("link general: con la lista en guestCount + margen rechaza con GUEST_LIMIT y no crea; el link personal y la anfitriona siguen", async () => {
    const ev = await makeEvent({ guestCount: 8 }); // tope = 8 + máx(5, ⌈4⌉) = 13
    const host = await addGuestAsHost(ev.portalToken, { name: "Amiga Agregada", contact: "" });
    await fillGuests(ev.id, 11); // 12 en la lista: una abajo del tope
    expect((await getPortalDashboard(ev.portalToken))!.invitationFull).toBe(false);

    const last = await submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp({ name: "La Trece" }) });
    expect(last.outcome).toBe("created");
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(13);
    expect((await getPortalDashboard(ev.portalToken))!.invitationFull).toBe(true);

    // En el borde: rechazo cálido, sin números, igual con o sin coincidencia de nombre (sin enumeración)
    for (const name of ["La Catorce", "Amiga Agregada"]) {
      const err = await submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp({ name }) }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        code: "GUEST_LIMIT",
        status: 409,
        message:
          "¡Gracias por querer acompañarnos! Este enlace ya no recibe más respuestas. Pídele a la anfitriona tu link personal y confirma desde ahí.",
      });
    }
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(13);
    expect(await prisma.auditLog.count({ where: { action: "guest.possible_duplicate", after: { path: ["eventId"], equals: ev.id } } })).toBe(0);

    // El link personal no cuenta contra el tope: actualiza a su invitada
    const personal = await submitRsvp({ slug: ev.micrositeSlug, token: host.token, rsvp: rsvp({ name: "Amiga Agregada", rsvpStatus: "MAYBE" }) });
    expect(personal).toMatchObject({ outcome: "updated", guestId: host.id, rsvpStatus: "MAYBE" });
    // La anfitriona sigue agregando desde su portal (sólo la frena el techo de 60)
    const more = await addGuestAsHost(ev.portalToken, { name: "Agregada Después del Tope", contact: "" });
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(14);
    expect(await prisma.eventGuest.findUniqueOrThrow({ where: { id: more.id } })).toMatchObject({ source: "HOST", rsvpStatus: "PENDING" });
  });

  it("dos respuestas simultáneas por el link general en el borde del tope: sólo entra una", async () => {
    const ev = await makeEvent({ guestCount: 10 }); // tope = 15
    await fillGuests(ev.id, 14);
    // Carrera escenificada de forma determinista: una transacción de la prueba retiene las escrituras en
    // EventGuest (LOCK ... SHARE deja leer, no insertar) hasta que las dos respuestas estén esperando en la base.
    // Sin el candado del evento (`lockEventGuests`) las dos leerían 14 y entrarían (16: comprobado quitándolo);
    // con él, la segunda espera a que la primera confirme, ya cuenta 15 y recibe GUEST_LIMIT.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let markLocked!: () => void;
    const locked = new Promise<void>((resolve) => (markLocked = resolve));
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`LOCK TABLE "EventGuest" IN SHARE MODE`);
        markLocked();
        await gate;
      },
      { timeout: 30_000 },
    );
    await locked;
    const settled = Promise.allSettled(
      ["Carrera Uno", "Carrera Dos"].map((name) =>
        submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp({ name }) }),
      ),
    );
    const waitingOnLocks = async () => {
      const rows = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`;
      return rows[0]?.n ?? 0;
    };
    try {
      await expect.poll(waitingOnLocks, { timeout: 10_000, interval: 50 }).toBeGreaterThanOrEqual(2);
    } finally {
      release();
      await holder;
    }
    const results = await settled;
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.map((r) => (r.reason as AppError).code)).toEqual(["GUEST_LIMIT"]);
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(15);
  });

  it("guestCount grande: el techo de 60 manda", async () => {
    const ev = await makeEvent({ guestCount: 100 });
    await fillGuests(ev.id, 30, "HOST");
    await fillGuests(ev.id, 29);
    await submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp({ name: "La Sesenta" }) });
    await expect(
      submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp({ name: "La Sesenta y Uno" }) }),
    ).rejects.toMatchObject({ code: "GUEST_LIMIT" });
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(60);
  });

  it("token personal actualiza a la invitada correcta y no toca a las demás", async () => {
    const ev = await makeEvent();
    const a = await prisma.eventGuest.create({ data: { eventId: ev.id, name: "Andrea", token: generateToken() } });
    const b = await prisma.eventGuest.create({ data: { eventId: ev.id, name: "Brenda", token: generateToken(), email: "brenda@example.test" } });
    const res = await submitRsvp({
      slug: ev.micrositeSlug,
      token: b.token,
      rsvp: rsvp({ name: "Brenda Ochoa", rsvpStatus: "ATTENDING", plusOne: true, plusOneName: "Luis", email: "" }),
    });
    expect(res.via).toBe("guest");
    expect(res.guestId).toBe(b.id);
    const after = await prisma.eventGuest.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.name).toBe("Brenda Ochoa");
    expect(after.plusOne).toBe(true);
    expect(after.plusOneName).toBe("Luis");
    expect(after.email).toBe("brenda@example.test"); // email vacío no borra el existente
    const untouched = await prisma.eventGuest.findUniqueOrThrow({ where: { id: a.id } });
    expect(untouched.rsvpStatus).toBe("PENDING");
    expect(untouched.respondedAt).toBeNull();
  });

  it("link general: reenviar sin mensaje no borra el mensaje para la homenajeada; el link personal sí puede", async () => {
    const ev = await makeEvent();
    const first = await submitRsvp({
      slug: ev.micrositeSlug,
      token: ev.inviteToken,
      rsvp: rsvp({ name: "Paula Mena", honoreeMessage: "¡Te quiero mucho!" }),
    });
    // Segunda respuesta con el link general (formulario vacío): es otra invitada y el mensaje se conserva.
    const second = await submitRsvp({
      slug: ev.micrositeSlug,
      token: ev.inviteToken,
      rsvp: rsvp({ name: "paula mena", rsvpStatus: "MAYBE", honoreeMessage: "" }),
    });
    expect(second.guestId).not.toBe(first.guestId);
    let msgs = await prisma.eventMessage.findMany({ where: { eventId: ev.id, kind: "HONOREE" } });
    expect(msgs.map((m) => [m.guestId, m.body])).toEqual([[first.guestId, "¡Te quiero mucho!"]]);

    // Con su link personal (formulario precargado), dejarlo vacío lo elimina.
    await submitRsvp({ slug: ev.micrositeSlug, token: first.guestToken, rsvp: rsvp({ name: "Paula Mena", honoreeMessage: "" }) });
    msgs = await prisma.eventMessage.findMany({ where: { eventId: ev.id, kind: "HONOREE" } });
    expect(msgs).toHaveLength(0);
  });

  it("el micrositio nunca envía el email completo de la invitada (sólo una pista enmascarada)", async () => {
    const ev = await makeEvent();
    const g = await prisma.eventGuest.create({
      data: { eventId: ev.id, name: "Renata Ríos", token: generateToken(), email: "renata.rios@example.test" },
    });
    const view = await getInviteView(ev.micrositeSlug, g.token);
    expect(view?.guest?.emailHint).toBe("re•••@example.test");
    expect(JSON.stringify(view)).not.toContain("renata.rios@");
  });

  it("evento cancelado bloquea el RSVP", async () => {
    const ev = await makeEvent({ status: "CANCELLED" });
    await expect(
      submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp() }),
    ).rejects.toMatchObject({ code: "EVENT_CANCELLED" });
    expect(await prisma.eventGuest.count({ where: { eventId: ev.id } })).toBe(0);

    // El micrositio muestra el aviso (no el formulario) y no se ofrece calendario.
    const view = await getInviteView(ev.micrositeSlug, ev.inviteToken);
    expect(view?.event.cancelled).toBe(true);
    expect(view?.event.rsvpOpen).toBe(false);
    expect(await getInviteCalendar(ev.micrositeSlug, ev.inviteToken)).toBeNull();
  });

  it("evento ya terminado cierra el RSVP; token inválido → no encontrado", async () => {
    const past = await makeEvent({ status: "COMPLETED", daysFromNow: -5 });
    await expect(submitRsvp({ slug: past.micrositeSlug, token: past.inviteToken, rsvp: rsvp() })).rejects.toBeInstanceOf(AppError);
    const ev = await makeEvent();
    await expect(
      submitRsvp({ slug: ev.micrositeSlug, token: generateToken(), rsvp: rsvp() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("micrositio: dirección completa sólo para quien confirma; sin datos de otras invitadas", async () => {
    const ev = await makeEvent();
    await prisma.eventGuest.create({ data: { eventId: ev.id, name: "Secreta Invitada", token: generateToken() } });
    const generic = await getInviteView(ev.micrositeSlug, ev.inviteToken);
    expect(generic?.address).toBeNull();
    expect(generic?.event.neighborhood).toBe("Polanco V Sección");
    expect(JSON.stringify(generic)).not.toContain("Lope de Vega");
    expect(JSON.stringify(generic)).not.toContain("Secreta Invitada");
    expect(JSON.stringify(generic)).not.toContain(ev.portalToken);
    expect(generic?.timeline.map((t) => t.title)).toEqual(["Bienvenida"]);

    const res = await submitRsvp({ slug: ev.micrositeSlug, token: ev.inviteToken, rsvp: rsvp({ name: "Mónica" }) });
    const personal = await getInviteView(ev.micrositeSlug, res.guestToken);
    expect(personal?.address?.addressLine).toBe("Lope de Vega 214, depto. 5");
    expect(personal?.guest?.name).toBe("Mónica");

    const ics = await getInviteCalendar(ev.micrositeSlug, res.guestToken);
    expect(ics?.content).toContain("BEGIN:VEVENT");
    expect(ics?.content).toContain("Lope de Vega 214");
    const genericIcs = await getInviteCalendar(ev.micrositeSlug, ev.inviteToken);
    expect(genericIcs?.content).not.toContain("Lope de Vega");
  });
});

describe("lista de invitadas de la anfitriona", () => {
  it("agrega invitada HOST con token y valida contacto y duplicados", async () => {
    const ev = await makeEvent();
    const g = await addGuestAsHost(ev.portalToken, { name: "Regina Lara", contact: "55 1234 5678" });
    const row = await prisma.eventGuest.findUniqueOrThrow({ where: { id: g.id } });
    expect(row.source).toBe("HOST");
    expect(row.rsvpStatus).toBe("PENDING");
    expect(row.phone).toBe("55 1234 5678");
    expect(row.token.length).toBeGreaterThanOrEqual(40);

    const withEmail = await addGuestAsHost(ev.portalToken, { name: "Ximena", contact: "Xime@Example.test" });
    expect((await prisma.eventGuest.findUniqueOrThrow({ where: { id: withEmail.id } })).email).toBe("xime@example.test");

    await expect(addGuestAsHost(ev.portalToken, { name: "regina  lara", contact: "" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(addGuestAsHost(ev.portalToken, { name: "Otra", contact: "123" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(addGuestAsHost(generateToken(), { name: "Nadie", contact: "" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("sólo quita invitadas HOST pendientes de su propio evento", async () => {
    const ev = await makeEvent();
    const other = await makeEvent();
    const pending = await addGuestAsHost(ev.portalToken, { name: "Pendiente", contact: "" });
    const answered = await addGuestAsHost(ev.portalToken, { name: "Respondió", contact: "" });
    await prisma.eventGuest.update({ where: { id: answered.id }, data: { rsvpStatus: "ATTENDING" } });
    const self = await prisma.eventGuest.create({
      data: { eventId: ev.id, name: "Por su cuenta", token: generateToken(), source: "SELF_RSVP" },
    });
    const foreign = await addGuestAsHost(other.portalToken, { name: "Ajena", contact: "" });

    await expect(removeGuestAsHost(ev.portalToken, answered.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeGuestAsHost(ev.portalToken, self.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeGuestAsHost(ev.portalToken, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.eventGuest.count({ where: { id: foreign.id } })).toBe(1);

    await removeGuestAsHost(ev.portalToken, pending.id, { ip: "127.0.0.1" });
    expect(await prisma.eventGuest.count({ where: { id: pending.id } })).toBe(0);
    const log = await prisma.auditLog.findFirst({ where: { action: "event.guest_removed_by_host", entityId: pending.id } });
    expect(log).not.toBeNull();
  });

  it("evento completado o cancelado no admite cambios en la lista", async () => {
    const ev = await makeEvent({ status: "COMPLETED", daysFromNow: -3 });
    await expect(addGuestAsHost(ev.portalToken, { name: "Tarde", contact: "" })).rejects.toMatchObject({
      code: "EVENT_CLOSED",
    });
  });
});

describe("acceso al portal por email", () => {
  it("responde lo mismo exista o no la clienta y sólo notifica a clientas reales", async () => {
    const customer = await makeCustomer();
    const ev = await makeEvent({ customerId: customer.id });
    const unknownEmail = `${uid("nadie")}@example.test`;

    const real = await requestPortalAccess(customer.email!.toUpperCase());
    const fake = await requestPortalAccess(unknownEmail);
    expect(real).toEqual(fake);
    expect(real.message).toBe(PORTAL_ACCESS_NEUTRAL_MESSAGE);

    const sent = await prisma.notificationLog.findMany({ where: { type: "PORTAL_ACCESS", to: customer.email! } });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.eventId).toBe(ev.id);
    expect(sent[0]!.actionUrl).toContain(`/mi-evento/${ev.portalToken}`);
    expect(await prisma.notificationLog.count({ where: { type: "PORTAL_ACCESS", to: unknownEmail } })).toBe(0);
  });

  it("con varios eventos, el enlace principal es el del próximo evento", async () => {
    const customer = await makeCustomer();
    await makeEvent({ customerId: customer.id, status: "COMPLETED", daysFromNow: -20 });
    const upcoming = await makeEvent({ customerId: customer.id, daysFromNow: 15 });
    await requestPortalAccess(customer.email!);
    const sent = await prisma.notificationLog.findFirstOrThrow({ where: { type: "PORTAL_ACCESS", to: customer.email! } });
    expect(sent.eventId).toBe(upcoming.id);
    expect(sent.actionUrl).toContain(`/mi-evento/${upcoming.portalToken}`);
  });

  it("no envía nada si la clienta sólo tiene eventos cancelados o antiguos", async () => {
    const customer = await makeCustomer();
    await makeEvent({ customerId: customer.id, status: "CANCELLED" });
    await makeEvent({ customerId: customer.id, status: "COMPLETED", daysFromNow: -90 });
    const res = await requestPortalAccess(customer.email!);
    expect(res.message).toBe(PORTAL_ACCESS_NEUTRAL_MESSAGE);
    expect(await prisma.notificationLog.count({ where: { type: "PORTAL_ACCESS", to: customer.email! } })).toBe(0);
  });
});

describe("preferencias, dirección, mensajes y opinión", () => {
  it("actualiza preferencias y deja mensaje SYSTEM en el hilo", async () => {
    const ev = await makeEvent();
    const res = await updateHostPreferences(ev.portalToken, {
      colors: ["#e9c9be", "#A3B18A", "#a3b18a"],
      honoreeName: "Sofía",
      dressCode: "Casual chic",
      hostMessage: "¡Las espero!",
      customerNotes: "",
      playlistUrl: "https://open.spotify.com/playlist/abc",
    });
    expect(res.changed).toEqual(["colors", "dressCode", "hostMessage", "playlistUrl"]);
    const saved = await prisma.event.findUniqueOrThrow({ where: { id: ev.id } });
    expect(saved.colors).toEqual(["#E9C9BE", "#A3B18A"]);
    expect(saved.dressCode).toBe("Casual chic");
    expect(saved.playlistUrl).toBe("https://open.spotify.com/playlist/abc");
    const sys = await prisma.eventMessage.findMany({ where: { eventId: ev.id, kind: "HOST_THREAD", authorType: "SYSTEM" } });
    expect(sys).toHaveLength(1);
    expect(sys[0]!.body).toMatch(/^La anfitriona actualizó/);
    expect(sys[0]!.body).toContain("la playlist");

    // Sin cambios → sin mensaje nuevo
    const again = await updateHostPreferences(ev.portalToken, {
      colors: ["#E9C9BE", "#A3B18A"],
      honoreeName: "Sofía",
      dressCode: "Casual chic",
      hostMessage: "¡Las espero!",
      customerNotes: "",
      playlistUrl: "https://open.spotify.com/playlist/abc",
    });
    expect(again.changed).toEqual([]);
    expect(await prisma.eventMessage.count({ where: { eventId: ev.id, authorType: "SYSTEM" } })).toBe(1);
    const audited = await prisma.auditLog.count({ where: { action: "event.host_preferences_updated", entityId: ev.id } });
    expect(audited).toBe(1);
  });

  it("evento completado o cancelado: preferencias bloqueadas; cancelado no admite mensajes", async () => {
    const done = await makeEvent({ status: "COMPLETED", daysFromNow: -3 });
    const prefs = { colors: [], honoreeName: "", dressCode: "Blanco", hostMessage: "", customerNotes: "", playlistUrl: "" };
    await expect(updateHostPreferences(done.portalToken, prefs)).rejects.toMatchObject({ code: "EVENT_CLOSED" });
    const cancelled = await makeEvent({ status: "CANCELLED" });
    await expect(sendHostMessage(cancelled.portalToken, { body: "Hola" })).rejects.toMatchObject({ code: "EVENT_CLOSED" });
    await expect(updateHostPreferences(generateToken(), prefs)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("dirección editable hasta 48 h antes", async () => {
    const ev = await makeEvent({ daysFromNow: 10 });
    const ok = await updateHostAddress(ev.portalToken, {
      addressLine: "Lago Alberto 320",
      neighborhood: "Granada",
      postalCode: "11520",
      addressNotes: "Registrarse en recepción",
      mapsUrl: "",
    });
    expect(ok.changed.length).toBeGreaterThan(0);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })).neighborhood).toBe("Granada");

    const soon = await makeEvent({ daysFromNow: 1 });
    await expect(
      updateHostAddress(soon.portalToken, {
        addressLine: "Otra calle 1",
        neighborhood: "Roma",
        postalCode: "",
        addressNotes: "",
        mapsUrl: "",
      }),
    ).rejects.toMatchObject({ code: "ADDRESS_LOCKED" });
  });

  it("mensajes de la anfitriona y dashboard sin datos internos", async () => {
    const ev = await makeEvent();
    await prisma.event.update({ where: { id: ev.id }, data: { internalNotes: "NOTA-INTERNA-SECRETA" } });
    await sendHostMessage(ev.portalToken, { body: "¿Pueden traer más flores?" });
    const msgs = await prisma.eventMessage.findMany({ where: { eventId: ev.id, kind: "HOST_THREAD" } });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.authorType).toBe("CUSTOMER");

    const dash = await getPortalDashboard(ev.portalToken);
    expect(dash?.messages.map((m) => m.body)).toContain("¿Pueden traer más flores?");
    expect(JSON.stringify(dash)).not.toContain("NOTA-INTERNA-SECRETA");
    expect(dash?.permissions.editable).toBe(true);
    expect(dash?.timeline).toHaveLength(2);
    expect(dash?.links.invite).toContain(`/e/${ev.micrositeSlug}/${ev.inviteToken}`);
    expect(await getPortalDashboard(generateToken())).toBeNull();
  });

  it("opinión sólo para eventos completados y una sola vez", async () => {
    const upcoming = await makeEvent();
    await expect(
      submitHostReview(upcoming.portalToken, { rating: 5, npsScore: 10, comment: "", publishable: true }),
    ).rejects.toMatchObject({ code: "REVIEW_NOT_AVAILABLE" });

    const done = await makeEvent({ status: "COMPLETED", daysFromNow: -2 });
    await submitHostReview(done.portalToken, { rating: 5, npsScore: 9, comment: "¡Increíble!", publishable: true });
    const review = await prisma.review.findUniqueOrThrow({ where: { eventId: done.id } });
    expect(review.rating).toBe(5);
    expect(review.npsScore).toBe(9);
    expect(review.publishable).toBe(true);
    await expect(
      submitHostReview(done.portalToken, { rating: 4, npsScore: null, comment: "", publishable: false }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
