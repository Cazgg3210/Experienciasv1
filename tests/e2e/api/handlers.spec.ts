/**
 * Route handlers: health, cron, webhooks de pago (firma + idempotencia), analytics (CSRF), métodos no permitidos
 * y endpoints de Auth.js. Códigos REALES del sistema (leídos de src/app/api/** y src/features/payments/server/webhook-service.ts).
 */
import { expect, test } from "../fixtures";
import { createEventGraph, cronSecret, e2eCode, mockWebhookSignature, token } from "../permissions/_helpers";

test.describe("API — health y métodos", { tag: ["@module:api"] }, () => {
  test("[API-001] /api/health responde {status:ok} sin caché", { tag: ["@P1", "@smoke"] }, async ({ request, evidence }) => {
    evidence("anonimo");
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("[API-002] /api/health/db verifica PostgreSQL (status ok, database up, latencia numérica)", { tag: ["@P1"] }, async ({ request, evidence }) => {
    evidence("anonimo");
    const res = await request.get("/api/health/db");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", database: "up" });
    expect(typeof body.latencyMs).toBe("number");
    expect(JSON.stringify(body)).not.toMatch(/postgres|password|ivonne_dev/i);
  });

  const notAllowed: Array<[string, string, string]> = [
    ["API-003", "POST", "/api/health"],
    ["API-004", "DELETE", "/api/health/db"],
    ["API-005", "DELETE", "/api/admin/leads-export"],
    ["API-006", "POST", "/api/events/cxxxxxxxxxxxxxxxxxxxxxxxx/guests.csv"],
    ["API-007", "PUT", "/api/media/upload"],
    ["API-008", "POST", "/api/media/cxxxxxxxxxxxxxxxxxxxxxxxx"],
    ["API-009", "GET", "/api/analytics/track"],
    ["API-010", "DELETE", "/api/cron/notifications"],
    ["API-011", "GET", "/api/webhooks/payments/mock"],
    ["API-012", "GET", "/api/memory/aaaaaaaaaaaaaaaaaaaaaaaa/upload"],
  ];
  for (const [id, method, url] of notAllowed) {
    test(`[${id}] ${method} ${url} → 405`, { tag: ["@P3", "@negative"] }, async ({ request, evidence }) => {
      evidence("anonimo", `${method} ${url}`);
      const res = await request.fetch(url, { method, failOnStatusCode: false, maxRedirects: 0, headers: { Origin: "http://localhost" } });
      expect(res.status()).toBe(405);
    });
  }
});

test.describe("API — cron de recordatorios", { tag: ["@module:api"] }, () => {
  test("[API-020] sin Authorization → 401 con WWW-Authenticate Bearer", { tag: ["@P0", "@negative"] }, async ({ request, db, evidence }) => {
    evidence("anonimo");
    const before = await db.notificationLog.count();
    for (const method of ["GET", "POST"]) {
      const res = await request.fetch("/api/cron/notifications", { method, failOnStatusCode: false });
      expect(res.status(), method).toBe(401);
      expect(res.headers()["www-authenticate"]).toContain("Bearer");
      expect(await res.json()).toEqual({ ok: false, error: "No autorizado." });
    }
    expect(await db.notificationLog.count()).toBe(before);
  });

  test("[API-021] secreto incorrecto / esquema distinto / vacío → 401 y no ejecuta nada", { tag: ["@P0", "@negative"] }, async ({ request, db, evidence }) => {
    evidence("anonimo", "Bearer equivocado, Basic, Bearer vacío, secreto con sufijo");
    const before = await db.notificationLog.count();
    const secret = cronSecret();
    for (const auth of [`Bearer ${secret}x`, `Bearer ${secret.slice(0, -1)}`, `Basic ${Buffer.from(`cron:${secret}`).toString("base64")}`, "Bearer ", secret]) {
      const res = await request.post("/api/cron/notifications", { headers: { Authorization: auth }, failOnStatusCode: false });
      expect(res.status(), auth.slice(0, 12)).toBe(401);
    }
    expect(await db.notificationLog.count()).toBe(before);
  });

  test("[API-022] secreto correcto → 200 {ok:true} e idempotente (la 2ª corrida no duplica avisos)", { tag: ["@P1"] }, async ({ request, db, evidence }) => {
    evidence("anonimo", "Authorization: Bearer $CRON_SECRET dos veces");
    const headers = { Authorization: `Bearer ${cronSecret()}` };
    const first = await request.post("/api/cron/notifications", { headers });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true });
    const afterFirst = await db.notificationLog.count();
    const second = await request.get("/api/cron/notifications", { headers });
    expect(second.status()).toBe(200);
    expect(second.headers()["cache-control"]).toContain("no-store");
    expect(await db.notificationLog.count()).toBe(afterFirst);
  });
});

