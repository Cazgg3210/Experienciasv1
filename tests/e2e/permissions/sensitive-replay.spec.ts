/**
 * Replay de acciones SENSIBLES como staff y anónimo (pago manual, reembolso, descuento, cancelar, cerrar, rotar token,
 * cambio de rol, ajustes y flags). Requests construidos con el id real de la acción (manifiesto del build) y la
 * página que la importa; un control positivo (OWNER) demuestra que el request es ejecutable.
 * También: la misma acción enviada a una página que no la importa (no se ejecuta) y con Origin ajeno (CSRF).
 */
import { expect, replayServerAction, test, wasAccepted, wasBlocked, wasDenied, type CapturedAction } from "../fixtures";
import { buildAction, createDraftQuote, createEventGraph, createTeamUser, dateKeyInDays, seedIds } from "./_helpers";
import type { APIRequestContext } from "@playwright/test";

async function deny(apiAs: (r: "staff" | null) => Promise<APIRequestContext>, action: CapturedAction) {
  for (const role of ["staff", null] as const) {
    const res = await replayServerAction(await apiAs(role), action);
    expect(wasDenied(res), `${role ?? "anónimo"}: ${res.outcome} ${res.status} ${res.redirectedTo ?? ""} ${res.text.slice(0, 160)}`).toBe(true);
    expect(res.redirectedTo, `${role ?? "anónimo"} detenido por el middleware`).toBe(role === "staff" ? "/staff" : `/login?callbackUrl=${encodeURIComponent(new URL(action.url).pathname)}`);
  }
}

