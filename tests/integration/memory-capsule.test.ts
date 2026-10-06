import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/db";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateToken } from "@/lib/tokens";
import type { SessionUser } from "@/server/auth/session";
import {
  createCapsule,
  deleteCapsuleMedia,
  rotateShareToken,
  setCover,
  setMediaApproval,
  setMessageHidden,
  updateCapsule,
} from "@/features/memory-capsule/server/capsule-service";
import {
  createGuestbookMessage,
  getPublicCapsule,
  uploadGuestPhoto,
} from "@/features/memory-capsule/server/public-service";
import { getAdminMemoryPage } from "@/features/memory-capsule/server/queries";
import { deleteMedia } from "@/features/media/server/upload-service";
import { env } from "@/lib/env";
import { POST as guestUploadPOST } from "@/app/api/memory/[token]/upload/route";
import { testOwner, testStaff, uid } from "./helpers";

// Bytes mínimos con "magic numbers" reales (la validación sólo confía en ellos).
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");

const png = (name = "foto.png") => new File([PNG], name, { type: "image/png" });
const jpeg = (name = "foto.jpg") => new File([JPEG], name, { type: "image/jpeg" });

let owner: SessionUser;
const createdEventIds: string[] = [];
const createdCustomerIds: string[] = [];

async function makeEvent(title = "Brunch de prueba") {
  const s = uid();
  const customer = await prisma.customer.create({
    data: { name: `Clienta ${s}`, phone: "5512345678", referralCode: `REF${s}`.toUpperCase() },
  });
  createdCustomerIds.push(customer.id);
  const start = new Date("2026-09-12T17:00:00.000Z");
  const event = await prisma.event.create({
    data: {
      code: `EV-${s}`.toUpperCase(),
      title: `${title} ${s}`,
      status: "COMPLETED",
      customerId: customer.id,
      honoreeName: "Vale",
      eventDate: new Date("2026-09-12T00:00:00.000Z"),
      startsAt: start,
      endsAt: new Date(start.getTime() + 3 * 3600_000),
      guestCount: 8,
      micrositeSlug: `mc-${s}`,
      inviteToken: generateToken(),
      portalToken: generateToken(),
    },
  });
  createdEventIds.push(event.id);
  return event;
}

async function makeCapsule(opts: { published?: boolean; allowGuestUploads?: boolean } = {}) {
  const event = await makeEvent();
  const capsule = await createCapsule(owner, { eventId: event.id, title: `Memorias de ${event.title}`, message: "Hola" });
  if (opts.published !== undefined || opts.allowGuestUploads !== undefined) {
    return {
      event,
      capsule: await updateCapsule(owner, {
        capsuleId: capsule.id,
        title: capsule.title,
        message: capsule.message,
        published: opts.published ?? capsule.published,
        allowGuestUploads: opts.allowGuestUploads ?? capsule.allowGuestUploads,
      }),
    };
  }
  return { event, capsule };
}

async function addMedia(
  capsule: { id: string; eventId: string },
  data: { approved: boolean; kind?: "IMAGE" | "DOCUMENT"; sortOrder?: number; uploaderName?: string },
) {
  return prisma.mediaAsset.create({
    data: {
      driver: "EXTERNAL",
      url: "/images/placeholders/gallery-01.svg",
      mimeType: data.kind === "DOCUMENT" ? "application/pdf" : "image/svg+xml",
      kind: data.kind ?? "IMAGE",
      visibility: "PRIVATE",
      purpose: "MEMORY",
      eventId: capsule.eventId,
      memoryCapsuleId: capsule.id,
      approved: data.approved,
      consent: true,
      sortOrder: data.sortOrder ?? 0,
      uploaderName: data.uploaderName ?? "Equipo",
    },
  });
}

beforeAll(async () => {
  owner = await testOwner();
});

afterAll(async () => {
  // Limpia sólo los fixtures de esta suite (incluye archivos locales de subidas).
  const media = await prisma.mediaAsset.findMany({
    where: { OR: [{ eventId: { in: createdEventIds } }, { memoryCapsule: { eventId: { in: createdEventIds } } }] },
    select: { id: true },
  });
  for (const m of media) await deleteMedia(m.id);
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
});

