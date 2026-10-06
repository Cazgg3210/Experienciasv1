/**
 * Helpers del paquete 4 "Eventos y experiencia" (carril 4): EVT, CAL, PORT, GST, MEM.
 * Se usan desde tests/e2e/{events,calendar,portal,guests,memory}. No modifican fixtures compartidos.
 *
 *  - callAction(): invoca una Server Action por su nombre exportado contra una RUTA que la importa
 *    (mismo request que haría el navegador: POST + Next-Action). Equivale al replay de
 *    captureServerAction pero sin depender de la UI: sirve para validar el BACKEND con datos que la UI
 *    no permitiría (negativas, IDOR, permisos). El id de la acción se lee del manifiesto del build
 *    E2E (.next-e2e), así que siempre coincide con el servidor en ejecución.
 *  - Factories con Prisma (evento + clienta + cotización/reserva/pagos, invitadas, cápsula) siguiendo
 *    las reglas del dominio: tokens de 256 bits, fechas @db.Date con dateOnly, horas en CDMX.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { APIRequestContext, Locator } from "@playwright/test";
import type { EventStatus, PaymentKind, PaymentMethod, PaymentStatus, Prisma, PrismaClient, RsvpStatus } from "@prisma/client";
import { createCustomer, expect, uniq, uniqEmail, uniqPhone } from "../fixtures";
import { dateOnly, localDateKey, zonedDateTime } from "../../../src/lib/dates";
import { formatMXN } from "../../../src/lib/money";

export { formatMXN };

// -----------------------------------------------------------------------------
// Server Actions
// -----------------------------------------------------------------------------

type ManifestEntry = { exportedName: string; filename: string; workers: Record<string, unknown> };
let manifestCache: Record<string, ManifestEntry> | null = null;

function manifest(): Record<string, ManifestEntry> {
  if (!manifestCache) {
    const file = path.join(process.cwd(), ".next-e2e", "server", "server-reference-manifest.json");
    const json = JSON.parse(fs.readFileSync(file, "utf8")) as { node: Record<string, ManifestEntry> };
    manifestCache = json.node;
  }
  return manifestCache;
}

/** Id de la Server Action `name` (nombre exportado). `fileHint` desambigua si hay dos con el mismo nombre. */
export function actionId(name: string, fileHint?: string): string {
  const hits = Object.entries(manifest()).filter(
    ([, v]) => v.exportedName === name && (!fileHint || v.filename.replace(/\\/g, "/").includes(fileHint)),
  );
  if (hits.length !== 1) throw new Error(`Server Action "${name}" no encontrada o ambigua (${hits.length})`);
  return hits[0]![0];
}

export type ActionOutcome = "accepted" | "rejected" | "denied" | "not-executed" | "server-error" | "unknown";

export type ActionCallResult<T = unknown> = {
  status: number;
  redirectedTo: string | null;
  outcome: ActionOutcome;
  ok: boolean | undefined;
  data: T | undefined;
  error: string | undefined;
  code: string | undefined;
  fieldErrors: Record<string, string[]> | undefined;
  raw: string;
};

/**
 * Llama a la Server Action `name` con `args` (un solo argumento, como las acciones del proyecto)
 * enviando el POST a `routePath` (debe ser una página que importe la acción; si no, Next no la ejecuta).
 */
