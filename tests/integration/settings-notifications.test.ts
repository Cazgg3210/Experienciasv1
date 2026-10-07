/**
 * Integración: configuración, usuarios, auditoría, contenido, bandeja y recordatorios programados.
 * Usa SIEMPRE la base de pruebas; crea sus propios fixtures con valores únicos y nunca trunca tablas.
 * El programador se ejecuta con `scope` por clienta para no tocar datos de otras pruebas.
 */
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/db";
import { dateOnly, localDateKey } from "@/lib/dates";
import { isEnabled } from "@/lib/flags";
import { generateToken } from "@/lib/tokens";
import type { SessionUser } from "@/server/auth/session";
import { runScheduledNotifications } from "@/features/notifications/server/scheduler";
import { listNotifications, setNotificationRead } from "@/features/notifications/server/inbox-service";
import { parseInboxFilters } from "@/features/notifications/domain/inbox-filters";
import {
  DAY_MS,
  HOUR_MS,
  dedupeKeys,
  retryArchiveKey,
  withChannel,
} from "@/features/notifications/domain/schedule-rules";
import {
  getFlagStates,
  getSettings,
  patchSettings,
  resetFlagOverride,
  setFlagOverride,
} from "@/features/settings/server/settings-service";
import { formToPricing, pricingToForm } from "@/features/settings/domain/pricing-form";
import { sendTestEmail } from "@/features/settings/server/integrations-service";
import {
  changeUserRole,
  createUser,
  resetUserPassword,
  setUserActive,
} from "@/features/users/server/user-service";
import { listAuditLogs } from "@/features/audit/server/audit-queries";
import { revokeSessionsOnSignOut } from "@/features/auth/server/session-service";
import {
  deleteGalleryItem,
  deleteTestimonial,
  saveTestimonial,
  setGalleryFeatured,
  updateGalleryAlt,
} from "@/features/content/server/content-service";
import { testOwner, uid } from "./helpers";

let owner: SessionUser;

beforeAll(async () => {
  owner = await testOwner();
});

afterAll(async () => {
  vi.doUnmock("@/features/notifications/server/scheduler");
});

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function digits(n: number): string {
  let s = "";
  while (s.length < n) s += Math.floor(Math.random() * 10).toString();
  return s;
}

async function createCustomer() {
  const id = uid("sn");
  return prisma.customer.create({
    data: {
      name: `Clienta ${id}`,
      email: `${id}@example.test`,
      phone: `55${digits(8)}`,
      referralCode: `R${id}`.toUpperCase(),
    },
  });
}

async function createQuote(customerId: string, data: { status: "SENT" | "ACCEPTED"; validUntil: Date | null }) {
  const id = uid("q");
  return prisma.quote.create({
    data: {
      code: `Q-T-${id}`.toUpperCase(),
      publicToken: generateToken(),
      customerId,
      title: `Propuesta ${id}`,
      guestCount: 8,
      totalCents: 1_000_000,
      status: data.status,
      validUntil: data.validUntil,
      sentAt: new Date(),
    },
  });
}

async function createEvent(
  customerId: string,
  data: { startsAt: Date; status: "CONFIRMED" | "COMPLETED"; completedAt?: Date | null },
) {
  const id = uid("ev");
  return prisma.event.create({
    data: {
      code: `EV-T-${id}`.toUpperCase(),
      title: `Brunch ${id}`,
      status: data.status,
      customerId,
      eventDate: dateOnly(localDateKey(data.startsAt)),
      startsAt: data.startsAt,
      endsAt: new Date(data.startsAt.getTime() + 3 * HOUR_MS),
      completedAt: data.completedAt ?? null,
      guestCount: 8,
      micrositeSlug: `t-${id}`,
      inviteToken: generateToken(),
      portalToken: generateToken(),
    },
  });
}

// -----------------------------------------------------------------------------
// Programador de recordatorios
// -----------------------------------------------------------------------------

