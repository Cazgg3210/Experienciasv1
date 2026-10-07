/**
 * Contenido administrable: testimonios, preguntas frecuentes y galería (CRUD en el panel).
 * El reflejo en el sitio público y el reordenamiento (estado compartido por todo el sitio) viven en
 * content.global.spec.ts (suite serial).
 */
import { expect, test } from "../fixtures";
import { auditCount, blocked, confirmAlert, FAKE_PNG, PNG_1PX, ready, storageAvailable, toast, uniq } from "../operations/_helpers";

test.describe("Contenido · testimonios", { tag: ["@module:content"] }, () => {
  test("[CNT-001] crear un testimonio guarda autora, calificación y visibilidad y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/content › Nuevo testimonio");
    const author = uniq("Daniela E2E");
    const page = await rolePage("owner");
    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { level: 1, name: "Contenido" })).toBeVisible();
    await (await ready(page.getByRole("button", { name: "Nuevo testimonio" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo testimonio" });
    await dialog.getByLabel("Autora").fill(author);
    await dialog.getByLabel("Ocasión").fill("Cumpleaños 30 E2E");
    await dialog.getByLabel("Testimonio").fill("Todo fue precioso, mis amigas siguen hablando del brunch. E2E");
    // El radio es sr-only y el ícono intercepta el clic: se pulsa su <label>, como haría una persona.
    await dialog.locator("label").filter({ has: page.getByRole("radio", { name: "4 estrellas" }) }).click();
    await expect(dialog.getByRole("radio", { name: "4 estrellas" })).toBeChecked();
    await dialog.getByRole("button", { name: "Agregar testimonio" }).click();
    await expect(toast(page, "Testimonio agregado")).toBeVisible();
    const t = await db.testimonial.findFirstOrThrow({ where: { authorName: author } });
    expect(t).toMatchObject({ rating: 4, active: true, occasion: "Cumpleaños 30 E2E" });
    expect(await auditCount(db, "testimonial.created", t.id)).toBe(1);
    await page.reload();
    const item = page.getByRole("listitem").filter({ hasText: author });
    await expect(item.getByRole("img", { name: "4 de 5 estrellas" })).toBeVisible();
  });

  test("[CNT-002] el testimonio exige autora (2+) y texto (10+)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nuevo testimonio vacío");
    const before = await db.testimonial.count();
    const page = await rolePage("owner");
    await page.goto("/admin/content");
    await (await ready(page.getByRole("button", { name: "Nuevo testimonio" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo testimonio" });
    await dialog.getByLabel("Autora").fill("A");
    await dialog.getByLabel("Testimonio").fill("corto");
    await dialog.getByRole("button", { name: "Agregar testimonio" }).click();
    await expect(dialog.getByText("Escribe el nombre de quien opina")).toBeVisible();
    await expect(dialog.getByText("Escribe el testimonio (mínimo 10 caracteres)")).toBeVisible();
    expect(await db.testimonial.count()).toBe(before);
  });

  test("[CNT-003] editar, ocultar y eliminar un testimonio persiste en la base (con auditoría)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Testimonio › Editar → Visible off → Eliminar");
    const t = await db.testimonial.create({ data: { authorName: uniq("Paola E2E"), body: "Organizarlo fue facilísimo. E2E", rating: 5, sortOrder: 90 } });
    const page = await rolePage("owner");
    await page.goto("/admin/content");
    const item = () => page.getByRole("listitem").filter({ hasText: t.authorName });
    await (await ready(item().getByRole("button", { name: "Editar" }))).click();
    const dialog = page.getByRole("dialog", { name: "Editar testimonio" });
    await dialog.getByLabel("Testimonio").fill("Organizarlo fue facilísimo y todo salió perfecto. E2E");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Testimonio actualizado")).toBeVisible();
    await expect.poll(async () => (await db.testimonial.findUnique({ where: { id: t.id } }))?.body).toContain("todo salió perfecto");
    await item().getByRole("switch", { name: "Visible" }).click();
    await expect(toast(page, "Testimonio oculto")).toBeVisible();
    await expect.poll(async () => (await db.testimonial.findUnique({ where: { id: t.id } }))?.active).toBe(false);
    await expect(item().getByText("Oculto")).toBeVisible();
    await item().getByRole("button", { name: "Eliminar" }).click();
    await confirmAlert(page, "Sí, eliminar", { toast: "Testimonio eliminado" });
    await expect.poll(() => db.testimonial.count({ where: { id: t.id } })).toBe(0);
    expect(await auditCount(db, "testimonial.updated", t.id)).toBe(2);
    expect(await auditCount(db, "testimonial.deleted", t.id)).toBe(1);
    await page.reload();
    await expect(page.getByText(t.authorName)).toHaveCount(0);
  });
});

