/**
 * Cotización por token (/cotizacion/[token]) — paquete 2 "Venta pública".
 * La clienta no tiene login: el token es su llave. Cada prueba crea su propia cotización (el seed es sólo lectura).
 */
import { expect, scanA11y, test, uniq } from "../fixtures";
import { failure, findInternalKeys, formatMXN, okData } from "../configurator/_helpers";
import {
  INTERNAL_MARKERS,
  acceptQuoteCall,
  claimFreeDate,
  createAcceptedQuote,
  createQuoteViaAdmin,
  createSentQuote,
  rejectQuoteCall,
} from "./_helpers";

const DAY_MS = 86_400_000;

test.describe("Cotización por token", { tag: ["@module:quotes"] }, () => {
  test(
    "[QPUB-001] la clienta ve su propuesta SENT con montos en MXN, sin costos internos, y se registra la vista",
    { tag: ["@P0", "@critical", "@mobile"] },
    async ({ page, db, evidence }) => {
      evidence("clienta", "Abre /cotizacion/<token> de una cotización SENT propia");
      const { quote, customer, totals } = await createSentQuote(db, { guestCount: 9 });
      const res = await page.goto(`/cotizacion/${quote.publicToken}`);
      expect(res?.status()).toBe(200);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1, name: quote.title })).toBeVisible();
      await expect(main.getByText(`Propuesta ${quote.code}`)).toBeVisible();
      await expect(main.getByText(`Hola ${customer.name.split(" ")[0]},`)).toBeVisible();
      for (const item of quote.items) {
        const row = main.getByRole("listitem").filter({ hasText: item.description });
        await expect(row).toContainText(formatMXN(item.totalPriceCents));
      }
      const pay = page.getByRole("complementary", { name: "Resumen de pago" });
      await expect(pay).toContainText(formatMXN(totals.total));
      await expect(pay).toContainText(formatMXN(totals.deposit));
      await expect(pay).toContainText(formatMXN(totals.total - totals.deposit));
      await expect(pay).toContainText(formatMXN(totals.tax));
      await expect(main.getByText(/Válida hasta el/)).toBeVisible();

      // Nada interno llega al navegador (ni en el HTML ni en el payload RSC).
      const html = await page.content();
      const raw = await (await page.request.get(`/cotizacion/${quote.publicToken}`)).text();
      for (const text of [html, raw]) {
        expect(text).not.toContain("NOTA INTERNA E2E");
        expect(text).not.toContain(String(INTERNAL_MARKERS.unitCostCents));
        expect(text).not.toContain(formatMXN(INTERNAL_MARKERS.unitCostCents));
        expect(text).not.toContain(String(INTERNAL_MARKERS.estimatedCostCents));
        for (const key of ["unitCostCents", "totalCostCents", "estimatedCostCents", "estimatedMarginCents", "marginBps", "internalNotes"]) {
          expect(text, `fuga de ${key}`).not.toContain(key);
        }
      }

      // Persistencia: primera vista registrada + analítica.
      await expect.poll(async () => (await db.quote.findUnique({ where: { id: quote.id } }))?.viewedAt).not.toBeNull();
      await expect
        .poll(() => db.analyticsEvent.count({ where: { type: "VIEW_QUOTE", quoteId: quote.id } }))
        .toBe(1);
      await page.reload();
      await expect(main.getByRole("heading", { level: 1, name: quote.title })).toBeVisible();
      expect(await db.analyticsEvent.count({ where: { type: "VIEW_QUOTE", quoteId: quote.id } }), "la vista se cuenta una sola vez").toBe(1);
    },
  );

  test(
    "[QPUB-002] aceptar la propuesta crea reserva + evento PENDING_PAYMENT, gana el lead y notifica",
    { tag: ["@P0", "@critical", "@mobile"] },
    async ({ page, db, apiAs, baseURL, evidence }) => {
      evidence("clienta", "Fundadora crea y envía cotización (QuoteEngine) → clienta acepta en /cotizacion/<token>");
      const owner = await apiAs("owner");
      const { quote, customer, lead, dateKey } = await createQuoteViaAdmin(db, owner, baseURL!);
      expect(quote.status).toBe("SENT");
      expect(quote.totalCents).toBeGreaterThan(0);
      expect(quote.depositCents).toBe(Math.round(quote.totalCents / 2));

      await page.goto(`/cotizacion/${quote.publicToken}`);
      await expect(page.getByRole("complementary", { name: "Resumen de pago" })).toContainText(formatMXN(quote.totalCents));
      await page.getByRole("button", { name: "Aceptar propuesta" }).click();
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await expect(dialog.getByLabel("Nombre completo")).toHaveValue(customer.name);
      const signer = `${customer.name} Pérez`;
      await dialog.getByLabel("Nombre completo").fill(signer);
      await dialog.getByRole("checkbox", { name: /Acepto los términos/ }).check();
      await dialog.getByRole("button", { name: "Aceptar y continuar" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "¡Propuesta aceptada!" })).toBeVisible();
      await expect(page.getByText("¡Listo! Tu propuesta quedó aceptada")).toBeVisible();
      await expect(page.getByRole("button", { name: `Pagar anticipo · ${formatMXN(quote.depositCents)}` })).toBeVisible();

      // Base: cotización, reserva, evento, lead, auditoría, notificaciones, analítica.
      const q = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(q.status).toBe("ACCEPTED");
      expect(q.acceptedAt).not.toBeNull();
      const booking = await db.booking.findUniqueOrThrow({ where: { quoteId: quote.id }, include: { event: true } });
      expect(booking.totalCents).toBe(quote.totalCents);
      expect(booking.depositRequiredCents).toBe(quote.depositCents);
      expect(booking.acceptedByName).toBe(signer);
      expect(booking.termsVersion).toBeTruthy();
      expect(booking.customerId).toBe(customer.id);
      const ev = booking.event;
      expect(ev.status).toBe("PENDING_PAYMENT");
      expect(ev.eventDate.toISOString().slice(0, 10)).toBe(dateKey);
      expect(ev.quoteId).toBe(quote.id);
      expect(ev.guestCount).toBe(quote.guestCount);
      expect(ev.portalToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      expect(booking.balanceDueAt!.getTime()).toBe(ev.startsAt.getTime() - 3 * DAY_MS);
      const l = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(l.status).toBe("WON");
      expect(await db.leadActivity.count({ where: { leadId: lead.id, toStatus: "WON" } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "quote.accepted", entityId: quote.id } })).toBe(1);
      await expect
        .poll(() => db.notificationLog.findMany({ where: { quoteId: quote.id, type: "QUOTE_ACCEPTED" }, select: { channel: true } }))
        .toEqual(expect.arrayContaining([{ channel: "EMAIL" }, { channel: "WHATSAPP" }]));
      expect(await db.notificationLog.count({ where: { dedupeKey: `quote-accepted-owner:${quote.id}` } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "ACCEPT_QUOTE", quoteId: quote.id } })).toBe(1);

      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "¡Propuesta aceptada!" })).toBeVisible();
      await expect(page.getByText(`Aceptada por ${signer}`)).toBeVisible();
      await expect(page.getByRole("link", { name: "Ir a mi portal" })).toHaveAttribute("href", `/mi-evento/${ev.portalToken}`);
      await expect(page.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);
    },
  );

  test(
    "[QPUB-003] rechazar con motivo deja la cotización REJECTED, sin reserva ni evento, y avisa al equipo",
    { tag: ["@P0", "@critical", "@mobile"] },
    async ({ page, db, evidence }) => {
      evidence("clienta", "Rechaza la propuesta con motivo");
      const { quote, lead } = await createSentQuote(db);
      const reason = `Cambiamos la fecha ${uniq("motivo")}`;
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await page.getByRole("button", { name: "No por ahora" }).click();
      const dialog = page.getByRole("dialog", { name: "¿Rechazar la propuesta?" });
      await dialog.getByLabel("Motivo (opcional)").fill(reason);
      await dialog.getByRole("button", { name: "Rechazar propuesta" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu respuesta" })).toBeVisible();

      const q = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(q.status).toBe("REJECTED");
      expect(q.rejectionReason).toBe(reason);
      expect(q.rejectedAt).not.toBeNull();
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
      expect(await db.event.count({ where: { quoteId: quote.id } })).toBe(0);
      expect(await db.leadActivity.count({ where: { leadId: lead!.id, message: { contains: reason } } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "quote.rejected", entityId: quote.id } })).toBe(1);
      await expect
        .poll(() => db.notificationLog.count({ where: { quoteId: quote.id, type: "GENERIC", subject: { contains: "rechazada" } } }))
        .toBe(1);

      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu respuesta" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);
    },
  );

  test(
    "[QPUB-004] aceptar exige nombre y apellido y los términos (front y back); la base no cambia",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Intenta aceptar sin datos válidos");
      const { quote } = await createSentQuote(db);
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await page.getByRole("button", { name: "Aceptar propuesta" }).click();
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await dialog.getByLabel("Nombre completo").fill("Lucía");
      await dialog.getByRole("button", { name: "Aceptar y continuar" }).click();
      await expect(dialog.getByText("Escribe nombre y apellido")).toBeVisible();
      await expect(dialog.getByText("Necesitamos tu aceptación para continuar")).toBeVisible();

      // Backend: aunque se salte la validación del navegador.
      const noTerms = failure(await acceptQuoteCall(request, baseURL!, quote.publicToken, { acceptTerms: false }));
      expect(noTerms.code).toBe("VALIDATION_ERROR");
      expect(noTerms.fieldErrors?.acceptTerms).toBeTruthy();
      const oneWord = failure(await acceptQuoteCall(request, baseURL!, quote.publicToken, { fullName: "Lucía" }));
      expect(oneWord.fieldErrors?.fullName).toBeTruthy();
      expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("SENT");
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
    },
  );

  test(
    "[QPUB-005] cotización con vigencia vencida: se muestra expirada, pasa a EXPIRED y no se puede aceptar",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Abre una propuesta SENT cuya vigencia ya pasó");
      const { quote } = await createSentQuote(db, { validUntil: new Date(Date.now() - DAY_MS) });
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await expect(page.getByRole("heading", { level: 1, name: "Esta propuesta expiró" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Pedir una propuesta actualizada/ })).toBeVisible();
      const q = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(q.status).toBe("EXPIRED");
      expect(q.expiredAt).not.toBeNull();
      const res = failure(await acceptQuoteCall(request, baseURL!, quote.publicToken));
      expect(res.code).toBe("CONFLICT");
      const rej = failure(await rejectQuoteCall(request, baseURL!, quote.publicToken, "tarde"));
      expect(rej.code).toBe("CONFLICT");
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
    },
  );

  test(
    "[QPUB-006] una propuesta ya aceptada no se puede volver a aceptar ni rechazar (una sola reserva)",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("clienta", "Reintenta aceptar/rechazar una propuesta ACCEPTED");
      const { quote } = await createAcceptedQuote(db, request, baseURL!);
      const again = failure(await acceptQuoteCall(request, baseURL!, quote.publicToken));
      expect(again.code).toBe("CONFLICT");
      expect(again.error).toContain("ya fue aceptada");
      const rej = failure(await rejectQuoteCall(request, baseURL!, quote.publicToken));
      expect(rej.code).toBe("CONFLICT");
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(1);
      expect(await db.event.count({ where: { quoteId: quote.id } })).toBe(1);
      expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("ACCEPTED");
    },
  );

  test(
    "[QPUB-007] una propuesta rechazada muestra el cierre y ya no se puede aceptar; rechazar de nuevo es idempotente",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Propuesta REJECTED");
      const { quote } = await createSentQuote(db);
      okData(await rejectQuoteCall(request, baseURL!, quote.publicToken, "Ya no haremos fiesta"));
      okData(await rejectQuoteCall(request, baseURL!, quote.publicToken, "otro motivo"));
      const q = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(q.rejectionReason, "el segundo rechazo no sobrescribe").toBe("Ya no haremos fiesta");
      expect(await db.auditLog.count({ where: { action: "quote.rejected", entityId: quote.id } })).toBe(1);
      const acc = failure(await acceptQuoteCall(request, baseURL!, quote.publicToken));
      expect(acc.code).toBe("CONFLICT");
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu respuesta" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aceptar propuesta" })).toHaveCount(0);
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
    },
  );

  test(
    "[QPUB-008] versión reemplazada: aceptar desde una pestaña con la versión vieja se rechaza y muestra la vigente",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Pestaña abierta en v1; el equipo reenvía v2; la clienta acepta en la pestaña vieja");
      const { quote } = await createSentQuote(db);
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await expect(page.getByRole("button", { name: "Aceptar propuesta" })).toBeVisible();
      // El equipo crea una nueva versión (monto distinto) y la reenvía: mismo token, versión 2.
      const newTotal = quote.totalCents + 250_000;
      await db.quote.update({
        where: { id: quote.id },
        data: { version: 2, totalCents: newTotal, depositCents: Math.round(newTotal / 2) },
      });
      await page.getByRole("button", { name: "Aceptar propuesta" }).click();
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await dialog.getByLabel("Nombre completo").fill("Clienta Versión Vieja");
      await dialog.getByRole("checkbox", { name: /Acepto los términos/ }).check();
      await dialog.getByRole("button", { name: "Aceptar y continuar" }).click();
      await expect(page.getByText(/La propuesta se actualizó mientras la revisabas/)).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("complementary", { name: "Resumen de pago" })).toContainText(formatMXN(newTotal));
      expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("SENT");
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
      // Backend: versión explícita vieja → conflicto; la vigente sí se acepta.
      const stale = failure(await acceptQuoteCall(request, baseURL!, quote.publicToken, { version: 1 }));
      expect(stale.code).toBe("CONFLICT");
      okData(await acceptQuoteCall(request, baseURL!, quote.publicToken, { version: 2 }));
      const booking = await db.booking.findUniqueOrThrow({ where: { quoteId: quote.id } });
      expect(booking.totalCents).toBe(newTotal);
    },
  );

  test(
    "[QPUB-009] doble clic en «Aceptar y continuar» crea una sola reserva y un solo evento",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("clienta", "Doble clic al aceptar");
      const { quote } = await createSentQuote(db);
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await page.getByRole("button", { name: "Aceptar propuesta" }).click();
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await dialog.getByLabel("Nombre completo").fill("Clienta Doble Clic");
      await dialog.getByRole("checkbox", { name: /Acepto los términos/ }).check();
      await dialog.getByRole("button", { name: "Aceptar y continuar" }).dblclick();
      await expect(page.getByRole("heading", { level: 1, name: "¡Propuesta aceptada!" })).toBeVisible();
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(1);
      expect(await db.event.count({ where: { quoteId: quote.id } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "quote.accepted", entityId: quote.id } })).toBe(1);
    },
  );

  test(
    "[QPUB-010] tokens inválidos, inexistentes o de borradores responden 404 genérico sin datos",
    { tag: ["@P1", "@negative", "@permissions"] },
    async ({ page, db, guard, request, baseURL, evidence }) => {
      evidence("anonimo", "Token mal formado / inexistente / cotización DRAFT");
      guard.allow(/404/); // los 404 son el resultado esperado de esta prueba
      const draft = await createSentQuote(db, { status: "DRAFT" });
      const tokens = ["abc", "x".repeat(43), draft.quote.publicToken, "%3Cscript%3Ealert(1)%3C%2Fscript%3E"];
      for (const t of tokens) {
        const res = await page.goto(`/cotizacion/${t}`);
        expect(res?.status(), `token ${t.slice(0, 12)}`).toBe(404);
        await expect(page.getByRole("heading", { level: 1, name: "No encontramos esta propuesta" })).toBeVisible();
        await expect(page.getByText(draft.quote.title)).toHaveCount(0);
      }
      const acc = failure(await acceptQuoteCall(request, baseURL!, draft.quote.publicToken));
      expect(acc.code).toBe("NOT_FOUND");
      const acc2 = failure(await acceptQuoteCall(request, baseURL!, "y".repeat(43)));
      expect(acc2.code).toBe("NOT_FOUND");
      expect((await db.quote.findUniqueOrThrow({ where: { id: draft.quote.id } })).status).toBe("DRAFT");
    },
  );

  test(
    "[QPUB-011] si la fecha ya se llenó, aceptar falla con aviso, la cotización sigue SENT y el equipo es notificado",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, evidence }) => {
      evidence("clienta", "La fecha (martes–viernes, capacidad 1) se ocupó con otro evento confirmado");
      const dateKey = await claimFreeDate(db, { weekdays: [2, 3, 4, 5] });
      const { quote, lead } = await createSentQuote(db, { dateKey });
      // Otro evento confirmado ocupa la única plaza del día.
      const other = await createSentQuote(db, { dateKey });
      const otherEvent = await db.event.create({
        data: {
          code: `EV-E2E-${uniq("x").slice(-6).toUpperCase()}`,
          title: "E2E evento que ocupa la fecha",
          status: "CONFIRMED",
          customerId: other.customer.id,
          eventDate: new Date(`${dateKey}T00:00:00.000Z`),
          startsAt: new Date(`${dateKey}T17:00:00.000Z`),
          endsAt: new Date(`${dateKey}T21:00:00.000Z`),
          guestCount: 8,
          micrositeSlug: uniq("e2e-ocupa").toLowerCase(),
          inviteToken: uniq("inv-token-e2e-ocupa-fecha"),
          portalToken: uniq("portal-token-e2e-ocupa-fecha"),
        },
      });
      expect(otherEvent.id).toBeTruthy();
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await page.getByRole("button", { name: "Aceptar propuesta" }).click();
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await dialog.getByLabel("Nombre completo").fill("Clienta Sin Fecha");
      await dialog.getByRole("checkbox", { name: /Acepto los términos/ }).check();
      await dialog.getByRole("button", { name: "Aceptar y continuar" }).click();
      await expect(page.getByText(/La fecha ya no está disponible/)).toBeVisible();
      expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("SENT");
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
      expect(await db.leadActivity.count({ where: { leadId: lead!.id, message: { contains: "intentó aceptar" } } })).toBe(1);
      await expect
        .poll(() => db.notificationLog.count({ where: { quoteId: quote.id, subject: { contains: "Fecha no disponible" } } }))
        .toBe(1);
    },
  );

  test(
    "[QPUB-012] la vista de una fundadora con sesión no marca la propuesta como vista por la clienta",
    { tag: ["@P3"] },
    async ({ rolePage, db, evidence }) => {
      evidence("owner", "Revisa la propuesta pública desde su sesión");
      const { quote } = await createSentQuote(db);
      const owner = await rolePage("owner");
      await owner.goto(`/cotizacion/${quote.publicToken}`);
      await expect(owner.getByRole("heading", { level: 1, name: quote.title })).toBeVisible();
      expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).viewedAt).toBeNull();
    },
  );

  test(
    "[QPUB-013] respuesta de aceptar sólo devuelve el token del portal (sin datos internos)",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("clienta", "Inspección de la respuesta de acceptQuoteAction");
      const { quote } = await createSentQuote(db);
      const data = okData(await acceptQuoteCall(request, baseURL!, quote.publicToken));
      expect(Object.keys(data)).toEqual(["portalToken"]);
      expect(findInternalKeys(data)).toEqual([]);
      const ev = await db.event.findUniqueOrThrow({ where: { quoteId: quote.id } });
      expect(data.portalToken).toBe(ev.portalToken);
    },
  );

  test(
    "[QPUB-014] accesibilidad (axe WCAG 2.1 AA) de la propuesta y del diálogo de aceptar",
    { tag: ["@P2", "@a11y"] },
    async ({ page, db }, testInfo) => {
      test.info().annotations.push({ type: "rol", description: "clienta" });
      const { quote } = await createSentQuote(db);
      await page.goto(`/cotizacion/${quote.publicToken}`);
      // Espera transiciones finitas (los spinners infinitos no cuentan) para que axe no mida colores a medias.
      const settle = () => page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== "running" || x.effect?.getTiming().iterations === Infinity));
      await settle();
      const a = await scanA11y(page, testInfo);
      await page.getByRole("button", { name: "Aceptar propuesta" }).click();
      await expect(page.getByRole("dialog", { name: "Aceptar propuesta" })).toBeVisible();
      await settle();
      const b = await scanA11y(page, testInfo, { include: '[role="dialog"]' });
      if (a.blocking.length + b.blocking.length) test.info().annotations.push({ type: "bug", description: "SAL-BUG-06" });
      expect([...a.blocking, ...b.blocking].map((v) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.html).join(" | ").slice(0, 200)}]`)).toEqual([]);
    },
  );

  test(
    "[QPUB-015] teclado: el diálogo de aceptar se abre con Enter, enfoca el nombre y al cerrarse devuelve el foco al botón",
    { tag: ["@P3", "@a11y"] },
    async ({ page, db, evidence }) => {
      test.info().annotations.push({ type: "bug", description: "SAL-BUG-05" });
      evidence("clienta", "Navegación con teclado del CTA principal");
      const { quote } = await createSentQuote(db);
      await page.goto(`/cotizacion/${quote.publicToken}`);
      const accept = page.getByRole("button", { name: "Aceptar propuesta" });
      await accept.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Aceptar propuesta" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Nombre completo")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(accept, "WCAG 2.4.3: el foco vuelve al control que abrió el diálogo").toBeFocused();
      // Control: el diálogo de rechazar (con DialogTrigger) sí devuelve el foco.
      const reject = page.getByRole("button", { name: "No por ahora" });
      await reject.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "¿Rechazar la propuesta?" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(reject).toBeFocused();
    },
  );
});
