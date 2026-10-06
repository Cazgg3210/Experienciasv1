/**
 * Pagos en línea con el proveedor MOCK — paquete 2 "Venta pública".
 * Regla del sistema: el pago se confirma SÓLO por webhook firmado (nunca por el redirect del navegador).
 * La parte de seguridad del webhook (firmas, CSRF) la cubre el paquete 1; aquí el flujo de negocio + idempotencia.
 */
import { expect, scanA11y, test } from "../fixtures";
import { callAction, failure, formatMXN, okData } from "../configurator/_helpers";
import { acceptQuoteCall, createAcceptedQuote, createQuoteViaAdmin, createSentQuote } from "../quote-public/_helpers";
import {
  mockCheckoutCall,
  mockEvent,
  paymentStatusCall,
  postWebhook,
  resultPath,
  signResult,
  startCheckoutCall,
  startDepositCheckout,
} from "./_helpers";

test.describe("Pagos (proveedor mock)", { tag: ["@module:payments"] }, () => {
  test(
    "[PAY-001] anticipo: pagar en el checkout simulado confirma el evento (webhook → PAID → onEventConfirmed)",
    { tag: ["@P0", "@critical", "@mobile"] },
    async ({ page, db, apiAs, request, baseURL, evidence }) => {
      evidence("clienta", "Cotización real enviada por la fundadora → aceptada → Pagar anticipo → checkout simulado → resultado");
      const owner = await apiAs("owner");
      const { quote, customer } = await createQuoteViaAdmin(db, owner, baseURL!);
      okData(await acceptQuoteCall(request, baseURL!, quote.publicToken, { fullName: `${customer.name} López` }));
      const booking = await db.booking.findUniqueOrThrow({ where: { quoteId: quote.id }, include: { event: true } });
      const deposit = booking.depositRequiredCents;

      await page.goto(`/cotizacion/${quote.publicToken}`);
      await page.getByRole("button", { name: `Pagar anticipo · ${formatMXN(deposit)}` }).click();
      await page.waitForURL(/\/pago\/mock\/mock_cs_[\w-]+\?from=quote/);
      await expect(page.getByRole("heading", { level: 1, name: `Hola, ${customer.name.split(" ")[0]}` })).toBeVisible();
      await expect(page.getByText("Pasarela de pago simulada — modo demo.")).toBeVisible();
      await expect(page.getByRole("main")).toContainText(formatMXN(deposit));
      await page.getByRole("button", { name: `Pagar ${formatMXN(deposit)} (simulado)` }).click();
      await page.waitForURL(/\/pago\/resultado\?p=\w+&s=[\w-]+/);
      await expect(page.getByRole("heading", { level: 1, name: "¡Pago recibido! Tu fecha está confirmada" })).toBeVisible();

      // Base: pago cobrado por webhook firmado, evento confirmado y ciclo de vida ejecutado.
      const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id, kind: "DEPOSIT" } });
      expect(payment.status).toBe("PAID");
      expect(payment.amountCents).toBe(deposit);
      expect(payment.provider).toBe("mock");
      expect(payment.providerPaymentId).toMatch(/^mock_pi_/);
      expect(payment.feeCents).toBe(Math.round((deposit * 360) / 10000) + 300);
      expect(payment.paidAt).not.toBeNull();
      const hook = await db.webhookEvent.findFirstOrThrow({ where: { provider: "mock", payload: { path: ["paymentId"], equals: payment.id } } });
      expect(hook.type).toBe("payment.succeeded");
      expect(hook.signatureValid).toBe(true);
      expect(hook.processedAt).not.toBeNull();
      const ev = await db.event.findUniqueOrThrow({ where: { id: booking.eventId } });
      expect(ev.status).toBe("CONFIRMED");
      expect(await db.auditLog.count({ where: { action: "event.confirmed_by_payment", entityId: ev.id } })).toBe(1);
      expect(await db.eventChecklistItem.count({ where: { eventId: ev.id } }), "checklists instanciados").toBeGreaterThan(0);
      const reqs = await db.experienceInventoryRequirement.count({ where: { experienceId: ev.experienceId! } });
      if (reqs > 0) expect(await db.inventoryReservation.count({ where: { eventId: ev.id } }), "inventario reservado").toBeGreaterThan(0);
      await expect
        .poll(() => db.notificationLog.findMany({ where: { eventId: ev.id, type: "BOOKING_CONFIRMED" }, select: { channel: true } }))
        .toEqual(expect.arrayContaining([{ channel: "EMAIL" }, { channel: "WHATSAPP" }]));
      expect(await db.notificationLog.count({ where: { eventId: ev.id, type: "PAYMENT_RECEIVED" } })).toBeGreaterThanOrEqual(1);
      expect(await db.notificationLog.count({ where: { dedupeKey: `payment-received-team:${payment.id}` } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "START_PAYMENT", eventId: ev.id } })).toBe(1);
      expect(await db.analyticsEvent.count({ where: { type: "PAYMENT_SUCCESS", eventId: ev.id } })).toBe(1);

      // La propuesta y el portal reflejan el pago.
      await expect(page.getByRole("link", { name: "Ir a mi evento" })).toHaveAttribute("href", `/mi-evento/${ev.portalToken}`);
      await page.goto(`/cotizacion/${quote.publicToken}`);
      await expect(page.getByText("Anticipo recibido")).toBeVisible();
      await expect(page.getByRole("button", { name: /Pagar anticipo/ })).toHaveCount(0);
      const portal = await page.goto(`/mi-evento/${ev.portalToken}`);
      expect(portal?.status()).toBe(200);
      await expect(page.getByRole("main")).toContainText(ev.title);
    },
  );

  test(
    "[PAY-002] pago rechazado: queda FAILED con motivo, el evento sigue pendiente y se puede reintentar",
    { tag: ["@P0", "@critical"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Simular pago rechazado → Intentar de nuevo");
      const { quote, booking, event } = await createAcceptedQuote(db, request, baseURL!);
      const { url, payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await page.goto(url);
      await page.getByRole("button", { name: "Simular pago rechazado" }).click();
      await page.waitForURL(/\/pago\/resultado/);
      await expect(page.getByRole("heading", { level: 1, name: "Tu pago no se completó" })).toBeVisible();
      await expect(page.getByText("Tu banco rechazó el cargo (simulación).", { exact: false })).toBeVisible();
      const failed = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(failed.status).toBe("FAILED");
      expect(failed.failureReason).toContain("rechazó");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
      expect(await db.notificationLog.count({ where: { eventId: event.id, type: "BOOKING_CONFIRMED" } })).toBe(0);

      await page.getByRole("button", { name: "Intentar de nuevo" }).click();
      await page.waitForURL(/\/pago\/mock\/mock_cs_/);
      const retry = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id, status: "PENDING" } });
      expect(retry.id).not.toBe(payment.id);
      expect(retry.amountCents).toBe(booking.depositRequiredCents);
      await expect(page.getByRole("button", { name: `Pagar ${formatMXN(retry.amountCents)} (simulado)` })).toBeVisible();
    },
  );

  test(
    "[PAY-003] cancelar en la pasarela regresa a la propuesta sin cobrar ni confirmar",
    { tag: ["@P1"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Cancelar en el checkout simulado");
      const { quote, event } = await createAcceptedQuote(db, request, baseURL!);
      const { url, payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await page.goto(url);
      await page.getByRole("button", { name: "Cancelar" }).click();
      await page.waitForURL(new RegExp(`/cotizacion/${quote.publicToken}$`));
      await expect(page.getByRole("heading", { level: 1, name: "¡Propuesta aceptada!" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Pagar anticipo/ })).toBeVisible();
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
    },
  );

  test(
    "[PAY-004] checkout inexistente o mal formado responde 404 y la acción simulada no procede",
    { tag: ["@P1", "@negative"] },
    async ({ page, guard, request, baseURL, evidence }) => {
      evidence("anonimo", "IDs de checkout inexistentes / inválidos");
      guard.allow(/404/); // 404 esperado
      for (const id of ["mock_cs_noexiste1234567890", "abc", "mock_cs_%3Cscript%3E"]) {
        const res = await page.goto(`/pago/mock/${id}`);
        expect(res?.status(), id).toBe(404);
        await expect(page.getByRole("heading", { level: 1, name: "No encontramos este pago" })).toBeVisible();
      }
      const call = failure(await mockCheckoutCall(request, baseURL!, { checkoutId: "mock_cs_noexiste1234567890", outcome: "success" }));
      expect(call.code).toBe("NOT_FOUND");
      const bad = failure(
        await mockCheckoutCall(request, baseURL!, { checkoutId: "../../admin", outcome: "success" }, "/pago/mock/mock_cs_noexiste1234567890"),
      );
      expect(bad.code).toBe("VALIDATION_ERROR");
    },
  );

  test(
    "[PAY-005] pagar dos veces: el checkout ya procesado no vuelve a cobrar y el anticipo cubierto bloquea otro checkout",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Reabre el enlace de pago ya cobrado y reintenta");
      const { quote, booking, event } = await createAcceptedQuote(db, request, baseURL!);
      const { checkoutId, payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      okData(await mockCheckoutCall(request, baseURL!, { checkoutId, outcome: "success", from: "quote" }));
      await expect.poll(async () => (await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");
      const notifBefore = await db.notificationLog.count({ where: { eventId: event.id } });

      await page.goto(`/pago/mock/${checkoutId}`);
      await expect(page.getByRole("heading", { level: 1, name: "Este pago ya fue procesado" })).toBeVisible();
      await expect(page.getByRole("button", { name: /simulado/ })).toHaveCount(0);
      await page.getByRole("link", { name: "Ver el estado de mi pago" }).click();
      await expect(page.getByRole("heading", { level: 1, name: /¡Pago recibido!/ })).toBeVisible();

      const again = okData(await mockCheckoutCall(request, baseURL!, { checkoutId, outcome: "success" }));
      expect(again.redirectTo).toContain(`/pago/resultado?p=${payment.id}`);
      const blocked = failure(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }));
      expect(blocked.code).toBe("DEPOSIT_COVERED");
      expect(blocked.error).toBe("Tu anticipo ya está cubierto");
      const paid = await db.payment.findMany({ where: { bookingId: booking.id, status: "PAID" } });
      expect(paid).toHaveLength(1);
      expect(await db.webhookEvent.count({ where: { payload: { path: ["paymentId"], equals: payment.id } } })).toBe(1);
      expect(await db.notificationLog.count({ where: { eventId: event.id } })).toBe(notifBefore);
    },
  );

  test(
    "[PAY-006] iniciar el checkout de nuevo reutiliza el mismo pago pendiente (sin duplicar cobros)",
    { tag: ["@P1"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("clienta", "Pagar anticipo, regresa y vuelve a pulsar Pagar anticipo");
      const { quote, booking } = await createAcceptedQuote(db, request, baseURL!);
      const a = okData(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" })).url;
      const b = okData(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" })).url;
      expect(b).toBe(a);
      expect(await db.payment.count({ where: { bookingId: booking.id, status: "PENDING" } }), "un solo pago pendiente").toBe(1);
    },
  );

  test(
    "[PAY-019] dos solicitudes simultáneas de checkout (dos pestañas / reintento de red) no deben duplicar el pago pendiente",
    { tag: ["@P2", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "bug", description: "SAL-BUG-01" });
      evidence("clienta", "Dos startCheckoutAction DEPOSIT en paralelo para la misma reserva");
      const { quote, booking } = await createAcceptedQuote(db, request, baseURL!);
      const [a, b] = await Promise.all([
        startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }),
        startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }),
      ]);
      const urls = [okData(a).url, okData(b).url];
      const pending = await db.payment.findMany({ where: { bookingId: booking.id, status: "PENDING" }, select: { id: true, amountCents: true } });
      expect(pending, `pagos pendientes: ${JSON.stringify(pending)} urls: ${urls.join(" ")}`).toHaveLength(1);
      expect(new Set(urls).size).toBe(1);
    },
  );

  test(
    "[PAY-007] no se puede iniciar un pago con un token sin reserva, inexistente o datos inválidos",
    { tag: ["@P1", "@negative", "@permissions"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "startCheckoutAction con tokens/valores manipulados");
      const { quote } = await createSentQuote(db); // SENT: aún sin reserva
      const notAccepted = failure(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }));
      expect(notAccepted.code).toBe("NOT_FOUND");
      expect(notAccepted.error).toContain("No encontramos esta reserva");
      const unknown = failure(
        await startCheckoutCall(request, baseURL!, { token: "z".repeat(43), tokenType: "portal", kind: "BALANCE" }, `/cotizacion/${quote.publicToken}`),
      );
      expect(unknown.code).toBe("NOT_FOUND");
      const badKind = failure(
        await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "GRATIS" as never }),
      );
      expect(badKind.code).toBe("VALIDATION_ERROR");
      expect(await db.payment.count({ where: { booking: { customerId: quote.customerId } } })).toBe(0);
      expect(await db.booking.count({ where: { quoteId: quote.id } })).toBe(0);
    },
  );

  test(
    "[PAY-008] el estado del pago sólo se consulta con la firma correcta del enlace",
    { tag: ["@P1", "@negative", "@permissions"] },
    async ({ page, db, guard, request, baseURL, evidence }) => {
      evidence("anonimo", "getPaymentStatusAction y /pago/resultado con firmas alteradas");
      guard.allow(/404/); // páginas de resultado con firma inválida responden 404 (esperado)
      const a = await createAcceptedQuote(db, request, baseURL!);
      const b = await createAcceptedQuote(db, request, baseURL!);
      const pa = (await startDepositCheckout(db, request, baseURL!, a.quote.publicToken)).payment;
      const pb = (await startDepositCheckout(db, request, baseURL!, b.quote.publicToken)).payment;
      const route = `/cotizacion/${a.quote.publicToken}`;
      const ok = okData(await paymentStatusCall(request, baseURL!, route, pa.id, signResult(pa.id)));
      expect(ok).toEqual({ status: "PENDING", eventConfirmed: false, failureReason: null });
      const tampered = failure(await paymentStatusCall(request, baseURL!, route, pa.id, signResult(pa.id).replace(/^./, (c) => (c === "A" ? "B" : "A"))));
      expect(tampered.code).toBe("NOT_FOUND");
      const crossed = failure(await paymentStatusCall(request, baseURL!, route, pb.id, signResult(pa.id)));
      expect(crossed.code).toBe("NOT_FOUND");

      const good = await page.goto(resultPath(pa.id));
      expect(good?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Confirmando tu pago…" })).toBeVisible();
      const bad = await page.goto(`/pago/resultado?p=${pb.id}&s=${signResult(pa.id)}`);
      expect(bad?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "No encontramos este pago" })).toBeVisible();
      await expect(page.getByText(b.event.title)).toHaveCount(0);
    },
  );

  test(
    "[PAY-009] webhook firmado payment.succeeded confirma una vez; el reenvío del mismo evento es idempotente",
    { tag: ["@P1", "@regression"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Proveedor de pagos (mock) → POST /api/webhooks/payments/mock");
      const { quote, event } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      const evt = mockEvent(payment);
      const first = await postWebhook(request, evt);
      expect(first.status).toBe(200);
      expect(first.json).toMatchObject({ received: true, type: "payment.succeeded", applied: true });
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
      const confirmations = await db.notificationLog.count({ where: { eventId: event.id, type: "BOOKING_CONFIRMED" } });
      const checklist = await db.eventChecklistItem.count({ where: { eventId: event.id } });

      const dup = await postWebhook(request, evt);
      expect(dup.status).toBe(200);
      expect(dup.json).toMatchObject({ received: true, duplicate: true });
      const other = await postWebhook(request, mockEvent(payment)); // otro id de evento, mismo pago
      expect(other.status).toBe(200);
      expect(other.json).toMatchObject({ applied: false, note: "already_paid" });

      expect(await db.webhookEvent.count({ where: { provider: "mock", externalId: evt.id } })).toBe(1);
      expect(await db.notificationLog.count({ where: { eventId: event.id, type: "BOOKING_CONFIRMED" } })).toBe(confirmations);
      expect(await db.eventChecklistItem.count({ where: { eventId: event.id } })).toBe(checklist);
      expect(await db.payment.count({ where: { bookingId: payment.bookingId, status: "PAID" } })).toBe(1);
    },
  );

  test(
    "[PAY-010] webhook payment.failed marca FAILED; un reintento cobrado pasa a PAID y un fallo tardío no lo degrada",
    { tag: ["@P1"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Secuencia failed → succeeded → failed del proveedor");
      const { quote, event } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      const f1 = await postWebhook(request, mockEvent(payment, { type: "payment.failed", failureReason: "Fondos insuficientes" }));
      expect(f1.json).toMatchObject({ applied: true });
      const p1 = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(p1.status).toBe("FAILED");
      expect(p1.failureReason).toBe("Fondos insuficientes");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
      const ok = await postWebhook(request, mockEvent(payment));
      expect(ok.json).toMatchObject({ applied: true });
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");
      const late = await postWebhook(request, mockEvent(payment, { type: "payment.failed", failureReason: "tarde" }));
      expect(late.json).toMatchObject({ applied: false, note: "ignored_paid" });
      const p3 = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(p3.status).toBe("PAID");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
    },
  );

  test(
    "[PAY-011] cobro menor al esperado no marca PAID: queda en revisión manual y se avisa al equipo",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Webhook con amountCents menor al del pago");
      const { quote, event } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      const evt = mockEvent(payment, { amountCents: payment.amountCents - 100 });
      const res = await postWebhook(request, evt);
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ applied: false });
      expect(String(res.json?.note)).toContain("amount_mismatch");
      const p = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(p.status).toBe("PENDING");
      expect(p.notes).toContain("Revisión manual");
      expect((await db.webhookEvent.findFirstOrThrow({ where: { externalId: evt.id } })).error).toContain("amount_mismatch");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PENDING_PAYMENT");
      expect(await db.notificationLog.count({ where: { dedupeKey: `amount-mismatch:${evt.id}` } })).toBe(1);
    },
  );

  test(
    "[PAY-012] webhook de un pago desconocido se registra sin efectos; firma inválida no procesa nada",
    { tag: ["@P2", "@negative"] },
    async ({ db, request, evidence }) => {
      evidence("anonimo", "Webhooks con pago inexistente / firma alterada / proveedor desconocido / GET");
      const ghost = mockEvent({ id: "cnoexistepago000000000000", providerCheckoutId: null, amountCents: 50000 });
      const res = await postWebhook(request, ghost);
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ applied: false, note: "payment_not_found" });
      expect((await db.webhookEvent.findFirstOrThrow({ where: { externalId: ghost.id } })).error).toBe("payment_not_found");
      const bad = mockEvent({ id: "cnoexistepago000000000001", providerCheckoutId: null, amountCents: 50000 });
      const unsigned = await postWebhook(request, bad, { signature: "t=1,v1=deadbeef" });
      expect(unsigned.status).toBe(400);
      expect(await db.webhookEvent.count({ where: { externalId: bad.id } })).toBe(0);
      const unknown = await postWebhook(request, bad, { provider: "paypal" });
      expect(unknown.status).toBe(404);
      const get = await request.get("/api/webhooks/payments/mock", { failOnStatusCode: false });
      expect(get.status()).toBe(405);
    },
  );

  test(
    "[PAY-013] reembolso reportado por la pasarela: PARTIAL_REFUND + registro REFUND + auditoría, idempotente",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Webhook refund.succeeded");
      const { quote } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      expect((await postWebhook(request, mockEvent(payment))).json).toMatchObject({ applied: true });
      const half = Math.floor(payment.amountCents / 2);
      const refund = mockEvent(payment, { type: "refund.succeeded", refundedCents: half });
      expect((await postWebhook(request, refund)).json).toMatchObject({ applied: true });
      const p = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(p.status).toBe("PARTIAL_REFUND");
      expect(p.refundedCents).toBe(half);
      const rows = await db.payment.findMany({ where: { refundOfId: payment.id, kind: "REFUND" } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.amountCents).toBe(half);
      expect(await db.auditLog.count({ where: { action: "payment.refunded", entityId: payment.id } })).toBe(1);
      expect((await postWebhook(request, refund)).json).toMatchObject({ duplicate: true });
      expect(await db.payment.count({ where: { refundOfId: payment.id } })).toBe(1);
    },
  );

  test(
    "[PAY-014] /pago/resultado espera la confirmación del webhook y se actualiza sola al llegar",
    { tag: ["@P1"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Regresa de la pasarela antes que el webhook");
      const { quote } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await page.goto(resultPath(payment.id));
      await expect(page.getByRole("heading", { level: 1, name: "Confirmando tu pago…" })).toBeVisible();
      expect((await postWebhook(request, mockEvent(payment))).json).toMatchObject({ applied: true });
      await expect(page.getByRole("heading", { level: 1, name: "¡Pago recibido! Tu fecha está confirmada" })).toBeVisible({ timeout: 20_000 });
    },
  );

  test(
    "[PAY-015] enlace de pago con más de 1 h expira: no se puede pagar y no se cobra",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Abre un enlace de pago viejo");
      const { quote } = await createAcceptedQuote(db, request, baseURL!);
      const { checkoutId, payment, url } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await db.payment.update({ where: { id: payment.id }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } });
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1, name: "Este enlace de pago expiró" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Volver a mi propuesta" })).toHaveAttribute("href", `/cotizacion/${quote.publicToken}`);
      const res = failure(await mockCheckoutCall(request, baseURL!, { checkoutId, outcome: "success" }));
      expect(res.code).toBe("CHECKOUT_EXPIRED");
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
      // Un nuevo intento genera un checkout nuevo (no reutiliza el vencido).
      const fresh = okData(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }));
      expect(fresh.url).not.toContain(checkoutId);
    },
  );

  test(
    "[PAY-016] si el saldo cambió (pago manual parcial), el enlace viejo ya no es vigente",
    { tag: ["@P2", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Checkout abierto + pago manual registrado en paralelo");
      const { quote, booking } = await createAcceptedQuote(db, request, baseURL!);
      const { checkoutId, payment, url } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await db.payment.create({
        data: {
          bookingId: booking.id,
          kind: "DEPOSIT",
          status: "PAID",
          method: "TRANSFER",
          provider: "manual",
          amountCents: 100_00,
          idempotencyKey: `e2e-manual-${payment.id}`,
          paidAt: new Date(),
        },
      });
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1, name: "Este enlace ya no está vigente" })).toBeVisible();
      const res = failure(await mockCheckoutCall(request, baseURL!, { checkoutId, outcome: "success" }));
      expect(res.code).toBe("CHECKOUT_STALE");
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    },
  );

  test(
    "[PAY-017] una reserva cancelada no acepta pagos",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("clienta", "Intenta pagar el anticipo de un evento cancelado");
      const { quote, booking, event } = await createAcceptedQuote(db, request, baseURL!);
      await db.event.update({ where: { id: event.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await db.booking.update({ where: { id: booking.id }, data: { cancelledAt: new Date(), cancellationReason: "E2E" } });
      const res = failure(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }));
      expect(res.code).toBe("EVENT_CANCELLED");
      expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
    },
  );

  test(
    "[PAY-021] un checkout abierto antes de que el equipo cancele el evento ya no debe poder cobrarse",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, apiAs, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "bug", description: "SAL-BUG-03" });
      evidence("clienta", "Clienta abre el pago; la fundadora cancela el evento (cancelEventAction); la clienta paga el enlace abierto");
      const { quote, booking, event } = await createAcceptedQuote(db, request, baseURL!);
      const { url, checkoutId, payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      const owner = await apiAs("owner");
      okData(
        await callAction(owner, baseURL!, "cancelEventAction", { eventId: event.id, reason: "La clienta canceló por teléfono (E2E)", notifyCustomer: false }, `/admin/events/${event.id}`),
      );
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CANCELLED");
      expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).cancelledAt).not.toBeNull();

      await page.goto(url);
      const payable = await page.getByRole("button", { name: /\(simulado\)$/ }).count();
      const res = await mockCheckoutCall(request, baseURL!, { checkoutId, outcome: "success", from: "quote" });
      await expect.poll(async () => (await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, { timeout: 10_000 }).not.toBe("PENDING").catch(() => undefined);
      const after = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      test.info().annotations.push({
        type: "observado",
        description: `botón de pago visible=${payable > 0}; acción=${JSON.stringify(res.result)}; pago=${after.status}`,
      });
      expect(payable, "la pasarela no debe ofrecer pagar un evento cancelado").toBe(0);
      expect(res.result?.ok, "el checkout simulado debe rechazar el cobro").toBe(false);
      expect(after.status, "no se cobra un anticipo de un evento cancelado").not.toBe("PAID");
    },
  );

  test(
    "[PAY-022] accesibilidad del checkout simulado y del resultado del pago",
    { tag: ["@P2", "@a11y"] },
    async ({ page, db, request, baseURL }, testInfo) => {
      test.info().annotations.push({ type: "rol", description: "clienta" });
      const { quote } = await createAcceptedQuote(db, request, baseURL!);
      const { url, payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await page.goto(url);
      await expect(page.getByRole("button", { name: /\(simulado\)$/ })).toBeVisible();
      // Espera transiciones finitas (las animaciones infinitas, como el spinner, no cuentan).
      const settle = () =>
        page.waitForFunction(() =>
          document.getAnimations().every((x) => x.playState !== "running" || x.effect?.getTiming().iterations === Infinity),
        );
      await settle();
      const a = await scanA11y(page, testInfo);
      await page.goto(resultPath(payment.id));
      await expect(page.getByRole("heading", { level: 1, name: "Confirmando tu pago…" })).toBeVisible();
      await settle();
      const b = await scanA11y(page, testInfo);
      const blocking = [...a.blocking, ...b.blocking].map((v) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.html).join(" | ").slice(0, 200)}]`);
      if (blocking.length) test.info().annotations.push({ type: "bug", description: "SAL-BUG-04" });
      expect(blocking).toEqual([]);
    },
  );

  test(
    "[PAY-018] saldo desde el portal: cobra total − anticipo y después ya no hay saldo pendiente",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("clienta", "Anticipo pagado → liquida el saldo desde /mi-evento/<token>");
      const { quote, booking, event } = await createAcceptedQuote(db, request, baseURL!);
      const dep = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      okData(await mockCheckoutCall(request, baseURL!, { checkoutId: dep.checkoutId, outcome: "success" }));
      await expect.poll(async () => (await db.payment.findUniqueOrThrow({ where: { id: dep.payment.id } })).status).toBe("PAID");
      const { url } = okData(await startCheckoutCall(request, baseURL!, { token: event.portalToken, tokenType: "portal", kind: "BALANCE" }));
      expect(url).not.toContain("from=quote");
      const checkoutId = new URL(url).pathname.split("/").pop()!;
      const bal = await db.payment.findFirstOrThrow({ where: { providerCheckoutId: checkoutId } });
      expect(bal.kind).toBe("BALANCE");
      expect(bal.amountCents).toBe(booking.totalCents - booking.depositRequiredCents);
      okData(await mockCheckoutCall(request, baseURL!, { checkoutId, outcome: "success", from: "portal" }));
      await expect.poll(async () => (await db.payment.findUniqueOrThrow({ where: { id: bal.id } })).status).toBe("PAID");
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
      const none = failure(await startCheckoutCall(request, baseURL!, { token: event.portalToken, tokenType: "portal", kind: "BALANCE" }));
      expect(none.code).toBe("NO_BALANCE");
    },
  );
});