test.describe("Contenido · preguntas frecuentes", { tag: ["@module:content"] }, () => {
  test("[CNT-006] crear una pregunta frecuente con categoría la guarda, la audita y la filtra por categoría", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/content/faq › Nueva pregunta → filtro Pagos");
    const question = `¿Aceptan pagos con tarjeta? ${uniq("E2E")}`;
    const page = await rolePage("owner");
    await page.goto("/admin/content/faq");
    await (await ready(page.getByRole("button", { name: "Nueva pregunta" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva pregunta frecuente" });
    await dialog.getByLabel("Pregunta").fill(question);
    await dialog.getByLabel("Respuesta").fill("Sí, con tarjeta de crédito o débito y transferencia. E2E");
    await dialog.getByLabel("Categoría").selectOption("pagos");
    await dialog.getByRole("button", { name: "Agregar pregunta" }).click();
    await expect(toast(page, "Pregunta agregada")).toBeVisible();
    const f = await db.faq.findFirstOrThrow({ where: { question } });
    expect(f).toMatchObject({ category: "pagos", active: true, experienceId: null });
    expect(await auditCount(db, "faq.created", f.id)).toBe(1);
    await page.getByRole("button", { name: /^Pagos \(/ }).click();
    await expect(page.getByText(question)).toBeVisible();
    await page.getByRole("button", { name: /^Reservas \(/ }).click();
    await expect(page.getByText(question)).toHaveCount(0);
  });

  test("[CNT-007] editar, ocultar y eliminar una pregunta frecuente persiste (con auditoría)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "FAQ › Editar → Visible off → Eliminar");
    const f = await db.faq.create({ data: { question: `¿Pregunta editable? ${uniq("E2E")}`, answer: "Respuesta inicial E2E", category: "general", sortOrder: 95 } });
    const page = await rolePage("owner");
    await page.goto("/admin/content/faq");
    const item = () => page.getByRole("listitem").filter({ hasText: f.question });
    await (await ready(item().getByRole("button", { name: "Editar" }))).click();
    const dialog = page.getByRole("dialog", { name: "Editar pregunta" });
    await dialog.getByLabel("Respuesta").fill("Respuesta corregida E2E");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Pregunta actualizada")).toBeVisible();
    await expect.poll(async () => (await db.faq.findUnique({ where: { id: f.id } }))?.answer).toBe("Respuesta corregida E2E");
    await item().getByRole("switch", { name: "Visible" }).click();
    await expect(toast(page, "Pregunta oculta")).toBeVisible();
    await expect.poll(async () => (await db.faq.findUnique({ where: { id: f.id } }))?.active).toBe(false);
    await item().getByRole("button", { name: "Eliminar" }).click();
    await confirmAlert(page, "Sí, eliminar", { toast: "Pregunta eliminada" });
    await expect.poll(() => db.faq.count({ where: { id: f.id } })).toBe(0);
    expect(await auditCount(db, "faq.deleted", f.id)).toBe(1);
  });

  test("[CNT-008] la pregunta frecuente exige pregunta y respuesta (5+)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Nueva pregunta vacía");
    const before = await db.faq.count();
    const page = await rolePage("owner");
    await page.goto("/admin/content/faq");
    await (await ready(page.getByRole("button", { name: "Nueva pregunta" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva pregunta frecuente" });
    await dialog.getByRole("button", { name: "Agregar pregunta" }).click();
    await expect(dialog.getByText("Escribe la pregunta")).toBeVisible();
    await expect(dialog.getByText("Escribe la respuesta")).toBeVisible();
    expect(await db.faq.count()).toBe(before);
  });
});

test.describe("Contenido · galería", { tag: ["@module:content"] }, () => {
  test("[CNT-010] subir una foto a la galería, ponerle texto alternativo, destacarla y eliminarla", { tag: ["@P1"] }, async ({ rolePage, db, evidence, request }) => {
    evidence("owner", "/admin/content/gallery › subir → alt → Destacada → Eliminar");
    if (!(await storageAvailable(request))) blocked(test, "S3 local (RustFS :9000) no responde");
    const before = await db.mediaAsset.findMany({ where: { purpose: "GALLERY" }, select: { id: true, sortOrder: true } });
    const maxOrder = Math.max(0, ...before.map((b) => b.sortOrder));
    const page = await rolePage("owner");
    await page.goto("/admin/content/gallery");
    await expect(page.getByRole("heading", { name: "Galería", exact: true })).toBeVisible();
    const input = page.getByLabel("Sube fotos a la galería");
    await expect.poll(() => input.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")))).toBe(true);
    await input.setInputFiles({ name: "mesa.png", mimeType: "image/png", buffer: PNG_1PX });
    await expect(toast(page, "Archivo subido")).toBeVisible();
    await expect.poll(() => db.mediaAsset.count({ where: { purpose: "GALLERY" } })).toBe(before.length + 1);
    const created = await db.mediaAsset.findFirstOrThrow({ where: { purpose: "GALLERY", id: { notIn: before.map((b) => b.id) } } });
    await expect.poll(async () => (await db.mediaAsset.findUnique({ where: { id: created.id } }))?.sortOrder).toBe(maxOrder + 1);
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: created.id } });
    expect(asset).toMatchObject({ visibility: "PUBLIC", approved: true, featured: false, mimeType: "image/png" });
    expect(await auditCount(db, "media.uploaded", asset.id)).toBe(1);
    // La tarjeta nueva es la última y avisa que falta texto alternativo
    await expect(page.getByText(/sin texto alternativo/)).toBeVisible();
    const card = page.getByRole("listitem").filter({ has: page.locator(`#alt-${asset.id}`) }); // id del input de alt (sin texto visible propio)
    const alt = `Mesa larga con flores E2E ${Date.now()}`;
    await card.getByRole("textbox", { name: "Texto alternativo", exact: true }).fill(alt);
    await card.getByRole("button", { name: "Guardar texto alternativo" }).click();
    await expect(toast(page, "Texto alternativo guardado")).toBeVisible();
    await expect.poll(async () => (await db.mediaAsset.findUnique({ where: { id: asset.id } }))?.alt).toBe(alt);
    await card.getByRole("switch", { name: "Destacada" }).click();
    await expect(toast(page, "Imagen destacada")).toBeVisible();
    await expect.poll(async () => (await db.mediaAsset.findUnique({ where: { id: asset.id } }))?.featured).toBe(true);
    await card.getByRole("button", { name: "Eliminar" }).click();
    await confirmAlert(page, "Sí, eliminar", { toast: "Imagen eliminada" });
    await expect.poll(() => db.mediaAsset.count({ where: { id: asset.id } })).toBe(0);
    expect(await auditCount(db, "media.deleted", asset.id)).toBe(1);
  });

  test("[CNT-011] el texto alternativo exige 3+ caracteres (sin cambios en base)", { tag: ["@P2", "@negative", "@a11y"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Galería › alt de 2 caracteres en una imagen del seed");
    const seed = await db.mediaAsset.findFirstOrThrow({ where: { purpose: "GALLERY" }, orderBy: { sortOrder: "asc" } });
    const page = await rolePage("owner");
    await page.goto("/admin/content/gallery");
    const input = await ready(page.locator(`#alt-${seed.id}`)); // input de alt identificado por el id que genera el componente
    await input.fill("ab");
    await page.getByRole("listitem").filter({ has: input }).getByRole("button", { name: "Guardar texto alternativo" }).click();
    await expect(page.getByText("Describe la imagen (mínimo 3 caracteres).")).toBeVisible();
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: seed.id } })).alt).toBe(seed.alt);
  });

  test("[CNT-012] un archivo que no es imagen se rechaza al subirlo a la galería", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence, request, guard }) => {
    evidence("owner", "Galería › subir texto con extensión .png");
    if (!(await storageAvailable(request))) blocked(test, "S3 local (RustFS :9000) no responde");
    guard.allow(/status of 4\d\d/); // el navegador registra en consola el rechazo esperado de /api/media/upload
    const before = await db.mediaAsset.count({ where: { purpose: "GALLERY" } });
    const page = await rolePage("owner");
    await page.goto("/admin/content/gallery");
    const input = page.getByLabel("Sube fotos a la galería");
    await expect.poll(() => input.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")))).toBe(true);
    const upload = page.waitForResponse((r) => r.url().includes("/api/media/upload"));
    await input.setInputFiles({ name: "falsa.png", mimeType: "image/png", buffer: FAKE_PNG });
    const res = await upload;
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    await expect(page.locator("[data-sonner-toast][data-type='error']").first()).toBeVisible();
    expect(await db.mediaAsset.count({ where: { purpose: "GALLERY" } })).toBe(before);
  });
});
