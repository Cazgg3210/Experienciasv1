/**
 * Helpers y factories del paquete 5 "Operación y back-office" (OPS, STF, INV, PUR, FIN, SET, CNT, NOT).
 * Los usan las carpetas operations/, staff/, inventory/, purchasing/, finance/, settings/, content/ y notifications/.
 *
 * Reglas:
 *  - Cada prueba crea SUS datos (nombres únicos con prefijo "E2E"); el seed DEMO es sólo lectura.
 *  - Se respetan las reglas del dominio: códigos con generateCode, tokens con generateToken, fechas @db.Date con dateOnly,
 *    dinero en centavos y horas en zona America/Mexico_City.
 *  - Nada aquí toca código de la app: sólo Prisma sobre la base E2E del carril y utilidades puras de src/lib.
 */
import type { APIRequestContext, Browser, Locator, Page, Response } from "@playwright/test";
import type { EventStatus, Prisma, PrismaClient, StaffFunction } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ACCOUNTS, createCustomer, expect, PASSWORD, uniq, uniqEmail, uniqPhone, type E2ERole } from "../fixtures";
import { generateCode } from "../../../src/lib/codes";
import { generateToken } from "../../../src/lib/tokens";
import { addDaysUtc, dateOnly, localDateKey, toDateKey, zonedDateTime } from "../../../src/lib/dates";

export { formatMXN } from "../../../src/lib/money";

// -----------------------------------------------------------------------------
// Fechas (zona de negocio CDMX)
// -----------------------------------------------------------------------------

/** YYYY-MM-DD de hoy + n días en CDMX. */
export function dayKey(offsetDays: number): string {
  return toDateKey(addDaysUtc(dateOnly(localDateKey()), offsetDays));
}

/** Instante a partir de fecha local + hora local (CDMX). */
export function at(dateKey: string, time: string): Date {
  return zonedDateTime(dateKey, time);
}

/** Valor para <input type="datetime-local"> en hora CDMX. */
export function localInput(dateKey: string, time: string): string {
  return `${dateKey}T${time}`;
}

/** Fecha futura "aleatoria" (evita que dos pruebas paralelas compartan día cuando no deben). */
export function randomFutureDayKey(min = 70, max = 300): string {
  const span = max - min;
  return dayKey(min + (randomBytes(2).readUInt16BE(0) % span));
}

// -----------------------------------------------------------------------------
// Usuarios y staff del seed
// -----------------------------------------------------------------------------

export async function userIdOf(db: PrismaClient, role: E2ERole): Promise<string> {
  const u = await db.user.findUniqueOrThrow({ where: { email: ACCOUNTS[role].email }, select: { id: true } });
  return u.id;
}

/** Ficha de staff (StaffMember) ligada a la cuenta de staff del seed (Lupita = staff, Carlos = staff2). */
export async function staffMemberOf(db: PrismaClient, role: "staff" | "staff2") {
  return db.staffMember.findFirstOrThrow({
    where: { user: { email: ACCOUNTS[role].email } },
    select: { id: true, name: true, userId: true, email: true, phone: true, rateCents: true, rateType: true },
  });
}

// -----------------------------------------------------------------------------
// Eventos
// -----------------------------------------------------------------------------

export type EventOpts = {
  title?: string;
  status?: EventStatus;
  dateKey?: string;
  start?: string;
  end?: string;
  guestCount?: number;
  experienceId?: string | null;
  customerId?: string;
  customer?: Partial<Prisma.CustomerCreateInput>;
  completedAt?: Date | null;
  closedAt?: Date | null;
  neighborhood?: string | null;
  cancelledAt?: Date | null;
};

