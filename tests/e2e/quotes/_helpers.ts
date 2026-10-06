/**
 * Helpers del paquete 3 (Comercial admin: leads, clientas, catálogo, cotizaciones).
 * Compartidos por tests/e2e/{leads,customers,catalog,quotes}. NO son fixtures globales.
 *
 *  - callAction(): invoca una Server Action REAL del build (.next-e2e) con la sesión de un rol,
 *    saltándose la validación del cliente. Sirve para:
 *      · negativas de backend (montos negativos, decimales, cantidades < 1, transiciones inválidas…),
 *      · preparar datos con las mismas reglas del dominio (QuoteEngine en servidor, auditoría, timeline),
 *      · RBAC de la acción con roles que pasan el middleware.
 *    El id de la acción se toma del manifiesto de la build (server-reference-manifest.json) por
 *    nombre exportado + archivo; la petición va a una página que importa la acción (Next 15.5 no
 *    ejecuta acciones enviadas a rutas que no la importan).
 *  - Factories con Prisma para datos propios (nombres únicos) y lectura de ajustes de precios.
 */
import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { test } from "../fixtures";

// -----------------------------------------------------------------------------
// Server Actions directas
// -----------------------------------------------------------------------------

type ManifestEntry = { workers: Record<string, unknown>; filename: string; exportedName: string };
let manifestCache: Record<string, ManifestEntry> | null = null;

function manifest(): Record<string, ManifestEntry> {
  if (manifestCache) return manifestCache;
  const file = path.join(process.cwd(), ".next-e2e", "server", "server-reference-manifest.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8")) as { node: Record<string, ManifestEntry> };
  manifestCache = json.node;
  return manifestCache;
}

export type ActionModule = "leads" | "customers" | "catalog" | "quotes";

export type ActionResultLike<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]>; errorId?: string };

export type ActionCall<T> = {
  status: number;
  redirectedTo: string | null;
  raw: string;
  /** null si la acción no se ejecutó (redirect del middleware, acción no encontrada, etc.) */
  result: ActionResultLike<T> | null;
};

/** Ruta (URL) de una página que importa la acción. `params` reemplaza segmentos dinámicos ([id]). */
function routeFor(worker: string, params: Record<string, string>): string | null {
  let route = worker.replace(/^app/, "").replace(/\/page$/, "");
  route = route
    .split("/")
    .filter((seg) => !/^\(.+\)$/.test(seg))
    .join("/");
  let missing = false;
  route = route.replace(/\[([^\]]+)\]/g, (_, key: string) => {
    if (params[key]) return params[key]!;
    missing = true;
    return "";
  });
  return missing ? null : route || "/";
}

export function resolveAction(module: ActionModule, name: string): { id: string; routes: string[] } {
  const wanted = `features${path.sep}${module}${path.sep}server${path.sep}actions.ts`.replace(/\\/g, "/");
  for (const [id, entry] of Object.entries(manifest())) {
    if (entry.exportedName === name && entry.filename.replace(/\\/g, "/").endsWith(wanted)) {
      return { id, routes: Object.keys(entry.workers) };
    }
  }
  throw new Error(`Server Action ${module}/${name} no está en la build .next-e2e`);
}

function baseUrl(): string {
  const fromProject = test.info().project.use.baseURL;
  if (fromProject) return fromProject.replace(/\/$/, "");
  return `http://localhost:${process.env.E2E_PORT ?? 3200}`;
}

/** Extrae `{ ok, … }` de la respuesta RSC (text/x-component) de una Server Action. */
export function parseActionResult<T>(raw: string): ActionResultLike<T> | null {
  for (const line of raw.split("\n")) {
    const m = /^[0-9a-f]+:(\{.*\})\s*$/.exec(line);
    if (!m) continue;
    try {
      const obj = JSON.parse(m[1]!) as Record<string, unknown>;
      if (obj && typeof obj === "object" && "ok" in obj) return obj as ActionResultLike<T>;
    } catch {
      /* línea con árbol RSC: se ignora */
    }
  }
  return null;
}