describe("runScheduledNotifications", () => {
  it("envía cada recordatorio una sola vez (idempotente), expira cotizaciones y respeta RSVP", async () => {
    const now = new Date();
    const ns = await getSettings("notifications");
    const customer = await createCustomer();

    // Cotizaciones: una por vencer y una vencida
    const expiring = await createQuote(customer.id, {
      status: "SENT",
      validUntil: new Date(now.getTime() + Math.min(10, ns.quoteExpiringHoursBefore - 1 || 1) * HOUR_MS),
    });
    const overdue = await createQuote(customer.id, { status: "SENT", validUntil: new Date(now.getTime() - HOUR_MS) });

    // Evento en ~3 días (RSVP + 7D) con reserva y saldo pendiente que vence mañana
    const daysAhead = Math.min(3, ns.rsvpReminderDaysBefore);
    const upcoming = await createEvent(customer.id, {
      status: "CONFIRMED",
      startsAt: new Date(now.getTime() + daysAhead * DAY_MS + 2 * HOUR_MS),
    });
    const accepted = await createQuote(customer.id, { status: "ACCEPTED", validUntil: null });
    const booking = await prisma.booking.create({
      data: {
        code: `B-T-${uid()}`.toUpperCase(),
        quoteId: accepted.id,
        customerId: customer.id,
        eventId: upcoming.id,
        totalCents: 1_000_000,
        depositRequiredCents: 500_000,
        termsVersion: "test",
        termsAcceptedAt: now,
        acceptedByName: customer.name,
        balanceDueAt: new Date(now.getTime() + DAY_MS),
      },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: "DEPOSIT",
        status: "PAID",
        provider: "mock",
        amountCents: 500_000,
        idempotencyKey: uid("idem"),
        paidAt: now,
      },
    });
    const guestEmail = await prisma.eventGuest.create({
      data: { eventId: upcoming.id, name: "Invitada Email", email: `${uid("g")}@example.test`, token: generateToken() },
    });
    const guestPhone = await prisma.eventGuest.create({
      data: { eventId: upcoming.id, name: "Invitada Tel", phone: `55${digits(8)}`, token: generateToken() },
    });
    const guestNoContact = await prisma.eventGuest.create({
      data: { eventId: upcoming.id, name: "Invitada Sin Contacto", token: generateToken() },
    });
    const guestAttending = await prisma.eventGuest.create({
      data: {
        eventId: upcoming.id,
        name: "Invitada Confirmada",
        email: `${uid("g")}@example.test`,
        token: generateToken(),
        rsvpStatus: "ATTENDING",
      },
    });

    // Evento en 30 h (48H) y evento completado hace 4 días (post-evento + reseña)
    const soon = await createEvent(customer.id, { status: "CONFIRMED", startsAt: new Date(now.getTime() + 30 * HOUR_MS) });
    const done = await createEvent(customer.id, {
      status: "COMPLETED",
      startsAt: new Date(now.getTime() - 4 * DAY_MS - 4 * HOUR_MS),
      completedAt: new Date(now.getTime() - 4 * DAY_MS),
    });

    const scope = { scope: { customerIds: [customer.id] } };
    const first = await runScheduledNotifications(now, scope);
    expect(first.failedRules).toEqual([]);
    expect(first.counts).toEqual({
      quoteExpiring: 2, // email + WhatsApp
      quotesExpired: 1,
      paymentDue: 2,
      rsvpReminder: 2, // sólo pendientes con contacto: 1 email + 1 WhatsApp
      event7d: 2,
      event48h: 2,
      postEvent: 2,
      reviewRequest: 2,
    });
    expect(first.total).toBe(15);

    const logsWhere = {
      OR: [
        { quoteId: { in: [expiring.id, overdue.id] } },
        { eventId: { in: [upcoming.id, soon.id, done.id] } },
      ],
    };
    const logsAfterFirst = await prisma.notificationLog.count({ where: logsWhere });
    expect(logsAfterFirst).toBe(14); // 15 reglas - 1 expiración (no envía mensaje)

    // Segunda ejecución: nada nuevo
    const second = await runScheduledNotifications(now, scope);
    expect(second.total).toBe(0);
    expect(await prisma.notificationLog.count({ where: logsWhere })).toBe(logsAfterFirst);

    // Cotización vencida → EXPIRED + expiredAt + auditoría
    const expired = await prisma.quote.findUniqueOrThrow({ where: { id: overdue.id } });
    expect(expired.status).toBe("EXPIRED");
    expect(expired.expiredAt?.getTime()).toBe(now.getTime());
    expect(await prisma.auditLog.count({ where: { action: "quote.expired", entityId: overdue.id } })).toBe(1);
    // La que vence pronto sigue enviada
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: expiring.id } })).status).toBe("SENT");

    // RSVP: sólo a invitadas pendientes con email/teléfono, con su enlace personal
    const rsvp = await prisma.notificationLog.findMany({
      where: { eventId: upcoming.id, type: "RSVP_REMINDER" },
      select: { to: true, channel: true, actionUrl: true },
    });
    expect(rsvp).toHaveLength(2);
    const byChannel = Object.fromEntries(rsvp.map((r) => [r.channel, r]));
    expect(byChannel.EMAIL?.to).toBe(guestEmail.email);
    expect(byChannel.EMAIL?.actionUrl).toContain(`/e/${upcoming.micrositeSlug}/${guestEmail.token}`);
    expect(byChannel.WHATSAPP?.to).toBe(`52${guestPhone.phone}`);
    expect(byChannel.WHATSAPP?.actionUrl).toContain(`/e/${upcoming.micrositeSlug}/${guestPhone.token}`);
    const allTo = rsvp.map((r) => r.to);
    expect(allTo).not.toContain(guestAttending.email);
    expect(rsvp.some((r) => r.actionUrl?.includes(guestNoContact.token))).toBe(false);

    // Saldo: monto correcto (10,000 - 5,000) y enlace al portal
    const due = await prisma.notificationLog.findFirstOrThrow({
      where: { eventId: upcoming.id, type: "PAYMENT_DUE", channel: "EMAIL" },
    });
    expect(due.body).toContain("$5,000");
    expect(due.actionUrl).toContain(`/mi-evento/${upcoming.portalToken}`);

    // Post-evento sin Memory Capsule publicada → enlace al portal
    const post = await prisma.notificationLog.findFirstOrThrow({ where: { eventId: done.id, type: "POST_EVENT", channel: "EMAIL" } });
    expect(post.actionUrl).toContain(`/mi-evento/${done.portalToken}`);
    expect(post.body).toContain("Ver mi evento");

    // Bandeja: búsqueda por destinatario y marcar leído
    const inbox = await listNotifications(parseInboxFilters({ q: customer.email! }), 1);
    expect(inbox.items.length).toBeGreaterThanOrEqual(6);
    expect(inbox.items.every((i) => i.to === customer.email)).toBe(true);
    const target = inbox.items[0]!;
    const read = await setNotificationRead(target.id, true, owner);
    expect(read.readAt).toBeInstanceOf(Date);
    const unread = await setNotificationRead(target.id, false, owner);
    expect(unread.readAt).toBeNull();
  });

  it("reintenta un envío FALLIDO (archivando el intento) sin duplicar los exitosos, con tope de intentos", async () => {
    const now = new Date();
    const customer = await createCustomer();
    const quote = await createQuote(customer.id, { status: "SENT", validUntil: new Date(now.getTime() + 5 * HOUR_MS) });
    const emailKey = withChannel(dedupeKeys.quoteExpiring(quote.id, quote.validUntil!), "email");
    const failed = await prisma.notificationLog.create({
      data: {
        type: "QUOTE_EXPIRING",
        channel: "EMAIL",
        status: "FAILED",
        provider: "resend",
        to: customer.email!,
        body: "x",
        error: "timeout",
        quoteId: quote.id,
        dedupeKey: emailKey,
      },
    });
    const scope = { scope: { customerIds: [customer.id] } };

    const first = await runScheduledNotifications(now, scope);
    expect(first.counts.quoteExpiring).toBe(2); // reintento por email + WhatsApp nuevo
    const archived = await prisma.notificationLog.findUniqueOrThrow({ where: { id: failed.id } });
    expect(archived.dedupeKey).toBe(retryArchiveKey(emailKey, 1));
    expect(archived.status).toBe("FAILED");
    const retried = await prisma.notificationLog.findUniqueOrThrow({ where: { dedupeKey: emailKey } });
    expect(retried.id).not.toBe(failed.id);
    expect(retried.status).toBe("MOCKED");

    const second = await runScheduledNotifications(now, scope);
    expect(second.counts.quoteExpiring).toBe(0);
    expect(await prisma.notificationLog.count({ where: { quoteId: quote.id } })).toBe(3);

    // Con los intentos agotados ya no se reintenta
    const quote2 = await createQuote(customer.id, { status: "SENT", validUntil: new Date(now.getTime() + 6 * HOUR_MS) });
    const key2 = withChannel(dedupeKeys.quoteExpiring(quote2.id, quote2.validUntil!), "email");
    const base = { type: "QUOTE_EXPIRING" as const, channel: "EMAIL" as const, status: "FAILED" as const, provider: "resend", to: customer.email!, body: "x", quoteId: quote2.id };
    await prisma.notificationLog.createMany({
      data: [
        { ...base, dedupeKey: retryArchiveKey(key2, 1) },
        { ...base, dedupeKey: retryArchiveKey(key2, 2) },
        { ...base, dedupeKey: key2 },
      ],
    });
    const third = await runScheduledNotifications(now, scope);
    expect(third.counts.quoteExpiring).toBe(1); // sólo el WhatsApp de la segunda cotización
    expect((await prisma.notificationLog.findUniqueOrThrow({ where: { dedupeKey: key2 } })).status).toBe("FAILED");
  });

  it("no reenvía post-evento si ya existe un registro POST_EVENT ni pide reseña si ya hay una", async () => {
    const now = new Date();
    const customer = await createCustomer();
    const done = await createEvent(customer.id, {
      status: "COMPLETED",
      startsAt: new Date(now.getTime() - 5 * DAY_MS),
      completedAt: new Date(now.getTime() - 5 * DAY_MS + 3 * HOUR_MS),
    });
    await prisma.notificationLog.create({
      data: { type: "POST_EVENT", channel: "EMAIL", status: "MOCKED", provider: "mock-email", to: customer.email!, body: "x", eventId: done.id },
    });
    await prisma.review.create({ data: { eventId: done.id, customerId: customer.id, rating: 5 } });
    const res = await runScheduledNotifications(now, { scope: { customerIds: [customer.id] } });
    expect(res.counts.postEvent).toBe(0);
    expect(res.counts.reviewRequest).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Ruta de cron
// -----------------------------------------------------------------------------

describe("/api/cron/notifications", () => {
  async function loadRoute() {
    vi.resetModules();
    vi.doMock("@/features/notifications/server/scheduler", () => ({
      runScheduledNotifications: vi.fn(async () => ({
        ranAt: "2026-10-01T00:00:00.000Z",
        counts: { quoteExpiring: 0, quotesExpired: 0, paymentDue: 0, rsvpReminder: 0, event7d: 0, event48h: 0, postEvent: 0, reviewRequest: 0 },
        total: 0,
        failedRules: [],
      })),
    }));
    return import("@/app/api/cron/notifications/route");
  }

  it("401 sin encabezado o con secreto incorrecto; 200 con el secreto (GET y POST)", async () => {
    const secret = process.env.CRON_SECRET;
    expect(secret, "CRON_SECRET debe estar en .env para esta prueba").toBeTruthy();
    const { GET, POST } = await loadRoute();
    const url = "http://localhost/api/cron/notifications";

    const noHeader = await GET(new Request(url));
    expect(noHeader.status).toBe(401);
    expect(await noHeader.json()).toMatchObject({ ok: false });

    const wrong = await POST(new Request(url, { method: "POST", headers: { authorization: "Bearer nope" } }));
    expect(wrong.status).toBe(401);

    const ok = await GET(new Request(url, { headers: { authorization: `Bearer ${secret}` } }));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { ok: boolean; counts: Record<string, number> };
    expect(body.ok).toBe(true);
    expect(body.counts).toHaveProperty("rsvpReminder", 0);
    expect(ok.headers.get("cache-control")).toBe("no-store");

    const okPost = await POST(new Request(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } }));
    expect(okPost.status).toBe(200);
  });

  it("503 si CRON_SECRET no está configurado", async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const { GET } = await loadRoute();
      const res = await GET(new Request("http://localhost/api/cron/notifications", { headers: { authorization: "Bearer x" } }));
      expect(res.status).toBe(503);
    } finally {
      process.env.CRON_SECRET = saved;
      vi.resetModules();
    }
  });
});

