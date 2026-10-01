import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, MapPin, MessageCircle, Navigation, Phone, Users } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { formatLongDate } from "@/lib/dates";
import {
  DIETARY_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  MENU_COURSE_LABELS,
  OCCASION_LABELS,
  RSVP_STATUS_LABELS,
  STAFF_FUNCTION_LABELS,
} from "@/lib/labels";
import { requirePagePermission } from "@/server/auth/session";
import { ucfirst } from "@/features/operations/domain/production";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { getStaffEventView } from "@/features/staff/server/portal-queries";
import { PortalChecklist } from "@/features/staff/components/portal-checklist";
import { ProgressBar } from "@/features/operations/components/progress-bar";
import { ColorSwatches } from "@/features/operations/components/production-parts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evento", robots: { index: false, follow: false } };

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="bg-card space-y-3 rounded-2xl border p-4 shadow-xs sm:p-5">
      <h2 id={id} className="font-heading text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function StaffEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("events:read_assigned", `/staff/events/${id}`);
  const view = await getStaffEventView(user, id);
  if (!view) notFound();
  const { event, client, coordinator, myAssignments, team, headCount, dietary } = view;

  return (
    <div className="space-y-5 pb-10">
      <Link href="/staff" className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden />
        Mis eventos
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">{OCCASION_LABELS[event.occasion]}</p>
          <StatusBadge tone={EVENT_STATUS_TONES[event.status]}>{EVENT_STATUS_LABELS[event.status]}</StatusBadge>
        </div>
        <h1 className="font-heading text-3xl leading-tight font-semibold">{event.title}</h1>
        <p className="text-muted-foreground">{ucfirst(formatLongDate(event.eventDate))}</p>
        <p className="text-sm">
          {event.experienceName ?? "Experiencia"} · {headCount.planned} invitadas ({headCount.confirmedTotal} confirmadas)
          {event.honoreeName ? ` · Homenajeada: ${event.honoreeName}` : ""}
        </p>
      </header>

      {/* Mi horario */}
      <Card id="mi-horario" title="Mi horario">
        {myAssignments.length ? (
          <ul className="space-y-2">
            {myAssignments.map((a) => (
              <li key={a.id} className="bg-sage-soft/60 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3">
                <span className="font-medium">{STAFF_FUNCTION_LABELS[a.function]}</span>
                <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                  <Clock className="text-olive size-4" aria-hidden />
                  {a.schedule}
                </span>
                {!a.confirmed ? <span className="text-warning w-full text-xs">Confirma tu asistencia con coordinación.</span> : null}
                {a.notes ? <span className="text-muted-foreground w-full text-sm">{a.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Vista de administración: no tienes una asignación en este evento.</p>
        )}
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          {[
            ["Salida", event.departureLabel],
            ["Montaje", event.setupLabel],
            ["Evento", event.timeLabel],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border px-2 py-2">
              <dt className="text-muted-foreground text-xs">{k}</dt>
              <dd className="font-medium tabular-nums">{v ?? "Por definir"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Dónde */}
      <Card id="donde" title="Dónde">
        <p className="flex items-start gap-2">
          <MapPin className="text-olive mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{event.address ?? "Dirección por confirmar"}</span>
        </p>
        {event.addressNotes ? <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">{event.addressNotes}</p> : null}
        {event.mapsUrl ? (
          <a
            href={event.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-primary text-primary-foreground focus-visible:ring-ring/50 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-medium outline-none focus-visible:ring-3 sm:w-auto sm:px-7"
          >
            <Navigation className="size-5" aria-hidden />
            Abrir en Maps
          </a>
        ) : null}
      </Card>

      {/* Contactos */}
      <Card id="contactos" title="Contactos">
        <ul className="space-y-3">
          {coordinator ? (
            <ContactRow label="Coordinación" name={coordinator.name} phone={coordinator.phone} />
          ) : (
            <li className="text-muted-foreground text-sm">Coordinación por asignar.</li>
          )}
          {client.phone ? <ContactRow label="Clienta" name={client.firstName} phone={client.phone} /> : null}
        </ul>
        <details className="group">
          <summary className="text-olive flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-sm font-medium">
            <Users className="size-4" aria-hidden />
            Equipo del evento ({team.length})
          </summary>
          <ul className="mt-2 divide-y rounded-xl border">
            {team.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {t.name}
                  {t.isMe ? <span className="text-muted-foreground"> (tú)</span> : null}
                </span>
                <span className="text-muted-foreground text-xs">
                  {STAFF_FUNCTION_LABELS[t.function]} · {t.schedule}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {/* Menú */}
      <Card id="menu" title={view.menuName ? `Menú · ${view.menuName}` : "Menú"}>
        <p className="text-sm">
          Porciones: <strong>{headCount.portions}</strong>{" "}
          <span className="text-muted-foreground">
            ({headCount.planned} planeadas · {headCount.confirmedTotal} confirmadas)
          </span>
        </p>
        {view.courses.length ? (
          <div className="space-y-3">
            {view.courses.map((c) => (
              <div key={c.course}>
                <h3 className="eyebrow mb-1">{MENU_COURSE_LABELS[c.course]}</h3>
                <ul className="space-y-1 text-sm">
                  {c.items.map((i) => (
                    <li key={i.id}>
                      {i.name}
                      {i.dietaryTags.length ? (
                        <span className="text-olive text-xs"> · {i.dietaryTags.map((t) => DIETARY_LABELS[t]).join(", ")}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Menú por confirmar.</p>
        )}
        <div className="border-t pt-3">
          <h3 className="mb-2 text-sm font-semibold">Restricciones alimentarias</h3>
          {dietary.byRestriction.length === 0 && dietary.notesOnly.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nadie ha reportado restricciones.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dietary.byRestriction.map((r) => (
                <li key={r.restriction} className="bg-warning/5 rounded-lg px-3 py-2">
                  <span className="font-medium">{DIETARY_LABELS[r.restriction]}:</span>{" "}
                  {r.guests
                    .map((g) => `${g.name}${g.rsvpStatus !== "ATTENDING" ? ` (${RSVP_STATUS_LABELS[g.rsvpStatus].toLowerCase()})` : ""}${g.notes ? ` — ${g.notes}` : ""}`)
                    .join("; ")}
                </li>
              ))}
              {dietary.notesOnly.map((g, i) => (
                <li key={`n-${i}`} className="bg-muted/50 rounded-lg px-3 py-2">
                  <span className="font-medium">{g.name}:</span> {g.notes}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Add-ons y estilo */}
      <Card id="detalles" title="Add-ons y estilo">
        {view.addOns.length ? (
          <ul className="space-y-2 text-sm">
            {view.addOns.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.name}</span>
                {a.quantity > 1 ? ` ×${a.quantity}` : ""}
                {a.notes ? <span className="text-muted-foreground block text-xs">{a.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Sin add-ons.</p>
        )}
        <div className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-semibold">Colores{event.style ? ` · estilo ${event.style.name}` : ""}</h3>
          <ColorSwatches colors={event.colors.length ? event.colors : (event.style?.palette ?? [])} label="Colores del evento" />
          {event.dressCode ? <p className="text-sm">Dress code: {event.dressCode}</p> : null}
          {event.customerNotes ? <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">{event.customerNotes}</p> : null}
        </div>
      </Card>

      {view.timeline.length ? (
        <Card id="itinerario" title="Itinerario">
          <ol className="space-y-2">
            {view.timeline.map((t) => (
              <li key={t.id} className="flex gap-3 text-sm">
                <span className="text-olive w-12 shrink-0 font-semibold tabular-nums">{t.time}</span>
                <span>
                  {t.title}
                  {t.description ? <span className="text-muted-foreground block text-xs">{t.description}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {/* Checklist */}
      <section aria-labelledby="checklist" className="space-y-4">
        <div className="space-y-2">
          <h2 id="checklist" className="font-heading text-2xl font-semibold">
            Checklist
          </h2>
          {view.myProgress.total > 0 ? (
            <ProgressBar progress={view.myProgress} label="Avance de mis tareas" />
          ) : (
            <ProgressBar progress={view.progress} label="Avance del checklist del evento" />
          )}
        </div>
        <PortalChecklist items={view.checklist} hasStaffProfile={!!view.staffMemberId} viewerIsBackoffice={view.viewerIsBackoffice} />
      </section>
    </div>
  );
}

function ContactRow({ label, name, phone }: { label: string; name: string; phone: string | null }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        <span className="text-muted-foreground block text-xs">{label}</span>
        <span className="font-medium">{name}</span>
      </span>
      {phone ? (
        <span className="flex gap-2">
          <a
            href={`tel:${phone}`}
            aria-label={`Llamar a ${name}`}
            className="hover:bg-muted focus-visible:ring-ring/50 inline-flex size-11 items-center justify-center rounded-full border outline-none focus-visible:ring-3"
          >
            <Phone className="size-5" aria-hidden />
          </a>
          <a
            href={whatsappLink(phone)}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp a ${name}`}
            className="hover:bg-muted focus-visible:ring-ring/50 inline-flex size-11 items-center justify-center rounded-full border outline-none focus-visible:ring-3"
          >
            <MessageCircle className="size-5" aria-hidden />
          </a>
        </span>
      ) : null}
    </li>
  );
}