test.describe("Acciones sensibles: replay con rol sin permiso", { tag: ["@module:auth", "@permissions"] }, () => {
  test("[PERM-150] pago manual: staff/anónimo denegados y sin pago; OWNER sí registra (con auditoría)", { tag: ["@P0", "@critical"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, { withBooking: true, totalCents: 2_000_000 });
    evidence("staff", `recordManualPaymentAction en /admin/events/${ev.eventId} (también anónimo y owner)`);
    const input = { eventId: ev.eventId, amountCents: 500_000, kind: "DEPOSIT", method: "TRANSFER", paidAt: dateKeyInDays(0), notes: "E2E replay" };
    const action = buildAction("recordManualPaymentAction", `/admin/events/${ev.eventId}`, input);
    await deny(apiAs, action);
    expect(await db.payment.count({ where: { bookingId: ev.bookingId } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: { in: [ev.eventId, ev.bookingId!] } } })).toBe(0);

    const ok = await replayServerAction(await apiAs("owner"), action);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    const payments = await db.payment.findMany({ where: { bookingId: ev.bookingId } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: "PAID", amountCents: 500_000, provider: "manual", method: "TRANSFER" });
    expect(await db.auditLog.count({ where: { action: { contains: "payment" }, OR: [{ entityId: payments[0]!.id }, { entityId: ev.eventId }] } })).toBeGreaterThan(0);
  });

  test("[PERM-151] reembolso: staff/anónimo denegados y el pago no cambia", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, { withBooking: true, totalCents: 2_000_000 });
    const paid = await db.payment.create({
      data: {
        bookingId: ev.bookingId!,
        kind: "DEPOSIT",
        status: "PAID",
        method: "TRANSFER",
        provider: "manual",
        amountCents: 1_000_000,
        idempotencyKey: `e2e-acc-${ev.eventId}`,
        paidAt: new Date(),
      },
    });
    evidence("staff", `refundPaymentAction sobre ${paid.id}`);
    await deny(apiAs, buildAction("refundPaymentAction", `/admin/events/${ev.eventId}`, { paymentId: paid.id, amountCents: 1_000_000, reason: "Reembolso forzado" }));
    const after = await db.payment.findUniqueOrThrow({ where: { id: paid.id } });
    expect({ status: after.status, refundedCents: after.refundedCents }).toEqual({ status: "PAID", refundedCents: 0 });
    expect(await db.payment.count({ where: { refundOfId: paid.id } })).toBe(0);
  });

  test("[PERM-152] descuento en cotización: staff/anónimo denegados; OWNER aplica con auditoría quote.discount_applied", { tag: ["@P0", "@critical"] }, async ({ apiAs, db, evidence }) => {
    const quote = await createDraftQuote(db);
    const item = quote.items[0]!;
    evidence("staff", `saveQuotePricingAction en /admin/quotes/${quote.id} con 10% de descuento`);
    const input = {
      quoteId: quote.id,
      lines: [
        {
          itemId: item.id,
          type: item.type,
          refId: null,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          unitCostCents: item.unitCostCents,
          costCategory: item.costCategory,
        },
      ],
      discount: { type: "PERCENT", value: 1000, reason: "Clienta frecuente" },
      depositBps: 5000,
    };
    const action = buildAction("saveQuotePricingAction", `/admin/quotes/${quote.id}`, input);
    await deny(apiAs, action);
    const untouched = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect({ type: untouched.discountType, cents: untouched.discountCents, total: untouched.totalCents }).toEqual({ type: null, cents: 0, total: 1_000_000 });
    expect(await db.auditLog.count({ where: { entityId: quote.id } })).toBe(0);

    const ok = await replayServerAction(await apiAs("owner"), action);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    const after = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.discountType).toBe("PERCENT");
    expect(after.discountValue).toBe(1000);
    expect(after.discountCents).toBeGreaterThan(0);
    expect(await db.auditLog.count({ where: { entityId: quote.id, action: "quote.discount_applied" } })).toBe(1);
  });

  test("[PERM-153] cancelar evento: staff/anónimo denegados; OWNER cancela con auditoría", { tag: ["@P0", "@critical"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, { status: "CONFIRMED" });
    evidence("staff", `cancelEventAction en /admin/events/${ev.eventId}`);
    const action = buildAction("cancelEventAction", `/admin/events/${ev.eventId}`, { eventId: ev.eventId, reason: "Cancelación forzada por replay", notifyCustomer: false });
    await deny(apiAs, action);
    expect((await db.event.findUniqueOrThrow({ where: { id: ev.eventId } })).status).toBe("CONFIRMED");

    const ok = await replayServerAction(await apiAs("owner"), action);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    const after = await db.event.findUniqueOrThrow({ where: { id: ev.eventId } });
    expect(after.status).toBe("CANCELLED");
    expect(after.cancellationReason).toBe("Cancelación forzada por replay");
    expect(await db.auditLog.count({ where: { entityId: ev.eventId, action: { contains: "cancel" } } })).toBeGreaterThan(0);
  });

  test("[PERM-154] cerrar evento (finanzas): staff/anónimo denegados y el evento sigue abierto", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, { status: "COMPLETED", daysAhead: -3, withBooking: true });
    evidence("staff", `closeEventAction en /admin/events/${ev.eventId}/financials`);
    await deny(apiAs, buildAction("closeEventAction", `/admin/events/${ev.eventId}/financials`, { eventId: ev.eventId }));
    const after = await db.event.findUniqueOrThrow({ where: { id: ev.eventId } });
    expect(after.closedAt).toBeNull();
  });

  test("[PERM-155] rotar token del portal: staff/anónimo denegados; OWNER rota (el anterior deja de servir)", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, {});
    evidence("staff", `rotateEventTokenAction en /admin/events/${ev.eventId}`);
    const action = buildAction("rotateEventTokenAction", `/admin/events/${ev.eventId}`, { eventId: ev.eventId, kind: "portal" });
    await deny(apiAs, action);
    expect((await db.event.findUniqueOrThrow({ where: { id: ev.eventId } })).portalToken).toBe(ev.portalToken);

    const ok = await replayServerAction(await apiAs("owner"), action);
    expect(wasAccepted(ok), `${ok.outcome} ${ok.text.slice(0, 200)}`).toBe(true);
    const rotated = (await db.event.findUniqueOrThrow({ where: { id: ev.eventId } })).portalToken;
    expect(rotated).not.toBe(ev.portalToken);
    const anon = await apiAs(null);
    expect((await anon.get(`/mi-evento/${ev.portalToken}`)).status()).toBe(404);
    expect((await anon.get(`/mi-evento/${rotated}`)).status()).toBe(200);
  });

  test("[PERM-156] cambio de rol: staff/anónimo denegados y el rol no cambia", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    const target = await createTeamUser(db, { role: "STAFF" });
    evidence("staff", `changeUserRoleAction ${target.email} → OWNER`);
    await deny(apiAs, buildAction("changeUserRoleAction", "/admin/settings/users", { userId: target.id, role: "OWNER" }));
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("STAFF");
  });

  test("[PERM-157] ajustes del negocio, precios y feature flags: staff/anónimo denegados y la configuración no cambia", { tag: ["@P0"] }, async ({ apiAs, db, evidence }) => {
    evidence("staff", "updateBusinessSettingsAction / updatePricingSettingsAction / setFeatureFlagAction en /admin/settings");
    const before = await db.setting.findMany({ orderBy: { key: "asc" } });
    await deny(
      apiAs,
      buildAction("updateBusinessSettingsAction", "/admin/settings", {
        brandName: "Marca secuestrada",
        tagline: "x",
        contactEmail: "atacante@evil.example",
        whatsappNumber: "5215500000000",
        instagramHandle: "evil",
        city: "Ciudad de México",
        cancellationPolicy: "Política reemplazada por un atacante en una prueba E2E.",
        termsVersion: "evil-1",
      }),
    );
    await deny(
      apiAs,
      buildAction("updatePricingSettingsAction", "/admin/settings/pricing", {
        taxRatePercent: 0,
        pricesIncludeTax: true,
        depositPercent: 1,
        quoteValidityDays: 60,
        minMarginPercent: 0,
        paymentFeePercent: 0,
        paymentFeeFixedCents: 0,
        balanceDueDaysBefore: 0,
        minStandardGuests: 1,
        maxStandardGuests: 200,
      }),
    );
    await deny(apiAs, buildAction("setFeatureFlagAction", "/admin/settings/flags", { flag: "PAYMENTS_ENABLED", enabled: false }));
    const after = await db.setting.findMany({ orderBy: { key: "asc" } });
    expect(after.map((s) => ({ key: s.key, value: s.value }))).toEqual(before.map((s) => ({ key: s.key, value: s.value })));
  });

  test("[PERM-158] acción de admin enviada a una página que no la importa (/staff, /) no se ejecuta", { tag: ["@P1"] }, async ({ apiAs, db, evidence }) => {
    const ids = await seedIds(db);
    const ev = await createEventGraph(db, { status: "CONFIRMED" });
    evidence("staff", "cancelEventAction contra /staff/events/[id] y contra / (anónimo)");
    const action = buildAction("cancelEventAction", `/admin/events/${ev.eventId}`, { eventId: ev.eventId, reason: "Intento por ruta alterna", notifyCustomer: false });
    const viaStaff = await replayServerAction(await apiAs("staff"), action, { path: `/staff/events/${ids.eventSofia}` });
    expect(wasBlocked(viaStaff), `${viaStaff.outcome} ${viaStaff.status} ${viaStaff.text.slice(0, 120)}`).toBe(true);
    const viaRoot = await replayServerAction(await apiAs(null), action, { path: "/" });
    expect(wasBlocked(viaRoot), `${viaRoot.outcome} ${viaRoot.status} ${viaRoot.text.slice(0, 120)}`).toBe(true);
    expect((await db.event.findUniqueOrThrow({ where: { id: ev.eventId } })).status).toBe("CONFIRMED");
  });

  test("[PERM-159] CSRF: Server Action con sesión válida pero Origin ajeno es rechazada y no escribe", { tag: ["@P0", "@negative"] }, async ({ apiAs, db, evidence }) => {
    const ev = await createEventGraph(db, { status: "CONFIRMED" });
    evidence("owner", "cancelEventAction con Origin: https://evil.example (cookie de owner)");
    const action = buildAction("cancelEventAction", `/admin/events/${ev.eventId}`, { eventId: ev.eventId, reason: "CSRF desde otro sitio", notifyCustomer: false });
    const owner = await apiAs("owner");
    const res = await owner.post(action.url, {
      headers: { "Next-Action": action.actionId, "Content-Type": action.contentType, Accept: "text/x-component", Origin: "https://evil.example" },
      data: action.body!,
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const text = await res.text();
    test.info().annotations.push({ type: "observado", description: `status ${res.status()} · ${text.slice(0, 120)}` });
    expect(/"ok":true/.test(text), "la acción no debe ejecutarse").toBe(false);
    expect((await db.event.findUniqueOrThrow({ where: { id: ev.eventId } })).status).toBe("CONFIRMED");
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
