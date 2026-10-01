import Link from "next/link";
import { FileText, Receipt } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { balanceDueCents, netPaidCents } from "@/features/payments/domain/payment-status";
import type { EventDetail } from "../server/event-queries";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Reserva (acuerdo comercial) y cotización ligada al evento. */
export function BookingInfo({
  booking,
  quote,
}: {
  booking: EventDetail["booking"];
  quote: EventDetail["quote"];
}) {
  const paid = booking ? netPaidCents(booking.payments) : 0;
  const balance = booking ? balanceDueCents(booking.totalCents, booking.payments) : 0;
  return (
    <section
      aria-labelledby="booking-title"
      className="bg-card space-y-3 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <h2 id="booking-title" className="font-heading flex items-center gap-2 text-xl font-semibold">
        <Receipt className="text-olive size-5" aria-hidden />
        Reserva
      </h2>
      {booking ? (
        <dl className="divide-y">
          <Row label="Código">
            <span className="font-mono">{booking.code}</span>
          </Row>
          <Row label="Total">{formatMXN(booking.totalCents)}</Row>
          <Row label="Anticipo requerido">{formatMXN(booking.depositRequiredCents)}</Row>
          <Row label="Pagado">{formatMXN(paid)}</Row>
          <Row label="Saldo pendiente">
            {booking.cancelledAt ? (
              <span className="text-muted-foreground">Sin cobro (reserva cancelada)</span>
            ) : (
              <span className={balance > 0 ? "text-warning" : "text-success"}>
                {balance > 0 ? formatMXN(balance) : "Liquidado"}
              </span>
            )}
          </Row>
          <Row label="Fecha límite del saldo">
            {booking.balanceDueAt ? formatShortDate(booking.balanceDueAt) : "—"}
          </Row>
          <Row label="Términos aceptados">
            {formatDateTime(booking.termsAcceptedAt)}
            <span className="text-muted-foreground block text-xs font-normal">
              Versión {booking.termsVersion}
            </span>
          </Row>
          <Row label="Aceptó">{booking.acceptedByName}</Row>
          {booking.cancelledAt ? (
            <Row label="Reserva cancelada">
              {formatShortDate(booking.cancelledAt)}
              {booking.cancellationReason ? (
                <span className="text-muted-foreground block text-xs font-normal">
                  {booking.cancellationReason}
                </span>
              ) : null}
            </Row>
          ) : null}
        </dl>
      ) : (
        <p className="text-muted-foreground text-sm">
          Este evento aún no tiene reserva. Se genera cuando la clienta acepta su cotización.
        </p>
      )}

      <div className="border-t pt-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4" aria-hidden />
          Cotización
        </h3>
        {quote ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/admin/quotes/${quote.id}`}
              className="text-olive font-mono text-sm font-medium hover:underline"
            >
              {quote.code}
              {quote.version > 1 ? ` · v${quote.version}` : ""}
            </Link>
            <div className="flex items-center gap-2">
              <span className="tabular text-sm">{formatMXN(quote.totalCents)}</span>
              <StatusBadge tone={QUOTE_STATUS_TONES[quote.status]}>
                {QUOTE_STATUS_LABELS[quote.status]}
              </StatusBadge>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sin cotización ligada (evento registrado manualmente).
          </p>
        )}
      </div>
    </section>
  );
}
