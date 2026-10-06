/**
 * ESTADO GLOBAL — flag PAYMENTS_ENABLED apagado (Setting "flags").
 * Corre sólo con E2E_SUITE=global (1 worker) y restaura el valor original en `finally`.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { expect, test } from "../fixtures";
import { failure, formatMXN, okData } from "../configurator/_helpers";
import { createAcceptedQuote } from "../quote-public/_helpers";
import { startCheckoutCall } from "./_helpers";

test.describe.configure({ mode: "serial" });

async function withFlags<T>(db: PrismaClient, patch: Record<string, boolean>, fn: () => Promise<T>): Promise<T> {
  const before = await db.setting.findUnique({ where: { key: "flags" } });
  const current = (before?.value ?? {}) as Record<string, unknown>;
  await db.setting.upsert({
    where: { key: "flags" },
    create: { key: "flags", value: { ...current, ...patch } as Prisma.InputJsonValue },
    update: { value: { ...current, ...patch } as Prisma.InputJsonValue },
  });
  try {
    return await fn();
  } finally {
    if (before) await db.setting.update({ where: { key: "flags" }, data: { value: before.value as Prisma.InputJsonValue } });
    else await db.setting.delete({ where: { key: "flags" } });
  }
}

test.describe("Pagos con el flag apagado", { tag: ["@module:payments"] }, () => {
  test(
    "[PAY-020] PAYMENTS_ENABLED=false: «Pagar anticipo» avisa la pausa y el backend no crea pagos; al restaurar se puede pagar",
    { tag: ["@P1", "@negative"] },
    async ({ page, db, request, baseURL, evidence }) => {
      evidence("clienta", "Propuesta aceptada con pagos en pausa (flag restaurado al final)");
      const { quote, booking } = await createAcceptedQuote(db, request, baseURL!);
      await withFlags(db, { PAYMENTS_ENABLED: false }, async () => {
        await page.goto(`/cotizacion/${quote.publicToken}`);
        await page.getByRole("button", { name: `Pagar anticipo · ${formatMXN(booking.depositRequiredCents)}` }).click();
        await expect(page.getByText(/Los pagos en línea están en pausa por el momento/)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/cotizacion/${quote.publicToken}$`));
        const res = failure(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }));
        expect(res.code).toBe("PAYMENTS_DISABLED");
        expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
      });
      const ok = okData(await startCheckoutCall(request, baseURL!, { token: quote.publicToken, tokenType: "quote", kind: "DEPOSIT" }));
      expect(ok.url).toMatch(/\/pago\/mock\/mock_cs_/);
      expect(await db.payment.count({ where: { bookingId: booking.id, status: "PENDING" } })).toBe(1);
    },
  );
});
