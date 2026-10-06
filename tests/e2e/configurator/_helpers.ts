/**
 * Helpers del paquete 2 (Venta pública) — configurador y llamadas directas a Server Actions.
 *
 * - callAction(): invoca una Server Action pública por HTTP (como lo haría un atacante o un cliente
 *   manipulado), usando el id real de la build (.next-e2e/server/server-reference-manifest.json).
 *   Sirve para probar la validación/negocio del BACKEND aunque la UI lo impida.
 * - Drivers del wizard /crear-experiencia (locators accesibles, textos reales de los componentes).
 * - Consultas de catálogo a la base E2E.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { replayServerAction, type ReplayOutcome } from "../fixtures";
import { longDateLabel } from "../../../src/features/configurator/domain/calendar";
import { formatMXN } from "../../../src/lib/money";

export { formatMXN, longDateLabel };

// -----------------------------------------------------------------------------
// Server Actions por HTTP
// -----------------------------------------------------------------------------

type ManifestEntry = { workers: Record<string, unknown>; exportedName?: string; filename?: string };
let manifest: Record<string, ManifestEntry> | null = null;

/** Id de la Server Action en la build que está sirviendo el carril (no cambia mientras corre la suite). */
export function actionIdOf(name: string): string {
  if (!manifest) {
    const file = path.resolve(process.cwd(), ".next-e2e", "server", "server-reference-manifest.json");
    manifest = (JSON.parse(fs.readFileSync(file, "utf8")) as { node: Record<string, ManifestEntry> }).node;
  }
  const hits = Object.entries(manifest).filter(([, v]) => v.exportedName === name);
  if (hits.length !== 1) throw new Error(`Server Action ${name}: ${hits.length} coincidencias en el manifest`);
  return hits[0]![0];
}

export type ActionResultLike<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]>; errorId?: string };

export type ActionCall<T> = { status: number; outcome: ReplayOutcome; result: ActionResultLike<T> | null; raw: string };

/** Extrae el ActionResult del payload RSC (`1:{"ok":...}`). */
export function parseActionResult<T = unknown>(text: string): ActionResultLike<T> | null {
  for (const line of text.split("\n")) {
    const m = /^[0-9a-f]+:(\{.*)$/.exec(line.trim());
    if (!m) continue;
    try {
      const v = JSON.parse(m[1]!) as Record<string, unknown>;
      if (v && typeof v === "object" && "ok" in v) return v as ActionResultLike<T>;
    } catch {
      // línea que no es JSON plano
    }
  }
  return null;
}

/**
 * Llama una Server Action con `args` (se serializa como hace React: `[args]`) contra `routePath`,
 * que debe ser una página que importa la acción (Next no ejecuta acciones de otras rutas).
 */
export async function callAction<T = unknown>(
  request: APIRequestContext,
  baseURL: string,
  name: string,
  args: unknown,
  routePath: string,
): Promise<ActionCall<T>> {
  const res = await replayServerAction(request, {
    url: new URL(routePath, baseURL).toString(),
    actionId: actionIdOf(name),
    contentType: "text/plain;charset=UTF-8",
    body: Buffer.from(JSON.stringify([args])),
  });
  return { status: res.status, outcome: res.outcome, result: parseActionResult<T>(res.text), raw: res.text };
}

/** Exige `ok:true` y devuelve `data` (con mensaje útil si falló). */
export function okData<T>(call: ActionCall<T>): T {
  expect(call.result, `respuesta de la acción: ${call.status} ${call.raw.slice(0, 400)}`).not.toBeNull();
  expect(call.result!.ok, `acción rechazada: ${JSON.stringify(call.result)}`).toBe(true);
  return (call.result as { ok: true; data: T }).data;
}

/** Exige `ok:false` y devuelve el error. */
export function failure(call: ActionCall<unknown>) {
  expect(call.result, `respuesta de la acción: ${call.status} ${call.raw.slice(0, 400)}`).not.toBeNull();
  expect(call.result!.ok, `se esperaba rechazo y la acción respondió ${JSON.stringify(call.result).slice(0, 300)}`).toBe(false);
  return call.result as { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };
}

/** Llaves internas que el público NUNCA debe recibir (costos, márgenes, comisiones). */
export const INTERNAL_KEYS = [
  "estimatedCostCents",
  "estimatedMarginCents",
  "marginBps",
  "netRevenueCents",
  "costBreakdown",
  "belowMinMargin",
  "paymentFeeCents",
  "unitCostCents",
  "totalCostCents",
  "costCents",
  "costPerGuestCents",
  "logisticsCostCents",
  "extraGuestCostCents",
  "costComponents",
  "costCategory",
];

export function findInternalKeys(value: unknown, found: string[] = [], at = "$"): string[] {
  if (Array.isArray(value)) value.forEach((v, i) => findInternalKeys(v, found, `${at}[${i}]`));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (INTERNAL_KEYS.includes(k)) found.push(`${at}.${k}`);
      findInternalKeys(v, found, `${at}.${k}`);
    }
  }
  return found;
}

