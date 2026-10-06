import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatLongDate, localDateKey, toDateKey } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { getGuestsOverview } from "@/features/events/server/guest-admin-service";
import { firstName } from "@/features/events/domain/format";
import { RsvpSummaryCards } from "@/features/events/components/rsvp-summary";
import { DietarySummary } from "@/features/events/components/dietary-summary";
import { GuestsTable, type GuestRow } from "@/features/events/components/guests-table";
import { SendRemindersButton } from "@/features/events/components/send-reminders-button";
import { HonoreeMessages } from "@/features/events/components/honoree-messages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitadas" };

export default async function EventGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("guests:read");
  const { id } = await params;
  const overview = await getGuestsOverview(id);
  if (!overview) notFound();
  const { event, summary, dietary, possibleDuplicates } = overview;
  const canWrite = can(user.role, "guests:write");

  const eventDay = formatLongDate(event.eventDate);
  const rows: GuestRow[] = event.guests.map((g) => {
    const rsvpUrl = appUrl(`/e/${event.micrositeSlug}/${g.token}`);
    const text =
      g.rsvpStatus === "PENDING"
        ? `Hola ${firstName(g.name)}, te esperamos en «${event.title}» el ${eventDay}. ¿Nos confirmas tu asistencia aquí? ${rsvpUrl}`
        : `Hola ${firstName(g.name)}, aquí tienes tu invitación a «${event.title}» (${eventDay}): ${rsvpUrl}`;
    return {
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      rsvpStatus: g.rsvpStatus,
      plusOne: g.plusOne,
      plusOneName: g.plusOneName,
      dietaryRestrictions: g.dietaryRestrictions,
      dietaryNotes: g.dietaryNotes,
      comment: g.comment,
      source: g.source,
      possibleDuplicate: possibleDuplicates.has(g.id),
      respondedAtLabel: g.respondedAt ? formatDateTime(g.respondedAt) : null,
      rsvpUrl,
      whatsappUrl: g.phone ? whatsappLink(g.phone, text) : null,
    };
  });
  const pendingWithContact = event.guests.filter(
    (g) => g.rsvpStatus === "PENDING" && (g.phone || g.email),
  ).length;
  const reminderBlocked =
    event.status === "CANCELLED" || event.status === "COMPLETED"
      ? "El evento ya no admite recordatorios."
      : toDateKey(event.eventDate) < localDateKey()
        ? "La fecha del evento ya pasó."
        : !event.micrositeEnabled
          ? "Activa el micrositio (pestaña Resumen) para enviar recordatorios."
          : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Invitadas y RSVP</h2>
          <p className="text-muted-foreground text-sm">
            {summary.attendingTotal} confirmadas de {event.guestCount} planeadas.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canWrite ? (
            <SendRemindersButton
              eventId={event.id}
              pendingWithContact={pendingWithContact}
              disabledReason={reminderBlocked}
            />
          ) : null}
          <Button asChild variant="outline" size="lg">
            <a href={`/api/events/${event.id}/guests.csv`} download>
              <Download aria-hidden />
              Exportar CSV
            </a>
          </Button>
        </div>
      </div>

      <RsvpSummaryCards summary={summary} plannedGuests={event.guestCount} />

      <DietarySummary dietary={dietary} />

      <GuestsTable eventId={event.id} guests={rows} canWrite={canWrite} />

      <HonoreeMessages
        eventId={event.id}
        honoreeName={event.honoreeName}
        canModerate={canWrite}
        messages={event.messages.map((m) => ({
          id: m.id,
          authorName: m.guest?.name ?? m.authorName,
          body: m.body,
          hidden: m.hidden,
          createdAtLabel: formatDateTime(m.createdAt),
        }))}
      />
    </div>
  );
}
