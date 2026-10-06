/**
 * Contenido con efecto en el sitio público y en el ORDEN compartido de listas (suite E2E_SUITE=global, serial).
 * Cada prueba deja el contenido como estaba (borra lo que crea / regresa el orden) a través de la UI, de modo que
 * la última acción siempre invalida la caché "content" (ENV-01: esa caché la comparten los carriles).
 */
import { expect, test } from "../fixtures";
import { confirmAlert, ready, toast, uniq } from "../operations/_helpers";

// E2E_SUITE=global corre con 1 worker ⇒ ejecución secuencial garantizada. Se evita mode:"serial" para que un fallo
// no deje sin ejecutar (NOT TESTED) al resto de las pruebas independientes del archivo.
test.describe.configure({ mode: "default" });

test.describe("Contenido · reflejo en el sitio y orden", { tag: ["@module:content"] }, () => {
  test("[CNT-020] un testimonio visible con orden 0 aparece primero en la portada; oculto desaparece", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "/admin/content › Nuevo testimonio (orden 0) → / (anónima) → Visible off → /");
    const author = uniq("Regina E2E");
    const body = `La mejor tarde con mis amigas, gracias por todo. ${author}`;
    const page = await rolePage("owner");
    const visitor = await anonPage();
    let id: string | null = null;
    try {
      await page.goto("/admin/content");
      await (await ready(page.getByRole("button", { name: "Nuevo testimonio" }))).click();
      const dialog = page.getByRole("dialog", { name: "Nuevo testimonio" });
      await dialog.getByLabel("Autora").fill(author);
      await dialog.getByLabel("Testimonio").fill(body);
      await dialog.getByLabel("Orden").fill("0");
      await dialog.getByRole("button", { name: "Agregar testimonio" }).click();
      await expect(toast(page, "Testimonio agregado")).toBeVisible();
      id = (await db.testimonial.findFirstOrThrow({ where: { authorName: author } })).id;
      await visitor.goto("/");
      await expect(visitor.getByText(body)).toBeVisible();
      const item = page.getByRole("listitem").filter({ hasText: author });
      await item.getByRole("switch", { name: "Visible" }).click();
      await expect(toast(page, "Testimonio oculto")).toBeVisible();
      await visitor.reload();
      await expect(visitor.getByText(body)).toHaveCount(0);
    } finally {
      if (id) {
        await page.goto("/admin/content");
        await (await ready(page.getByRole("listitem").filter({ hasText: author }).getByRole("button", { name: "Eliminar" }))).click();
        await confirmAlert(page, "Sí, eliminar");
        await expect(toast(page, "Testimonio eliminado")).toBeVisible();
      }
    }
  });

  test("[CNT-021] una pregunta general visible aparece en «Cómo funciona»; oculta desaparece", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "/admin/content/faq › Nueva pregunta (orden 0) → /como-funciona → Visible off");
    const question = `¿Llevan mantel de lino? ${uniq("E2E")}`;
    const page = await rolePage("owner");
    const visitor = await anonPage();
    let created = false;
    try {
      await page.goto("/admin/content/faq");
      await (await ready(page.getByRole("button", { name: "Nueva pregunta" }))).click();
      const dialog = page.getByRole("dialog", { name: "Nueva pregunta frecuente" });
      await dialog.getByLabel("Pregunta").fill(question);
      await dialog.getByLabel("Respuesta").fill("Sí, mantelería de lino natural incluida. E2E");
      await dialog.getByLabel("Orden").fill("0");
      await dialog.getByRole("button", { name: "Agregar pregunta" }).click();
      await expect(toast(page, "Pregunta agregada")).toBeVisible();
      created = (await db.faq.count({ where: { question } })) === 1;
      await visitor.goto("/como-funciona");
      await expect(visitor.getByRole("button", { name: question })).toBeVisible();
      await page.getByRole("listitem").filter({ hasText: question }).getByRole("switch", { name: "Visible" }).click();
      await expect(toast(page, "Pregunta oculta")).toBeVisible();
      await visitor.reload();
      await expect(visitor.getByText(question)).toHaveCount(0);
    } finally {
      if (created) {
        await page.goto("/admin/content/faq");
        await (await ready(page.getByRole("listitem").filter({ hasText: question }).getByRole("button", { name: "Eliminar" }))).click();
        await confirmAlert(page, "Sí, eliminar");
        await expect(toast(page, "Pregunta eliminada")).toBeVisible();
      }
    }
  });

  test("[CNT-022] subir/bajar una pregunta frecuente intercambia su posición con la vecina", { tag: ["@P2", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/content/faq › Subir / Bajar");
    test.info().annotations.push({ type: "regression", description: "BUG-006" });
    const order = async () => (await db.faq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } })).map((f) => f.id);
    const before = await order();
    const target = await db.faq.findFirstOrThrow({ where: { id: before[2] } });
    const page = await rolePage("owner");
    await page.goto("/admin/content/faq");
    await (await ready(page.getByRole("button", { name: `Subir pregunta “${target.question}”` }))).click();
    await expect.poll(async () => (await order()).indexOf(target.id)).toBe(1);
    const moved = await order();
    expect(moved[2]).toBe(before[1]);
    await page.getByRole("button", { name: `Bajar pregunta “${target.question}”` }).click();
    await expect.poll(async () => (await order()).indexOf(target.id)).toBe(2);
    expect(await order()).toEqual(before);
    await expect(page.getByRole("button", { name: `Subir pregunta “${(await db.faq.findFirstOrThrow({ where: { id: before[0] } })).question}”` })).toBeDisabled();
  });

  test("[CNT-023] reordenar testimonios persiste el orden y la lista se actualiza en pantalla", { tag: ["@P2", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/content › Bajar testimonio (1.º) → la UI se refresca → Subir");
    test.info().annotations.push({ type: "regression", description: "BUG-006" });
    const tOrder = async () => db.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, authorName: true, sortOrder: true } });
    const tBefore = await tOrder();
    const first = tBefore[0]!;
    const page = await rolePage("owner");
    try {
      await page.goto("/admin/content");
      await (await ready(page.getByRole("button", { name: `Bajar testimonio de ${first.authorName}` }))).click();
      await expect.poll(async () => (await tOrder())[1]!.id).toBe(first.id);
      // La lista debe reflejar el nuevo orden (router.refresh) antes de poder subirlo de nuevo
      const up = page.getByRole("button", { name: `Subir testimonio de ${first.authorName}` });
      await expect(up, "tras mover, la lista se refresca y «Subir» se habilita").toBeEnabled();
      await up.click();
      await expect.poll(async () => (await tOrder())[0]!.id).toBe(first.id);
      expect((await tOrder()).map((t) => t.id)).toEqual(tBefore.map((t) => t.id));
    } finally {
      for (const t of tBefore) await db.testimonial.update({ where: { id: t.id }, data: { sortOrder: t.sortOrder } });
    }
  });

  test("[CNT-024] reordenar fotos de la galería persiste el orden y la tarjeta cambia de posición", { tag: ["@P2", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/content/gallery › Bajar imagen 1 → la tarjeta pasa a #2 → Subir");
    test.info().annotations.push({ type: "regression", description: "BUG-006" });
    const gOrder = async () => db.mediaAsset.findMany({ where: { purpose: "GALLERY" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, sortOrder: true } });
    const gBefore = await gOrder();
    const first = gBefore[0]!.id;
    const page = await rolePage("owner");
    // Cada tarjeta se identifica por el id del input de su texto alternativo (alt-<id>), único y estable.
    const card = page.getByRole("listitem").filter({ has: page.locator(`#alt-${first}`) });
    try {
      await page.goto("/admin/content/gallery");
      await expect(card.getByText("#1", { exact: true })).toBeVisible();
      await (await ready(card.getByRole("button", { name: /^Bajar imagen/ }))).click();
      await expect.poll(async () => (await gOrder())[1]!.id).toBe(first);
      await expect(card.getByText("#2", { exact: true }), "la tarjeta se mueve a la posición 2").toBeVisible();
      await card.getByRole("button", { name: /^Subir imagen/ }).click();
      await expect.poll(async () => (await gOrder())[0]!.id).toBe(first);
      expect((await gOrder()).map((g) => g.id)).toEqual(gBefore.map((g) => g.id));
    } finally {
      for (const g of gBefore) await db.mediaAsset.update({ where: { id: g.id }, data: { sortOrder: g.sortOrder } });
    }
  });
});