test.describe("API — webhook de pagos", { tag: ["@module:api", "@module:payments"] }, () => {
  async function pendingMockPayment(db: import("@prisma/client").PrismaClient) {
    const ev = await createEventGraph(db, { status: "PENDING_PAYMENT", withBooking: true, totalCents: 2_000_000 });
    const checkoutId = `mock_cs_${token(18)}`;
    const payment = await db.payment.create({
      data: {
        bookingId: ev.bookingId!,
        kind: "DEPOSIT",
        status: "PENDING",
        method: "ONLINE",
        provider: "mock",
        providerCheckoutId: checkoutId,
        amountCents: 1_000_000,
        idempotencyKey: e2eCode("IDEM"),
      },
    });
    return { ev, payment, checkoutId };
  }
  function payload(p: { id: string; checkoutId: string; paymentId: string; amountCents: number }) {
    return JSON.stringify({
      id: p.id,
      type: "payment.succeeded",
      checkoutId: p.checkoutId,
      paymentId: p.paymentId,
      providerPaymentId: `mock_pi_${p.id}`,
      amountCents: p.amountCents,
      createdAt: new Date().toISOString(),
    });
  }

  test("[API-030] sin firma → 400 invalid_signature y no se registra ni procesa", { tag: ["@P0", "@negative"] }, async ({ request, db, evidence }) => {
    const { payment, checkoutId } = await pendingMockPayment(db);
    const id = `evt_${token(8)}`;
    evidence("anonimo", `evento ${id} sin x-mock-signature`);
    const res = await request.post("/api/webhooks/payments/mock", { data: payload({ id, checkoutId, paymentId: payment.id, amountCents: 1_000_000 }), headers: { "Content-Type": "application/json" }, failOnStatusCode: false });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_signature" });
    expect(await db.webhookEvent.count({ where: { externalId: id } })).toBe(0);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  test("[API-031] firma inválida, con otro secreto, malformada o vencida (>300 s) → 400 sin efecto", { tag: ["@P0", "@negative"] }, async ({ request, db, evidence }) => {
    const { payment, checkoutId } = await pendingMockPayment(db);
    const id = `evt_${token(8)}`;
    const body = payload({ id, checkoutId, paymentId: payment.id, amountCents: 1_000_000 });
    evidence("anonimo", `evento ${id}`);
    const now = Math.floor(Date.now() / 1000);
    const sigs = [
      mockWebhookSignature(body, now, "otro-secreto-que-no-es-el-real"),
      mockWebhookSignature(body + " ", now),
      `t=${now},v1=${"0".repeat(64)}`,
      "basura",
      mockWebhookSignature(body, now - 3600),
    ];
    for (const s of sigs) {
      const res = await request.post("/api/webhooks/payments/mock", { data: body, headers: { "Content-Type": "application/json", "x-mock-signature": s }, failOnStatusCode: false });
      expect(res.status(), s.slice(0, 20)).toBe(400);
    }
    expect(await db.webhookEvent.count({ where: { externalId: id } })).toBe(0);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  test("[API-032] evento repetido con firma válida: se procesa una sola vez (duplicate:true)", { tag: ["@P0"] }, async ({ request, db, evidence }) => {
    const { payment, checkoutId } = await pendingMockPayment(db);
    const id = `evt_${token(8)}`;
    const body = payload({ id, checkoutId, paymentId: payment.id, amountCents: 1_000_000 });
    evidence("anonimo", `evento ${id} enviado 2 veces (idempotencia WebhookEvent)`);
    const first = await request.post("/api/webhooks/payments/mock", { data: body, headers: { "Content-Type": "application/json", "x-mock-signature": mockWebhookSignature(body) } });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ received: true, type: "payment.succeeded", applied: true });
    const paid = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.status).toBe("PAID");

    const again = await request.post("/api/webhooks/payments/mock", { data: body, headers: { "Content-Type": "application/json", "x-mock-signature": mockWebhookSignature(body) } });
    expect(again.status()).toBe(200);
    expect(await again.json()).toEqual({ received: true, duplicate: true });
    expect(await db.webhookEvent.count({ where: { provider: "mock", externalId: id } })).toBe(1);
    const still = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(still.paidAt?.getTime()).toBe(paid.paidAt?.getTime());
    expect(await db.payment.count({ where: { bookingId: payment.bookingId, status: "PAID" } })).toBe(1);
  });

  test("[API-033] proveedor desconocido o con caracteres inválidos → 404", { tag: ["@P2", "@negative"] }, async ({ request, evidence }) => {
    evidence("anonimo");
    for (const p of ["paypal", "MOCK", "mo-ck", "x".repeat(30)]) {
      const res = await request.post(`/api/webhooks/payments/${p}`, { data: "{}", failOnStatusCode: false });
      expect(res.status(), p).toBe(404);
    }
  });

  test("[API-034] cuerpo > 256 KB → 413 sin procesar; JSON inválido con firma válida → 400", { tag: ["@P2", "@negative"] }, async ({ request, evidence }) => {
    evidence("anonimo");
    const big = JSON.stringify({ id: "evt_big", pad: "x".repeat(300 * 1024) });
    const res = await request.post("/api/webhooks/payments/mock", { data: big, headers: { "Content-Type": "application/json", "x-mock-signature": mockWebhookSignature(big) }, failOnStatusCode: false });
    expect(res.status()).toBe(413);
    const broken = "{no es json";
    const res2 = await request.post("/api/webhooks/payments/mock", { data: broken, headers: { "Content-Type": "application/json", "x-mock-signature": mockWebhookSignature(broken) }, failOnStatusCode: false });
    expect(res2.status()).toBe(400);
  });

  test("[API-035] evento válido de un pago inexistente → 200 registrado con nota payment_not_found (sin efectos)", { tag: ["@P2"] }, async ({ request, db, evidence }) => {
    const id = `evt_${token(8)}`;
    const body = payload({ id, checkoutId: `mock_cs_${token(12)}`, paymentId: "cxxxxxxxxxxxxxxxxxxxxxxxx", amountCents: 100 });
    evidence("anonimo", id);
    const res = await request.post("/api/webhooks/payments/mock", { data: body, headers: { "Content-Type": "application/json", "x-mock-signature": mockWebhookSignature(body) } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, applied: false, note: "payment_not_found" });
    const row = await db.webhookEvent.findFirstOrThrow({ where: { externalId: id } });
    expect(row.processedAt).not.toBeNull();
    expect(row.error).toBe("payment_not_found");
  });
});

test.describe("API — analytics (beacon público)", { tag: ["@module:api"] }, () => {
  const valid = () => JSON.stringify({ type: "VIEW_EXPERIENCE", path: "/experiencias", sessionId: `e2e_${token(6)}` });

  test("[API-040] CSRF: sin Origin, con Origin ajeno o Sec-Fetch-Site cross-site → 403 sin registrar", { tag: ["@P1", "@negative"] }, async ({ playwright, baseURL, db, evidence }) => {
    evidence("anonimo");
    const before = await db.analyticsEvent.count();
    const variants: Array<Record<string, string>> = [{}, { Origin: "https://evil.example" }, { "Sec-Fetch-Site": "cross-site", Origin: baseURL! }, { Referer: "https://evil.example/pagina" }, { "Sec-Fetch-Site": "same-site" }];
    for (const h of variants) {
      const ctx = await playwright.request.newContext({ baseURL });
      const res = await ctx.post("/api/analytics/track", { data: valid(), headers: { "Content-Type": "application/json", ...h }, failOnStatusCode: false });
      expect(res.status(), JSON.stringify(h)).toBe(403);
      await ctx.dispose();
    }
    expect(await db.analyticsEvent.count()).toBe(before);
  });

  test("[API-041] mismo origen + cuerpo válido → 204 y AnalyticsEvent con origin=client", { tag: ["@P2"] }, async ({ request, baseURL, db, evidence }) => {
    evidence("anonimo");
    const sessionId = `e2e_${token(6)}`;
    const res = await request.post("/api/analytics/track", {
      data: JSON.stringify({ type: "START_CONFIGURATOR", path: "/crear-experiencia?utm=x", sessionId }),
      headers: { "Content-Type": "application/json", Origin: baseURL! },
    });
    expect(res.status()).toBe(204);
    const row = await db.analyticsEvent.findFirstOrThrow({ where: { sessionId } });
    expect(row.type).toBe("START_CONFIGURATOR");
    expect(row.metadata).toMatchObject({ origin: "client" });
  });

  test("[API-042] cuerpo inválido: tipo no permitido, campos extra, JSON roto → 400; > 4 KB → 413", { tag: ["@P2", "@negative"] }, async ({ request, baseURL, evidence }) => {
    evidence("anonimo");
    const post = (data: string) => request.post("/api/analytics/track", { data, headers: { "Content-Type": "application/json", Origin: baseURL! }, failOnStatusCode: false });
    expect((await post(JSON.stringify({ type: "LEAD_CREATED" }))).status()).toBe(400);
    expect((await post(JSON.stringify({ type: "VIEW_EXPERIENCE", admin: true }))).status()).toBe(400);
    expect((await post("{roto")).status()).toBe(400);
    expect((await post(JSON.stringify({ type: "VIEW_EXPERIENCE", path: "x".repeat(5000) }))).status()).toBe(413);
  });
});

test.describe("API — Auth.js", { tag: ["@module:api", "@auth"] }, () => {
  test("[API-050] /api/auth/session: anónimo sin usuario; owner sin datos sensibles", { tag: ["@P1"] }, async ({ apiAs, evidence }) => {
    evidence("owner", "GET /api/auth/session");
    const anon = await (await apiAs(null)).get("/api/auth/session");
    expect(anon.status()).toBe(200);
    expect(await anon.json()).toBeNull();
    const owner = await (await apiAs("owner")).get("/api/auth/session");
    const s = await owner.json();
    expect(s.user.email).toBe("ivonne@ivonne-rosa.test");
    expect(s.user.role).toBe("OWNER");
    expect(JSON.stringify(s)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  test("[API-051] POST directo a /api/auth/callback/credentials sin token CSRF no crea sesión", { tag: ["@P1", "@negative"] }, async ({ apiAs, evidence }) => {
    evidence("anonimo", "credenciales válidas de demo pero sin csrfToken");
    const anon = await apiAs(null);
    const res = await anon.post("/api/auth/callback/credentials", {
      form: { email: "ivonne@ivonne-rosa.test", password: process.env.E2E_PASSWORD ?? "Demo2026!" },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.headers()["set-cookie"] ?? "").not.toContain("authjs.session-token=ey");
    expect(res.headers()["location"] ?? "").toMatch(/\/login\?error=|MissingCSRF/);
  });

  test("[API-052] /api/auth/signin redirige al login propio; providers sólo expone credenciales", { tag: ["@P3"] }, async ({ apiAs, evidence }) => {
    evidence("anonimo");
    const anon = await apiAs(null);
    const signin = await anon.get("/api/auth/signin", { maxRedirects: 0, failOnStatusCode: false });
    expect([302, 303, 307]).toContain(signin.status());
    expect(signin.headers()["location"]).toContain("/login");
    const providers = await (await anon.get("/api/auth/providers")).json();
    expect(Object.keys(providers)).toEqual(["credentials"]);
  });
});
