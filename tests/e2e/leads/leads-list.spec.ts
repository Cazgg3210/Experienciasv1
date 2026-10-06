/**
 * Paquete 3 · Leads — listado, resumen por estado, búsqueda, filtros, paginación, orden, kanban y CSV.
 * Cada prueba crea sus propios leads con un prefijo único y filtra por él (independiente del seed y
 * de las demás pruebas que corren en paralelo).
 */
import type { PrismaClient, LeadStatus, LeadSource } from "@prisma/client";
import { createCustomer, expect, test, uniq } from "../fixtures";
import { e2eCode, escapeRe, followLink, gotoReady, parseCsv } from "../quotes/_helpers";
import { LEAD_CSV_HEADERS } from "../../../src/features/leads/domain/lead-export";

async function seedLeads(
  db: PrismaClient,
  prefix: string,
  specs: Array<{
    suffix: string;
    status?: LeadStatus;
    source?: LeadSource;
    outOfArea?: boolean;
    specialRequest?: boolean;
    eventDate?: Date | null;
    createdAt?: Date;
    phone?: string;
    lostReason?: string;
  }>,
) {
  const customer = await createCustomer(db, { name: `${prefix} Clienta` });
  const out = [];
  for (const s of specs) {
    out.push(
      await db.lead.create({
        data: {
          code: e2eCode("L"),
          name: `${prefix} ${s.suffix}`,
          email: `${prefix.toLowerCase()}-${s.suffix.toLowerCase().replace(/\W+/g, "")}@e2e.ivonne-rosa.test`,
          phone: s.phone ?? null,
          occasion: "BIRTHDAY",
          status: s.status ?? "NEW",
          source: s.source ?? "MANUAL",
          outOfArea: s.outOfArea ?? false,
          specialRequest: s.specialRequest ?? false,
          eventDate: s.eventDate ?? null,
          guestCount: 8,
          lostReason: s.lostReason ?? (s.status === "LOST" ? "Fuera de presupuesto" : null),
          customerId: customer.id,
          ...(s.createdAt ? { createdAt: s.createdAt } : {}),
        },
      }),
    );
  }
  return out;
}

const summaryChip = (page: import("@playwright/test").Page, label: string, n: number) =>
  page
    .getByRole("navigation", { name: "Leads por estado" })
    .getByRole("link", { name: new RegExp(`^\\s*${escapeRe(label)}\\s*${n}\\s*$`) });

