import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { PAYMENT_KIND_LABELS } from "@/lib/labels";
import { getPaymentProvider } from "@/server/providers";
import { checkoutLinkState } from "@/features/payments/domain/amounts";
import { MockCheckoutForm } from "@/features/payments/components/mock-checkout-form";
import { paymentResultRelativePath, portalPath, quotePath } from "@/features/payments/server/payment-links";
import { getMockCheckout } from "@/features/payments/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pago simulado",
  robots: { index: false, follow: false },
};

const CHECKOUT_ID = /^mock_cs_[A-Za-z0-9_-]{6,80}$/;

export default async function MockCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ checkoutId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ checkoutId }, sp] = await Promise.all([params, searchParams]);
  if (!CHECKOUT_ID.test(checkoutId)) notFound();
  if (!getPaymentProvider().isMock) notFound();
  const payment = await getMockCheckout(checkoutId);
  if (!payment || payment.kind === "REFUND") notFound();

  const from = sp.from === "quote" ? "quote" : "portal";
  const { booking } = payment;
  const amountLabel = formatMXN(payment.amountCents);
  const firstName = booking.customer.name.split(" ")[0];
  const state = checkoutLinkState(payment, booking, booking.payments);
  const backHref =
    from === "quote" && booking.quote?.publicToken ? quotePath(booking.quote.publicToken) : portalPath(booking.event.portalToken);

  const heading =
    state === "payable"
      ? `Hola, ${firstName}`
      : state === "cancelled"
        ? "Esta reserva fue cancelada"
        : state === "processed"
          ? "Este pago ya fue procesado"
          : state === "expired"
            ? "Este enlace de pago expiró"
            : "Este enlace ya no está vigente";

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="border-warning/30 bg-warning/10 text-charcoal flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm"
      >
        <FlaskConical className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">Pasarela de pago simulada — modo demo.</strong> No se realizará ningún cargo
          real. La confirmación llega por un webhook firmado, igual que con un proveedor real.
        </p>
      </div>

      <div className="bg-card rounded-3xl border p-6 shadow-xs sm:p-8">
        <p className="eyebrow">Pago seguro</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold text-balance sm:text-4xl">{heading}</h1>

        <dl className="mt-6 divide-y rounded-2xl border">
          <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Concepto</dt>
            <dd className="text-right font-medium">{PAYMENT_KIND_LABELS[payment.kind]}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Celebración</dt>
            <dd className="text-right font-medium">
              {booking.event.title}
              <span className="text-muted-foreground block text-xs font-normal">
                {formatLongDate(booking.event.eventDate)} · {booking.event.guestCount} invitadas
              </span>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Reserva</dt>
            <dd className="text-right font-mono text-xs">{booking.code}</dd>
          </div>
          <div className="bg-sand-soft/50 flex items-center justify-between gap-4 rounded-b-2xl px-4 py-4">
            <dt className="font-medium">Total a pagar</dt>
            <dd className="font-heading tabular text-3xl font-semibold">{amountLabel}</dd>
          </div>
        </dl>

        <div className="mt-8">
          {state === "payable" ? (
            <MockCheckoutForm checkoutId={checkoutId} from={from} amountLabel={amountLabel} />
          ) : state === "processed" ? (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-success size-4" aria-hidden />
                Ya registramos el resultado de este pago.
              </p>
              <Button asChild size="xl" className="w-full">
                <Link href={paymentResultRelativePath(payment.id)}>Ver el estado de mi pago</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground inline-flex items-start gap-2 text-left text-sm">
                <Clock className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                {state === "cancelled"
                  ? "Tu celebración fue cancelada, así que este enlace ya no acepta pagos y no se realizó ningún cargo. Si tienes dudas, escríbenos por WhatsApp."
                  : state === "expired"
                    ? "Por seguridad, los enlaces de pago duran una hora. Genera uno nuevo desde tu portal; no se realizó ningún cargo."
                    : "Tu saldo cambió desde que se creó este enlace (por ejemplo, ya registramos otro pago). Genera uno nuevo desde tu portal."}
              </p>
              <Button asChild size="xl" className="w-full">
                <Link href={backHref}>{from === "quote" ? "Volver a mi propuesta" : "Volver a mi evento"}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
