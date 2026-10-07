/**
 * Memory Capsule (admin): crear, publicar, rotar enlace, moderar fotos (aprobar/ocultar/portada/eliminar)
 * y mensajes, subida del equipo, autorización e IDOR.
 * Paquete 4 · carril 4 · prefijo MEM.
 */
import { expect, test, uniq } from "../fixtures";
import type { Page } from "@playwright/test";
import {
  callAction,
  createCapsuleFixture,
  createEventFixture,
  describe as d,
  lastAudit,
  tinyPng,
  uploadGuestPhoto,
  waitHydrated,
} from "../events/_helpers";

async function openMemory(page: Page, eventId: string) {
  await page.goto(`/admin/events/${eventId}/memory`);
  await expect(page.getByText("Memory Capsule", { exact: true }).first()).toBeVisible();
}

test.describe("Memory Capsule · admin", { tag: ["@module:memory"] }, () => {
  test("[MEM-001] crear la cápsula de un evento la deja en preparación (enlace con aviso, sin fotos)", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Evento › Memory Capsule › Crear Memory Capsule");
    const ev = await createEventFixture(db, { status: "COMPLETED", honoreeName: "Mariana" });
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    await expect(page.getByRole("heading", { level: 2, name: "Aún no hay Memory Capsule" })).toBeVisible();
    const create = page.getByRole("button", { name: "Crear Memory Capsule" });
    await waitHydrated(create);
    await page.getByRole("textbox", { name: "Título" }).fill(`Recuerdos ${uniq("Cap")}`);
    await create.click();
    await expect(page.getByText("Memory Capsule creada")).toBeVisible();
    // Insignia de estado (texto exacto): las ayudas de Ajustes y Compartir también mencionan "en preparación".
    await expect(page.getByText("En preparación", { exact: true })).toBeVisible();
    const capsule = await db.memoryCapsule.findUnique({ where: { eventId: ev.id } });
    expect(capsule).toMatchObject({ published: false, allowGuestUploads: true });
    expect(capsule?.shareToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await lastAudit(db, "memory.created", capsule!.id))?.after).toMatchObject({ eventId: ev.id });
    const anon = await anonPage();
    const res = await anon.goto(`/memory/${capsule!.shareToken}`);
    expect(res?.status()).toBe(200);
    await expect(anon.getByRole("heading", { name: /Tu Memory Capsule está en preparación/ })).toBeVisible();
    await expect(anon.getByRole("region", { name: "Los momentos" })).toHaveCount(0);
  });

  test("[MEM-002] publicar la cápsula desde Ajustes la abre al público con su título y mensaje", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Memory Capsule › Ajustes › Publicada › Guardar cambios");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: false, message: "Gracias por venir a celebrar" });
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const publish = page.getByRole("switch", { name: "Publicada" });
    await waitHydrated(publish);
    await publish.click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cápsula publicada ✨")).toBeVisible();
    expect((await db.memoryCapsule.findUnique({ where: { id: cap.id } }))?.published).toBe(true);
    const audit = await lastAudit(db, "memory.published", cap.id);
    expect(audit?.before).toMatchObject({ published: false });
    expect(audit?.after).toMatchObject({ published: true });
    const anon = await anonPage();
    await anon.goto(cap.path);
    await expect(anon.getByRole("heading", { level: 1, name: cap.title })).toBeVisible();
    await expect(anon.getByText("Gracias por venir a celebrar")).toBeVisible();
  });

  test("[MEM-003] cápsula duplicada, título corto o cápsula inexistente se rechazan en el backend", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createCapsuleAction / updateCapsuleAction directos inválidos");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: false });
    const api = await apiAs("owner");
    const path = `/admin/events/${ev.id}/memory`;
    const dup = await callAction(api, "createCapsuleAction", { eventId: ev.id, title: "Otra cápsula", message: "" }, { path });
    expect(dup.code, d(dup)).toBe("CONFLICT");
    expect(dup.error).toBe("Este evento ya tiene una Memory Capsule.");
    const short = await callAction(api, "updateCapsuleAction", { capsuleId: cap.id, title: "ab", message: "", published: true, allowGuestUploads: true }, { path });
    expect(short.fieldErrors?.title?.[0], d(short)).toBe("Escribe un título de al menos 3 caracteres.");
    const ghost = await callAction(api, "updateCapsuleAction", { capsuleId: "ckcapsulainexistente00001", title: "Título válido", message: "", published: true, allowGuestUploads: true }, { path });
    expect(ghost.code, d(ghost)).toBe("NOT_FOUND");
    const ghostEvent = await callAction(api, "createCapsuleAction", { eventId: "ckeventoinexistente000001", title: "Título válido", message: "" }, { path });
    expect(ghostEvent.code, d(ghostEvent)).toBe("NOT_FOUND");
    expect(await db.memoryCapsule.findUnique({ where: { id: cap.id } })).toMatchObject({ published: false, title: cap.title });
    expect(await db.memoryCapsule.count({ where: { eventId: ev.id } })).toBe(1);
  });

  test("[MEM-004] generar un nuevo enlace invalida el anterior (404) y audita sin guardar el token", { tag: ["@P1", "@permissions"] }, async ({ rolePage, anonPage, db, guard, evidence }) => {
    evidence("owner", "Memory Capsule › Compartir › Generar nuevo enlace");
    guard.allow(/status of 404/); // el enlace anterior debe responder 404
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const trigger = page.getByRole("button", { name: "Generar nuevo enlace" });
    await waitHydrated(trigger);
    await trigger.click();
    await page.getByRole("alertdialog", { name: "¿Generar un nuevo enlace?" }).getByRole("button", { name: "Generar nuevo enlace" }).click();
    await expect.poll(async () => (await db.memoryCapsule.findUnique({ where: { id: cap.id } }))?.shareToken).not.toBe(cap.shareToken);
    const fresh = (await db.memoryCapsule.findUniqueOrThrow({ where: { id: cap.id } })).shareToken;
    const audit = await lastAudit(db, "memory.token_rotated", cap.id);
    expect(audit?.before).toEqual({ tokenHint: `…${cap.shareToken.slice(-4)}` });
    expect(JSON.stringify(audit)).not.toContain(fresh);
    const anon = await anonPage();
    expect((await anon.goto(cap.path))?.status()).toBe(404);
    expect((await anon.goto(`/memory/${fresh}`))?.status()).toBe(200);
    await expect(anon.getByRole("heading", { level: 1, name: cap.title })).toBeVisible();
  });

  test("[MEM-005] aprobar una foto de invitada la publica en la galería con URL firmada", { tag: ["@P1"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("owner", "Invitada sube foto (oculta) → admin › Aprobar → galería pública");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const up = await uploadGuestPhoto(await apiAs(null), cap.shareToken, { name: "Lucía Foto" });
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const mediaId = up.body.id!;
    const alt = `Foto 1 de ${cap.title}, compartida por Lucía Foto`;
    const anon = await anonPage();
    await anon.goto(cap.path);
    await expect(anon.getByText("Las fotos vienen en camino")).toBeVisible();

    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const approve = page.getByRole("button", { name: `Aprobar: ${alt}` });
    await waitHydrated(approve);
    await approve.click();
    await expect(page.getByText("Foto aprobada")).toBeVisible();
    await expect.poll(async () => (await db.mediaAsset.findUnique({ where: { id: mediaId } }))?.approved).toBe(true);
    expect((await lastAudit(db, "media.approved", mediaId))?.after).toMatchObject({ approved: true, memoryCapsuleId: cap.id });

    await anon.reload();
    const photo = anon.getByRole("button", { name: `Ver foto 1 de 1: ${alt}` });
    await expect(photo).toBeVisible();
    // El <img> va dentro de un botón (hijos presentacionales en ARIA): se lee su src con el selector de etiqueta.
    const src = await photo.locator("img").getAttribute("src");
    expect(src).toMatch(new RegExp(`/api/media/${mediaId}\\?exp=\\d+&sig=`));
    const img = await (await apiAs(null)).get(src!);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toContain("image/png");
  });

  test("[MEM-006] ocultar una foto aprobada la retira de la galería pública", { tag: ["@P1"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("owner", "Memory Capsule › Ocultar foto");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const up = await uploadGuestPhoto(await apiAs(null), cap.shareToken, { name: "Elena Foto" });
    await db.mediaAsset.update({ where: { id: up.body.id! }, data: { approved: true } });
    const alt = `Foto 1 de ${cap.title}, compartida por Elena Foto`;
    const anon = await anonPage();
    await anon.goto(cap.path);
    await expect(anon.getByRole("button", { name: `Ver foto 1 de 1: ${alt}` })).toBeVisible();
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const hide = page.getByRole("button", { name: `Ocultar: ${alt}` });
    await waitHydrated(hide);
    await hide.click();
    await expect(page.getByText("Foto oculta")).toBeVisible();
    await expect.poll(async () => (await db.mediaAsset.findUnique({ where: { id: up.body.id! } }))?.approved).toBe(false);
    expect(await db.auditLog.count({ where: { action: "media.hidden", entityId: up.body.id! } })).toBe(1);
    await anon.reload();
    await expect(anon.getByRole("button", { name: /Ver foto/ })).toHaveCount(0);
    await expect(anon.getByText("Las fotos vienen en camino")).toBeVisible();
  });

  test("[MEM-007] elegir como portada una foto oculta la aprueba y la muestra en la portada pública", { tag: ["@P2"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("owner", "Memory Capsule › Portada (foto pendiente)");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const up = await uploadGuestPhoto(await apiAs(null), cap.shareToken, { name: "Portada Foto" });
    const alt = `Foto 1 de ${cap.title}, compartida por Portada Foto`;
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const cover = page.getByRole("button", { name: `Usar como portada: ${alt}` });
    await waitHydrated(cover);
    await cover.click();
    await expect(page.getByText("Portada actualizada")).toBeVisible();
    await expect.poll(async () => (await db.memoryCapsule.findUnique({ where: { id: cap.id } }))?.coverMediaId).toBe(up.body.id);
    expect((await db.mediaAsset.findUnique({ where: { id: up.body.id! } }))?.approved).toBe(true);
    expect((await lastAudit(db, "media.approved", up.body.id!))?.after).toMatchObject({ via: "cover" });
    expect(await db.auditLog.count({ where: { action: "memory.cover_changed", entityId: cap.id } })).toBe(1);
    const anon = await anonPage();
    await anon.goto(cap.path);
    await expect(anon.getByRole("region", { name: cap.title }).getByRole("img", { name: alt }).first()).toBeVisible();
  });

  test("[MEM-008] eliminar una foto la borra de la base y del almacenamiento (la URL firmada deja de servir)", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Memory Capsule › Eliminar foto");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const up = await uploadGuestPhoto(await apiAs(null), cap.shareToken, { name: "Borrar Foto" });
    const alt = `Foto 1 de ${cap.title}, compartida por Borrar Foto`;
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const img = page.getByRole("img", { name: alt });
    const src = await img.getAttribute("src");
    const del = page.getByRole("button", { name: `Eliminar foto: ${alt}` });
    await waitHydrated(del);
    await del.click();
    await page.getByRole("alertdialog", { name: "¿Eliminar esta foto?" }).getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Foto eliminada")).toBeVisible();
    expect(await db.mediaAsset.count({ where: { id: up.body.id! } })).toBe(0);
    expect((await lastAudit(db, "media.deleted", up.body.id!))?.before).toMatchObject({ memoryCapsuleId: cap.id, uploaderName: "Borrar Foto" });
    const res = await (await apiAs("owner")).get(src!);
    expect(res.status(), "el asset borrado ya no se sirve").toBeGreaterThanOrEqual(400);
  });

  test("[MEM-009] ocultar y mostrar mensajes del libro de visitas desde la moderación", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Memory Capsule › Mensajes › Ocultar / Mostrar");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const msg = await db.eventMessage.create({ data: { eventId: ev.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Autora Libro", body: "Qué día tan bonito" } });
    const anon = await anonPage();
    await anon.goto(cap.path);
    await expect(anon.getByText("“Qué día tan bonito”")).toBeVisible();
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const hide = page.getByRole("button", { name: "Ocultar mensaje de Autora Libro" });
    await waitHydrated(hide);
    await hide.click();
    await expect(page.getByText("Mensaje oculto")).toBeVisible();
    await expect.poll(async () => (await db.eventMessage.findUnique({ where: { id: msg.id } }))?.hidden).toBe(true);
    expect((await lastAudit(db, "message.hidden", msg.id))?.after).toMatchObject({ hidden: true, kind: "GUESTBOOK" });
    await anon.reload();
    await expect(anon.getByText("“Qué día tan bonito”")).toHaveCount(0);
    await page.getByRole("button", { name: "Mostrar mensaje de Autora Libro" }).click();
    await expect.poll(async () => (await db.eventMessage.findUnique({ where: { id: msg.id } }))?.hidden).toBe(false);
    await anon.reload();
    await expect(anon.getByText("“Qué día tan bonito”")).toBeVisible();
  });

  test("[MEM-010] fotos subidas por el equipo se publican aprobadas", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Memory Capsule › Sube fotos del evento (PNG)");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const page = await rolePage("owner");
    await openMemory(page, ev.id);
    const input = page.getByLabel("Sube fotos del evento");
    await waitHydrated(input);
    await input.setInputFiles({ name: "equipo.png", mimeType: "image/png", buffer: tinyPng() });
    await expect(page.getByText("Archivo subido")).toBeVisible();
    await expect.poll(() => db.mediaAsset.count({ where: { memoryCapsuleId: cap.id } })).toBe(1);
    const asset = await db.mediaAsset.findFirstOrThrow({ where: { memoryCapsuleId: cap.id }, include: { uploadedBy: true } });
    expect(asset).toMatchObject({ purpose: "MEMORY", approved: true, visibility: "PRIVATE", mimeType: "image/png", eventId: ev.id });
    expect(asset.uploadedBy?.email).toBe("ivonne@ivonne-rosa.test");
  });

  test("[MEM-011] moderación protegida: anónimo y staff no pueden aprobar fotos ni ocultar mensajes aunque usen la ruta pública", { tag: ["@P0", "@permissions"] }, async ({ apiAs, db, evidence }) => {
    evidence("staff", "replay de setMediaApprovalAction / setMessageHiddenAction / rotateShareTokenAction vía /memory/[token] y /admin");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const up = await uploadGuestPhoto(await apiAs(null), cap.shareToken, { name: "Pendiente Mod" });
    const msg = await db.eventMessage.create({ data: { eventId: ev.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Firma", body: "Mensaje protegido" } });
    // La página pública /memory/[token] importa las acciones de moderación: el RBAC de la acción es la barrera.
    for (const [role, path] of [[null, cap.path], ["staff", cap.path], ["staff", `/admin/events/${ev.id}/memory`]] as const) {
      const api = await apiAs(role);
      const approve = await callAction(api, "setMediaApprovalAction", { capsuleId: cap.id, mediaId: up.body.id, approved: true }, { path });
      expect(approve.outcome, `${role ?? "anónimo"} ${path}: ${d(approve)}`).toBe("denied");
      const hide = await callAction(api, "setMessageHiddenAction", { eventId: ev.id, messageId: msg.id, hidden: true }, { path });
      expect(hide.outcome, `${role ?? "anónimo"} ${path}: ${d(hide)}`).toBe("denied");
      const rotate = await callAction(api, "rotateShareTokenAction", { capsuleId: cap.id }, { path });
      expect(rotate.outcome, `${role ?? "anónimo"} ${path}: ${d(rotate)}`).toBe("denied");
    }
    expect((await db.mediaAsset.findUnique({ where: { id: up.body.id! } }))?.approved).toBe(false);
    expect((await db.eventMessage.findUnique({ where: { id: msg.id } }))?.hidden).toBe(false);
    expect((await db.memoryCapsule.findUnique({ where: { id: cap.id } }))?.shareToken).toBe(cap.shareToken);
    // Control positivo
    const owner = await apiAs("owner");
    const ok = await callAction(owner, "setMediaApprovalAction", { capsuleId: cap.id, mediaId: up.body.id, approved: true }, { path: `/admin/events/${ev.id}/memory` });
    expect(ok.outcome, d(ok)).toBe("accepted");
  });

  test("[MEM-012] IDOR en moderación: foto o mensaje de otro evento con ids de esta cápsula → no encontrado", { tag: ["@P1", "@permissions", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "setMediaApprovalAction / deleteCapsuleMediaAction / setMessageHiddenAction cruzando cápsulas");
    const a = await createEventFixture(db, { status: "COMPLETED" });
    const b = await createEventFixture(db, { status: "COMPLETED" });
    const capA = await createCapsuleFixture(db, a.id, { published: true });
    const capB = await createCapsuleFixture(db, b.id, { published: true });
    const photoB = await uploadGuestPhoto(await apiAs(null), capB.shareToken, { name: "Foto B" });
    const msgB = await db.eventMessage.create({ data: { eventId: b.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "B", body: "Mensaje de B" } });
    const hostA = await db.eventMessage.create({ data: { eventId: a.id, kind: "HOST_THREAD", authorType: "CUSTOMER", authorName: "Clienta A", body: "Hilo privado" } });
    const owner = await apiAs("owner");
    const path = `/admin/events/${a.id}/memory`;
    const approve = await callAction(owner, "setMediaApprovalAction", { capsuleId: capA.id, mediaId: photoB.body.id, approved: true }, { path });
    expect(approve.code, d(approve)).toBe("NOT_FOUND");
    const del = await callAction(owner, "deleteCapsuleMediaAction", { capsuleId: capA.id, mediaId: photoB.body.id }, { path });
    expect(del.code, d(del)).toBe("NOT_FOUND");
    const cover = await callAction(owner, "setCoverAction", { capsuleId: capA.id, mediaId: photoB.body.id }, { path });
    expect(cover.code, d(cover)).toBe("NOT_FOUND");
    const hide = await callAction(owner, "setMessageHiddenAction", { eventId: a.id, messageId: msgB.id, hidden: true }, { path });
    expect(hide.code, d(hide)).toBe("NOT_FOUND");
    const hideHost = await callAction(owner, "setMessageHiddenAction", { eventId: a.id, messageId: hostA.id, hidden: true }, { path });
    expect(hideHost.code, "los mensajes del hilo con la clienta no se moderan aquí").toBe("NOT_FOUND");
    expect(await db.mediaAsset.findUnique({ where: { id: photoB.body.id! } })).toMatchObject({ approved: false, memoryCapsuleId: capB.id });
    expect((await db.eventMessage.findUnique({ where: { id: msgB.id } }))?.hidden).toBe(false);
    expect((await db.memoryCapsule.findUnique({ where: { id: capA.id } }))?.coverMediaId).toBeNull();
  });
});
