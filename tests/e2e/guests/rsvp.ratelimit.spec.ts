/**
 * Rate limit del RSVP público (suite E2E_SUITE=ratelimit, limitador encendido).
 *  - submitRsvpAction: 10 respuestas / 10 min por IP (src/features/guests/server/actions.ts).
 * Desde BUG-003 cada respuesta con el link general crea una invitada nueva (nunca toma a otra): este límite
 * y el cupo de 60 invitadas ([GST-021]) son los que frenan que alguien llene la lista desde el link general.
 * La base del carril se re-siembra (TRUNCATE) por invocación: la cubeta de esta acción empieza vacía.
 */
import { expect, test, uniq } from "../fixtures";
import { callAction, createEventFixture, describe as d } from "../events/_helpers";

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
    const ev = await createEventFixture(db, { status: "CONFIRMED" });
    const api = await apiAs(null);
    const codes: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const r = await callAction(api, "submitRsvpAction", rsvpInput(ev.micrositeSlug, ev.inviteToken, uniq(`Invitada RL ${i}`)), { path: ev.invitePath });
      codes.push(r.ok ? "OK" : (r.code ?? d(r)));
    }
    expect(codes.slice(0, 10)).toEqual(Array(10).fill("OK"));
    expect(codes[10]).toBe("RATE_LIMITED");
    expect(await db.eventGuest.count({ where: { eventId: ev.id } })).toBe(10);
  });
});
