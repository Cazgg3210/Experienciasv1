/**
 * Hidratación íntegra de los layouts que pintan `children` dentro de un elemento HTML y tienen un
 * `error.tsx` en su misma carpeta (pago, sitio público, panel).
 *
 * Bug (PAY-001 en Firefox, React #418): Next pasa el componente de `error.tsx` por valor al router del
 * segmento. Si su chunk llega después de que React empezó a hidratar, React suspende en el elemento HTML
 * que envuelve `children`, al reintentarlo vuelve a reclamar el mismo nodo del DOM y falla la hidratación:
 * descarta el HTML del servidor y re-pinta todo en el cliente. Corrección: <SegmentChildren>
 * (src/components/layout/segment-children.tsx) en esos layouts.
 *
 * Reproducción determinista: se retrasa SÓLO el chunk de `error.tsx` del segmento (red lenta simulada) y se
 * comprueba que (1) no hay error de página (el guard falla ante #418), y (2) el <main id="contenido"> que
 * React hidrató es el MISMO nodo que llegó del servidor (tras un #418 React lo reemplaza por uno nuevo).
 *
 * IDs: NAV-037…039. Antes eran NAV-034…036, pero NAV-034 ya era el 404 real de not-found.spec.ts (BUG-013).
 * NAV-035 y NAV-036 quedan retirados: no los reutilices, porque los informes anteriores los citan.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { okData } from "../configurator/_helpers";
import { startDepositCheckout } from "../payments/_helpers";
import { acceptQuoteCall, createQuoteViaAdmin } from "../quote-public/_helpers";

/** Red lenta simulada para el chunk de error.tsx: llega cuando React ya está hidratando el resto. */
const SLOW_CHUNK_MS = 2_000;

async function delayChunk(page: Page, chunk: RegExp): Promise<{ served: () => boolean }> {
  let served = false;
  await page.route(chunk, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW_CHUNK_MS));
    await route.continue();
    served = true;
  });
  // Guarda el <main> que entregó el servidor, antes de que React hidrate.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __ssrMain: Element | null }).__ssrMain = document.getElementById("contenido");
    });
  });
  return { served: () => served };
}

async function expectServerHtmlHydrated(page: Page, chunk: { served: () => boolean }) {
  await page.waitForLoadState("load"); // el load espera también al chunk retrasado (script async)
  expect(chunk.served(), "el chunk de error.tsx se sirvió con retraso").toBe(true);
  // React marca con __reactFiber$… cada nodo que hidrata o crea.
  await expect
    .poll(() => page.evaluate(() => Object.keys(document.getElementById("contenido") ?? {}).some((k) => k.startsWith("__reactFiber$"))), {
      message: "React hidrató <main id=contenido>",
    })
    .toBe(true);
  const sameNode = await page.evaluate(
    () => document.getElementById("contenido") === (window as unknown as { __ssrMain: Element | null }).__ssrMain,
  );
  expect(sameNode, "React conservó el HTML del servidor (sin re-pintar todo en el cliente)").toBe(true);
}

test.describe("Hidratación con chunk de error.tsx tardío", { tag: ["@regression"] }, () => {
  test("[NAV-037] /pago/mock: el checkout simulado hidrata el HTML del servidor aunque pago/error.tsx llegue tarde", { tag: ["@P0", "@module:payments"] }, async ({ page, db, apiAs, request, baseURL, evidence }) => {
    evidence("clienta", "Cotización aceptada → /pago/mock/<checkout> con el chunk de pago/error.tsx retrasado");
    test.info().annotations.push({ type: "regression", description: "PAY-001 Firefox: React #418 en /pago/mock" });
    const owner = await apiAs("owner");
    const { quote, customer } = await createQuoteViaAdmin(db, owner, baseURL!);
    okData(await acceptQuoteCall(request, baseURL!, quote.publicToken, { fullName: `${customer.name} López` }));
    const { url } = await startDepositCheckout(db, request, baseURL!, quote.publicToken);
    const chunk = await delayChunk(page, /\/_next\/static\/chunks\/app\/\(experience\)\/pago\/error-[\w]+\.js$/);
    await page.goto(`${new URL(url).pathname}?from=quote`);
    await expectServerHtmlHydrated(page, chunk);
    await expect(page.getByRole("heading", { level: 1, name: `Hola, ${customer.name.split(" ")[0]}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /\(simulado\)$/ })).toBeEnabled();
  });

  test("[NAV-038] sitio público: el configurador hidrata el HTML del servidor aunque (public)/error.tsx llegue tarde", { tag: ["@P0", "@module:configurator"] }, async ({ page, evidence }) => {
    evidence("anonimo", "/crear-experiencia con el chunk de (public)/error.tsx retrasado");
    const chunk = await delayChunk(page, /\/_next\/static\/chunks\/app\/\(public\)\/error-[\w]+\.js$/);
    await page.goto("/crear-experiencia");
    await expectServerHtmlHydrated(page, chunk);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("[NAV-039] panel: /admin/quotes hidrata el HTML del servidor aunque admin/error.tsx llegue tarde", { tag: ["@P0", "@module:quotes"] }, async ({ rolePage, evidence }) => {
    evidence("owner", "/admin/quotes con el chunk de (admin)/admin/error.tsx retrasado");
    const page = await rolePage("owner");
    const chunk = await delayChunk(page, /\/_next\/static\/chunks\/app\/\(admin\)\/admin\/error-[\w]+\.js$/);
    await page.goto("/admin/quotes");
    await expectServerHtmlHydrated(page, chunk);
    await expect(page.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeVisible();
  });
});
