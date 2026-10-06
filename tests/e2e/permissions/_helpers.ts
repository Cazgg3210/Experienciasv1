/**
 * Helpers del paquete 1 "Acceso y seguridad" (carril 1). Sólo los usan tests/e2e/{auth,permissions,navigation,api}.
 *
 * - Factories de datos PROPIOS (usuarias del equipo, eventos con reserva/invitadas/cápsula/checklist, cotización
 *   borrador) siguiendo las reglas del dominio: tokens de 256 bits, códigos legibles, fechas @db.Date con dateOnly.
 * - Construcción de Server Actions a partir del manifiesto del build (`.next-e2e/server/server-reference-manifest.json`):
 *   da el id real de la acción y las páginas que la importan. Sirve para repetir (replay) acciones cuya UI es
 *   compleja; SIEMPRE se acompaña de un control positivo que demuestra que el request construido es ejecutable.
 * - Firmas HMAC (media, resultado de pago, webhook mock) con los mismos secretos que el servidor (.env).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { APIRequestContext, Page } from "@playwright/test";
import type { EventStatus, PrismaClient, Role } from "@prisma/client";
import { createCustomer, uniq, uniqEmail, type CapturedAction } from "../fixtures";

export const ROOT = path.resolve(__dirname, "..", "..", "..");

export function baseUrl(): string {
  return process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3200}`;
}

// ---------------------------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------------------------

/** Token opaco de 256 bits (mismo formato que generateToken de la app). */
export function token(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function e2eCode(prefix: string): string {
  return `${prefix}-E2E-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** YYYY-MM-DD en America/Mexico_City desplazado `days` días. */
export function dateKeyInDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function dateOnly(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

export function strongPassword(): string {
  return `E2e-${randomBytes(5).toString("hex")}-Clave9`;
}

export type TeamUser = { id: string; email: string; name: string; password: string; role: Role; staffMemberId?: string };

/** Usuaria del equipo propia de la prueba (nunca se tocan las cuentas demo). */
export async function createTeamUser(
  db: PrismaClient,
  opts: { role?: Role; active?: boolean; withStaffMember?: boolean; password?: string } = {},
): Promise<TeamUser> {
  const role = opts.role ?? "OWNER";
  const password = opts.password ?? strongPassword();
  const name = uniq("Equipo E2E");
  const email = uniqEmail(`acc-${role.toLowerCase()}`);
  const user = await db.user.create({
    data: { name, email, role, active: opts.active ?? true, passwordHash: await bcrypt.hash(password, 10) },
  });
  let staffMemberId: string | undefined;
  if (opts.withStaffMember || role === "STAFF") {
    const member = await db.staffMember.create({
      data: { name, email, userId: user.id, primaryFunction: "SERVER", availableWeekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
    staffMemberId = member.id;
  }
  return { id: user.id, email, name, password, role, staffMemberId };
}

export type EventGraph = {
  eventId: string;
  code: string;
  title: string;
  slug: string;
  portalToken: string;
  inviteToken: string;
  customerId: string;
  bookingId?: string;
  quoteId?: string;
  guests: Array<{ id: string; name: string; token: string }>;
  capsule?: { id: string; shareToken: string };
  checklist: Array<{ id: string; title: string; assigneeId: string | null }>;
};

/**
 * Evento propio con lo necesario para pruebas de acceso: reserva (cotización aceptada + booking),
 * invitadas con token personal, cápsula y tareas de checklist (opcionalmente asignadas a staff).
 */
export async function createEventGraph(
  db: PrismaClient,
  opts: {
    status?: EventStatus;
    daysAhead?: number;
    withBooking?: boolean;
    totalCents?: number;
    guests?: number;
    capsule?: { published: boolean; allowGuestUploads?: boolean };
    checklist?: Array<{ assigneeStaffMemberId?: string | null; status?: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" }>;
    assignStaffMemberIds?: string[];
  } = {},
): Promise<EventGraph> {
  const customer = await createCustomer(db);
  const key = dateKeyInDays(opts.daysAhead ?? 40 + Math.floor(Math.random() * 200));
  const startsAt = new Date(`${key}T18:00:00.000Z`); // 12:00 CDMX
  const endsAt = new Date(startsAt.getTime() + 4 * 3_600_000);
  const title = uniq("Evento acceso E2E");
  const slug = `e2e-acc-${randomBytes(5).toString("hex")}`;
  const portalToken = token();
  const inviteToken = token();
  const code = e2eCode("EV");
  const event = await db.event.create({
    data: {
      code,
      title,
      status: opts.status ?? "CONFIRMED",
      customerId: customer.id,
      occasion: "BIRTHDAY",
      honoreeName: "Homenajeada E2E",
      eventDate: dateOnly(key),
      startsAt,
      endsAt,
      guestCount: 10,
      addressLine: "Calle Privada E2E 123",
      neighborhood: "Polanco",
      micrositeSlug: slug,
      inviteToken,
      portalToken,
    },
  });
  const graph: EventGraph = {
    eventId: event.id,
    code,
    title,
    slug,
    portalToken,
    inviteToken,
    customerId: customer.id,
    guests: [],
    checklist: [],
  };
  if (opts.withBooking) {
    const total = opts.totalCents ?? 2_000_000;
    const quote = await db.quote.create({
      data: {
        code: e2eCode("Q"),
        publicToken: token(),
        status: "ACCEPTED",
        customerId: customer.id,
        title,
        guestCount: 10,
        subtotalCents: total,
        totalCents: total,
        depositBps: 5000,
        depositCents: Math.round(total / 2),
        acceptedAt: new Date(),
      },
    });
    await db.event.update({ where: { id: event.id }, data: { quoteId: quote.id } });
    const booking = await db.booking.create({
      data: {
        code: e2eCode("B"),
        quoteId: quote.id,
        customerId: customer.id,
        eventId: event.id,
        totalCents: total,
        depositRequiredCents: Math.round(total / 2),
        termsVersion: "e2e",
        termsAcceptedAt: new Date(),
        acceptedByName: customer.name,
      },
    });
    graph.bookingId = booking.id;
    graph.quoteId = quote.id;
  }
  for (let i = 0; i < (opts.guests ?? 0); i++) {
    const g = await db.eventGuest.create({
      data: { eventId: event.id, name: uniq(`Invitada ${i + 1}`), token: token(), source: "HOST" },
      select: { id: true, name: true, token: true },
    });
    graph.guests.push(g);
  }
  if (opts.capsule) {
    const c = await db.memoryCapsule.create({
      data: {
        eventId: event.id,
        title: `Recuerdos ${title}`,
        shareToken: token(24),
        published: opts.capsule.published,
        allowGuestUploads: opts.capsule.allowGuestUploads ?? true,
      },
      select: { id: true, shareToken: true },
    });
    graph.capsule = c;
  }
  for (const staffMemberId of opts.assignStaffMemberIds ?? []) {
    await db.staffAssignment.create({
      data: { eventId: event.id, staffMemberId, function: "SERVER", startsAt, endsAt },
    });
  }
  let n = 0;
  for (const item of opts.checklist ?? []) {
    const row = await db.eventChecklistItem.create({
      data: {
        eventId: event.id,
        phase: "T_MINUS_1",
        area: "GENERAL",
        title: uniq(`Tarea ${++n}`),
        status: item.status ?? "PENDING",
        assigneeId: item.assigneeStaffMemberId ?? null,
        sortOrder: n,
      },
      select: { id: true, title: true, assigneeId: true },
    });
    graph.checklist.push(row);
  }
  return graph;
}

/** Cotización BORRADOR propia con un concepto personalizado (para editor de precios/descuento). */
export async function createDraftQuote(db: PrismaClient) {
  const customer = await createCustomer(db);
  const quote = await db.quote.create({
    data: {
      code: e2eCode("Q"),
      publicToken: token(),
      status: "DRAFT",
      customerId: customer.id,
      title: uniq("Cotización acceso E2E"),
      guestCount: 10,
      subtotalCents: 1_000_000,
      totalCents: 1_000_000,
      depositBps: 5000,
      depositCents: 500_000,
      items: {
        create: [
          {
            type: "CUSTOM",
            description: "Concepto personalizado E2E",
            quantity: 1,
            unitPriceCents: 1_000_000,
            unitCostCents: 400_000,
            totalPriceCents: 1_000_000,
            totalCostCents: 400_000,
            costCategory: "OTHER",
          },
        ],
      },
    },
    include: { items: true },
  });
  return quote;
}

/** IDs reales del seed DEMO (sólo lectura) para la matriz de páginas. */
export async function seedIds(db: PrismaClient) {
  const byTitle = async (title: string) => (await db.event.findFirstOrThrow({ where: { title } })).id;
  const staffUser = await db.user.findUniqueOrThrow({ where: { email: "staff@ivonne-rosa.test" }, include: { staffMember: true } });
  const assigned = await db.staffAssignment.findFirstOrThrow({
    where: { staffMemberId: staffUser.staffMember!.id, event: { title: "Cumpleaños de Sofía" } },
  });
  const pendingCheckout = await db.payment.findFirstOrThrow({
    where: { provider: "mock", status: "PENDING", providerCheckoutId: { not: null } },
  });
  return {
    addOnId: (await db.addOn.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    experienceId: (await db.experience.findFirstOrThrow({ where: { active: true }, orderBy: { createdAt: "asc" } })).id,
    experienceSlug: (await db.experience.findFirstOrThrow({ where: { active: true }, orderBy: { createdAt: "asc" } })).slug,
    menuId: (await db.menu.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    customerId: (await db.customer.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    eventSofia: assigned.eventId,
    eventMariana: await byTitle("Bridal Brunch de Mariana"),
    eventValeria: await byTitle("Perú x México de Valeria"),
    inventoryId: (await db.inventoryItem.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    leadId: (await db.lead.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    templateId: (await db.checklistTemplate.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    purchaseId: (await db.purchase.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    quoteId: (await db.quote.findFirstOrThrow({ where: { title: "Cumpleaños de Lucía" } })).id,
    staffMemberId: staffUser.staffMember!.id,
    vendorId: (await db.vendor.findFirstOrThrow({ orderBy: { createdAt: "asc" } })).id,
    mockCheckoutId: pendingCheckout.providerCheckoutId!,
    paymentIdPending: pendingCheckout.id,
  };
}

// ---------------------------------------------------------------------------------------------
// Server Actions desde el manifiesto del build
// ---------------------------------------------------------------------------------------------

type ManifestEntry = { exportedName: string; filename: string; workers: Record<string, unknown> };
let manifest: Record<string, ManifestEntry> | null = null;

function loadManifest(): Record<string, ManifestEntry> {
  manifest ??= JSON.parse(readFileSync(path.join(ROOT, ".next-e2e", "server", "server-reference-manifest.json"), "utf8")).node;
  return manifest!;
}

/** Id real de la Server Action `name` (opcional: filtrar por archivo o por página que la importa). */
export function actionId(name: string, opts: { file?: RegExp; worker?: string } = {}): string {
  const hits = Object.entries(loadManifest()).filter(
    ([, v]) =>
      v.exportedName === name && (!opts.file || opts.file.test(v.filename.replace(/\\/g, "/"))) && (!opts.worker || opts.worker in v.workers),
  );
  if (hits.length !== 1) throw new Error(`Acción ${name}: ${hits.length} coincidencias en el manifiesto`);
  return hits[0]![0];
}

/** Páginas (workers) que importan la acción: rutas desde donde es ejecutable. */
export function actionWorkers(name: string, file?: RegExp): string[] {
  return Object.values(loadManifest())
    .filter((v) => v.exportedName === name && (!file || file.test(v.filename.replace(/\\/g, "/"))))
    .flatMap((v) => Object.keys(v.workers));
}

/**
 * Request de Server Action listo para replayServerAction: mismo formato que envía el cliente de React
 * (`text/plain`, cuerpo `[args]` serializado). `pagePath` debe ser una página que importe la acción.
 */
export function buildAction(name: string, pagePath: string, input: unknown, opts: { file?: RegExp } = {}): CapturedAction {
  return {
    url: new URL(pagePath, baseUrl()).toString(),
    actionId: actionId(name, opts),
    contentType: "text/plain;charset=UTF-8",
    body: encodeArgs(input),
  };
}

export function withInput(captured: CapturedAction, input: unknown): CapturedAction {
  return { ...captured, body: encodeArgs(input) };
}

/** Cuerpo `[args]` como lo serializa el cliente (sin argumentos ⇒ `[]`). */
function encodeArgs(input: unknown): Buffer {
  return Buffer.from(JSON.stringify(input === undefined ? [] : [input]));
}

/** Parsea el ActionResult de la respuesta RSC ("1:{...}"). */
export function actionResult(text: string): { ok?: boolean; code?: string; error?: string; data?: unknown } | null {
  const line = text.split("\n").find((l) => /^\d+:\{"ok":/.test(l));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(line.indexOf(":") + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Firmas (mismos secretos que el servidor, leídos de .env por playwright.config)
// ---------------------------------------------------------------------------------------------

function secret(name: "AUTH_SECRET" | "PAYMENT_WEBHOOK_SECRET" | "CRON_SECRET"): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} no está definida en .env (necesaria para la prueba)`);
  return v;
}

