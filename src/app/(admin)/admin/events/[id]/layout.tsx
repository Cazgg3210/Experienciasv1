import type { Metadata } from "next";
import { hasPermission, requirePagePermission } from "@/server/auth/session";
import { getEventHeader } from "@/features/events/server/event-queries";
import { EventHeader } from "@/features/events/components/event-header";
import { EventTabs } from "@/features/events/components/event-tabs";
import { SegmentChildren } from "@/components/layout/segment-children";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!(await hasPermission("events:read_all"))) return { title: "Evento" };
  const { id } = await params;
  const event = await getEventHeader(id);
  if (!event) return { title: "Evento no encontrado" };
  // Un título "string" en este layout cortaría la plantilla del panel para las pestañas hijas:
  // se define una plantilla propia para que "Invitadas", "Operaciones"… incluyan el evento.
  return {
    title: {
      absolute: `${event.title} · ${event.code} · Panel Ivonne & Rosa`,
      template: `%s · ${event.title} · Panel Ivonne & Rosa`,
    },
  };
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  await requirePagePermission("events:read_all");
  const { id } = await params;
  const event = await getEventHeader(id);
  // Sin evento: no se pinta encabezado ni pestañas; cada pestaña llama notFound() y así se
  // muestra el not-found propio del evento (./not-found.tsx). Un notFound() lanzado aquí lo
  // atraparía la frontera del panel y mostraría la página genérica "No encontramos este registro".
  if (!event) return <>{children}</>;

  const base = `/admin/events/${event.id}`;
  return (
    <div className="space-y-6">
      <EventHeader event={event} />
      <EventTabs
        tabs={[
          { href: base, label: "Resumen", exact: true },
          { href: `${base}/guests`, label: "Invitadas" },
          { href: `${base}/operations`, label: "Operaciones" },
          { href: `${base}/financials`, label: "Finanzas" },
          { href: `${base}/memory`, label: "Memory Capsule" },
        ]}
      />
      <div>
        <SegmentChildren>{children}</SegmentChildren>
      </div>
    </div>
  );
}
