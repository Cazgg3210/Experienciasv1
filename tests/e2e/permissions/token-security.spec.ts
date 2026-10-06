/**
 * Seguridad de enlaces por token (clienta / invitada / cápsula / pago): inexistente, malformado, de otro evento,
 * de otro tipo y rotado ⇒ 404 genérico sin datos; cabeceras noindex + Referrer-Policy same-origin.
 * Fuente: src/features/portal/server/portal-service.ts (resolveInvite/resolvePortalEvent), src/lib/tokens.ts (isPlausibleToken),
 * src/middleware.ts (cabeceras), páginas de src/app/(experience).
 */
import { TOKENS, expect, replayServerAction, test, wasAccepted } from "../fixtures";
import { buildAction, createEventGraph, paymentResultPath, seedIds, token, type EventGraph } from "./_helpers";
import type { APIRequestContext } from "@playwright/test";

const GENERIC_404: Array<[RegExp, string]> = [
  [/^\/cotizacion\//, "No encontramos esta propuesta"],
  [/^\/mi-evento\//, "Este enlace no es válido"],
  [/^\/e\//, "Esta invitación no está disponible"],
  [/^\/memory\//, "No encontramos esta cápsula"],
  [/^\/pago\//, "No encontramos este pago"],
];

function headingFor(path: string): string {
  return GENERIC_404.find(([re]) => re.test(path))![1];
}

/** 404 real, encabezado genérico, cabeceras de privacidad y sin ningún dato sensible del evento indicado. */
async function expectGeneric404(api: APIRequestContext, path: string, secrets: string[] = []) {
  const res = await api.get(path, { maxRedirects: 0, failOnStatusCode: false });
  const html = await res.text();
  expect(res.status(), `${path} → status`).toBe(404);
  expect(html, `${path} → encabezado genérico`).toContain(headingFor(path));
  expect(res.headers()["x-robots-tag"] ?? "", `${path} → noindex`).toContain("noindex");
  for (const s of secrets) expect(html, `${path} filtra "${s}"`).not.toContain(s);
}

async function graphWithEverything(db: import("@prisma/client").PrismaClient): Promise<EventGraph> {
  return createEventGraph(db, { withBooking: true, guests: 2, capsule: { published: true }, daysAhead: 30 + Math.floor(Math.random() * 300) });
}

test.describe("Enlaces por token", { tag: ["@module:portal", "@permissions"] }, () => {
  test("[PERM-160] token inexistente (formato válido) en cada ruta por token → 404 genérico", { tag: ["@P0"] }, async ({ apiAs, evidence }) => {
    evidence("anonimo", "token de 256 bits que no existe");
    const anon = await apiAs(null);
    const t = token();
    for (const path of [`/cotizacion/${t}`, `/mi-evento/${t}`, `/mi-evento/${t}/resumen`, `/e/${TOKENS.micrositeSofia}/${t}`, `/memory/${t}`, `/pago/mock/mock_cs_${t.slice(0, 30)}`]) {
      await expectGeneric404(anon, path);
    }
    expect((await anon.get(`/e/${TOKENS.micrositeSofia}/${t}/calendar.ics`)).status()).toBe(404);
  });

  test("[PERM-161] token malformado (corto, traversal, inyección, unicode) → 404 sin error 500", { tag: ["@P1", "@negative"] }, async ({ apiAs, evidence }) => {
    evidence("anonimo", "tokens con formato inválido");
    const anon = await apiAs(null);
    const bad = ["abc", "..%2F..%2Fadmin", "%27%20OR%201%3D1--", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", "a".repeat(300), "t%C3%B3ken-con-acento-aaaaaaaaaaaaaaaaaaaa"];
    for (const b of bad) {
      for (const path of [`/cotizacion/${b}`, `/mi-evento/${b}`, `/e/${TOKENS.micrositeSofia}/${b}`, `/memory/${b}`]) {
        const res = await anon.get(path, { failOnStatusCode: false });
        expect(res.status(), path).toBe(404);
        expect(await res.text(), path).toContain(headingFor(path));
      }
    }
  });

  test("[PERM-162] micrositio: slug de un evento + token de invitación de OTRO evento → 404 sin datos de ninguno", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    const b = await graphWithEverything(db);
    evidence("invitada", `/e/${a.slug}/<inviteToken de B>`);
    const anon = await apiAs(null);
    expect((await anon.get(`/e/${a.slug}/${a.inviteToken}`)).status(), "control: invitación propia").toBe(200);
    await expectGeneric404(anon, `/e/${a.slug}/${b.inviteToken}`, [a.title, b.title, "Calle Privada E2E 123", "Homenajeada E2E"]);
    await expectGeneric404(anon, `/e/${b.slug}/${a.inviteToken}`, [a.title, b.title]);
  });

  test("[PERM-163] micrositio: slug de un evento + token PERSONAL de invitada de otro evento → 404", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    const b = await graphWithEverything(db);
    evidence("invitada", `/e/${a.slug}/<token de ${b.guests[0]!.name}>`);
    const anon = await apiAs(null);
    const own = await anon.get(`/e/${b.slug}/${b.guests[0]!.token}`);
    expect(own.status(), "control: token personal en su evento").toBe(200);
    expect(await own.text()).toContain(b.guests[0]!.name.split(" ")[0]);
    await expectGeneric404(anon, `/e/${a.slug}/${b.guests[0]!.token}`, [a.title, b.title, b.guests[0]!.name]);
    expect((await anon.get(`/e/${a.slug}/${b.guests[0]!.token}/calendar.ics`)).status()).toBe(404);
  });

  test("[PERM-164] tokens de otro TIPO no abren otras zonas (portal↔invitación↔cotización↔cápsula)", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    const quoteToken = (await db.quote.findUniqueOrThrow({ where: { id: a.quoteId! } })).publicToken;
    evidence("clienta", "cada token del evento probado en las demás rutas");
    const anon = await apiAs(null);
    const secrets = [a.title, "Calle Privada E2E 123"];
    await expectGeneric404(anon, `/mi-evento/${a.inviteToken}`, secrets);
    await expectGeneric404(anon, `/mi-evento/${a.guests[0]!.token}`, secrets);
    await expectGeneric404(anon, `/mi-evento/${quoteToken}`, secrets);
    await expectGeneric404(anon, `/mi-evento/${a.capsule!.shareToken}`, secrets);
    await expectGeneric404(anon, `/cotizacion/${a.portalToken}`, secrets);
    await expectGeneric404(anon, `/cotizacion/${a.inviteToken}`, secrets);
    await expectGeneric404(anon, `/memory/${a.portalToken}`, secrets);
    await expectGeneric404(anon, `/e/${a.slug}/${a.portalToken}`, secrets);
    await expectGeneric404(anon, `/e/${a.slug}/${quoteToken}`, secrets);
    // Controles: cada token en su ruta sí funciona
    for (const ok of [`/mi-evento/${a.portalToken}`, `/cotizacion/${quoteToken}`, `/memory/${a.capsule!.shareToken}`, `/e/${a.slug}/${a.inviteToken}`]) {
      expect((await anon.get(ok)).status(), ok).toBe(200);
    }
  });

  test("[PERM-165] tokens rotados desde el admin (portal e invitación): el anterior → 404, el nuevo funciona", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    evidence("owner", `rotateEventTokenAction portal + invite en ${a.eventId}`);
    const owner = await apiAs("owner");
    for (const kind of ["portal", "invite"] as const) {
      const r = await replayServerAction(owner, buildAction("rotateEventTokenAction", `/admin/events/${a.eventId}`, { eventId: a.eventId, kind }));
      expect(wasAccepted(r), `${kind}: ${r.text.slice(0, 160)}`).toBe(true);
    }
    const fresh = await db.event.findUniqueOrThrow({ where: { id: a.eventId } });
    expect(fresh.portalToken).not.toBe(a.portalToken);
    expect(fresh.inviteToken).not.toBe(a.inviteToken);
    const anon = await apiAs(null);
    await expectGeneric404(anon, `/mi-evento/${a.portalToken}`, [a.title]);
    await expectGeneric404(anon, `/mi-evento/${a.portalToken}/resumen`, [a.title]);
    await expectGeneric404(anon, `/e/${a.slug}/${a.inviteToken}`, [a.title]);
    expect((await anon.get(`/mi-evento/${fresh.portalToken}`)).status()).toBe(200);
    expect((await anon.get(`/e/${a.slug}/${fresh.inviteToken}`)).status()).toBe(200);
    // Los tokens personales de invitadas no se rotan con la invitación general
    expect((await anon.get(`/e/${a.slug}/${a.guests[0]!.token}`)).status()).toBe(200);
    expect(await db.auditLog.count({ where: { entityId: a.eventId, action: { contains: "token" } } })).toBeGreaterThanOrEqual(2);
  });

  test("[PERM-166] cápsula: token rotado → 404; cápsula NO publicada no muestra fotos ni mensajes", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    await db.eventMessage.create({ data: { eventId: a.eventId, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Tía Secreta", body: "Mensaje privado de la cápsula" } });
    evidence("owner", "rotateShareTokenAction + despublicar");
    const owner = await apiAs("owner");
    const anon = await apiAs(null);
    expect(await (await anon.get(`/memory/${a.capsule!.shareToken}`)).text()).toContain("Mensaje privado de la cápsula");
    const r = await replayServerAction(owner, buildAction("rotateShareTokenAction", `/admin/events/${a.eventId}/memory`, { capsuleId: a.capsule!.id }));
    expect(wasAccepted(r), r.text.slice(0, 160)).toBe(true);
    const fresh = await db.memoryCapsule.findUniqueOrThrow({ where: { id: a.capsule!.id } });
    await expectGeneric404(anon, `/memory/${a.capsule!.shareToken}`, ["Mensaje privado de la cápsula", "Tía Secreta"]);
    expect((await anon.get(`/memory/${fresh.shareToken}`)).status()).toBe(200);

    await db.memoryCapsule.update({ where: { id: a.capsule!.id }, data: { published: false } });
    const draft = await anon.get(`/memory/${fresh.shareToken}`);
    const html = await draft.text();
    expect(draft.status()).toBe(200);
    expect(html).not.toContain("Mensaje privado de la cápsula");
    expect(html).not.toContain("Tía Secreta");
  });

  test("[PERM-167] micrositio deshabilitado → 404 aunque el token sea correcto", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    await db.event.update({ where: { id: a.eventId }, data: { micrositeEnabled: false } });
    evidence("invitada", `micrositeEnabled=false en ${a.eventId}`);
    const anon = await apiAs(null);
    await expectGeneric404(anon, `/e/${a.slug}/${a.inviteToken}`, [a.title]);
    await expectGeneric404(anon, `/e/${a.slug}/${a.guests[0]!.token}`, [a.title]);
  });

  test("[PERM-168] /pago/resultado: firma inválida, ausente o de otro pago → 404; firma válida → 200", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const ids = await seedIds(db);
    const other = await db.payment.findFirstOrThrow({ where: { id: { not: ids.paymentIdPending }, kind: { not: "REFUND" } } });
    evidence("clienta", `p=${ids.paymentIdPending}`);
    const anon = await apiAs(null);
    const valid = paymentResultPath(ids.paymentIdPending);
    const sig = new URL(valid, "http://x").searchParams.get("s")!;
    expect((await anon.get(valid)).status(), "control: firma válida").toBe(200);
    await expectGeneric404(anon, `/pago/resultado?p=${ids.paymentIdPending}`);
    await expectGeneric404(anon, `/pago/resultado?p=${ids.paymentIdPending}&s=${sig.slice(0, -2)}xx`);
    await expectGeneric404(anon, `/pago/resultado?p=${other.id}&s=${sig}`);
    await expectGeneric404(anon, `/pago/resultado?p=${ids.paymentIdPending}&s=${"A".repeat(32)}`);
  });

  test("[PERM-169] /pago/mock: checkout inexistente o malformado → 404; existente → 200", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    const ids = await seedIds(db);
    evidence("clienta", ids.mockCheckoutId);
    const anon = await apiAs(null);
    expect((await anon.get(`/pago/mock/${ids.mockCheckoutId}`)).status()).toBe(200);
    await expectGeneric404(anon, `/pago/mock/${ids.mockCheckoutId}x`);
    await expectGeneric404(anon, `/pago/mock/mock_cs_${token(12)}`);
    expect((await anon.get(`/pago/mock/otra-cosa`, { failOnStatusCode: false })).status()).toBe(404);
  });

  test("[PERM-170] rutas por token: X-Robots-Tag noindex + Referrer-Policy same-origin (válidas e inválidas)", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    const ids = await seedIds(db);
    evidence("anonimo", "cabeceras de privacidad");
    const anon = await apiAs(null);
    const paths = [
      `/cotizacion/${TOKENS.quoteLucia}`,
      `/mi-evento/${a.portalToken}`,
      `/mi-evento/${a.portalToken}/resumen`,
      `/mi-evento`,
      `/e/${a.slug}/${a.inviteToken}`,
      `/memory/${a.capsule!.shareToken}`,
      `/pago/mock/${ids.mockCheckoutId}`,
      paymentResultPath(ids.paymentIdPending),
      `/mi-evento/${token()}`,
    ];
    for (const p of paths) {
      const res = await anon.get(p, { failOnStatusCode: false });
      expect(res.headers()["x-robots-tag"] ?? "", `${p} noindex`).toContain("noindex");
      expect(res.headers()["referrer-policy"], `${p} referrer-policy`).toBe("same-origin");
    }
    // Páginas públicas de marketing NO llevan same-origin ni noindex por cabecera
    const home = await anon.get("/");
    expect(home.headers()["x-robots-tag"]).toBeUndefined();
    expect(home.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("[PERM-171] calendar.ics: válido es text/calendar con el evento; token ajeno/rotado → 404", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const a = await graphWithEverything(db);
    const b = await graphWithEverything(db);
    evidence("invitada", `/e/${a.slug}/<token>/calendar.ics`);
    const anon = await apiAs(null);
    const res = await anon.get(`/e/${a.slug}/${a.inviteToken}/calendar.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="[a-z0-9.-]+\.ics"/i);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const ics = await res.text();
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r?\n/);
    expect(ics).toMatch(/BEGIN:VEVENT[\s\S]*DTSTART[\s\S]*DTEND[\s\S]*END:VEVENT/);
    expect(ics).toMatch(/END:VCALENDAR\s*$/);
    expect(ics).not.toContain(b.title);
    expect((await anon.get(`/e/${a.slug}/${b.inviteToken}/calendar.ics`)).status()).toBe(404);
    expect((await anon.get(`/e/${a.slug}/${token()}/calendar.ics`)).status()).toBe(404);
    expect((await anon.get(`/e/${a.slug}/corto/calendar.ics`)).status()).toBe(404);
  });
});