/** Evento propio de la prueba (sin cotización ni reserva). Por defecto CONFIRMADO dentro de ~10 días. */
export async function createEvent(db: PrismaClient, opts: EventOpts = {}) {
  const customer = opts.customerId
    ? await db.customer.findUniqueOrThrow({ where: { id: opts.customerId } })
    : await createCustomer(db, { name: `Clienta ${uniq("E2E")}`, ...opts.customer });
  const dk = opts.dateKey ?? dayKey(10);
  const start = opts.start ?? "12:00";
  const end = opts.end ?? "16:00";
  const slug = uniq("e2e-evento").toLowerCase();
  const status = opts.status ?? "CONFIRMED";
  return db.event.create({
    data: {
      code: generateCode("EV"),
      title: opts.title ?? `Evento ${uniq("E2E")}`,
      status,
      customerId: customer.id,
      experienceId: opts.experienceId ?? null,
      occasion: "BIRTHDAY",
      eventDate: dateOnly(dk),
      startsAt: at(dk, start),
      endsAt: at(dk, end),
      guestCount: opts.guestCount ?? 8,
      neighborhood: opts.neighborhood === undefined ? "Polanco" : opts.neighborhood,
      addressLine: "Calle E2E 123",
      micrositeSlug: slug,
      inviteToken: generateToken(),
      portalToken: generateToken(),
      completedAt: opts.completedAt ?? (status === "COMPLETED" ? new Date(Date.now() - 2 * 86_400_000) : null),
      cancelledAt: opts.cancelledAt ?? (status === "CANCELLED" ? new Date() : null),
      closedAt: opts.closedAt ?? null,
    },
    include: { customer: true },
  });
}

/** Asignación directa (Prisma) de un integrante a un evento. */
export async function assignStaff(
  db: PrismaClient,
  eventId: string,
  staffMemberId: string,
  fn: StaffFunction = "COORDINATOR",
  extra: Partial<Prisma.StaffAssignmentUncheckedCreateInput> = {},
) {
  const ev = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { startsAt: true, endsAt: true } });
  return db.staffAssignment.create({
    data: {
      eventId,
      staffMemberId,
      function: fn,
      startsAt: new Date(ev.startsAt.getTime() - 2 * 3_600_000),
      endsAt: new Date(ev.endsAt.getTime() + 3_600_000),
      amountCents: 120_000,
      confirmed: true,
      ...extra,
    },
  });
}

/** Tarea de checklist del evento creada directamente (sin plantilla). */
export async function createChecklistItem(
  db: PrismaClient,
  eventId: string,
  data: Partial<Prisma.EventChecklistItemUncheckedCreateInput> = {},
) {
  return db.eventChecklistItem.create({
    data: {
      eventId,
      phase: "T_MINUS_3",
      area: "GENERAL",
      title: data.title ?? `Tarea ${uniq("E2E")}`,
      status: "PENDING",
      sortOrder: 1,
      ...data,
    },
  });
}

// -----------------------------------------------------------------------------
// Staff (fichas y cuentas propias)
// -----------------------------------------------------------------------------

export async function createStaffMember(db: PrismaClient, data: Partial<Prisma.StaffMemberUncheckedCreateInput> = {}) {
  return db.staffMember.create({
    data: {
      name: data.name ?? `Integrante ${uniq("E2E")}`,
      primaryFunction: "SERVER",
      phone: uniqPhone(),
      email: uniqEmail("staff"),
      rateCents: 90_000,
      rateType: "PER_EVENT",
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      active: true,
      ...data,
    },
  });
}

/** Contraseña temporal de prueba (cumple las reglas: ≥10, letras y números, sin el correo). */
export function tempPassword(): string {
  return `Prueba${randomBytes(4).toString("hex")}9`;
}

/** Cuenta STAFF propia ligada a una ficha nueva (para probar el portal sin tocar a Lupita/Carlos). */
export async function createStaffUser(db: PrismaClient, opts: { password?: string; name?: string } = {}) {
  const password = opts.password ?? tempPassword();
  const name = opts.name ?? `Staff ${uniq("E2E")}`;
  const email = uniqEmail("cuenta-staff");
  const user = await db.user.create({
    data: { email, name, role: "STAFF", passwordHash: await bcrypt.hash(password, 10), active: true },
  });
  const member = await createStaffMember(db, { name, email, userId: user.id, primaryFunction: "SERVER" });
  return { user, member, email, password };
}

/** Inicia sesión por la UI en una página nueva sin sesión (la vigila el guard de la prueba). */
export async function loginInFreshPage(anonPage: () => Promise<Page>, email: string, password: string): Promise<Page> {
  const page = await anonPage();
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  return page;
}

// -----------------------------------------------------------------------------
// Inventario, proveedores, compras, finanzas
// -----------------------------------------------------------------------------

