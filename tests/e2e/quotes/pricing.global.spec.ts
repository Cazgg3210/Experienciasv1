/**
 * Paquete 3 · Cotizaciones — reglas de IVA que dependen de ajustes GLOBALES (Setting "pricing").
 * Suite global: corre aparte (E2E_SUITE=global, 1 worker, serial) y restaura el ajuste en finally.
 */
import type { Prisma } from "@prisma/client";
import { createCustomer, expect, test, uniq } from "../fixtures";
import { formatMXN } from "../../../src/lib/money";
import { createQuoteViaAction, gotoReady, oracleSelection, totalsValue } from "./_helpers";

test.describe.configure({ mode: "serial" });

test.describe("Cotizaciones · IVA configurable (global)", { tag: ["@module:quotes"] }, () => {
  test("[QUO-038] con 'precios sin IVA' el IVA (16%) se suma al subtotal y se muestra como '+IVA'", { tag: ["@P1"] }, async ({ rolePage, apiAs, db, evidence }) => {
    evidence("owner", "Setting pricing.pricesIncludeTax=false → crear cotización → detalle");
    const original = await db.setting.findUnique({ where: { key: "pricing" } });
    try {
      await db.setting.update({ where: { key: "pricing" }, data: { value: { ...((original?.value as object) ?? {}), pricesIncludeTax: false, taxRateBps: 1600 } as Prisma.InputJsonValue } });
      const c = await createCustomer(db, { name: uniq("Clienta IVA") });
      const q = await createQuoteViaAction(await apiAs("owner"), db, { customerId: c.id, experienceSlug: "signature-brunch", guestCount: 7 });
      const oracle = await oracleSelection(db, { experienceSlug: "signature-brunch", guests: 7 });
      const expectedTax = Math.round((oracle.subtotalCents * 1600) / 10_000);
      const row = await db.quote.findUniqueOrThrow({ where: { id: q.id } });
      expect(row).toMatchObject({ subtotalCents: oracle.subtotalCents, taxCents: expectedTax, totalCents: oracle.subtotalCents + expectedTax });
      const page = await rolePage("owner");
      await gotoReady(page, `/admin/quotes/${q.id}`);
      const editor = page.getByRole("region", { name: "Conceptos y precio" });
      await expect(totalsValue(editor, "IVA")).toHaveText(`+${formatMXN(expectedTax)}`);
      await expect(totalsValue(editor, "Total")).toHaveText(formatMXN(oracle.subtotalCents + expectedTax));
    } finally {
      await db.setting.update({ where: { key: "pricing" }, data: { value: (original?.value ?? {}) as Prisma.InputJsonValue } });
    }
  });

  test("[QUO-039] con IVA incluido y tasa 8% el desglose usa la tasa configurada (bps) sin cambiar el total", { tag: ["@P2"] }, async ({ apiAs, db, evidence }) => {
    evidence("owner", "Setting pricing.taxRateBps=800 (incluido) → crear cotización");
    const original = await db.setting.findUnique({ where: { key: "pricing" } });
    try {
      await db.setting.update({ where: { key: "pricing" }, data: { value: { ...((original?.value as object) ?? {}), pricesIncludeTax: true, taxRateBps: 800 } as Prisma.InputJsonValue } });
      const c = await createCustomer(db, { name: uniq("Clienta IVA8") });
      const q = await createQuoteViaAction(await apiAs("owner"), db, { customerId: c.id, experienceSlug: "birthday-table", guestCount: 6 });
      const oracle = await oracleSelection(db, { experienceSlug: "birthday-table", guests: 6 });
      const total = oracle.subtotalCents;
      const tax = Math.round(total - (total * 10_000) / 10_800);
      expect(await db.quote.findUniqueOrThrow({ where: { id: q.id } })).toMatchObject({ totalCents: total, taxCents: tax });
    } finally {
      await db.setting.update({ where: { key: "pricing" }, data: { value: (original?.value ?? {}) as Prisma.InputJsonValue } });
    }
  });
});
