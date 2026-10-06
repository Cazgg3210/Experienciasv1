/**
 * Recorridos críticos de VENTA (P0): configurador → lead, contacto → lead,
 * lead → cotización → envío → aceptación → anticipo (mock) → evento confirmado → portal,
 * y rechazo de la propuesta por token.
 * Cada paso se valida en UI + base (PostgreSQL) y, cuando aplica, desde otro rol.
 */
import {
  createQuotableLead,
  ensureConfiguratorCatalogMatchesDb,
  createSentQuote,
  expect,
  expectNotification,
  moneyRx,
  pricingSettings,
  rx,
  test,
  uniq,
  uniqEmail,
  uniqPhone,
} from "./_helpers";

test.describe("Recorridos críticos · venta", { tag: ["@critical"] }, () => {
  test(
    "[CRIT-001] configurador anónimo → lead NEW con clienta, snapshot y notificación → la fundadora lo ve y lo abre",
    { tag: ["@P0", "@module:configurator", "@mobile"] },
    async ({ page, deskPage, db, evidence }) => {
      // Puede esperar hasta 150 s a que la caché compartida del catálogo coincida con la base (ver helper).
      test.setTimeout(240_000);
      evidence("anonimo", "Configurador 10 pasos → resumen → Consultar disponibilidad; luego owner en /admin/leads");
      const name = `Ana ${uniq("Conf")}`;
      const email = uniqEmail("conf");
      const phone = uniqPhone();
      const honoree = `Sofi${Date.now().toString(36)}`;

      await ensureConfiguratorCatalogMatchesDb(page, db); // precondición de entorno (caché compartida entre carriles)
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Diseñemos juntas tu celebración");

      // 1. Ocasión
      await page.getByRole("radio", { name: /^Cumpleaños/ }).click();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      // 2. Fecha: primer día disponible del calendario (o el mes siguiente si no hay)
      await expect(page.getByRole("heading", { name: "¿Cuándo será?" })).toBeVisible();
      const grid = page.getByRole("grid");
      await expect(grid).not.toHaveAttribute("aria-busy", "true");
      let available = grid.getByRole("button", { name: /: Disponible$/ });
      if ((await available.count()) === 0) {
        await page.getByRole("button", { name: "Mes siguiente" }).click();
        await expect(grid).not.toHaveAttribute("aria-busy", "true");
        available = grid.getByRole("button", { name: /: Disponible$/ });
      }
      await available.first().click();
      await expect(page.getByText("Elige un día en el calendario.")).toHaveCount(0);
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      // 3. Zona: primera zona activa
      await expect(page.getByRole("heading", { name: "¿Dónde será?" })).toBeVisible();
      await page.getByRole("radio").first().click();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      // 4. Invitadas (default) → 5. Estilo
      await expect(page.getByRole("heading", { name: "¿Cuántas personas serán?" })).toBeVisible();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      await expect(page.getByRole("heading", { name: "¿Qué estilo te enamora?" })).toBeVisible();
      await page.getByRole("radio").first().click();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      // 6. Experiencia → 7. Menú (preseleccionado) → 8. Extras
      await expect(page.getByRole("heading", { name: "Elige tu experiencia" })).toBeVisible();
      await page.getByRole("radio").first().click();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      await expect(page.getByRole("heading", { name: "¿Qué menú les servimos?" })).toBeVisible();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      await expect(page.getByRole("heading", { name: "¿Algún detalle extra?" })).toBeVisible();
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      // 9. Preferencias
      await expect(page.getByRole("heading", { name: "Hazla tuya" })).toBeVisible();
      await page.getByLabel("¿A quién celebramos?").fill(honoree);
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      // 10. Presupuesto
      await expect(page.getByRole("heading", { name: "¿Qué presupuesto tienes en mente?" })).toBeVisible();
      await page.getByRole("radio", { name: /Prefiero platicarlo/ }).click();
      await page.getByRole("button", { name: "Ver mi resumen" }).click();

      // Resumen con estimado calculado en servidor (sin costos internos)
      await expect(page.getByRole("heading", { name: "Así se ve tu experiencia" })).toBeVisible();
      await expect(page.getByText("Calculando tu estimado…")).toHaveCount(0);
      const summaryText = await page.getByRole("main").innerText();
      expect(summaryText, "el público no ve costos ni márgenes").not.toMatch(/margen|costo estimado|utilidad/i);

      await page.getByLabel("Tu nombre").fill(name);
      await page.getByLabel("WhatsApp o teléfono").fill(phone);
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByRole("checkbox", { name: /aviso de privacidad/ }).click();
      await page.getByRole("button", { name: "Consultar disponibilidad" }).click();

      // UI: confirmación con folio
      await expect(page.getByRole("heading", { name: `¡Gracias, ${name.split(" ")[0]}!` })).toBeVisible();
      await expect(page.getByText("Tu folio", { exact: true })).toBeVisible();

      // Base: lead NEW + clienta + timeline + snapshot + notificaciones
      const lead = await db.lead.findFirst({
        where: { email },
        include: { customer: true, snapshot: true, activities: true },
      });
      expect(lead, "lead creado").not.toBeNull();
      expect(lead!.status).toBe("NEW");
      expect(lead!.source).toBe("CONFIGURATOR");
      expect(lead!.phone, "teléfono normalizado a +52").toBe(`+52${phone}`);
      expect(lead!.honoreeName).toBe(honoree);
      expect(lead!.customer?.email).toBe(email);
      expect(lead!.eventDate).not.toBeNull();
      expect(lead!.experienceId).not.toBeNull();
      expect(lead!.estimatedTotalCents ?? 0).toBeGreaterThan(0);
      expect(lead!.snapshot, "snapshot de la configuración").not.toBeNull();
      expect((lead!.snapshot!.estimate as { totalCents?: number }).totalCents).toBe(lead!.estimatedTotalCents);
      expect(lead!.activities.some((a) => a.type === "CREATED" && a.toStatus === "NEW")).toBe(true);
      // El total que vio la clienta es el que recalculó el servidor
      expect(summaryText).toMatch(moneyRx(lead!.estimatedTotalCents!));
      await expect(page.getByText(lead!.code, { exact: true })).toBeVisible();
      await expectNotification(db, { leadId: lead!.id, type: "LEAD_RECEIVED" }, "aviso LEAD_RECEIVED a la clienta");
      await expectNotification(db, { leadId: lead!.id, type: "GENERIC" }, "aviso al equipo de nuevo lead");

      // La fundadora lo encuentra en /admin/leads y abre el detalle
      const owner = await deskPage("owner");
      await owner.goto(`/admin/leads?q=${encodeURIComponent(lead!.code)}`);
      await expect(owner.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
      const link = owner.getByRole("link", { name });
      await expect(link).toBeVisible();
      await link.click();
      await owner.waitForURL(`**/admin/leads/${lead!.id}`);
      await expect(owner.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(owner.getByText(lead!.code).first()).toBeVisible();
      await expect(owner.getByText("Nuevo").first()).toBeVisible();
    },
  );

  test(
    "[CRIT-010] formulario de contacto público → lead CONTACT_FORM + clienta + notificación → visible en admin",
    { tag: ["@P0", "@module:public", "@mobile"] },
    async ({ page, deskPage, db, evidence }) => {
      evidence("anonimo", "/contacto → Enviar mensaje; luego owner busca el folio");
      const name = `Marisol ${uniq("Cto")}`;
      const email = uniqEmail("contacto");
      const phone = uniqPhone();
      const message = `Queremos un brunch para 10 amigas en Polanco (${uniq("msg")}).`;

      await page.goto("/contacto");
      await page.getByLabel("Nombre").fill(name);
      await page.getByLabel("WhatsApp o teléfono").fill(phone);
      await page.getByLabel("Correo electrónico").fill(email);
      await page.getByLabel("¿Qué quieres celebrar?").selectOption("BIRTHDAY");
      await page.getByLabel("Mensaje").fill(message);
      await page.getByRole("checkbox", { name: /aviso de privacidad/ }).click();
      await page.getByRole("button", { name: "Enviar mensaje" }).click();

      await expect(page.getByRole("heading", { name: /^¡Gracias, / })).toBeVisible();
      const lead = await db.lead.findFirst({ where: { email }, include: { customer: true, activities: true } });
      expect(lead, "lead creado por contacto").not.toBeNull();
      expect(lead!.source).toBe("CONTACT_FORM");
      expect(lead!.status).toBe("NEW");
      expect(lead!.notes).toContain(message);
      expect(lead!.customer?.email).toBe(email);
      expect(lead!.activities.some((a) => a.type === "CREATED")).toBe(true);
      await expect(page.getByText(lead!.code)).toBeVisible();
      await expectNotification(db, { leadId: lead!.id, type: "LEAD_RECEIVED" }, "aviso a la clienta");

      const owner = await deskPage("owner");
      await owner.goto(`/admin/leads?q=${encodeURIComponent(lead!.code)}`);
      await owner.getByRole("link", { name }).click();
      await owner.waitForURL(`**/admin/leads/${lead!.id}`);
      await expect(owner.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(owner.getByText(message).first()).toBeVisible();
    },
  );

  test(
    "[CRIT-002] lead → cotización (precio del servidor) → envío → la clienta acepta → anticipo mock → evento confirmado → portal",
    { tag: ["@P0", "@module:quotes", "@mobile"] },
    async ({ page, deskPage, db, evidence }) => {
      // Recorrido largo de punta a punta (≈10 pantallas, 3 actores): presupuesto de tiempo propio.
      test.setTimeout(180_000);
      evidence("owner", "Lead → Crear cotización → Enviar; clienta acepta y paga anticipo en el mock; portal");
      const { lead, customer, ref } = await createQuotableLead(db, { status: "QUALIFIED" });
      const pricing = await pricingSettings(db);

      // --- Fundadora: crear cotización desde el lead ---
      const owner = await deskPage("owner");
      await owner.goto(`/admin/leads/${lead.id}`);
      await owner.getByRole("link", { name: "Crear cotización" }).first().click();
      await owner.waitForURL(/\/admin\/quotes\/new\?leadId=/);
      await expect(owner.getByText(`A partir del lead ${lead.code}`)).toBeVisible();
      const live = owner.getByRole("complementary", { name: "Cálculo en vivo" });
      await expect(live.getByText(/\$\d/).first()).toBeVisible();
      await owner.getByRole("button", { name: "Crear cotización" }).click();
      await owner.waitForURL((u) => /\/admin\/quotes\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new"));
      const quoteId = owner.url().split("/").pop()!.split("?")[0]!;

      const draft = await db.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
      expect(draft, "cotización creada").not.toBeNull();
      expect(draft!.status).toBe("DRAFT");
      expect(draft!.leadId).toBe(lead.id);
      expect(draft!.customerId).toBe(customer.id);
      // Precio calculado en servidor con el catálogo vigente
      const base = draft!.items.find((i) => i.type === "BASE_EXPERIENCE");
      expect(base?.totalPriceCents, "precio base = catálogo").toBe(ref.experience.basePriceCents);
      const linesTotal = draft!.items.reduce((s, i) => s + i.totalPriceCents, 0);
      expect(draft!.subtotalCents).toBe(linesTotal);
      const expectedTotal = pricing.pricesIncludeTax
        ? draft!.subtotalCents - draft!.discountCents
        : draft!.subtotalCents - draft!.discountCents + draft!.taxCents;
      expect(draft!.totalCents).toBe(expectedTotal);
      expect(draft!.depositCents).toBe(Math.round((draft!.totalCents * draft!.depositBps) / 10_000));
      expect((await db.lead.findUnique({ where: { id: lead.id } }))?.status).toBe("QUOTED");
      expect(await db.auditLog.count({ where: { action: "quote.created", entityId: quoteId } })).toBe(1);

      // --- Enviar a la clienta ---
      await owner.getByRole("button", { name: "Enviar a la clienta" }).click();
      await owner.getByRole("alertdialog").getByRole("button", { name: "Enviar" }).click();
      await expect(owner.getByText("Propuesta enviada")).toBeVisible();
      await expect.poll(async () => (await db.quote.findUnique({ where: { id: quoteId } }))?.status).toBe("SENT");
      await expectNotification(db, { quoteId, type: "QUOTE_SENT" }, "QUOTE_SENT a la clienta");
      const sent = (await db.quote.findUnique({ where: { id: quoteId } }))!;

      // --- Clienta (celular): abre la propuesta y la acepta ---
      await page.goto(`/cotizacion/${sent.publicToken}`);
      await expect(page.getByRole("heading", { level: 1, name: sent.title })).toBeVisible();
      await expect(page.getByText(moneyRx(sent.totalCents)).first()).toBeVisible();
      const publicText = await page.getByRole("main").innerText();
      expect(publicText, "la propuesta pública no expone costos/márgenes").not.toMatch(/margen|costo estimado/i);
      expect(publicText).not.toMatch(moneyRx(sent.estimatedCostCents));
      await page.getByRole("button", { name: "Aceptar propuesta" }).first().click();
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await expect(dialog.getByLabel("Nombre completo")).toHaveValue(customer.name);
      await dialog.getByRole("checkbox").click();
      await dialog.getByRole("button", { name: "Aceptar y continuar" }).click();
      await expect(page.getByRole("heading", { name: "¡Propuesta aceptada!" })).toBeVisible();

      const accepted = await db.quote.findUnique({ where: { id: quoteId }, include: { booking: true, event: true } });
      expect(accepted!.status).toBe("ACCEPTED");
      expect(accepted!.booking?.depositRequiredCents).toBe(sent.depositCents);
      expect(accepted!.booking?.acceptedByName).toBe(customer.name);
      expect(accepted!.event?.status).toBe("PENDING_PAYMENT");
      expect((await db.lead.findUnique({ where: { id: lead.id } }))?.status).toBe("WON");
      const eventId = accepted!.event!.id;

      // --- Anticipo con la pasarela simulada ---
      await page.getByRole("button", { name: rx(`Pagar anticipo · `) }).click();
      await page.waitForURL(/\/pago\/mock\/mock_cs_/);
      await expect(page.getByRole("heading", { level: 1, name: rx(`Hola, ${customer.name.split(" ")[0]}`) })).toBeVisible();
      await page.getByRole("button", { name: /\(simulado\)$/ }).click();
      await page.waitForURL(/\/pago\/resultado\?/);
      await expect(page.getByRole("heading", { level: 1, name: "¡Pago recibido! Tu fecha está confirmada" })).toBeVisible();

      // Base: pago PAID, evento CONFIRMED, onEventConfirmed (checklist), notificaciones, webhook idempotente
      const payment = await db.payment.findFirst({ where: { bookingId: accepted!.booking!.id, kind: "DEPOSIT" } });
      expect(payment?.status).toBe("PAID");
      expect(payment?.amountCents).toBe(sent.depositCents);
      expect(payment?.provider).toBe("mock");
      const event = await db.event.findUnique({ where: { id: eventId } });
      expect(event?.status).toBe("CONFIRMED");
      expect(event?.portalToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      const templates = await db.checklistTemplateItem.count({
        where: { template: { active: true, OR: [{ experienceId: null }, { experienceId: event!.experienceId }] } },
      });
      if (templates > 0) {
        await expect
          .poll(() => db.eventChecklistItem.count({ where: { eventId } }), { message: "checklist instanciado al confirmar" })
          .toBeGreaterThan(0);
      }
      expect(await db.auditLog.count({ where: { action: "event.confirmed_by_payment", entityId: eventId } })).toBe(1);
      expect(
        await db.webhookEvent.count({ where: { provider: "mock", processedAt: { not: null }, payload: { path: ["paymentId"], equals: payment!.id } } }),
      ).toBe(1);
      await expectNotification(db, { eventId, type: "BOOKING_CONFIRMED" }, "BOOKING_CONFIRMED a la clienta");
      await expectNotification(db, { eventId, type: "PAYMENT_RECEIVED" }, "PAYMENT_RECEIVED a la clienta");

      // --- Portal de la clienta ---
      await page.getByRole("link", { name: "Ir a mi evento" }).click();
      await page.waitForURL(`**/mi-evento/${event!.portalToken}`);
      await expect(page.getByRole("heading", { level: 1, name: sent.title })).toBeVisible();
      await expect(page.getByText("¡Fecha confirmada!")).toBeVisible();
      const pago = page.getByRole("region", { name: "Pago" });
      await expect(pago.getByRole("definition").nth(1)).toHaveText(moneyRx(sent.depositCents));
      await expect(pago.getByRole("definition").nth(2)).toHaveText(moneyRx(sent.totalCents - sent.depositCents));

      // --- La fundadora ve el evento confirmado con su saldo ---
      await owner.goto(`/admin/events/${eventId}`);
      await expect(owner.getByRole("heading", { level: 1, name: sent.title })).toBeVisible();
      await expect(owner.getByText("Confirmado").first()).toBeVisible();
      await expect(owner.getByRole("region", { name: "Pagos" }).getByText(moneyRx(sent.totalCents - sent.depositCents)).first()).toBeVisible();
    },
  );

  test(
    "[CRIT-003] la clienta rechaza la propuesta por token → REJECTED, sin reserva ni evento, lead con actividad",
    { tag: ["@P0", "@module:quotes", "@mobile"] },
    async ({ page, deskPage, db, evidence }) => {
      evidence("clienta", "/cotizacion/[token] → No por ahora → Rechazar propuesta");
      const { quote, lead } = await createSentQuote(db);
      const reason = `Cambiamos la fecha ${uniq("rz")}`;

      await page.goto(`/cotizacion/${quote.publicToken}`);
      await expect(page.getByRole("heading", { level: 1, name: quote.title })).toBeVisible();
      await page.getByRole("button", { name: "No por ahora" }).click();
      const dialog = page.getByRole("dialog", { name: "¿Rechazar la propuesta?" });
      await dialog.getByLabel("Motivo (opcional)").fill(reason);
      await dialog.getByRole("button", { name: "Rechazar propuesta" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu respuesta" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);

      const after = await db.quote.findUnique({ where: { id: quote.id }, include: { booking: true, event: true } });
      expect(after!.status).toBe("REJECTED");
      expect(after!.rejectionReason).toBe(reason);
      expect(after!.rejectedAt).not.toBeNull();
      expect(after!.booking, "sin reserva").toBeNull();
      expect(after!.event, "sin evento").toBeNull();
      const activity = await db.leadActivity.findFirst({ where: { leadId: lead.id, message: { contains: quote.code } } });
      expect(activity?.message).toContain("rechazó");
      // Requisito (código actual): el rechazo NO cambia el estado del lead (sigue QUOTED para re-cotizar).
      expect((await db.lead.findUnique({ where: { id: lead.id } }))?.status).toBe("QUOTED");
      expect(await db.auditLog.count({ where: { action: "quote.rejected", entityId: quote.id } })).toBe(1);
      await expectNotification(db, { quoteId: quote.id, type: "GENERIC" }, "aviso al equipo del rechazo");

      // Recargar: el estado persiste y no se puede aceptar
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu respuesta" })).toBeVisible();

      // La fundadora ve la cotización rechazada
      const owner = await deskPage("owner");
      await owner.goto(`/admin/quotes/${quote.id}`);
      await expect(owner.getByText("Rechazada").first()).toBeVisible();
      await expect(owner.getByText(reason).first()).toBeVisible();
    },
  );
});
