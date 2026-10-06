/**
 * Acciones PÚBLICAS por token (portal, RSVP, cápsula, cotización) con token/ID ajeno, de otro tipo o rotado:
 * deben responder NOT_FOUND (o equivalente) y no escribir nada. Cada caso lleva su control positivo.
 * Las acciones se envían a la página del PROPIO enlace del atacante (que sí la importa), como haría un navegador.
 */
import { expect, replayServerAction, test, uniq, wasAccepted, wasDenied } from "../fixtures";
import { actionResult, buildAction, createEventGraph, token } from "./_helpers";
import type { PrismaClient } from "@prisma/client";

const RSVP = {
  name: "Invitada Intrusa",
  email: "",
  rsvpStatus: "ATTENDING",
  plusOne: false,
  plusOneName: "",
  dietaryRestrictions: [],
  dietaryNotes: "",
  comment: "",
  honoreeMessage: "",
  photoConsent: false,
};

async function pair(db: PrismaClient) {
  const a = await createEventGraph(db, { guests: 1, capsule: { published: true }, daysAhead: 60 + Math.floor(Math.random() * 200) });
  const b = await createEventGraph(db, { guests: 1, capsule: { published: true }, daysAhead: 60 + Math.floor(Math.random() * 200) });
  return { a, b };
}

