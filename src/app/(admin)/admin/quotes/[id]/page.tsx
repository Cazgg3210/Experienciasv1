import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  History,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { getCurrentUser, requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { appUrl } from "@/lib/env";
import { formatDateTime, formatLongDate, formatShortDate, localDateKey, toDateKey } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  LEAD_STATUS_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS,
  OCCASION_LABELS,
  QUOTE_ITEM_TYPE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getSettings } from "@/features/settings/server/settings-service";
import { isDepositSatisfied, netPaidCents } from "@/features/payments/domain/payment-status";
import { getQuoteForAdmin, getQuoteFormOptions, getQuoteHistory } from "@/features/quotes/server/quote-queries";
import { costBreakdownFor, quoteShareMessage, validityLabel } from "@/features/quotes/domain/quote-lines";
import { MarginAlert, QuoteStatusBadge, TotalsSummary, discountLabelFor, type TotalsView } from "@/features/quotes/components/quote-ui";
import { QuoteActions } from "@/features/quotes/components/quote-actions";
import { PricingEditor } from "@/features/quotes/components/pricing-editor";
import { QuoteDetailsForm } from "@/features/quotes/components/quote-details-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const viewer = await getCurrentUser().catch(() => null);
  if (!viewer || !can(viewer.role, "quotes:read")) return { title: "Cotización" };
  const q = await getQuoteForAdmin(id).catch(() => null);
  return { title: q ? `${q.code} · ${q.title}` : "Cotización" };
}

const AUDIT_LABELS: Record<string, string> = {
  "quote.created": "Cotización creada",
  "quote.updated": "Datos actualizados",
  "quote.price_changed": "Precio unitario modificado",
  "quote.discount_applied": "Descuento modificado",
  "quote.deposit_changed": "Anticipo modificado",
  "quote.sent": "Enviada a la clienta",
  "quote.expired": "Marcada como expirada",
  "quote.new_version": "Nueva versión",
  "quote.duplicated": "Creada como copia",
  "quote.accepted": "Aceptada por la clienta",
  "quote.rejected": "Rechazada por la clienta",
};

