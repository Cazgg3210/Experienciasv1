/**
 * Rate limit del RSVP público (suite E2E_SUITE=ratelimit, limitador encendido).
 *  - submitRsvpAction: 10 respuestas / 10 min por IP (src/features/guests/server/actions.ts).
 * Desde BUG-003 cada respuesta con el link general crea una invitada nueva (nunca toma a otra): este límite
 * y el cupo de 60 invitadas ([GST-021]) son los que frenan que alguien llene la lista desde el link general.
 * La cubeta (RateLimitBucket "action:guests.submit_rsvp:<ip>") se vacía al inicio de la prueba: no se asume que
 * la invocación la dejó vacía (un reintento o --repeat-each la encontraría ya agotada).
 */
import { expect, test, uniq } from "../fixtures";
import { callAction, createEventFixture, describe as d } from "../events/_helpers";

const RSVP_ACTION = "submitRsvpAction";
/** Clave de la cubeta: `action:<name de publicAction>:<ip>` (src/server/action.ts). */
const RSVP_BUCKET_PREFIX = "action:guests.submit_rsvp:";

function rsvpInput(slug: string, token: string, name: string) {
  return {
    slug,
    token,
    rsvp: {
      name,
      email: "",
      rsvpStatus: "ATTENDING",
      plusOne: false,
      plusOneName: "",
      dietaryRestrictions: [],
      dietaryNotes: "",
      comment: "",
      honoreeMessage: "",
      photoConsent: false,
    },
  };
}

test.describe("RSVP público — rate limit", { tag: ["@module:guests"] }, () => {
  test("[GST-024] link general: 10 respuestas por IP en 10 min; la 11ª responde RATE_LIMITED y no crea invitada", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("invitada", "submitRsvpAction con el link general × 11 desde la misma IP");
    // Precondición explícita: cubeta de esta acción vacía (la suite ratelimit corre con 1 worker; ninguna otra
    // prueba usa esta acción a la vez).
    await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: RSVP_BUCKET_PREFIX } } });
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const api = await apiAs(null);
    const codes: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const r = await callAction(api, RSVP_ACTION, rsvpInput(ev.micrositeSlug, ev.inviteToken, uniq(`Invitada RL ${i}`)), { path: ev.invitePath });
      codes.push(r.ok ? "OK" : (r.code ?? d(r)));
    }
    expect(codes.slice(0, 10)).toEqual(Array(10).fill("OK"));
    expect(codes[10]).toBe("RATE_LIMITED");
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(10);
    // La cubeta que se vació es la que contó estas 11 llamadas (una sola IP).
    const buckets = await db.rateLimitBucket.findMany({ where: { key: { startsWith: RSVP_BUCKET_PREFIX } } });
    expect(buckets.map((b) => b.count)).toEqual([11]);
  });
});
