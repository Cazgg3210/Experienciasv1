/**
 * Helpers del paquete 6 (transversal: smoke, recorridos críticos, responsive, accesibilidad).
 * Sólo los usan las carpetas tests/e2e/{smoke,critical,responsive,accessibility}.
 *
 * Las factories crean datos PROPIOS con valores únicos siguiendo las reglas del dominio
 * (códigos con generateCode, tokens de 256 bits, fechas @db.Date con dateOnly, dinero en centavos).
 * Replican lo que hacen los servicios de la app (booking-service, lead-intake…) para preparar
 * precondiciones rápido; los pasos que se PRUEBAN siempre se recorren por la UI.
 */
import { randomBytes, randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";
import bcrypt from "bcryptjs";
import type { EventStatus, Prisma, PrismaClient } from "@prisma/client";
import { expect, type Page } from "@playwright/test";
import { dateOnly, localDateKey, toDateKey, weekdayOf, zonedDateTime } from "../../../src/lib/dates";
import { formatMXN } from "../../../src/lib/money";
import { generateCode } from "../../../src/lib/codes";
import { generateToken } from "../../../src/lib/tokens";
import {
  createCustomer,
  storageStatePath,
  test as baseTest,
  uniq,
  uniqEmail,
  uniqPhone,
  type E2ERole,
} from "../fixtures";

export { formatMXN, generateToken, localDateKey, toDateKey };
export * from "../fixtures";

/**
 * `test` del paquete: agrega `deskPage(role)` = sesión del rol en un contexto de ESCRITORIO (1440×900).
 * En los recorridos @mobile la clienta/invitada/staff usan el `page` móvil (390×844) y la fundadora
 * trabaja desde su computadora: así el proyecto mobile-chrome no fuerza el panel admin a 390 px.
 * En proyectos de escritorio es igual a rolePage(role).
 */
export const test = baseTest.extend<{ deskPage: (role: E2ERole) => Promise<Page> }>({
  deskPage: async ({ browser, guard, rolePage }, use, testInfo) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (role) => {
      if (!testInfo.project.use.isMobile) return rolePage(role);
      const context = await browser.newContext({
        storageState: storageStatePath(role),
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      });
      contexts.push(context);
      const page = await context.newPage();
      guard.watch(page);
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` desplazado `days` días desde hoy (zona CDMX). */
export function dayKeyFromToday(days: number): string {
  const today = dateOnly(localDateKey());
  return toDateKey(new Date(today.getTime() + days * DAY_MS));
}

/** Formato de dinero tal como lo muestra la app ($12,500 / $1,234.50). */
export const mxn = (cents: number) => formatMXN(cents);

/** Escapa un texto para usarlo dentro de un RegExp. */
export function rx(text: string, flags = ""): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
}

/** Texto de dinero tolerante a espacios no separables (Intl puede emitir NBSP). */
export function moneyRx(cents: number): RegExp {
  return new RegExp(rx(mxn(cents)).source.replace(/\s/g, "\\s"));
}

// -----------------------------------------------------------------------------
// Catálogo de referencia (sólo lectura del seed)
// -----------------------------------------------------------------------------

export type RefCatalog = {
  experience: { id: string; name: string; slug: string; basePriceCents: number; baseGuests: number; durationMinutes: number };
  menuId: string | null;
  serviceArea: { id: string; name: string } | null;
  styleId: string | null;
};

/** Primera experiencia activa del seed con su menú y zona activa compatibles. */
export async function refCatalog(db: PrismaClient, slug?: string): Promise<RefCatalog> {
  const exp = await db.experience.findFirst({
    where: { active: true, ...(slug ? { slug } : {}) },
    orderBy: { sortOrder: "asc" },
    include: {
      menus: { where: { active: true }, select: { id: true }, take: 1 },
      serviceAreas: { where: { active: true }, select: { id: true, name: true }, take: 1 },
      styles: { where: { active: true }, select: { id: true }, take: 1 },
    },
  });
  if (!exp) throw new Error("El seed no tiene experiencias activas");
  const area = exp.serviceAreas[0] ?? (await db.serviceArea.findFirst({ where: { active: true }, select: { id: true, name: true } }));
  return {
    experience: {
      id: exp.id,
      name: exp.name,
      slug: exp.slug,
      basePriceCents: exp.basePriceCents,
      baseGuests: exp.baseGuests,
      durationMinutes: exp.durationMinutes,
    },
    menuId: exp.menus[0]?.id ?? null,
    serviceArea: area ?? null,
    styleId: exp.styles[0]?.id ?? null,
  };
}

/**
 * Fecha libre para reservar: día abierto según las reglas de disponibilidad, sin excepciones
 * y sin ningún evento ese día. Aleatoria dentro del rango para no chocar con otros workers.
 */
export async function freeDateKey(db: PrismaClient, opts: { minDays?: number; maxDays?: number } = {}): Promise<string> {
  const min = opts.minDays ?? 30;
  const max = opts.maxDays ?? 300;
  const rules = await db.availabilityRule.findMany({ select: { weekday: true, isOpen: true, maxEvents: true } });
  const open = new Set(rules.filter((r) => r.isOpen && r.maxEvents > 0).map((r) => r.weekday));
  for (let attempt = 0; attempt < 80; attempt++) {
    const key = dayKeyFromToday(randomInt(min, max + 1));
    if (!open.has(weekdayOf(key))) continue;
    const day = dateOnly(key);
    const [events, exceptions] = await Promise.all([
      db.event.count({ where: { eventDate: day } }),
      db.availabilityException.count({ where: { date: day } }),
    ]);
    if (events === 0 && exceptions === 0) return key;
  }
  throw new Error("No se encontró una fecha libre para la prueba");
}

// -----------------------------------------------------------------------------
// Leads y cotizaciones
// -----------------------------------------------------------------------------

export async function pricingSettings(db: PrismaClient) {
  const row = await db.setting.findUnique({ where: { key: "pricing" } });
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return {
    taxRateBps: typeof v.taxRateBps === "number" ? v.taxRateBps : 1600,
    pricesIncludeTax: typeof v.pricesIncludeTax === "boolean" ? v.pricesIncludeTax : true,
    depositBps: typeof v.depositBps === "number" ? v.depositBps : 5000,
  };
}

/** Lead (con clienta) listo para cotizar: experiencia, menú, zona y fecha libre. */
export async function createQuotableLead(db: PrismaClient, opts: { status?: "NEW" | "QUALIFIED" | "QUOTED" } = {}) {
  const ref = await refCatalog(db);
  const dateKey = await freeDateKey(db);
  const name = `Clienta ${uniq("CRIT")}`;
  const customer = await createCustomer(db, { name, source: "CONFIGURATOR" });
  const lead = await db.lead.create({
    data: {
      code: generateCode("L"),
      customerId: customer.id,
      name,
      email: customer.email,
      phone: customer.phone,
      occasion: "BIRTHDAY",
      status: opts.status ?? "NEW",
      source: "CONFIGURATOR",
      eventDate: dateOnly(dateKey),
      guestCount: ref.experience.baseGuests,
      experienceId: ref.experience.id,
      menuId: ref.menuId,
      serviceAreaId: ref.serviceArea?.id ?? null,
      styleId: ref.styleId,
      honoreeName: name.split(" ")[1] ?? "Festejada",
    },
  });
  return { lead, customer, ref, dateKey };
}

/** Cotización ENVIADA (SENT, vigente) ligada a un lead QUOTED, con un concepto de precio. */
export async function createSentQuote(db: PrismaClient, opts: { totalCents?: number } = {}) {
  const { lead, customer, ref, dateKey } = await createQuotableLead(db, { status: "QUOTED" });
  const pricing = await pricingSettings(db);
  const total = opts.totalCents ?? ref.experience.basePriceCents;
  const tax = pricing.pricesIncludeTax ? Math.round(total - (total * 10_000) / (10_000 + pricing.taxRateBps)) : 0;
  const deposit = Math.round((total * pricing.depositBps) / 10_000);
  const quote = await db.quote.create({
    data: {
      code: generateCode("Q"),
      publicToken: generateToken(),
      status: "SENT",
      leadId: lead.id,
      customerId: customer.id,
      experienceId: ref.experience.id,
      menuId: ref.menuId,
      serviceAreaId: ref.serviceArea?.id ?? null,
      occasion: "BIRTHDAY",
      title: `Cumpleaños de ${lead.honoreeName}`,
      eventDate: dateOnly(dateKey),
      startTime: "11:00",
      guestCount: ref.experience.baseGuests,
      subtotalCents: total,
      taxCents: tax,
      totalCents: total,
      estimatedCostCents: Math.round(total * 0.45),
      estimatedMarginCents: total - tax - Math.round(total * 0.45),
      depositBps: pricing.depositBps,
      depositCents: deposit,
      validUntil: new Date(Date.now() + 7 * DAY_MS),
      sentAt: new Date(),
      items: {
        create: [
          {
            type: "BASE_EXPERIENCE",
            refId: ref.experience.id,
            description: ref.experience.name,
            quantity: 1,
            unitPriceCents: total,
            totalPriceCents: total,
            unitCostCents: Math.round(total * 0.45),
            totalCostCents: Math.round(total * 0.45),
            costCategory: "FOOD",
          },
        ],
      },
    },
  });
  return { quote, lead, customer, ref, dateKey };
}

// -----------------------------------------------------------------------------
// Eventos con reserva (cotización aceptada + booking + pagos)
// -----------------------------------------------------------------------------

export type BookedEventOpts = {
  status?: EventStatus;
  /** Días desde hoy (negativo = evento pasado). Si se omite se busca una fecha libre futura. */
  daysFromToday?: number;
  totalCents?: number;
  /** Impuesto incluido en el total (centavos). Default: IVA 16% incluido. */
  taxCents?: number;
  estimatedCostCents?: number;
  depositPaid?: boolean;
  balancePaid?: boolean;
  title?: string;
  honoreeName?: string;
  guestCount?: number;
  closedAt?: Date | null;
};

export async function createBookedEvent(db: PrismaClient, opts: BookedEventOpts = {}) {
  const ref = await refCatalog(db);
  const status: EventStatus = opts.status ?? "CONFIRMED";
  const dateKey = opts.daysFromToday != null ? dayKeyFromToday(opts.daysFromToday) : await freeDateKey(db);
  const total = opts.totalCents ?? 2_320_000;
  const tax = opts.taxCents ?? Math.round(total - (total * 10_000) / 11_600);
  const deposit = Math.round(total / 2);
  const honoree = opts.honoreeName ?? `Festejada ${randomBytes(2).toString("hex")}`;
  const title = opts.title ?? `E2E Cumpleaños de ${honoree} ${randomBytes(2).toString("hex")}`;
  const name = `Clienta ${uniq("EVT")}`;
  const customer = await createCustomer(db, { name, email: uniqEmail("anfitriona"), phone: uniqPhone() });
  const startsAt = zonedDateTime(dateKey, "11:00");
  const endsAt = new Date(startsAt.getTime() + ref.experience.durationMinutes * 60_000);
  const guestCount = opts.guestCount ?? ref.experience.baseGuests;
  const slug = `e2e-${randomBytes(5).toString("hex")}`;

  const quote = await db.quote.create({
    data: {
      code: generateCode("Q"),
      publicToken: generateToken(),
      status: "ACCEPTED",
      customerId: customer.id,
      experienceId: ref.experience.id,
      menuId: ref.menuId,
      serviceAreaId: ref.serviceArea?.id ?? null,
      occasion: "BIRTHDAY",
      title,
      eventDate: dateOnly(dateKey),
      startTime: "11:00",
      guestCount,
      subtotalCents: total,
      taxCents: tax,
      totalCents: total,
      estimatedCostCents: opts.estimatedCostCents ?? 900_000,
      estimatedMarginCents: total - tax - (opts.estimatedCostCents ?? 900_000),
      depositBps: 5000,
      depositCents: deposit,
      validUntil: new Date(Date.now() + 7 * DAY_MS),
      sentAt: new Date(),
      acceptedAt: new Date(),
    },
  });
  const event = await db.event.create({
    data: {
      code: generateCode("EV"),
      title,
      status,
      customerId: customer.id,
      quoteId: quote.id,
      experienceId: ref.experience.id,
      menuId: ref.menuId,
      serviceAreaId: ref.serviceArea?.id ?? null,
      occasion: "BIRTHDAY",
      honoreeName: honoree,
      eventDate: dateOnly(dateKey),
      startsAt,
      endsAt,
      guestCount,
      micrositeSlug: slug,
      inviteToken: generateToken(),
      portalToken: generateToken(),
      completedAt: status === "COMPLETED" ? endsAt : null,
      closedAt: opts.closedAt ?? null,
    },
  });
  const booking = await db.booking.create({
    data: {
      code: generateCode("B"),
      quoteId: quote.id,
      customerId: customer.id,
      eventId: event.id,
      totalCents: total,
      depositRequiredCents: deposit,
      termsVersion: "2026-09",
      termsAcceptedAt: new Date(),
      acceptedByName: name,
      balanceDueAt: new Date(startsAt.getTime() - 3 * DAY_MS),
    },
  });
  const paid = (kind: "DEPOSIT" | "BALANCE", amount: number) =>
    db.payment.create({
      data: {
        bookingId: booking.id,
        kind,
        status: "PAID",
        method: "TRANSFER",
        provider: "manual",
        amountCents: amount,
        feeCents: 0,
        idempotencyKey: `e2e:${generateToken(12)}`,
        paidAt: new Date(),
      },
    });
  if (opts.depositPaid ?? status !== "PENDING_PAYMENT") await paid("DEPOSIT", deposit);
  if (opts.balancePaid) await paid("BALANCE", total - deposit);
  return { event, booking, quote, customer, ref, dateKey, total, deposit, tax };
}

/** Invitada de un evento (token personal para su RSVP). */
export async function createGuest(db: PrismaClient, eventId: string, name = `Invitada ${uniq("GST")}`) {
  return db.eventGuest.create({
    data: { eventId, name, token: generateToken(), source: "HOST", rsvpStatus: "PENDING" },
  });
}

/** Tarea de checklist (asignada o libre). */
export async function createChecklistItem(db: PrismaClient, eventId: string, data: { title?: string; assigneeId?: string | null } = {}) {
  return db.eventChecklistItem.create({
    data: {
      eventId,
      phase: "SETUP",
      area: "GENERAL",
      title: data.title ?? `Tarea ${uniq("CHK")}`,
      assigneeId: data.assigneeId ?? null,
      status: "PENDING",
    },
  });
}

/** Cápsula de recuerdos publicada con subidas de invitadas abiertas. */
export async function createCapsule(db: PrismaClient, eventId: string, data: Partial<Prisma.MemoryCapsuleUncheckedCreateInput> = {}) {
  return db.memoryCapsule.create({
    data: {
      eventId,
      title: data.title ?? `Recuerdos ${uniq("MEM")}`,
      message: data.message ?? "Gracias por celebrar con nosotras.",
      shareToken: generateToken(),
      published: data.published ?? true,
      allowGuestUploads: data.allowGuestUploads ?? true,
    },
  });
}

// -----------------------------------------------------------------------------
// Staff de prueba con acceso propio (para verificar "ve SÓLO sus eventos")
// -----------------------------------------------------------------------------

export async function createStaffUser(db: PrismaClient) {
  const tag = randomBytes(4).toString("hex");
  const email = `e2e-staff-${tag}@e2e.ivonne-rosa.test`;
  // Contraseña de prueba generada al vuelo (sólo existe en la base E2E del carril).
  const password = `E2e!${randomBytes(9).toString("base64url")}`;
  const user = await db.user.create({
    data: {
      email,
      name: `Staff E2E ${tag}`,
      role: "STAFF",
      active: true,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  const member = await db.staffMember.create({
    data: {
      userId: user.id,
      name: user.name,
      primaryFunction: "SERVER",
      email,
      rateCents: 80_000,
      rateType: "PER_EVENT",
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      active: true,
    },
  });
  return { user, member, email, password };
}

/**
 * ENVIRONMENT ISSUE conocido (ver docs/qa/findings/transversal.md): el catálogo del configurador se
 * cachea con unstable_cache (60 s) en `.next-e2e/cache/fetch-cache`, carpeta COMPARTIDA por todos los
 * carriles (cada uno con su base re-sembrada = otros cuid). La página puede servir IDs de otra base y
 * el envío falla con "Esa experiencia ya no está disponible". Antes de recorrer el configurador se
 * espera (recargando) a que el HTML traiga los IDs de ESTA base; si no ocurre, la prueba queda BLOCKED.
 */
export async function ensureConfiguratorCatalogMatchesDb(page: Page, db: PrismaClient): Promise<void> {
  const ids = (await db.experience.findMany({ where: { active: true }, select: { id: true } })).map((e) => e.id);
  let matched = true;
  try {
    // Cada recarga dispara la revalidación stale-while-revalidate de la entrada vencida.
    await expect
      .poll(
        async () => {
          await page.goto("/crear-experiencia");
          const html = await page.content();
          return ids.some((id) => html.includes(id));
        },
        { timeout: 150_000, intervals: [1_000, 3_000, 5_000] },
      )
      .toBe(true);
  } catch {
    matched = false;
  }
  if (!matched) {
    test.info().annotations.push({
      type: "blocked",
      description:
        "ENVIRONMENT ISSUE: la caché de datos de Next (.next-e2e/cache/fetch-cache) sirve el catálogo de otro carril/semilla; IDs inexistentes en esta base.",
    });
    test.skip(true, "BLOCKED: catálogo del configurador cacheado desde otra base (caché compartida entre carriles)");
  }
  test.info().annotations.push({ type: "precondición", description: "catálogo del configurador consistente con la base del carril" });
}

/**
 * Mismo ENVIRONMENT ISSUE en /experiencias/[slug] (unstable_cache 300 s compartido entre carriles):
 * si el HTML trae un id de experiencia que NO existe en esta base, el beacon VIEW_EXPERIENCE recibe
 * 422 (experiencia desconocida). Sólo en ese caso —verificado— se tolera el 422 y se anota; si el id
 * coincide con la base, cualquier 422 sigue siendo un fallo real.
 */
export async function toleratesStaleExperienceCache(
  page: Page,
  db: PrismaClient,
  guard: { allow: (r: RegExp) => void },
  slug: string,
): Promise<boolean> {
  const exp = await db.experience.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const html = await page.content();
  if (html.includes(exp.id)) return false;
  guard.allow(/status of 422/);
  test.info().annotations.push({
    type: "environment",
    description: `ENVIRONMENT ISSUE: /experiencias/${slug} servida desde la caché compartida con un id de otra base; beacon 422 tolerado`,
  });
  return true;
}

/** Login real por la UI (formulario /login). */
export async function loginViaUi(page: Page, email: string, password: string, expectPath: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => expectPath.test(u.pathname), { timeout: 45_000 });
}

// -----------------------------------------------------------------------------
// Utilidades de UI
// -----------------------------------------------------------------------------

/** Scroll horizontal del documento (px) — tolerancia de la suite: 1 px. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Lista de elementos que se salen del viewport por la derecha (diagnóstico para el reporte). */
export async function overflowCulprits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) {
        const style = getComputedStyle(el);
        if (style.position === "fixed" && style.visibility === "hidden") continue;
        out.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} right=${Math.round(r.right)} w=${Math.round(r.width)} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
        if (out.length >= 8) break;
      }
    }
    return out;
  });
}

/** El foco es visible: el elemento enfocado tiene outline o box-shadow (anillo) distinto de "none". */
export async function focusIsVisible(page: Page): Promise<{ tag: string; label: string; visible: boolean }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { tag: "body", label: "", visible: false };
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    const ring = s.boxShadow && s.boxShadow !== "none";
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 60),
      visible: !!(outline || ring),
    };
  });
}

/** Espera a que una notificación quede en el "mock inbox" (NotificationLog). */
export async function expectNotification(
  db: PrismaClient,
  where: Prisma.NotificationLogWhereInput,
  message: string,
) {
  await expect
    .poll(async () => db.notificationLog.count({ where }), { message, timeout: 20_000 })
    .toBeGreaterThan(0);
}

// -----------------------------------------------------------------------------
// Imagen PNG válida (magic bytes reales) para subidas de prueba
// -----------------------------------------------------------------------------

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** PNG RGB de `size`×`size` de un color sólido. */
export function makePng(size = 24, rgb: [number, number, number] = [156, 175, 136]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
