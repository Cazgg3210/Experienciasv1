import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPlausibleToken } from "@/lib/tokens";
import { getPortalDashboard } from "@/features/portal/server/portal-service";
import { PortalSummaryView } from "@/features/portal/components/portal-summary";
import { CancelledNotice } from "@/features/portal/components/cancelled-notice";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const loadDashboard = cache(async (token: string) => {
  if (!isPlausibleToken(token)) return null;
  return getPortalDashboard(token);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadDashboard(token);
  return {
    title: data ? `Resumen · ${data.event.title}` : "Resumen de mi evento",
    robots: { index: false, follow: false },
  };
}

export default async function PortalSummaryPage({ params }: Props) {
  const { token } = await params;
  const data = await loadDashboard(token);
  // El layout ya respondió 404 a tokens inválidos; esto sólo cubre una carrera (evento borrado).
  if (!data) notFound();
  if (data.event.status === "CANCELLED") {
    // Mismo aviso amable que el portal (un evento cancelado no tiene resumen que imprimir).
    return (
      <main id="contenido" className="bg-ivory min-h-dvh">
        <CancelledNotice
          title={data.event.title}
          dateLabel={data.event.dateLabel}
          hostFirstName={data.host.firstName}
          contactEmail={data.business.contactEmail}
          whatsappUrl={data.business.whatsappUrl}
        />
      </main>
    );
  }
  return (
    <main id="contenido" className="bg-ivory min-h-dvh print:bg-white">
      <PortalSummaryView data={data} />
    </main>
  );
}