export async function createInventoryItem(db: PrismaClient, data: Partial<Prisma.InventoryItemUncheckedCreateInput> = {}) {
  const sku = `E2E-${randomBytes(4).toString("hex").toUpperCase()}`;
  return db.inventoryItem.create({
    data: {
      sku,
      name: data.name ?? `Artículo ${uniq("E2E")}`,
      category: "DECOR",
      unit: "pz",
      totalQuantity: 10,
      maintenanceQuantity: 0,
      lowStockThreshold: 2,
      replacementCostCents: 15_000,
      location: "Bodega E2E",
      active: true,
      ...data,
    },
  });
}

export async function createReservation(
  db: PrismaClient,
  eventId: string,
  inventoryItemId: string,
  quantity: number,
  status: "RESERVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED" = "RESERVED",
) {
  return db.inventoryReservation.create({ data: { eventId, inventoryItemId, quantity, status } });
}

/** Experiencia propia e INACTIVA (no aparece en el sitio público) con requerimientos de inventario. */
export async function createExperienceWithReqs(
  db: PrismaClient,
  reqs: Array<{ inventoryItemId: string; quantity: number; perGuest: boolean }>,
) {
  const slug = uniq("e2e-exp").toLowerCase();
  return db.experience.create({
    data: {
      name: `Experiencia ${uniq("E2E")}`,
      slug,
      description: "Experiencia de prueba E2E (inactiva).",
      basePriceCents: 1_000_000,
      active: false,
      inventoryReqs: { create: reqs },
    },
  });
}

export async function createVendor(db: PrismaClient, data: Partial<Prisma.VendorUncheckedCreateInput> = {}) {
  return db.vendor.create({
    data: {
      name: data.name ?? `Proveedor ${uniq("E2E")}`,
      category: "FLOWERS",
      contactName: "Contacto E2E",
      phone: "55 1234 5678",
      email: uniqEmail("proveedor"),
      status: "ACTIVE",
      rating: 4,
      ...data,
    },
  });
}

export async function createPurchase(db: PrismaClient, data: Partial<Prisma.PurchaseUncheckedCreateInput> = {}) {
  return db.purchase.create({
    data: {
      concept: data.concept ?? `Compra ${uniq("E2E")}`,
      category: "FLOWERS",
      expectedAmountCents: 150_000,
      status: "REQUESTED",
      ...data,
    },
  });
}

/**
 * Cotización ACEPTADA + reserva (Booking) + pago de anticipo para un evento propio, con montos conocidos.
 * Venta = totalCents (IVA incluido en taxCents).
 */
export async function attachSale(
  db: PrismaClient,
  event: { id: string; customerId: string; title: string; guestCount: number },
  opts: { totalCents: number; taxCents: number; paidCents?: number; feeCents?: number },
) {
  const quote = await db.quote.create({
    data: {
      code: generateCode("Q"),
      publicToken: generateToken(),
      status: "ACCEPTED",
      customerId: event.customerId,
      title: event.title,
      guestCount: event.guestCount,
      subtotalCents: opts.totalCents - opts.taxCents,
      taxCents: opts.taxCents,
      totalCents: opts.totalCents,
      acceptedAt: new Date(),
    },
  });
  await db.event.update({ where: { id: event.id }, data: { quoteId: quote.id } });
  const booking = await db.booking.create({
    data: {
      code: generateCode("B"),
      quoteId: quote.id,
      customerId: event.customerId,
      eventId: event.id,
      totalCents: opts.totalCents,
      depositRequiredCents: Math.round(opts.totalCents / 2),
      termsVersion: "2026-09",
      termsAcceptedAt: new Date(),
      acceptedByName: "Clienta E2E",
    },
  });
  let payment = null;
  if (opts.paidCents) {
    payment = await db.payment.create({
      data: {
        bookingId: booking.id,
        kind: "DEPOSIT",
        status: "PAID",
        method: "TRANSFER",
        provider: "manual",
        amountCents: opts.paidCents,
        feeCents: opts.feeCents ?? 0,
        idempotencyKey: uniq("e2e-pay"),
        paidAt: new Date(),
      },
    });
  }
  return { quote, booking, payment };
}

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------

