import { AlertTriangle, CreditCard, FileText, Lock, Receipt, Wallet } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { appUrl } from "@/lib/env";
import { formatDateTime, formatLongDate, formatShortDate, localDateKey } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  type Tone,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/providers";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { signedMediaPath } from "@/features/media/server/media-url";
import { getSettings } from "@/features/settings/server/settings-service";
import {
  UNDERPAID_REVIEW_NOTE_PREFIX,
  checkoutLinkState,
  refundableCents,
  wasCollectedAfterCancellation,
  type BookingAmounts,
  type BookingCancellation,
} from "../domain/amounts";
import { paymentLinkMessage } from "../domain/share-message";
import { getPaymentsPanelData, type PaymentRow } from "../server/queries";
import { portalPath } from "../server/payment-links";
import { ManualPaymentDialog } from "./manual-payment-dialog";
import { PaymentLinkCard } from "./payment-link-card";
import { RefundDialog } from "./refund-dialog";

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Pasarela demo",
  stripe: "Stripe",
  mercadopago: "Mercado Pago",
  manual: "Manual",
};

function statusView(
  p: PaymentRow,
  booking: BookingAmounts & BookingCancellation & { payments: PaymentRow[] },
  now: Date,
): { label: string; tone: Tone } {
  if (p.kind === "REFUND") {
    if (p.status === "PENDING") return { label: "En proceso", tone: "warning" };
    if (p.status === "FAILED") return { label: "Fallido", tone: "danger" };
    return { label: "Aplicado", tone: "muted" };
  }
  if ((p.status === "PENDING" || p.status === "FAILED") && p.notes?.startsWith(UNDERPAID_REVIEW_NOTE_PREFIX)) {
    // La pasarela reportó un cobro distinto al esperado (ver nota): requiere acción del equipo.
    return { label: "Revisar cobro", tone: "danger" };
  }
  if (p.status === "PAID" && wasCollectedAfterCancellation(p)) {
    // La pasarela cobró cuando el evento ya estaba cancelado (ver nota): el equipo debe reembolsarlo.
    return { label: "Reembolso requerido", tone: "danger" };
  }
  if (p.status === "PENDING" && p.provider !== "manual") {
    // Un checkout en línea sin completar: la sesión del proveedor dura 1 h y su monto puede quedar desactualizado.
    const state = checkoutLinkState(p, booking, booking.payments, now);
    if (state === "cancelled") return { label: "Anulado", tone: "muted" };
    if (state === "expired") return { label: "Enlace vencido", tone: "muted" };
    if (state === "stale") return { label: "Reemplazado", tone: "muted" };
    return { label: "Esperando pago", tone: "warning" };
  }
  return { label: PAYMENT_STATUS_LABELS[p.status], tone: PAYMENT_STATUS_TONES[p.status] };
}

