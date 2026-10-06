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
    { tag: ["@P2", "@negative", "@regression"] },
    async ({ db, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-007" });
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
      expect(await db.payment.count({ where: { bookingId: booking.id } }), "un solo registro de pago para la reserva").toBe(1);
      expect(pending[0]!.amountCents).toBe(booking.depositRequiredCents);
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
      expect(ok).toEqual({
        status: "PENDING",
        eventConfirmed: false,
        eventCancelled: false,
        collectedAfterCancellation: false,
        failureReason: null,
      });
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
    { tag: ["@P1", "@negative", "@regression"] },
    async ({ page, db, apiAs, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-002" });
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
      // Corrección: la cancelación anula el checkout abierto en la misma transacción y la pasarela lo explica.
      expect(res.result).toMatchObject({ ok: false, code: "EVENT_CANCELLED" });
      expect(after.status).toBe("FAILED");
      expect(after.failureReason).toBe("Evento cancelado.");
      await expect(page.getByRole("heading", { level: 1, name: "Esta reserva fue cancelada" })).toBeVisible();
      await expect(page.getByText(/ya no acepta pagos y no se realizó ningún cargo/)).toBeVisible();
      expect(await db.webhookEvent.count({ where: { payload: { path: ["paymentId"], equals: payment.id } } }), "no se emitió ningún webhook").toBe(0);
      expect(await db.notificationLog.count({ where: { eventId: event.id, type: "PAYMENT_RECEIVED" } })).toBe(0);
      const cancelAudit = await db.auditLog.findFirstOrThrow({ where: { action: "event.cancelled", entityId: event.id } });
      expect(cancelAudit.after).toMatchObject({ voidedPayments: [payment.id] });
      // El enlace de resultado del pago anulado no ofrece reintentar ni asegura que no hubo cobro
      // (con una pasarela real la clienta pudo alcanzar a pagar; ese cobro se reembolsa).
      await page.goto(resultPath(payment.id));
      await expect(page.getByRole("heading", { level: 1, name: "Este pago se anuló" })).toBeVisible();
      await expect(page.getByText(/te lo reembolsaremos/)).toBeVisible();
      await expect(page.getByText(/No se realizó ningún cobro/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toHaveCount(0);
    },
  );

  test(
    "[PAY-023] si la pasarela confirma un cobro de un evento ya cancelado, se registra para reembolso sin reconfirmar ni avisar a la clienta",
    { tag: ["@P1", "@negative", "@regression"] },
    async ({ page, rolePage, db, apiAs, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-002" });
      evidence("clienta", "Checkout abierto → la fundadora cancela → la pasarela (webhook firmado) reporta el cobro igualmente");
      const { quote, booking, event } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      const owner = await apiAs("owner");
      okData(
        await callAction(owner, baseURL!, "cancelEventAction", { eventId: event.id, reason: "Cancelado antes del cobro (E2E)", notifyCustomer: false }, `/admin/events/${event.id}`),
      );
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");

      // Un proveedor real con la sesión todavía viva confirma el cobro: el dinero existe.
      const notifBefore = await db.notificationLog.count({ where: { eventId: event.id } });
      const evt = mockEvent(payment);
      const res = await postWebhook(request, evt);
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ applied: true, note: "cancelled_booking" });

      const p = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(p.status, "el cobro se registra para poder reembolsarlo").toBe("PAID");
      expect(p.amountCents).toBe(booking.depositRequiredCents);
      expect(p.providerPaymentId).toBe(evt.providerPaymentId);
      expect(p.notes).toMatch(/^Reembolso requerido: /);
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status, "el evento no se reconfirma").toBe("CANCELLED");
      expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).cancelledAt).not.toBeNull();
      expect(await db.auditLog.count({ where: { action: "event.confirmed_by_payment", entityId: event.id } })).toBe(0);
      expect(await db.auditLog.count({ where: { action: "payment.collected_after_cancellation", entityId: payment.id } })).toBe(1);
      expect((await db.webhookEvent.findFirstOrThrow({ where: { externalId: evt.id } })).error).toBe("cancelled_booking");
      // Sin confirmación normal a la clienta; el equipo recibe el aviso para reembolsar.
      expect(await db.notificationLog.count({ where: { eventId: event.id, type: { in: ["PAYMENT_RECEIVED", "BOOKING_CONFIRMED"] } } })).toBe(0);
      expect(await db.notificationLog.count({ where: { dedupeKey: `payment-received-team:${payment.id}` } })).toBe(0);
      const alert = await db.notificationLog.findUniqueOrThrow({ where: { dedupeKey: `cancelled-booking-payment:${payment.id}` } });
      expect(alert.type).toBe("GENERIC");
      expect(alert.eventId).toBe(event.id);
      expect(alert.subject).toContain("Revisar pago");
      expect(alert.body).toContain("ya estaba cancelado");
      expect(alert.body).toContain(formatMXN(payment.amountCents));
      expect(await db.notificationLog.count({ where: { eventId: event.id } }), "sólo el aviso al equipo").toBe(notifBefore + 1);

      // Reenvío del mismo evento del proveedor: idempotente, sin avisos duplicados.
      const dup = await postWebhook(request, evt);
      expect(dup.json).toMatchObject({ duplicate: true });
      expect(await db.notificationLog.count({ where: { eventId: event.id } })).toBe(notifBefore + 1);
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");

      // La clienta no ve «¡Pago recibido!» genérico: se le explica que se le reembolsará.
      await page.goto(resultPath(payment.id));
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu pago, pero tu evento está cancelado" })).toBeVisible();
      await expect(page.getByText(/avisamos al equipo para reembolsártelo/)).toBeVisible();

      // El panel del evento lo marca para reembolso.
      const admin = await rolePage("owner");
      await admin.goto(`/admin/events/${event.id}`);
      await expect(admin.getByRole("main").getByText("Reembolso requerido", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    },
  );

  test(
    "[PAY-024] si el equipo cancela mientras la clienta espera la confirmación, el resultado no asegura «sin cobro» ni ofrece reintentar",
    { tag: ["@P1", "@negative", "@regression"] },
    async ({ page, db, apiAs, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-002" });
      evidence("clienta", "Clienta en /pago/resultado esperando la confirmación → la fundadora cancela el evento → la página se actualiza sola");
      const { quote, event } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      await page.goto(resultPath(payment.id));
      await expect(page.getByRole("heading", { level: 1, name: "Confirmando tu pago…" })).toBeVisible();

      const owner = await apiAs("owner");
      okData(
        await callAction(owner, baseURL!, "cancelEventAction", { eventId: event.id, reason: "Cancelación mientras la clienta paga (E2E)", notifyCustomer: false }, `/admin/events/${event.id}`),
      );
      expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).failureReason).toBe("Evento cancelado.");

      // El poller recibe el pago anulado y el evento cancelado (la página se abrió cuando aún se podía reintentar).
      await expect(page.getByRole("heading", { level: 1, name: "Este pago se anuló" })).toBeVisible();
      await expect(page.getByText(/Si alcanzaste a completar el cobro en la pasarela, te lo reembolsaremos/)).toBeVisible();
      await expect(page.getByText(/No se realizó ningún cobro/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Volver a mi evento" })).toBeVisible();
      const status = okData(await paymentStatusCall(request, baseURL!, `/cotizacion/${quote.publicToken}`, payment.id, signResult(payment.id)));
      expect(status).toEqual({
        status: "FAILED",
        eventConfirmed: false,
        eventCancelled: true,
        collectedAfterCancellation: false,
        failureReason: "Evento cancelado.",
      });
    },
  );

  test(
    "[PAY-025] un anticipo pagado antes de cancelar el evento no se presenta como cobro por reembolsar",
    { tag: ["@P2", "@regression"] },
    async ({ page, db, apiAs, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-002" });
      evidence("clienta", "Paga el anticipo → evento confirmado → la fundadora lo cancela después → la clienta reabre su enlace de resultado");
      const { quote, event } = await createAcceptedQuote(db, request, baseURL!);
      const { payment } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
      const res = await postWebhook(request, mockEvent(payment));
      expect(res.json).toMatchObject({ applied: true });
      expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CONFIRMED");
      const owner = await apiAs("owner");
      okData(
        await callAction(owner, baseURL!, "cancelEventAction", { eventId: event.id, reason: "Cancelación con anticipo retenido (E2E)", notifyCustomer: false }, `/admin/events/${event.id}`),
      );
      const paid = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(paid.status).toBe("PAID");
      expect(paid.notes, "un pago previo a la cancelación no lleva la nota de reembolso").toBeNull();

      await page.goto(resultPath(payment.id));
      await expect(page.getByRole("heading", { level: 1, name: "¡Pago recibido!", exact: true })).toBeVisible();
      await expect(page.getByText(/Tu celebración está cancelada/)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Recibimos tu pago, pero tu evento está cancelado" })).toHaveCount(0);
      await expect(page.getByText(/reembolsártelo/)).toHaveCount(0);
      await expect(page.getByText(/invitar a tus amigas/)).toHaveCount(0);
    },
  );

  test(
    "[PAY-022] accesibilidad del checkout simulado y del resultado del pago",
    { tag: ["@P2", "@a11y", "@regression"] },
    async ({ page, db, request, baseURL }, testInfo) => {
      test.info().annotations.push({ type: "rol", description: "clienta" });
      test.info().annotations.push({ type: "regression", description: "BUG-009" });
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
