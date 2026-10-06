import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMXN } from "@/lib/money";
import { PAYMENT_KIND_LABELS } from "@/lib/labels";
import { PaymentResultPoller } from "@/features/payments/components/payment-result-poller";
import { isValidPaymentResultSignature, portalPath } from "@/features/payments/server/payment-links";
import { getPaymentResult } from "@/features/payments/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resultado de tu pago",
  robots: { index: false, follow: false },
};

const CONFIRMED_STATUSES = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS", "COMPLETED"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = first(sp.p);
  const s = first(sp.s);
  if (!p || !s || !isValidPaymentResultSignature(p, s)) notFound();
  const payment = await getPaymentResult(p);
  if (!payment || payment.kind === "REFUND") notFound();

  const { event } = payment.booking;
  const portalHref = portalPath(event.portalToken);
  const retry =
    event.status !== "CANCELLED"
      ? { token: event.portalToken, kind: payment.kind as "DEPOSIT" | "BALANCE" | "FULL" }
      : null;

  return (
    <div className="bg-card rounded-3xl border px-5 py-10 shadow-xs sm:px-10 sm:py-12">
      <PaymentResultPoller
        p={p}
        s={s}
        initial={{
          status: payment.status,
          eventConfirmed: CONFIRMED_STATUSES.includes(event.status),
          failureReason: payment.status === "FAILED" ? payment.failureReason : null,
        }}
        portalHref={portalHref}
        retry={retry}
        amountLabel={formatMXN(payment.amountCents)}
        kindLabel={PAYMENT_KIND_LABELS[payment.kind]}
        eventTitle={event.title}
        eventCancelled={event.status === "CANCELLED"}
      />
    </div>
  );
}
