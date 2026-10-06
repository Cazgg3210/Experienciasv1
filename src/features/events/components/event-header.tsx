import Link from "next/link";
import { CalendarDays, ChevronLeft, Lock, MapPin, MessageCircle, UserRound, UsersRound } from "lucide-react";
import { CopyButton } from "@/components/data/copy-button";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { daysUntil, formatLongDate } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES } from "@/lib/labels";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import type { EventHeaderData } from "../server/event-queries";
import { firstName, formatTimeRange, relativeDayLabel } from "../domain/format";

/** Encabezado del evento con datos clave y accesos rápidos (links del portal y de la invitación). */
export function EventHeader({ event }: { event: EventHeaderData }) {
  const portalUrl = appUrl(`/mi-evento/${event.portalToken}`);
  const inviteUrl = appUrl(`/e/${event.micrositeSlug}/${event.inviteToken}`);
  const phone = event.customer.whatsapp ?? event.customer.phone;
  const showCountdown = event.status !== "CANCELLED" && event.status !== "COMPLETED";
  const waText = `Hola ${firstName(event.customer.name)}, aquí tienes el portal de tu celebración «${event.title}»: ${portalUrl}`;

  return (
    <header className="space-y-4">
      <Link
        href="/admin/events"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Eventos
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow font-mono">{event.code}</span>
            <StatusBadge tone={EVENT_STATUS_TONES[event.status]}>
              {EVENT_STATUS_LABELS[event.status]}
            </StatusBadge>
            {event.closedAt ? (
              <StatusBadge tone="neutral" dot={false}>
                <Lock className="size-3" aria-hidden /> Cerrado
              </StatusBadge>
            ) : null}
          </div>
          <h1 className="font-heading text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            {event.title}
          </h1>
          <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <li className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              <span>
                <span className="inline-block first-letter:uppercase">{formatLongDate(event.eventDate)}</span>{" "}
                ·{" "}
                <span className="tabular whitespace-nowrap">
                  {formatTimeRange(event.startsAt, event.endsAt)}
                </span>
              </span>
              {showCountdown ? (
                <span className="bg-sand-soft text-charcoal rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                  {relativeDayLabel(daysUntil(event.startsAt))}
                </span>
              ) : null}
            </li>
            <li className="flex items-center gap-1.5">
              <UserRound className="size-4 shrink-0" aria-hidden />
              <Link
                href={`/admin/customers/${event.customer.id}`}
                className="text-foreground hover:underline"
              >
                {event.customer.name}
              </Link>
              {phone ? (
                <a
                  href={whatsappLink(phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-olive inline-flex items-center gap-1 font-medium hover:underline"
                >
                  <MessageCircle className="size-3.5" aria-hidden />
                  WhatsApp<span className="sr-only"> de {event.customer.name} (se abre en otra pestaña)</span>
                </a>
              ) : null}
            </li>
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {event.serviceArea?.name ?? "Zona por definir"}
            </li>
            <li className="flex items-center gap-1.5">
              <UsersRound className="size-4 shrink-0" aria-hidden />
              {event.guestCount} invitadas
            </li>
          </ul>
        </div>
        <div
          className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end"
          aria-label="Accesos rápidos"
          role="group"
        >
          <CopyButton value={portalUrl} label="Link del portal" toastMessage="Link del portal copiado" />
          <CopyButton
            value={inviteUrl}
            label="Link de invitación"
            toastMessage={
              event.micrositeEnabled
                ? "Link de invitación copiado"
                : "Copiado. Ojo: el micrositio está desactivado."
            }
          />
          {phone ? (
            <Button asChild variant="outline">
              <a href={whatsappLink(phone, waText)} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden />
                Enviar portal por WhatsApp
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled title="La clienta no tiene WhatsApp registrado">
              <MessageCircle aria-hidden />
              Sin WhatsApp
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
