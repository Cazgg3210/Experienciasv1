/**
 * Permiso de ACCIÓN (no de página): OWNER pasa el middleware de /admin pero NO tiene `roles:assign_super_admin`.
 * Se captura la Server Action real desde la UI de /admin/settings/users y se repite con el rol cambiado a SUPER_ADMIN.
 * Esperado: FORBIDDEN, base sin cambios y sin auditoría; control positivo con superadmin.
 * Fuente: src/features/users/{server/user-service.ts,domain/user-rules.ts}, src/server/auth/permissions.ts.
 */
import {
  captureServerAction,
  expect,
  replayServerAction,
  test,
  uniq,
  uniqEmail,
  wasAccepted,
  wasDenied,
} from "../fixtures";
import { actionResult, buildAction, createTeamUser, strongPassword } from "./_helpers";

test.describe("Usuarios: escalada a SUPER_ADMIN", { tag: ["@module:users", "@permissions"] }, () => {
  test("[PERM-140] OWNER no puede CREAR una cuenta SUPER_ADMIN (request forzado) — superadmin sí", { tag: ["@P0", "@critical"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "captura 'Crear cuenta' (rol Staff) en /admin/settings/users y replay con role=SUPER_ADMIN");
    const owner = await rolePage("owner");
    await owner.goto("/admin/settings/users");
    await owner.getByRole("button", { name: "Nueva usuaria" }).click();
    const dialog = owner.getByRole("dialog", { name: "Nueva usuaria del equipo" });
    // UI: OWNER no ve la opción "Super admin"
    await expect(dialog.getByLabel("Rol").locator("option")).toHaveText(["Fundadora", "Staff"]);
    const staffName = uniq("Staff creada E2E");
    const staffEmail = uniqEmail("acc-created");
    await dialog.getByLabel("Nombre").fill(staffName);
    await dialog.getByLabel("Correo").fill(staffEmail);
    await dialog.getByLabel("Rol").selectOption("STAFF");
    await dialog.getByLabel("Contraseña temporal").fill(strongPassword());
    const captured = await captureServerAction(owner, () => dialog.getByRole("button", { name: "Crear cuenta" }).click());
    await expect(owner.getByText(`Cuenta creada para ${staffName}`)).toBeVisible();
    expect((await db.user.findUniqueOrThrow({ where: { email: staffEmail } })).role).toBe("STAFF");

    const evilEmail = uniqEmail("acc-evil-sa");
    const auditBefore = await db.auditLog.count({ where: { action: "user.created" } });
    const forged = captured.body!.toString().replace(staffEmail, evilEmail).replace('"role":"STAFF"', '"role":"SUPER_ADMIN"');
    expect(forged).toContain('"role":"SUPER_ADMIN"');
    const res = await replayServerAction(await apiAs("owner"), captured, { body: forged });
    expect(wasDenied(res), `${res.outcome} ${res.status} ${res.text.slice(0, 200)}`).toBe(true);
    expect(actionResult(res.text)?.code).toBe("FORBIDDEN");
    expect(await db.user.findUnique({ where: { email: evilEmail } }), "no se creó la cuenta").toBeNull();
    expect(await db.auditLog.count({ where: { action: "user.created" } })).toBe(auditBefore);

    // Control positivo: el mismo request con SUPER_ADMIN sí crea la cuenta (y la audita)
    const ok = await replayServerAction(await apiAs("superadmin"), captured, { body: forged });
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    const created = await db.user.findUniqueOrThrow({ where: { email: evilEmail } });
    expect(created.role).toBe("SUPER_ADMIN");
    expect(await db.auditLog.count({ where: { action: "user.created", entityId: created.id } })).toBe(1);
  });

  test("[PERM-141] OWNER no puede PROMOVER a SUPER_ADMIN (request forzado) — superadmin sí", { tag: ["@P0", "@critical"] }, async ({ rolePage, apiAs, db, evidence }) => {
    const target = await createTeamUser(db, { role: "STAFF" });
    evidence("owner", `captura 'Guardar rol' (Staff→Fundadora) de ${target.email} y replay con role=SUPER_ADMIN`);
    const owner = await rolePage("owner");
    await owner.goto("/admin/settings/users");
    const row = owner.getByRole("list", { name: "Cuentas del equipo" }).getByRole("listitem").filter({ hasText: target.email });
    await row.getByRole("button", { name: "Rol" }).click();
    const dialog = owner.getByRole("dialog", { name: "Cambiar rol" });
    await expect(dialog.getByLabel("Nuevo rol").locator("option")).not.toContainText(["Super admin"]);
    await dialog.getByLabel("Nuevo rol").selectOption("OWNER");
    const captured = await captureServerAction(owner, () => dialog.getByRole("button", { name: "Guardar rol" }).click());
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("OWNER");

    const forged = captured.body!.toString().replace('"role":"OWNER"', '"role":"SUPER_ADMIN"');
    expect(forged).toContain('"role":"SUPER_ADMIN"');
    const auditBefore = await db.auditLog.count({ where: { action: "user.role_changed", entityId: target.id } });
    const res = await replayServerAction(await apiAs("owner"), captured, { body: forged });
    expect(wasDenied(res), `${res.outcome} ${res.status} ${res.text.slice(0, 200)}`).toBe(true);
    expect(actionResult(res.text)?.code).toBe("FORBIDDEN");
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("OWNER");
    expect(await db.auditLog.count({ where: { action: "user.role_changed", entityId: target.id } })).toBe(auditBefore);

    const ok = await replayServerAction(await apiAs("superadmin"), captured, { body: forged });
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("SUPER_ADMIN");
  });

  test("[PERM-142] OWNER no puede modificar una cuenta SUPER_ADMIN (rol, estado ni contraseña) — UI y backend", { tag: ["@P0"] }, async ({ rolePage, apiAs, db, evidence }) => {
    const sa = await createTeamUser(db, { role: "SUPER_ADMIN" });
    evidence("owner", `cuenta objetivo ${sa.email} (SUPER_ADMIN)`);
    const owner = await rolePage("owner");
    await owner.goto("/admin/settings/users");
    const row = owner.getByRole("list", { name: "Cuentas del equipo" }).getByRole("listitem").filter({ hasText: sa.email });
    await expect(row.getByText("Sólo un super admin puede modificar esta cuenta.")).toBeVisible();
    await expect(row.getByRole("button")).toHaveCount(0);

    const before = await db.user.findUniqueOrThrow({ where: { id: sa.id } });
    const api = await apiAs("owner");
    const attempts = [
      buildAction("changeUserRoleAction", "/admin/settings/users", { userId: sa.id, role: "STAFF" }),
      buildAction("setUserActiveAction", "/admin/settings/users", { userId: sa.id, active: false }),
      buildAction("resetUserPasswordAction", "/admin/settings/users", { userId: sa.id, password: "Toma-de-control-123" }),
    ];
    for (const a of attempts) {
      const res = await replayServerAction(api, a);
      expect(actionResult(res.text)?.code, res.text.slice(0, 200)).toBe("FORBIDDEN");
    }
    const after = await db.user.findUniqueOrThrow({ where: { id: sa.id } });
    expect({ role: after.role, active: after.active, hash: after.passwordHash }).toEqual({ role: before.role, active: before.active, hash: before.passwordHash });

    // Control positivo del request construido: superadmin sí puede desactivarla
    const ok = await replayServerAction(await apiAs("superadmin"), attempts[1]!);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: sa.id } })).active).toBe(false);
  });

  test("[PERM-143] OWNER puede administrar fundadoras y staff (no es sobre-restrictivo)", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const staff = await createTeamUser(db, { role: "STAFF" });
    evidence("owner", `promueve ${staff.email} a OWNER y la desactiva`);
    const api = await apiAs("owner");
    const promote = await replayServerAction(api, buildAction("changeUserRoleAction", "/admin/settings/users", { userId: staff.id, role: "OWNER" }));
    expect(wasAccepted(promote), promote.text.slice(0, 200)).toBe(true);
    const off = await replayServerAction(api, buildAction("setUserActiveAction", "/admin/settings/users", { userId: staff.id, active: false }));
    expect(wasAccepted(off), off.text.slice(0, 200)).toBe(true);
    const row = await db.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect({ role: row.role, active: row.active }).toEqual({ role: "OWNER", active: false });
    expect(await db.auditLog.count({ where: { entityId: staff.id, action: { in: ["user.role_changed", "user.deactivated"] } } })).toBe(2);
  });
});
