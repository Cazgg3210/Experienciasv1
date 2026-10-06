/**
 * Paquete 3 · Catálogo — experiencias: listado, alta por UI, slug (autollenado, disponibilidad,
 * duplicado), validaciones front/back, montos inválidos, edición con auditoría de precio,
 * activar/desactivar y su efecto en el sitio público, eliminar (borrado vs. desactivación por
 * integridad) e imágenes (subir/reordenar/quitar con MediaUploader → S3 local).
 */
import { ACCOUNTS, createLead, expect, test, uniq } from "../fixtures";
import { callAction, gotoReady, waitForDetail } from "../quotes/_helpers";
import { createExperienceViaAction, experiencePayload, PNG_1x1, pngOfColor, uniqSlug } from "./_helpers";

test.describe("Catálogo · experiencias", { tag: ["@module:catalog"] }, () => {
  test("[CAT-001] el listado de experiencias muestra cada experiencia de la base con su precio base", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Experiencias");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog");
    await expect(page.getByRole("heading", { level: 1, name: "Experiencias" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Secciones del catálogo" }).getByRole("link", { name: "Experiencias" })).toHaveAttribute("aria-current", "page");
    const { formatMXN } = await import("../../../src/lib/money");
    for (const slug of ["signature-brunch", "birthday-table", "bridal-brunch"]) {
      const exp = await db.experience.findUniqueOrThrow({ where: { slug } });
      const card = page.getByRole("article", { name: exp.name, exact: true });
      await expect(card.getByText(formatMXN(exp.basePriceCents), { exact: true })).toBeVisible();
      await expect(card.getByRole("switch", { name: `Desactivar ${exp.name}` })).toBeChecked();
      await expect(card.getByRole("link", { name: /Editar/ })).toHaveAttribute("href", `/admin/catalog/experiences/${exp.id}`);
    }
    await expect(page.getByRole("link", { name: "Nueva experiencia" })).toHaveAttribute("href", "/admin/catalog/experiences/new");
  });

  test("[CAT-002] crear experiencia por UI: slug automático, precios en centavos, nace inactiva y queda auditada", { tag: ["@P1", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Nueva experiencia › Crear experiencia");
    const name = uniq("Brunch Prueba");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/experiences/new");
    const form = page.getByRole("form", { name: "Nueva experiencia" });
    await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    const slugInput = form.getByRole("textbox", { name: "Slug (URL)" });
    await expect(slugInput).toHaveValue(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    await expect(form.getByText("Disponible ✓", { exact: false })).toBeVisible();
    const slug = await slugInput.inputValue();
    await form.getByRole("textbox", { name: "Descripción", exact: true }).fill("Una experiencia de prueba con flores y mimosas.");
    await form.getByRole("textbox", { name: "Precio base (IVA incl.)" }).fill("1,500.50");
    await form.getByRole("textbox", { name: "Precio por invitada extra" }).fill("200");
    await form.getByRole("textbox", { name: "Costo por invitada extra" }).fill("80.25");
    await form.getByRole("button", { name: "Crear experiencia" }).click();
    await expect(page.getByText("Experiencia creada. Ahora puedes subir sus fotos.")).toBeVisible();
    await waitForDetail(page, "/admin/catalog/experiences");
    const exp = await db.experience.findUniqueOrThrow({ where: { slug } });
    expect(exp).toMatchObject({
      name,
      active: false,
      featured: false,
      basePriceCents: 150_050,
      extraGuestPriceCents: 20_000,
      extraGuestCostCents: 8_025,
      baseGuests: 6,
      minGuests: 6,
      maxGuests: 12,
    });
    expect(page.url()).toContain(exp.id);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: exp.id, action: "catalog.created" } });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner.email);
    expect(audit.after).toMatchObject({ name, basePriceCents: 150_050 });
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Precio base (IVA incl.)" })).toHaveValue("1500.5");
    await gotoReady(page, "/admin/catalog");
    await expect(page.getByRole("switch", { name: `Activar ${name}` })).not.toBeChecked();
  });

  test("[CAT-003] slug ya usado: aviso 'No disponible' en vivo y el servidor no crea duplicado", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Nueva experiencia con slug 'signature-brunch'");
    const name = uniq("Duplicada");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/experiences/new");
    const form = page.getByRole("form", { name: "Nueva experiencia" });
    await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await form.getByRole("textbox", { name: "Slug (URL)" }).fill("signature-brunch");
    await expect(form.getByText("No disponible ·", { exact: false })).toBeVisible();
    await expect(form.getByText('El slug "signature-brunch" ya está en uso. Elige otro.')).toBeVisible();
    await form.getByRole("textbox", { name: "Descripción", exact: true }).fill("Descripción suficientemente larga.");
    await form.getByRole("textbox", { name: "Precio base (IVA incl.)" }).fill("1000");
    await form.getByRole("button", { name: "Crear experiencia" }).click();
    await expect(form.getByText(/El slug "signature-brunch" ya está en uso/)).toBeVisible();
    await expect(page).toHaveURL(/\/experiences\/new$/);
    expect(await db.experience.count({ where: { name } })).toBe(0);
    expect(await db.experience.count({ where: { slug: "signature-brunch" } })).toBe(1);
  });

  test("[CAT-004] backend: checkSlug informa disponibilidad y crear/editar con slug duplicado da CONFLICT", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "checkSlugAction / createExperienceAction / updateExperienceAction con slug repetido");
    const api = await apiAs("owner");
    const taken = await callAction<{ available: boolean }>(api, "catalog", "checkSlugAction", { entity: "experience", slug: "signature-brunch" });
    expect(taken.result).toEqual({ ok: true, data: { available: false } });
    const free = await callAction<{ available: boolean }>(api, "catalog", "checkSlugAction", { entity: "experience", slug: uniqSlug("libre") });
    expect(free.result).toEqual({ ok: true, data: { available: true } });
    const seed = await db.experience.findUniqueOrThrow({ where: { slug: "signature-brunch" } });
    const own = await callAction<{ available: boolean }>(api, "catalog", "checkSlugAction", { entity: "experience", slug: "signature-brunch", excludeId: seed.id });
    expect(own.result).toEqual({ ok: true, data: { available: true } });

    const dup = await callAction(api, "catalog", "createExperienceAction", experiencePayload({ slug: "signature-brunch" }));
    expect(dup.result).toMatchObject({ ok: false, code: "CONFLICT" });
    if (dup.result && !dup.result.ok) expect(dup.result.fieldErrors?.slug?.[0]).toContain('El slug "signature-brunch" ya está en uso');
    const mine = await createExperienceViaAction(api);
    const upd = await callAction(api, "catalog", "updateExperienceAction", { ...mine.payload, id: mine.id, slug: "birthday-table" });
    expect(upd.result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await db.experience.findUniqueOrThrow({ where: { id: mine.id } })).slug).toBe(mine.slug);
    const bad = await callAction(api, "catalog", "createExperienceAction", experiencePayload({ slug: "Con Espacios Y Acentos-ñ" }));
    expect(bad.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  test("[CAT-005] validaciones del editor: mínimo > máximo y activar con precio $0", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Catálogo › Nueva experiencia › reglas de personas y precio");
    const name = uniq("Reglas");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog/experiences/new");
    const form = page.getByRole("form", { name: "Nueva experiencia" });
    await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
    await form.getByRole("textbox", { name: "Descripción", exact: true }).fill("Descripción suficientemente larga.");
    await form.getByRole("spinbutton", { name: "Mínimo" }).fill("10");
    await form.getByRole("spinbutton", { name: "Máximo" }).fill("8");
    await form.getByRole("switch", { name: "Activa" }).click();
    await form.getByRole("button", { name: "Crear experiencia" }).click();
    await expect(page.getByText("Revisa los campos marcados antes de guardar.")).toBeVisible();
    await expect(form.getByText("El mínimo no puede ser mayor que el máximo")).toBeVisible();
    await expect(form.getByText("Define el precio base antes de activar la experiencia")).toBeVisible();
    await expect(form.getByText("Las personas base deben estar entre el mínimo y el máximo")).toBeVisible();
    expect(await db.experience.count({ where: { name } })).toBe(0);
  });

  test("[CAT-006] backend rechaza montos negativos, con más de 2 decimales o enormes, y personas fuera de rango", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createExperienceAction con montos inválidos");
    const api = await apiAs("owner");
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ basePriceCents: -100 }, "basePriceCents", "El monto no puede ser negativo"],
      [{ basePriceCents: 150_050.5 }, "basePriceCents", "El monto debe tener máximo 2 decimales"],
      [{ basePriceCents: 100_000_001 }, "basePriceCents", "El monto es demasiado alto"],
      [{ extraGuestPriceCents: -1 }, "extraGuestPriceCents", "El monto no puede ser negativo"],
      [{ extraGuestCostCents: "100" }, "extraGuestCostCents", "Ingresa un monto válido"],
      [{ costComponents: [{ category: "FOOD", description: "x", amountCents: -5, perGuest: false }] }, "costComponents.0.amountCents", "El monto no puede ser negativo"],
      [{ maxGuests: 201 }, "maxGuests", "Máximo de personas: máximo 200"],
      [{ durationMinutes: 10 }, "durationMinutes", "Duración: mínimo 30"],
      [{ active: true, basePriceCents: 0 }, "basePriceCents", "Define el precio base antes de activar la experiencia"],
      [{ coverImageUrl: "http://inseguro.example/x.jpg" }, "coverImageUrl", "Usa una ruta local (/images/...) o una URL https://"],
    ];
    const slugs: string[] = [];
    for (const [over, field, message] of cases) {
      const payload = experiencePayload(over);
      slugs.push(payload.slug as string);
      const r = await callAction(api, "catalog", "createExperienceAction", payload);
      expect(r.result?.ok, JSON.stringify(over)).toBe(false);
      if (r.result && !r.result.ok) {
        expect(r.result.code).toBe("VALIDATION_ERROR");
        expect(r.result.fieldErrors?.[field], `${field} en ${JSON.stringify(r.result.fieldErrors)}`).toContain(message);
      }
    }
    expect(await db.experience.count({ where: { slug: { in: slugs } } })).toBe(0);
  });

  test("[CAT-007] editar experiencia: precio y nombre se guardan, el cambio de precio queda en auditoría", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Experiencia › Guardar cambios");
    const exp = await createExperienceViaAction(await apiAs("owner"));
    const newName = uniq("Exp Editada");
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/experiences/${exp.id}`);
    const form = page.getByRole("form", { name: "Editar experiencia" });
    await form.getByRole("textbox", { name: "Nombre", exact: true }).fill(newName);
    await form.getByRole("textbox", { name: "Precio base (IVA incl.)" }).fill("13999.99");
    await expect(form.getByText("Tienes cambios sin guardar")).toBeVisible();
    await form.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    await expect(form.getByText("Todo guardado")).toBeVisible();
    const after = await db.experience.findUniqueOrThrow({ where: { id: exp.id } });
    expect(after).toMatchObject({ name: newName, basePriceCents: 1_399_999, slug: exp.slug });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: exp.id, action: "catalog.price_changed" } });
    expect(audit.before).toMatchObject({ basePriceCents: 1_200_000 });
    expect(audit.after).toMatchObject({ name: newName, basePriceCents: 1_399_999 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Precio base (IVA incl.)" })).toHaveValue("13999.99");
  });

  test("[CAT-008] activar/desactivar desde el listado cambia la visibilidad en el sitio público", { tag: ["@P1", "@critical"] }, async ({ rolePage, anonPage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › switch Activar/Desactivar · anónima en /experiencias/<slug>");
    const exp = await createExperienceViaAction(await apiAs("owner"), { slug: uniqSlug("publica") });
    const anon = await anonPage();
    await gotoReady(anon, `/experiencias/${exp.slug}`);
    await expect(anon.getByRole("heading", { name: "Esta mesa ya no está puesta" })).toBeVisible();

    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog");
    await page.getByRole("switch", { name: `Activar ${exp.name}` }).click();
    await expect(page.getByText(`"${exp.name}": activa`)).toBeVisible();
    await expect.poll(async () => (await db.experience.findUniqueOrThrow({ where: { id: exp.id } })).active).toBe(true);
    const on = await db.auditLog.findFirstOrThrow({ where: { entityId: exp.id, action: "catalog.status_changed" } });
    expect(on).toMatchObject({ before: { active: false }, after: { active: true }, actorEmail: ACCOUNTS.owner.email });

    await gotoReady(anon, `/experiencias/${exp.slug}`);
    await expect(anon.getByRole("heading", { level: 1, name: exp.name })).toBeVisible();

    await page.getByRole("switch", { name: `Desactivar ${exp.name}` }).click();
    await expect(page.getByText(`"${exp.name}": inactiva`)).toBeVisible();
    await expect.poll(async () => (await db.experience.findUniqueOrThrow({ where: { id: exp.id } })).active).toBe(false);
    await gotoReady(anon, `/experiencias/${exp.slug}`);
    await expect(anon.getByRole("heading", { name: "Esta mesa ya no está puesta" })).toBeVisible();
  });

  test("[CAT-009] no se puede activar una experiencia con precio base $0 (rollback del switch)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › switch Activar con precio 0");
    const exp = await createExperienceViaAction(await apiAs("owner"), { basePriceCents: 0, costComponents: [], extraGuestPriceCents: 0, extraGuestCostCents: 0 });
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/catalog");
    await page.getByRole("switch", { name: `Activar ${exp.name}` }).click();
    await expect(page.getByText("Define el precio base antes de activar la experiencia.")).toBeVisible();
    await expect(page.getByRole("switch", { name: `Activar ${exp.name}` })).not.toBeChecked();
    expect((await db.experience.findUniqueOrThrow({ where: { id: exp.id } })).active).toBe(false);
    expect(await db.auditLog.count({ where: { entityId: exp.id, action: "catalog.status_changed" } })).toBe(0);
  });

  test("[CAT-010] eliminar una experiencia sin uso la borra, queda auditado y no reaparece", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Experiencia › Eliminar");
    const exp = await createExperienceViaAction(await apiAs("owner"));
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/experiences/${exp.id}`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: `¿Eliminar "${exp.name}"?` });
    await dialog.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Experiencia eliminada.")).toBeVisible();
    await page.waitForURL(/\/admin\/catalog$/);
    expect(await db.experience.findUnique({ where: { id: exp.id } })).toBeNull();
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: exp.id, action: "catalog.deleted" } });
    expect(audit.before).toMatchObject({ name: exp.name });
    await expect(page.getByRole("link", { name: exp.name, exact: true })).toHaveCount(0);
    await gotoReady(page, `/admin/catalog/experiences/${exp.id}`);
    await expect(page.getByRole("heading", { name: "Esta experiencia no existe" })).toBeVisible();
  });

  test("[CAT-011] eliminar una experiencia ligada a un lead la desactiva (integridad) en lugar de borrarla", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Catálogo › Experiencia con lead › Eliminar");
    const exp = await createExperienceViaAction(await apiAs("owner"), { active: true });
    await createLead(db, { name: uniq("Lead con experiencia"), experienceId: exp.id });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/experiences/${exp.id}`);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(
      page.getByText("No eliminamos la experiencia porque está ligada a 1 lead. La desactivamos para que deje de ofrecerse; el historial queda intacto."),
    ).toBeVisible();
    const after = await db.experience.findUniqueOrThrow({ where: { id: exp.id } });
    expect(after).toMatchObject({ active: false, featured: false });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: exp.id, action: "catalog.deactivated" } });
    expect(audit.after).toMatchObject({ active: false, reasons: ["1 lead"] });
    expect(await db.lead.count({ where: { experienceId: exp.id } })).toBe(1);
  });
});

test.describe("Catálogo · imágenes de experiencia", { tag: ["@module:catalog"] }, () => {
  test("[CAT-012] subir dos fotos, reordenarlas y quitar una (MediaUploader → S3 local)", { tag: ["@P2"] }, async ({ rolePage, apiAs, db, evidence, request }) => {
    evidence("owner", "Catálogo › Experiencia › Imágenes › subir / mover / quitar");
    const s3 = await request.get("http://localhost:9000/").catch(() => null);
    if (!s3) {
      test.info().annotations.push({ type: "blocked", description: "ENVIRONMENT ISSUE: S3 local (RustFS :9000) no responde" });
      test.skip(true, "BLOCKED: S3 local no responde");
    }
    const exp = await createExperienceViaAction(await apiAs("owner"));
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/catalog/experiences/${exp.id}`);
    const input = page.getByLabel("Sube fotos de la experiencia");
    await input.setInputFiles([
      { name: "uno.png", mimeType: "image/png", buffer: pngOfColor(1) },
      { name: "dos.png", mimeType: "image/png", buffer: pngOfColor(2) },
    ]);
    await expect(page.getByText("2 archivos subidos")).toBeVisible();
    await expect.poll(() => db.experienceImage.count({ where: { experienceId: exp.id } })).toBe(2);
    const imgs = await db.experienceImage.findMany({ where: { experienceId: exp.id }, orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } });
    expect(imgs.map((i) => i.mediaAsset.purpose)).toEqual(["EXPERIENCE", "EXPERIENCE"]);
    expect(imgs.map((i) => i.mediaAsset.visibility)).toEqual(["PUBLIC", "PUBLIC"]);
    await expect(page.getByRole("button", { name: "Quitar imagen 2" })).toBeVisible();

    // Reordenar: la 2 pasa a primera
    await page.getByRole("button", { name: "Mover imagen 2 antes" }).click();
    await expect
      .poll(async () => (await db.experienceImage.findMany({ where: { experienceId: exp.id }, orderBy: { sortOrder: "asc" } })).map((i) => i.id))
      .toEqual([imgs[1]!.id, imgs[0]!.id]);

    // Quitar la (nueva) primera
    await page.getByRole("button", { name: "Quitar imagen 1" }).click();
    await page.getByRole("alertdialog", { name: "¿Quitar esta imagen?" }).getByRole("button", { name: "Quitar" }).click();
    await expect(page.getByText("Imagen quitada", { exact: true })).toBeVisible();
    await expect.poll(() => db.experienceImage.count({ where: { experienceId: exp.id } })).toBe(1);
    const left = await db.experienceImage.findFirstOrThrow({ where: { experienceId: exp.id } });
    expect(left.id).toBe(imgs[0]!.id);
    // El asset huérfano se limpia
    await expect.poll(async () => db.mediaAsset.findUnique({ where: { id: imgs[1]!.mediaAssetId } })).toBeNull();
    await page.reload();
    await expect(page.getByRole("button", { name: "Quitar imagen 2" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Quitar imagen 1" })).toBeVisible();
  });

  test("[CAT-013] un archivo que no es imagen (magic bytes) se rechaza y no se agrega a la galería", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence, guard }) => {
    evidence("owner", "Catálogo › Experiencia › Imágenes › subir texto renombrado a .png");
    const exp = await createExperienceViaAction(await apiAs("owner"));
    const page = await rolePage("owner");
    // 422 esperado de /api/media/upload (es el rechazo que se valida). El guard guarda el mensaje de consola sin URL: se declara por estado.
    guard.allow(/status of 422 \(Unprocessable Entity\)/);
    await gotoReady(page, `/admin/catalog/experiences/${exp.id}`);
    await page.getByLabel("Sube fotos de la experiencia").setInputFiles({ name: "falsa.png", mimeType: "image/png", buffer: Buffer.from("esto no es una imagen") });
    await expect(page.getByText(/Formato no permitido/)).toBeVisible();
    expect(await db.experienceImage.count({ where: { experienceId: exp.id } })).toBe(0);
    expect(PNG_1x1.subarray(1, 4).toString()).toBe("PNG"); // control: el archivo válido sí tiene magic bytes PNG
  });
});
