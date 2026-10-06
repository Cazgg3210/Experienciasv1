/**
 * Paquete 3 · Cotizaciones — creación (desde lead y desde /admin/quotes/new), búsqueda de clienta,
 * clienta nueva / duplicada, cálculo en vivo (QuoteEngine en servidor) contra un oráculo independiente,
 * validaciones de front y back, invitadas fuera de rango y doble envío.
 */
import { ACCOUNTS, createCustomer, createLead, expect, test, uniq, uniqEmail } from "../fixtures";
import { formatMXN } from "../../../src/lib/money";
import {
  addOnBySlug,
  areaBySlug,
  callAction,
  dateKeyFromToday,
  experienceBySlug,
  gotoReady,
  menuBySlug,
  oracleSelection,
  pricingSettings,
  totalsValue,
  waitForDetail,
} from "./_helpers";

test.describe("Cotizaciones · creación", { tag: ["@module:quotes"] }, () => {
  test("[QUO-002] crear cotización desde un lead: precarga, cálculo en vivo = oráculo, lead pasa a Cotizado", { tag: ["@P0", "@critical"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Lead › Crear cotización › Crear cotización");
    const lead = await createLead(db, { name: uniq("Lead a Cotizar"), guestCount: 8, occasion: "BIRTHDAY" });
    const exp = await experienceBySlug(db, "signature-brunch");
    const mimosa = await addOnBySlug(db, "mimosa-bar");
    const polanco = await areaBySlug(db, "polanco");
    const eventDate = dateKeyFromToday(45);
    const oracle = await oracleSelection(db, { experienceSlug: "signature-brunch", guests: 8, addOns: [{ slug: "mimosa-bar", quantity: 1 }], areaSlug: "polanco" });

    const page = await rolePage("owner");
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await page.getByRole("link", { name: "Crear cotización" }).first().click();
    await page.waitForURL((u) => u.pathname === "/admin/quotes/new" && u.searchParams.get("leadId") === lead.id);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(`A partir del lead ${lead.code}`, { exact: false })).toBeVisible();
    const customer = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId! } });
    await expect(page.getByText(customer.name, { exact: true }).first()).toBeVisible(); // clienta precargada
    await expect(page.getByRole("spinbutton", { name: "Invitadas" })).toHaveValue("8");

    await page.getByRole("combobox", { name: "Experiencia" }).selectOption(exp.id);
    await page.getByRole("combobox", { name: "Menú" }).selectOption("");
    await page.getByRole("combobox", { name: "Zona" }).selectOption(polanco.id);
    await page.getByLabel("Fecha del evento").fill(eventDate);
    const cb = page.getByRole("checkbox", { name: new RegExp(`^${mimosa.name}`) });
    if (!(await cb.isVisible())) await page.getByRole("button", { name: /Ver otros add-ons/ }).click();
    await cb.check();

    const calc = page.getByRole("complementary", { name: "Cálculo en vivo" });
    await expect(totalsValue(calc, "Total")).toHaveText(formatMXN(oracle.totalCents));
    await expect(totalsValue(calc, "Subtotal")).toHaveText(formatMXN(oracle.subtotalCents));
    await expect(totalsValue(calc, "IVA incluido")).toHaveText(formatMXN(oracle.taxCents));
    await expect(totalsValue(calc, "Anticipo (50%)")).toHaveText(formatMXN(oracle.depositCents));

    await page.getByRole("button", { name: "Crear cotización" }).click();
    await expect(page.getByText(/^Cotización Q-[0-9A-Z]{4}-[0-9A-Z]{4} creada$/)).toBeVisible();
    const id = await waitForDetail(page, "/admin/quotes");

    const q = await db.quote.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    expect(q).toMatchObject({
      status: "DRAFT",
      version: 1,
      leadId: lead.id,
      customerId: customer.id,
      experienceId: exp.id,
      guestCount: 8,
      subtotalCents: oracle.subtotalCents,
      taxCents: oracle.taxCents,
      totalCents: oracle.totalCents,
      depositBps: 5000,
      depositCents: oracle.depositCents,
      discountCents: 0,
    });
    expect(q.items.map((i) => [i.type, i.quantity, i.unitPriceCents, i.totalPriceCents])).toEqual(
      oracle.lines.map((l) => [l.type, l.quantity, l.unit, l.total]),
    );
    expect(q.publicToken.length).toBeGreaterThanOrEqual(40);
    const settings = await pricingSettings(db);
    expect(Math.abs(q.validUntil!.getTime() - (Date.now() + settings.quoteValidityDays * 86_400_000))).toBeLessThan(10 * 60_000);
    const leadAfter = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(leadAfter.status).toBe("QUOTED");
    const act = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id, type: "QUOTE_CREATED" } });
    expect(act).toMatchObject({ fromStatus: "NEW", toStatus: "QUOTED" });
    expect(act.message).toBe(`Cotización ${q.code} creada por ${formatMXN(q.totalCents)}.`);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityType: "Quote", entityId: id, action: "quote.created" } });
    expect(audit.after).toMatchObject({ code: q.code, totalCents: oracle.totalCents, leadId: lead.id });
    expect(audit.actorEmail).toBe(ACCOUNTS.owner.email);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(q.title);
    await gotoReady(page, `/admin/leads/${lead.id}`);
    await expect(page.getByRole("link", { name: q.code })).toHaveAttribute("href", `/admin/quotes/${id}`);
  });

  test("[QUO-003] crear desde /admin/quotes/new buscando una clienta existente", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Cotizaciones › Nueva cotización › Buscar clienta");
    const c = await createCustomer(db, { name: uniq("Clienta Buscada") });
    const title = uniq("Propuesta Buscada");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/quotes/new");
    const picker = page.getByRole("combobox", { name: "Buscar clienta" });
    await picker.fill(c.name.slice(0, 18));
    await page.getByRole("option", { name: new RegExp(c.name) }).click();
    await expect(page.getByRole("button", { name: `Cambiar clienta (${c.name})` })).toBeVisible();
    await page.getByRole("textbox", { name: "Título de la propuesta" }).fill(title);
    await page.getByRole("button", { name: "Crear cotización" }).click();
    const id = await waitForDetail(page, "/admin/quotes");
    const q = await db.quote.findUniqueOrThrow({ where: { id } });
    expect(q).toMatchObject({ customerId: c.id, title, leadId: null, status: "DRAFT" });
    expect(q.totalCents).toBeGreaterThan(0);
  });

  test("[QUO-004] clienta nueva desde la cotización: se crea con origen manual y un correo repetido reutiliza la existente", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Cotizaciones › Nueva cotización › Clienta nueva");
    const name = uniq("Clienta Nueva Cot");
    const email = uniqEmail("nuevacot");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/quotes/new");
    await page.getByRole("button", { name: "Clienta nueva" }).click();
    await page.getByRole("textbox", { name: "Nombre completo" }).fill(name);
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("button", { name: "Crear cotización" }).click();
    const id = await waitForDetail(page, "/admin/quotes");
    const q = await db.quote.findUniqueOrThrow({ where: { id }, include: { customer: true } });
    expect(q.customer).toMatchObject({ name, email, source: "MANUAL" });
    // Segunda cotización con el mismo correo (mayúsculas) => misma clienta
    const exp = await experienceBySlug(db, "birthday-table");
    const r = await callAction<{ id: string }>(await apiAs("owner"), "quotes", "createQuoteAction", {
      customerMode: "new", customerId: null, newCustomer: { name: "Otro Nombre", email: email.toUpperCase(), phone: "" },
      occasion: "BIRTHDAY", experienceId: exp.id, guestCount: 6, addOns: [], depositBps: 5000,
    });
    expect(r.result?.ok, r.raw.slice(0, 300)).toBe(true);
    const q2 = await db.quote.findUniqueOrThrow({ where: { id: r.result!.ok ? r.result!.data.id : "" } });
    expect(q2.customerId).toBe(q.customerId);
    expect(await db.customer.count({ where: { email } })).toBe(1);
  });

  test("[QUO-005] validaciones del formulario: clienta, contacto e invitadas", { tag: ["@P1", "@negative"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "Cotizaciones › Nueva cotización › validaciones");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/quotes/new");
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"] && r.postData()?.includes('"customerMode"')) posts++;
    });
    await page.getByRole("button", { name: "Crear cotización" }).click();
    await expect(page.getByText("Elige una clienta", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clienta nueva" }).click();
    await page.getByRole("textbox", { name: "Nombre completo" }).fill("Ana");
    await page.getByRole("spinbutton", { name: "Invitadas" }).fill("0");
    await page.getByRole("button", { name: "Crear cotización" }).click();
    await expect(page.getByText("Agrega email o teléfono para poder enviarle la propuesta")).toBeVisible();
    await expect(page.getByText("Mínimo 1 invitada")).toBeVisible();
    await page.getByRole("spinbutton", { name: "Invitadas" }).fill("201");
    await page.getByRole("textbox", { name: "Email" }).fill("no-es-email");
    await page.getByRole("button", { name: "Crear cotización" }).click();
    await expect(page.getByText("Máximo 200 invitadas")).toBeVisible();
    await expect(page.getByText("Email inválido")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/quotes\/new$/);
    expect(posts, "createQuoteAction no debe llamarse con datos inválidos").toBe(0);
  });

  test("[QUO-006] el servidor rechaza invitadas fuera de rango, anticipo > 100% y add-ons con cantidad inválida", { tag: ["@P1", "@negative"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "createQuoteAction / previewQuoteAction directas con datos inválidos");
    const api = await apiAs("owner");
    const c = await createCustomer(db, { name: uniq("Cliente Back") });
    const exp = await experienceBySlug(db, "signature-brunch");
    const mimosa = await addOnBySlug(db, "mimosa-bar");
    const title = uniq("No Debe Existir");
    const base = { customerMode: "existing", customerId: c.id, title, occasion: "BIRTHDAY", experienceId: exp.id, guestCount: 8, addOns: [], depositBps: 5000 };
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ guestCount: 0 }, "guestCount", "Mínimo 1 invitada"],
      [{ guestCount: 201 }, "guestCount", "Máximo 200 invitadas"],
      [{ guestCount: 7.5 }, "guestCount", "Número entero"],
      [{ depositBps: 10_001 }, "depositBps", "Máximo 100%"],
      [{ depositBps: -1 }, "depositBps", "Mínimo 0%"],
      [{ addOns: [{ addOnId: mimosa.id, quantity: 0 }] }, "addOns.0.quantity", "Mínimo 1"],
      [{ addOns: [{ addOnId: mimosa.id, quantity: 51 }] }, "addOns.0.quantity", "Máximo 50"],
      [{ eventDate: "2026-02-30x" }, "eventDate", "Fecha inválida"],
      [{ startTime: "25:00" }, "startTime", "Hora inválida (HH:mm)"],
      [{ customerId: null }, "customerId", "Elige una clienta"],
    ];
    for (const [over, field, message] of cases) {
      const r = await callAction(api, "quotes", "createQuoteAction", { ...base, ...over });
      expect(r.result?.ok, JSON.stringify(over)).toBe(false);
      if (r.result && !r.result.ok) expect(r.result.fieldErrors?.[field], JSON.stringify(r.result.fieldErrors)).toContain(message);
    }
    // experiencia inexistente → error controlado (no 500)
    const nf = await callAction(api, "quotes", "createQuoteAction", { ...base, experienceId: "ckzzzzzzzzzzzzzzzzzzzzzz" });
    expect(nf.result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    // fecha válida pero inexistente (30 de febrero) → validación de servidor
    const feb = await callAction(api, "quotes", "createQuoteAction", { ...base, eventDate: "2027-02-30" });
    expect(feb.result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(await db.quote.count({ where: { title } })).toBe(0);
  });

  test("[QUO-007] invitadas por encima del máximo de la experiencia: avisos de validación y consulta especial; se cotiza por invitada", { tag: ["@P1"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Cotizaciones › Nueva cotización › 13 invitadas");
    const exp = await experienceBySlug(db, "karaoke-mimosas");
    const oracle = await oracleSelection(db, { experienceSlug: "karaoke-mimosas", guests: 13 });
    const c = await createCustomer(db, { name: uniq("Grupo Grande Cot") });
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/quotes/new");
    await page.getByRole("combobox", { name: "Buscar clienta" }).fill(c.name.slice(0, 20));
    await page.getByRole("option", { name: new RegExp(c.name) }).click();
    await page.getByRole("combobox", { name: "Experiencia" }).selectOption(exp.id);
    await page.getByRole("combobox", { name: "Menú" }).selectOption("");
    await page.getByRole("spinbutton", { name: "Invitadas" }).fill("13");
    const calc = page.getByRole("complementary", { name: "Cálculo en vivo" });
    await expect(totalsValue(calc, "Total")).toHaveText(formatMXN(oracle.totalCents));
    await expect(calc.getByText(`Más de ${exp.maxGuests} personas requiere validación del equipo.`)).toBeVisible();
    await expect(calc.getByText("Grupos de más de 12 personas son consulta especial.")).toBeVisible();
    await expect(calc.getByText(`Invitada adicional (${13 - exp.baseGuests})`)).toBeVisible();
    await page.getByRole("button", { name: "Crear cotización" }).click();
    const id = await waitForDetail(page, "/admin/quotes");
    const q = await db.quote.findUniqueOrThrow({ where: { id } });
    expect(q).toMatchObject({ guestCount: 13, totalCents: oracle.totalCents });
  });

  test("[QUO-008] precio calculado en servidor: la vista previa coincide con el oráculo en combinaciones de menú, add-ons, zona e invitadas", { tag: ["@P0", "@critical"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "previewQuoteAction (QuoteEngine) vs. cálculo independiente");
    const api = await apiAs("owner");
    const combos = [
      { experienceSlug: "birthday-table", guests: 9, menuSlug: "brunch-premium", addOns: [{ slug: "pastel-personalizado", quantity: 2 }, { slug: "mimosa-bar", quantity: 1 }], areaSlug: "irrigacion", depositBps: 5000 },
      { experienceSlug: "signature-brunch", guests: 4, menuSlug: "brunch-clasico", addOns: [{ slug: "taller-floral", quantity: 1 }], areaSlug: null, depositBps: 3000 },
      { experienceSlug: "bridal-brunch", guests: 6, menuSlug: null, addOns: [{ slug: "pastel-personalizado", quantity: 5 }], areaSlug: "polanco", depositBps: 10_000 },
      { experienceSlug: "peru-x-mexico", guests: 12, menuSlug: "sabores-peru-mexico", addOns: [], areaSlug: "granada", depositBps: 0 },
    ];
    for (const combo of combos) {
      const exp = await experienceBySlug(db, combo.experienceSlug);
      const oracle = await oracleSelection(db, combo);
      const addOns = [];
      for (const a of combo.addOns) addOns.push({ addOnId: (await addOnBySlug(db, a.slug)).id, quantity: a.quantity });
      const r = await callAction<{
        subtotalCents: number; taxCents: number; totalCents: number; depositCents: number; depositBps: number;
        lines: Array<{ type: string; quantity: number; unitPriceCents: number; totalPriceCents: number }>;
        warnings: Array<{ code: string }>; billableGuests: number;
      }>(api, "quotes", "previewQuoteAction", {
        experienceId: exp.id,
        guestCount: combo.guests,
        menuId: combo.menuSlug ? (await menuBySlug(db, combo.menuSlug)).id : null,
        serviceAreaId: combo.areaSlug ? (await areaBySlug(db, combo.areaSlug)).id : null,
        addOns,
        depositBps: combo.depositBps,
      });
      expect(r.result?.ok, `${combo.experienceSlug}: ${r.raw.slice(0, 200)}`).toBe(true);
      if (!r.result?.ok) continue;
      const res = r.result.data;
      expect(res.lines.map((l) => [l.type, l.quantity, l.unitPriceCents, l.totalPriceCents]), combo.experienceSlug).toEqual(
        oracle.lines.map((l) => [l.type, l.quantity, l.unit, l.total]),
      );
      expect({ s: res.subtotalCents, t: res.taxCents, tot: res.totalCents, d: res.depositCents }, combo.experienceSlug).toEqual({
        s: oracle.subtotalCents, t: oracle.taxCents, tot: oracle.totalCents, d: oracle.depositCents,
      });
      expect(Number.isInteger(res.totalCents) && Number.isInteger(res.taxCents)).toBe(true);
      expect(res.billableGuests).toBe(oracle.billable);
      const codes = res.warnings.map((w) => w.code);
      if (combo.guests < exp.minGuests) expect(codes).toContain("GUESTS_BELOW_MINIMUM");
      if (combo.addOns.some((a) => a.quantity === 5)) expect(codes).toContain("ADDON_QUANTITY_CAPPED");
    }
  });

  test("[QUO-034] doble clic en 'Crear cotización' crea una sola cotización", { tag: ["@P2", "@negative"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Cotizaciones › Nueva cotización › doble clic");
    const c = await createCustomer(db, { name: uniq("Doble Cot") });
    const title = uniq("Propuesta Doble");
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/quotes/new");
    await page.getByRole("combobox", { name: "Buscar clienta" }).fill(c.name.slice(0, 16));
    await page.getByRole("option", { name: new RegExp(c.name) }).click();
    await page.getByRole("textbox", { name: "Título de la propuesta" }).fill(title);
    await page.getByRole("button", { name: "Crear cotización" }).dblclick();
    await waitForDetail(page, "/admin/quotes");
    await page.reload();
    expect(await db.quote.count({ where: { title } })).toBe(1);
  });

  test("[QUO-036] buscador de clientas: teclado (↓/Enter), sin coincidencias y 'Cambiar'", { tag: ["@P2", "@a11y"] }, async ({ rolePage, db, evidence }) => {
    evidence("owner", "Cotizaciones › Nueva cotización › combobox de clientas");
    const prefix = uniq("Picker");
    const a = await createCustomer(db, { name: `${prefix} Alfa` });
    const b = await createCustomer(db, { name: `${prefix} Beta` });
    const page = await rolePage("owner");
    await gotoReady(page, "/admin/quotes/new");
    const picker = page.getByRole("combobox", { name: "Buscar clienta" });
    await picker.fill(prefix);
    await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(2);
    await expect(picker).toHaveAttribute("aria-expanded", "true");
    await picker.press("ArrowDown");
    const selected = page.getByRole("listbox").getByRole("option", { selected: true });
    await expect(selected).toHaveCount(1);
    await expect(picker).toHaveAttribute("aria-activedescendant", (await selected.getAttribute("id"))!);
    const activeName = await selected.innerText();
    await picker.press("Enter");
    const chosen = activeName.includes(a.name) ? a : b;
    await expect(page.getByRole("button", { name: `Cambiar clienta (${chosen.name})` })).toBeVisible();
    await page.getByRole("button", { name: `Cambiar clienta (${chosen.name})` }).click();
    await page.getByRole("combobox", { name: "Buscar clienta" }).fill(`${prefix}-zz`);
    await expect(page.getByText("Sin coincidencias. Puedes registrarla como clienta nueva.")).toBeVisible();
    // búsqueda por correo
    await page.getByRole("combobox", { name: "Buscar clienta" }).fill(a.email!);
    await expect(page.getByRole("option", { name: new RegExp(a.name) })).toBeVisible();
  });
});
