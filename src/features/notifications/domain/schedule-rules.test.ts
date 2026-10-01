import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  HOUR_MS,
  MAX_SEND_ATTEMPTS,
  STALE_QUEUED_MS,
  balanceCents,
  completedEventsWindow,
  dedupeKeys,
  emptyCounts,
  isEvent48hDue,
  isEvent7dDue,
  isPostEventDue,
  isQuoteExpiringSoon,
  isQuoteOverdue,
  isReviewRequestDue,
  isRsvpReminderDue,
  paidNetCents,
  paymentDueStage,
  quoteExpiringWindow,
  retryArchiveKey,
  retryArchivePrefix,
  shouldRetrySend,
  summarizeCounts,
  totalCount,
  upcomingEventsWindow,
  withChannel,
  type PaymentLike,
} from "./schedule-rules";

// 1 oct 2026, 12:00 en CDMX (UTC-6) = 18:00 UTC
const NOW = new Date("2026-10-01T18:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

describe("cotizaciones", () => {
  it("detecta cotizaciones que vencen dentro de la ventana", () => {
    expect(isQuoteExpiringSoon(at(10 * HOUR_MS), NOW, 48)).toBe(true);
    expect(isQuoteExpiringSoon(at(48 * HOUR_MS), NOW, 48)).toBe(true);
    expect(isQuoteExpiringSoon(at(49 * HOUR_MS), NOW, 48)).toBe(false);
    expect(isQuoteExpiringSoon(at(-1), NOW, 48)).toBe(false);
    expect(isQuoteExpiringSoon(null, NOW, 48)).toBe(false);
  });

  it("detecta cotizaciones vencidas", () => {
    expect(isQuoteOverdue(at(-HOUR_MS), NOW)).toBe(true);
    expect(isQuoteOverdue(NOW, NOW)).toBe(true);
    expect(isQuoteOverdue(at(HOUR_MS), NOW)).toBe(false);
    expect(isQuoteOverdue(null, NOW)).toBe(false);
  });

  it("ventana de búsqueda", () => {
    const w = quoteExpiringWindow(NOW, 24);
    expect(w.from).toEqual(NOW);
    expect(w.to.getTime() - NOW.getTime()).toBe(24 * HOUR_MS);
  });
});

describe("saldos", () => {
  const pay = (p: Partial<PaymentLike>): PaymentLike => ({
    kind: "DEPOSIT",
    status: "PAID",
    amountCents: 0,
    refundedCents: 0,
    ...p,
  });

  it("suma pagos efectivos netos de reembolsos e ignora pendientes/fallidos", () => {
    const payments = [
      pay({ amountCents: 500_000 }),
      pay({ kind: "BALANCE", status: "PENDING", amountCents: 500_000 }),
      pay({ kind: "BALANCE", status: "FAILED", amountCents: 500_000 }),
      pay({ kind: "BALANCE", status: "PARTIAL_REFUND", amountCents: 200_000, refundedCents: 50_000 }),
      pay({ kind: "REFUND", status: "PAID", amountCents: 50_000 }),
    ];
    expect(paidNetCents(payments)).toBe(650_000);
    expect(balanceCents(1_000_000, payments)).toBe(350_000);
  });

  it("el saldo nunca es negativo", () => {
    expect(balanceCents(100, [pay({ amountCents: 500 })])).toBe(0);
  });

  it("etapas del recordatorio de saldo", () => {
    expect(paymentDueStage(at(2 * DAY_MS), NOW)).toBe("upcoming");
    expect(paymentDueStage(at(3 * DAY_MS), NOW)).toBe("upcoming");
    expect(paymentDueStage(at(3 * DAY_MS + 1), NOW)).toBeNull();
    expect(paymentDueStage(at(-HOUR_MS), NOW)).toBe("overdue");
    expect(paymentDueStage(null, NOW)).toBeNull();
  });
});

describe("eventos próximos", () => {
  it("RSVP: dentro de N días naturales y antes de iniciar", () => {
    // 5 oct 11:00 CDMX = 4 días naturales
    expect(isRsvpReminderDue(new Date("2026-10-05T17:00:00Z"), NOW, 5)).toBe(true);
    // 6 oct = 5 días
    expect(isRsvpReminderDue(new Date("2026-10-06T17:00:00Z"), NOW, 5)).toBe(true);
    // 7 oct = 6 días
    expect(isRsvpReminderDue(new Date("2026-10-07T17:00:00Z"), NOW, 5)).toBe(false);
    // ya empezó
    expect(isRsvpReminderDue(at(-HOUR_MS), NOW, 5)).toBe(false);
  });

  it("7D: entre 3 y 7 días naturales", () => {
    expect(isEvent7dDue(new Date("2026-10-08T17:00:00Z"), NOW)).toBe(true); // 7 días
    expect(isEvent7dDue(new Date("2026-10-04T17:00:00Z"), NOW)).toBe(true); // 3 días
    expect(isEvent7dDue(new Date("2026-10-03T17:00:00Z"), NOW)).toBe(false); // 2 días → toca 48h
    expect(isEvent7dDue(new Date("2026-10-09T17:00:00Z"), NOW)).toBe(false); // 8 días
  });

  it("48H: dentro de las 48 horas previas", () => {
    expect(isEvent48hDue(at(47 * HOUR_MS), NOW)).toBe(true);
    expect(isEvent48hDue(at(48 * HOUR_MS), NOW)).toBe(true);
    expect(isEvent48hDue(at(49 * HOUR_MS), NOW)).toBe(false);
    expect(isEvent48hDue(at(-1), NOW)).toBe(false);
  });

  it("la ventana de búsqueda cubre RSVP y 7D", () => {
    expect(upcomingEventsWindow(NOW, 5).to.getTime() - NOW.getTime()).toBe(8 * DAY_MS);
    expect(upcomingEventsWindow(NOW, 14).to.getTime() - NOW.getTime()).toBe(15 * DAY_MS);
  });
});

describe("eventos completados", () => {
  it("post-evento: ≥ 1 día y ≤ 30 días", () => {
    expect(isPostEventDue(at(-DAY_MS), NOW)).toBe(true);
    expect(isPostEventDue(at(-DAY_MS + 1), NOW)).toBe(false);
    expect(isPostEventDue(at(-30 * DAY_MS), NOW)).toBe(true);
    expect(isPostEventDue(at(-31 * DAY_MS), NOW)).toBe(false);
    expect(isPostEventDue(null, NOW)).toBe(false);
  });

  it("reseña: ≥ 3 días y ≤ 45 días", () => {
    expect(isReviewRequestDue(at(-3 * DAY_MS), NOW)).toBe(true);
    expect(isReviewRequestDue(at(-2 * DAY_MS), NOW)).toBe(false);
    expect(isReviewRequestDue(at(-46 * DAY_MS), NOW)).toBe(false);
  });

  it("ventana de búsqueda", () => {
    const w = completedEventsWindow(NOW);
    expect(NOW.getTime() - w.to.getTime()).toBe(DAY_MS);
    expect(NOW.getTime() - w.from.getTime()).toBe(45 * DAY_MS);
  });
});

describe("claves de idempotencia", () => {
  it("son estables y distinguen canal y fecha", () => {
    const due = new Date("2026-10-07T17:00:00Z");
    expect(dedupeKeys.paymentDue("b1", due, "upcoming")).toBe(dedupeKeys.paymentDue("b1", due, "upcoming"));
    expect(dedupeKeys.paymentDue("b1", due, "upcoming")).not.toBe(dedupeKeys.paymentDue("b1", due, "overdue"));
    expect(dedupeKeys.quoteExpiring("q1", due)).not.toBe(dedupeKeys.quoteExpiring("q1", at(1)));
    expect(withChannel(dedupeKeys.postEvent("e1"), "email")).toBe("sched:post_event:e1:email");
    expect(withChannel(dedupeKeys.rsvpReminder("e1", "g1"), "wa")).toBe("sched:rsvp_reminder:e1:g1:wa");
  });
});

describe("resumen", () => {
  it("suma y describe sólo reglas con actividad", () => {
    const c = { ...emptyCounts(), rsvpReminder: 3, quotesExpired: 1 };
    expect(totalCount(c)).toBe(4);
    expect(summarizeCounts(c)).toBe("Cotizaciones expiradas: 1 · Recordatorios RSVP: 3");
    expect(summarizeCounts(emptyCounts())).toMatch(/No había/);
  });
});

describe("reintentos de envíos fallidos", () => {
  const prev = (status: "QUEUED" | "SENT" | "MOCKED" | "FAILED" | "SKIPPED", ageMs = 0) => ({
    status,
    createdAt: at(-ageMs),
  });

  it("sólo reintenta FALLIDOS o QUEUED abandonados, y con tope de intentos", () => {
    expect(shouldRetrySend(prev("FAILED"), 1, NOW)).toBe(true);
    expect(shouldRetrySend(prev("FAILED"), MAX_SEND_ATTEMPTS - 1, NOW)).toBe(true);
    expect(shouldRetrySend(prev("FAILED"), MAX_SEND_ATTEMPTS, NOW)).toBe(false);
    expect(shouldRetrySend(prev("QUEUED", STALE_QUEUED_MS - 1), 1, NOW)).toBe(false);
    expect(shouldRetrySend(prev("QUEUED", STALE_QUEUED_MS), 1, NOW)).toBe(true);
    for (const s of ["SENT", "MOCKED", "SKIPPED"] as const) expect(shouldRetrySend(prev(s, DAY_MS), 1, NOW)).toBe(false);
  });

  it("archiva cada intento con una clave distinta derivada de la original", () => {
    const key = withChannel(dedupeKeys.event48h("e1", NOW), "email");
    expect(retryArchiveKey(key, 1)).toBe(`${key}:attempt:1`);
    expect(retryArchiveKey(key, 1).startsWith(retryArchivePrefix(key))).toBe(true);
    expect(retryArchiveKey(key, 1)).not.toBe(retryArchiveKey(key, 2));
  });
});
