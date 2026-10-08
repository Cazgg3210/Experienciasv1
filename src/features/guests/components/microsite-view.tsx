import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, ExternalLink, HeartCrack, Link2, MapPin, Music2, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OCCASION_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { capitalize } from "@/features/portal/domain/portal";
import { MenuList } from "@/features/portal/components/menu-list";
import type { InviteView } from "../server/invite-queries";
import { RsvpPanel } from "./rsvp-panel";
import { ReturningGuestHint } from "./returning-guest-hint";
import { StickyRsvpCta } from "./sticky-rsvp-cta";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Micrositio editorial del evento + RSVP. Sin datos de otras invitadas. */
export function MicrositeView({ view }: { view: InviteView }) {
  const { event, guest } = view;
  // Colores del evento como acentos; si no hay, la paleta del estilo.
  const colors = uniqueColors(event.colors.length ? event.colors : view.palette).slice(0, 5);
  const accent = colors[0] ?? "#A3B18A";
  const responded = !!guest?.respondedAt;
  // Link general con la lista en su tope: el aviso llega en el HTML del servidor, en lugar del formulario
  // (`generalInviteClosedNotice`, mismo criterio y texto que el rechazo `GUEST_LIMIT` de `submitRsvp`).
  const closedNotice = event.rsvpOpen ? view.generalInviteClosedNotice : null;
  // Hay algo que responder aquí: sin eso no se ofrecen «Confirmar asistencia» ni la CTA fija.
  const canAnswer = event.rsvpOpen && !closedNotice;
  const place = [event.neighborhood, event.city].filter(Boolean).join(", ");
  const heroBg = { backgroundColor: `color-mix(in oklab, ${accent} 16%, var(--brand-ivory))` };

  return (
    <main id="contenido" className={cn("bg-ivory min-h-dvh", canAnswer && !responded && "pb-24 md:pb-0")}>
      {colors.length ? (
        <div aria-hidden className="flex h-2 w-full">
          {colors.map((c) => (
            <span key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      ) : null}

      <header style={heroBg} className="relative">
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-20 sm:pb-14">
          <p className="eyebrow">
            {view.hostFirstName ? `${view.hostFirstName} te invita` : "Estás invitada"} · {OCCASION_LABELS[event.occasion]}
          </p>
          <h1 className="font-heading mx-auto mt-4 max-w-3xl text-5xl leading-[1.02] font-semibold text-balance sm:text-7xl">
            {event.title}
          </h1>
          {event.honoreeName && !event.cancelled ? (
            <p className="font-heading text-olive mt-4 text-2xl italic sm:text-3xl">Celebramos a {event.honoreeName}</p>
          ) : null}
          <div className="mt-7 flex flex-col items-center gap-1 text-base sm:text-lg">
            <p className="font-medium">{capitalize(event.dateLabel)}</p>
            <p className="text-muted-foreground">
              {event.startTime} – {event.endTime} h{place ? ` · ${place}` : ""}
            </p>
          </div>
          {colors.length ? (
            <ul aria-label="Colores de la celebración" className="mt-6 flex justify-center gap-2">
              {colors.map((c) => (
                <li key={c} className="size-5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10" style={{ backgroundColor: c }}>
                  <span className="sr-only">{c}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {canAnswer && !event.cancelled ? (
            <Button asChild size="xl" className="mt-8">
              <a href="#rsvp">{responded ? "Ver mi respuesta" : "Confirmar asistencia"}</a>
            </Button>
          ) : null}
        </div>
        {view.cover && !event.cancelled ? (
          <div className="mx-auto max-w-5xl px-4 pb-2 sm:px-6">
            <div className="relative -mb-16 aspect-[4/3] overflow-hidden rounded-[2rem] shadow-sm sm:-mb-24 sm:aspect-[16/8]">
              <Image
                src={view.cover.src}
                alt={view.cover.alt}
                fill
                priority
                sizes="(min-width: 1024px) 64rem, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        ) : null}
      </header>

      <div className={cn("mx-auto max-w-3xl space-y-12 px-4 pb-16 sm:px-6", view.cover && !event.cancelled ? "pt-24 sm:pt-32" : "pt-12")}>
        {event.cancelled ? (
          <section className="bg-card rounded-3xl border p-6 text-center shadow-xs sm:p-10" aria-labelledby="cancelado">
            <div className="bg-sand-soft text-taupe mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
              <HeartCrack className="size-6" aria-hidden />
            </div>
            <h2 id="cancelado" className="font-heading text-3xl font-semibold">
              Esta celebración fue cancelada
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md">
              Gracias por tu cariño. Si tienes dudas, escríbele directamente a {view.hostFirstName || "la anfitriona"}.
            </p>
          </section>
        ) : (
          <>
            {view.via === "invite" && event.rsvpOpen ? <ReturningGuestHint slug={view.slug} /> : null}

            {event.hostMessage ? (
              <figure className="text-center">
                <blockquote className="font-heading text-2xl leading-snug text-balance italic sm:text-3xl">
                  “{event.hostMessage}”
                </blockquote>
                {view.hostFirstName ? (
                  <figcaption className="text-muted-foreground mt-3 text-sm">— {view.hostFirstName}</figcaption>
                ) : null}
              </figure>
            ) : null}

            <section aria-labelledby="detalles" className="space-y-4">
              <h2 id="detalles" className="font-heading text-center text-3xl font-semibold">
                Los detalles
              </h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailCard icon={CalendarDays} label="Cuándo">
                  <p className="font-medium">{capitalize(event.dateLabel)}</p>
                </DetailCard>
                <DetailCard icon={Clock} label="Horario">
                  <p className="font-medium">
                    {event.startTime} – {event.endTime} h
                  </p>
                </DetailCard>
                <DetailCard icon={MapPin} label="Dónde" className="sm:col-span-2">
                  {view.address?.addressLine ? (
                    <div className="space-y-2">
                      <address className="not-italic">
                        <p className="font-medium">{view.address.addressLine}</p>
                        <p className="text-muted-foreground text-sm">
                          {[event.neighborhood, view.address.postalCode ? `C.P. ${view.address.postalCode}` : null, event.city]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </address>
                      {view.address.addressNotes ? (
                        <p className="text-sm">Acceso: {view.address.addressNotes}</p>
                      ) : null}
                      {view.address.mapsLink ? (
                        <Button asChild variant="outline" className="h-11 rounded-full px-5">
                          <a href={view.address.mapsLink} target="_blank" rel="noopener noreferrer">
                            <MapPin aria-hidden /> Cómo llegar
                            <span className="sr-only">(se abre en otra pestaña)</span>
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{place || "Ciudad de México"}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Te compartimos la dirección exacta en cuanto confirmes tu asistencia.
                      </p>
                    </div>
                  )}
                </DetailCard>
                {event.dressCode ? (
                  <DetailCard icon={Shirt} label="Código de vestimenta">
                    <p className="font-medium">{event.dressCode}</p>
                  </DetailCard>
                ) : null}
                {event.playlistUrl ? (
                  <DetailCard icon={Music2} label="Playlist">
                    <a
                      href={event.playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-olive inline-flex min-h-10 items-center gap-1 font-medium underline underline-offset-4"
                    >
                      Escuchar y agregar canciones <ExternalLink className="size-4" aria-hidden />
                      <span className="sr-only">(se abre en otra pestaña)</span>
                    </a>
                  </DetailCard>
                ) : null}
              </dl>
            </section>

            {view.timeline.length ? (
              <section aria-labelledby="programa" className="space-y-4">
                <h2 id="programa" className="font-heading text-center text-3xl font-semibold">
                  El programa
                </h2>
                <ol className="bg-card mx-auto max-w-xl divide-y rounded-3xl border px-5 shadow-xs">
                  {view.timeline.map((t) => (
                    <li key={t.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 py-4">
                      <span className="tabular text-olive font-semibold">{t.time}</span>
                      <div>
                        <p className="font-medium">{t.title}</p>
                        {t.description ? <p className="text-muted-foreground text-sm">{t.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {view.menu ? (
              <section aria-labelledby="menu" className="space-y-4">
                <h2 id="menu" className="font-heading text-center text-3xl font-semibold">
                  El menú
                </h2>
                <div className="bg-card rounded-3xl border p-5 shadow-xs sm:p-8">
                  <MenuList menu={view.menu} />
                </div>
              </section>
            ) : null}

            <section
              id="rsvp"
              aria-label="Confirmación de asistencia"
              className="bg-card scroll-mt-6 rounded-3xl border border-t-4 p-5 shadow-sm sm:p-8"
              style={{ borderTopColor: accent }}
            >
              {closedNotice ? (
                <div className="space-y-4 text-center">
                  <div className="bg-sage-soft text-olive mx-auto flex size-14 items-center justify-center rounded-full">
                    <Link2 className="size-6" aria-hidden />
                  </div>
                  <h2 className="font-heading text-3xl font-semibold text-balance">Confirma desde tu link personal</h2>
                  <p className="text-muted-foreground mx-auto max-w-md">{closedNotice}</p>
                </div>
              ) : event.rsvpOpen ? (
                <RsvpPanel
                  key={view.token}
                  slug={view.slug}
                  token={view.token}
                  honoreeName={event.honoreeName}
                  calendarPath={view.calendarPath}
                  playlistUrl={event.playlistUrl}
                  guest={
                    guest
                      ? {
                          name: guest.name,
                          emailHint: guest.emailHint,
                          rsvpStatus: guest.rsvpStatus,
                          plusOne: guest.plusOne,
                          plusOneName: guest.plusOneName,
                          dietaryRestrictions: guest.dietaryRestrictions,
                          dietaryNotes: guest.dietaryNotes,
                          comment: guest.comment,
                          photoConsent: guest.photoConsent,
                          honoreeMessage: guest.honoreeMessage,
                          responded: responded,
                        }
                      : null
                  }
                />
              ) : (
                <div className="text-center">
                  <h2 className="font-heading text-3xl font-semibold">Esta celebración ya sucedió</h2>
                  <p className="text-muted-foreground mt-2">
                    Gracias por acompañar a {view.hostFirstName || "la anfitriona"}. Las confirmaciones ya cerraron.
                  </p>
                </div>
              )}
              {canAnswer && view.via === "invite" ? (
                // El link general siempre registra a una invitada nueva (nunca toma a otra por su nombre).
                <p className="text-muted-foreground mt-6 border-t pt-4 text-center text-sm">
                  ¿{view.hostFirstName ? `${view.hostFirstName} ya te mandó` : "Ya te llegó"} tu link personal? Responde
                  desde ese enlace para no duplicar tu lugar en la lista.
                </p>
              ) : null}
            </section>
          </>
        )}

        <footer className="text-muted-foreground pt-4 text-center text-sm">
          <p>
            Una experiencia de{" "}
            <Link href="/" className="font-heading text-foreground text-base font-semibold hover:underline">
              {view.brandName}
            </Link>
          </p>
          <p className="mt-1 text-xs">Tú reúne a las tuyas. Nosotras hacemos el resto.</p>
        </footer>
      </div>

      {canAnswer && !event.cancelled && !responded ? <StickyRsvpCta label="Confirmar asistencia" /> : null}
    </main>
  );
}

function uniqueColors(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const c = v.trim().toUpperCase();
    if (HEX.test(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

function DetailCard({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  // El <div> hijo directo del <dl> contiene SÓLO <dt> y <dd> (HTML válido para lectores de pantalla);
  // el ícono decorativo vive dentro del <dt>.
  return (
    <div className={cn("bg-card relative min-w-0 rounded-2xl border p-4 pl-[4.25rem] shadow-xs", className)}>
      <dt className="text-muted-foreground text-sm">
        <span
          aria-hidden
          className="bg-sage-soft text-olive absolute top-4 left-4 flex size-10 items-center justify-center rounded-full"
        >
          <Icon className="size-5" />
        </span>
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
