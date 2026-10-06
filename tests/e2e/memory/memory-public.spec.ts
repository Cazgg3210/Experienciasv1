/**
 * Memory Capsule pública (/memory/[token]): libro de visitas, subida de fotos de invitadas
 * (magic bytes, consentimiento, CSRF, estado de la cápsula), privacidad y cápsula sembrada.
 * Paquete 4 · carril 4 · prefijo MEM.
 */
import { expect, scanA11y, test, TOKENS, uniq } from "../fixtures";
import {
  callAction,
  createCapsuleFixture,
  createEventFixture,
  describe as d,
  tinyPng,
  token,
  uploadGuestPhoto,
  waitHydrated,
} from "../events/_helpers";

test.describe("Memory Capsule · pública", { tag: ["@module:memory"] }, () => {
  test("[MEM-013] una invitada deja un mensaje en el libro de visitas y queda en el muro y en la moderación", { tag: ["@P0", "@critical", "@mobile"] }, async ({ anonPage, rolePage, db, evidence }) => {
    evidence("invitada", "/memory/[token] › Deja tu mensaje › Dejar mi mensaje");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const body = `Gracias por invitarme ${uniq("libro")}`;
    const page = await anonPage();
    await page.goto(cap.path);
    const form = page.getByRole("form", { name: "Dejar un mensaje en el libro de visitas" });
    const submit = form.getByRole("button", { name: "Dejar mi mensaje" });
    await waitHydrated(submit);
    await expect(submit).toBeEnabled();
    await form.getByLabel("Tu nombre").fill("Abril");
    await form.getByLabel("Tu mensaje").fill(body);
    await submit.click();
    await expect(page.getByText("¡Gracias por tu mensaje! Ya forma parte de la cápsula ✨")).toBeVisible();
    const msg = await db.eventMessage.findFirst({ where: { eventId: ev.id, body } });
    expect(msg).toMatchObject({ kind: "GUESTBOOK", authorType: "GUEST", authorName: "Abril", hidden: false });
    await page.reload();
    await expect(page.getByRole("region", { name: "Con todo nuestro cariño" })).toContainText(body);
    await expect(page.getByRole("region", { name: "Con todo nuestro cariño" })).toContainText("— Abril");
    const owner = await rolePage("owner");
    await owner.goto(`/admin/events/${ev.id}/memory`);
    await expect(owner.getByText(body)).toBeVisible();
  });

  test("[MEM-014] una invitada sube una foto con consentimiento: queda privada y pendiente de revisión", { tag: ["@P0", "@critical", "@mobile"] }, async ({ anonPage, db, evidence }) => {
    evidence("invitada", "/memory/[token] › ¿Tienes fotos del día? › nombre + permiso + Elige tus fotos (PNG)");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const page = await anonPage();
    await page.goto(cap.path);
    const section = page.getByRole("region", { name: "¿Tienes fotos del día?" });
    await waitHydrated(section.getByRole("checkbox"));
    await expect(section.getByText("Escribe tu nombre y confirma el permiso para subir")).toBeVisible();
    await section.getByRole("textbox", { name: "Tu nombre" }).fill("Paulina Fotos");
    await section.getByRole("checkbox").check();
    const input = section.getByLabel("Elige tus fotos");
    await input.setInputFiles({ name: "brindis.png", mimeType: "image/png", buffer: tinyPng() });
    await expect(section.getByRole("status")).toContainText("¡Gracias! La revisaremos antes de publicarla.");
    await expect.poll(() => db.mediaAsset.count({ where: { memoryCapsuleId: cap.id } })).toBe(1);
    const asset = await db.mediaAsset.findFirstOrThrow({ where: { memoryCapsuleId: cap.id } });
    expect(asset).toMatchObject({ purpose: "MEMORY", approved: false, consent: true, visibility: "PRIVATE", uploaderName: "Paulina Fotos", mimeType: "image/png", eventId: ev.id, uploadedById: null });
    expect(asset.storageKey).not.toContain("brindis");
    await page.reload();
    await expect(page.getByText("Las fotos vienen en camino")).toBeVisible();
    await expect(page.getByRole("button", { name: /Ver foto/ })).toHaveCount(0);
  });

  test("[MEM-015] subida pública rechaza tipos falsos, PDF, falta de consentimiento, origen ajeno y cápsulas cerradas", { tag: ["@P1", "@negative", "@permissions"] }, async ({ apiAs, db, evidence }) => {
    evidence("anonimo", "POST /api/memory/[token]/upload con casos inválidos");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const draft = await createCapsuleFixture(db, (await createEventFixture(db, { status: "COMPLETED" })).id, { published: false });
    const closed = await createCapsuleFixture(db, (await createEventFixture(db, { status: "COMPLETED" })).id, { published: true, allowGuestUploads: false });
    const api = await apiAs(null);
    const fakeJpg = { name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from("esto no es una imagen, es texto") };
    const pdf = { name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%âã\n1 0 obj<<>>endobj\n") };
    const cases: Array<[string, Promise<{ status: number; body: { error?: string } }>, number, string]> = [
      ["texto con extensión .jpg", uploadGuestPhoto(api, cap.shareToken, { file: fakeJpg }), 422, "Sólo aceptamos fotos en formato JPG, PNG o WEBP."],
      ["PDF", uploadGuestPhoto(api, cap.shareToken, { file: pdf }), 422, "Sólo aceptamos fotos en formato JPG, PNG o WEBP."],
      ["sin consentimiento", uploadGuestPhoto(api, cap.shareToken, { consent: "false" }), 400, "Confirma que tienes permiso de compartir la foto."],
      ["nombre corto", uploadGuestPhoto(api, cap.shareToken, { name: "A" }), 400, "Escribe tu nombre."],
      ["sin Origin (CSRF)", uploadGuestPhoto(api, cap.shareToken, { origin: null }), 403, "Origen no permitido."],
      ["Origin ajeno (CSRF)", uploadGuestPhoto(api, cap.shareToken, { origin: "https://evil.example" }), 403, "Origen no permitido."],
      ["token inexistente", uploadGuestPhoto(api, token()), 404, "Esta Memory Capsule no está disponible."],
      ["cápsula en preparación", uploadGuestPhoto(api, draft.shareToken), 403, "Esta cápsula todavía no está abierta para recibir fotos."],
      ["subidas cerradas", uploadGuestPhoto(api, closed.shareToken), 403, "Esta cápsula ya no está recibiendo fotos de invitadas."],
    ];
    const observed: string[] = [];
    for (const [label, promise, status, error] of cases) {
      const r = await promise;
      observed.push(`${label}: ${r.status} ${r.body.error ?? ""}`);
      expect.soft(r.body.error, label).toBe(error);
      expect.soft(r.status, label).toBe(status);
    }
    test.info().annotations.push({ type: "respuestas", description: observed.join(" · ") });
    expect(await db.mediaAsset.count({ where: { memoryCapsuleId: { in: [cap.id, draft.id, closed.id] } } }), "ninguna subida inválida creó archivos").toBe(0);
  });

  test("[MEM-016] libro de visitas: cápsula en preparación, token inválido y mensaje vacío se rechazan; el HTML se escapa", { tag: ["@P1", "@negative"] }, async ({ anonPage, apiAs, db, evidence }) => {
    evidence("anonimo", "submitGuestbookMessageAction directo + mensaje con <script>");
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    const draftEvent = await createEventFixture(db, { status: "COMPLETED" });
    const draft = await createCapsuleFixture(db, draftEvent.id, { published: false });
    const api = await apiAs(null);
    const unpublished = await callAction(api, "submitGuestbookMessageAction", { token: draft.shareToken, name: "Ana", body: "Hola" }, { path: cap.path });
    expect(unpublished.code, d(unpublished)).toBe("NOT_FOUND");
    const ghost = await callAction(api, "submitGuestbookMessageAction", { token: token(), name: "Ana", body: "Hola" }, { path: cap.path });
    expect(ghost.code, d(ghost)).toBe("NOT_FOUND");
    const empty = await callAction(api, "submitGuestbookMessageAction", { token: cap.shareToken, name: "Ana", body: " " }, { path: cap.path });
    expect(empty.fieldErrors?.body?.[0], d(empty)).toBe("Escribe un mensaje.");
    const xss = `<script>window.__xss=1</script><b>negritas</b> ${uniq("x")}`;
    const ok = await callAction(api, "submitGuestbookMessageAction", { token: cap.shareToken, name: "Hacker", body: xss }, { path: cap.path });
    expect(ok.outcome, d(ok)).toBe("accepted");
    expect(await db.eventMessage.count({ where: { eventId: draftEvent.id, kind: "GUESTBOOK" } }), "nada en la cápsula en preparación").toBe(0);
    const page = await anonPage();
    await page.goto(cap.path);
    await expect(page.getByText(xss, { exact: false })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("[MEM-017] la galería pública sólo muestra lo aprobado y visible; tokens inválidos responden 404", { tag: ["@P1", "@permissions"] }, async ({ anonPage, apiAs, db, guard, evidence }) => {
    evidence("anonimo", "/memory/[token] con foto pendiente y mensaje oculto + /memory/<token falso>");
    guard.allow(/status of 404/);
    const ev = await createEventFixture(db, { status: "COMPLETED" });
    const cap = await createCapsuleFixture(db, ev.id, { published: true });
    await uploadGuestPhoto(await apiAs(null), cap.shareToken, { name: "No Aprobada" });
    await db.eventMessage.create({ data: { eventId: ev.id, kind: "GUESTBOOK", authorType: "GUEST", authorName: "Oculta", body: "Mensaje oculto por moderación", hidden: true } });
    await db.eventMessage.create({ data: { eventId: ev.id, kind: "HOST_THREAD", authorType: "CUSTOMER", authorName: ev.customer.name, body: "Mensaje privado al equipo" } });
    const page = await anonPage();
    const res = await page.goto(cap.path);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByText("0 fotos")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("No Aprobada");
    expect(html).not.toContain("Mensaje oculto por moderación");
    expect(html).not.toContain("Mensaje privado al equipo");
    expect(html).not.toContain(ev.customer.email!);
    for (const bad of [`/memory/${token()}`, "/memory/abc"]) {
      const r = await page.goto(bad);
      expect(r?.status(), bad).toBe(404);
    }
  });

  test("[MEM-018] cápsula sembrada de Valeria (sólo lectura) y acceso desde su portal", { tag: ["@P2"] }, async ({ anonPage, db, evidence }) => {
    evidence("clienta", `/mi-evento/${TOKENS.portalValeriaCompleted} › Ver mi Memory Capsule → /memory/${TOKENS.memoryValeria}`);
    const cap = await db.memoryCapsule.findUniqueOrThrow({ where: { shareToken: TOKENS.memoryValeria } });
    const page = await anonPage();
    await page.goto(`/mi-evento/${TOKENS.portalValeriaCompleted}`);
    const link = page.getByRole("link", { name: "Ver mi Memory Capsule" });
    await expect(link).toHaveAttribute("href", `/memory/${TOKENS.memoryValeria}`);
    await page.goto(`/memory/${TOKENS.memoryValeria}`);
    await expect(page.getByRole("heading", { level: 1, name: cap.title })).toBeVisible();
    const approved = await db.mediaAsset.count({ where: { memoryCapsuleId: cap.id, approved: true, kind: "IMAGE" } });
    await expect(page.getByText(approved === 1 ? "1 foto" : `${approved} fotos`, { exact: true })).toBeVisible();
  });

  test("[MEM-019] accesibilidad (WCAG 2.1 AA) de la cápsula pública", { tag: ["@P2", "@a11y", "@regression"] }, async ({ anonPage, evidence }, testInfo) => {
    evidence("invitada", `axe en /memory/${TOKENS.memoryValeria}`);
    test.info().annotations.push({ type: "regression", description: "BUG-009" });
    const page = await anonPage();
    await page.goto(`/memory/${TOKENS.memoryValeria}`);
    await expect(page.getByRole("main")).toBeVisible();
    const { blocking } = await scanA11y(page, testInfo);
    expect(blocking.map((v) => `${v.id} (${v.impact}) ${v.help}`)).toEqual([]);
  });
});
