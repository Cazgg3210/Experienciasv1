import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { PaymentsPanel } from "@/features/payments/components/payments-panel";
import { getSettings } from "@/features/settings/server/settings-service";
import { getEventDetail, getEventFormOptions } from "@/features/events/server/event-queries";
import { scheduleToFormValues } from "@/features/events/domain/event-schedule";
import { isScheduleLocked, statusActionsFor } from "@/features/events/domain/status-actions";
import { EventEditForm } from "@/features/events/components/event-edit-form";
import { StatusPanel } from "@/features/events/components/status-panel";
import { TimelineEditor } from "@/features/events/components/timeline-editor";
import { HostThread } from "@/features/events/components/host-thread";
import { TokenPanel } from "@/features/events/components/token-panel";
import { BookingInfo } from "@/features/events/components/booking-info";
import type { UpdateEventInput } from "@/features/events/schemas";

export const dynamic = "force-dynamic";

export default async function EventSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("events:read_all");
  const { id } = await params;
  const [event, options, availability] = await Promise.all([
    getEventDetail(id),
    getEventFormOptions(),
    getSettings("availability"),
  ]);
  if (!event) notFound();

  const canWrite = can(user.role, "events:write");
  const canCancel = can(user.role, "events:cancel");
  const schedule = scheduleToFormValues(event);
  const defaults: UpdateEventInput = {
    eventId: event.id,
    title: event.title,
    occasion: event.occasion,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    guestCount: event.guestCount,
    experienceId: event.experienceId ?? "",
    menuId: event.menuId ?? "",
    styleId: event.styleId ?? "",
    serviceAreaId: event.serviceAreaId ?? "",
    addressLine: event.addressLine ?? "",
    neighborhood: event.neighborhood ?? "",
    postalCode: event.postalCode ?? "",
    mapsUrl: event.mapsUrl ?? "",
    addressNotes: event.addressNotes ?? "",
    honoreeName: event.honoreeName ?? "",
    colors: event.colors.join(", "),
    dressCode: event.dressCode ?? "",
    hostMessage: event.hostMessage ?? "",
    playlistUrl: event.playlistUrl ?? "",
    customerNotes: event.customerNotes ?? "",
    internalNotes: event.internalNotes ?? "",
    micrositeEnabled: event.micrositeEnabled,
    confirmUnavailable: false,
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <aside className="order-first space-y-6 lg:order-last" aria-label="Estado, pagos y enlaces">
        <StatusPanel
          eventId={event.id}
          status={event.status}
          actions={statusActionsFor(event.status)}
          canWrite={canWrite}
          canCancel={canCancel}
          meta={{
            completedAt: event.completedAt ? formatDateTime(event.completedAt) : null,
            cancelledAt: event.cancelledAt ? formatShortDate(event.cancelledAt) : null,
            cancellationReason: event.cancellationReason,
          }}
        />
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <PaymentsPanel eventId={event.id} />
        </Suspense>
        <BookingInfo booking={event.booking} quote={event.quote} />
        <TokenPanel
          eventId={event.id}
          portalUrl={appUrl(`/mi-evento/${event.portalToken}`)}
          inviteUrl={appUrl(`/e/${event.micrositeSlug}/${event.inviteToken}`)}
          micrositeEnabled={event.micrositeEnabled}
          canWrite={canWrite}
        />
      </aside>

      <div className="min-w-0 space-y-6">
        {canWrite ? (
          <EventEditForm
            defaultValues={defaults}
            options={options}
            scheduleLocked={isScheduleLocked(event.status)}
            hasBooking={!!event.booking}
          />
        ) : (
          <ReadOnlyDetails event={event} />
        )}
        <TimelineEditor
          eventId={event.id}
          canWrite={canWrite}
          defaultTime={schedule.startTime || availability.defaultStartTime}
          items={event.timeline.map((t) => ({
            id: t.id,
            time: t.time,
            title: t.title,
            description: t.description,
            visibleToGuests: t.visibleToGuests,
            sortOrder: t.sortOrder,
          }))}
        />
        <HostThread
          eventId={event.id}
          canWrite={canWrite}
          customerName={event.customer.name}
          messages={event.messages
            .filter((m) => !m.hidden)
            .map((m) => ({
              id: m.id,
              authorType: m.authorType,
              authorName: m.authorName,
              body: m.body,
              createdAtLabel: formatDateTime(m.createdAt),
              createdAtIso: m.createdAt.toISOString(),
            }))}
        />
      </div>
    </div>
  );
}

function ReadOnlyDetails({ event }: { event: NonNullable<Awaited<ReturnType<typeof getEventDetail>>> }) {
  const rows: Array<[string, string | null | undefined]> = [
    ["Experiencia", event.experience?.name],
    ["Menú", event.menu?.name],
    ["Estilo", event.style?.name],
    ["Zona", event.serviceArea?.name],
    ["Dirección", [event.addressLine, event.neighborhood, event.postalCode].filter(Boolean).join(", ")],
    ["Notas de acceso", event.addressNotes],
    ["Homenajeada", event.honoreeName],
    ["Colores", event.colors.join(", ")],
    ["Código de vestimenta", event.dressCode],
    ["Mensaje de la anfitriona", event.hostMessage],
    ["Notas de la clienta", event.customerNotes],
    ["Notas internas", event.internalNotes],
  ];
  return (
    <section aria-labelledby="details-title" className="bg-card rounded-xl border p-4 shadow-xs sm:p-5">
      <h2 id="details-title" className="font-heading mb-3 text-xl font-semibold">
        Detalles
      </h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm whitespace-pre-wrap">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
