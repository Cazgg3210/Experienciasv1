import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { getLeadPrefill, getQuoteFormOptions } from "@/features/quotes/server/quote-queries";
import { QuoteForm } from "@/features/quotes/components/quote-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nueva cotización" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("quotes:write");
  const sp = await searchParams;
  const leadId = typeof sp.leadId === "string" ? sp.leadId : undefined;
  const [options, prefill] = await Promise.all([getQuoteFormOptions(), leadId ? getLeadPrefill(leadId) : Promise.resolve(null)]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cotizaciones"
        title="Nueva cotización"
        description={
          prefill
            ? `A partir del lead ${prefill.leadCode} · ${prefill.contact.name}`
            : "Arma la propuesta: el precio, el costo y el margen se calculan en servidor mientras eliges."
        }
        back={{ href: prefill ? `/admin/leads/${prefill.leadId}` : "/admin/quotes", label: prefill ? "Volver al lead" : "Cotizaciones" }}
      />
      {leadId && !prefill ? (
        <p role="status" className="border-warning/30 bg-warning/10 text-warning rounded-xl border px-4 py-2.5 text-sm">
          No encontramos ese lead; puedes crear la cotización desde cero.
        </p>
      ) : null}
      {options.experiences.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Primero da de alta una experiencia"
          description="Las cotizaciones se calculan a partir del catálogo de experiencias, menús y add-ons."
          action={
            <Button asChild>
              <Link href="/admin/catalog">Ir al catálogo</Link>
            </Button>
          }
        />
      ) : (
        <QuoteForm options={options} prefill={prefill} />
      )}
    </div>
  );
}
