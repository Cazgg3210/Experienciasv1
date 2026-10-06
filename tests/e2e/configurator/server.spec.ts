/**
 * Configurador — reglas de negocio del BACKEND (Server Actions públicas por HTTP).
 * Lo que la UI impide (fechas pasadas, precios inventados, ids incompatibles) se fuerza aquí por request:
 * el servidor debe revalidar todo y recalcular el precio.
 */
import { randomUUID } from "node:crypto";
import { expect, test, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { addDaysKey, claimFreeDate } from "../quote-public/_helpers";
import { localDateKey } from "../../../src/lib/dates";
import {
  activeArea,
  callAction,
  experienceBySlug,
  failure,
  findInternalKeys,
  firstStyle,
  okData,
} from "./_helpers";

type Estimate = {
  lines: Array<{ type: string; description: string; quantity: number; unitPriceCents: number; totalPriceCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  warnings: string[];
};

const ROUTE = "/crear-experiencia";

/** Fecha abierta (no lunes, que es día de descanso) cerca de `days` días adelante. Los leads no ocupan capacidad. */
function openDayAround(days: number): string {
  let key = addDaysKey(localDateKey(), days);
  while (new Date(`${key}T12:00:00Z`).getUTCDay() === 1) key = addDaysKey(key, 1);
  return key;
}

test.describe("Configurador — backend", { tag: ["@module:configurator"] }, () => {
  let base: Record<string, unknown>;

  // Estas pruebas usan ids de la base directamente (no dependen del catálogo cacheado de la página).
  test.beforeEach(async ({ db }) => {
    const exp = await experienceBySlug(db, "birthday-table");
    const area = await activeArea(db, "Polanco");
    const style = await firstStyle(db);
    base = {
      occasion: "BIRTHDAY",
      occasionOther: "",
      eventDate: openDayAround(20),
      startTime: "11:00",
      serviceAreaId: area.id,
      zoneText: null,
      guestCount: 8,
      styleId: style.id,
      experienceId: exp.id,
      menuId: exp.menus[0]!.id,
      addOns: [],
      colors: [],
      honoreeName: "",
      notes: "",
      inspiration: "",
      budgetRangeId: null,
      budgetUndecided: true,
      name: `Clienta ${uniq("Back")}`,
      phone: uniqPhone(),
      email: "",
      consent: true,
      marketingOptIn: false,
      submissionId: randomUUID(),
      sessionId: null,
      utmSource: null,
      referredByCode: null,
    };
  });

  test(
    "[CONF-013] el estimado se calcula en servidor con las reglas del motor (base, extras, menú/extra por persona, logística, IVA 16 % incluido, anticipo 50 %)",
    { tag: ["@P0", "@critical"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "estimateAction con selección completa");
      const exp = await experienceBySlug(db, "birthday-table");
      const area = await activeArea(db, "Polanco");
      const premium = exp.menus.find((m) => m.name === "Brunch Premium")!;
      const mimosa = exp.addOns.find((a) => a.name === "Mimosa bar")!;
      const pastel = exp.addOns.find((a) => a.name === "Pastel personalizado")!;
      const guests = 10;
      const est = okData(
        await callAction<Estimate>(
          request,
          baseURL!,
          "estimateAction",
          {
            experienceId: exp.id,
            guestCount: guests,
            menuId: premium.id,
            addOns: [
              { addOnId: mimosa.id, quantity: 1 },
              { addOnId: pastel.id, quantity: 2 },
            ],
            serviceAreaId: area.id,
          },
          ROUTE,
        ),
      );
      const billable = Math.max(guests, exp.baseGuests);
      const expected =
        exp.basePriceCents +
        (guests - exp.baseGuests) * exp.extraGuestPriceCents +
        premium.priceCents * billable +
        mimosa.priceCents * billable +
        pastel.priceCents * Math.min(2, pastel.maxQuantity) +
        area.logisticsFeeCents;
      expect(est.subtotalCents).toBe(expected);
      expect(est.totalCents).toBe(expected); // IVA incluido en precios
      expect(est.taxCents).toBe(Math.round(expected - (expected * 10_000) / 11_600));
      expect(est.depositCents).toBe(Math.round(expected / 2));
      expect(est.lines.reduce((s, l) => s + l.totalPriceCents, 0)).toBe(expected);
      expect(est.lines.map((l) => l.type)).toEqual(["BASE_EXPERIENCE", "EXTRA_GUEST", "MENU", "ADDON", "ADDON", "LOGISTICS"]);
      for (const l of est.lines) {
        expect(Number.isInteger(l.totalPriceCents), "centavos enteros").toBe(true);
        expect(l.totalPriceCents).toBe(l.unitPriceCents * l.quantity);
      }
      expect(findInternalKeys(est), "el público no recibe costos ni márgenes").toEqual([]);
    },
  );

  test(
    "[CONF-014] el catálogo que recibe el navegador no incluye costos internos",
    { tag: ["@P0", "@critical"] },
    async ({ request, evidence }) => {
      evidence("anonimo", "HTML/RSC de /crear-experiencia y /crear-experiencia/ai");
      for (const path of ["/crear-experiencia", "/crear-experiencia/ai", "/experiencias/birthday-table"]) {
        const html = await (await request.get(path)).text();
        for (const key of ["costCents", "costPerGuestCents", "logisticsCostCents", "extraGuestCostCents", "costComponents", "marginBps", "minMarginBps", "paymentFeeBps"]) {
          expect(html, `${path} contiene ${key}`).not.toContain(key);
        }
      }
    },
  );

  test(
    "[CONF-015] precio manipulado en el request: el servidor lo ignora y guarda el estimado recalculado",
    { tag: ["@P0", "@critical", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "submitConfiguratorAction con estimatedTotalCents: 100 (inventado)");
      const sel = { experienceId: base.experienceId, guestCount: 8, menuId: base.menuId, addOns: [], serviceAreaId: base.serviceAreaId };
      const real = okData(await callAction<Estimate>(request, baseURL!, "estimateAction", sel, ROUTE)).totalCents;
      const res = okData(
        await callAction<{ code: string; totalCents: number }>(request, baseURL!, "submitConfiguratorAction", { ...base, estimatedTotalCents: 100 }, ROUTE),
      );
      expect(res.totalCents).toBe(real);
      const lead = await db.lead.findUniqueOrThrow({ where: { code: res.code }, include: { snapshot: true } });
      expect(lead.estimatedTotalCents).toBe(real);
      expect((lead.snapshot!.data as { meta: { clientEstimateCentsIgnored: number } }).meta.clientEstimateCentsIgnored).toBe(100);
      expect((lead.snapshot!.estimate as { totalCents: number }).totalCents).toBe(real);
      expect(findInternalKeys(res)).toEqual([]);
    },
  );

  test(
    "[CONF-016] disponibilidad pública: estados por día correctos y sin datos de otros eventos",
    { tag: ["@P1"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "getAvailabilityAction sobre un rango con bloqueo y día lleno propios");
      const blocked = await claimFreeDate(db);
      await db.availabilityException.create({ data: { date: new Date(`${blocked}T00:00:00.000Z`), type: "BLOCKED", reason: "E2E" } });
      const full = await claimFreeDate(db, { weekdays: [2, 3, 4, 5] });
      const cust = await db.customer.create({ data: { name: uniq("Lleno"), referralCode: uniq("REF") } });
      await db.event.create({
        data: {
          code: uniq("EV-E2E").toUpperCase(),
          title: "E2E Evento privado de otra clienta",
          status: "CONFIRMED",
          customerId: cust.id,
          eventDate: new Date(`${full}T00:00:00.000Z`),
          startsAt: new Date(`${full}T17:00:00.000Z`),
          endsAt: new Date(`${full}T21:00:00.000Z`),
          guestCount: 8,
          micrositeSlug: uniq("e2e-av").toLowerCase(),
          inviteToken: uniq("invite-e2e-av-token"),
          portalToken: uniq("portal-e2e-av-token"),
        },
      });
      const day = async (key: string) =>
        okData(await callAction<Array<{ date: string; status: string; acceptsRequests: boolean; remaining: number }>>(request, baseURL!, "getAvailabilityAction", { from: key, days: 1, serviceAreaId: null }, ROUTE))[0]!;
      expect(await day(blocked)).toMatchObject({ status: "BLOCKED", acceptsRequests: false, remaining: 0 });
      expect(await day(full)).toMatchObject({ status: "FULL", remaining: 0 });
      expect(await day(addDaysKey(localDateKey(), -1))).toMatchObject({ status: "PAST", acceptsRequests: false });
      const mondays = okData(await callAction<Array<{ date: string; status: string }>>(request, baseURL!, "getAvailabilityAction", { from: addDaysKey(localDateKey(), 8), days: 7, serviceAreaId: null }, ROUTE));
      expect(mondays.filter((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 1).every((d) => d.status === "CLOSED")).toBe(true);
      const raw = (await callAction(request, baseURL!, "getAvailabilityAction", { from: full, days: 1, serviceAreaId: null }, ROUTE)).raw;
      expect(raw).not.toContain("Evento privado de otra clienta");
      expect(Object.keys((JSON.parse(raw.split("\n").find((l) => l.startsWith("1:"))!.slice(2)) as { data: Array<Record<string, unknown>> }).data[0]!).sort()).toEqual(["acceptsRequests", "date", "remaining", "status"]);
      for (const bad of [{ from: "2026-02-31", days: 5 }, { from: localDateKey(), days: 0 }, { from: localDateKey(), days: 63 }]) {
        expect(failure(await callAction(request, baseURL!, "getAvailabilityAction", bad, ROUTE)).code).toBe("VALIDATION_ERROR");
      }
    },
  );

  test(
    "[CONF-017] fechas pasadas o bloqueadas se rechazan al enviar (aunque se fuerce el request) y no crean lead",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "submitConfiguratorAction con fecha pasada / bloqueada / inexistente");
      const blocked = await claimFreeDate(db);
      await db.availabilityException.create({ data: { date: new Date(`${blocked}T00:00:00.000Z`), type: "BLOCKED", reason: "E2E" } });
      const past = failure(await callAction(request, baseURL!, "submitConfiguratorAction", { ...base, eventDate: addDaysKey(localDateKey(), -3), submissionId: randomUUID() }, ROUTE));
      expect(past.error).toBe("Esa fecha ya pasó. Elige otra fecha, por favor.");
      expect(past.fieldErrors?.eventDate).toBeTruthy();
      const blk = failure(await callAction(request, baseURL!, "submitConfiguratorAction", { ...base, eventDate: blocked, submissionId: randomUUID() }, ROUTE));
      expect(blk.error).toBe("Esa fecha no está disponible. ¿Te late elegir otra?");
      const fake = failure(await callAction(request, baseURL!, "submitConfiguratorAction", { ...base, eventDate: "2026-02-30", submissionId: randomUUID() }, ROUTE));
      expect(fake.code).toBe("VALIDATION_ERROR");
      expect(await db.lead.count({ where: { OR: [{ name: String(base.name) }, { phone: `+52${String(base.phone)}` }] } })).toBe(0);
    },
  );

  test(
    "[CONF-018] el backend rechaza contacto inválido, consentimiento falso, límites de invitadas e ids incompatibles",
    { tag: ["@P1", "@negative"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "submitConfiguratorAction con payloads manipulados");
      const signature = await experienceBySlug(db, "signature-brunch");
      const birthday = await experienceBySlug(db, "birthday-table");
      const karaoke = birthday.addOns.find((a) => a.name === "Mini karaoke")!; // no disponible para Signature Brunch
      const inactive = await db.experience.create({
        data: {
          slug: uniq("e2e-inactiva").toLowerCase(),
          name: "E2E Experiencia inactiva",
          description: "No debe venderse",
          type: "BRUNCH",
          active: false,
          basePriceCents: 100,
          baseGuests: 6,
          minGuests: 6,
          maxGuests: 12,
          durationMinutes: 180,
          extraGuestPriceCents: 100,
        },
      });
      const cases: Array<[string, Record<string, unknown>, string]> = [
        ["teléfono corto", { phone: "12345" }, "phone"],
        ["sin consentimiento", { consent: false }, "consent"],
        ["correo inválido", { email: "no-es-correo" }, "email"],
        ["1 invitada", { guestCount: 1 }, "guestCount"],
        ["41 invitadas", { guestCount: 41 }, "guestCount"],
        ["hora fuera de rango", { startTime: "22:00" }, "startTime"],
        ["nombre vacío", { name: " " }, "name"],
        ["menú incompatible", { experienceId: signature.id, menuId: "noexiste123" }, "menuId"],
        ["extra de otra experiencia", { experienceId: signature.id, menuId: signature.menus[0]!.id, addOns: [{ addOnId: karaoke.id, quantity: 1 }] }, "addOns"],
        ["experiencia inactiva", { experienceId: inactive.id, menuId: null }, "experienceId"],
        ["sin zona ni colonia", { serviceAreaId: null, zoneText: "" }, "zoneText"],
        ["sin presupuesto", { budgetRangeId: null, budgetUndecided: false }, "budgetRangeId"],
      ];
      for (const [label, patch, field] of cases) {
        const res = failure(await callAction(request, baseURL!, "submitConfiguratorAction", { ...base, ...patch, submissionId: randomUUID() }, ROUTE));
        expect(res.code, label).toBe("VALIDATION_ERROR");
        expect(Object.keys(res.fieldErrors ?? {}), `${label}: ${JSON.stringify(res)}`).toContain(field);
      }
      expect(await db.lead.count({ where: { OR: [{ name: String(base.name) }, { phone: `+52${String(base.phone)}` }] } })).toBe(0);
    },
  );

  test(
    "[CONF-019] reintento con el mismo submissionId devuelve el mismo folio sin duplicar lead, clienta ni avisos",
    { tag: ["@P1", "@regression"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Corte de red: la clienta reintenta el mismo envío");
      const payload = { ...base, email: uniqEmail("idem") };
      const a = okData(await callAction<{ code: string }>(request, baseURL!, "submitConfiguratorAction", payload, ROUTE));
      const b = okData(await callAction<{ code: string }>(request, baseURL!, "submitConfiguratorAction", payload, ROUTE));
      expect(b.code).toBe(a.code);
      const phone = `+52${String(base.phone)}`;
      expect(await db.lead.count({ where: { phone } })).toBe(1);
      expect(await db.customer.count({ where: { phone } })).toBe(1);
      const lead = await db.lead.findUniqueOrThrow({ where: { code: a.code } });
      expect(await db.notificationLog.count({ where: { leadId: lead.id, type: "LEAD_RECEIVED" } })).toBe(2); // email + WhatsApp, una vez
      // Otro submissionId = otra solicitud legítima (misma clienta).
      const c = okData(await callAction<{ code: string }>(request, baseURL!, "submitConfiguratorAction", { ...payload, submissionId: randomUUID() }, ROUTE));
      expect(c.code).not.toBe(a.code);
      expect(await db.customer.count({ where: { phone } })).toBe(1);
    },
  );

  test(
    "[CONF-020] día lleno: la solicitud se acepta como consulta y el equipo ve la nota «Fecha llena»",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "submit con fecha FULL (acceptsRequests=true en el dominio)");
      const full = await claimFreeDate(db, { weekdays: [2, 3, 4, 5] });
      const cust = await db.customer.create({ data: { name: uniq("Lleno"), referralCode: uniq("REF") } });
      await db.event.create({
        data: {
          code: uniq("EV-E2E").toUpperCase(),
          title: "E2E lleno",
          status: "CONFIRMED",
          customerId: cust.id,
          eventDate: new Date(`${full}T00:00:00.000Z`),
          startsAt: new Date(`${full}T17:00:00.000Z`),
          endsAt: new Date(`${full}T21:00:00.000Z`),
          guestCount: 8,
          micrositeSlug: uniq("e2e-full").toLowerCase(),
          inviteToken: uniq("invite-e2e-full-token"),
          portalToken: uniq("portal-e2e-full-token"),
        },
      });
      const res = okData(
        await callAction<{ code: string; availabilityStatus: string }>(request, baseURL!, "submitConfiguratorAction", { ...base, eventDate: full }, ROUTE),
      );
      expect(res.availabilityStatus).toBe("FULL");
      const lead = await db.lead.findUniqueOrThrow({ where: { code: res.code } });
      expect(lead.notes).toContain("Fecha llena — ofrecer alternativa");
    },
  );

  test(
    "[CONF-021] la misma clienta (mismo teléfono) que vuelve a escribir no se duplica",
    { tag: ["@P2"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "Dos solicitudes del configurador: sin correo y luego con correo");
      const first = okData(await callAction<{ code: string }>(request, baseURL!, "submitConfiguratorAction", base, ROUTE));
      const email = uniqEmail("dedupe");
      const second = okData(
        await callAction<{ code: string }>(request, baseURL!, "submitConfiguratorAction", { ...base, email, submissionId: randomUUID() }, ROUTE),
      );
      const [l1, l2] = await Promise.all([
        db.lead.findUniqueOrThrow({ where: { code: first.code } }),
        db.lead.findUniqueOrThrow({ where: { code: second.code } }),
      ]);
      expect(l2.customerId).toBe(l1.customerId);
      const customer = await db.customer.findUniqueOrThrow({ where: { id: l1.customerId! } });
      expect(customer.email, "se completa el correo de la clienta existente").toBe(email);
    },
  );

  test(
    "[CONF-022] la clienta se reconoce entre canales por teléfono (configurador → diseñador IA / contacto)",
    { tag: ["@P2", "@regression"] },
    async ({ db, request, baseURL, evidence }) => {
      test.info().annotations.push({ type: "regression", description: "BUG-008" });
      evidence("anonimo", "Mismo teléfono 10 dígitos en configurador y en el formulario de contacto");
      const phone = String(base.phone);
      const conf = okData(await callAction<{ code: string }>(request, baseURL!, "submitConfiguratorAction", base, ROUTE));
      const contact = okData(
        await callAction<{ code: string }>(
          request,
          baseURL!,
          "submitContactForm",
          {
            name: String(base.name),
            phone,
            email: uniqEmail("canal"),
            occasion: "BIRTHDAY",
            eventDate: "",
            message: "Hola, quiero cambiar la fecha de mi cotización.",
            consent: true,
            website: "",
          },
          "/contacto",
        ),
      );
      const [l1, l2] = await Promise.all([
        db.lead.findUniqueOrThrow({ where: { code: conf.code } }),
        db.lead.findUniqueOrThrow({ where: { code: contact.code } }),
      ]);
      expect(
        l2.customerId,
        `configurador guardó phone=${l1.phone}, contacto guardó phone=${l2.phone}: deberían ser la misma clienta`,
      ).toBe(l1.customerId);
    },
  );

  test(
    "[CONF-023] analítica del embudo: inicio y resumen se registran con el id de sesión",
    { tag: ["@P3"] },
    async ({ db, request, baseURL, evidence }) => {
      evidence("anonimo", "trackConfiguratorAction");
      const sessionId = `e2e-${randomUUID()}`;
      okData(await callAction(request, baseURL!, "trackConfiguratorAction", { type: "START_CONFIGURATOR", sessionId }, ROUTE));
      okData(await callAction(request, baseURL!, "trackConfiguratorAction", { type: "COMPLETE_CONFIGURATOR", sessionId }, ROUTE));
      expect(await db.analyticsEvent.count({ where: { sessionId, type: { in: ["START_CONFIGURATOR", "COMPLETE_CONFIGURATOR"] } } })).toBe(2);
      const bad = failure(await callAction(request, baseURL!, "trackConfiguratorAction", { type: "PAYMENT_SUCCESS", sessionId }, ROUTE));
      expect(bad.code).toBe("VALIDATION_ERROR");
    },
  );
});