test.describe("Leads · listado y búsqueda", { tag: ["@module:leads"] }, () => {
  test("[LEAD-001] el resumen por estado y la tabla reflejan exactamente lo que hay en la base", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › resumen por estado + tabla filtrada por prefijo");
    const prefix = uniq("LeadRes");
    await seedLeads(db, prefix, [
      { suffix: "Uno", status: "NEW" },
      { suffix: "Dos", status: "NEW" },
      { suffix: "Tres", status: "CONTACTED" },
      { suffix: "Cuatro", status: "LOST" },
    ]);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    await expect(summaryChip(page, "Todos", 4)).toBeVisible();
    await expect(summaryChip(page, "Nuevo", 2)).toBeVisible();
    await expect(summaryChip(page, "Contactado", 1)).toBeVisible();
    await expect(summaryChip(page, "Perdido", 1)).toBeVisible();
    await expect(summaryChip(page, "Ganado", 0)).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(5); // encabezado + 4
    for (const s of ["Uno", "Dos", "Tres", "Cuatro"]) {
      await expect(table.getByRole("link", { name: `${prefix} ${s}` })).toBeVisible();
    }
    // Base: mismos conteos
    const counts = await db.lead.groupBy({ by: ["status"], where: { name: { startsWith: prefix } }, _count: { _all: true } });
    expect(Object.fromEntries(counts.map((c) => [c.status, c._count._all]))).toEqual({ NEW: 2, CONTACTED: 1, LOST: 1 });
  });

  test("[LEAD-008] la búsqueda encuentra por nombre, correo, código y teléfono con formato", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › buscar por nombre / email / código / teléfono");
    const prefix = uniq("LeadBus");
    const phone = `55${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const [lead] = await seedLeads(db, prefix, [{ suffix: "Buscada", phone }]);
    const page = await rolePage("owner");
    const search = async (q: string) => {
      await gotoReady(page, "/admin/leads");
      await page.getByRole("searchbox", { name: "Buscar leads" }).fill(q);
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("q") === q);
      await expect(page.getByRole("table").getByRole("link", { name: lead!.name })).toBeVisible();
    };
    await search(prefix.toLowerCase()); // insensible a mayúsculas
    await search(lead!.email!);
    await search(lead!.code);
    await search(`${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`); // "55 1234 5678"
  });

  test("[LEAD-009] filtros por estado, origen y señales; estado vacío con búsqueda sin coincidencias", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Filtros (estado, origen, fuera de cobertura) › Limpiar filtros");
    const prefix = uniq("LeadFil");
    await seedLeads(db, prefix, [
      { suffix: "Perdida Insta", status: "LOST", source: "INSTAGRAM", outOfArea: true },
      { suffix: "Nueva Manual", status: "NEW", source: "MANUAL" },
      { suffix: "Calificada Insta", status: "QUALIFIED", source: "INSTAGRAM" },
    ]);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}`);
    const form = page.getByRole("search", { name: "Buscar y filtrar leads" });
    await form.getByText("Filtros", { exact: true }).click();
    await form.getByRole("checkbox", { name: "Perdido" }).check();
    await form.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.waitForURL((u) => u.searchParams.getAll("status").includes("LOST"));
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("link", { name: `${prefix} Perdida Insta` })).toBeVisible();

    // Origen (vía URL compartible) + señal "fuera de cobertura"
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}&source=INSTAGRAM`);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}&source=INSTAGRAM&flag=outOfArea`);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("table").getByText("Fuera de cobertura")).toBeVisible();

    // Limpiar filtros vuelve al listado completo
    expect(await followLink(page, form.getByRole("link", { name: "Limpiar filtros" }))).toBe("/admin/leads");
    await expect(page.getByRole("searchbox", { name: "Buscar leads" })).toHaveValue("");

    // Sin coincidencias
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(`${prefix}-NOEXISTE`)}`);
    await expect(page.getByRole("heading", { name: "Ningún lead coincide" })).toBeVisible();
    await expect(summaryChip(page, "Todos", 0)).toBeVisible();
  });

  test("[LEAD-010] filtro por rango de fecha del evento (incluye extremos y corrige rango invertido)", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Rango de fechas (fecha del evento)");
    const prefix = uniq("LeadFecha");
    const { dateOnly } = await import("../../../src/lib/dates");
    await seedLeads(db, prefix, [
      { suffix: "Marzo", eventDate: dateOnly("2027-03-10") },
      { suffix: "FinMarzo", eventDate: dateOnly("2027-03-31") },
      { suffix: "Mayo", eventDate: dateOnly("2027-05-20") },
      { suffix: "SinFecha", eventDate: null },
    ]);
    const page = await rolePage("owner");
    const q = encodeURIComponent(prefix);
    await gotoReady(page, `/admin/leads?q=${q}&dateField=event&from=2027-03-01&to=2027-03-31`);
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(3);
    await expect(table.getByRole("link", { name: `${prefix} Marzo` })).toBeVisible();
    await expect(table.getByRole("link", { name: `${prefix} FinMarzo` })).toBeVisible();
    // Rango invertido: el servidor lo corrige (mismo resultado)
    await gotoReady(page, `/admin/leads?q=${q}&dateField=event&from=2027-03-31&to=2027-03-01`);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
  });

  test("[LEAD-011] paginación de 25 en 25 conservando la búsqueda", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Paginación (26 resultados)");
    const prefix = uniq("LeadPag");
    const base = Date.now() - 3_600_000;
    await db.lead.createMany({
      data: Array.from({ length: 26 }, (_, i) => ({
        code: e2eCode("L"),
        name: `${prefix} ${String(i + 1).padStart(2, "0")}`,
        email: `${prefix.toLowerCase()}-${i}@e2e.ivonne-rosa.test`,
        occasion: "BIRTHDAY" as const,
        status: "NEW" as const,
        source: "MANUAL" as const,
        createdAt: new Date(base + i * 1000),
      })),
    });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}`);
    const pager = page.getByRole("navigation", { name: "Paginación" });
    await expect(pager.getByText("1–25 de 26")).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(26);
    // created_desc: el más reciente (26) primero
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText(`${prefix} 26`);
    const next = new URL(await followLink(page, pager.getByRole("link", { name: /Siguiente/ })), "http://x");
    expect(next.searchParams.get("page")).toBe("2");
    expect(next.searchParams.get("q")).toBe(prefix);
    await expect(pager.getByText("26–26 de 26")).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText(`${prefix} 01`);
    // Página fuera de rango: el servidor la limita a la última
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}&page=99`);
    await expect(pager.getByText("26–26 de 26")).toBeVisible();
  });

  test("[LEAD-012] orden por creación ascendente y por fecha del evento", { tag: ["@P3"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Orden");
    const prefix = uniq("LeadOrd");
    const { dateOnly } = await import("../../../src/lib/dates");
    const t0 = Date.now() - 7_200_000;
    await seedLeads(db, prefix, [
      { suffix: "Primera", createdAt: new Date(t0), eventDate: dateOnly("2027-08-01") },
      { suffix: "Segunda", createdAt: new Date(t0 + 60_000), eventDate: dateOnly("2027-02-01") },
      { suffix: "Tercera", createdAt: new Date(t0 + 120_000), eventDate: null },
    ]);
    const page = await rolePage("owner");
    const rows = page.getByRole("table").getByRole("row");
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}&sort=created_asc`);
    await expect(rows.nth(1)).toContainText(`${prefix} Primera`);
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}&sort=event_asc`);
    await expect(rows.nth(1)).toContainText(`${prefix} Segunda`);
    await expect(rows.nth(3)).toContainText(`${prefix} Tercera`); // sin fecha al final
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}`);
    await expect(rows.nth(1)).toContainText(`${prefix} Tercera`); // default: más recientes
  });
});

