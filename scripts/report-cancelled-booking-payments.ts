/**
 * Ivonne & Rosa — reporte (SÓLO LECTURA) de cobros registrados después de cancelar su evento.
 *
 *   pnpm exec tsx scripts/report-cancelled-booking-payments.ts          → tabla en consola
 *   pnpm exec tsx scripts/report-cancelled-booking-payments.ts --json   → JSON (para guardar o compartir)
 *
 * Antes de la corrección de BUG-002 un checkout abierto se podía cobrar después de que el equipo cancelaba
 * el evento: el pago quedaba PAID sin la nota «Reembolso requerido», la clienta recibía «Recibimos tu pago»
 * y el panel no lo señalaba. Este reporte lista los cobros (PAID / PARTIAL_REFUND / REFUNDED) cuyo `paidAt`
 * es posterior a la cancelación de su reserva o evento, para que el equipo revise cada caso y, si procede,
 * lo reembolse desde el panel de pagos del evento. Incluye también los ya marcados (columna «Marcado»).
 * No modifica nada: usa DATABASE_URL de .env (o del entorno).
 */
import { PrismaClient } from "@prisma/client";
import { formatDateTime } from "../src/lib/dates";
import { formatMXN } from "../src/lib/money";
import { isPaidAfterCancellation, wasCollectedAfterCancellation } from "../src/features/payments/domain/amounts";

async function loadDotEnv(): Promise<void> {
  try {
    const { config } = await import("dotenv");
    config({ path: ".env", quiet: true });
  } catch {
    try {
      process.loadEnvFile?.(".env");
    } catch {
      /* sin .env: variables del entorno */
    }
  }
}

/** Momento de la cancelación: el primero entre la reserva y el evento (cancelEvent fija ambos). */
function cancellationInstant(a: Date | null, b: Date | null): Date | null {
  if (a && b) return a.getTime() <= b.getTime() ? a : b;
  return a ?? b;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  await loadDotEnv();
  const prisma = new PrismaClient();
  try {
    const candidates = await prisma.payment.findMany({
      where: {
        kind: { not: "REFUND" },
        status: { in: ["PAID", "PARTIAL_REFUND", "REFUNDED"] },
        booking: { OR: [{ cancelledAt: { not: null } }, { event: { status: "CANCELLED" } }] },
      },
      select: {
        id: true,
        kind: true,
        status: true,
        method: true,
        provider: true,
        amountCents: true,
        refundedCents: true,
        paidAt: true,
        notes: true,
        booking: {
          select: {
            code: true,
            cancelledAt: true,
            customer: { select: { name: true } },
            event: { select: { id: true, code: true, title: true, cancelledAt: true } },
          },
        },
      },
      orderBy: { paidAt: "asc" },
    });
    const rows = candidates
      .map((p) => ({ p, cancelledAt: cancellationInstant(p.booking.cancelledAt, p.booking.event.cancelledAt) }))
      .filter(({ p, cancelledAt }) => isPaidAfterCancellation(p, cancelledAt))
      .map(({ p, cancelledAt }) => ({
        paymentId: p.id,
        evento: `${p.booking.event.code} · ${p.booking.event.title}`,
        clienta: p.booking.customer.name,
        concepto: p.kind,
        estado: p.status,
        metodo: `${p.method} (${p.provider})`,
        monto: formatMXN(p.amountCents),
        reembolsado: formatMXN(p.refundedCents),
        pagado: p.paidAt ? formatDateTime(p.paidAt) : "",
        cancelado: cancelledAt ? formatDateTime(cancelledAt) : "",
        marcado: wasCollectedAfterCancellation(p) ? "sí" : "no",
        panel: `/admin/events/${p.booking.event.id}`,
      }));

    if (argv.includes("--json")) {
      console.log(JSON.stringify(rows, null, 2));
    } else if (!rows.length) {
      console.log("[pagos] No hay cobros registrados después de la cancelación de su evento.");
    } else {
      console.log(`[pagos] ${rows.length} cobro(s) registrados después de cancelar su evento (revisar y, si procede, reembolsar):`);
      console.table(rows);
    }
    return 0;
  } catch (error) {
    console.error("[pagos] No se pudo generar el reporte:", error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = /report-cancelled-booking-payments\.ts$/.test(process.argv[1] ?? "");
if (invokedDirectly) {
  void main().then((code) => process.exit(code));
}
