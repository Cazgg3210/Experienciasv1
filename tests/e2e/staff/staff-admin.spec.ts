/**
 * Administración de staff (/admin/staff): CRUD de integrantes y accesos al portal
 * (crear acceso, restablecer contraseña, desactivar/reactivar). Las cuentas que se crean aquí
 * son de prueba (dominio e2e.ivonne-rosa.test) y viven sólo en la base del carril.
 */
import { captureServerAction, expect, replayServerAction, test } from "../fixtures";
import {
  actionError,
  assignStaff,
  auditCount,
  confirmAlert,
  createEvent,
  createStaffMember,
  createStaffUser,
  dayKey,
  loginInFreshPage,
  ready,
  swapInBody,
  tempPassword,
  toast,
  uniq,
  uniqEmail,
} from "../operations/_helpers";

test.describe("Staff · integrantes", { tag: ["@module:staff"] }, () => {
  test("[STF-012] la lista de staff muestra al equipo y filtra por nombre y estado", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/staff › Buscar / Estado");
    const inactive = await createStaffMember(db, { name: uniq("Inactiva E2E"), active: false });
    const page = await rolePage("owner");
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Staff" })).toBeVisible();
    const table = page.getByRole("table", { name: "Integrantes del equipo" });
    await expect(table.getByRole("link", { name: /Lupita Hernández/ })).toBeVisible();
    await expect(table.getByRole("link", { name: new RegExp(inactive.name) })).toHaveCount(0);
    await (await ready(page.getByLabel("Buscar por nombre, correo o teléfono"))).fill("Lupita");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await page.waitForURL(/q=Lupita/);
    await expect(table.getByRole("row")).toHaveCount(2); // encabezado + Lupita
    await page.goto(`/admin/staff?estado=inactivos&q=${encodeURIComponent(inactive.name)}`);
    await expect(page.getByRole("table", { name: "Integrantes del equipo" }).getByRole("link", { name: new RegExp(inactive.name) })).toBeVisible();
    await page.goto("/admin/staff?q=zzz-no-existe-e2e");
    await expect(page.getByText("Nadie coincide con la búsqueda")).toBeVisible();
  });

  test("[STF-013] alta de integrante guarda tarifa en centavos, días y función, y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/staff/new › Agregar al equipo");
    const name = uniq("Integrante E2E");
    const email = uniqEmail("integrante");
    const page = await rolePage("owner");
    await page.goto("/admin/staff/new");
    await (await ready(page.getByLabel("Nombre completo"))).fill(name);
    await page.getByLabel("Función principal").selectOption("CHEF");
    await page.getByLabel("Teléfono / WhatsApp").fill("55 1234 5678");
    await page.getByLabel("Correo").fill(email.toUpperCase());
    await page.getByRole("textbox", { name: "Tarifa", exact: true }).fill("1,350.50");
    await page.getByLabel("Tipo de tarifa").selectOption("PER_HOUR");
    await page.getByRole("button", { name: "Lunes" }).click(); // agrega lunes a [Vie, Sáb, Dom]
    await page.getByRole("button", { name: "Domingo" }).click(); // quita domingo
    await page.getByRole("button", { name: "Agregar al equipo" }).click();
    await expect(toast(page, "Integrante agregado al equipo")).toBeVisible();
    await page.waitForURL(/\/admin\/staff\/[a-z0-9]+$/);
    const m = await db.staffMember.findFirstOrThrow({ where: { name } });
    expect(m).toMatchObject({ primaryFunction: "CHEF", rateCents: 135_050, rateType: "PER_HOUR", email, active: true });
    expect([...m.availableWeekdays].sort()).toEqual([1, 5, 6]);
    expect(await auditCount(db, "staff.created", m.id)).toBe(1);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("$1,350.50 por hora").first()).toBeVisible();
  });

  test("[STF-014] el alta valida nombre, teléfono y correo (sin crear registro)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "/admin/staff/new con datos inválidos");
    const before = await db.staffMember.count();
    const page = await rolePage("owner");
    await page.goto("/admin/staff/new");
    await (await ready(page.getByLabel("Nombre completo"))).fill("A");
    await page.getByLabel("Teléfono / WhatsApp").fill("123");
    await page.getByLabel("Correo").fill("no-es-correo");
    await page.getByRole("button", { name: "Agregar al equipo" }).click();
    await expect(page.getByText("Escribe el nombre completo.")).toBeVisible();
    await expect(page.getByText("Escribe un teléfono de 10 dígitos.")).toBeVisible();
    await expect(page.getByText("Correo inválido.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/staff\/new$/);
    expect(await db.staffMember.count()).toBe(before);
  });

  test("[STF-015] editar un integrante (tarifa, tipo, desactivar) persiste y deja de ofrecerse al asignar", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Detalle de integrante › Guardar cambios; luego Asignar staff en un evento");
    const m = await createStaffMember(db, { name: uniq("Editable E2E") });
    const ev = await createEvent(db, { dateKey: dayKey(35) });
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${m.id}`);
    await (await ready(page.getByRole("textbox", { name: "Tarifa", exact: true }))).fill("450");
    await page.getByLabel("Tipo de tarifa").selectOption("PER_HOUR");
    await page.getByRole("switch", { name: "Activa en el equipo" }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(toast(page, "Datos guardados")).toBeVisible();
    await expect.poll(async () => (await db.staffMember.findUnique({ where: { id: m.id } }))?.active).toBe(false);
    expect(await db.staffMember.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ rateCents: 45_000, rateType: "PER_HOUR" });
    expect(await auditCount(db, "staff.updated", m.id)).toBe(1);
    await page.goto(`/admin/events/${ev.id}/operations`);
    await (await ready(page.getByRole("button", { name: "Asignar staff" }))).click();
    const select = page.getByRole("dialog", { name: "Asignar staff" }).getByLabel("Integrante");
    await expect(select.getByRole("option", { name: new RegExp(m.name) })).toHaveCount(0);
  });

  test("[STF-016] eliminar un integrante sin historial lo borra y se audita", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Detalle de integrante › Eliminar integrante");
    const m = await createStaffMember(db, { name: uniq("Borrable E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${m.id}`);
    await (await ready(page.getByRole("button", { name: "Eliminar integrante" }))).click();
    await confirmAlert(page, "Eliminar", { toast: "Integrante eliminado" });
    await page.waitForURL(/\/admin\/staff$/);
    expect(await db.staffMember.count({ where: { id: m.id } })).toBe(0);
    expect(await auditCount(db, "staff.deleted", m.id)).toBe(1);
  });

  test("[STF-017] un integrante con historial no se puede eliminar (UI oculta + backend CONFLICT)", { tag: ["@P2", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Captura deleteStaffMember de un integrante sin historial → replay con id de uno con asignaciones");
    const withHistory = await createStaffMember(db, { name: uniq("Con historial E2E") });
    const ev = await createEvent(db, { dateKey: dayKey(36) });
    await assignStaff(db, ev.id, withHistory.id, "SERVER");
    const disposable = await createStaffMember(db, { name: uniq("Desechable E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${withHistory.id}`);
    await expect(page.getByRole("heading", { level: 1, name: withHistory.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar integrante" })).toHaveCount(0);
    await page.goto(`/admin/staff/${disposable.id}`);
    await (await ready(page.getByRole("button", { name: "Eliminar integrante" }))).click();
    const captured = await captureServerAction(page, () => page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click());
    await page.waitForURL(/\/admin\/staff$/);
    const res = await replayServerAction(await apiAs("owner"), captured, { body: swapInBody(captured.body, disposable.id, withHistory.id) });
    const err = actionError(res.text);
    expect(err.ok, res.text.slice(0, 200)).toBe(false);
    expect(err.code).toBe("CONFLICT");
    expect(await db.staffMember.count({ where: { id: withHistory.id } })).toBe(1);
  });

  test("[STF-022] el detalle de un integrante inexistente muestra «no encontrado»", { tag: ["@P3", "@negative"] }, async ({ rolePage, evidence, guard }) => {
    evidence("owner", "/admin/staff/<id inexistente>");
    guard.allow(/404/);
    const page = await rolePage("owner");
    await page.goto("/admin/staff/ckzz0000000000000000inexist");
    await expect(page.getByRole("heading", { name: "No encontramos este registro" })).toBeVisible();
  });
});

test.describe("Staff · acceso al portal", { tag: ["@module:staff", "@auth"] }, () => {
  test("[STF-018] crear acceso genera una cuenta STAFF ligada que puede iniciar sesión en /staff", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Detalle de integrante › Crear acceso; luego login con la cuenta nueva");
    const m = await createStaffMember(db, { name: `Mónica ${uniq("E2E")}` });
    const email = uniqEmail("acceso");
    const password = tempPassword();
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${m.id}`);
    await (await ready(page.getByRole("button", { name: "Crear acceso" }))).click();
    const dialog = page.getByRole("dialog", { name: "Crear acceso al portal de staff" });
    await dialog.getByLabel("Correo para iniciar sesión").fill(email);
    await dialog.getByLabel("Contraseña temporal").fill(password);
    await dialog.getByRole("button", { name: "Crear acceso" }).click();
    await expect(toast(page, "Acceso creado")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Comparte estas credenciales" })).toBeVisible();
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { staffMember: true } });
    expect(user).toMatchObject({ role: "STAFF", active: true });
    expect(user.staffMember?.id).toBe(m.id);
    expect(user.passwordHash).not.toContain(password);
    expect(await auditCount(db, "user.created", user.id)).toBe(1);
    const staff = await loginInFreshPage(anonPage, email, password);
    await staff.waitForURL(/\/staff/);
    await expect(staff.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
    await expect(staff.getByText("Hola, Mónica.")).toBeVisible();
    await expect(staff.getByText("Por ahora no tienes eventos próximos")).toBeVisible();
  });

  test("[STF-019] no se puede crear un acceso con un correo que ya tiene cuenta", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Crear acceso con el correo de Lupita");
    const m = await createStaffMember(db, { name: uniq("Sin acceso E2E") });
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${m.id}`);
    await (await ready(page.getByRole("button", { name: "Crear acceso" }))).click();
    const dialog = page.getByRole("dialog", { name: "Crear acceso al portal de staff" });
    await dialog.getByLabel("Correo para iniciar sesión").fill("staff@ivonne-rosa.test");
    await dialog.getByLabel("Contraseña temporal").fill(tempPassword());
    await dialog.getByRole("button", { name: "Crear acceso" }).click();
    await expect(dialog.getByText("Este correo ya tiene una cuenta.")).toBeVisible();
    expect((await db.staffMember.findUniqueOrThrow({ where: { id: m.id } })).userId).toBeNull();
  });

  test("[STF-020] restablecer la contraseña invalida la anterior y habilita la nueva", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Detalle › Restablecer contraseña; login con la vieja (falla) y la nueva (entra)");
    const acct = await createStaffUser(db);
    const newPassword = tempPassword();
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${acct.member.id}`);
    await (await ready(page.getByRole("button", { name: "Restablecer contraseña" }))).click();
    const dialog = page.getByRole("dialog", { name: "Restablecer contraseña" });
    await dialog.getByLabel("Contraseña temporal").fill(newPassword);
    await dialog.getByRole("button", { name: "Restablecer" }).click();
    await expect(toast(page, "Contraseña restablecida")).toBeVisible();
    expect(await auditCount(db, "user.password_reset", acct.user.id)).toBe(1);
    const old = await loginInFreshPage(anonPage, acct.email, acct.password);
    await expect(old.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    const fresh = await loginInFreshPage(anonPage, acct.email, newPassword);
    await fresh.waitForURL(/\/staff/);
    await expect(fresh.getByRole("heading", { level: 1, name: "Mis próximos eventos" })).toBeVisible();
  });

  // Desactivar y reactivar van en dos pruebas: juntas suman cuatro inicios de sesión en páginas nuevas y en WebKit
  // rebasaban el límite de 90 s de una prueba (regresión final, carril 5). Cada una conserva todas sus validaciones.
  test("[STF-021] desactivar el acceso bloquea el login y la sesión abierta", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Detalle › Desactivar acceso, con una sesión abierta de la cuenta");
    const acct = await createStaffUser(db);
    const session = await loginInFreshPage(anonPage, acct.email, acct.password);
    await session.waitForURL(/\/staff/);
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${acct.member.id}`);
    await (await ready(page.getByRole("button", { name: "Desactivar acceso" }))).click();
    await confirmAlert(page, "Desactivar", { toast: "Acceso desactivado" });
    await expect.poll(async () => (await db.user.findUnique({ where: { id: acct.user.id } }))?.active).toBe(false);
    expect(await auditCount(db, "user.deactivated", acct.user.id)).toBe(1);
    // La sesión abierta pierde acceso en el siguiente request
    await session.goto("/staff");
    await expect(session).toHaveURL(/\/login/);
    const denied = await loginInFreshPage(anonPage, acct.email, acct.password);
    await expect(denied.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Reactivar acceso" }), "el detalle ofrece reactivar").toBeVisible();
  });

  test("[STF-026] reactivar un acceso desactivado lo devuelve: la cuenta vuelve a iniciar sesión", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("owner", "Detalle de un integrante con el acceso desactivado › Reactivar acceso › login de la cuenta");
    const acct = await createStaffUser(db);
    // Precondición: el acceso como lo deja «Desactivar acceso» (STF-021): inactivo y con sus sesiones revocadas.
    await db.user.update({ where: { id: acct.user.id }, data: { active: false, sessionVersion: { increment: 1 } } });
    const page = await rolePage("owner");
    await page.goto(`/admin/staff/${acct.member.id}`);
    await (await ready(page.getByRole("button", { name: "Reactivar acceso" }))).click();
    await confirmAlert(page, "Reactivar", { toast: "Acceso reactivado" });
    await expect.poll(async () => (await db.user.findUnique({ where: { id: acct.user.id } }))?.active).toBe(true);
    expect(await auditCount(db, "user.activated", acct.user.id)).toBe(1);
    const back = await loginInFreshPage(anonPage, acct.email, acct.password);
    await back.waitForURL(/\/staff/);
  });
});