export async function callAction<T = Record<string, unknown>>(
  api: APIRequestContext,
  module: ActionModule,
  name: string,
  args: unknown,
  opts: { params?: Record<string, string>; path?: string } = {},
): Promise<ActionCall<T>> {
  const { id, routes } = resolveAction(module, name);
  const target =
    opts.path ??
    routes.map((w) => routeFor(w, opts.params ?? {})).find((r): r is string => !!r) ??
    (() => {
      throw new Error(`No hay ruta estática para ${name}; pasa params/path`);
    })();
  const origin = baseUrl();
  const res = await api.post(`${origin}${target}`, {
    headers: {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      Origin: origin,
    },
    data: JSON.stringify([args]),
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const status = res.status();
  const raw = await res.text();
  const redirectedTo = status >= 300 && status < 400 ? (res.headers()["location"] ?? "") : null;
  return { status, raw, redirectedTo, result: redirectedTo ? null : parseActionResult<T>(raw) };
}

/** Exige éxito y devuelve `data` (falla con el detalle del servidor). */
export async function mustCall<T = Record<string, unknown>>(
  api: APIRequestContext,
  module: ActionModule,
  name: string,
  args: unknown,
  opts: { params?: Record<string, string>; path?: string } = {},
): Promise<T> {
  const call = await callAction<T>(api, module, name, args, opts);
  if (!call.result || !call.result.ok) {
    throw new Error(`${module}/${name} falló: ${call.status} ${call.raw.slice(0, 400)}`);
  }
  return call.result.data;
}

// -----------------------------------------------------------------------------
// Datos del catálogo / ajustes (seed DEMO: sólo lectura)
// -----------------------------------------------------------------------------

export type PricingSettings = {
  taxRateBps: number;
  pricesIncludeTax: boolean;
  depositBps: number;
  quoteValidityDays: number;
  minMarginBps: number;
  paymentFeeBps: number;
  paymentFeeFixedCents: number;
  maxStandardGuests: number;
};

const PRICING_DEFAULTS: PricingSettings = {
  taxRateBps: 1600,
  pricesIncludeTax: true,
  depositBps: 5000,
  quoteValidityDays: 7,
  minMarginBps: 3500,
  paymentFeeBps: 360,
  paymentFeeFixedCents: 300,
  maxStandardGuests: 12,
};

export async function pricingSettings(db: PrismaClient): Promise<PricingSettings> {
  const row = await db.setting.findUnique({ where: { key: "pricing" } });
  return { ...PRICING_DEFAULTS, ...((row?.value as Partial<PricingSettings> | null) ?? {}) };
}

export async function experienceBySlug(db: PrismaClient, slug: string) {
  const exp = await db.experience.findUnique({
    where: { slug },
    include: { menus: { select: { id: true } }, addOns: { select: { id: true } }, serviceAreas: { select: { id: true } } },
  });
  if (!exp) throw new Error(`Experiencia ${slug} no existe en el seed`);
  return exp;
}

export async function addOnBySlug(db: PrismaClient, slug: string) {
  const a = await db.addOn.findUnique({ where: { slug } });
  if (!a) throw new Error(`Add-on ${slug} no existe en el seed`);
  return a;
}

export async function menuBySlug(db: PrismaClient, slug: string) {
  const m = await db.menu.findUnique({ where: { slug } });
  if (!m) throw new Error(`Menú ${slug} no existe en el seed`);
  return m;
}

export async function areaBySlug(db: PrismaClient, slug: string) {
  const z = await db.serviceArea.findUnique({ where: { slug } });
  if (!z) throw new Error(`Zona ${slug} no existe en el seed`);
  return z;
}

export async function userByEmail(db: PrismaClient, email: string) {
  const u = await db.user.findUnique({ where: { email } });
  if (!u) throw new Error(`Usuario ${email} no existe`);
  return u;
}

// -----------------------------------------------------------------------------
// Cálculo independiente (oráculo) de totales: reglas documentadas en docs/DOMAIN.md
// -----------------------------------------------------------------------------

const roundHalf = (v: number) => (v < 0 ? -Math.round(-v) : Math.round(v));

export function expectedTotals(
  subtotalCents: number,
  settings: Pick<PricingSettings, "taxRateBps" | "pricesIncludeTax">,
  discountCents = 0,
  depositBps = 5000,
) {
  const discounted = subtotalCents - Math.min(discountCents, subtotalCents);
  let tax: number;
  let total: number;
  if (settings.pricesIncludeTax) {
    total = discounted;
    tax = roundHalf(total - (total * 10_000) / (10_000 + settings.taxRateBps));
  } else {
    tax = roundHalf((discounted * settings.taxRateBps) / 10_000);
    total = discounted + tax;
  }
  const deposit = roundHalf((total * depositBps) / 10_000);
  return { subtotalCents, discountCents: Math.min(discountCents, subtotalCents), taxCents: tax, totalCents: total, depositCents: deposit };
}

/**
 * Oráculo independiente del QuoteEngine para una selección de catálogo (reglas 1–5 y 8 de DOMAIN.md):
 * base incluye baseGuests; extra × precio; menú INCLUDED=0 / PER_GUEST × facturables / FLAT;
 * add-ons limitados a maxQuantity (FLAT × u, PER_GUEST × facturables × u); logística de la zona.
 */
export async function oracleSelection(
  db: PrismaClient,
  sel: { experienceSlug: string; guests: number; menuSlug?: string | null; addOns?: Array<{ slug: string; quantity: number }>; areaSlug?: string | null; depositBps?: number; discountCents?: number },
) {
  const exp = await experienceBySlug(db, sel.experienceSlug);
  const billable = Math.max(sel.guests, exp.baseGuests);
  const extra = Math.max(0, sel.guests - exp.baseGuests);
  const lines: Array<{ type: string; quantity: number; unit: number; total: number }> = [
    { type: "BASE_EXPERIENCE", quantity: 1, unit: exp.basePriceCents, total: exp.basePriceCents },
  ];
  if (extra > 0) lines.push({ type: "EXTRA_GUEST", quantity: extra, unit: exp.extraGuestPriceCents, total: extra * exp.extraGuestPriceCents });
  if (sel.menuSlug) {
    const m = await menuBySlug(db, sel.menuSlug);
    const qty = m.pricingType === "PER_GUEST" ? billable : 1;
    const unit = m.pricingType === "INCLUDED" ? 0 : m.priceCents;
    lines.push({ type: "MENU", quantity: qty, unit, total: unit * qty });
  }
  for (const a of sel.addOns ?? []) {
    const row = await addOnBySlug(db, a.slug);
    const units = row.maxQuantity && a.quantity > row.maxQuantity ? row.maxQuantity : a.quantity;
    const qty = row.pricingType === "PER_GUEST" ? billable * units : units;
    lines.push({ type: "ADDON", quantity: qty, unit: row.priceCents, total: row.priceCents * qty });
  }
  if (sel.areaSlug) {
    const z = await areaBySlug(db, sel.areaSlug);
    if (z.logisticsFeeCents > 0 || z.logisticsCostCents > 0) lines.push({ type: "LOGISTICS", quantity: 1, unit: z.logisticsFeeCents, total: z.logisticsFeeCents });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const settings = await pricingSettings(db);
  return { lines, billable, extra, exp, ...expectedTotals(subtotal, settings, sel.discountCents ?? 0, sel.depositBps ?? 5000) };
}

/** Valor (dd) de una fila del resumen de totales (dl > div > dt + dd). */
export function totalsValue(scope: import("@playwright/test").Locator, label: string | RegExp) {
  const re = typeof label === "string" ? new RegExp(`^${escapeRe(label)}$`) : label;
  return scope.getByRole("term").filter({ hasText: re }).locator("..").getByRole("definition");
}

// -----------------------------------------------------------------------------
// Fechas
// -----------------------------------------------------------------------------

/** YYYY-MM-DD en zona CDMX, `days` días a partir de hoy. */
export function dateKeyFromToday(days: number): string {
  const now = new Date(Date.now() + days * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA => YYYY-MM-DD
}

// -----------------------------------------------------------------------------
// Cotizaciones (vía acción real: precios del QuoteEngine en servidor)
// -----------------------------------------------------------------------------

export type NewQuoteOpts = {
  customerId: string;
  leadId?: string | null;
  experienceSlug?: string;
  guestCount?: number;
  menuSlug?: string | null;
  areaSlug?: string | null;
  addOns?: Array<{ slug: string; quantity: number }>;
  eventDate?: string;
  title?: string;
  depositBps?: number;
  occasion?: string;
  notesForCustomer?: string;
  internalNotes?: string;
};

export async function createQuoteViaAction(api: APIRequestContext, db: PrismaClient, o: NewQuoteOpts) {
  const exp = await experienceBySlug(db, o.experienceSlug ?? "signature-brunch");
  const menu = o.menuSlug === null ? null : o.menuSlug ? await menuBySlug(db, o.menuSlug) : null;
  const area = o.areaSlug ? await areaBySlug(db, o.areaSlug) : null;
  const addOns = [];
  for (const a of o.addOns ?? []) addOns.push({ addOnId: (await addOnBySlug(db, a.slug)).id, quantity: a.quantity });
  return mustCall<{ id: string; code: string }>(api, "quotes", "createQuoteAction", {
    leadId: o.leadId ?? null,
    customerMode: "existing",
    customerId: o.customerId,
    newCustomer: null,
    title: o.title ?? "",
    occasion: o.occasion ?? "BIRTHDAY",
    eventDate: o.eventDate ?? dateKeyFromToday(40),
    startTime: "11:00",
    guestCount: o.guestCount ?? exp.baseGuests,
    serviceAreaId: area?.id ?? "",
    experienceId: exp.id,
    styleId: "",
    menuId: menu?.id ?? "",
    addOns,
    depositBps: o.depositBps ?? 5000,
    notesForCustomer: o.notesForCustomer ?? "",
    internalNotes: o.internalNotes ?? "",
  });
}

export async function sendQuoteViaAction(api: APIRequestContext, quoteId: string) {
  return mustCall<{ url: string; notified: boolean }>(api, "quotes", "sendQuoteAction", { quoteId }, { params: { id: quoteId } });
}

/** Payload del editor de precios a partir de las líneas guardadas (para guardar/previsualizar). */
export async function pricingPayload(
  db: PrismaClient,
  quoteId: string,
  overrides: {
    discount?: { type: "NONE" | "PERCENT" | "AMOUNT"; value: number; reason?: string };
    depositBps?: number;
    extraLines?: Array<Record<string, unknown>>;
    mapLine?: (line: Record<string, unknown>) => Record<string, unknown>;
  } = {},
) {
  const q = await db.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
  const lines = q.items.map((i) => {
    const line: Record<string, unknown> = {
      itemId: i.id,
      type: i.type,
      refId: i.refId,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      unitCostCents: i.unitCostCents,
      costCategory: i.costCategory,
    };
    return overrides.mapLine ? overrides.mapLine(line) : line;
  });
  return {
    quoteId,
    lines: [...lines, ...(overrides.extraLines ?? [])],
    discount: overrides.discount ?? {
      type: q.discountType ?? "NONE",
      value: q.discountValue ?? 0,
      reason: q.discountReason ?? undefined,
    },
    depositBps: overrides.depositBps ?? q.depositBps,
  };
}

/** Snapshot comparable de una cotización (para "nada cambió"). */
export async function quoteState(db: PrismaClient, id: string) {
  const q = await db.quote.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { id: "asc" } } } });
  return {
    status: q.status,
    version: q.version,
    totalCents: q.totalCents,
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    discountType: q.discountType,
    depositBps: q.depositBps,
    guestCount: q.guestCount,
    title: q.title,
    items: q.items.map((i) => [i.id, i.quantity, i.unitPriceCents, i.totalPriceCents]),
  };
}