test.describe("Leads · navegación del cliente", { tag: ["@module:leads"] }, () => {
  test("[LEAD-037] 'Siguiente' y 'Limpiar filtros' navegan con un clic (misma ruta, otros searchParams)", { tag: ["@P2", "@regression"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › clic en Siguiente (paginación) y en Limpiar filtros del estado vacío");
    test.info().annotations.push({ type: "bug", description: "COM-BUG-03" });
    const prefix = uniq("LeadNav");
    await db.lead.createMany({
      data: Array.from({ length: 26 }, (_, i) => ({
        code: e2eCode("L"),
        name: `${prefix} ${String(i + 1).padStart(2, "0")}`,
        email: `${prefix.toLowerCase()}-${i}@e2e.ivonne-rosa.test`,
        occasion: "BIRTHDAY" as const,
        status: "NEW" as const,
        source: "MANUAL" as const,
      })),
    });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(prefix)}`);
    await page.getByRole("navigation", { name: "Paginación" }).getByRole("link", { name: /Siguiente/ }).click();
    await expect(page, "el clic en 'Siguiente' debe llevar a la página 2").toHaveURL(/[?&]page=2/, { timeout: 15_000 });
    await expect(page.getByRole("navigation", { name: "Paginación" }).getByText("26–26 de 26")).toBeVisible();

    await gotoReady(page, `/admin/leads?q=${encodeURIComponent(`${prefix}-NOEXISTE`)}`);
    await expect(page.getByRole("heading", { name: "Ningún lead coincide" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Limpiar filtros" }).last().click();
    await expect(page, "el clic en 'Limpiar filtros' debe quitar la búsqueda").toHaveURL(/\/admin\/leads$/, { timeout: 15_000 });
  });
});

test.describe("Leads · kanban", { tag: ["@module:leads"] }, () => {
  test("[LEAD-013] kanban: mover una tarjeta respeta la máquina de estados y persiste", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Kanban › Mover › Contactado");
    const prefix = uniq("LeadKan");
    const [lead] = await seedLeads(db, prefix, [{ suffix: "Tarjeta", status: "NEW" }]);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads?view=kanban&q=${encodeURIComponent(prefix)}`);
    const newCol = page.getByRole("region", { name: "Nuevo", exact: true });
    await expect(newCol.getByRole("link", { name: lead!.name })).toBeVisible();
    await newCol.getByRole("button", { name: `Mover ${lead!.name} a otro estado` }).click();
    const menu = page.getByRole("menu");
    // Sólo transiciones válidas desde NEW
    await expect(menu.getByRole("menuitem")).toHaveText(["Contactado", "Calificado", "Cotizado", "Perdido"]);
    await menu.getByRole("menuitem", { name: "Contactado" }).click();
    await expect(page.getByText(`${lead!.name}: Contactado`)).toBeVisible();
    await expect(page.getByRole("region", { name: "Contactado", exact: true }).getByRole("link", { name: lead!.name })).toBeVisible();
    await expect.poll(async () => (await db.lead.findUnique({ where: { id: lead!.id } }))?.status).toBe("CONTACTED");
    const act = await db.leadActivity.findFirst({ where: { leadId: lead!.id, type: "STATUS_CHANGE" } });
    expect(act).toMatchObject({ fromStatus: "NEW", toStatus: "CONTACTED" });
    await page.reload();
    await expect(page.getByRole("region", { name: "Contactado", exact: true }).getByRole("link", { name: lead!.name })).toBeVisible();
  });

  test("[LEAD-014] kanban: pasar a Perdido exige motivo (diálogo) y lo guarda", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Leads › Kanban › Mover › Perdido › motivo");
    const prefix = uniq("LeadKanL");
    const [lead] = await seedLeads(db, prefix, [{ suffix: "Perdible", status: "QUALIFIED" }]);
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads?view=kanban&q=${encodeURIComponent(prefix)}`);
    await page.getByRole("button", { name: `Mover ${lead!.name} a otro estado` }).click();
    await page.getByRole("menuitem", { name: "Perdido" }).click();
    const dialog = page.getByRole("dialog", { name: "Marcar como perdido" });
    await dialog.getByRole("button", { name: "Marcar como perdido" }).click();
    await expect(dialog.getByText("Cuéntanos por qué se perdió")).toBeVisible();
    expect((await db.lead.findUnique({ where: { id: lead!.id } }))?.status).toBe("QUALIFIED");
    await dialog.getByRole("button", { name: "Eligió otra opción" }).click();
    await dialog.getByRole("button", { name: "Marcar como perdido" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await db.lead.findUnique({ where: { id: lead!.id } }))?.status).toBe("LOST");
    expect((await db.lead.findUnique({ where: { id: lead!.id } }))?.lostReason).toBe("Eligió otra opción");
    await expect(page.getByRole("region", { name: "Perdido", exact: true }).getByRole("link", { name: lead!.name })).toBeVisible();
  });
});

test.describe("Leads · exportación CSV", { tag: ["@module:leads"] }, () => {
  test("[LEAD-028] el CSV trae encabezados, BOM y exactamente los leads filtrados, y queda auditado", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "GET /api/admin/leads-export?q=<prefijo>");
    const prefix = uniq("LeadCsv");
    const leads = await seedLeads(db, prefix, [
      { suffix: "Alfa", status: "NEW" },
      { suffix: "Beta", status: "LOST", lostReason: "Sin respuesta" },
    ]);
    const api = await apiAs("owner");
    const res = await api.get(`/api/admin/leads-export?q=${encodeURIComponent(prefix)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"/);
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xfeff);
    const rows = parseCsv(body);
    expect(rows[0]).toEqual(LEAD_CSV_HEADERS);
    const data = rows.slice(1).filter((r) => r.length > 1);
    expect(data).toHaveLength(2);
    const byCode = Object.fromEntries(data.map((r) => [r[0], r]));
    const beta = byCode[leads[1]!.code]!;
    expect(beta[1]).toBe(`${prefix} Beta`);
    expect(beta[10]).toBe("Perdido");
    expect(beta[11]).toBe("Captura manual");
    expect(beta[16]).toBe("Sin respuesta");
    expect(byCode[leads[0]!.code]![10]).toBe("Nuevo");
    const audit = await db.auditLog.findFirst({
      where: { action: "leads.exported", actorEmail: "ivonne@ivonne-rosa.test" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.after).toMatchObject({ count: 2, filters: { q: prefix } });
  });

  test("[LEAD-029] el CSV respeta filtros de estado y señales", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "GET /api/admin/leads-export?q=&status=&flag=");
    const prefix = uniq("LeadCsvF");
    const leads = await seedLeads(db, prefix, [
      { suffix: "Lost Out", status: "LOST", outOfArea: true },
      { suffix: "Lost In", status: "LOST" },
      { suffix: "New Out", status: "NEW", outOfArea: true },
    ]);
    const api = await apiAs("owner");
    const codes = async (qs: string) => {
      const res = await api.get(`/api/admin/leads-export?q=${encodeURIComponent(prefix)}${qs}`);
      expect(res.status()).toBe(200);
      return parseCsv(await res.text())
        .slice(1)
        .filter((r) => r.length > 1)
        .map((r) => r[0])
        .sort();
    };
    expect(await codes("&status=LOST")).toEqual([leads[0]!.code, leads[1]!.code].sort());
    expect(await codes("&flag=outOfArea")).toEqual([leads[0]!.code, leads[2]!.code].sort());
    expect(await codes("&status=LOST&flag=outOfArea")).toEqual([leads[0]!.code]);
    expect(await codes("&status=WON")).toEqual([]);
  });

  test("[LEAD-030] el CSV neutraliza inyección de fórmulas (=, +, -, @)", { tag: ["@P2", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "GET /api/admin/leads-export con nombre '=HYPERLINK(...)'");
    const prefix = uniq("LeadInj");
    const customer = await createCustomer(db);
    const lead = await db.lead.create({
      data: {
        code: e2eCode("L"),
        name: `=HYPERLINK("http://evil.example","x") ${prefix}`,
        phone: "+525512345678",
        email: `${prefix.toLowerCase()}@e2e.ivonne-rosa.test`,
        occasion: "OTHER",
        occasionOther: "@SUM(1+1)",
        status: "NEW",
        source: "MANUAL",
        customerId: customer.id,
      },
    });
    const api = await apiAs("owner");
    const rows = parseCsv(await (await api.get(`/api/admin/leads-export?q=${encodeURIComponent(prefix)}`)).text());
    const row = rows.find((r) => r[0] === lead.code)!;
    expect(row, "el lead aparece en el CSV").toBeTruthy();
    expect(row[1]).toBe(`'=HYPERLINK("http://evil.example","x") ${prefix}`);
    // Teléfono con "+" también se antepone con apóstrofo (protección; ver observación en findings)
    expect(row[2]).toBe("'+525512345678");
    test.info().annotations.push({ type: "observación", description: "Teléfonos con + salen como '+52… en el CSV (anti-inyección)." });
  });

  test("[LEAD-031] el botón Exportar CSV conserva los filtros activos", { tag: ["@P3"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Leads › Exportar CSV con filtros");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/leads?q=zzz-e2e&status=LOST&flag=special&sort=created_asc");
    const link = page.getByRole("link", { name: "Exportar CSV" });
    const href = await link.getAttribute("href");
    const u = new URL(href!, "http://x");
    expect(u.pathname).toBe("/api/admin/leads-export");
    expect(u.searchParams.get("q")).toBe("zzz-e2e");
    expect(u.searchParams.getAll("status")).toEqual(["LOST"]);
    expect(u.searchParams.getAll("flag")).toEqual(["special"]);
    expect(u.searchParams.get("sort")).toBe("created_asc");
  });
});