function shortRef(value: string | null): string | null {
  if (!value) return null;
  return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

/**
 * Monto de las tarjetas de resumen. El panel vive en una columna angosta (aside de 300–380 px) o a
 * todo lo ancho: el tamaño depende del contenedor (@container), no del viewport.
 */
function Amount({ cents }: { cents: number }) {
  return <span className="block text-xl break-words @3xl:text-2xl">{formatMXN(cents)}</span>;
}

function amountText(p: PaymentRow): string {
  return p.kind === "REFUND" ? `−${formatMXN(p.amountCents)}` : formatMXN(p.amountCents);
}

/**
 * Panel de pagos para /admin/events/[id]: resumen de cobranza, lista de pagos, pago manual,
 * reembolsos y link de pago para la clienta. Server Component.
 */
export async function PaymentsPanel({ eventId }: { eventId: string }) {
  const [canRead, canManage] = await Promise.all([hasPermission("payments:read"), hasPermission("payments:manual")]);
  if (!canRead) {
    return (
      <section aria-label="Pagos" className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
        <Lock className="mr-2 inline size-4" aria-hidden />
        No tienes acceso a la información de pagos.
      </section>
    );
  }

  const data = await getPaymentsPanelData(eventId);
  if (!data) return null;
  const { event, booking, summary } = data;

  if (!booking || !summary) {
    return (
      <section aria-labelledby="pagos-title" className="space-y-4">
        <h2 id="pagos-title" className="font-heading text-2xl font-semibold">
          Pagos
        </h2>
        <EmptyState
          icon={Wallet}
          title="Aún no hay reserva"
          description="Cuando la clienta acepte su cotización verás aquí el anticipo, el saldo y cada pago recibido."
        />
      </section>
    );
  }

  const provider = getPaymentProvider();
  const business = await getSettings("business");
  const cancelled = event.status === "CANCELLED" || !!booking.cancelledAt;
  const bookingState = { ...booking, event: { status: event.status } };
  const portalUrl = appUrl(portalPath(event.portalToken));
  const phone = event.customer.whatsapp ?? event.customer.phone;
  const dueLabel = booking.balanceDueAt ? formatLongDate(booking.balanceDueAt) : null;
  const message = paymentLinkMessage({
    customerName: event.customer.name,
    eventTitle: event.title,
    depositLabel: summary.depositDueCents > 0 ? formatMXN(summary.depositDueCents) : null,
    balanceLabel: summary.balanceDueCents > 0 ? formatMXN(summary.balanceDueCents) : null,
    dueDateLabel: dueLabel,
    url: portalUrl,
    brandName: business.brandName,
  });
  const overdue =
    summary.balanceDueCents > 0 && booking.balanceDueAt ? booking.balanceDueAt.getTime() < Date.now() : false;
  const payments = booking.payments;
  const todayKey = localDateKey();
  const now = new Date();

  return (
    <section aria-labelledby="pagos-title" className="@container space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="pagos-title" className="font-heading text-2xl font-semibold">
            Pagos
          </h2>
          <p className="text-muted-foreground text-sm">
            Reserva <span className="font-mono">{booking.code}</span>
            {provider.isMock ? " · pasarela en modo demo" : ` · pasarela ${PROVIDER_LABELS[provider.name] ?? provider.name}`}
          </p>
        </div>
        {canManage && !cancelled && summary.balanceDueCents > 0 ? (
          <ManualPaymentDialog
            eventId={event.id}
            maxAmountCents={summary.balanceDueCents}
            depositDueCents={summary.depositDueCents}
            todayKey={todayKey}
          />
        ) : null}
      </div>

      {cancelled ? (
        <div role="status" className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>El evento está cancelado: no se aceptan nuevos pagos. Aún puedes registrar reembolsos.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2 @3xl:grid-cols-4">
        <StatCard label="Total del evento" value={<Amount cents={summary.totalCents} />} icon={Receipt} />
        <StatCard
          label="Anticipo requerido"
          value={<Amount cents={summary.depositRequiredCents} />}
          icon={Lock}
          tone={summary.depositSatisfied ? "success" : "warning"}
          hint={summary.depositSatisfied ? "Cubierto" : `Faltan ${formatMXN(summary.depositDueCents)}`}
        />
        <StatCard
          label="Pagado (neto)"
          value={<Amount cents={summary.netPaidCents} />}
          icon={CreditCard}
          tone={summary.netPaidCents > 0 ? "success" : "default"}
          hint={`Comisiones ${formatMXN(summary.feesCents)}${summary.refundedCents > 0 ? ` · Reembolsado ${formatMXN(summary.refundedCents)}` : ""}`}
        />
        <StatCard
          label="Saldo pendiente"
          value={<Amount cents={summary.balanceDueCents} />}
          icon={Wallet}
          tone={summary.balanceDueCents === 0 ? "success" : overdue ? "danger" : "default"}
          hint={
            summary.balanceDueCents === 0
              ? "Pagado por completo"
              : booking.balanceDueAt
                ? `${overdue ? "Venció" : "Vence"} el ${formatShortDate(booking.balanceDueAt)}`
                : "Sin fecha límite"
          }
        />
      </div>

      {!cancelled ? (
        <PaymentLinkCard portalUrl={portalUrl} message={message} whatsappHref={whatsappLink(phone, message)} hasPhone={!!phone} />
      ) : null}

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin pagos todavía"
          description="Comparte el link del portal con la clienta o registra un pago manual cuando lo recibas."
        />
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="space-y-3 @3xl:hidden" aria-label="Pagos registrados">
            {payments.map((p) => {
              const st = statusView(p, bookingState, now);
              const refundable = refundableCents(p);
              return (
                <li key={p.id} className="bg-card rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{PAYMENT_KIND_LABELS[p.kind]}</p>
                      <p className="text-muted-foreground text-xs">
                        {PAYMENT_METHOD_LABELS[p.method]} · {PROVIDER_LABELS[p.provider] ?? p.provider}
                      </p>
                    </div>
                    <p className={cn("tabular text-right font-semibold", p.kind === "REFUND" && "text-muted-foreground")}>
                      {amountText(p)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    {p.refundedCents > 0 ? (
                      <span className="text-muted-foreground text-xs">Reembolsado {formatMXN(p.refundedCents)}</span>
                    ) : null}
                  </div>
                  <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt>Creado</dt>
                    <dd className="text-right">{formatDateTime(p.createdAt)}</dd>
                    {p.paidAt ? (
                      <>
                        <dt>{p.kind === "REFUND" ? "Aplicado" : "Pagado"}</dt>
                        <dd className="text-right">{formatDateTime(p.paidAt)}</dd>
                      </>
                    ) : null}
                    {p.feeCents > 0 ? (
                      <>
                        <dt>Comisión</dt>
                        <dd className="text-right">{formatMXN(p.feeCents)}</dd>
                      </>
                    ) : null}
                    {p.recordedBy ? (
                      <>
                        <dt>Registró</dt>
                        <dd className="text-right">{p.recordedBy.name}</dd>
                      </>
                    ) : null}
                  </dl>
                  {p.failureReason ? <p className="text-destructive mt-2 text-xs">{p.failureReason}</p> : null}
                  {p.notes ? <p className="text-muted-foreground mt-2 text-xs italic">{p.notes}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {p.receiptMediaId ? (
                      <a
                        href={signedMediaPath(p.receiptMediaId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-olive inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                      >
                        <FileText className="size-3.5" aria-hidden /> Ver comprobante
                      </a>
                    ) : null}
                    {canManage && refundable > 0 ? (
                      <RefundDialog
                        paymentId={p.id}
                        maxCents={refundable}
                        paymentLabel={`${PAYMENT_KIND_LABELS[p.kind].toLowerCase()} de ${formatMXN(p.amountCents)}`}
                        online={p.provider !== "manual" && p.method === "ONLINE"}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Escritorio: tabla */}
          <div className="bg-card hidden overflow-x-auto rounded-xl border @3xl:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Pagos de la reserva {booking.code}</caption>
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Concepto
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Monto
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Comisión
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Reembolsado
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Fechas
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Referencias
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => {
                  const st = statusView(p, bookingState, now);
                  const refundable = refundableCents(p);
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{PAYMENT_KIND_LABELS[p.kind]}</p>
                        <p className="text-muted-foreground text-xs">{PAYMENT_METHOD_LABELS[p.method]}</p>
                        {p.notes ? (
                          <p className="text-muted-foreground mt-1 max-w-56 text-xs italic" title={p.notes}>
                            {p.notes.length > 80 ? `${p.notes.slice(0, 80)}…` : p.notes}
                          </p>
                        ) : null}
                        {p.failureReason ? <p className="text-destructive mt-1 max-w-56 text-xs">{p.failureReason}</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </td>
                      <td className={cn("tabular px-3 py-3 text-right font-medium", p.kind === "REFUND" && "text-muted-foreground")}>
                        {amountText(p)}
                      </td>
                      <td className="tabular text-muted-foreground px-3 py-3 text-right">
                        {p.feeCents > 0 ? formatMXN(p.feeCents) : "—"}
                      </td>
                      <td className="tabular text-muted-foreground px-3 py-3 text-right">
                        {p.refundedCents > 0 ? formatMXN(p.refundedCents) : "—"}
                      </td>
                      <td className="text-muted-foreground px-3 py-3 text-xs whitespace-nowrap">
                        <p>Creado {formatDateTime(p.createdAt)}</p>
                        {p.paidAt ? (
                          <p>
                            {p.kind === "REFUND" ? "Aplicado" : "Pagado"} {formatDateTime(p.paidAt)}
                          </p>
                        ) : null}
                        {p.recordedBy ? <p>Registró {p.recordedBy.name}</p> : null}
                      </td>
                      <td className="text-muted-foreground px-3 py-3 text-xs">
                        <p>{PROVIDER_LABELS[p.provider] ?? p.provider}</p>
                        {p.providerCheckoutId ? (
                          <p className="font-mono" title={p.providerCheckoutId}>
                            {shortRef(p.providerCheckoutId)}
                          </p>
                        ) : null}
                        {p.providerPaymentId ? (
                          <p className="font-mono" title={p.providerPaymentId}>
                            {shortRef(p.providerPaymentId)}
                          </p>
                        ) : null}
                        {p.receiptMediaId ? (
                          <a
                            href={signedMediaPath(p.receiptMediaId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-olive mt-1 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                          >
                            <FileText className="size-3.5" aria-hidden /> Comprobante
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && refundable > 0 ? (
                          <RefundDialog
                            paymentId={p.id}
                            maxCents={refundable}
                            paymentLabel={`${PAYMENT_KIND_LABELS[p.kind].toLowerCase()} de ${formatMXN(p.amountCents)}`}
                            online={p.provider !== "manual" && p.method === "ONLINE"}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