/**
 * Espera a que React haya hidratado el elemento (tiene sus props de React) antes de interactuar.
 * Un fill/click hecho antes de la hidratación se pierde (react-hook-form no lo registra): es una
 * carrera de la prueba, no un bug de la app.
 */
export async function ready(locator: Locator): Promise<Locator> {
  await expect(locator).toBeVisible();
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), {
      message: "elemento hidratado por React",
    })
    .toBe(true);
  return locator;
}

/**
 * Fetch RSC con que `router.refresh()` vuelve a pedir `pathname` después de una acción, ya descargado COMPLETO.
 * Regístralo ANTES de disparar la acción y espéralo antes de `page.reload()`: si la recarga arranca con ese
 * fetch en vuelo (el payload RSC llega en streaming, después de los encabezados), Firefox lo aborta, Next cae a
 * una navegación completa ("Falling back to browser navigation") y la recarga de la prueba termina en
 * NS_BINDING_ABORTED (OPS-010). Excluye prefetches.
 */
export async function routerRefreshed(page: Page, pathname: string): Promise<Response> {
  const res = await page.waitForResponse((r) => {
    const req = r.request();
    const headers = req.headers();
    return req.method() === "GET" && headers["rsc"] === "1" && !headers["next-router-prefetch"] && new URL(r.url()).pathname === pathname;
  });
  const failure = await res.finished(); // el cuerpo en streaming terminó de llegar
  expect(failure, "el refresh RSC terminó sin error").toBeNull();
  return res;
}

/** Toast de sonner con el texto indicado. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text }).first();
}

/** Confirma un ConfirmDialog (alertdialog) con su botón de confirmación. */
export async function confirmAlert(page: Page, confirmLabel: string | RegExp): Promise<void> {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel }).click();
  await expect(dialog).toBeHidden();
}

/** Elige una opción de un <Select> de Radix (combobox) por su etiqueta. */
export async function pickRadixOption(scope: Page | Locator, page: Page, comboboxName: string | RegExp, option: string | RegExp) {
  await scope.getByRole("combobox", { name: comboboxName }).click();
  await page.getByRole("option", { name: option }).click();
}

/** Scroll horizontal del documento (0 = sin desbordes). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** PNG válido de 1×1 (magic bytes reales) para subidas. */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Archivo de texto disfrazado de imagen (debe rechazarse por magic bytes). */
export const FAKE_PNG = Buffer.from("esto no es una imagen, es texto plano E2E\n", "utf8");

/** ¿El almacenamiento S3 local responde? (si no, las subidas quedan BLOCKED). */
export async function storageAvailable(request: APIRequestContext): Promise<boolean> {
  const endpoint = process.env.STORAGE_ENDPOINT ?? "http://localhost:9000";
  try {
    const res = await request.get(endpoint, { timeout: 5_000, failOnStatusCode: false });
    return res.status() > 0;
  } catch {
    return false;
  }
}

/** Marca la prueba como BLOCKED por ENVIRONMENT ISSUE (documentado) y la omite. */
export function blocked(test: { info(): { annotations: Array<{ type: string; description?: string }> }; skip: (c: boolean, d: string) => void }, why: string) {
  test.info().annotations.push({ type: "blocked", description: `ENVIRONMENT ISSUE: ${why}` });
  test.skip(true, `BLOCKED: ${why}`);
}

/** Reemplaza todas las apariciones de `from` por `to` en el body capturado de una Server Action. */
export function swapInBody(body: Buffer | null, from: string, to: string): string {
  return (body ?? Buffer.from("")).toString("utf8").split(from).join(to);
}

/** Respuesta de una Server Action con { ok:false, code } (texto RSC). */
export function actionError(text: string): { ok: boolean; code?: string; error?: string } {
  const ok = /"ok":true/.test(text);
  const code = /"code":"([A-Z_]+)"/.exec(text)?.[1];
  const error = /"error":"([^"]*)"/.exec(text)?.[1];
  return { ok, code, error };
}

export async function auditCount(db: PrismaClient, action: string, entityId?: string | null): Promise<number> {
  return db.auditLog.count({ where: { action, ...(entityId ? { entityId } : {}) } });
}

export { PASSWORD, uniq, uniqEmail, uniqPhone, ACCOUNTS };
export type { Browser };
