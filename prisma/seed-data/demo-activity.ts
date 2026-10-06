/**
 * Seed DEMO — fase 3: notificaciones (mock), analytics (embudo de 45 días),
 * bitácora de auditoría y una muestra del diseñador con IA.
 */
import type { AnalyticsEventType, NotificationChannel, NotificationType, Prisma, PrismaClient } from "@prisma/client";
import type { DemoRefs, UserKey } from "./demo-setup";
import type { SalesResult } from "./demo-sales";
import { DEMO_TOKENS } from "./demo-sales";
import { DEMO_USERS } from "./demo-catalog";
import { type Clock, type Rng, DAY_MS, MINUTE_MS, addDays, addMinutes, json, notAfter, pickWeighted, randInt, shuffle } from "./helpers";
import { formatMXN } from "../../src/lib/money";

const OWNER_EMAIL = "equipo@ivonne-rosa.test";

export async function seedDemoActivity(
  prisma: PrismaClient,
  refs: DemoRefs,
  sales: SalesResult,
  clock: Clock,
  rng: Rng,
  appUrl: string,
): Promise<void> {
  const now = clock.now;
  const { leads, quotes, events } = sales;
  const C = refs.customers;

  // ---------------------------------------------------------------------------
  // NOTIFICACIONES (todas MOCKED)
  // ---------------------------------------------------------------------------
  const notifications: Prisma.NotificationLogCreateManyInput[] = [];
  const notify = (n: {
    type: NotificationType;
    channel: NotificationChannel;
    to: string;
    subject?: string;
    body: string;
    actionUrl?: string;
    at: Date;
    leadId?: string;
    quoteId?: string;
    eventId?: string;
    entity: string;
  }) => {
    const at = notAfter(n.at, now);
    notifications.push({
      type: n.type,
      channel: n.channel,
      status: "MOCKED",
      provider: n.channel === "EMAIL" ? "mock-email" : "mock-whatsapp",
      to: n.to,
      subject: n.channel === "EMAIL" ? (n.subject ?? null) : null,
      body: n.body,
      actionUrl: n.actionUrl ?? null,
      dedupeKey: `${n.type}:${n.entity}:${n.channel}:${n.to}`.toLowerCase(),
      leadId: n.leadId ?? null,
      quoteId: n.quoteId ?? null,
      eventId: n.eventId ?? null,
      providerMessageId: `mock_${n.channel === "EMAIL" ? "em" : "wa"}_${Math.floor(rng() * 1e10).toString(36)}`,
      sentAt: at,
      createdAt: at,
    });
  };
  const wa = (phone: string | null | undefined) => (phone ?? "").replace(/[^\d+]/g, "");

  const gaby = leads.gabriela!;
  notify({ type: "LEAD_RECEIVED", channel: "EMAIL", to: OWNER_EMAIL, subject: `Nuevo lead: ${gaby.name} — Signature Brunch`, body: `${gaby.name} completó el configurador (${gaby.code}). Revísalo en el panel.`, actionUrl: `${appUrl}/admin/leads/${gaby.id}`, at: addMinutes(gaby.createdAt, 1), leadId: gaby.id, entity: gaby.id });
  const isabel = leads.isabel!;
  notify({ type: "LEAD_RECEIVED", channel: "EMAIL", to: OWNER_EMAIL, subject: `Nuevo lead (IA): ${isabel.name}`, body: `${isabel.name} generó una propuesta con el diseñador IA (${isabel.code}).`, actionUrl: `${appUrl}/admin/leads/${isabel.id}`, at: addMinutes(isabel.createdAt, 1), leadId: isabel.id, entity: isabel.id });

  const lucia = quotes.lucia!;
  const luciaCustomer = C.lucia!;
  notify({ type: "QUOTE_SENT", channel: "EMAIL", to: luciaCustomer.email!, subject: "Tu cotización de Ivonne & Rosa está lista", body: `Hola Lucía, preparamos tu Birthday Table para 8 invitadas por ${formatMXN(lucia.calc.totalCents)} (IVA incluido). Puedes revisarla y apartar tu fecha aquí.`, actionUrl: `${appUrl}/cotizacion/${lucia.publicToken}`, at: lucia.sentAt!, quoteId: lucia.id, leadId: leads.lucia!.id, entity: lucia.id });
  notify({ type: "QUOTE_SENT", channel: "WHATSAPP", to: wa(luciaCustomer.phone), body: `¡Hola Lucía! Tu cotización está lista: ${appUrl}/cotizacion/${lucia.publicToken}`, actionUrl: `${appUrl}/cotizacion/${lucia.publicToken}`, at: addMinutes(lucia.sentAt!, 1), quoteId: lucia.id, leadId: leads.lucia!.id, entity: lucia.id });

  const ximena = quotes.ximena!;
  notify({ type: "QUOTE_EXPIRING", channel: "WHATSAPP", to: wa(C.ximena!.phone), body: "Hola Ximena, tu cotización vence en 48 horas. ¿Te ayudamos a apartar tu fecha?", actionUrl: `${appUrl}/cotizacion/${ximena.publicToken}`, at: addDays(ximena.validUntil!, -2), quoteId: ximena.id, leadId: leads.ximena!.id, entity: ximena.id });

  const e1 = events.e1;
  const e2 = events.e2;
  const e3 = events.e3;
  const e4 = events.e4;
  const e5 = events.e5;
  const e6 = events.e6;

  notify({ type: "QUOTE_ACCEPTED", channel: "EMAIL", to: OWNER_EMAIL, subject: `Cotización aceptada: ${e6.title}`, body: `${C.fernanda!.name} aceptó ${e6.quote.code}. Anticipo pendiente.`, actionUrl: `${appUrl}/admin/events/${e6.id}`, at: addMinutes(e6.quote.acceptedAt!, 1), quoteId: e6.quote.id, eventId: e6.id, entity: e6.quote.id });
  notify({ type: "PORTAL_ACCESS", channel: "EMAIL", to: C.fernanda!.email!, subject: "Tu portal de evento", body: "Desde tu portal puedes pagar el anticipo, ver los detalles y administrar a tus invitadas.", actionUrl: `${appUrl}/mi-evento/${e6.portalToken}`, at: addMinutes(e6.quote.acceptedAt!, 2), eventId: e6.id, entity: e6.id });

  const e1Deposit = e1.paymentIds.find((p) => p.kind === "DEPOSIT")!;
  notify({ type: "PAYMENT_RECEIVED", channel: "EMAIL", to: C.sofia!.email!, subject: "Recibimos tu anticipo", body: `¡Gracias, Sofía! Recibimos tu anticipo de ${formatMXN(e1Deposit.amountCents)}. Tu fecha está confirmada.`, actionUrl: `${appUrl}/mi-evento/${e1.portalToken}`, at: addMinutes(e1.quote.acceptedAt!, 10), eventId: e1.id, entity: e1Deposit.id });
  notify({ type: "BOOKING_CONFIRMED", channel: "EMAIL", to: C.paola!.email!, subject: "¡Bridal Brunch confirmado!", body: "Tu evento está confirmado. Comparte la invitación con las amigas de Mariana desde tu portal.", actionUrl: `${appUrl}/mi-evento/${e2.portalToken}`, at: addMinutes(e2.quote.acceptedAt!, 20), eventId: e2.id, entity: e2.id });
  const e2Balance = e2.paymentIds.find((p) => p.kind === "BALANCE")!;
  notify({ type: "PAYMENT_DUE", channel: "EMAIL", to: C.paola!.email!, subject: "Recordatorio: saldo de tu evento", body: `Tu saldo de ${formatMXN(e2Balance.amountCents)} vence 3 días antes del evento. Puedes pagarlo en línea desde tu portal.`, actionUrl: `${appUrl}/mi-evento/${e2.portalToken}`, at: clock.at(-1, "10:00"), eventId: e2.id, entity: e2Balance.id });
  const e3Deposit = e3.paymentIds.find((p) => p.kind === "DEPOSIT")!;
  notify({ type: "PAYMENT_RECEIVED", channel: "WHATSAPP", to: wa(C.daniela!.phone), body: `¡Gracias, Dani! Registramos tu transferencia de ${formatMXN(e3Deposit.amountCents)}. ¡A calentar la voz!`, actionUrl: `${appUrl}/mi-evento/${e3.portalToken}`, at: clock.at(-17, "11:25"), eventId: e3.id, entity: e3Deposit.id });

  const camila = e1.guests.find((g) => g.token === DEMO_TOKENS.camilaGuest)!;
  notify({ type: "RSVP_REMINDER", channel: "WHATSAPP", to: wa(camila.phone ?? "+52 55 6400 0001"), body: "Hola Camila, Sofía te espera en su cumpleaños. ¿Nos confirmas tu asistencia?", actionUrl: `${appUrl}/e/${e1.slug}/${camila.token}`, at: clock.hoursAgo(6), eventId: e1.id, entity: camila.id });
  const daniPineda = e1.guests.find((g) => g.name === "Daniela Pineda")!;
  if (daniPineda.email) {
    notify({ type: "RSVP_REMINDER", channel: "EMAIL", to: daniPineda.email, subject: "¿Vienes al cumpleaños de Sofía?", body: "Confirma tu asistencia y cuéntanos si tienes alguna restricción alimentaria.", actionUrl: `${appUrl}/e/${e1.slug}/${daniPineda.token}`, at: clock.hoursAgo(6), eventId: e1.id, entity: daniPineda.id });
  }
  notify({ type: "STAFF_ASSIGNED", channel: "WHATSAPP", to: wa(DEMO_USERS.lupita.phone), body: `Lupita, quedaste asignada como coordinadora en "${e1.title}".`, actionUrl: `${appUrl}/staff/events/${e1.id}`, at: addDays(e1.quote.acceptedAt!, 1), eventId: e1.id, entity: `${e1.id}-lupita` });

  notify({ type: "EVENT_7D", channel: "EMAIL", to: C.valeria!.email!, subject: "¡Falta una semana!", body: "Tu Perú x México está a 7 días. Revisa la lista de invitadas y restricciones en tu portal.", actionUrl: `${appUrl}/mi-evento/${e4.portalToken}`, at: addDays(e4.startsAt, -7), eventId: e4.id, entity: e4.id });
  notify({ type: "REVIEW_REQUEST", channel: "EMAIL", to: C.valeria!.email!, subject: "¿Cómo te fue?", body: "Nos encantaría saber qué te pareció tu experiencia. Toma menos de un minuto.", actionUrl: `${appUrl}/mi-evento/${e4.portalToken}`, at: addDays(e4.endsAt, 2), eventId: e4.id, entity: e4.id });
  notify({ type: "EVENT_7D", channel: "EMAIL", to: C.anapaula!.email!, subject: "¡Falta una semana!", body: "Tu Signature Brunch está a 7 días. Confirma número final de invitadas en tu portal.", actionUrl: `${appUrl}/mi-evento/${e5.portalToken}`, at: addDays(e5.startsAt, -7), eventId: e5.id, entity: e5.id });
  notify({ type: "EVENT_48H", channel: "WHATSAPP", to: wa(C.anapaula!.phone), body: "¡Pasado mañana es tu brunch! Llegaremos 2.5 horas antes para montar.", at: addDays(e5.startsAt, -2), eventId: e5.id, entity: e5.id });
  notify({ type: "POST_EVENT", channel: "EMAIL", to: C.anapaula!.email!, subject: "Gracias por celebrar con nosotras", body: "Estamos preparando tu Memory Capsule. Muy pronto podrás compartirla con tus invitadas.", actionUrl: `${appUrl}/mi-evento/${e5.portalToken}`, at: addDays(e5.endsAt, 1), eventId: e5.id, entity: e5.id });

  await prisma.notificationLog.createMany({ data: notifications });

  // ---------------------------------------------------------------------------
  // ANALYTICS: embudo de los últimos 45 días (PRNG determinista)
  // ---------------------------------------------------------------------------
  const expWeights = [
    { value: "signature-brunch", weight: 30 },
    { value: "birthday-table", weight: 26 },
    { value: "karaoke-mimosas", weight: 20 },
    { value: "bridal-brunch", weight: 14 },
    { value: "peru-x-mexico", weight: 10 },
  ];
  const sources = [
    { value: "instagram", weight: 40 },
    { value: "google", weight: 22 },
    { value: "tiktok", weight: 15 },
    { value: "whatsapp", weight: 10 },
    { value: "direct", weight: 13 },
  ];
  const devices = [
    { value: "mobile", weight: 78 },
    { value: "desktop", weight: 22 },
  ];
  const windowMs = 45 * DAY_MS;
  const sessions = Array.from({ length: 300 }, (_, i) => {
    // Más tráfico reciente: sesgo cuadrático hacia hoy, y horario de 8 a 23 h aprox.
    const ageMs = Math.pow(rng(), 1.3) * windowMs;
    let ts = new Date(now.getTime() - ageMs);
    ts = new Date(ts.getTime() - (ts.getTime() % MINUTE_MS));
    return {
      id: `s_${(i + 1).toString(36).padStart(3, "0")}${Math.floor(rng() * 1e6).toString(36)}`,
      ts,
      exp: pickWeighted(rng, expWeights),
      source: pickWeighted(rng, sources),
      device: pickWeighted(rng, devices),
    };
  });
  // Las sesiones que avanzan más en el embudo son las más antiguas (para que sus pasos posteriores no caigan en el futuro).
  const older = sessions.filter((s) => now.getTime() - s.ts.getTime() > 5 * DAY_MS);
  const newer = sessions.filter((s) => now.getTime() - s.ts.getTime() <= 5 * DAY_MS);
  const funnel = [...shuffle(rng, older), ...shuffle(rng, newer)];
  const analytics: Prisma.AnalyticsEventCreateManyInput[] = [];
  const track = (type: AnalyticsEventType, s: (typeof sessions)[number], offsetMin: number, extra: Partial<Prisma.AnalyticsEventCreateManyInput> = {}) => {
    const createdAt = notAfter(addMinutes(s.ts, offsetMin), now);
    analytics.push({
      type,
      sessionId: s.id,
      path: extra.path ?? null,
      experienceId: extra.experienceId ?? null,
      leadId: extra.leadId ?? null,
      quoteId: extra.quoteId ?? null,
      eventId: extra.eventId ?? null,
      metadata: extra.metadata ?? json({ source: s.source, device: s.device }),
      createdAt,
    });
  };
  const STAGES: { type: AnalyticsEventType; count: number; offset: () => number }[] = [
    { type: "START_CONFIGURATOR", count: 120, offset: () => randInt(rng, 1, 6) },
    { type: "COMPLETE_CONFIGURATOR", count: 60, offset: () => randInt(rng, 7, 18) },
    { type: "SUBMIT_LEAD", count: 40, offset: () => randInt(rng, 19, 25) },
    { type: "VIEW_QUOTE", count: 25, offset: () => randInt(rng, 60 * 20, 60 * 50) },
    { type: "ACCEPT_QUOTE", count: 10, offset: () => randInt(rng, 60 * 52, 60 * 96) },
    { type: "START_PAYMENT", count: 9, offset: () => randInt(rng, 60 * 97, 60 * 98) },
    { type: "PAYMENT_SUCCESS", count: 8, offset: () => randInt(rng, 60 * 98 + 2, 60 * 98 + 8) },
  ];
  for (const s of sessions) {
    const exp = refs.experiences[s.exp]!;
    track("VIEW_EXPERIENCE", s, 0, { path: `/experiencias/${s.exp}`, experienceId: exp.id });
  }
  const acceptedQuotes = Object.values(events).map((e) => e.quote);
  for (const stage of STAGES) {
    for (let i = 0; i < stage.count; i++) {
      const s = funnel[i]!;
      const exp = refs.experiences[s.exp]!;
      const quote = stage.type === "ACCEPT_QUOTE" || stage.type === "START_PAYMENT" || stage.type === "PAYMENT_SUCCESS" ? acceptedQuotes[i % acceptedQuotes.length] : undefined;
      const path =
        stage.type === "START_CONFIGURATOR" || stage.type === "COMPLETE_CONFIGURATOR" || stage.type === "SUBMIT_LEAD"
          ? `/crear-experiencia?experiencia=${s.exp}`
          : "/cotizacion/[token]";
      track(stage.type, s, stage.offset(), {
        path,
        experienceId: exp.id,
        quoteId: quote?.id ?? null,
        metadata: json({ source: s.source, device: s.device, ...(stage.type === "PAYMENT_SUCCESS" ? { provider: "mock" } : {}) }),
      });
    }
  }
  // RSVP: 30 respuestas de invitadas en los eventos con invitación activa
  const rsvpEvents = [e1, e2, e3, e4, e5];
  for (let i = 0; i < 30; i++) {
    const ev = rsvpEvents[i % rsvpEvents.length]!;
    const guest = ev.guests[i % Math.max(1, ev.guests.length)];
    const ageDays = Math.max(0.2, Math.min(44, (now.getTime() - ev.quote.acceptedAt!.getTime()) / DAY_MS - 0.5));
    const createdAt = notAfter(new Date(now.getTime() - rng() * ageDays * DAY_MS), now);
    analytics.push({
      type: "RSVP_SUBMIT",
      sessionId: `g_${i.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
      path: `/e/${ev.slug}`,
      eventId: ev.id,
      metadata: json({ rsvpStatus: guest?.rsvpStatus ?? "ATTENDING", device: "mobile" }),
      createdAt: new Date(Math.min(createdAt.getTime(), ev.startsAt.getTime())),
    });
  }
  analytics.push({
    type: "AI_DESIGN_GENERATED",
    sessionId: "s_ai_demo",
    path: "/crear-experiencia/ai",
    leadId: isabel.id,
    metadata: json({ provider: "mock", usedFallback: true }),
    createdAt: clock.hoursAgo(20.5),
  });
  await prisma.analyticsEvent.createMany({ data: analytics });

  // ---------------------------------------------------------------------------
  // AUDITORÍA
  // ---------------------------------------------------------------------------
  const U = refs.users;
  const audit = (actor: UserKey | null, action: string, entityType: string, entityId: string, at: Date, before: unknown, after: unknown): Prisma.AuditLogCreateManyInput => ({
    actorId: actor ? U[actor].id : null,
    actorEmail: actor ? U[actor].email : null,
    action,
    entityType,
    entityId,
    before: before === null ? undefined : json(before),
    after: after === null ? undefined : json(after),
    ip: "127.0.0.1",
    createdAt: notAfter(at, now),
  });
  const e2Quote = e2.quote;
  const e3Deposit2 = e3.paymentIds.find((p) => p.kind === "DEPOSIT")!;
  const e4Balance = e4.paymentIds.find((p) => p.kind === "BALANCE")!;
  await prisma.auditLog.createMany({
    data: [
      audit("ivonne", "quote.discount_applied", "Quote", e2Quote.id, clock.at(-39, "10:20"), { discountCents: 0, totalCents: e2Quote.calc.subtotalCents }, { discountType: "PERCENT", discountValue: 500, discountCents: e2Quote.calc.discountCents, totalCents: e2Quote.calc.totalCents, reason: e2Quote.discount?.reason ?? null }),
      audit("rosa", "quote.sent", "Quote", e2Quote.id, clock.at(-39, "10:30"), { status: "DRAFT" }, { status: "SENT" }),
      audit("ivonne", "quote.sent", "Quote", lucia.id, lucia.sentAt!, { status: "DRAFT" }, { status: "SENT" }),
      audit("rosa", "payment.manual_recorded", "Payment", e3Deposit2.id, clock.at(-17, "11:20"), null, { kind: "DEPOSIT", method: "TRANSFER", amountCents: e3Deposit2.amountCents, reference: "SPEI 0849321" }),
      audit("rosa", "event.status_changed", "Event", e3.id, clock.at(-10, "10:00"), { status: "CONFIRMED" }, { status: "PLANNING" }),
      audit("rosa", "payment.manual_recorded", "Payment", e4Balance.id, addDays(e4.startsAt, -4), null, { kind: "BALANCE", method: "TRANSFER", amountCents: e4Balance.amountCents, reference: "SPEI 7712045" }),
      audit("lupita", "inventory.loss_recorded", "InventoryItem", refs.inventory["COP-AGU-01"]!.id, addMinutes(e4.endsAt, 155), null, { sku: "COP-AGU-01", quantity: 1, eventId: e4.id }),
      audit("ivonne", "event.status_changed", "Event", e4.id, addMinutes(e4.endsAt, 30), { status: "IN_PROGRESS" }, { status: "COMPLETED" }),
      audit("ivonne", "event.closed", "Event", e4.id, addDays(e4.endsAt, 3), { closedAt: null }, { closed: true }),
      audit("rosa", "event.status_changed", "Event", e5.id, addMinutes(e5.endsAt, 30), { status: "IN_PROGRESS" }, { status: "COMPLETED" }),
      audit("rosa", "lead.status_changed", "Lead", leads.alejandra!.id, clock.at(-13, "10:00"), { status: "CONTACTED" }, { status: "LOST", lostReason: "Fuera de zona de cobertura (Santa Fe)." }),
      audit("superadmin", "settings.updated", "Setting", "pricing", clock.at(-90, "09:00"), null, { quoteValidityDays: 7, depositBps: 5000 }),
    ],
  });

  // ---------------------------------------------------------------------------
  // DISEÑADOR IA (muestra en modo mock / fallback)
  // ---------------------------------------------------------------------------
  const sig = refs.experiences["signature-brunch"]!;
  await prisma.aiDesign.create({
    data: {
      leadId: isabel.id,
      provider: "mock",
      model: null,
      promptVersion: "ai-designer.v1",
      usedFallback: true,
      prompt: "Diseña una experiencia íntima de brunch para 8 amigas en una terraza de Granada; estilo muy verde con flores silvestres; presupuesto $15,000–$20,000.",
      input: json({
        occasion: "FRIENDS_BRUNCH",
        guestCount: 8,
        serviceAreaSlug: "granada",
        vibe: "Brunch tranquilo en terraza, muy verde, con flores silvestres",
        colors: ["verde salvia", "blanco"],
        budgetRangeId: "seed-budget-02",
        dietary: ["VEGETARIAN"],
      }),
      output: json({
        title: "Brunch botánico de media mañana",
        concept:
          "Una mesa larga vestida con lino crudo y camino de gasa salvia, follaje abundante y flores silvestres en floreros de vidrio ámbar. Luz natural, conversación tranquila y un menú vegetariano fresco.",
        experienceSlug: sig.slug,
        styleSlug: "natural",
        menuSlug: "brunch-garden",
        addOnSlugs: ["taller-floral", "papeleria-personalizada"],
        palette: ["#F7F3EC", "#E8DCC8", "#A3B18A", "#5C6B4E"],
        tableDescription: "Lino crudo, bajo platos de ratán, vajilla blanca y cubiertos dorados mate.",
        flowers: "Margaritas, lavanda, eucalipto y ramas de olivo.",
        music: "Bossa nova y jazz suave.",
        estimatedFromCents: sig.basePriceCents + 2 * sig.extraGuestPriceCents,
        disclaimer: "Propuesta generada en modo demostración. El precio final se confirma en la cotización.",
      }),
      createdAt: clock.hoursAgo(20.5),
    },
  });
}
