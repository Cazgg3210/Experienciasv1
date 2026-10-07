/**
 * Ajustes (sin estado global): páginas de configuración, mensajes de prueba (mock → NotificationLog),
 * usuarios del equipo (superadmin) y bitácora de auditoría. Los cambios de ajustes/flags (estado global)
 * están en settings.global.spec.ts.
 */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { expect, test } from "../fixtures";
import {
  ACCOUNTS,
  auditCount,
  confirmAlert,
  createStaffMember,
  loginInFreshPage,
  ready,
  tempPassword,
  toast,
  uniq,
  uniqEmail,
} from "../operations/_helpers";

async function teamUser(db: PrismaClient, role: "OWNER" | "STAFF" = "STAFF") {
  const password = tempPassword();
  const email = uniqEmail("equipo");
  const name = `Equipo ${uniq("E2E")}`;
  const user = await db.user.create({ data: { email, name, role, active: true, passwordHash: await bcrypt.hash(password, 10) } });
  return { user, email, password, name };
}

const usersList = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Cuentas del equipo" });

/** ¿Es el "lazy fetch" del layout-router (GET RSC, sin prefetch, con `refetch` debajo de la raíz del árbol)? */
function isLazySegmentRequest(req: import("@playwright/test").Request): boolean {
  const h = req.headers();
  if (req.method() !== "GET" || h["rsc"] !== "1" || h["next-router-prefetch"] || h["next-action"]) return false;
  try {
    const tree = JSON.parse(decodeURIComponent(h["next-router-state-tree"] ?? "")) as unknown[];
    return tree[3] !== "refetch" && JSON.stringify(tree).includes('"refetch"');
  } catch {
    return false;
  }
}