export function cronSecret(): string {
  return secret("CRON_SECRET");
}

export function signedMediaPath(id: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", secret("AUTH_SECRET")).update(`media:${id}:${exp}`).digest("base64url");
  return `/api/media/${id}?exp=${exp}&sig=${sig}`;
}

export function paymentResultPath(paymentId: string): string {
  const s = createHmac("sha256", `ir-pago-resultado:${secret("AUTH_SECRET")}`)
    .update(`pago-resultado:${paymentId}`)
    .digest("base64url")
    .slice(0, 32);
  return `/pago/resultado?p=${paymentId}&s=${s}`;
}

export function mockWebhookSignature(rawBody: string, timestamp = Math.floor(Date.now() / 1000), key = secret("PAYMENT_WEBHOOK_SECRET")): string {
  const v1 = createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

// ---------------------------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------------------------

export const SESSION_COOKIE = "authjs.session-token";

/** Login real por la UI (formulario de /login). */
export async function loginViaUi(page: Page, email: string, password: string, callbackUrl?: string): Promise<void> {
  await page.goto(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function sessionCookie(page: Page): Promise<string | undefined> {
  return (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE)?.value;
}

/** GET sin seguir redirects: { status, location }. */
export async function probe(api: APIRequestContext, url: string, headers: Record<string, string> = {}) {
  const res = await api.get(url, { maxRedirects: 0, failOnStatusCode: false, headers });
  const location = res.headers()["location"] ?? null;
  return { status: res.status(), location, headers: res.headers(), text: () => res.text() };
}