export async function callAction<T = unknown>(
  api: APIRequestContext,
  name: string,
  args: unknown,
  opts: { path: string; fileHint?: string; origin?: string | null },
): Promise<ActionCallResult<T>> {
  const id = actionId(name, opts.fileHint);
  const origin = opts.origin === undefined ? new URL(baseUrl()).origin : opts.origin;
  const res = await api.post(opts.path, {
    headers: {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      ...(origin !== null ? { Origin: origin } : {}),
    },
    data: JSON.stringify([args]),
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const status = res.status();
  const raw = await res.text();
  const redirectedTo = status >= 300 && status < 400 ? (res.headers()["location"] ?? "") : null;
  let parsed: { ok?: boolean; data?: T; error?: string; code?: string; fieldErrors?: Record<string, string[]> } | null = null;
  for (const line of raw.split("\n")) {
    const m = /^1:(\{.*\})\s*$/.exec(line);
    if (m) {
      try {
        parsed = JSON.parse(m[1]!);
      } catch {
        parsed = null;
      }
    }
  }
  let outcome: ActionOutcome = "unknown";
  if (redirectedTo !== null) outcome = "denied";
  else if (status >= 500) outcome = "server-error";
  else if (res.headers()["x-nextjs-action-not-found"] || status === 404) outcome = "not-executed";
  else if (parsed?.ok === true) outcome = "accepted";
  else if (parsed?.ok === false) outcome = ["UNAUTHORIZED", "FORBIDDEN"].includes(parsed.code ?? "") ? "denied" : "rejected";
  return {
    status,
    redirectedTo,
    outcome,
    ok: parsed?.ok,
    data: parsed?.data,
    error: parsed?.error,
    code: parsed?.code,
    fieldErrors: parsed?.fieldErrors,
    raw: raw.slice(0, 2000),
  };
}

/**
 * Espera a que React haya hidratado el elemento (tiene sus props de React adjuntas). Interactuar con un
 * formulario cliente antes de la hidratación pierde los eventos (react-hook-form no ve el cambio).
 */
export async function waitHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator
          .first()
          .evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$") || k.startsWith("__reactFiber$")))
          .catch(() => false),
      { message: "el componente no terminó de hidratarse", timeout: 20_000 },
    )
    .toBe(true);
}

