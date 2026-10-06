import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Flower2,
  MapPin,
  MessageCircle,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatLongDate, formatShortDate } from "@/lib/dates";
import { formatBps, formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { getSettings } from "@/features/settings/server/settings-service";
import { isDepositSatisfied, netPaidCents } from "@/features/payments/domain/payment-status";
import { loadPublicQuote } from "@/features/quotes/server/public-quote";
import { displayStartTime, type PublicQuoteRecord } from "@/features/quotes/server/quote-queries";
import { PLACEHOLDER_IMAGES, canOptimizeImage, safeImageSrc } from "@/features/configurator/domain/images";
import { firstName, isTaxIncluded } from "@/features/quotes/domain/quote-lines";
import { discountLabelFor } from "@/features/quotes/components/quote-ui";
import { AcceptQuoteCta } from "@/features/quotes/components/public/accept-quote";
import { RejectQuoteButton } from "@/features/quotes/components/public/reject-quote";
import { PayDepositButton } from "@/features/quotes/components/public/pay-deposit-button";
import { ValidityCountdown } from "@/features/quotes/components/public/validity-countdown";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Tu propuesta",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function BrandHeader({ brandName, code, whatsappHref }: { brandName: string; code: string; whatsappHref: string }) {
  return (
    <header className="border-border/60 bg-ivory/90 sticky top-0 z-20 border-b backdrop-blur print:static">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo href="/" name={brandName} className="[&>span:first-child]:text-xl" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden font-mono text-xs sm:inline">{code}</span>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-olive hover:bg-sage-soft inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium print:hidden"
          >
            <MessageCircle className="size-4" aria-hidden />
            <span>¿Dudas?</span>
            <span className="sr-only"> Escríbenos por WhatsApp (se abre en otra pestaña)</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/**
 * Par etiqueta–valor de un <dl>: el <div> hijo directo del <dl> contiene SÓLO <dt> y <dd>
 * (HTML válido para lectores de pantalla); el ícono decorativo vive dentro del <dt>.
 */
function DetailTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card/80 relative min-w-0 rounded-2xl border p-4 pl-16">
      <dt className="text-muted-foreground text-xs">
        <span
          aria-hidden
          className="bg-sage-soft text-olive absolute top-4 left-4 flex size-9 items-center justify-center rounded-full"
        >
          <Icon className="size-4" />
        </span>
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ProposalBody({ quote, muted }: { quote: PublicQuoteRecord; muted?: boolean }) {
  const startTime = displayStartTime(quote);
  const balance = quote.totalCents - quote.depositCents;
  const taxIncluded = isTaxIncluded(quote);
  return (
    <div className={cn("space-y-8", muted && "opacity-80")}>
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <DetailTile icon={CalendarDays} label="Fecha" value={quote.eventDate ? capitalizeFirst(formatLongDate(quote.eventDate)) : "Por definir"} />
        <DetailTile icon={Clock} label="Hora de inicio" value={startTime ? `${startTime} h` : "Por definir"} />
        <DetailTile icon={MapPin} label="Zona" value={quote.serviceArea?.name ?? "Por confirmar"} />
        <DetailTile icon={Users} label="Invitadas" value={`${quote.guestCount} personas`} />
      </dl>

      {quote.style || quote.menu ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {quote.style ? (
            <span className="bg-sand-soft inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
              <Flower2 className="text-olive size-3.5" aria-hidden /> Estilo {quote.style.name}
            </span>
          ) : null}
          {quote.menu ? (
            <span className="bg-sand-soft inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
              <UtensilsCrossed className="text-olive size-3.5" aria-hidden /> {quote.menu.name}
            </span>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="incluye-title" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="bg-card rounded-3xl border p-5 sm:p-7">
          <h2 id="incluye-title" className="font-heading text-2xl font-semibold">
            Tu propuesta
          </h2>
          <ul className="mt-4 divide-y">
            {quote.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.description}</p>
                  {i.unitPriceCents > 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {i.quantity} × {formatMXN(i.unitPriceCents)}
                    </p>
                  ) : null}
                </div>
                <p className="tabular shrink-0 font-medium">{i.totalPriceCents === 0 ? "Incluido" : formatMXN(i.totalPriceCents)}</p>
              </li>
            ))}
          </ul>
          {quote.experience?.includes?.length ? (
            <div className="bg-sage-soft/50 mt-5 rounded-2xl p-4">
              <p className="eyebrow mb-2">La experiencia incluye</p>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {quote.experience.includes.slice(0, 8).map((inc) => (
                  <li key={inc} className="flex items-start gap-2">
                    <CheckCircle2 className="text-olive mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside aria-label="Resumen de pago" className="bg-card h-fit rounded-3xl border p-5 sm:p-6 lg:sticky lg:top-20">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt>Subtotal</dt>
              <dd className="tabular">{formatMXN(quote.subtotalCents)}</dd>
            </div>
            {quote.discountCents > 0 ? (
              <div className="text-olive flex justify-between gap-3">
                <dt>{discountLabelFor(quote.discountType, quote.discountValue)}</dt>
                <dd className="tabular">−{formatMXN(quote.discountCents)}</dd>
              </div>
            ) : null}
            {!taxIncluded ? (
              <div className="flex justify-between gap-3">
                <dt>IVA</dt>
                <dd className="tabular">+{formatMXN(quote.taxCents)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 border-t pt-3">
              <dt className="font-heading text-xl font-semibold">Total</dt>
              <dd className="tabular font-heading text-3xl font-semibold">{formatMXN(quote.totalCents)}</dd>
            </div>
            {taxIncluded ? (
              <div className="text-muted-foreground flex justify-between gap-3 text-xs">
                <dt>IVA incluido</dt>
                <dd className="tabular">{formatMXN(quote.taxCents)}</dd>
              </div>
            ) : null}
          </dl>
          {/* Anticipo/saldo en su propio <dl>: un <div> dentro de <dl> sólo puede agrupar <dt>/<dd>. */}
          <dl className="bg-sand-soft/70 mt-3 space-y-2 rounded-2xl p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt>
                Anticipo para apartar tu fecha <span className="text-muted-foreground">({formatBps(quote.depositBps, 0)})</span>
              </dt>
              <dd className="tabular font-semibold">{formatMXN(quote.depositCents)}</dd>
            </div>
            <div className="text-muted-foreground flex justify-between gap-3">
              <dt>Saldo antes del evento</dt>
              <dd className="tabular">{formatMXN(balance)}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  );
}

function Policy({ policy, notes }: { policy: string; notes: string | null }) {
  return (
    <section className="grid gap-4 md:grid-cols-2" aria-label="Notas y condiciones">
      {notes ? (
        <div className="bg-card rounded-3xl border p-5 sm:p-6">
          <h2 className="font-heading text-xl font-semibold">Notas para ti</h2>
          <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">{notes}</p>
        </div>
      ) : null}
      <div className={cn("bg-card rounded-3xl border p-5 sm:p-6", !notes && "md:col-span-2")}>
        <h2 className="font-heading flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck className="text-olive size-5" aria-hidden /> Política de cancelación
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">{policy}</p>
        <p className="mt-3 text-sm">
          <Link href="/terminos" className="text-olive underline underline-offset-2">
            Lee los términos y condiciones completos
          </Link>
        </p>
      </div>
    </section>
  );
}

export default async function PublicQuotePage({ params }: Props) {
  const { token } = await params;
  const quote = await loadPublicQuote(token);
  if (!quote) notFound();
  const business = await getSettings("business");

  const name = firstName(quote.customer.name);
  const waGeneral = whatsappLink(business.whatsappNumber, `Hola, tengo una duda sobre mi propuesta ${quote.code}.`);
  // La portada la captura el admin (ruta local, /api/media o https de cualquier host): validarla y
  // servir sin optimizar lo que next/image no puede procesar (hosts no configurados, SVG, /api/).
  const cover = safeImageSrc(quote.experience?.coverImageUrl, PLACEHOLDER_IMAGES.experience);

  // ---------------------------------------------------------------------------
  // Aceptada
  // ---------------------------------------------------------------------------
  if (quote.status === "ACCEPTED") {
    const booking = quote.booking;
    const paid = booking ? netPaidCents(booking.payments) : 0;
    const depositPaid = booking ? isDepositSatisfied(booking.depositRequiredCents, booking.payments) : false;
    const cancelled = !!booking?.cancelledAt || quote.event?.status === "CANCELLED";
    const portalHref = quote.event?.portalToken ? `/mi-evento/${quote.event.portalToken}` : null;
    return (
      <>
        <BrandHeader brandName={business.brandName} code={quote.code} whatsappHref={waGeneral} />
        <main id="contenido" className="bg-ivory min-h-[calc(100dvh-3.5rem)] pb-16">
          <div className="mx-auto max-w-5xl space-y-10 px-4 pt-10 sm:px-6 sm:pt-14">
            <section className="bg-sage-soft/60 rounded-3xl border p-6 text-center sm:p-10" aria-labelledby="accepted-title">
              <span className="bg-card text-olive mx-auto mb-4 flex size-14 items-center justify-center rounded-full border">
                <PartyPopper className="size-6" aria-hidden />
              </span>
              <p className="eyebrow">{quote.title}</p>
              <h1 id="accepted-title" className="font-heading mt-2 text-4xl font-semibold text-balance sm:text-5xl">
                ¡Propuesta aceptada!
              </h1>
              <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
                {cancelled
                  ? "Esta reserva fue cancelada. Si tienes dudas, escríbenos y con gusto te ayudamos."
                  : depositPaid
                    ? `Gracias${name ? `, ${name}` : ""}. Recibimos tu anticipo: tu fecha está apartada y ya estamos preparando cada detalle.`
                    : `Gracias${name ? `, ${name}` : ""}. Para confirmar tu fecha sólo falta el anticipo de ${formatMXN(booking?.depositRequiredCents ?? quote.depositCents)}.`}
              </p>

              {!cancelled ? (
                <div className="mx-auto mt-6 max-w-md space-y-3">
                  <dl className="bg-card grid grid-cols-2 gap-3 rounded-2xl border p-4 text-left text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs">Anticipo</dt>
                      <dd className="tabular font-semibold">{formatMXN(booking?.depositRequiredCents ?? quote.depositCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Estado del pago</dt>
                      <dd className={cn("font-semibold", depositPaid ? "text-success" : "text-warning")}>
                        {depositPaid ? "Anticipo recibido" : paid > 0 ? `Pagado ${formatMXN(paid)}` : "Pendiente"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Total</dt>
                      <dd className="tabular">{formatMXN(booking?.totalCents ?? quote.totalCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Saldo vence</dt>
                      <dd>{booking?.balanceDueAt ? formatShortDate(booking.balanceDueAt) : "Antes del evento"}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    {!depositPaid ? <PayDepositButton token={token} label={`Pagar anticipo · ${formatMXN(booking?.depositRequiredCents ?? quote.depositCents)}`} /> : null}
                    {portalHref ? (
                      <Button asChild size={depositPaid ? "xl" : "lg"} variant={depositPaid ? "default" : "outline"} className="rounded-full">
                        <Link href={portalHref}>Ir a mi portal</Link>
                      </Button>
                    ) : null}
                  </div>
                  {booking?.acceptedByName ? (
                    <p className="text-muted-foreground text-xs">
                      Aceptada por {booking.acceptedByName}
                      {quote.acceptedAt ? ` el ${formatDateTime(quote.acceptedAt)}` : ""}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <Button asChild size="xl" className="mt-6">
                  <a href={waGeneral} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden /> Escríbenos por WhatsApp
                  </a>
                </Button>
              )}
            </section>
            <ProposalBody quote={quote} muted />
            <Policy policy={business.cancellationPolicy} notes={quote.notesForCustomer} />
          </div>
        </main>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Expirada / rechazada
  // ---------------------------------------------------------------------------
  if (quote.status === "EXPIRED" || quote.status === "REJECTED") {
    const expired = quote.status === "EXPIRED";
    const wa = whatsappLink(
      business.whatsappNumber,
      expired
        ? `Hola, mi propuesta ${quote.code} (${quote.title}) expiró y me gustaría actualizarla.`
        : `Hola, rechacé la propuesta ${quote.code} pero me gustaría platicar otra opción.`,
    );
    return (
      <>
        <BrandHeader brandName={business.brandName} code={quote.code} whatsappHref={waGeneral} />
        <main id="contenido" className="bg-ivory min-h-[calc(100dvh-3.5rem)] pb-16">
          <div className="mx-auto max-w-5xl space-y-10 px-4 pt-10 sm:px-6 sm:pt-14">
            <section className="bg-card rounded-3xl border p-6 text-center sm:p-10" aria-labelledby="closed-title">
              <p className="eyebrow">{quote.title}</p>
              <h1 id="closed-title" className="font-heading mt-2 text-4xl font-semibold text-balance sm:text-5xl">
                {expired ? "Esta propuesta expiró" : "Recibimos tu respuesta"}
              </h1>
              <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
                {expired
                  ? `La vigencia terminó${quote.validUntil ? ` el ${formatLongDate(quote.validUntil)}` : ""}. Escríbenos y con gusto revisamos disponibilidad y la actualizamos para ti.`
                  : `Gracias por avisarnos${name ? `, ${name}` : ""}. Si quieres otra fecha, menú o presupuesto, estamos para ayudarte a encontrar la opción ideal.`}
              </p>
              <Button asChild size="xl" className="mt-6">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> {expired ? "Pedir una propuesta actualizada" : "Platiquemos otra opción"}
                  <span className="sr-only"> (WhatsApp, se abre en otra pestaña)</span>
                </a>
              </Button>
            </section>
            {expired ? (
              <>
                <p className="text-muted-foreground text-center text-sm">Referencia de la propuesta anterior (precios sujetos a cambio):</p>
                <ProposalBody quote={quote} muted />
              </>
            ) : null}
          </div>
        </main>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Enviada (vigente): propuesta completa + aceptar / rechazar
  // ---------------------------------------------------------------------------
  return (
    <>
      <BrandHeader brandName={business.brandName} code={quote.code} whatsappHref={waGeneral} />
      <main id="contenido" className="bg-ivory min-h-[calc(100dvh-3.5rem)] pb-28 sm:pb-16">
        <div className="mx-auto max-w-5xl space-y-10 px-4 pt-8 sm:px-6 sm:pt-12">
          <section aria-labelledby="quote-title" className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <p className="eyebrow">Propuesta {quote.code}</p>
              <p className="font-heading text-olive text-2xl">Hola{name ? ` ${name}` : ""},</p>
              <h1 id="quote-title" className="font-heading text-4xl leading-tight font-semibold text-balance sm:text-5xl">
                {quote.title}
              </h1>
              <p className="text-muted-foreground max-w-prose">
                Preparamos esta propuesta con mucho cariño. Revísala con calma: tú reúne a las tuyas, nosotras hacemos el resto.
              </p>
              {quote.experience ? (
                <p className="text-sm">
                  <Sparkles className="text-olive mr-1.5 inline size-4 align-[-3px]" aria-hidden />
                  <span className="font-medium">{quote.experience.name}</span>
                  {quote.experience.tagline ? <span className="text-muted-foreground"> · {quote.experience.tagline}</span> : null}
                </p>
              ) : null}
              {quote.validUntil ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    Válida hasta el <span className="font-medium">{formatLongDate(quote.validUntil)}</span>
                  </span>
                  <ValidityCountdown validUntilIso={quote.validUntil.toISOString()} />
                </div>
              ) : null}
            </div>
            <div className="bg-sand-soft relative aspect-[4/3] overflow-hidden rounded-3xl border">
              <Image
                src={cover}
                alt={quote.experience ? `Ambientación de ${quote.experience.name}` : "Mesa de brunch decorada"}
                fill
                priority
                unoptimized={!canOptimizeImage(cover)}
                sizes="(min-width: 1024px) 540px, 100vw"
                className="object-cover"
              />
            </div>
          </section>

          <ProposalBody quote={quote} />
          <Policy policy={business.cancellationPolicy} notes={quote.notesForCustomer} />

          <section
            id="aceptar"
            aria-labelledby="cta-title"
            className="bg-sage-soft/60 rounded-3xl border p-6 text-center sm:p-10"
          >
            <h2 id="cta-title" className="font-heading text-3xl font-semibold text-balance">
              ¿Celebramos juntas?
            </h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-lg">
              Acepta la propuesta y aparta tu fecha con el anticipo de {formatMXN(quote.depositCents)}. Después podrás invitar a tus amigas
              y darnos todos los detalles desde tu portal.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <AcceptQuoteCta
                token={token}
                version={quote.version}
                customerName={quote.customer.name}
                totalLabel={formatMXN(quote.totalCents)}
                depositLabel={formatMXN(quote.depositCents)}
              />
              <RejectQuoteButton token={token} />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              ¿Quieres ajustar algo?{" "}
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="text-olive font-medium underline underline-offset-2">
                Escríbenos por WhatsApp
              </a>
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
