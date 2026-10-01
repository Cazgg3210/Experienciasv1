import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPlausibleToken } from "@/lib/tokens";
import { getPortalDashboard } from "@/features/portal/server/portal-service";
import { BrandBar } from "@/features/portal/components/brand-bar";
import { PortalDashboardView } from "@/features/portal/components/portal-dashboard";
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
    title: data ? `Mi evento · ${data.event.title}` : "Mi evento",
    robots: { index: false, follow: false },
  };
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params;
  const data = await loadDashboard(token);
  if (!data) notFound();

  if (data.event.status === "CANCELLED") {
    return (
      <>
        <BrandBar brandName={data.business.brandName} />
        <main id="contenido" className="bg-ivory min-h-[calc(100dvh-3.5rem)]">
          <CancelledNotice
            title={data.event.title}
            dateLabel={data.event.dateLabel}
            hostFirstName={data.host.firstName}
            contactEmail={data.business.contactEmail}
            whatsappUrl={data.business.whatsappUrl}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <BrandBar
        brandName={data.business.brandName}
        right={
          <a
            href={data.business.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-olive hover:bg-sage-soft inline-flex h-10 items-center rounded-full px-3 text-sm font-medium"
          >
            ¿Dudas? Escríbenos
          </a>
        }
      />
      <main id="contenido" className="bg-ivory min-h-dvh">
        <PortalDashboardView data={data} />
      </main>
    </>
  );
}
