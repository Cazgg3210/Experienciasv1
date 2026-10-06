/**
 * Paquete 3 · Clientas — listado, búsqueda, orden, paginación, ficha (historial), edición de perfil,
 * unicidad de correo, teléfono, eliminación con y sin historial comercial, auditoría.
 * El seed DEMO sólo se lee (Sofía Navarro); las mutaciones usan clientas propias con nombres únicos.
 */
import { ACCOUNTS, createCustomer, createLead, expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { callAction, createQuoteViaAction, followLink, gotoReady } from "../quotes/_helpers";

test.describe("Clientas · listado y búsqueda", { tag: ["@module:customers"] }, () => {
  test("[CUST-001] el listado filtrado muestra el conteo y las filas que hay en la base", { tag: ["@P1", "@smoke"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › buscar por prefijo");
    const prefix = uniq("CliList");
    for (const s of ["Ana", "Bea", "Caro"]) await createCustomer(db, { name: `${prefix} ${s}` });
    const lead = await createLead(db, { name: `${prefix} Lead` });
    await db.lead.update({ where: { id: lead.id }, data: { customerId: (await db.customer.findFirstOrThrow({ where: { name: `${prefix} Ana` } })).id } });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers?q=${encodeURIComponent(prefix)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
    await expect(page.getByText(`3 clientas para “${prefix}”`)).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(4);
    const ana = table.getByRole("row", { name: new RegExp(`${prefix} Ana`) });
    await expect(ana.getByRole("cell").nth(3)).toHaveText("1"); // Leads
    await expect(ana.getByRole("cell").nth(4)).toHaveText("0"); // Eventos
    expect(await db.customer.count({ where: { name: { startsWith: prefix } } })).toBe(3);
  });

  test("[CUST-002] búsqueda por nombre, correo, teléfono, Instagram y código de referido; sin coincidencias", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Buscar");
    const name = uniq("CliBus");
    const phone = uniqPhone();
    const c = await createCustomer(db, { name, phone, instagram: `ig_${name.toLowerCase().replace(/\W/g, "")}` });
    const page = await rolePage("owner");
    const search = async (q: string) => {
      await gotoReady(page, "/admin/customers");
      await page.getByRole("searchbox", { name: "Buscar clientas" }).fill(q);
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("q") === q);
      await expect(page.getByRole("table").getByRole("link", { name })).toBeVisible();
    };
    await search(name.toUpperCase());
    await search(c.email!);
    await search(`${phone.slice(0, 2)} ${phone.slice(2, 6)}-${phone.slice(6)}`);
    await search(`@${c.instagram}`);
    await search(c.referralCode);
    await gotoReady(page, `/admin/customers?q=${encodeURIComponent(`${name}-NOEXISTE`)}`);
    await expect(page.getByRole("heading", { name: "Sin coincidencias" })).toBeVisible();
    expect(await followLink(page, page.getByRole("link", { name: "Ver todas" }))).toBe("/admin/customers");
    await expect(page.getByRole("searchbox", { name: "Buscar clientas" })).toHaveValue("");
  });

  test("[CUST-003] orden por nombre (A–Z) y por más recientes", { tag: ["@P3"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Orden");
    const prefix = uniq("CliOrd");
    await createCustomer(db, { name: `${prefix} Zoe` });
    await createCustomer(db, { name: `${prefix} Ale` });
    await createCustomer(db, { name: `${prefix} Mia` });
    const page = await rolePage("owner");
    const rows = page.getByRole("table").getByRole("row");
    await gotoReady(page, `/admin/customers?q=${encodeURIComponent(prefix)}&sort=name`);
    await expect(rows.nth(1)).toContainText(`${prefix} Ale`);
    await expect(rows.nth(3)).toContainText(`${prefix} Zoe`);
    await gotoReady(page, `/admin/customers?q=${encodeURIComponent(prefix)}`);
    await expect(rows.nth(1)).toContainText(`${prefix} Mia`); // la más reciente
  });

  test("[CUST-004] paginación de clientas conservando búsqueda", { tag: ["@P3"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Paginación (27)");
    const prefix = uniq("CliPag");
    await db.customer.createMany({
      data: Array.from({ length: 27 }, (_, i) => ({
        name: `${prefix} ${String(i + 1).padStart(2, "0")}`,
        email: `${prefix.toLowerCase()}-${i}@e2e.ivonne-rosa.test`,
        referralCode: `IR-${prefix.slice(-6).toUpperCase()}-${i}`,
        source: "MANUAL" as const,
      })),
    });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers?q=${encodeURIComponent(prefix)}`);
    const pager = page.getByRole("navigation", { name: "Paginación" });
    await expect(pager.getByText("1–25 de 27")).toBeVisible();
    const next = new URL(await followLink(page, pager.getByRole("link", { name: /Siguiente/ })), "http://x");
    expect(next.searchParams.get("page")).toBe("2");
    expect(next.searchParams.get("q")).toBe(prefix);
    await expect(pager.getByText("26–27 de 27")).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
  });
});

test.describe("Clientas · ficha y edición", { tag: ["@module:customers"] }, () => {
  test("[CUST-005] la ficha muestra historial de leads, cotizaciones, eventos y pagos de la clienta (seed)", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Sofía Navarro (sólo lectura)");
    const sofia = await db.customer.findFirstOrThrow({
      where: { email: "sofia.navarro@example.com" },
      include: { leads: true, quotes: true, events: true, _count: { select: { leads: true, events: true } } },
    });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${sofia.id}`);
    await expect(page.getByRole("heading", { level: 1, name: sofia.name })).toBeVisible();
    await expect(page.getByText(sofia.referralCode)).toBeVisible();
    await expect(page.getByText("$15,775").first()).toBeVisible(); // anticipo pagado (1,577,500 centavos)
    await expect(page.getByRole("tab", { name: /Leads\s*1/ })).toBeVisible();
    await expect(page.getByRole("link", { name: sofia.leads[0]!.code })).toHaveAttribute("href", `/admin/leads/${sofia.leads[0]!.id}`);
    await page.getByRole("tab", { name: /Cotizaciones/ }).click();
    await expect(page.getByRole("link", { name: sofia.quotes[0]!.code })).toBeVisible();
    await page.getByRole("tab", { name: /Eventos/ }).click();
    await expect(page.getByRole("link", { name: sofia.events[0]!.title })).toBeVisible();
    await page.getByRole("tab", { name: /Pagos/ }).click();
    await expect(page.getByRole("tabpanel").getByText("$15,775")).toBeVisible();
    // Bloqueos de eliminación (no se ofrece Eliminar)
    await expect(page.getByRole("heading", { name: "No se puede eliminar" })).toBeVisible();
    await expect(page.getByText("Tiene 1 cotización.")).toBeVisible();
    await expect(page.getByText("Tiene 1 reserva con historial de pagos.")).toBeVisible();
    await expect(page.getByText("Tiene 1 evento.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  });

  test("[CUST-006] editar perfil normaliza Instagram/correo, guarda y audita antes/después", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Perfil › Guardar perfil");
    const c = await createCustomer(db, { name: uniq("Perfil") });
    const newName = uniq("Perfil Editado");
    const newEmail = uniqEmail("perfil");
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${c.id}`);
    const save = page.getByRole("button", { name: "Guardar perfil" });
    await expect(save).toBeDisabled();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(newName);
    await page.getByRole("textbox", { name: "Email" }).fill(`  ${newEmail.toUpperCase()} `);
    await page.getByRole("textbox", { name: "WhatsApp" }).fill("+52 55 1111 2222");
    await page.getByRole("textbox", { name: "Instagram" }).fill("https://instagram.com/sofi.brunch/");
    await page.getByRole("textbox", { name: "Notas internas" }).fill("Alérgica a nueces.");
    await page.getByRole("switch", { name: "Acepta novedades y promociones" }).click();
    await save.click();
    await expect(page.getByText("Perfil actualizado")).toBeVisible();
    const after = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({
      name: newName,
      email: newEmail.toLowerCase(),
      whatsapp: "+525511112222", // forma canónica única del teléfono (BUG-008)
      instagram: "sofi.brunch",
      notes: "Alérgica a nueces.",
      marketingOptIn: true,
    });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Customer", entityId: c.id, action: "customer.updated" } });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner.email);
    expect(audit.before).toMatchObject({ name: c.name, email: c.email, whatsapp: null, instagram: null, marketingOptIn: false });
    expect(audit.after).toMatchObject({ name: newName, whatsapp: "+525511112222", instagram: "sofi.brunch", marketingOptIn: true });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Instagram" })).toHaveValue("@sofi.brunch");
    await expect(page.getByRole("switch", { name: "Acepta novedades y promociones" })).toBeChecked();
  });

  test("[CUST-007] no se permite usar el correo de otra clienta (aunque cambie mayúsculas)", { tag: ["@P1", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Perfil › email duplicado");
    const a = await createCustomer(db, { name: uniq("Dueña Correo") });
    const b = await createCustomer(db, { name: uniq("Intrusa Correo") });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${b.id}`);
    await page.getByRole("textbox", { name: "Email" }).fill(a.email!.toUpperCase());
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    const msg = "Ese correo ya pertenece a otra clienta. Revisa si es un registro duplicado.";
    await expect(page.getByRole("alert").filter({ hasText: msg })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
    expect((await db.customer.findUniqueOrThrow({ where: { id: b.id } })).email).toBe(b.email);
    expect(await db.auditLog.count({ where: { entityId: b.id, action: "customer.updated" } })).toBe(0);
  });

  test("[CUST-008] validaciones del perfil en el formulario (correo, teléfono, Instagram)", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Perfil › datos inválidos");
    const c = await createCustomer(db, { name: uniq("Valida Perfil") });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${c.id}`);
    await page.getByRole("textbox", { name: "Email" }).fill("correo-malo");
    await page.getByRole("textbox", { name: "Teléfono" }).fill("123");
    await page.getByRole("textbox", { name: "Instagram" }).fill("usuario con espacios!");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("A");
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByText("Escribe un correo válido")).toBeVisible();
    await expect(page.getByText("Escribe un número de 10 dígitos (puedes incluir lada +52)")).toBeVisible();
    await expect(page.getByText("Escribe el usuario de Instagram (p. ej. @sofi.brunch)")).toBeVisible();
    await expect(page.getByText("Escribe el nombre")).toBeVisible();
    expect(await db.customer.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ name: c.name, email: c.email });
  });

  test("[CUST-015] el servidor valida el perfil aunque se salte el formulario", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "updateCustomerAction directa con datos inválidos");
    const c = await createCustomer(db, { name: uniq("Backend Perfil") });
    const api = await apiAs("owner");
    const base = { customerId: c.id, name: c.name, email: c.email!, phone: c.phone!, whatsapp: "", instagram: "", notes: "", marketingOptIn: false };
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...base, name: "A" }, "name"],
      [{ ...base, email: "x@y" }, "email"],
      [{ ...base, phone: "12-34" }, "phone"],
      [{ ...base, instagram: "<script>" }, "instagram"],
      [{ ...base, notes: "x".repeat(4001) }, "notes"],
      [{ ...base, marketingOptIn: "sí" }, "marketingOptIn"],
    ];
    for (const [payload, field] of cases) {
      const r = await callAction(api, "customers", "updateCustomerAction", payload, { params: { id: c.id } });
      expect(r.result?.ok, field).toBe(false);
      if (r.result && !r.result.ok) expect(Object.keys(r.result.fieldErrors ?? {}), field).toContain(field);
    }
    const nf = await callAction(api, "customers", "updateCustomerAction", { ...base, customerId: "ckzzzzzzzzzzzzzzzzzzzzzz" }, { params: { id: c.id } });
    expect(nf.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.customer.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ name: c.name, email: c.email, phone: c.phone });
  });

  test("[CUST-009] dos clientas pueden compartir teléfono: no hay validación de unicidad (ambigüedad de requisito)", { tag: ["@P3"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "updateCustomerAction con el teléfono de otra clienta");
    test.info().annotations.push({ type: "requirement-ambiguity", description: "Sólo el correo es único (schema + servicio). El teléfono no; ver findings." });
    // Teléfono en la forma canónica con que la app guarda (BUG-008): b recibe el mismo número.
    const a = await createCustomer(db, { name: uniq("Tel A"), phone: `+52${uniqPhone()}` });
    const b = await createCustomer(db, { name: uniq("Tel B") });
    const r = await callAction(await apiAs("owner"), "customers", "updateCustomerAction", {
      customerId: b.id, name: b.name, email: b.email!, phone: a.phone!, whatsapp: "", instagram: "", notes: "", marketingOptIn: false,
    }, { params: { id: b.id } });
    expect(r.result?.ok).toBe(true);
    expect(await db.customer.count({ where: { phone: a.phone } })).toBe(2);
  });

  test("[CUST-016] una clienta con teléfono guardado con formato se reutiliza al llegar un lead con ese número", { tag: ["@P2", "@regression"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Perfil: teléfono '55 1234 5678' → createLeadAction phone '5512345678'");
    test.info().annotations.push({ type: "regression", description: "BUG-008" });
    const c = await createCustomer(db, { name: uniq("Tel Formato"), phone: null as never });
    const phone = uniqPhone();
    const formatted = `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${c.id}`);
    await page.getByRole("textbox", { name: "Teléfono" }).fill(formatted);
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByText("Perfil actualizado")).toBeVisible();
    const stored = (await db.customer.findUniqueOrThrow({ where: { id: c.id } })).phone;
    test.info().annotations.push({ type: "teléfono guardado", description: String(stored) });
    const r = await callAction<{ leadId: string }>(await apiAs("owner"), "leads", "createLeadAction", {
      name: uniq("Lead mismo tel"),
      phone, // mismo número, sin espacios
      occasion: "BIRTHDAY",
    });
    expect(r.result?.ok).toBe(true);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: r.result!.ok ? r.result!.data.leadId : "" } });
    expect(lead.customerId, "el lead debe vincularse a la clienta existente (no duplicarla)").toBe(c.id);
  });
});

test.describe("Clientas · eliminación", { tag: ["@module:customers"] }, () => {
  test("[CUST-010] eliminar clienta sin historial comercial: sus leads quedan sin clienta, auditado y no reaparece", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Ficha › Eliminar › Eliminar clienta");
    const c = await createCustomer(db, { name: uniq("Borrable") });
    const lead = await createLead(db, { name: uniq("Lead de Borrable"), customerId: c.id, email: c.email, phone: c.phone });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${c.id}`);
    await page.getByRole("button", { name: "Eliminar" }).click();
    const dialog = page.getByRole("alertdialog", { name: `¿Eliminar a ${c.name}?` });
    await expect(dialog).toContainText("Su lead se conserva sin clienta vinculada. Esta acción no se puede deshacer.");
    await dialog.getByRole("button", { name: "Eliminar clienta" }).click();
    await expect(page.getByText("Clienta eliminada")).toBeVisible();
    await page.waitForURL(/\/admin\/customers$/);
    expect(await db.customer.findUnique({ where: { id: c.id } })).toBeNull();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).customerId).toBeNull();
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Customer", entityId: c.id, action: "customer.deleted" } });
    expect(audit.before).toMatchObject({ name: c.name, email: c.email, leads: 1 });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner.email);
    await gotoReady(page, `/admin/customers?q=${encodeURIComponent(c.name)}`);
    await expect(page.getByRole("heading", { name: "Sin coincidencias" })).toBeVisible();
    await gotoReady(page, `/admin/customers/${c.id}`);
    await expect(page.getByRole("heading", { name: "No encontramos a esta clienta" })).toBeVisible();
    // El lead sigue existiendo y su detalle ya no muestra la clienta
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await expect(page.getByRole("heading", { level: 1, name: lead.name })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver ficha de la clienta/ })).toHaveCount(0);
  });

  test("[CUST-014] cancelar la eliminación no borra nada", { tag: ["@P2"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Clientes › Eliminar › Cancelar");
    const c = await createCustomer(db, { name: uniq("No Borrar") });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${c.id}`);
    await page.getByRole("button", { name: "Eliminar" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Se eliminará su ficha. Esta acción no se puede deshacer.");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    expect(await db.customer.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  test("[CUST-011] una clienta con cotización no se puede eliminar (UI oculta el botón y el backend lo rechaza)", { tag: ["@P1", "@negative"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Clientes › Ficha con cotización · deleteCustomerAction directa");
    const c = await createCustomer(db, { name: uniq("Con Cotizacion") });
    const api = await apiAs("owner");
    await createQuoteViaAction(api, db, { customerId: c.id });
    const page = await rolePage("owner");
    await gotoReady(page, `/admin/customers/${c.id}`);
    await expect(page.getByRole("heading", { name: "No se puede eliminar" })).toBeVisible();
    await expect(page.getByText("Tiene 1 cotización.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
    const r = await callAction(api, "customers", "deleteCustomerAction", { customerId: c.id }, { params: { id: c.id } });
    expect(r.result).toMatchObject({ ok: false, code: "CONFLICT", error: `No se puede eliminar a ${c.name}: Tiene 1 cotización.` });
    expect(await db.customer.findUnique({ where: { id: c.id } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: c.id, action: "customer.deleted" } })).toBe(0);
  });

  test("[CUST-012] una clienta con reserva y evento (seed) no se puede eliminar desde el backend", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("superadmin", "deleteCustomerAction sobre Sofía Navarro (seed)");
    const sofia = await db.customer.findFirstOrThrow({ where: { email: "sofia.navarro@example.com" } });
    const r = await callAction(await apiAs("superadmin"), "customers", "deleteCustomerAction", { customerId: sofia.id }, { params: { id: sofia.id } });
    expect(r.result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      error: `No se puede eliminar a ${sofia.name}: Tiene 1 cotización. Tiene 1 reserva con historial de pagos. Tiene 1 evento.`,
    });
    expect(await db.customer.findUnique({ where: { id: sofia.id } })).not.toBeNull();
    const nf = await callAction(await apiAs("superadmin"), "customers", "deleteCustomerAction", { customerId: "ckzzzzzzzzzzzzzzzzzzzzzz" }, { params: { id: sofia.id } });
    expect(nf.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  test("[CUST-013] ficha inexistente o con id malformado muestra 'No encontramos a esta clienta'", { tag: ["@P2", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/customers/<id inexistente | malformado>");
    const page = await rolePage("owner");
    for (const id of ["ckzzzzzzzzzzzzzzzzzzzzzzz", "x'%20OR%201=1--", "a".repeat(80)]) {
      await gotoReady(page, `/admin/customers/${id}`);
      await expect(page.getByRole("heading", { name: "No encontramos a esta clienta" }), id).toBeVisible();
    }
  });
});