// -----------------------------------------------------------------------------
// Catálogo (base E2E del carril)
// -----------------------------------------------------------------------------

export async function experienceBySlug(db: PrismaClient, slug: string) {
  const exp = await db.experience.findUnique({
    where: { slug },
    include: {
      menus: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      addOns: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      styles: { where: { active: true } },
      serviceAreas: { where: { active: true } },
    },
  });
  if (!exp) throw new Error(`DATA ISSUE: no existe la experiencia ${slug} en el seed`);
  return exp;
}

export async function activeArea(db: PrismaClient, name = "Polanco") {
  const area = await db.serviceArea.findFirst({ where: { name, active: true } });
  if (!area) throw new Error(`DATA ISSUE: zona activa ${name} no existe`);
  return area;
}

export async function firstStyle(db: PrismaClient) {
  const style = await db.style.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  if (!style) throw new Error("DATA ISSUE: no hay estilos activos");
  return style;
}

/**
 * ENVIRONMENT ISSUE conocido: unstable_cache persiste en .next-e2e/cache/fetch-cache, carpeta que comparten TODOS los
 * carriles y que sobrevive a la re-siembra (ids cuid nuevos en cada seed). Una página puede servir ids de otra base:
 *  - configurador: estimado/envío fallan con "experiencia no disponible";
 *  - detalle de experiencia: el ViewBeacon envía un experienceId inexistente → /api/analytics/track 422 (error de consola).
 * Se espera (por API, sin navegador) hasta `budgetMs` a que la página sirva los ids de ESTA base. Si no ocurre, la
 * prueba queda BLOCKED (no FAIL): el defecto es de la infraestructura compartida, no de la app.
 */
async function waitFreshOrBlock(request: APIRequestContext, path: string, id: string, budgetMs: number) {
  const fresh = await expect
    .poll(async () => (await (await request.get(path)).text()).includes(id), { timeout: budgetMs, intervals: [250, 1_000, 2_000, 5_000] })
    .toBe(true)
    .then(() => true)
    .catch(() => false);
  if (fresh) return;
  const reason = `ENVIRONMENT ISSUE: ${path} sirve datos cacheados de otra base (.next-e2e/cache compartida entre carriles) tras ${Math.round(budgetMs / 1000)} s`;
  test.info().annotations.push({ type: "blocked", description: reason });
  test.skip(true, `BLOCKED: ${reason}`);
}

export async function ensureFreshConfiguratorCatalog(request: APIRequestContext, db: PrismaClient, budgetMs = 75_000) {
  test.setTimeout(test.info().timeout + budgetMs); // tiempo extra sólo para esperar la caché compartida
  const exp = await db.experience.findFirst({ where: { active: true }, select: { id: true } });
  await waitFreshOrBlock(request, "/crear-experiencia", exp!.id, budgetMs);
}

export async function ensureFreshExperienceDetail(request: APIRequestContext, db: PrismaClient, slugs: string[], budgetMs = 75_000) {
  test.setTimeout(test.info().timeout + budgetMs);
  const started = Date.now();
  for (const slug of slugs) {
    const exp = await db.experience.findUnique({ where: { slug }, select: { id: true } });
    if (!exp) continue;
    await waitFreshOrBlock(request, `/experiencias/${slug}`, exp.id, Math.max(5_000, budgetMs - (Date.now() - started)));
  }
}

// -----------------------------------------------------------------------------
// Wizard /crear-experiencia
// -----------------------------------------------------------------------------

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const STEP_TITLES = [
  "¿Qué celebramos?",
  "¿Cuándo será?",
  "¿Dónde será?",
  "¿Cuántas personas serán?",
  "¿Qué estilo te enamora?",
  "Elige tu experiencia",
  "¿Qué menú les servimos?",
  "¿Algún detalle extra?",
  "Hazla tuya",
  "¿Qué presupuesto tienes en mente?",
] as const;

export async function expectStep(page: Page, step: number) {
  await expect(page.getByRole("heading", { level: 2, name: STEP_TITLES[step - 1] })).toBeVisible();
  await expect(page.getByText(`Paso ${step} de 10`, { exact: true })).toBeVisible();
}

export async function clickNext(page: Page) {
  await page.getByRole("button", { name: /^(Siguiente|Ver mi resumen)/ }).click();
}

