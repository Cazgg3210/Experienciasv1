import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { formatLongDate, formatShortDate } from "@/lib/dates";
import { formatBps, formatMXN } from "@/lib/money";
import { OCCASION_LABELS } from "@/lib/labels";
import { getSettings } from "@/features/settings/server/settings-service";
import { getQuoteForAdmin } from "@/features/quotes/server/quote-queries";
import { discountLabelFor } from "@/features/quotes/components/quote-ui";
import { isTaxIncluded } from "@/features/quotes/domain/quote-lines";
import { PrintButton } from "@/features/quotes/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista para imprimir" };

/** Oculta la navegación del panel al imprimir (sólo en esta página). */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  aside, header.sticky, .no-print { display: none !important; }
  body, main { background: #fff !important; }
  .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; }
}
`;

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("quotes:read");
  const { id } = await params;
  const quote = await getQuoteForAdmin(id);
  if (!quote) notFound();
  const business = await getSettings("business");
  const balance = quote.totalCents - quote.depositCents;
  const taxIncluded = isTaxIncluded(quote);

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="lg">
          <Link href={`/admin/quotes/${quote.id}`}>
            <ChevronLeft aria-hidden /> Volver a la cotización
          </Link>
        </Button>
        <PrintButton />
      </div>
      {quote.status === "DRAFT" ? (
        <p className="no-print border-warning/30 bg-warning/10 text-warning rounded-xl border px-4 py-2 text-sm">
          Es un borrador: los montos pueden cambiar antes de enviarla.
        </p>
      ) : null}

      <article className="print-sheet bg-card mx-auto max-w-3xl rounded-2xl border p-6 text-[15px] leading-relaxed shadow-xs sm:p-10">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo href={null} name={business.brandName} subtitle="Experiencias íntimas · CDMX" />
            <p className="text-muted-foreground mt-3 text-sm">{business.tagline}</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="eyebrow">Propuesta</p>
            <p className="font-mono text-base font-semibold">{quote.code}</p>
            <p className="text-muted-foreground">Versión {quote.version}</p>
            <p className="text-muted-foreground">Emitida {formatShortDate(quote.sentAt ?? quote.createdAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b py-6 sm:grid-cols-2" aria-label="Datos de la propuesta">
          <div>
            <p className="eyebrow mb-1">Para</p>
            <p className="font-heading text-2xl font-semibold">{quote.customer.name}</p>
            {quote.customer.email ? <p className="text-muted-foreground text-sm">{quote.customer.email}</p> : null}
            {quote.customer.phone ? <p className="text-muted-foreground text-sm">{quote.customer.phone}</p> : null}
          </div>
          <div>
            <p className="eyebrow mb-1">Celebración</p>
            <p className="font-heading text-2xl font-semibold">{quote.title}</p>
            <dl className="text-muted-foreground mt-1 space-y-0.5 text-sm">
              <div>
                <dt className="inline">Ocasión: </dt>
                <dd className="inline">{OCCASION_LABELS[quote.occasion]}</dd>
              </div>
              <div>
                <dt className="inline">Fecha: </dt>
                <dd className="inline">{quote.eventDate ? formatLongDate(quote.eventDate) : "Por definir"}</dd>
              </div>
              <div>
                <dt className="inline">Hora: </dt>
                <dd className="inline">{quote.startTime ?? "Por definir"}</dd>
              </div>
              <div>
                <dt className="inline">Invitadas: </dt>
                <dd className="inline">{quote.guestCount}</dd>
              </div>
              {quote.serviceArea ? (
                <div>
                  <dt className="inline">Zona: </dt>
                  <dd className="inline">{quote.serviceArea.name}</dd>
                </div>
              ) : null}
              {quote.experience ? (
                <div>
                  <dt className="inline">Experiencia: </dt>
                  <dd className="inline">{quote.experience.name}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        <section className="py-6" aria-label="Conceptos">
          <table className="w-full text-sm">
            <caption className="sr-only">Conceptos incluidos</caption>
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th scope="col" className="py-2 font-medium">Concepto</th>
                <th scope="col" className="py-2 text-right font-medium">Cant.</th>
                <th scope="col" className="py-2 text-right font-medium">Precio</th>
                <th scope="col" className="py-2 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{i.description}</td>
                  <td className="tabular py-2 text-right">{i.quantity}</td>
                  <td className="tabular py-2 text-right">{formatMXN(i.unitPriceCents)}</td>
                  <td className="tabular py-2 text-right">{formatMXN(i.totalPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular">{formatMXN(quote.subtotalCents)}</dd>
            </div>
            {quote.discountCents > 0 ? (
              <div className="flex justify-between">
                <dt>{discountLabelFor(quote.discountType, quote.discountValue)}</dt>
                <dd className="tabular">−{formatMXN(quote.discountCents)}</dd>
              </div>
            ) : null}
            {!taxIncluded ? (
              <div className="flex justify-between">
                <dt>IVA</dt>
                <dd className="tabular">+{formatMXN(quote.taxCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatMXN(quote.totalCents)}</dd>
            </div>
            {taxIncluded ? (
              <div className="text-muted-foreground flex justify-between text-xs">
                <dt>IVA incluido</dt>
                <dd className="tabular">{formatMXN(quote.taxCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between pt-2">
              <dt>Anticipo para apartar ({formatBps(quote.depositBps, 0)})</dt>
              <dd className="tabular font-medium">{formatMXN(quote.depositCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Saldo</dt>
              <dd className="tabular">{formatMXN(balance)}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4 border-t pt-6 text-sm" aria-label="Condiciones">
          {quote.validUntil ? (
            <p>
              <strong>Vigencia:</strong> esta propuesta es válida hasta el {formatLongDate(quote.validUntil)}.
            </p>
          ) : null}
          {quote.notesForCustomer ? (
            <div>
              <p className="font-semibold">Notas</p>
              <p className="whitespace-pre-line">{quote.notesForCustomer}</p>
            </div>
          ) : null}
          <div>
            <p className="font-semibold">Política de cancelación</p>
            <p className="text-muted-foreground">{business.cancellationPolicy}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            Términos y condiciones (versión {business.termsVersion}) disponibles en nuestro sitio, sección /terminos. Precios en pesos
            mexicanos.
          </p>
        </section>

        <footer className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          {business.brandName} · {business.contactEmail} · WhatsApp +{business.whatsappNumber} · @{business.instagramHandle}
        </footer>
      </article>
    </div>
  );
}
