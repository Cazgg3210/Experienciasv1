/**
 * Acciones PROTEGIDAS que el build deja ejecutables desde páginas PÚBLICAS.
 * /memory/[token] (pública, anónima) importa features/memory-capsule/server/actions.ts completo: además de la acción
 * pública del libro de visitas, quedan alcanzables las de administración (rotar token, publicar, moderar, borrar fotos…).
 * El único freno es el RBAC de cada acción: anónimo → UNAUTHORIZED, staff → FORBIDDEN, y la base no cambia.
 */
import { expect, replayServerAction, test, wasAccepted, wasDenied } from "../fixtures";
import { actionResult, actionWorkers, buildAction, createEventGraph } from "./_helpers";
import type { PrismaClient } from "@prisma/client";

const FILE = /features\/memory-capsule\/server\/actions/;

async function capsuleFixture(db: PrismaClient) {
  const ev = await createEventGraph(db, { status: "COMPLETED", daysAhead: -10, capsule: { published: true } });
  const capsule = ev.capsule!;
  const media = await db.mediaAsset.create({
    data: {
      driver: "EXTERNAL",
      url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d",
      mimeType: "image/jpeg",
      visibility: "PUBLIC",
      purpose: "MEMORY",
      memoryCapsuleId: capsule.id,
      eventId: ev.eventId,
      approved: true,
      consent: true,
      uploaderName: "Invitada E2E",
    },
  });
  const message = await db.eventMessage.create({
    data: { eventId: ev.eventId, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Invitada E2E", body: "¡Qué bonito día!" },
  });
  const other = await createEventGraph(db, { status: "COMPLETED", daysAhead: -11 }); // sin cápsula
  return { ev, capsule, media, message, other };
}

type Fx = Awaited<ReturnType<typeof capsuleFixture>>;
const ACTIONS: Array<{ id: string; name: string; input: (f: Fx) => unknown }> = [
  { id: "PERM-131", name: "rotateShareTokenAction", input: (f) => ({ capsuleId: f.capsule.id }) },
  { id: "PERM-132", name: "updateCapsuleAction", input: (f) => ({ capsuleId: f.capsule.id, title: "Cápsula secuestrada", message: "", published: false, allowGuestUploads: false }) },
  { id: "PERM-133", name: "setCoverAction", input: (f) => ({ capsuleId: f.capsule.id, mediaId: f.media.id }) },
  { id: "PERM-134", name: "setMediaApprovalAction", input: (f) => ({ capsuleId: f.capsule.id, mediaId: f.media.id, approved: false }) },
  { id: "PERM-135", name: "deleteCapsuleMediaAction", input: (f) => ({ capsuleId: f.capsule.id, mediaId: f.media.id }) },
  { id: "PERM-136", name: "setMessageHiddenAction", input: (f) => ({ eventId: f.ev.eventId, messageId: f.message.id, hidden: true }) },
  { id: "PERM-137", name: "createCapsuleAction", input: (f) => ({ eventId: f.other.eventId, title: "Cápsula intrusa" }) },
];

async function snapshot(db: PrismaClient, f: Fx) {
  return {
    capsule: await db.memoryCapsule.findUniqueOrThrow({ where: { id: f.capsule.id }, select: { title: true, shareToken: true, published: true, allowGuestUploads: true, coverMediaId: true } }),
    media: await db.mediaAsset.findUnique({ where: { id: f.media.id }, select: { approved: true } }),
    message: await db.eventMessage.findUniqueOrThrow({ where: { id: f.message.id }, select: { hidden: true } }),
    otherCapsule: await db.memoryCapsule.count({ where: { eventId: f.other.eventId } }),
  };
}

test.describe("Acciones de administración alcanzables desde /memory/[token]", { tag: ["@module:memory", "@permissions"] }, () => {
  test("[PERM-130] superficie: la página pública /memory/[token] importa las 7 acciones de administración de la cápsula", { tag: ["@P2"] }, async ({ evidence }) => {
    evidence("anonimo", "server-reference-manifest.json");
    for (const a of ACTIONS) expect(actionWorkers(a.name, FILE), a.name).toContain("app/(experience)/memory/[token]/page");
  });

  for (const a of ACTIONS) {
    test(`[${a.id}] anónimo y staff ejecutando ${a.name} desde /memory/[token] → rechazado y sin cambios`, { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
      const f = await capsuleFixture(db);
      evidence("anonimo", `${a.name} vía /memory/${f.capsule.shareToken} (también staff)`);
      const before = await snapshot(db, f);
      const action = buildAction(a.name, `/memory/${f.capsule.shareToken}`, a.input(f), { file: FILE });
      const anon = await replayServerAction(await apiAs(null), action);
      expect(wasDenied(anon), `anónimo: ${anon.outcome} ${anon.status} ${anon.text.slice(0, 200)}`).toBe(true);
      expect(actionResult(anon.text)?.code).toBe("UNAUTHORIZED");
      const staff = await replayServerAction(await apiAs("staff"), action);
      expect(wasDenied(staff), `staff: ${staff.outcome} ${staff.status} ${staff.text.slice(0, 200)}`).toBe(true);
      expect(actionResult(staff.text)?.code).toBe("FORBIDDEN");
      expect(await snapshot(db, f), "la base no cambió").toEqual(before);
      // El enlace público sigue funcionando con el mismo token
      const page = await (await apiAs(null)).get(`/memory/${f.capsule.shareToken}`);
      expect(page.status()).toBe(200);
    });
  }

  test("[PERM-138] control positivo: OWNER sí ejecuta updateCapsuleAction desde la misma página pública", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    const f = await capsuleFixture(db);
    evidence("owner", `updateCapsuleAction vía /memory/${f.capsule.shareToken}`);
    const action = buildAction(
      "updateCapsuleAction",
      `/memory/${f.capsule.shareToken}`,
      { capsuleId: f.capsule.id, title: "Recuerdos editados por owner", message: "", published: true, allowGuestUploads: true },
      { file: FILE },
    );
    const ok = await replayServerAction(await apiAs("owner"), action);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    expect((await db.memoryCapsule.findUniqueOrThrow({ where: { id: f.capsule.id } })).title).toBe("Recuerdos editados por owner");
  });
});