/** Mensaje de validación del paso (role=alert; se filtra por texto porque Next tiene su propio route announcer con role=alert). */
export function stepAlert(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

/** Espera a que el calendario termine de consultar la disponibilidad del mes visible. */
export async function waitCalendarLoaded(page: Page) {
  await expect(page.getByRole("button", { name: /consultando disponibilidad/ })).toHaveCount(0, { timeout: 20_000 });
}

/** Elige `dateKey` (navegando meses) o el primer día "Disponible". Devuelve la fecha elegida. */
export async function pickDate(page: Page, dateKey?: string): Promise<string> {
  await waitCalendarLoaded(page);
  for (let i = 0; i < 14; i++) {
    if (dateKey) {
      const btn = page.getByRole("button", { name: new RegExp(`^${escapeRe(longDateLabel(dateKey))}:`) });
      if ((await btn.count()) > 0) {
        await btn.click();
        return dateKey;
      }
    } else {
      const avail = page.getByRole("button", { name: /: Disponible$/ });
      if ((await avail.count()) > 0) {
        const first = avail.first();
        const key = await first.getAttribute("data-date");
        await first.click();
        return key!;
      }
    }
    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await waitCalendarLoaded(page);
  }
  throw new Error(`No se encontró la fecha ${dateKey ?? "disponible"} en el calendario`);
}

export type WizardChoices = {
  occasion?: string; // etiqueta visible, p. ej. "Cumpleaños"
  occasionOther?: string;
  dateKey?: string;
  startTime?: string;
  area?: string | null; // null = "Otra zona"
  zoneText?: string;
  guests?: number;
  style?: string;
  experience: string;
  menu?: string;
  addOns?: string[];
  honoree?: string;
  colors?: string[];
  notes?: string;
  budget?: string | null; // null = "Prefiero platicarlo"
  /** Ruta inicial (default /crear-experiencia); false = la página ya está en el paso 1. */
  goto?: string | false;
};

/** Recorre los 10 pasos y llega al resumen. Devuelve la fecha elegida. */
export async function completeWizard(page: Page, c: WizardChoices): Promise<{ dateKey: string }> {
  if (c.goto !== false) await page.goto(c.goto ?? "/crear-experiencia");
  await expectStep(page, 1);
  await page.getByRole("radio", { name: c.occasion ?? "Cumpleaños", exact: true }).click();
  if (c.occasionOther) await page.getByRole("textbox", { name: "¿Qué celebramos?" }).fill(c.occasionOther);
  await clickNext(page);

  await expectStep(page, 2);
  const dateKey = await pickDate(page, c.dateKey);
  await expect(page.getByText(longDateLabel(dateKey), { exact: true })).toBeVisible();
  if (c.startTime) await page.getByLabel("Hora de inicio preferida").selectOption(c.startTime);
  await clickNext(page);

  await expectStep(page, 3);
  if (c.area === null) {
    await page.getByRole("radio", { name: "Otra zona", exact: true }).click();
    await page.getByLabel("¿En qué colonia o alcaldía será?").fill(c.zoneText ?? "Coyoacán");
  } else {
    await page.getByRole("radio", { name: c.area ?? "Polanco", exact: true }).click();
  }
  await clickNext(page);

  await expectStep(page, 4);
  if (c.guests != null) await setGuests(page, c.guests);
  await clickNext(page);

  await expectStep(page, 5);
  if (c.style) await page.getByRole("radio", { name: c.style, exact: true }).click();
  else await page.getByRole("radio").first().click();
  await clickNext(page);

  await expectStep(page, 6);
  await page.getByRole("radio", { name: c.experience, exact: true }).click();
  await clickNext(page);

  await expectStep(page, 7);
  if (c.menu) await page.getByRole("radio", { name: c.menu, exact: true }).click();
  await clickNext(page);

  await expectStep(page, 8);
  for (const a of c.addOns ?? []) {
    const btn = page.getByRole("button", { name: new RegExp(escapeRe(a)) }).first();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  }
  await clickNext(page);

  await expectStep(page, 9);
  if (c.honoree) await page.getByLabel("¿A quién celebramos?").fill(c.honoree);
  for (const color of c.colors ?? []) await page.getByRole("button", { name: color, exact: true }).click();
  if (c.notes) await page.getByLabel("Notas o peticiones especiales").fill(c.notes);
  await clickNext(page);

  await expectStep(page, 10);
  await page.getByRole("radio", { name: c.budget === null || c.budget === undefined ? "Prefiero platicarlo" : c.budget, exact: true }).click();
  await clickNext(page);

  await expect(page.getByRole("heading", { level: 2, name: "Así se ve tu experiencia" })).toBeVisible();
  return { dateKey };
}

export async function setGuests(page: Page, n: number) {
  const input = page.getByRole("spinbutton", { name: "Número de personas (incluyéndote)" });
  await input.fill(String(n));
  await input.press("Enter");
}

export type ContactData = { name: string; phone: string; email?: string; consent?: boolean; marketing?: boolean };

export async function fillContact(page: Page, d: ContactData) {
  await page.getByLabel("Tu nombre").fill(d.name);
  await page.getByLabel("WhatsApp o teléfono").fill(d.phone);
  if (d.email !== undefined) await page.getByLabel("Correo electrónico").fill(d.email);
  if (d.consent !== false) await page.getByRole("checkbox", { name: /Acepto el aviso de privacidad/ }).check();
  if (d.marketing) await page.getByRole("checkbox", { name: /Quiero recibir ideas/ }).check();
}

/** Fila "Total estimado" del resumen (etiqueta + monto). Sólo en la pantalla de resumen. */
export function estimateTotalRow(page: Page) {
  // El monto no tiene nombre accesible propio: se acota a la fila (padre directo de la etiqueta).
  return page.getByText("Total estimado", { exact: true }).locator("..");
}
