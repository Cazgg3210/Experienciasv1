/**
 * Configurador /crear-experiencia (UI) — paquete 2 "Venta pública".
 * Recorrido de la clienta anónima: 10 pasos → resumen con estimado calculado en SERVIDOR → envío → lead.
 */
import { expect, scanA11y, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { claimFreeDate } from "../quote-public/_helpers";
import {
  activeArea,
  callAction,
  clickNext,
  completeWizard,
  ensureFreshConfiguratorCatalog,
  expectStep,
  experienceBySlug,
  fillContact,
  findInternalKeys,
  formatMXN,
  longDateLabel,
  okData,
  setGuests,
  pickDate,
  stepAlert,
  waitCalendarLoaded,
  estimateTotalRow,
} from "./_helpers";

test.describe("Configurador — wizard", { tag: ["@module:configurator"] }, () => {
  test.beforeEach(async ({ request, db }) => {
    await ensureFreshConfiguratorCatalog(request, db);
  });

  test(
    "[CONF-001] recorrido completo: estimado de servidor → envío → lead NEW + clienta + snapshot + avisos → visible en /admin/leads",
    { tag: ["@P0", "@critical", "@smoke", "@mobile"] },
    async ({ page, db, request, baseURL, rolePage, evidence }) => {
      evidence("anonimo", "10 pasos del configurador + datos de contacto; luego owner revisa /admin/leads");
      const exp = await experienceBySlug(db, "birthday-table");
      const area = await activeArea(db, "Polanco");
      const menu = exp.menus.find((m) => m.name === "Brunch Premium")!;
      const addOn = exp.addOns.find((a) => a.name === "Pastel personalizado")!;
      const expected = okData(
        await callAction<{ totalCents: number; depositCents: number; lines: unknown[] }>(
          request,
          baseURL!,
          "estimateAction",
          { experienceId: exp.id, guestCount: 9, menuId: menu.id, addOns: [{ addOnId: addOn.id, quantity: 1 }], serviceAreaId: area.id },
          "/crear-experiencia",
        ),
      );
      const name = `Valeria ${uniq("Conf")}`;
      const phone = uniqPhone();
      const email = uniqEmail("conf");

      await page.goto("/crear-experiencia");
      const estimates: unknown[] = [];
      page.on("response", async (r) => {
        if (r.request().method() === "POST" && r.request().headers()["next-action"] && r.url().endsWith("/crear-experiencia")) {
          estimates.push(await r.text().catch(() => ""));
        }
      });
      const { dateKey } = await completeWizard(page, {
        goto: false,
        occasion: "Cumpleaños",
        startTime: "12:00",
        area: "Polanco",
        guests: 9,
        style: "Natural",
        experience: "Birthday Table",
        menu: "Brunch Premium",
        addOns: ["Pastel personalizado"],
        honoree: "Sofía",
        colors: ["Salvia", "Blush"],
        notes: "Una invitada es celiaca.",
      });
      // Resumen: el total mostrado es el que calculó el servidor.
      await expect(estimateTotalRow(page)).toContainText(formatMXN(expected.totalCents));
      await expect(page.getByText(formatMXN(expected.depositCents), { exact: true }).first()).toBeVisible();
      for (const text of estimates.map(String)) expect(findInternalKeys(JSON.parse(text.split("\n").find((l) => l.startsWith("1:"))?.slice(2) ?? "{}"))).toEqual([]);

      await fillContact(page, { name, phone, email, marketing: true });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
      await expect(page.getByRole("heading", { level: 2, name: `¡Gracias, ${name.split(" ")[0]}!` })).toBeVisible();

      // Base de datos: lead + clienta + timeline + snapshot + notificaciones + analítica.
      const lead = await db.lead.findFirstOrThrow({ where: { phone: `+52${phone}` }, include: { snapshot: true, activities: true } });
      await expect(page.getByText(lead.code, { exact: true })).toBeVisible();
      expect(lead).toMatchObject({
        status: "NEW",
        source: "CONFIGURATOR",
        name,
        email,
        occasion: "BIRTHDAY",
        guestCount: 9,
        experienceId: exp.id,
        menuId: menu.id,
        serviceAreaId: area.id,
        honoreeName: "Sofía",
        outOfArea: false,
        specialRequest: false,
        estimatedTotalCents: expected.totalCents,
      });
      expect(lead.eventDate?.toISOString().slice(0, 10)).toBe(dateKey);
      expect(lead.colors).toEqual(["Salvia", "Blush"]);
      expect(lead.notes).toContain("Una invitada es celiaca.");
      expect(lead.notes).toContain("Hora de inicio preferida: 12:00.");
      const customer = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId! } });
      expect(customer).toMatchObject({ email, phone: `+52${phone}`, source: "CONFIGURATOR", marketingOptIn: true });
      expect(lead.activities.filter((a) => a.type === "CREATED")).toHaveLength(1);
      const snap = lead.snapshot!.data as Record<string, unknown> & { addOns: unknown; sessionId: string; meta: { submissionId: string } };
      expect(snap).toMatchObject({ eventDate: dateKey, startTime: "12:00", guestCount: 9, experienceId: exp.id, menuId: menu.id });
      expect(snap.addOns).toEqual([{ addOnId: addOn.id, quantity: 1 }]);
      expect(snap.meta.submissionId).toMatch(/^[\w-]{16,64}$/);
      expect((lead.snapshot!.estimate as { totalCents: number }).totalCents).toBe(expected.totalCents);
      await expect
        .poll(() => db.notificationLog.findMany({ where: { leadId: lead.id, type: "LEAD_RECEIVED" }, select: { channel: true } }))
        .toEqual(expect.arrayContaining([{ channel: "EMAIL" }, { channel: "WHATSAPP" }]));
      expect(await db.notificationLog.count({ where: { leadId: lead.id, type: "GENERIC", subject: `Nuevo lead ${lead.code}` } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "SUBMIT_LEAD", leadId: lead.id } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "START_CONFIGURATOR", sessionId: snap.sessionId } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "COMPLETE_CONFIGURATOR", sessionId: snap.sessionId } })).toBe(1);

      // La fundadora lo ve en el panel.
      const owner = await rolePage("owner");
      await owner.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
      await owner.getByRole("link", { name }).first().click();
      await expect(owner.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(owner.getByText(lead.code)).toBeVisible();
      await expect(owner.getByText("Lo que configuró")).toBeVisible();
    },
  );

  test(
    "[CONF-002] el estimado se recalcula en servidor al cambiar invitadas y extras (sin costos internos)",
    { tag: ["@P1"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("anonimo", "Cambia invitadas y extras y observa el estimado");
      const exp = await experienceBySlug(db, "birthday-table");
      const area = await activeArea(db, "Polanco");
      const calc = async (guestCount: number, addOns: Array<{ addOnId: string; quantity: number }>) =>
        okData(
          await callAction<{ totalCents: number }>(
            request,
            baseURL!,
            "estimateAction",
            { experienceId: exp.id, guestCount, menuId: exp.menus[0]!.id, addOns, serviceAreaId: area.id },
            "/crear-experiencia",
          ),
        ).totalCents;
      const mimosa = exp.addOns.find((a) => a.name === "Mimosa bar")!;
      await completeWizard(page, { experience: "Birthday Table", guests: 8, menu: exp.menus[0]!.name });
      await expect(estimateTotalRow(page)).toContainText(formatMXN(await calc(8, [])));

      // Editar invitadas desde el resumen → estimado nuevo.
      await page.getByRole("button", { name: /^Editar invitadas/ }).click();
      await expectStep(page, 4);
      await setGuests(page, 11);
      await page.getByRole("button", { name: "Guardar y volver al resumen" }).click();
      await expect(estimateTotalRow(page)).toContainText(formatMXN(await calc(11, [])));

      // Extra por persona → se suma por invitada.
      await page.getByRole("button", { name: /^Editar extras/ }).click();
      await expectStep(page, 8);
      const responses: string[] = [];
      page.on("response", async (r) => {
        if (r.request().headers()["next-action"]) responses.push(await r.text().catch(() => ""));
      });
      await page.getByRole("button", { name: /Mimosa bar/ }).click();
      await page.getByRole("button", { name: "Guardar y volver al resumen" }).click();
      const withMimosa = await calc(11, [{ addOnId: mimosa.id, quantity: 1 }]);
      expect(withMimosa).toBeGreaterThan(await calc(11, []));
      await expect(estimateTotalRow(page)).toContainText(formatMXN(withMimosa));
      for (const t of responses) {
        const line = t.split("\n").find((l) => l.startsWith("1:"));
        if (line) expect(findInternalKeys(JSON.parse(line.slice(2)))).toEqual([]);
      }
    },
  );

  test(
    "[CONF-003] límites de invitadas en la UI: mínimo 2, máximo 40 y aviso de consulta especial",
    { tag: ["@P1", "@negative"] },
    async ({ page, evidence }) => {
      evidence("anonimo", "Paso 4 con valores fuera de rango");
      await page.goto("/crear-experiencia");
      await page.getByRole("radio", { name: "Cumpleaños", exact: true }).click();
      await clickNext(page);
      await expectStep(page, 2);
      const sb = page.getByRole("spinbutton", { name: "Número de personas (incluyéndote)" });
      // Navega al paso 4 por la barra de pasos no es posible sin fecha: elige fecha y zona.
      await pickDate(page);
      await clickNext(page);
      await page.getByRole("radio", { name: "Polanco", exact: true }).click();
      await clickNext(page);
      await expectStep(page, 4);
      await sb.fill("1");
      await sb.press("Enter");
      await expect(sb).toHaveValue("2");
      await expect(page.getByRole("button", { name: /^Quitar uno/ })).toBeDisabled();
      await sb.fill("99");
      await sb.press("Enter");
      await expect(sb).toHaveValue("40");
      await expect(page.getByRole("button", { name: /^Agregar uno/ })).toBeDisabled();
      await expect(page.getByText("Consulta especial")).toBeVisible();
      await sb.fill("12");
      await sb.press("Enter");
      await expect(page.getByText("Consulta especial")).toHaveCount(0);
    },
  );

  test(
    "[CONF-004] calendario: pasados, lunes, bloqueados y llenos no se pueden elegir; el paso exige fecha",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Paso 2 con fechas no disponibles (bloqueo y día lleno propios)");
      const blocked = await claimFreeDate(db, { minDays: 26, maxDays: 58 });
      await db.availabilityException.create({ data: { date: new Date(`${blocked}T00:00:00.000Z`), type: "BLOCKED", reason: "E2E bloqueo" } });
      const full = await claimFreeDate(db, { weekdays: [2, 3, 4, 5], minDays: 26, maxDays: 58 });
      const cust = await db.customer.create({ data: { name: uniq("Lleno"), referralCode: uniq("REF") } });
      await db.event.create({
        data: {
          code: uniq("EV-E2E").toUpperCase(),
          title: "E2E evento que llena el día",
          status: "CONFIRMED",
          customerId: cust.id,
          eventDate: new Date(`${full}T00:00:00.000Z`),
          startsAt: new Date(`${full}T17:00:00.000Z`),
          endsAt: new Date(`${full}T21:00:00.000Z`),
          guestCount: 8,
          micrositeSlug: uniq("e2e-lleno").toLowerCase(),
          inviteToken: uniq("invite-e2e-lleno-token"),
          portalToken: uniq("portal-e2e-lleno-token"),
        },
      });

      await page.goto("/crear-experiencia");
      await page.getByRole("radio", { name: "Cumpleaños", exact: true }).click();
      await clickNext(page);
      await expectStep(page, 2);
      await waitCalendarLoaded(page);
      await clickNext(page);
      await expect(stepAlert(page, "Elige una fecha en el calendario.")).toBeVisible();

      // Lunes del mes visible: cerrado.
      const monday = page.getByRole("button", { name: /^lunes .*: Cerrado/ }).first();
      await expect(monday).toHaveAttribute("aria-disabled", "true");
      // aria-disabled: Playwright no hace clic "accionable"; force simula el clic real del mouse (la app debe ignorarlo).
      await monday.click({ force: true });
      await expect(page.getByText("Elige un día en el calendario.")).toBeVisible();
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      if (Number(today.slice(8, 10)) > 1) {
        const past = page.getByRole("button", { name: /: No disponible$/ }).first();
        await expect(past).toHaveAttribute("aria-disabled", "true");
      }
      const targets = ([
        [blocked, "Cerrado"],
        [full, "Lleno"],
      ] as const).slice().sort((a, b) => a[0].localeCompare(b[0])); // el calendario sólo avanza hacia adelante
      for (const [key, label] of targets) {
        const target = page.getByRole("button", { name: new RegExp(`^${longDateLabel(key)}:`) });
        for (let i = 0; i < 4 && (await target.count()) === 0; i++) {
          await page.getByRole("button", { name: "Mes siguiente" }).click();
          await waitCalendarLoaded(page);
        }
        await expect(target).toHaveAccessibleName(`${longDateLabel(key)}: ${label}`);
        await expect(target).toHaveAttribute("aria-disabled", "true");
        await target.click({ force: true }); // ver nota de aria-disabled arriba
        await expect(page.getByText("Elige un día en el calendario.")).toBeVisible();
      }
      await clickNext(page);
      await expect(stepAlert(page, "Elige una fecha en el calendario.")).toBeVisible();
      await expectStep(page, 2);
    },
  );

  test(
    "[CONF-005] datos de contacto inválidos: errores por campo y no se crea ningún lead",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Resumen con nombre vacío, teléfono corto, correo inválido y sin consentimiento");
      await completeWizard(page, { experience: "Signature Brunch" });
      const actions: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"] && (r.postData() ?? "").includes("consent")) actions.push(r.url());
      });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
      await expect(page.getByText("Escribe tu nombre.")).toBeVisible();
      await expect(page.getByText("Escribe tu WhatsApp o teléfono.")).toBeVisible();
      await expect(page.getByText("Necesitamos tu autorización para contactarte.")).toBeVisible();
      await fillContact(page, { name: "A", phone: "12345", email: "correo@", consent: false });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
      await expect(page.getByText("Escribe tu nombre.")).toBeVisible();
      await expect(page.getByText("Escribe un número de 10 dígitos (ej. 55 1234 5678).")).toBeVisible();
      await expect(page.getByText("Revisa tu correo electrónico.")).toBeVisible();
      await expect(page.getByLabel("Tu nombre")).toHaveAttribute("aria-invalid", "true");
      expect(actions, "no se envía nada al servidor con datos inválidos").toEqual([]);
      expect(await db.lead.count({ where: { OR: [{ email: "correo@" }, { name: "A" }] } })).toBe(0);
    },
  );

  test(
    "[CONF-006] doble clic en «Consultar disponibilidad» crea un solo lead",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Doble clic al enviar");
      const phone = uniqPhone();
      await completeWizard(page, { experience: "Birthday Table" });
      await fillContact(page, { name: `Doble ${uniq("Clic")}`, phone, email: "" });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).dblclick();
      await expect(page.getByRole("heading", { level: 2, name: /^¡Gracias, Doble!/ })).toBeVisible();
      await expect.poll(() => db.lead.count({ where: { phone: `+52${phone}` } })).toBe(1);
      expect(await db.customer.count({ where: { phone: `+52${phone}` } })).toBe(1);
      const lead = await db.lead.findFirstOrThrow({ where: { phone: `+52${phone}` } });
      expect(await db.notificationLog.count({ where: { leadId: lead.id, type: "LEAD_RECEIVED" } })).toBe(1);
    },
  );

  test(
    "[CONF-007] recargar a mitad del wizard ofrece continuar el borrador y el envío funciona",
    { tag: ["@P2"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Avanza 4 pasos, recarga, continúa y envía; luego descarta otro borrador");
      await page.goto("/crear-experiencia");
      await page.getByRole("radio", { name: "Despedida de soltera", exact: true }).click();
      await clickNext(page);
      const dateKey = await pickDate(page);
      await clickNext(page);
      await page.getByRole("radio", { name: "Granada", exact: true }).click();
      await clickNext(page);
      await setGuests(page, 10);
      await clickNext(page);
      await expectStep(page, 5);
      await page.reload();
      const region = page.getByRole("region", { name: "Experiencia guardada" });
      await expect(region).toContainText("Ibas en el paso 5 de 10");
      await expect(region).toContainText(longDateLabel(dateKey));
      await region.getByRole("button", { name: "Continuar donde lo dejaste" }).click();
      await expectStep(page, 5);
      await page.getByRole("button", { name: /^Atrás/ }).click();
      await expect(page.getByRole("spinbutton", { name: "Número de personas (incluyéndote)" })).toHaveValue("10");
      await clickNext(page);
      await page.getByRole("radio").first().click();
      await clickNext(page);
      await page.getByRole("radio", { name: "Bridal Brunch", exact: true }).click();
      for (let i = 0; i < 4; i++) await clickNext(page); // 6 → 10 (menú, extras y preferencias opcionales)
      await expectStep(page, 10);
      await page.getByRole("radio", { name: "Prefiero platicarlo", exact: true }).click();
      await clickNext(page);
      const phone = uniqPhone();
      await fillContact(page, { name: `Borrador ${uniq("Rec")}`, phone, email: "" });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
      await expect(page.getByRole("heading", { level: 2, name: /^¡Gracias, Borrador!/ })).toBeVisible();
      const lead = await db.lead.findFirstOrThrow({ where: { phone: `+52${phone}` } });
      expect(lead).toMatchObject({ occasion: "BACHELORETTE", guestCount: 10 });
      expect(lead.eventDate?.toISOString().slice(0, 10)).toBe(dateKey);
      // Tras enviar se limpia el borrador: al volver no se ofrece continuar.
      await page.goto("/crear-experiencia");
      await expectStep(page, 1);
      await expect(page.getByRole("region", { name: "Experiencia guardada" })).toHaveCount(0);
    },
  );

  test(
    "[CONF-008] «Otra zona»: el lead queda fuera de cobertura con la colonia y la logística «por confirmar»",
    { tag: ["@P1"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "Paso 3 → Otra zona (Coyoacán)");
      await completeWizard(page, { experience: "Signature Brunch", area: null, zoneText: "Coyoacán centro" });
      await expect(page.getByText("Logística para tu zona")).toBeVisible();
      await expect(page.getByText("Por confirmar")).toBeVisible();
      const phone = uniqPhone();
      await fillContact(page, { name: `Zona ${uniq("Otra")}`, phone, email: "" });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
      await expect(page.getByText("Tu zona está fuera de nuestra cobertura actual: te contactamos para ver opciones.")).toBeVisible();
      const lead = await db.lead.findFirstOrThrow({ where: { phone: `+52${phone}` } });
      expect(lead).toMatchObject({ outOfArea: true, zoneText: "Coyoacán centro", serviceAreaId: null });
      expect(await db.leadActivity.count({ where: { leadId: lead.id, message: { contains: "fuera de cobertura" } } })).toBe(1);
    },
  );

  test(
    "[CONF-009] grupo de 20 personas: consulta especial marcada en el lead y en la confirmación",
    { tag: ["@P1"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "20 invitadas (más de 12 estándar)");
      await completeWizard(page, { experience: "Karaoke & Mimosas", guests: 20 });
      const phone = uniqPhone();
      await fillContact(page, { name: `Grupo ${uniq("Grande")}`, phone, email: "" });
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
      await expect(page.getByText("Por el tamaño de tu grupo, armaremos una propuesta especial para ti.")).toBeVisible();
      const lead = await db.lead.findFirstOrThrow({ where: { phone: `+52${phone}` } });
      expect(lead).toMatchObject({ specialRequest: true, guestCount: 20 });
      expect(lead.notes).toContain("Consulta especial: 20 personas");
    },
  );

  test(
    "[CONF-010] llegar desde una experiencia (?experiencia=&ocasion=) preselecciona ocasión y experiencia",
    { tag: ["@P1"] },
    async ({ page, db, evidence }) => {
      evidence("anonimo", "/crear-experiencia?experiencia=bridal-brunch&ocasion=bridal");
      const exp = await experienceBySlug(db, "bridal-brunch");
      await page.goto("/crear-experiencia?experiencia=bridal-brunch&ocasion=bridal");
      await expect(page.getByText(`Partimos de ${exp.name}`)).toBeVisible();
      await expect(page.getByRole("radio", { name: "Bridal brunch", exact: true })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("complementary", { name: "Tu experiencia" })).toContainText(exp.name);
      // Parámetros inválidos se ignoran sin error.
      await page.goto("/crear-experiencia?experiencia=%3Cscript%3E&ocasion=xyz");
      await expectStep(page, 1);
      await expect(page.getByText(/^Partimos de/)).toHaveCount(0);
      await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    },
  );

  test(
    "[CONF-011] cada paso valida antes de avanzar con mensajes claros",
    { tag: ["@P2", "@negative"] },
    async ({ page, evidence }) => {
      evidence("anonimo", "Siguiente sin responder en los pasos obligatorios");
      await page.goto("/crear-experiencia");
      await clickNext(page);
      await expect(stepAlert(page, "Elige qué celebramos para continuar.")).toBeVisible();
      await page.getByRole("radio", { name: "Otra", exact: true }).click();
      await clickNext(page);
      await expect(stepAlert(page, "Cuéntanos brevemente qué celebramos.")).toBeVisible();
      await page.getByRole("textbox", { name: "¿Qué celebramos?" }).fill("Graduación");
      await clickNext(page);
      await pickDate(page);
      await clickNext(page);
      await clickNext(page);
      await expect(stepAlert(page, "Elige la zona de tu evento.")).toBeVisible();
      await page.getByRole("radio", { name: "Otra zona", exact: true }).click();
      await clickNext(page);
      await expect(stepAlert(page, "Escribe tu colonia o alcaldía.")).toBeVisible();
      await page.getByLabel("¿En qué colonia o alcaldía será?").fill("Del Valle");
      await clickNext(page);
      await clickNext(page);
      await expectStep(page, 5);
      await clickNext(page);
      await expect(stepAlert(page, "Elige el estilo que más te guste.")).toBeVisible();
      await page.getByRole("radio").first().click();
      await clickNext(page);
      await clickNext(page);
      await expect(stepAlert(page, "Elige una experiencia base.")).toBeVisible();
    },
  );

  test(
    "[CONF-012] accesibilidad del configurador (pasos 1–2 y resumen) y navegación por teclado del paso 1",
    { tag: ["@P2", "@a11y"] },
    async ({ page }, testInfo) => {
      test.info().annotations.push({ type: "rol", description: "anonimo" });
      await page.goto("/crear-experiencia");
      const first = page.getByRole("radio", { name: "Cumpleaños", exact: true });
      await first.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: "Brunch entre amigas", exact: true })).toBeFocused();
      await page.keyboard.press("Space");
      await expect(page.getByRole("radio", { name: "Brunch entre amigas", exact: true })).toHaveAttribute("aria-checked", "true");
      const s1 = await scanA11y(page, testInfo);
      await clickNext(page);
      await waitCalendarLoaded(page);
      const s2 = await scanA11y(page, testInfo);
      await completeWizard(page, { experience: "Birthday Table" });
      const s3 = await scanA11y(page, testInfo);
      const blocking = [...s1.blocking, ...s2.blocking, ...s3.blocking];
      expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    },
  );

  test(
    "[CONF-024] resumen con líneas por persona («· N × $precio») sin texto atenuado bajo AA",
    { tag: ["@P2", "@a11y", "@regression"] },
    async ({ page }, testInfo) => {
      // El detalle «· N × $precio» sólo aparece con cantidades > 1 (menú o extra por persona): el barrido de
      // CONF-012 (menú incluido) no lo veía y quedaba con text-muted-foreground/80 (~4.1:1).
      test.info().annotations.push({ type: "regression", description: "BUG-009 (texto atenuado restante en el configurador)" });
      test.info().annotations.push({ type: "rol", description: "anonimo" });
      await completeWizard(page, { experience: "Birthday Table", menu: "Brunch Premium", guests: 9 });
      const detail = page.getByText(/· 9 × \$380/);
      await expect(detail).toBeVisible();
      // El detalle hereda el gris secundario completo (sin opacidad) del resto de la línea
      const styles = await detail.evaluate((el) => {
        const own = getComputedStyle(el);
        return { color: own.color, opacity: own.opacity, parent: getComputedStyle(el.parentElement!).color };
      });
      expect(styles.opacity).toBe("1");
      expect(styles.color).toBe(styles.parent);
      await testInfo.attach("resumen-por-persona.png", { body: await page.getByRole("main").screenshot(), contentType: "image/png" });
      const { all, blocking } = await scanA11y(page, testInfo);
      expect(all.filter((v) => v.id === "color-contrast").map((v) => v.nodes.map((n) => n.target.join(" ")).join(", "))).toEqual([]);
      expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    },
  );
});
