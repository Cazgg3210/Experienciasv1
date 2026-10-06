/**
 * Plantillas de checklist (CRUD de plantillas y de sus tareas modelo).
 * Las plantillas que crean estas pruebas son INACTIVAS: así no alteran el checklist que generan otras
 * pruebas en paralelo. La activación (efecto en eventos) se prueba en operations.global.spec.ts.
 */
import { expect, test } from "../fixtures";
import { auditCount, confirmAlert, ready, toast, uniq } from "./_helpers";

async function createInactiveTemplate(db: import("@prisma/client").PrismaClient, name = uniq("Plantilla E2E")) {
  return db.checklistTemplate.create({ data: { name, phase: "T_MINUS_3", active: false, sortOrder: 50 } });
}

test.describe("Operaciones · plantillas de checklist", { tag: ["@module:operations"] }, () => {
  test("[OPS-022] la lista agrupa las plantillas del seed por fase y abre el detalle con sus tareas", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantillas › lista → detalle");
    const seeded = await db.checklistTemplate.findUniqueOrThrow({ where: { id: "seed-chk-t-minus-7" }, include: { items: true } });
    const page = await rolePage("owner");
    await page.goto("/admin/operations/templates");
    for (const phase of ["T-7 días", "T-3 días", "T-1 día", "Montaje", "Evento", "Desmontaje", "Cierre"]) {
      await expect(page.getByRole("heading", { level: 2, name: phase, exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: new RegExp(seeded.name) }).click();
    await page.waitForURL(`**/admin/operations/templates/${seeded.id}`);
    await expect(page.getByRole("heading", { level: 1, name: seeded.name })).toBeVisible();
    await expect(page.getByRole("heading", { name: `Tareas (${seeded.items.length})` })).toBeVisible();
    for (const it of seeded.items) await expect(page.getByText(it.title, { exact: true })).toBeVisible();
  });

  test("[OPS-023] crear una plantilla (inactiva) redirige a su detalle, persiste y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantillas › Nueva plantilla (Activa = no)");
    const name = uniq("Plantilla E2E");
    const page = await rolePage("owner");
    await page.goto("/admin/operations/templates");
    await (await ready(page.getByRole("button", { name: "Nueva plantilla" }).first())).click();
    const dialog = page.getByRole("dialog", { name: "Nueva plantilla de checklist" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByLabel("Fase").selectOption("T_MINUS_1");
    await dialog.getByLabel("Orden").fill("42");
    await dialog.getByRole("switch", { name: "Plantilla activa" }).click();
    await dialog.getByLabel("Descripción").fill("Plantilla de prueba E2E");
    await dialog.getByRole("button", { name: "Crear plantilla" }).click();
    await expect(toast(page, "Plantilla creada")).toBeVisible();
    await page.waitForURL(/\/admin\/operations\/templates\/[a-z0-9]+$/);
    const t = await db.checklistTemplate.findFirstOrThrow({ where: { name } });
    expect(t).toMatchObject({ phase: "T_MINUS_1", active: false, sortOrder: 42, experienceId: null, description: "Plantilla de prueba E2E" });
    expect(page.url()).toContain(t.id);
    expect(await auditCount(db, "checklist_template.created", t.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Inactiva").first()).toBeVisible();
  });

  test("[OPS-024] editar nombre, orden y descripción de una plantilla persiste y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantilla › Guardar cambios");
    const t = await createInactiveTemplate(db);
    const newName = uniq("Plantilla editada E2E");
    const page = await rolePage("owner");
    await page.goto(`/admin/operations/templates/${t.id}`);
    const nameInput = await ready(page.getByLabel("Nombre"));
    await nameInput.fill(newName);
    await page.getByLabel("Orden").fill("7");
    await page.getByLabel("Descripción").fill("Descripción actualizada E2E");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Plantilla guardada")).toBeVisible();
    await expect.poll(async () => (await db.checklistTemplate.findUnique({ where: { id: t.id } }))?.name).toBe(newName);
    const saved = await db.checklistTemplate.findUniqueOrThrow({ where: { id: t.id } });
    expect(saved).toMatchObject({ sortOrder: 7, description: "Descripción actualizada E2E", active: false });
    expect(await auditCount(db, "checklist_template.updated", t.id)).toBe(1);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
  });

  test("[OPS-025] tareas de plantilla: agregar con desfase, editar y eliminar (auditado)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantilla › Agregar tarea / Editar / Eliminar");
    const t = await createInactiveTemplate(db);
    const title = uniq("Confirmar pastel E2E");
    const page = await rolePage("owner");
    await page.goto(`/admin/operations/templates/${t.id}`);
    await expect(page.getByText("Esta plantilla aún no tiene tareas")).toBeVisible();
    await (await ready(page.getByRole("button", { name: "Agregar tarea" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarea de plantilla" });
    await dialog.getByLabel("Título").fill(title);
    await dialog.getByLabel("Cantidad").fill("2");
    await dialog.getByLabel("Unidad").selectOption("days");
    await dialog.getByLabel("Referencia").selectOption("before");
    await expect(dialog.getByText("2 días antes del inicio")).toBeVisible();
    await dialog.getByLabel("Área").selectOption("ADDONS");
    await dialog.getByLabel("Función por defecto").selectOption("COORDINATOR");
    await dialog.getByRole("checkbox", { name: "Requiere foto de evidencia" }).click();
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(toast(page, "Tarea agregada")).toBeVisible();
    const item = await db.checklistTemplateItem.findFirstOrThrow({ where: { templateId: t.id, title } });
    expect(item).toMatchObject({ offsetMinutes: -2 * 24 * 60, area: "ADDONS", defaultFunction: "COORDINATOR", requiresEvidence: true });
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Editar ${title}` }).click();
    const edit = page.getByRole("dialog", { name: "Editar tarea de plantilla" });
    await edit.getByLabel("Cantidad").fill("90");
    await edit.getByLabel("Unidad").selectOption("minutes");
    await edit.getByLabel("Referencia").selectOption("after");
    await edit.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(toast(page, "Tarea actualizada")).toBeVisible();
    await expect.poll(async () => (await db.checklistTemplateItem.findUnique({ where: { id: item.id } }))?.offsetMinutes).toBe(90);

    await page.getByRole("button", { name: `Eliminar ${title}` }).click();
    await confirmAlert(page, "Eliminar");
    await expect(toast(page, "Tarea eliminada")).toBeVisible();
    await expect.poll(() => db.checklistTemplateItem.count({ where: { id: item.id } })).toBe(0);
    expect(await auditCount(db, "checklist_template.item_deleted", item.id)).toBe(1);
  });

  test("[OPS-026] el desfase máximo de una tarea de plantilla es de 365 días (validación del servidor)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantilla › Agregar tarea con 400 días");
    const t = await createInactiveTemplate(db);
    const page = await rolePage("owner");
    await page.goto(`/admin/operations/templates/${t.id}`);
    await (await ready(page.getByRole("button", { name: "Agregar tarea" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarea de plantilla" });
    await dialog.getByLabel("Título").fill("Tarea con desfase enorme");
    await dialog.getByLabel("Cantidad").fill("400");
    await dialog.getByLabel("Unidad").selectOption("days");
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(dialog.getByText("Máximo 365 días.")).toBeVisible();
    await expect(toast(page, "El desfase máximo es de 365 días.")).toBeVisible();
    // Título corto: validación del cliente
    await dialog.getByLabel("Cantidad").fill("1");
    await dialog.getByLabel("Título").fill("ab");
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(dialog.getByText("Escribe un título (mínimo 3 caracteres).")).toBeVisible();
    expect(await db.checklistTemplateItem.count({ where: { templateId: t.id } })).toBe(0);
  });

  test("[OPS-027] eliminar una plantilla borra sus tareas modelo, regresa a la lista y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Plantilla › Eliminar plantilla");
    const t = await createInactiveTemplate(db);
    await db.checklistTemplateItem.create({ data: { templateId: t.id, title: "Tarea modelo E2E", offsetMinutes: -60 } });
    const page = await rolePage("owner");
    await page.goto(`/admin/operations/templates/${t.id}`);
    await (await ready(page.getByRole("button", { name: "Eliminar plantilla" }))).click();
    await confirmAlert(page, "Eliminar");
    await expect(toast(page, "Plantilla eliminada")).toBeVisible();
    await page.waitForURL("**/admin/operations/templates");
    expect(await db.checklistTemplate.count({ where: { id: t.id } })).toBe(0);
    expect(await db.checklistTemplateItem.count({ where: { templateId: t.id } })).toBe(0);
    expect(await auditCount(db, "checklist_template.deleted", t.id)).toBe(1);
    await expect(page.getByRole("link", { name: new RegExp(t.name) })).toHaveCount(0);
  });

  test("[OPS-028] una plantilla inexistente o con id inválido muestra «no encontrado»", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence, guard }) => {
    evidence("owner", "/admin/operations/templates/<id inválido>");
    guard.allow(/404/); // notFound() esperado
    const page = await rolePage("owner");
    await page.goto("/admin/operations/templates/no-existe-e2e");
    await expect(page.getByRole("heading", { name: "No encontramos este registro" })).toBeVisible();
    await page.goto("/admin/operations/templates/%3Cscript%3E");
    await expect(page.getByRole("heading", { name: "No encontramos este registro" })).toBeVisible();
  });
});