test.describe("Acciones públicas con token ajeno", { tag: ["@module:portal", "@permissions"] }, () => {
  test("[PERM-180] portal: quitar invitada de OTRO evento con mi token → NOT_FOUND y la invitada sigue", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const { a, b } = await pair(db);
    evidence("clienta", `removeHostGuestAction token A + guestId de B (${b.guests[0]!.id})`);
    const anon = await apiAs(null);
    const action = buildAction("removeHostGuestAction", `/mi-evento/${a.portalToken}`, { token: a.portalToken, guestId: b.guests[0]!.id });
    const res = await replayServerAction(anon, action);
    expect(wasDenied(res), `${res.outcome} ${res.text.slice(0, 160)}`).toBe(true);
    expect(actionResult(res.text)?.code).toBe("NOT_FOUND");
    expect(await db.eventGuest.findUnique({ where: { id: b.guests[0]!.id } })).not.toBeNull();
    // Control positivo: la propia invitada sí se quita
    const ok = await replayServerAction(anon, buildAction("removeHostGuestAction", `/mi-evento/${a.portalToken}`, { token: a.portalToken, guestId: a.guests[0]!.id }));
    expect(wasAccepted(ok), ok.text.slice(0, 160)).toBe(true);
    expect(await db.eventGuest.findUnique({ where: { id: a.guests[0]!.id } })).toBeNull();
  });

  test("[PERM-181] RSVP: slug de mi evento + token personal de invitada de OTRO evento → NOT_FOUND y su RSVP no cambia", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const { a, b } = await pair(db);
    evidence("invitada", `submitRsvpAction slug ${a.slug} + token de ${b.guests[0]!.name}`);
    const anon = await apiAs(null);
    const res = await replayServerAction(anon, buildAction("submitRsvpAction", `/e/${a.slug}/${a.inviteToken}`, { slug: a.slug, token: b.guests[0]!.token, rsvp: RSVP }));
    expect(actionResult(res.text)?.code, res.text.slice(0, 160)).toBe("NOT_FOUND");
    const g = await db.eventGuest.findUniqueOrThrow({ where: { id: b.guests[0]!.id } });
    expect({ status: g.rsvpStatus, name: g.name, respondedAt: g.respondedAt }).toEqual({ status: "PENDING", name: b.guests[0]!.name, respondedAt: null });
    expect(await db.eventGuest.count({ where: { eventId: a.eventId, name: RSVP.name } })).toBe(0);
    // Control positivo: con el slug correcto el RSVP personal se registra
    const ok = await replayServerAction(anon, buildAction("submitRsvpAction", `/e/${b.slug}/${b.guests[0]!.token}`, { slug: b.slug, token: b.guests[0]!.token, rsvp: { ...RSVP, name: b.guests[0]!.name } }));
    expect(wasAccepted(ok), ok.text.slice(0, 160)).toBe(true);
    expect((await db.eventGuest.findUniqueOrThrow({ where: { id: b.guests[0]!.id } })).rsvpStatus).toBe("ATTENDING");
  });

  test("[PERM-182] RSVP: slug de mi evento + invitación general de OTRO evento → NOT_FOUND sin crear invitada", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { a, b } = await pair(db);
    evidence("invitada", "slug A + inviteToken B");
    const before = await db.eventGuest.count({ where: { eventId: { in: [a.eventId, b.eventId] } } });
    const res = await replayServerAction(await apiAs(null), buildAction("submitRsvpAction", `/e/${a.slug}/${a.inviteToken}`, { slug: a.slug, token: b.inviteToken, rsvp: { ...RSVP, name: uniq("Nueva") } }));
    expect(actionResult(res.text)?.code, res.text.slice(0, 160)).toBe("NOT_FOUND");
    expect(await db.eventGuest.count({ where: { eventId: { in: [a.eventId, b.eventId] } } })).toBe(before);
  });

  test("[PERM-183] portal: mensaje con token ROTADO → NOT_FOUND; con el vigente sí se envía", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { a } = await pair(db);
    const fresh = token();
    await db.event.update({ where: { id: a.eventId }, data: { portalToken: fresh } });
    evidence("clienta", "sendHostMessageAction con el token anterior a la rotación");
    const anon = await apiAs(null);
    const res = await replayServerAction(anon, buildAction("sendHostMessageAction", `/mi-evento/${fresh}`, { token: a.portalToken, body: "Hola, ¿siguen en pie?" }));
    expect(actionResult(res.text)?.code, res.text.slice(0, 160)).toBe("NOT_FOUND");
    expect(await db.eventMessage.count({ where: { eventId: a.eventId, kind: "HOST_THREAD" } })).toBe(0);
    const ok = await replayServerAction(anon, buildAction("sendHostMessageAction", `/mi-evento/${fresh}`, { token: fresh, body: "Hola, ¿siguen en pie?" }));
    expect(wasAccepted(ok), ok.text.slice(0, 160)).toBe(true);
    expect(await db.eventMessage.count({ where: { eventId: a.eventId, kind: "HOST_THREAD" } })).toBe(1);
  });

  test("[PERM-184] portal: preferencias con token de INVITACIÓN o de invitada (otro tipo) → NOT_FOUND y el evento no cambia", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { a } = await pair(db);
    evidence("invitada", "updatePreferencesAction con inviteToken / token personal");
    const anon = await apiAs(null);
    const prefs = { colors: ["#000000"], honoreeName: "Cambiado", dressCode: "Negro", hostMessage: "Hackeado", customerNotes: "", playlistUrl: "" };
    for (const t of [a.inviteToken, a.guests[0]!.token, a.capsule!.shareToken]) {
      const res = await replayServerAction(anon, buildAction("updatePreferencesAction", `/mi-evento/${a.portalToken}`, { token: t, ...prefs }));
      expect(actionResult(res.text)?.code, res.text.slice(0, 160)).toBe("NOT_FOUND");
    }
    const ev = await db.event.findUniqueOrThrow({ where: { id: a.eventId } });
    expect({ honoreeName: ev.honoreeName, hostMessage: ev.hostMessage }).toEqual({ honoreeName: "Homenajeada E2E", hostMessage: null });
  });

  test("[PERM-185] portal: agregar invitada con token de otro tipo → NOT_FOUND sin crear registros", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    const { a } = await pair(db);
    evidence("invitada", "addHostGuestAction con token personal de invitada");
    const before = await db.eventGuest.count({ where: { eventId: a.eventId } });
    const res = await replayServerAction(await apiAs(null), buildAction("addHostGuestAction", `/mi-evento/${a.portalToken}`, { token: a.guests[0]!.token, name: "Colada E2E", contact: "" }));
    expect(actionResult(res.text)?.code, res.text.slice(0, 160)).toBe("NOT_FOUND");
    expect(await db.eventGuest.count({ where: { eventId: a.eventId } })).toBe(before);
  });

  test("[PERM-186] cápsula: libro de visitas con token de cápsula NO publicada o inexistente → NOT_FOUND; publicada → se crea", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { a, b } = await pair(db);
    await db.memoryCapsule.update({ where: { id: b.capsule!.id }, data: { published: false } });
    evidence("invitada", "submitGuestbookMessageAction");
    const anon = await apiAs(null);
    const page = `/memory/${a.capsule!.shareToken}`;
    for (const t of [b.capsule!.shareToken, token(24)]) {
      const res = await replayServerAction(anon, buildAction("submitGuestbookMessageAction", page, { token: t, name: "Intrusa", body: "Mensaje no autorizado" }));
      expect(actionResult(res.text)?.code, res.text.slice(0, 160)).toBe("NOT_FOUND");
    }
    expect(await db.eventMessage.count({ where: { body: "Mensaje no autorizado" } })).toBe(0);
    const ok = await replayServerAction(anon, buildAction("submitGuestbookMessageAction", page, { token: a.capsule!.shareToken, name: "Amiga", body: "¡Felicidades!" }));
    expect(wasAccepted(ok), ok.text.slice(0, 160)).toBe(true);
    expect(await db.eventMessage.count({ where: { eventId: a.eventId, kind: "GUESTBOOK", body: "¡Felicidades!" } })).toBe(1);
  });

  test("[PERM-187] cotización: aceptar/rechazar con token inexistente o de otro tipo → NOT_FOUND y sin reserva", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const { a } = await pair(db);
    evidence("clienta", "acceptQuoteAction / rejectQuoteAction con portalToken y token aleatorio");
    const anon = await apiAs(null);
    const quoteToken = (await db.quote.findFirstOrThrow({ where: { title: "Cumpleaños de Lucía" } })).publicToken;
    const page = `/cotizacion/${quoteToken}`;
    const bookingsBefore = await db.booking.count();
    for (const t of [a.portalToken, token()]) {
      const acc = await replayServerAction(anon, buildAction("acceptQuoteAction", page, { token: t, fullName: "Clienta Intrusa", acceptTerms: true }));
      expect(actionResult(acc.text)?.code, acc.text.slice(0, 160)).toBe("NOT_FOUND");
      const rej = await replayServerAction(anon, buildAction("rejectQuoteAction", page, { token: t, reason: "x" }));
      expect(actionResult(rej.text)?.code, rej.text.slice(0, 160)).toBe("NOT_FOUND");
    }
    expect(await db.booking.count()).toBe(bookingsBefore);
    expect((await db.quote.findFirstOrThrow({ where: { title: "Cumpleaños de Lucía" } })).status).toBe("SENT");
  });

  test("[PERM-188] subida de foto a cápsula NO publicada o con token rotado → rechazada sin MediaAsset", { tag: ["@P1"] }, async ({ playwright, baseURL, db, evidence }) => {
    const { a, b } = await pair(db);
    await db.memoryCapsule.update({ where: { id: b.capsule!.id }, data: { published: false } });
    evidence("invitada", "/api/memory/[token]/upload");
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL!, "Sec-Fetch-Site": "same-origin" } });
    const png = Buffer.from("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FEA7D6A0A00000000049454E44AE426082", "hex");
    const before = await db.mediaAsset.count({ where: { memoryCapsuleId: { in: [a.capsule!.id, b.capsule!.id] } } });
    const unpublished = await api.post(`/api/memory/${b.capsule!.shareToken}/upload`, {
      multipart: { file: { name: "foto.png", mimeType: "image/png", buffer: png }, name: "Intrusa", consent: "true" },
      failOnStatusCode: false,
    });
    expect([403, 404], `no publicada → ${unpublished.status()}`).toContain(unpublished.status());
    const unknown = await api.post(`/api/memory/${token(24)}/upload`, {
      multipart: { file: { name: "foto.png", mimeType: "image/png", buffer: png }, name: "Intrusa", consent: "true" },
      failOnStatusCode: false,
    });
    expect(unknown.status()).toBe(404);
    expect(await db.mediaAsset.count({ where: { memoryCapsuleId: { in: [a.capsule!.id, b.capsule!.id] } } })).toBe(before);
    await api.dispose();
  });
});
