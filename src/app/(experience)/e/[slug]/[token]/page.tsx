import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPlausibleToken } from "@/lib/tokens";
import { getInviteView } from "@/features/guests/server/invite-queries";
import { MicrositeView } from "@/features/guests/components/microsite-view";
import { capitalize } from "@/features/portal/domain/portal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; token: string }> };

const loadInvite = cache(async (slug: string, token: string) => {
  if (!isPlausibleToken(token)) return null;
  return getInviteView(slug, token);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, token } = await params;
  const view = await loadInvite(slug, token);
  if (!view) return { title: "Invitación", robots: { index: false, follow: false } };
  const title = view.event.title;
  const description = view.event.cancelled
    ? "Esta celebración fue cancelada."
    : `${view.hostFirstName ? `${view.hostFirstName} te invita` : "Estás invitada"} · ${capitalize(view.event.dateLabel)} · ${view.event.startTime} h. Confirma tu asistencia.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      ...(view.cover ? { images: [{ url: view.cover.src, alt: view.cover.alt }] } : {}),
    },
  };
}

export default async function MicrositePage({ params }: Props) {
  const { slug, token } = await params;
  const view = await loadInvite(slug, token);
  if (!view) notFound();
  return <MicrositeView view={view} />;
}