export function baseUrl(): string {
  return process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3200}`;
}

/** Texto de diagnóstico corto para mensajes de expect. */
export function describe(r: ActionCallResult): string {
  return `${r.outcome} ${r.status} ${r.code ?? ""} ${r.error ?? ""} ${r.redirectedTo ?? ""} ${r.outcome === "unknown" ? r.raw.slice(0, 200) : ""}`;
}

// -----------------------------------------------------------------------------
// Fechas
// -----------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function todayKey(): string {
  return localDateKey();
}

export function addDaysKey(key: string, days: number): string {
  return new Date(dateOnly(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  return dateOnly(key).getUTCDay();
}

/** Fechas ya entregadas en este worker (no se reutilizan dentro de la corrida). */
const handedOut = new Set<string>();

/**
 * Fecha futura libre (sin eventos ni excepciones) en el rango y días de la semana pedidos.
 * Para que workers en paralelo no elijan la misma fecha (una prueba podría llenar el día de otra),
 * cada worker usa sólo los desfases `offset % workers === índice del worker` y nunca repite fecha.
 * Por defecto: martes a viernes (capacidad 1 en el seed) entre 60 y 360 días.
 */
export async function pickFreeDate(
  db: PrismaClient,
  opts: { minDays?: number; maxDays?: number; weekdays?: number[] } = {},
): Promise<string> {
  const minDays = opts.minDays ?? 60;
  const maxDays = opts.maxDays ?? 360;
  const weekdays = opts.weekdays ?? [2, 3, 4, 5];
  const workers = Math.max(1, Number(process.env.E2E_WORKERS ?? 2));
  const slot = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % workers;
  const today = todayKey();
  const offsets = Array.from({ length: maxDays - minDays + 1 }, (_, i) => minDays + i).sort(() => Math.random() - 0.5);
  // 1.ª pasada: sólo la partición de este worker; 2.ª: cualquier fecha libre no usada.
  for (const partitioned of [true, false]) {
    for (const offset of offsets) {
      if (partitioned && offset % workers !== slot) continue;
      const key = addDaysKey(today, offset);
      if (handedOut.has(key) || !weekdays.includes(weekdayOfKey(key))) continue;
      const day = dateOnly(key);
      const [events, exceptions] = await Promise.all([
        db.event.count({ where: { eventDate: day } }),
        db.availabilityException.count({ where: { date: day } }),
      ]);
      if (events === 0 && exceptions === 0) {
        handedOut.add(key);
        return key;
      }
    }
  }
  throw new Error("No se encontró una fecha libre para la prueba");
}

// -----------------------------------------------------------------------------
// Factories
// -----------------------------------------------------------------------------

export function token(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function hex(n = 4): string {
  return randomBytes(n).toString("hex");
}

export type PaymentSeed = {
  kind: PaymentKind;
  status: PaymentStatus;
  method?: PaymentMethod;
  provider?: string;
  amountCents: number;
  refundedCents?: number;
  providerCheckoutId?: string | null;
  checkoutUrl?: string | null;
  providerPaymentId?: string | null;
  paidAt?: Date | null;
  createdAt?: Date;
};

export type EventFixture = {
  id: string;
  code: string;
  title: string;
  status: EventStatus;
  portalToken: string;
  inviteToken: string;
  micrositeSlug: string;
  dateKey: string;
  startsAt: Date;
  endsAt: Date;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  quoteId: string | null;
  bookingId: string | null;
  paymentIds: string[];
  portalPath: string;
  invitePath: string;
};

export type CreateEventOpts = {
  status?: EventStatus;
  title?: string;
  /** YYYY-MM-DD; por defecto una fecha futura libre (o pasada si status COMPLETED) */
  dateKey?: string;
  start?: string;
  end?: string;
  guestCount?: number;
  honoreeName?: string | null;
  experienceId?: string | null;
  serviceAreaId?: string | null;
  menuId?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  addressNotes?: string | null;
  hostMessage?: string | null;
  dressCode?: string | null;
  internalNotes?: string | null;
  customerNotes?: string | null;
  micrositeEnabled?: boolean;
  customer?: { id: string; name: string; email: string | null; phone: string | null };
  /** Crea cotización ACEPTADA + reserva (Booking) con estos montos */
  booking?: { totalCents: number; depositCents: number; balanceDueAt?: Date | null } | null;
  payments?: PaymentSeed[];
  timeline?: Array<{ time: string; title: string; visibleToGuests?: boolean; description?: string | null }>;
};

/** Evento propio de la prueba (con clienta nueva y, opcionalmente, reserva y pagos). */
export async function createEventFixture(db: PrismaClient, opts: CreateEventOpts = {}): Promise<EventFixture> {
  const status = opts.status ?? "CONFIRMED";
  const dateKey =
    opts.dateKey ??
    (status === "COMPLETED"
      ? addDaysKey(todayKey(), -(10 + Math.floor(Math.random() * 40)))
      : await pickFreeDate(db));
  const start = opts.start ?? "11:00";
  const end = opts.end ?? "14:00";
  const startsAt = zonedDateTime(dateKey, start);
  const endsAt = zonedDateTime(dateKey, end);
  const title = opts.title ?? `Evento ${uniq("E2E")}`;
  const customer =
    opts.customer ??
    (await createCustomer(db, { name: `Clienta ${uniq("E2E")}`, email: uniqEmail("clienta"), phone: uniqPhone() }));
  const portalToken = token();
  const inviteToken = token();
  const micrositeSlug = `e2e-${hex(5)}`;
  const code = `EV-E2E-${hex(3).toUpperCase()}`;

  let quoteId: string | null = null;
  if (opts.booking) {
    const quote = await db.quote.create({
      data: {
        code: `Q-E2E-${hex(3).toUpperCase()}`,
        publicToken: token(),
        status: "ACCEPTED",
        customerId: customer.id,
        title,
        guestCount: opts.guestCount ?? 10,
        eventDate: dateOnly(dateKey),
        startTime: start,
        subtotalCents: opts.booking.totalCents,
        totalCents: opts.booking.totalCents,
        depositCents: opts.booking.depositCents,
        acceptedAt: new Date(),
        sentAt: new Date(),
      },
    });
    quoteId = quote.id;
  }

  const event = await db.event.create({
    data: {
      code,
      title,
      status,
      customerId: customer.id,
      quoteId,
      experienceId: opts.experienceId ?? null,
      serviceAreaId: opts.serviceAreaId ?? null,
      menuId: opts.menuId ?? null,
      occasion: "BIRTHDAY",
      honoreeName: opts.honoreeName === undefined ? "Festejada E2E" : opts.honoreeName,
      eventDate: dateOnly(dateKey),
      startsAt,
      endsAt,
      guestCount: opts.guestCount ?? 10,
      addressLine: opts.addressLine === undefined ? `Calle E2E ${hex(2)} 123` : opts.addressLine,
      neighborhood: opts.neighborhood === undefined ? "Roma Norte" : opts.neighborhood,
      postalCode: opts.postalCode === undefined ? "06700" : opts.postalCode,
      addressNotes: opts.addressNotes ?? null,
      hostMessage: opts.hostMessage ?? null,
      dressCode: opts.dressCode ?? null,
      internalNotes: opts.internalNotes ?? null,
      customerNotes: opts.customerNotes ?? null,
      colors: [],
      micrositeSlug,
      micrositeEnabled: opts.micrositeEnabled ?? true,
      inviteToken,
      portalToken,
      completedAt: status === "COMPLETED" ? endsAt : null,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
      cancellationReason: status === "CANCELLED" ? "Cancelado por la prueba E2E" : null,
      timeline: opts.timeline
        ? {
            create: opts.timeline.map((t, i) => ({
              time: t.time,
              title: t.title,
              description: t.description ?? null,
              visibleToGuests: t.visibleToGuests ?? true,
              sortOrder: (i + 1) * 10,
            })),
          }
        : undefined,
    },
  });

  let bookingId: string | null = null;
  const paymentIds: string[] = [];
  if (opts.booking && quoteId) {
    const booking = await db.booking.create({
      data: {
        code: `B-E2E-${hex(3).toUpperCase()}`,
        quoteId,
        customerId: customer.id,
        eventId: event.id,
        totalCents: opts.booking.totalCents,
        depositRequiredCents: opts.booking.depositCents,
        termsVersion: "e2e",
        termsAcceptedAt: new Date(),
        acceptedByName: customer.name,
        balanceDueAt: opts.booking.balanceDueAt === undefined ? new Date(startsAt.getTime() - 3 * DAY_MS) : opts.booking.balanceDueAt,
        cancelledAt: status === "CANCELLED" ? new Date() : null,
      },
    });
    bookingId = booking.id;
    for (const p of opts.payments ?? []) {
      const payment = await db.payment.create({
        data: {
          bookingId: booking.id,
          kind: p.kind,
          status: p.status,
          method: p.method ?? "ONLINE",
          provider: p.provider ?? "mock",
          amountCents: p.amountCents,
          refundedCents: p.refundedCents ?? 0,
          providerCheckoutId: p.providerCheckoutId ?? null,
          checkoutUrl: p.checkoutUrl ?? null,
          providerPaymentId: p.providerPaymentId ?? null,
          idempotencyKey: `e2e-${hex(8)}`,
          paidAt: p.paidAt ?? (p.status === "PAID" ? new Date() : null),
          createdAt: p.createdAt ?? new Date(),
        },
      });
      paymentIds.push(payment.id);
    }
  }

  return {
    id: event.id,
    code,
    title,
    status,
    portalToken,
    inviteToken,
    micrositeSlug,
    dateKey,
    startsAt,
    endsAt,
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    quoteId,
    bookingId,
    paymentIds,
    portalPath: `/mi-evento/${portalToken}`,
    invitePath: `/e/${micrositeSlug}/${inviteToken}`,
  };
}

export type GuestFixture = { id: string; token: string; name: string; path: string };

export async function createGuestFixture(
  db: PrismaClient,
  event: Pick<EventFixture, "id" | "micrositeSlug">,
  data: Partial<Prisma.EventGuestUncheckedCreateInput> & { rsvpStatus?: RsvpStatus } = {},
): Promise<GuestFixture> {
  const t = token();
  const guest = await db.eventGuest.create({
    data: {
      eventId: event.id,
      name: data.name ?? `Invitada ${uniq("E2E")}`,
      email: data.email === undefined ? null : data.email,
      phone: data.phone === undefined ? null : data.phone,
      token: t,
      rsvpStatus: data.rsvpStatus ?? "PENDING",
      source: data.source ?? "HOST",
      plusOne: data.plusOne ?? false,
      plusOneName: data.plusOneName ?? null,
      dietaryRestrictions: data.dietaryRestrictions ?? [],
      dietaryNotes: data.dietaryNotes ?? null,
      comment: data.comment ?? null,
      respondedAt: data.rsvpStatus && data.rsvpStatus !== "PENDING" ? new Date() : null,
      invitedAt: new Date(),
    },
  });
  return { id: guest.id, token: t, name: guest.name, path: `/e/${event.micrositeSlug}/${t}` };
}

export type CapsuleFixture = { id: string; shareToken: string; path: string; title: string };

export async function createCapsuleFixture(
  db: PrismaClient,
  eventId: string,
  opts: { published?: boolean; allowGuestUploads?: boolean; title?: string; message?: string | null } = {},
): Promise<CapsuleFixture> {
  const shareToken = token();
  const title = opts.title ?? `Cápsula ${uniq("E2E")}`;
  const capsule = await db.memoryCapsule.create({
    data: {
      eventId,
      title,
      message: opts.message === undefined ? "Mensaje de bienvenida E2E" : opts.message,
      shareToken,
      published: opts.published ?? true,
      allowGuestUploads: opts.allowGuestUploads ?? true,
    },
  });
  return { id: capsule.id, shareToken, path: `/memory/${shareToken}`, title };
}

/** PNG válido de 1×1 px (magic bytes reales) para subidas. */
export function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

/** Sube una foto como invitada por la API pública (misma-origen) y devuelve el id del MediaAsset. */
export async function uploadGuestPhoto(
  api: APIRequestContext,
  shareToken: string,
  opts: { name?: string; consent?: string; file?: { name: string; mimeType: string; buffer: Buffer }; origin?: string | null } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.origin !== null) headers.Origin = opts.origin ?? baseUrl();
  const res = await api.post(`/api/memory/${shareToken}/upload`, {
    headers,
    multipart: {
      file: opts.file ?? { name: "foto.png", mimeType: "image/png", buffer: tinyPng() },
      name: opts.name ?? `Invitada ${uniq("E2E")}`,
      consent: opts.consent ?? "true",
    },
    failOnStatusCode: false,
  });
  let body: { id?: string; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status(), body };
}

/** Experiencia del seed con requerimientos de inventario (para probar reservas al confirmar). */
export async function experienceWithInventory(db: PrismaClient): Promise<string | null> {
  const req = await db.experienceInventoryRequirement.findFirst({ select: { experienceId: true } });
  return req?.experienceId ?? null;
}

/** Último registro de auditoría de una acción sobre una entidad. */
export async function lastAudit(db: PrismaClient, action: string, entityId: string) {
  return db.auditLog.findFirst({ where: { action, entityId }, orderBy: { createdAt: "desc" } });
}

// -----------------------------------------------------------------------------
// Etiquetas de fecha (mismo formato que el calendario del admin: date-fns + locale es)
// -----------------------------------------------------------------------------
import { format } from "date-fns";
import { es } from "date-fns/locale";

/** "marzo 2027" para YYYY-MM */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return format(new Date(y!, m! - 1, 1), "MMMM yyyy", { locale: es });
}

/** "jueves 15 de abril" para YYYY-MM-DD */
export function calendarDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return format(new Date(y!, m! - 1, d!), "EEEE d 'de' MMMM", { locale: es });
}

export { formatLongDate } from "../../../src/lib/dates";