/**
 * Navega y espera a que la página quede hidratada (sin tráfico de red pendiente). Los formularios
 * del panel son componentes cliente (react-hook-form): interactuar antes de la hidratación hace que
 * el estado del formulario no vea el cambio (p. ej. un select nativo sin onChange). No es un sleep:
 * espera un estado observable de la red.
 */
export async function gotoReady(page: import("@playwright/test").Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Espera la redirección al detalle `${base}/<id>` (excluye `${base}/new`). Devuelve el id. */
export async function waitForDetail(page: import("@playwright/test").Page, base: string): Promise<string> {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([a-z0-9]+)$`);
  await page.waitForURL((u) => {
    const m = re.exec(u.pathname);
    return !!m && m[1] !== "new";
  });
  return re.exec(new URL(page.url()).pathname)![1]!;
}

/**
 * Sigue un enlace por su href (carga completa). Se usa SÓLO cuando lo que se prueba es el destino
 * (datos de la página 2, listado sin filtros…), no la navegación del cliente: los <Link> que cambian
 * únicamente los searchParams de la misma ruta a veces no navegan con clic (ver COM-BUG-03, cubierto
 * por [LEAD-037]). Devuelve el href para poder validarlo.
 */
export async function followLink(page: import("@playwright/test").Page, link: import("@playwright/test").Locator): Promise<string> {
  const href = await link.getAttribute("href");
  if (!href) throw new Error("El enlace no tiene href");
  await gotoReady(page, href);
  return href;
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** CSV RFC 4180 mínimo (comillas dobles, saltos dentro de comillas). Quita el BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && src[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Código corto único (para leads/cotizaciones creados con Prisma). */
export function e2eCode(prefix: string): string {
  return `${prefix}-E2E-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}