// -----------------------------------------------------------------------------
// Usuarios y roles
// -----------------------------------------------------------------------------

describe("usuarios y roles", () => {
  it("OWNER no puede crear SUPER_ADMIN; crea STAFF con contraseña hasheada y auditoría", async () => {
    const email = `${uid("u")}@ivonne-rosa.test`;
    await expect(
      createUser({ name: "Nueva Admin", email, role: "SUPER_ADMIN", password: "Contrasena-Segura-1" }, owner),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();

    const { id } = await createUser({ name: "Staff Nueva", email: email.toUpperCase(), role: "STAFF", password: "Contrasena-Segura-1" }, owner);
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user.email).toBe(email); // normalizado a minúsculas
    expect(user.role).toBe("STAFF");
    expect(user.passwordHash).toBeTruthy();
    expect(await bcrypt.compare("Contrasena-Segura-1", user.passwordHash!)).toBe(true);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.created", entityId: id } });
    expect(JSON.stringify(log.after)).not.toContain("Contrasena-Segura-1");
    expect(JSON.stringify(log.after)).not.toContain(user.passwordHash!);

    await expect(
      createUser({ name: "Duplicada", email, role: "STAFF", password: "Contrasena-Segura-2" }, owner),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("vincula una ficha de staff al crear la cuenta", async () => {
    const member = await prisma.staffMember.create({ data: { name: `Mesera ${uid()}`, primaryFunction: "SERVER" } });
    const { id } = await createUser(
      { name: member.name, email: `${uid("m")}@ivonne-rosa.test`, role: "STAFF", password: "Contrasena-Segura-3", staffMemberId: member.id },
      owner,
    );
    expect((await prisma.staffMember.findUniqueOrThrow({ where: { id: member.id } })).userId).toBe(id);
  });

  it("nadie puede cambiar su propio rol; OWNER cambia roles de staff (auditado)", async () => {
    await expect(changeUserRole({ userId: owner.id, role: "STAFF" }, owner)).rejects.toMatchObject({ code: "CONFLICT" });

    const { id } = await createUser(
      { name: "Futura Fundadora", email: `${uid("r")}@ivonne-rosa.test`, role: "STAFF", password: "Contrasena-Segura-4" },
      owner,
    );
    const updated = await changeUserRole({ userId: id, role: "OWNER" }, owner);
    expect(updated.role).toBe("OWNER");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.role_changed", entityId: id } });
    expect(log.before).toMatchObject({ role: "STAFF" });
    expect(log.after).toMatchObject({ role: "OWNER" });
    expect(log.actorId).toBe(owner.id);

    await expect(changeUserRole({ userId: id, role: "SUPER_ADMIN" }, owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("no permite dejar el sistema sin super admin activo", async () => {
    // Super admin "objetivo" (activo) y una super admin "actora" inactiva en DB (no cuenta como activa)
    const target = await prisma.user.create({
      data: { email: `${uid("sa")}@ivonne-rosa.test`, name: "SA Objetivo", role: "SUPER_ADMIN", active: true },
    });
    const actorRow = await prisma.user.create({
      data: { email: `${uid("sa")}@ivonne-rosa.test`, name: "SA Actora", role: "SUPER_ADMIN", active: false },
    });
    const actor: SessionUser = { id: actorRow.id, email: actorRow.email, name: actorRow.name, role: "SUPER_ADMIN" };

    // OWNER nunca puede tocar a un super admin
    await expect(setUserActive({ userId: target.id, active: false }, owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeUserRole({ userId: target.id, role: "OWNER" }, owner)).rejects.toMatchObject({ code: "FORBIDDEN" });

    try {
      const activeSuperAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", active: true } });
      if (activeSuperAdmins <= 1) {
        // El objetivo es la única super admin activa en la base de pruebas
        await expect(setUserActive({ userId: target.id, active: false }, actor)).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(changeUserRole({ userId: target.id, role: "OWNER" }, actor)).rejects.toMatchObject({ code: "CONFLICT" });
        expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).active).toBe(true);
      } else {
        // Hay otras super admins activas (de otras pruebas): la regla permite el cambio
        const res = await setUserActive({ userId: target.id, active: false }, actor);
        expect(res.active).toBe(false);
      }
    } finally {
      // No dejar super admins activas de prueba (para que la siguiente corrida pruebe el caso "último")
      await prisma.user.update({ where: { id: target.id }, data: { active: false } });
    }
    // Desactivarse a sí misma nunca está permitido
    await expect(setUserActive({ userId: owner.id, active: false }, owner)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("las cuentas de clientas no se administran desde Usuarios", async () => {
    const customerUser = await prisma.user.create({
      data: { email: `${uid("cu")}@example.test`, name: "Clienta Con Cuenta", role: "CUSTOMER" },
    });
    await expect(changeUserRole({ userId: customerUser.id, role: "OWNER" }, owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setUserActive({ userId: customerUser.id, active: false }, owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      resetUserPassword({ userId: customerUser.id, password: "Contrasena-Segura-9" }, owner),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(after).toMatchObject({ role: "CUSTOMER", active: true, passwordHash: null });
  });

  it("desactiva/reactiva y restablece contraseña con auditoría", async () => {
    const email = `${uid("p")}@ivonne-rosa.test`;
    const { id } = await createUser({ name: "Staff Temporal", email, role: "STAFF", password: "Contrasena-Inicial-1" }, owner);

    expect((await setUserActive({ userId: id, active: false }, owner)).active).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "user.deactivated", entityId: id } })).toBe(1);
    expect((await setUserActive({ userId: id, active: true }, owner)).active).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "user.activated", entityId: id } })).toBe(1);

    await expect(resetUserPassword({ userId: id, password: "corta" }, owner)).rejects.toBeTruthy();
    await resetUserPassword({ userId: id, password: "Contrasena-Nueva-22" }, owner);
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(await bcrypt.compare("Contrasena-Nueva-22", user.passwordHash!)).toBe(true);
    expect(await bcrypt.compare("Contrasena-Inicial-1", user.passwordHash!)).toBe(false);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.password_reset", entityId: id } });
    expect(JSON.stringify(log)).not.toContain("Contrasena-Nueva-22");
  });
});

// -----------------------------------------------------------------------------
// Revocación de sesiones (BUG-001 / BUG-004): User.sessionVersion
// -----------------------------------------------------------------------------

describe("revocación de sesiones (sessionVersion)", () => {
  const version = async (id: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id }, select: { sessionVersion: true } })).sessionVersion;

  it("restablecer contraseña, desactivar y cambiar el rol revocan (+1); reactivar y los intentos rechazados no", async () => {
    const { id } = await createUser(
      { name: "Sesiones QA", email: `${uid("sv")}@ivonne-rosa.test`, role: "STAFF", password: "Contrasena-Inicial-7" },
      owner,
    );
    expect(await version(id)).toBe(0);

    await resetUserPassword({ userId: id, password: "Contrasena-Nueva-77" }, owner);
    expect(await version(id)).toBe(1);

    await setUserActive({ userId: id, active: false }, owner);
    expect(await version(id)).toBe(2);
    await setUserActive({ userId: id, active: true }, owner);
    expect(await version(id)).toBe(2);

    await changeUserRole({ userId: id, role: "OWNER" }, owner);
    expect(await version(id)).toBe(3);

    // Rechazados: contraseña débil, rol que OWNER no puede asignar, actor sin permiso → nada cambia
    await expect(resetUserPassword({ userId: id, password: "corta" }, owner)).rejects.toBeTruthy();
    await expect(changeUserRole({ userId: id, role: "SUPER_ADMIN" }, owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const staffRow = await prisma.user.create({ data: { email: `${uid("st")}@ivonne-rosa.test`, name: "Staff sin permiso", role: "STAFF" } });
    const staffActor: SessionUser = { id: staffRow.id, email: staffRow.email, name: staffRow.name, role: "STAFF" };
    await expect(resetUserPassword({ userId: id, password: "Contrasena-Nueva-88" }, staffActor)).rejects.toBeTruthy();
    await expect(setUserActive({ userId: id, active: false }, staffActor)).rejects.toBeTruthy();
    await expect(changeUserRole({ userId: id, role: "STAFF" }, staffActor)).rejects.toBeTruthy();
    expect(await prisma.user.findUniqueOrThrow({ where: { id } })).toMatchObject({ sessionVersion: 3, active: true, role: "OWNER" });
  });

  it("restablecer la PROPIA contraseña también revoca la sesión con la que se hizo", async () => {
    const row = await prisma.user.create({ data: { email: `${uid("self")}@ivonne-rosa.test`, name: "Fundadora Self", role: "OWNER" } });
    const self: SessionUser = { id: row.id, email: row.email, name: row.name, role: "OWNER" };
    await resetUserPassword({ userId: self.id, password: "Contrasena-Propia-51" }, self);
    expect(await version(self.id)).toBe(1);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.password_reset", entityId: self.id } });
    expect(log.after).toMatchObject({ self: true });
    expect(log.actorId).toBe(self.id);
  });

  it("cerrar sesión compara e incrementa: sólo un token vigente revoca; uno viejo, ajeno o malformado no", async () => {
    const user = await prisma.user.create({ data: { email: `${uid("lo")}@ivonne-rosa.test`, name: "Logout QA", role: "STAFF" } });
    // Token anterior a la revocación (sin versión) cuenta como 0: vigente mientras la base siga en 0
    expect(await revokeSessionsOnSignOut({ uid: user.id })).toBe(true);
    expect(await version(user.id)).toBe(1);

    // La cookie vieja (versión 0) ya no puede cerrar las sesiones nuevas
    expect(await revokeSessionsOnSignOut({ uid: user.id, sessionVersion: 0 })).toBe(false);
    expect(await revokeSessionsOnSignOut({ uid: user.id })).toBe(false);
    // Valores inesperados fallan cerrado
    expect(await revokeSessionsOnSignOut({ uid: user.id, sessionVersion: "1" })).toBe(false);
    expect(await revokeSessionsOnSignOut({ uid: user.id, sessionVersion: -1 })).toBe(false);
    expect(await revokeSessionsOnSignOut({ uid: 42, sessionVersion: 1 })).toBe(false);
    expect(await revokeSessionsOnSignOut(null)).toBe(false);
    expect(await version(user.id)).toBe(1);

    // Dos cierres simultáneos con el mismo token vigente: sólo uno incrementa
    const results = await Promise.all([
      revokeSessionsOnSignOut({ uid: user.id, sessionVersion: 1 }),
      revokeSessionsOnSignOut({ uid: user.id, sessionVersion: 1 }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await version(user.id)).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// Configuración y feature flags
// -----------------------------------------------------------------------------

describe("configuración", () => {
  it("guardar precios queda auditado como settings.pricing_changed (con antes/después)", async () => {
    const start = new Date(Date.now() - 1000);
    const current = await getSettings("pricing");
    // Se guardan los MISMOS valores (vía conversión del formulario) para no alterar otras pruebas
    const saved = await patchSettings("pricing", formToPricing(pricingToForm(current), current), owner);
    expect(saved).toEqual(current);
    const { items } = await listAuditLogs({ action: "settings.pricing_changed", entityId: "pricing" }, 1, 50);
    const mine = items.find((i) => i.createdAt >= start && i.actor?.id === owner.id);
    expect(mine).toBeTruthy();
    expect(mine!.entityType).toBe("Setting");
    expect(mine!.after).toMatchObject({ taxRateBps: current.taxRateBps, depositBps: current.depositBps });
  });

  it("el override de flags en DB tiene prioridad en isEnabled y se puede restablecer", async () => {
    const flag = "MEMORY_CAPSULE_ENABLED" as const;
    const before = (await getFlagStates()).find((f) => f.flag === flag)!;
    try {
      const forced = !before.envDefault;
      const state = await setFlagOverride(flag, forced, owner);
      expect(state.effective).toBe(forced);
      expect(await isEnabled(flag)).toBe(forced);
      expect(await prisma.auditLog.count({ where: { action: "settings.flag_changed", entityId: `flags.${flag}`, actorId: owner.id } })).toBeGreaterThan(0);

      const reset = await resetFlagOverride(flag, owner);
      expect(reset.override).toBeUndefined();
      expect(await isEnabled(flag)).toBe(before.envDefault);
    } finally {
      // Restaurar exactamente el estado previo
      if (typeof before.override === "boolean") await setFlagOverride(flag, before.override, owner);
      else await resetFlagOverride(flag, owner);
    }
  });

  it("dos cambios simultáneos de funciones no se pisan (lock por sección)", async () => {
    const flags = ["AI_DESIGNER_ENABLED", "MEMORY_CAPSULE_ENABLED"] as const;
    const before = (await getFlagStates()).filter((f) => (flags as readonly string[]).includes(f.flag));
    try {
      // Se fija como override el MISMO valor efectivo: no cambia el comportamiento para otras pruebas
      await Promise.all(before.map((f) => setFlagOverride(f.flag, f.effective, owner)));
      const stored = await getFlagStates();
      for (const f of before) {
        expect(stored.find((s) => s.flag === f.flag)?.override).toBe(f.effective);
      }
    } finally {
      for (const f of before) {
        if (typeof f.override === "boolean") await setFlagOverride(f.flag, f.override, owner);
        else await resetFlagOverride(f.flag, owner);
      }
    }
  });

  it("email de prueba queda en la bandeja (mock)", async () => {
    const res = await sendTestEmail(owner);
    const log = await prisma.notificationLog.findUniqueOrThrow({ where: { id: res.id } });
    expect(log.type).toBe("GENERIC");
    expect(log.channel).toBe("EMAIL");
    expect(log.to).toBe(owner.email);
    expect(log.status).toBe("MOCKED");
  });
});

// -----------------------------------------------------------------------------
// Contenido
// -----------------------------------------------------------------------------

describe("contenido", () => {
  it("CRUD de testimonios auditado", async () => {
    const author = `Autora ${uid()}`;
    const { id } = await saveTestimonial(
      { authorName: author, occasion: "", body: "Una experiencia preciosa, todo cuidado al detalle.", rating: 5, active: true, sortOrder: 99 },
      owner,
    );
    const created = await prisma.testimonial.findUniqueOrThrow({ where: { id } });
    expect(created.occasion).toBeNull();
    await saveTestimonial(
      { id, authorName: author, occasion: "Cumpleaños", body: "Una experiencia preciosa, todo cuidado al detalle.", rating: 4, active: false, sortOrder: 99 },
      owner,
    );
    const updated = await prisma.testimonial.findUniqueOrThrow({ where: { id } });
    expect(updated).toMatchObject({ rating: 4, active: false, occasion: "Cumpleaños" });
    await deleteTestimonial(id, owner);
    expect(await prisma.testimonial.findUnique({ where: { id } })).toBeNull();
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id }, select: { action: true } })).map((a) => a.action);
    expect(actions.sort()).toEqual(["testimonial.created", "testimonial.deleted", "testimonial.updated"]);
  });

  it("galería: texto alternativo, destacada y eliminación auditada (media.deleted)", async () => {
    const asset = await prisma.mediaAsset.create({
      data: {
        driver: "EXTERNAL",
        url: "/images/placeholders/gallery-01.svg",
        mimeType: "image/svg+xml",
        visibility: "PUBLIC",
        purpose: "GALLERY",
        sortOrder: 999,
      },
    });
    await expect(updateGalleryAlt(asset.id, "  ", owner)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await updateGalleryAlt(asset.id, "Mesa con flores blancas", owner);
    await setGalleryFeatured(asset.id, true, owner);
    expect(await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).toMatchObject({
      alt: "Mesa con flores blancas",
      featured: true,
    });
    await deleteGalleryItem(asset.id, owner);
    expect(await prisma.mediaAsset.findUnique({ where: { id: asset.id } })).toBeNull();
    const del = await prisma.auditLog.findFirstOrThrow({ where: { action: "media.deleted", entityId: asset.id } });
    expect(del.before).toMatchObject({ alt: "Mesa con flores blancas", purpose: "GALLERY" });

    // No se pueden borrar assets que no son de galería por esta vía
    const other = await prisma.mediaAsset.create({
      data: { driver: "EXTERNAL", url: "/images/placeholders/hero.svg", mimeType: "image/svg+xml", purpose: "OTHER" },
    });
    await expect(deleteGalleryItem(other.id, owner)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await prisma.mediaAsset.delete({ where: { id: other.id } });
  });
});
