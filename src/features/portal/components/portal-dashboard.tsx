import Image from "next/image";
import {
  CalendarClock,
  Camera,
  CreditCard,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Palette,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { CopyButton } from "@/components/data/copy-button";
import { EVENT_STATUS_TONES, OCCASION_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { FRIENDLY_STATUS, capitalize } from "../domain/portal";
import type { PortalDashboard } from "../server/portal-service";
import { SectionCard } from "./section-card";
import { SectionNav, type SectionLink } from "./section-nav";
import { Countdown } from "./countdown";
import { PayButton } from "./pay-button";
import { MenuList } from "./menu-list";
import { AddGuestButton, GuestList, type GuestRow } from "./guest-list";
import { AddGuestDialog } from "./add-guest-dialog";
import { AddressEditor } from "./address-editor";
import { PreferencesPanel } from "./preferences-panel";
import { MessageThread } from "./message-thread";
import { ReviewForm } from "./review-form";
import { ActionBar } from "./action-bar";
import { PortalUiProvider } from "./portal-ui";

const HEX = /^#[0-9a-fA-F]{6}$/;

const SOURCE_LABELS: Record<string, string | null> = {
  HOST: null,
  ADMIN: "Agregada por el equipo",
  SELF_RSVP: "Confirmó con la invitación general",
};

/** Portal "Mi evento" completo (RSC). Las partes interactivas son componentes cliente. */
export function PortalDashboardView({ data }: { data: PortalDashboard }) {
  const { event, permissions, payment } = data;
  const completed = event.status === "COMPLETED";
  const safeColors = event.colors.filter((c) => HEX.test(c));
  // Compartir invitaciones sólo si el micrositio está activo (si no, los links darían 404)
  // y el evento sigue abierto (no tiene sentido invitar a un evento completado).
  const canShareInvites = event.micrositeEnabled && permissions.editable;

  const links: SectionLink[] = [
    ...(completed ? [{ id: "opinion", label: "Tu opinión" }] : []),
    { id: "pago", label: "Pago" },
    { id: "invitadas", label: "Invitadas" },
    { id: "menu", label: "Menú" },
    { id: "ubicacion", label: "Ubicación" },
    { id: "programa", label: "Programa" },
    { id: "preferencias", label: "Preferencias" },
    { id: "mensajes", label: "Mensajes" },
    { id: "fotos", label: "Fotos" },
  ];

  const guestRows: GuestRow[] = data.guests.map((g) => ({
    id: g.id,
    name: g.name,
    rsvpStatus: g.rsvpStatus,
    plusOne: g.plusOne,
    plusOneName: g.plusOneName,
    dietaryRestrictions: g.dietaryRestrictions,
    dietaryNotes: g.dietaryNotes,
    comment: g.comment,
    sourceLabel: SOURCE_LABELS[g.source] ?? null,
    inviteUrl: g.inviteUrl,
    whatsappUrl: g.whatsappUrl,
    canRemove: g.canRemove,
    removeDescription: g.removeDescription,
    possibleDuplicate: g.possibleDuplicate,
    duplicateHint: g.duplicateHint,
  }));

  return (
    <PortalUiProvider>
      <PortalHero data={data} colors={safeColors} />

      <div className="mx-auto max-w-6xl px-4 pb-36 sm:px-6 md:pb-32 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:pt-8">
        <SectionNav links={links} />
        <div className="mx-auto w-full max-w-3xl space-y-6 pt-6 lg:mx-0 lg:pt-0">
          {completed ? <ReviewSection data={data} /> : null}

          <SectionCard id="pago" title="Pago" icon={CreditCard}>
            <PaymentContent data={data} />
          </SectionCard>

          <SectionCard
            id="invitadas"
            title="Invitadas"
            icon={Users}
            description={
              data.stats.total
                ? `${data.stats.attending} confirmadas de ${data.stats.total} invitadas`
                : "Arma tu lista y comparte la invitación digital."
            }
            action={permissions.editable && data.guests.length > 0 ? <AddGuestButton /> : null}
          >
            <div className="space-y-6">
              {data.stats.total > 0 ? <RsvpStatsGrid data={data} /> : null}
              <InvitationBox data={data} />
              <GuestList
                token={data.token}
                guests={guestRows}
                editable={permissions.editable}
                canShare={canShareInvites}
              />
              {data.honoreeMessageCount > 0 ? (
                <p className="bg-sand-soft/70 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm">
                  <Heart className="text-olive mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {data.honoreeMessageCount === 1
                      ? "Hay 1 mensaje"
                      : `Hay ${data.honoreeMessageCount} mensajes`}{" "}
                    para {event.honoreeName ?? "la homenajeada"}. Los guardamos como sorpresa para la Memory Capsule.
                  </span>
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard id="menu" title="Menú" icon={UtensilsCrossed}>
            <MenuList
              menu={data.menu}
              includes={data.experience?.includes}
              experienceName={data.experience?.name}
              addOns={data.addOns}
            />
          </SectionCard>

          <SectionCard id="ubicacion" title="Ubicación" icon={MapPin}>
            <LocationContent data={data} />
          </SectionCard>

          <SectionCard id="programa" title="Programa del día" icon={CalendarClock}>
            <TimelineContent data={data} />
          </SectionCard>

          <SectionCard
            id="preferencias"
            title="Preferencias"
            icon={Palette}
            description="Colores, mensaje para tus invitadas y detalles para el equipo."
          >
            <PreferencesPanel
              token={data.token}
              editable={permissions.editable}
              initial={{
                colors: safeColors,
                honoreeName: event.honoreeName ?? "",
                dressCode: event.dressCode ?? "",
                hostMessage: event.hostMessage ?? "",
                customerNotes: event.customerNotes ?? "",
                playlistUrl: event.playlistUrl ?? "",
              }}
            />
          </SectionCard>

          <SectionCard
            id="mensajes"
            title="Mensajes"
            icon={MessageCircle}
            description="Tu conversación con Ivonne, Rosa y el equipo."
          >
            <MessageThread
              token={data.token}
              canSend={event.status !== "CANCELLED"}
              messages={data.messages.map((m) => ({
                id: m.id,
                authorType: m.authorType,
                authorName: m.authorName,
                body: m.body,
                timeLabel: formatDateTime(m.createdAt),
              }))}
            />
          </SectionCard>

          <SectionCard id="fotos" title="Fotos" icon={Camera}>
            <PhotosContent data={data} />
          </SectionCard>
        </div>
      </div>

      {permissions.editable ? <AddGuestDialog token={data.token} /> : null}
      <ActionBar
        token={data.token}
        title={event.title}
        invitationText={data.invitationText}
        inviteUrl={data.links.invite}
        canShareInvites={canShareInvites && !data.invitationFull}
        summaryHref={data.links.summary}
        pay={payment?.cta && payment.paymentsEnabled ? { kind: payment.cta.kind, label: payment.cta.label } : null}
        canAddGuests={permissions.editable}
      />
    </PortalUiProvider>
  );
}

function PortalHero({ data, colors }: { data: PortalDashboard; colors: string[] }) {
  const { event } = data;
  const friendly = FRIENDLY_STATUS[event.status];
  const place = [event.neighborhood, event.city].filter(Boolean).join(", ");
  return (
    <section aria-labelledby="evento-titulo" className="bg-sand-soft relative overflow-hidden">
      {colors.length ? (
        <div aria-hidden className="flex h-1.5 w-full">
          {colors.map((c) => (
            <span key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      ) : null}
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-10 sm:px-6 sm:pt-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <p className="eyebrow">
            Mi evento · {OCCASION_LABELS[event.occasion]} · {event.code}
          </p>
          <h1
            id="evento-titulo"
            className="font-heading mt-3 text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
          >
            {event.title}
          </h1>
          <p className="mt-4 text-base sm:text-lg">
            {capitalize(event.dateLabel)}
            <span className="text-muted-foreground"> · </span>
            <span className="whitespace-nowrap">
              {event.startTime} – {event.endTime} h
            </span>
          </p>
          {place ? <p className="text-muted-foreground mt-1 text-sm">{place}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge tone={EVENT_STATUS_TONES[event.status]} className="h-7 px-3 text-sm">
              {friendly.title}
            </StatusBadge>
            <span className="text-muted-foreground text-sm">{friendly.description}</span>
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            Hola, {data.host.firstName}. Aquí tienes todo lo de tu celebración en un solo lugar.
          </p>
        </div>
        <Countdown
          startsAt={event.startsAt.toISOString()}
          endsAt={event.endsAt.toISOString()}
          serverNow={data.now.toISOString()}
        />
      </div>
    </section>
  );
}

function PaymentContent({ data }: { data: PortalDashboard }) {
  const p = data.payment;
  if (!p) {
    return (
      <p className="text-muted-foreground text-sm">
        Muy pronto verás aquí el resumen de pagos de tu celebración. Si tienes dudas, escríbenos en Mensajes.
      </p>
    );
  }
  const pct = p.totalCents > 0 ? Math.min(100, Math.round((p.paidCents / p.totalCents) * 100)) : 0;
  const pendingDeposit = data.event.status === "PENDING_PAYMENT";
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-sand-soft/60 rounded-2xl p-3 sm:p-4">
          <dt className="text-muted-foreground text-xs sm:text-sm">Total</dt>
          <dd className="tabular mt-1 text-lg font-semibold sm:text-2xl">{formatMXN(p.totalCents)}</dd>
        </div>
        <div className="bg-sage-soft/70 rounded-2xl p-3 sm:p-4">
          <dt className="text-muted-foreground text-xs sm:text-sm">Pagado</dt>
          <dd className="tabular text-olive mt-1 text-lg font-semibold sm:text-2xl">{formatMXN(p.paidCents)}</dd>
        </div>
        <div className="rounded-2xl border p-3 sm:p-4">
          <dt className="text-muted-foreground text-xs sm:text-sm">Saldo</dt>
          <dd className="tabular mt-1 text-lg font-semibold sm:text-2xl">{formatMXN(p.balanceCents)}</dd>
        </div>
      </dl>
      <div>
        <div
          role="progressbar"
          aria-label="Avance de pago"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}% pagado`}
          className="bg-muted h-2.5 overflow-hidden rounded-full"
        >
          <div className="bg-olive h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {pendingDeposit && p.cta
            ? `Anticipo para confirmar tu fecha: ${formatMXN(p.cta.amountCents)}.`
            : p.balanceCents > 0
              ? p.balanceDueAt
                ? `Fecha límite para liquidar: ${formatLongDate(p.balanceDueAt)}.`
                : "Puedes liquidar el saldo antes de tu evento."
              : "¡Tu celebración está liquidada! Gracias."}
        </p>
      </div>
      {p.cta ? (
        p.paymentsEnabled ? (
          <PayButton token={data.token} kind={p.cta.kind} label={`${p.cta.label} · ${formatMXN(p.cta.amountCents)}`} />
        ) : (
          <div className="bg-sand-soft/70 rounded-2xl px-4 py-3 text-sm">
            Los pagos en línea están en pausa por el momento. Escríbenos y te compartimos los datos para
            transferencia.{" "}
            <a
              href={data.business.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-olive font-medium underline underline-offset-4"
            >
              Escribir por WhatsApp
            </a>
          </div>
        )
      ) : null}
    </div>
  );
}

function RsvpStatsGrid({ data }: { data: PortalDashboard }) {
  const s = data.stats;
  const items = [
    { label: "Confirmadas", value: s.attending, cls: "bg-sage-soft/70 text-olive" },
    { label: "Pendientes", value: s.pending, cls: "bg-sand-soft/70" },
    { label: "Tal vez", value: s.maybe, cls: "bg-sand-soft/40" },
    { label: "No asisten", value: s.notAttending, cls: "bg-muted/60" },
  ];
  const over = s.headcount > data.event.guestCount;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className={cn("rounded-2xl px-3 py-3", i.cls)}>
            <dt className="text-xs">{i.label}</dt>
            <dd className="font-heading text-3xl leading-tight font-semibold lining-nums tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>
      <p className={cn("text-sm", over ? "text-warning font-medium" : "text-muted-foreground")}>
        Personas esperadas: {s.headcount}
        {s.plusOnes ? ` (incluye ${s.plusOnes} ${s.plusOnes === 1 ? "acompañante" : "acompañantes"})` : ""} · Tu
        experiencia es para {data.event.guestCount} personas.
        {over ? " Escríbenos para ajustar tu experiencia y que nadie se quede sin lugar." : ""}
      </p>
    </div>
  );
}

function InvitationBox({ data }: { data: PortalDashboard }) {
  if (!data.event.micrositeEnabled) {
    return (
      <p className="bg-sand-soft/70 rounded-2xl px-4 py-3 text-sm">
        La invitación digital está desactivada para este evento. Escríbenos si quieres activarla.
      </p>
    );
  }
  if (!data.permissions.editable) return null;
  // En el tope ya no se ofrece copiar la invitación general (quien la reciba no podría responder): el aviso dice
  // qué hacer y «Ver invitación» sigue para que vea lo mismo que sus invitadas.
  const fullNotice = data.invitationFullNotice;
  return (
    <div className="bg-sand-soft/50 space-y-3 rounded-2xl border border-dashed p-4">
      <div>
        <p className="font-medium">Invitación general</p>
        {fullNotice ? null : (
          <p className="text-muted-foreground text-sm">
            Compártela en tu grupo: cada amiga confirma con su nombre y sus restricciones alimentarias.
          </p>
        )}
      </div>
      {fullNotice ? (
        <p className="bg-background/80 rounded-xl px-3 py-2 text-sm">
          {fullNotice}{" "}
          <a href="#mensajes" className="text-olive font-medium underline underline-offset-4">
            Ir a Mensajes
          </a>
        </p>
      ) : (
        <div className="bg-background/80 rounded-xl px-3 py-2">
          <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-line">{data.invitationText}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {fullNotice ? null : (
          <>
            <CopyButton
              value={data.invitationText}
              label="Copiar invitación"
              copiedLabel="¡Copiada!"
              toastMessage="Invitación copiada. Pégala en tu grupo de WhatsApp."
              className="h-10 rounded-full px-4"
            />
            <CopyButton
              value={data.links.invite}
              label="Copiar link"
              copiedLabel="¡Copiado!"
              toastMessage="Link de la invitación copiado"
              className="h-10 rounded-full px-4"
            />
          </>
        )}
        <Button asChild variant="ghost" className="h-10 rounded-full px-4">
          <a href={data.links.invitePath} target="_blank" rel="noopener noreferrer">
            Ver invitación <ExternalLink aria-hidden />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </Button>
      </div>
    </div>
  );
}

function LocationContent({ data }: { data: PortalDashboard }) {
  const { event, permissions } = data;
  const hasAddress = !!event.addressLine;
  const initial = {
    addressLine: event.addressLine ?? "",
    neighborhood: event.neighborhood ?? "",
    postalCode: event.postalCode ?? "",
    addressNotes: event.addressNotes ?? "",
    mapsUrl: event.mapsUrl ?? "",
  };
  return (
    <div className="space-y-4">
      {hasAddress ? (
        <address className="not-italic">
          <p className="text-lg font-medium">{event.addressLine}</p>
          <p className="text-muted-foreground">
            {[event.neighborhood, event.postalCode ? `C.P. ${event.postalCode}` : null, event.city]
              .filter(Boolean)
              .join(", ")}
          </p>
        </address>
      ) : (
        <p className="bg-sand-soft/70 rounded-2xl px-4 py-3 text-sm">
          Aún no tenemos la dirección completa de tu celebración.{" "}
          {permissions.canEditAddress ? "Agrégala aquí para que el equipo planee la llegada." : "Escríbenos para agregarla."}
        </p>
      )}
      {event.addressNotes ? (
        <div className="bg-sand-soft/50 rounded-2xl px-4 py-3 text-sm">
          <p className="font-medium">Indicaciones de acceso</p>
          <p className="text-muted-foreground mt-0.5 whitespace-pre-line">{event.addressNotes}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start gap-2">
        {event.mapsLink ? (
          <Button asChild variant="outline" className="h-11 rounded-full px-5">
            <a href={event.mapsLink} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden /> Abrir en Maps
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </Button>
        ) : null}
        {permissions.canEditAddress ? (
          <div className="w-full sm:w-auto [&>form]:w-full">
            <AddressEditor token={data.token} initial={initial} startOpen={!hasAddress} />
          </div>
        ) : null}
      </div>
      {!permissions.canEditAddress && permissions.editable ? (
        <p className="text-muted-foreground text-sm">
          Faltan menos de 48 horas: si necesitas cambiar algo de la dirección, escríbenos en Mensajes o por{" "}
          <a
            href={data.business.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-olive font-medium underline underline-offset-4"
          >
            WhatsApp
          </a>
          .
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Por privacidad, tus invitadas ven la dirección exacta sólo después de confirmar su asistencia.
      </p>
    </div>
  );
}

function TimelineContent({ data }: { data: PortalDashboard }) {
  if (data.timeline.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Estamos armando el programa de tu celebración. Te lo compartimos aquí unos días antes.
      </p>
    );
  }
  return (
    <ol className="relative space-y-0">
      {data.timeline.map((t, i) => (
        <li key={t.id} className="grid grid-cols-[4rem_1rem_minmax(0,1fr)] gap-x-3">
          <span className="tabular text-olive pt-0.5 text-right font-semibold">{t.time}</span>
          <span aria-hidden className="relative flex justify-center">
            <span
              className={cn(
                "relative z-10 mt-1.5 size-3 rounded-full border-2",
                t.visibleToGuests ? "border-olive bg-olive" : "border-taupe bg-card",
              )}
            />
            {i < data.timeline.length - 1 ? <span className="bg-border absolute top-4 bottom-0 w-px" /> : null}
          </span>
          <div className="pb-5">
            <p className={cn("font-medium", !t.visibleToGuests && "text-muted-foreground")}>{t.title}</p>
            {t.description ? <p className="text-muted-foreground text-sm">{t.description}</p> : null}
            {!t.visibleToGuests ? (
              <p className="text-taupe-deep mt-0.5 text-xs font-medium">Preparativos del equipo</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function PhotosContent({ data }: { data: PortalDashboard }) {
  if (data.memory.url) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl sm:w-48">
          <Image
            src="/images/placeholders/gallery-02.svg"
            alt=""
            fill
            sizes="(min-width: 640px) 12rem, 100vw"
            className="object-cover"
          />
        </div>
        <div className="space-y-3">
          <p>Tu Memory Capsule ya está lista: fotos y mensajes de tus invitadas en un solo lugar.</p>
          <Button asChild size="xl">
            <a href={data.memory.url}>
              <Camera aria-hidden /> Ver mi Memory Capsule
            </a>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <p className="text-muted-foreground text-sm">
      Después de tu evento aquí encontrarás tu Memory Capsule: las fotos y los mensajes de tus invitadas, listos para
      guardar y compartir.
    </p>
  );
}

function ReviewSection({ data }: { data: PortalDashboard }) {
  if (data.review) {
    return (
      <SectionCard id="opinion" title="Gracias por tu opinión" icon={Star}>
        <div className="space-y-2">
          <p
            className="flex items-center gap-1"
            role="img"
            aria-label={`Calificaste con ${data.review.rating} de 5 estrellas`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                aria-hidden
                className={cn(
                  "size-6",
                  n <= data.review!.rating ? "fill-[#C6A15B] text-[#C6A15B]" : "text-muted-foreground/40",
                )}
              />
            ))}
          </p>
          {data.review.comment ? <p className="italic">“{data.review.comment}”</p> : null}
          <p className="text-muted-foreground text-sm">Leemos cada opinión con muchísimo cariño.</p>
        </div>
      </SectionCard>
    );
  }
  if (!data.permissions.canReview) return null;
  return (
    <SectionCard
      id="opinion"
      title="¿Cómo lo vivieron?"
      icon={Star}
      description="Tu opinión nos ayuda muchísimo y toma menos de un minuto."
      className="border-olive/30"
    >
      <ReviewForm token={data.token} />
    </SectionCard>
  );
}