test.describe("Ajustes · páginas", { tag: ["@module:settings"] }, () => {
  test("[SET-001] todas las secciones de configuración cargan desde la navegación lateral", { tag: ["@P1", "@smoke", "@regression"] }, async ({ rolePage, evidence }) => {
    evidence("superadmin", "/admin/settings › cada sección del menú");
    test.info().annotations.push({ type: "regression", description: "BUG-006" }); // navegación del cliente entre secciones
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings");
    const nav = page.getByRole("navigation", { name: "Secciones de configuración" });
    const sections: Array<[string, string]> = [
      ["Negocio", "Negocio"],
      ["Precios y márgenes", "Precios y márgenes"],
      ["Disponibilidad", "Disponibilidad"],
      ["Notificaciones", "Notificaciones"],
      ["Funciones", "Funciones"],
      ["Integraciones", "Integraciones"],
      ["Usuarios", "Usuarios y roles"],
      ["Auditoría", "Auditoría"],
    ];
    for (const [link, heading] of sections) {
      await nav.getByRole("link", { name: link, exact: true }).click();
      await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeVisible();
    }
  });

  /**
   * BUG-006, parte B: si el "lazy fetch" de «Negocio» llega después de que empezó la navegación a «Precios»,
   * se descarta (para que no reemplace la página nueva) y el nodo de «Negocio» queda en el caché del router
   * sin contenido. Volver a esa URL con Atrás se quedaba en el esqueleto de carga (SET-023; antes de la
   * recuperación de src/lib/navigation-guard.ts: FAIL). Con el enlace, Next crea un nodo nuevo (SET-024,
   * caso de control: debe seguir funcionando). La respuesta lenta se reproduce de forma determinista
   * reteniendo esa petición hasta que la navegación a «Precios» terminó.
   */
  for (const [id, how, tags] of [
    ["SET-023", "Atrás", ["@P2", "@regression"]],
    ["SET-024", "el enlace «Negocio»", ["@P2"]],
  ] as const) {
    test(`[${id}] volver a «Negocio» con ${how} tras saltar rápido a «Precios» muestra la página, no el esqueleto`, { tag: [...tags] }, async ({ rolePage, evidence }) => {
      evidence("owner", `/admin/settings › «Negocio» (respuesta lenta) → «Precios y márgenes» → ${how}`);
      test.info().annotations.push({
        type: id === "SET-023" ? "regression" : "related",
        description: "BUG-006 (parte B: lazy fetch descartado → esqueleto infinito al volver)",
      });
      const page = await rolePage("owner");
      const recoveries: string[] = [];
      page.on("console", (msg) => {
        if (msg.text().startsWith("[navegación]")) recoveries.push(msg.text());
      });
      let held: import("@playwright/test").Request | null = null;
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      await page.route(
        (url) => url.pathname === "/admin/settings" && url.searchParams.has("_rsc"),
        async (route) => {
          if (!held && isLazySegmentRequest(route.request())) {
            held = route.request();
            await released;
          }
          await route.continue();
        },
      );

      await page.goto("/admin/settings");
      await expect(page.getByRole("heading", { level: 2, name: "Negocio", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle"); // prefetch de los enlaces ya resuelto
      const nav = page.getByRole("navigation", { name: "Secciones de configuración" });
      await (await ready(nav.getByRole("link", { name: "Negocio", exact: true }))).click();
      await expect.poll(() => held !== null, { message: "el clic en «Negocio» pidió el segmento faltante (lazy fetch)" }).toBe(true);

      await nav.getByRole("link", { name: "Precios y márgenes", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/settings\/pricing$/);
      await expect(page.getByRole("heading", { level: 2, name: "Precios y márgenes", exact: true })).toBeVisible();
      release();
      await (await held!.response())?.finished(); // la respuesta obsoleta de «Negocio» llegó después

      await page.evaluate(() => Object.assign(window, { __e2eSinRecarga: true }));
      if (how === "Atrás") await page.goBack();
      else await nav.getByRole("link", { name: "Negocio", exact: true }).click();

      await expect(page).toHaveURL(/\/admin\/settings$/);
      await expect(page.getByRole("heading", { level: 2, name: "Negocio", exact: true })).toBeVisible();
      await expect(page.getByLabel("Nombre de la marca")).toBeVisible();
      // El esqueleto (PageSkeleton de loading.tsx) no tiene rol propio: se identifica por aria-busy.
      await expect(page.locator("main [aria-busy='true']"), "sin esqueleto de carga").toHaveCount(0);
      // Recuperación sin recarga completa (se conserva el estado del cliente).
      expect(await page.evaluate(() => (window as unknown as { __e2eSinRecarga?: boolean }).__e2eSinRecarga)).toBe(true);
      // Con Atrás, la respuesta de «Negocio» sí se descartó y la salvaguarda lo recuperó con router.refresh().
      if (id === "SET-023") expect(recoveries, "recuperación del segmento descartado").toEqual([expect.stringContaining("router.refresh()")]);
      else expect(recoveries).toEqual([]);
    });
  }

  test("[SET-021] Integraciones muestra proveedores, webhooks, cron y prueba de mensajes", { tag: ["@P2"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/settings/integrations");
    const page = await rolePage("owner");
    await page.goto("/admin/settings/integrations");
    for (const h of ["Webhooks de pagos", "Recordatorios programados (cron)", "Prueba de mensajes"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText(/\/api\/cron\/notifications/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar email de prueba" })).toBeEnabled();
  });
});

test.describe("Ajustes · mensajes de prueba", { tag: ["@module:settings", "@module:notifications"] }, () => {
  test("[SET-011] el email de prueba queda registrado (simulado) en la bandeja a nombre de quien lo pide", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Integraciones › Enviar email de prueba");
    const since = new Date();
    const page = await rolePage("owner");
    await page.goto("/admin/settings/integrations");
    await (await ready(page.getByRole("button", { name: "Enviar email de prueba" }))).click();
    await expect(toast(page, /Email de prueba registrado \((simulado|enviado)\)/)).toBeVisible();
    const log = await db.notificationLog.findFirstOrThrow({
      where: { type: "GENERIC", channel: "EMAIL", to: ACCOUNTS.owner.email, createdAt: { gte: since }, subject: { contains: "Email de prueba" } },
    });
    expect(["MOCKED", "SENT"]).toContain(log.status);
    expect(log.actionUrl).toMatch(/\/admin\/notifications$/);
    await page.goto(`/admin/notifications?id=${log.id}`);
    await expect(page.getByText(ACCOUNTS.owner.email).first()).toBeVisible();
  });

  test("[SET-012] el WhatsApp de prueba se registra hacia el número del negocio", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Integraciones › Enviar WhatsApp de prueba");
    const since = new Date();
    const page = await rolePage("owner");
    await page.goto("/admin/settings/integrations");
    await (await ready(page.getByRole("button", { name: "Enviar WhatsApp de prueba" }))).click();
    await expect(toast(page, /WhatsApp de prueba registrado/)).toBeVisible();
    const log = await db.notificationLog.findFirstOrThrow({ where: { type: "GENERIC", channel: "WHATSAPP", createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
    const business = await db.setting.findUnique({ where: { key: "business" } });
    const number = (business?.value as { whatsappNumber?: string } | undefined)?.whatsappNumber ?? "5215512345678";
    expect(log.to.replace(/\D/g, "")).toContain(number.slice(-10));
    expect(log.status, "con WHATSAPP_ENABLED efectivo el mock lo registra; apagado queda SKIPPED").not.toBe("FAILED");
  });
});

test.describe("Ajustes · usuarios del equipo", { tag: ["@module:users", "@module:settings"] }, () => {
  test("[SET-013] superadmin crea una fundadora que puede iniciar sesión en el panel", { tag: ["@P0", "@critical"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("superadmin", "Usuarios › Nueva usuaria (Fundadora) → login");
    const name = `Fundadora ${uniq("E2E")}`;
    const email = uniqEmail("fundadora");
    const password = tempPassword();
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    await (await ready(page.getByRole("button", { name: "Nueva usuaria" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva usuaria del equipo" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByLabel("Correo").fill(email);
    await dialog.getByLabel("Rol").selectOption("OWNER");
    await dialog.getByLabel("Contraseña temporal").fill(password);
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(toast(page, `Cuenta creada para ${name}`)).toBeVisible();
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    expect(u).toMatchObject({ role: "OWNER", active: true, name });
    expect(await auditCount(db, "user.created", u.id)).toBe(1);
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "user.created", entityId: u.id } });
    expect(JSON.stringify(a.after)).not.toContain(password);
    await expect(usersList(page).getByRole("listitem").filter({ hasText: email })).toContainText("Fundadora");
    const owner = await loginInFreshPage(anonPage, email, password);
    await owner.waitForURL(/\/admin/);
    await expect(owner.getByRole("heading", { level: 1 })).toContainText(/Hola/);
  });

  test("[SET-022] una usuaria STAFF creada y vinculada a su ficha ve su portal", { tag: ["@P1"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("superadmin", "Usuarios › Nueva usuaria (Staff) vinculada → login /staff");
    const member = await createStaffMember(db, { name: `Ficha ${uniq("E2E")}` });
    const email = uniqEmail("staffnueva");
    const password = tempPassword();
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    await (await ready(page.getByRole("button", { name: "Nueva usuaria" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva usuaria del equipo" });
    await dialog.getByLabel("Nombre").fill(member.name);
    await dialog.getByLabel("Correo").fill(email);
    await dialog.getByLabel("Rol").selectOption("STAFF");
    await dialog.getByLabel("Vincular con ficha de staff").selectOption(member.id);
    await dialog.getByLabel("Contraseña temporal").fill(password);
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(toast(page, `Cuenta creada para ${member.name}`)).toBeVisible();
    const u = await db.user.findUniqueOrThrow({ where: { email }, include: { staffMember: true } });
    expect(u.role).toBe("STAFF");
    expect(u.staffMember?.id).toBe(member.id);
    const staff = await loginInFreshPage(anonPage, email, password);
    await staff.waitForURL(/\/staff/);
    await expect(staff.getByText("Tu perfil de staff aún no está vinculado")).toHaveCount(0);
    await expect(staff.getByText("Por ahora no tienes eventos próximos")).toBeVisible();
  });

  test("[SET-014] cambiar el rol de una usuaria persiste y queda auditado", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("superadmin", "Usuarios › Rol: Staff → Fundadora");
    const t = await teamUser(db, "STAFF");
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    const row = usersList(page).getByRole("listitem").filter({ hasText: t.email });
    await (await ready(row.getByRole("button", { name: "Rol" }))).click();
    const dialog = page.getByRole("dialog", { name: "Cambiar rol" });
    await dialog.getByLabel("Nuevo rol").selectOption("OWNER");
    await dialog.getByRole("button", { name: "Guardar rol" }).click();
    await expect(toast(page, `${t.name} ahora es Fundadora`)).toBeVisible();
    await expect.poll(async () => (await db.user.findUnique({ where: { id: t.user.id } }))?.role).toBe("OWNER");
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "user.role_changed", entityId: t.user.id } });
    expect((a.before as { role: string }).role).toBe("STAFF");
    expect((a.after as { role: string }).role).toBe("OWNER");
    await page.reload();
    await expect(usersList(page).getByRole("listitem").filter({ hasText: t.email })).toContainText("Fundadora");
  });

  test("[SET-015] desactivar una cuenta impide el login; reactivarla lo devuelve (auditado)", { tag: ["@P0", "@critical", "@auth"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("superadmin", "Usuarios › Desactivar → login falla → Reactivar → login ok");
    const t = await teamUser(db, "OWNER");
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    const row = () => usersList(page).getByRole("listitem").filter({ hasText: t.email });
    await (await ready(row().getByRole("button", { name: "Desactivar" }))).click();
    await confirmAlert(page, "Desactivar", { toast: "Cuenta desactivada" });
    await expect.poll(async () => (await db.user.findUnique({ where: { id: t.user.id } }))?.active).toBe(false);
    expect(await auditCount(db, "user.deactivated", t.user.id)).toBe(1);
    await expect(row().getByText("Desactivada")).toBeVisible();
    const denied = await loginInFreshPage(anonPage, t.email, t.password);
    await expect(denied.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await row().getByRole("button", { name: "Reactivar" }).click();
    await confirmAlert(page, "Reactivar", { toast: "Cuenta reactivada" });
    await expect.poll(async () => (await db.user.findUnique({ where: { id: t.user.id } }))?.active).toBe(true);
    const ok = await loginInFreshPage(anonPage, t.email, t.password);
    await ok.waitForURL(/\/admin/);
  });

  test("[SET-016] restablecer la contraseña invalida la anterior y no guarda la contraseña en auditoría", { tag: ["@P1", "@auth"] }, async ({ rolePage, anonPage, db, evidence }) => {
    evidence("superadmin", "Usuarios › Contraseña → Restablecer");
    const t = await teamUser(db, "STAFF");
    const newPassword = tempPassword();
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    const row = usersList(page).getByRole("listitem").filter({ hasText: t.email });
    await (await ready(row.getByRole("button", { name: "Contraseña" }))).click();
    const dialog = page.getByRole("dialog", { name: "Restablecer contraseña" });
    await dialog.getByLabel("Contraseña temporal").fill(newPassword);
    await dialog.getByRole("button", { name: "Restablecer" }).click();
    await expect(toast(page, "Contraseña restablecida. Compártela por un canal seguro.")).toBeVisible();
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "user.password_reset", entityId: t.user.id } });
    const serialized = JSON.stringify([a.before, a.after]);
    expect(serialized).not.toContain(newPassword);
    expect(serialized).not.toMatch(/\$2[aby]\$/);
    const old = await loginInFreshPage(anonPage, t.email, t.password);
    await expect(old.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    const fresh = await loginInFreshPage(anonPage, t.email, newPassword);
    await fresh.waitForURL(/\/staff/);
  });

  test("[SET-017] no se crean cuentas duplicadas ni con contraseñas que contienen el correo", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("superadmin", "Nueva usuaria con correo existente / contraseña con el correo");
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    await (await ready(page.getByRole("button", { name: "Nueva usuaria" }))).click();
    const dialog = page.getByRole("dialog", { name: "Nueva usuaria del equipo" });
    await dialog.getByLabel("Nombre").fill("Duplicada E2E");
    await dialog.getByLabel("Correo").fill(ACCOUNTS.owner2.email);
    await dialog.getByLabel("Rol").selectOption("OWNER");
    await dialog.getByLabel("Contraseña temporal").fill(tempPassword());
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(toast(page, "Ya existe un usuario con ese correo.")).toBeVisible();
    const email = uniqEmail("contrasenamala");
    await dialog.getByLabel("Correo").fill(email);
    await dialog.getByLabel("Contraseña temporal").fill(`${email.split("@")[0]}123`);
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(toast(page, "La contraseña no debe contener el correo.")).toBeVisible();
    await dialog.getByLabel("Contraseña temporal").fill("corta1");
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(dialog.getByText("Mínimo 10 caracteres").first()).toBeVisible();
    // Conteos acotados a los datos de ESTA prueba: otras pruebas en paralelo crean usuarias (un conteo global es frágil).
    expect(await db.user.count({ where: { email: ACCOUNTS.owner2.email } }), "sin duplicado del correo existente").toBe(1);
    expect(await db.user.count({ where: { name: "Duplicada E2E" } }), "no se creó la cuenta duplicada").toBe(0);
    expect(await db.user.count({ where: { email } }), "no se creó la cuenta con contraseña inválida").toBe(0);
  });

  test("[SET-018] la propia cuenta no puede cambiar su rol ni desactivarse desde la lista", { tag: ["@P2"] }, async ({ rolePage, evidence }) => {
    evidence("superadmin", "Usuarios › fila «(tú)»");
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    const self = usersList(page).getByRole("listitem").filter({ hasText: "(tú)" });
    await expect(self).toContainText(ACCOUNTS.superadmin.email);
    await expect(self.getByRole("button", { name: "Contraseña" })).toBeVisible();
    await expect(self.getByRole("button", { name: "Rol" })).toHaveCount(0);
    await expect(self.getByRole("button", { name: "Desactivar" })).toHaveCount(0);
  });
});

test.describe("Ajustes · auditoría", { tag: ["@module:settings"] }, () => {
  test("[SET-019] las acciones sensibles aparecen en la bitácora con actor, diff y filtros", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("superadmin", "Restablecer contraseña → /admin/settings/audit?entityId=<user>");
    const t = await teamUser(db, "STAFF");
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/users");
    const row = usersList(page).getByRole("listitem").filter({ hasText: t.email });
    await (await ready(row.getByRole("button", { name: "Desactivar" }))).click();
    await confirmAlert(page, "Desactivar", { toast: "Cuenta desactivada" });
    await expect.poll(() => auditCount(db, "user.deactivated", t.user.id)).toBe(1);
    await page.goto(`/admin/settings/audit?entityId=${t.user.id}`);
    await expect(page.getByText("1 registro con los filtros aplicados")).toBeVisible();
    const entry = page.getByRole("listitem").filter({ hasText: "Cuenta desactivada" });
    await expect(entry).toContainText(ACCOUNTS.superadmin.name);
    await entry.getByText("Cuenta desactivada").click();
    await expect(entry.getByText("user.deactivated")).toBeVisible();
    await expect(entry.getByRole("table", { name: "Diferencias entre antes y después" })).toContainText("active");
    await page.goto(`/admin/settings/audit?action=user.deactivated&entityId=${t.user.id}`);
    await expect(page.getByText("1 registro con los filtros aplicados")).toBeVisible();
  });

  test("[SET-020] filtros inválidos de la bitácora se ignoran sin romper la página", { tag: ["@P3", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("superadmin", "/admin/settings/audit con parámetros basura");
    const page = await rolePage("superadmin");
    await page.goto("/admin/settings/audit?from=2026-99-99&to=nada&action=%3Cscript%3Ealert(1)%3C%2Fscript%3E&actor=x");
    await expect(page.getByRole("heading", { level: 2, name: "Auditoría" })).toBeVisible();
    await expect(page.getByText(/\d+ registros?$/).first()).toBeVisible();
    await expect(page.getByText("con los filtros aplicados")).toHaveCount(0);
  });
});
