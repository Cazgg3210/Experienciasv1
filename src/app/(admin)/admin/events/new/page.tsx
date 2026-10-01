import type { Metadata } from "next";
import { prisma } from "@/db";
import { PageHeader } from "@/components/layout/page-header";
import { isValidDateKey, localDateKey } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";
import { getSettings } from "@/features/settings/server/settings-service";
import { getEventFormOptions } from "@/features/events/server/event-queries";
import { NewEventForm } from "@/features/events/components/new-event-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuevo evento" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewEventPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("events:write", "/admin/events/new");
  const sp = await searchParams;
  const customerParam = Array.isArray(sp.customer) ? sp.customer[0] : sp.customer;
  const dateParam = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const todayKey = localDateKey();
  const initialDate = dateParam && isValidDateKey(dateParam) && dateParam >= todayKey ? dateParam : "";
  const [options, availability, initialCustomer] = await Promise.all([
    getEventFormOptions(),
    getSettings("availability"),
    customerParam && /^[a-z0-9_-]{8,40}$/i.test(customerParam)
      ? prisma.customer.findUnique({
          where: { id: customerParam },
          select: { id: true, name: true, email: true, phone: true, whatsapp: true },
        })
      : null,
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/events", label: "Eventos" }}
        title="Nuevo evento"
        description="Registra una celebración manualmente. Queda como consulta hasta que se confirme el anticipo."
      />
      <NewEventForm
        options={{ experiences: options.experiences, serviceAreas: options.serviceAreas }}
        defaultStartTime={availability.defaultStartTime}
        minDate={todayKey}
        initialDate={initialDate}
        initialCustomer={initialCustomer}
      />
    </div>
  );
}