function Card({ title, icon: Icon, children, className }: { title: string; icon?: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card rounded-2xl border p-4 sm:p-5", className)} aria-label={title}>
      <h2 className="font-heading mb-3 flex items-center gap-2 text-lg font-semibold">
        {Icon ? <Icon className="text-olive size-4" aria-hidden /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function QuoteDetailPage({ params }: { params: Params }) {
  const user = await requirePagePermission("quotes:read");
  const { id } = await params;
  const quote = await getQuoteForAdmin(id);
  if (!quote) notFound();

  const isDraft = quote.status === "DRAFT";
  const [pricing, history, options] = await Promise.all([
    getSettings("pricing"),
    getQuoteHistory(quote.id),
    isDraft ? getQuoteFormOptions() : Promise.resolve(null),
  ]);
  const canWrite = can(user.role, "quotes:write");
  const canSend = can(user.role, "quotes:send");
  const now = new Date();

  const publicUrl = appUrl(`/cotizacion/${quote.publicToken}`);
  const validUntilText = quote.validUntil ? formatLongDate(quote.validUntil) : null;
  const shareText = quoteShareMessage({
    customerName: quote.customer.name,
    title: quote.title,
    url: publicUrl,
    validUntil: validUntilText,
  });
  const phone = quote.customer.whatsapp ?? quote.customer.phone;
  const whatsappHref = whatsappLink(phone, shareText);

  const totals: TotalsView = {
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    depositBps: quote.depositBps,
    depositCents: quote.depositCents,
    estimatedCostCents: quote.estimatedCostCents,
    estimatedMarginCents: quote.estimatedMarginCents,
    marginBps: quote.marginBps,
    costBreakdown: costBreakdownFor(quote.pricingSnapshot, quote, quote.items),
  };

  const paidCents = quote.booking ? netPaidCents(quote.booking.payments) : 0;
  const depositOk = quote.booking ? isDepositSatisfied(quote.booking.depositRequiredCents, quote.booking.payments) : false;

  const timeline: Array<{ at: Date; label: string; icon: React.ElementType; detail?: string; tone?: string }> = [
    { at: quote.createdAt, label: "Creada", icon: Sparkles, detail: quote.createdBy?.name ?? undefined },
  ];
  if (quote.sentAt) timeline.push({ at: quote.sentAt, label: "Enviada", icon: Send });
  if (quote.viewedAt) timeline.push({ at: quote.viewedAt, label: "Vista por la clienta", icon: Eye });
  if (quote.acceptedAt)
    timeline.push({ at: quote.acceptedAt, label: "Aceptada", icon: CheckCircle2, detail: quote.booking?.acceptedByName, tone: "text-success" });
  if (quote.rejectedAt)
    timeline.push({ at: quote.rejectedAt, label: "Rechazada", icon: XCircle, detail: quote.rejectionReason ?? undefined, tone: "text-destructive" });
  if (quote.expiredAt) timeline.push({ at: quote.expiredAt, label: "Expirada", icon: Clock, tone: "text-warning" });
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/quotes", label: "Cotizaciones" }}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono normal-case tracking-normal">{quote.code}</span>
            <span>· versión {quote.version}</span>
          </span>
        }
        title={quote.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            <span>
              {quote.customer.name}
              {quote.experience ? ` · ${quote.experience.name}` : ""}
            </span>
          </span>
        }
      />

      <QuoteActions
        quoteId={quote.id}
        status={quote.status}
        code={quote.code}
        publicUrl={publicUrl}
        whatsappHref={whatsappHref}
        customerName={quote.customer.name}
        hasContact={!!(quote.customer.email || phone)}
        hasEventDate={!!quote.eventDate}
        eventId={quote.event?.id ?? null}
        canWrite={canWrite}
        canSend={canSend}
        validityText={
          quote.validUntil && quote.validUntil > now
            ? `Vigente hasta el ${formatLongDate(quote.validUntil)}.`
            : `La vigencia se renovará ${pricing.quoteValidityDays} días.`
        }
      />

      {!isDraft ? (
        <MarginAlert marginBps={quote.marginBps} marginCents={quote.estimatedMarginCents} minMarginBps={pricing.minMarginBps} />
      ) : null}
      {quote.status === "ACCEPTED" ? (
        <p className="bg-sage-soft/60 text-olive rounded-xl border px-4 py-3 text-sm">
          Propuesta aceptada: es de sólo lectura. Los cambios operativos se hacen desde el evento
          {quote.event ? (
            <>
              {" "}
              <Link href={`/admin/events/${quote.event.id}`} className="font-medium underline underline-offset-2">
                {quote.event.code}
              </Link>
            </>
          ) : null}
          .
        </p>
      ) : !isDraft ? (
        <p className="text-muted-foreground text-sm">
          Esta propuesta ya se envió. Para cambiar conceptos o precios crea una nueva versión.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {isDraft && canWrite && options ? (
            <>
              <PricingEditor
                key={`${quote.id}-${quote.updatedAt.getTime()}`}
                quoteId={quote.id}
                items={quote.items.map((i) => ({
                  id: i.id,
                  type: i.type,
                  refId: i.refId,
                  description: i.description,
                  quantity: i.quantity,
                  unitPriceCents: i.unitPriceCents,
                  unitCostCents: i.unitCostCents,
                  costCategory: i.costCategory,
                  totalPriceCents: i.totalPriceCents,
                  totalCostCents: i.totalCostCents,
                }))}
                discount={{ type: quote.discountType, value: quote.discountValue, reason: quote.discountReason }}
                depositBps={quote.depositBps}
                savedTotals={totals}
                minMarginBps={pricing.minMarginBps}
                canEditPrices={can(user.role, "pricing:write")}
                canDiscount={can(user.role, "quotes:discount")}
                addOns={options.addOns.map((a) => ({
                  id: a.id,
                  name: a.name,
                  priceCents: a.priceCents,
                  pricingType: a.pricingType,
                  maxQuantity: a.maxQuantity,
                  active: a.active,
                }))}
              />
              <QuoteDetailsForm
                key={`details-${quote.updatedAt.getTime()}`}
                styles={options.styles}
                defaults={{
                  quoteId: quote.id,
                  title: quote.title,
                  eventDate: quote.eventDate ? toDateKey(quote.eventDate) : "",
                  startTime: quote.startTime ?? "",
                  guestCount: quote.guestCount,
                  styleId: quote.styleId ?? "",
                  validUntil:
                    quote.validUntil && localDateKey(quote.validUntil) >= localDateKey(now) ? localDateKey(quote.validUntil) : "",
                  notesForCustomer: quote.notesForCustomer ?? "",
                  internalNotes: quote.internalNotes ?? "",
                }}
              />
            </>
          ) : (
            <section className="bg-card rounded-2xl border" aria-labelledby="lines-title">
              <h2 id="lines-title" className="font-heading border-b px-4 py-3 text-xl font-semibold sm:px-5">
                Conceptos
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Conceptos de la cotización con costos</caption>
                  <thead className="text-muted-foreground bg-muted/40 text-left text-xs">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Concepto</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Cant.</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">P. unitario</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{i.description}</p>
                          <p className="text-muted-foreground text-xs">{QUOTE_ITEM_TYPE_LABELS[i.type]}</p>
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">{i.quantity}</td>
                        <td className="tabular px-3 py-2.5 text-right">{formatMXN(i.unitPriceCents)}</td>
                        <td className="tabular px-3 py-2.5 text-right font-medium">{formatMXN(i.totalPriceCents)}</td>
                        <td className="tabular text-muted-foreground px-3 py-2.5 text-right">{formatMXN(i.totalCostCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t px-4 py-4 sm:px-5">
                <TotalsSummary
                  totals={totals}
                  minMarginBps={pricing.minMarginBps}
                  discountLabel={discountLabelFor(quote.discountType, quote.discountValue)}
                />
                {quote.discountReason ? (
                  <p className="text-muted-foreground mt-2 text-xs">Motivo del descuento: {quote.discountReason}</p>
                ) : null}
              </div>
            </section>
          )}

          {!isDraft && (quote.notesForCustomer || quote.internalNotes) ? (
            <Card title="Notas">
              {quote.notesForCustomer ? (
                <div className="mb-3">
                  <p className="eyebrow mb-1">Para la clienta</p>
                  <p className="text-sm whitespace-pre-line">{quote.notesForCustomer}</p>
                </div>
              ) : null}
              {quote.internalNotes ? (
                <div>
                  <p className="eyebrow mb-1">Internas</p>
                  <p className="text-sm whitespace-pre-line">{quote.internalNotes}</p>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Información de la cotización">
          <Card title="Clienta" icon={UserRound}>
            <p className="font-medium">{quote.customer.name}</p>
            <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
              {quote.customer.email ? (
                <li className="flex items-center gap-2">
                  <Mail className="size-3.5" aria-hidden />
                  <a href={`mailto:${quote.customer.email}`} className="hover:text-foreground truncate underline-offset-2 hover:underline">
                    {quote.customer.email}
                  </a>
                </li>
              ) : null}
              {phone ? (
                <li className="flex items-center gap-2">
                  <Phone className="size-3.5" aria-hidden />
                  <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline-offset-2 hover:underline">
                    {phone}
                  </a>
                </li>
              ) : null}
              {!quote.customer.email && !phone ? <li>Sin datos de contacto</li> : null}
            </ul>
            {quote.lead ? (
              <p className="mt-3 text-sm">
                Lead{" "}
                <Link href={`/admin/leads/${quote.lead.id}`} className="text-olive font-mono font-medium hover:underline">
                  {quote.lead.code}
                </Link>{" "}
                <span className="text-muted-foreground">· {LEAD_STATUS_LABELS[quote.lead.status]}</span>
              </p>
            ) : null}
          </Card>

          <Card title="Evento" icon={CalendarDays}>
            <dl>
              <Detail label="Ocasión">{OCCASION_LABELS[quote.occasion]}</Detail>
              <Detail label="Fecha">{quote.eventDate ? formatLongDate(quote.eventDate) : <span className="text-warning">Sin fecha</span>}</Detail>
              <Detail label="Hora">{quote.startTime ?? "Por definir"}</Detail>
              <Detail label="Invitadas">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden /> {quote.guestCount}
                </span>
              </Detail>
              <Detail label="Zona">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {quote.serviceArea?.name ?? "Sin zona"}
                </span>
              </Detail>
              <Detail label="Experiencia">{quote.experience?.name ?? "—"}</Detail>
              <Detail label="Estilo">{quote.style?.name ?? "—"}</Detail>
              <Detail label="Menú">{quote.menu?.name ?? "—"}</Detail>
            </dl>
          </Card>

          {quote.booking || quote.event ? (
            <Card title="Reserva" icon={CheckCircle2}>
              <dl>
                {quote.booking ? <Detail label="Reserva">{quote.booking.code}</Detail> : null}
                {quote.event ? (
                  <Detail label="Evento">
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      <Link href={`/admin/events/${quote.event.id}`} className="text-olive font-mono hover:underline">
                        {quote.event.code}
                      </Link>
                      <StatusBadge tone={EVENT_STATUS_TONES[quote.event.status]}>{EVENT_STATUS_LABELS[quote.event.status]}</StatusBadge>
                    </span>
                  </Detail>
                ) : null}
                {quote.booking ? (
                  <>
                    <Detail label="Anticipo requerido">{formatMXN(quote.booking.depositRequiredCents)}</Detail>
                    <Detail label="Pagado">
                      <span className={cn("tabular font-medium", depositOk ? "text-success" : "text-warning")}>{formatMXN(paidCents)}</span>
                    </Detail>
                    {quote.booking.balanceDueAt ? <Detail label="Saldo vence">{formatShortDate(quote.booking.balanceDueAt)}</Detail> : null}
                    <Detail label="Aceptó">{quote.booking.acceptedByName}</Detail>
                  </>
                ) : null}
              </dl>
            </Card>
          ) : null}

          <Card title="Seguimiento" icon={Clock}>
            <ol className="space-y-3">
              {timeline.map((t) => (
                <li key={t.label + t.at.toISOString()} className="flex gap-3 text-sm">
                  <t.icon className={cn("text-olive mt-0.5 size-4 shrink-0", t.tone)} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">{t.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(t.at)}
                      {t.detail ? ` · ${t.detail}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t pt-3 text-sm">
              <span className="text-muted-foreground">Vigencia: </span>
              {quote.validUntil ? (
                <>
                  {formatDateTime(quote.validUntil)}
                  {quote.status === "SENT" ? <span className="text-muted-foreground"> · {validityLabel(quote.validUntil, now)}</span> : null}
                </>
              ) : (
                "Sin vigencia"
              )}
            </p>
          </Card>

          {quote.notifications.length ? (
            <Card title="Notificaciones" icon={Send}>
              <ul className="space-y-2 text-sm">
                {quote.notifications.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{NOTIFICATION_TYPE_LABELS[n.type]}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {NOTIFICATION_CHANNEL_LABELS[n.channel]} · {n.to} · {formatDateTime(n.createdAt)}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">{NOTIFICATION_STATUS_LABELS[n.status]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {history.length ? (
            <Card title="Historial" icon={History}>
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <p className="font-medium">{AUDIT_LABELS[h.action] ?? h.action}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(h.createdAt)}
                      {h.actorEmail ? ` · ${h.actorEmail}` : " · clienta"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