describe("Memory Capsule — administración", () => {
  it("crea la cápsula en preparación con token público y la audita", async () => {
    const event = await makeEvent();
    const capsule = await createCapsule(owner, { eventId: event.id, title: "Memorias de prueba", message: "  " });
    expect(capsule.eventId).toBe(event.id);
    expect(capsule.published).toBe(false);
    expect(capsule.allowGuestUploads).toBe(true);
    expect(capsule.message).toBeNull();
    expect(capsule.shareToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const log = await prisma.auditLog.findFirst({ where: { action: "memory.created", entityId: capsule.id } });
    expect(log?.actorId).toBe(owner.id);

    await expect(createCapsule(owner, { eventId: event.id, title: "Otra" })).rejects.toBeInstanceOf(ConflictError);
    await expect(createCapsule(owner, { eventId: "no-existe-123", title: "Otra" })).rejects.toBeInstanceOf(NotFoundError);

    const page = await getAdminMemoryPage(event.id);
    expect(page?.capsule?.shareUrl).toContain(`/memory/${capsule.shareToken}`);
    expect(page?.capsule?.whatsappUrl).toMatch(/^https:\/\/wa\.me\/525512345678\?text=/);
  });

  it("STAFF no puede crear ni moderar (RBAC en el servicio)", async () => {
    const staff = await testStaff();
    const event = await makeEvent();
    await expect(createCapsule(staff, { eventId: event.id, title: "Memorias" })).rejects.toBeInstanceOf(ForbiddenError);
    const { capsule } = await makeCapsule();
    const m = await addMedia(capsule, { approved: true });
    await expect(setMediaApproval(staff, { capsuleId: capsule.id, mediaId: m.id, approved: false })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(rotateShareToken(staff, capsule.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("publicar/despublicar queda auditado", async () => {
    const { capsule } = await makeCapsule();
    const published = await updateCapsule(owner, {
      capsuleId: capsule.id,
      title: "Memorias publicadas",
      message: "Gracias",
      published: true,
      allowGuestUploads: false,
    });
    expect(published.published).toBe(true);
    expect(published.allowGuestUploads).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "memory.published", entityId: capsule.id } })).toBe(1);
  });

  it("rotar el token invalida el enlace anterior", async () => {
    const { capsule } = await makeCapsule({ published: true });
    const { capsule: rotated, previousToken } = await rotateShareToken(owner, capsule.id);
    expect(previousToken).toBe(capsule.shareToken);
    expect(rotated.shareToken).not.toBe(capsule.shareToken);
    expect(await getPublicCapsule(capsule.shareToken)).toBeNull();
    expect((await getPublicCapsule(rotated.shareToken))?.status).toBe("published");
    const log = await prisma.auditLog.findFirst({ where: { action: "memory.token_rotated", entityId: capsule.id } });
    expect(log).not.toBeNull();
    // La bitácora no guarda el token completo
    expect(JSON.stringify(log?.after)).not.toContain(rotated.shareToken);
  });

  it("portada: aprueba la foto elegida; eliminar la foto limpia la portada y se audita", async () => {
    const { capsule } = await makeCapsule({ published: true });
    const hidden = await addMedia(capsule, { approved: false });
    const updated = await setCover(owner, { capsuleId: capsule.id, mediaId: hidden.id });
    expect(updated.coverMediaId).toBe(hidden.id);
    expect((await prisma.mediaAsset.findUnique({ where: { id: hidden.id } }))?.approved).toBe(true);
    // La aprobación implícita (por portada) también queda en la bitácora.
    expect(await prisma.auditLog.count({ where: { action: "media.approved", entityId: hidden.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "memory.cover_changed", entityId: capsule.id } })).toBe(1);

    const view = await getPublicCapsule(capsule.shareToken);
    expect(view?.status === "published" && view.cover?.id).toBe(hidden.id);

    await deleteCapsuleMedia(owner, { capsuleId: capsule.id, mediaId: hidden.id });
    expect(await prisma.mediaAsset.findUnique({ where: { id: hidden.id } })).toBeNull();
    expect((await prisma.memoryCapsule.findUnique({ where: { id: capsule.id } }))?.coverMediaId).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "media.deleted", entityId: hidden.id } })).toBe(1);
  });

  it("no permite moderar fotos de otra cápsula", async () => {
    const a = await makeCapsule();
    const b = await makeCapsule();
    const foreign = await addMedia(b.capsule, { approved: true });
    await expect(
      setMediaApproval(owner, { capsuleId: a.capsule.id, mediaId: foreign.id, approved: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteCapsuleMedia(owner, { capsuleId: a.capsule.id, mediaId: foreign.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(setCover(owner, { capsuleId: a.capsule.id, mediaId: foreign.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Memory Capsule — vista pública", () => {
  it("token inválido o inexistente devuelve null", async () => {
    expect(await getPublicCapsule("corto")).toBeNull();
    expect(await getPublicCapsule("../../etc/passwd")).toBeNull();
    expect(await getPublicCapsule(generateToken())).toBeNull();
  });

  it("una cápsula sin publicar oculta la galería y los mensajes", async () => {
    const { capsule, event } = await makeCapsule();
    await addMedia(capsule, { approved: true });
    await prisma.eventMessage.create({
      data: { eventId: event.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Ana", body: "Hola" },
    });
    const view = await getPublicCapsule(capsule.shareToken);
    expect(view).toEqual({ status: "draft", title: capsule.title, honoreeName: "Vale" });
    expect(view).not.toHaveProperty("photos");
    expect(view).not.toHaveProperty("messages");
  });

  it("sólo lista fotos aprobadas (imágenes) con URL firmada y la portada nunca es una foto oculta", async () => {
    const { capsule } = await makeCapsule({ published: true });
    const approved = await addMedia(capsule, { approved: true, sortOrder: 2 });
    const approved2 = await addMedia(capsule, { approved: true, sortOrder: 1 });
    const hidden = await addMedia(capsule, { approved: false, sortOrder: 0 });
    await addMedia(capsule, { approved: true, kind: "DOCUMENT" });
    await prisma.memoryCapsule.update({ where: { id: capsule.id }, data: { coverMediaId: hidden.id } });

    const view = await getPublicCapsule(capsule.shareToken);
    if (view?.status !== "published") throw new Error("esperaba cápsula publicada");
    expect(view.photos.map((p) => p.id)).toEqual([approved2.id, approved.id]);
    expect(view.cover?.id).toBe(approved2.id);
    expect(view.photos.every((p) => p.url.length > 0 && p.alt.length > 0)).toBe(true);
    expect(JSON.stringify(view)).not.toContain(hidden.id);
    // No expone datos internos del evento ni de la clienta
    expect(view).not.toHaveProperty("eventId");
    expect(JSON.stringify(view)).not.toContain("5512345678");
  });

  it("URL firmada para fotos privadas almacenadas", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    const { id } = await uploadGuestPhoto({ token: capsule.shareToken, file: png(), uploaderName: "Ana", consent: true });
    await setMediaApproval(owner, { capsuleId: capsule.id, mediaId: id, approved: true });
    const view = await getPublicCapsule(capsule.shareToken);
    if (view?.status !== "published") throw new Error("esperaba cápsula publicada");
    expect(view.photos[0]?.url).toMatch(new RegExp(`^/api/media/${id}\\?exp=\\d+&sig=`));
  });
});

describe("Memory Capsule — fotos de invitadas", () => {
  it("guarda la foto privada, con consentimiento y pendiente de revisión", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    const { id } = await uploadGuestPhoto({
      token: capsule.shareToken,
      file: jpeg(),
      uploaderName: "  Gabriela   Soto ",
      consent: true,
    });
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
    expect(asset).toMatchObject({
      purpose: "MEMORY",
      visibility: "PRIVATE",
      approved: false,
      consent: true,
      uploaderName: "Gabriela Soto",
      memoryCapsuleId: capsule.id,
      eventId: capsule.eventId,
      mimeType: "image/jpeg",
    });

    // No aparece hasta que el equipo la apruebe
    let view = await getPublicCapsule(capsule.shareToken);
    expect(view?.status === "published" && view.photos.length).toBe(0);
    await setMediaApproval(owner, { capsuleId: capsule.id, mediaId: id, approved: true });
    view = await getPublicCapsule(capsule.shareToken);
    expect(view?.status === "published" && view.photos.map((p) => p.id)).toEqual([id]);
    expect(await prisma.auditLog.count({ where: { action: "media.approved", entityId: id } })).toBe(1);
  });

  it("rechaza la subida sin consentimiento", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    await expect(
      uploadGuestPhoto({ token: capsule.shareToken, file: png(), uploaderName: "Ana", consent: false }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.mediaAsset.count({ where: { memoryCapsuleId: capsule.id } })).toBe(0);
  });

  it("rechaza la subida cuando las fotos de invitadas están desactivadas o la cápsula no está publicada", async () => {
    const closed = await makeCapsule({ published: true, allowGuestUploads: false });
    const err = await uploadGuestPhoto({
      token: closed.capsule.shareToken,
      file: png(),
      uploaderName: "Ana",
      consent: true,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("UPLOADS_CLOSED");

    const draft = await makeCapsule({ published: false, allowGuestUploads: true });
    await expect(
      uploadGuestPhoto({ token: draft.capsule.shareToken, file: png(), uploaderName: "Ana", consent: true }),
    ).rejects.toMatchObject({ code: "UPLOADS_CLOSED" });

    expect(
      await prisma.mediaAsset.count({ where: { memoryCapsuleId: { in: [closed.capsule.id, draft.capsule.id] } } }),
    ).toBe(0);
  });

  it("rechaza bytes que no son imagen (PDF, SVG, texto) aunque digan ser imagen", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    for (const bytes of [PDF, SVG, new TextEncoder().encode("hola, no soy una foto")]) {
      const file = new File([bytes], "foto.jpg", { type: "image/jpeg" });
      await expect(
        uploadGuestPhoto({ token: capsule.shareToken, file, uploaderName: "Ana", consent: true }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await prisma.mediaAsset.count({ where: { memoryCapsuleId: capsule.id } })).toBe(0);
  });

  it("exige nombre y token válido", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    await expect(
      uploadGuestPhoto({ token: capsule.shareToken, file: png(), uploaderName: " ", consent: true }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      uploadGuestPhoto({ token: generateToken(), file: png(), uploaderName: "Ana", consent: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Memory Capsule — libro de visitas", () => {
  it("crea mensajes GUESTBOOK de invitada, se muestran y se pueden ocultar", async () => {
    const { capsule, event } = await makeCapsule({ published: true });
    const { id } = await createGuestbookMessage(capsule.shareToken, {
      name: "  Diana  ",
      body: "¡Gracias por juntarnos!\n\n\n\nRepetimos pronto.",
    });
    const msg = await prisma.eventMessage.findUniqueOrThrow({ where: { id } });
    expect(msg).toMatchObject({
      eventId: event.id,
      kind: "GUESTBOOK",
      authorType: "GUEST",
      authorName: "Diana",
      body: "¡Gracias por juntarnos!\n\nRepetimos pronto.",
      hidden: false,
    });

    // Los mensajes para la homenajeada también se muestran; los HOST_THREAD nunca.
    await prisma.eventMessage.create({
      data: { eventId: event.id, kind: "HONOREE", authorType: "GUEST", authorName: "Milagros", body: "¡Feliz cumple!" },
    });
    const thread = await prisma.eventMessage.create({
      data: { eventId: event.id, kind: "HOST_THREAD", authorType: "CUSTOMER", authorName: "Clienta", body: "Privado" },
    });

    let view = await getPublicCapsule(capsule.shareToken);
    if (view?.status !== "published") throw new Error("esperaba cápsula publicada");
    expect(view.messages.map((m) => m.authorName).sort()).toEqual(["Diana", "Milagros"]);

    await setMessageHidden(owner, { eventId: event.id, messageId: id, hidden: true });
    view = await getPublicCapsule(capsule.shareToken);
    expect(view?.status === "published" && view.messages.map((m) => m.authorName)).toEqual(["Milagros"]);
    expect(await prisma.auditLog.count({ where: { action: "message.hidden", entityId: id } })).toBe(1);

    await setMessageHidden(owner, { eventId: event.id, messageId: id, hidden: false });
    view = await getPublicCapsule(capsule.shareToken);
    expect(view?.status === "published" && view.messages.length).toBe(2);

    // No se pueden moderar conversaciones privadas ni mensajes de otro evento desde aquí
    await expect(
      setMessageHidden(owner, { eventId: event.id, messageId: thread.id, hidden: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const other = await makeCapsule({ published: true });
    await expect(
      setMessageHidden(owner, { eventId: other.event.id, messageId: id, hidden: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("valida longitud y rechaza cápsulas no publicadas o tokens inválidos", async () => {
    const { capsule } = await makeCapsule({ published: true });
    await expect(createGuestbookMessage(capsule.shareToken, { name: "Ana", body: "x".repeat(501) })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createGuestbookMessage(capsule.shareToken, { name: "", body: "Hola" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const draft = await makeCapsule();
    await expect(createGuestbookMessage(draft.capsule.shareToken, { name: "Ana", body: "Hola" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(createGuestbookMessage("no-valido", { name: "Ana", body: "Hola" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Memory Capsule — POST /api/memory/[token]/upload", () => {
  const appOrigin = () => new URL(env().APP_URL).origin;

  async function post(
    token: string,
    fields: { file?: File | null; name?: string; consent?: string },
    headers: Record<string, string> = { origin: appOrigin() },
  ) {
    const body = new FormData();
    if (fields.file !== null) body.append("file", fields.file ?? png());
    if (fields.name !== undefined) body.append("name", fields.name);
    if (fields.consent !== undefined) body.append("consent", fields.consent);
    const res = await guestUploadPOST(
      new Request(`${appOrigin()}/api/memory/${token}/upload`, { method: "POST", body, headers }),
      { params: Promise.resolve({ token }) },
    );
    return { status: res.status, json: (await res.json()) as { id?: string; error?: string } };
  }

  it("acepta una foto válida con consentimiento: 201 { id } y queda oculta y privada", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    const res = await post(capsule.shareToken, { name: "Lucía", consent: "true" });
    expect(res.status).toBe(201);
    expect(Object.keys(res.json)).toEqual(["id"]);
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: res.json.id! } });
    expect(asset).toMatchObject({ approved: false, consent: true, visibility: "PRIVATE", uploaderName: "Lucía" });
  });

  it("exige consentimiento exactamente \"true\"", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    for (const consent of [undefined, "false", "on", "TRUE", "1"]) {
      const res = await post(capsule.shareToken, { name: "Lucía", consent });
      expect(res.status).toBe(400);
    }
    expect(await prisma.mediaAsset.count({ where: { memoryCapsuleId: capsule.id } })).toBe(0);
  });

  it("CSRF: rechaza sin Origin o desde otro sitio; acepta Origin nulo sólo con Sec-Fetch-Site same-origin", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    const fields = { name: "Lucía", consent: "true" };
    expect((await post(capsule.shareToken, fields, {})).status).toBe(403);
    expect((await post(capsule.shareToken, fields, { origin: "https://malicioso.example" })).status).toBe(403);
    expect((await post(capsule.shareToken, fields, { origin: "null", "sec-fetch-site": "cross-site" })).status).toBe(403);
    // Sec-Fetch-Site lo pone el navegador y no se puede falsificar desde una página: "same-origin" es la señal
    // más confiable (detrás de un proxy el Origin puede no coincidir con Host). Un cliente que no es navegador puede
    // mandar cualquier combinación, pero no lleva las cookies de la víctima, así que no es un vector de CSRF.
    expect(
      (await post(capsule.shareToken, fields, { origin: "https://malicioso.example", "sec-fetch-site": "same-site" }))
        .status,
    ).toBe(403);
    expect((await post(capsule.shareToken, fields, { origin: "null", "sec-fetch-site": "same-origin" })).status).toBe(201);
    expect(await prisma.mediaAsset.count({ where: { memoryCapsuleId: capsule.id } })).toBe(1);
  });

  it("responde 404 genérico a tokens inválidos o inexistentes y 403 si la cápsula no recibe fotos", async () => {
    const fields = { name: "Lucía", consent: "true" };
    expect((await post("../../etc", fields)).status).toBe(404);
    expect((await post(generateToken(), fields)).status).toBe(404);
    const draft = await makeCapsule({ published: false });
    expect((await post(draft.capsule.shareToken, fields)).status).toBe(403);
    const closed = await makeCapsule({ published: true, allowGuestUploads: false });
    expect((await post(closed.capsule.shareToken, fields)).status).toBe(403);
  });

  it("rechaza cuerpos demasiado grandes (413), sin archivo (400) o con bytes que no son foto (422)", async () => {
    const { capsule } = await makeCapsule({ published: true, allowGuestUploads: true });
    const big = String(env().UPLOAD_MAX_MB * 1024 * 1024 + 2 * 1024 * 1024);
    expect((await post(capsule.shareToken, { name: "Lucía", consent: "true" }, { origin: appOrigin(), "content-length": big })).status).toBe(413);
    expect((await post(capsule.shareToken, { file: null, name: "Lucía", consent: "true" })).status).toBe(400);
    const pdf = new File([PDF], "foto.jpg", { type: "image/jpeg" });
    expect((await post(capsule.shareToken, { file: pdf, name: "Lucía", consent: "true" })).status).toBe(422);
    expect(await prisma.mediaAsset.count({ where: { memoryCapsuleId: capsule.id } })).toBe(0);
  });
});
