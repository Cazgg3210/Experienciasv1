import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarHeart, ChevronRight, Clock, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatLongDate, formatShortDate } from "@/lib/dates";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES, STAFF_FUNCTION_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { isBackofficeRole } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { daysUntilDateOnly, ucfirst } from "@/features/operations/domain/production";
import { listMyEvents, type MyEventCard } from "@/features/staff/server/portal-queries";
import { ProgressBar } from "@/features/operations/components/progress-bar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis eventos" };

function whenLabel(eventDate: Date): string {
  const d = daysUntilDateOnly(eventDate);
  if (d <= 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d < 7) return `En ${d} días`;
  return formatShortDate(eventDate);
}

export default async function StaffHomePage() {
  const user = await requirePagePermission("events:read_assigned", "/staff");
  let data: Awaited<ReturnType<typeof listMyEvents>>;
  try {
    data = await listMyEvents(user);
  } catch (error) {
    // Estado de error inline (este segmento no tiene error.tsx propio): mensaje amable, sin detalles.
    logger.error("staff.portal_home_failed", { error, userId: user.id });
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Mis próximos eventos</h1>
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar tus eventos"
          description="Revisa tu conexión e inténtalo de nuevo en un momento."
          action={
            <Link
              href="/staff"
              className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-full px-7 text-base font-medium"
            >
              Reintentar
            </Link>
          }
        />
      </div>
    );
  }
  const { member, upcoming, past } = data;
  const firstName = (member?.name ?? user.name).split(" ")[0];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="eyebrow">Portal de staff</p>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Mis próximos eventos</h1>
        <p className="text-muted-foreground text-sm">
          Hola, {firstName}. Aquí ves dónde te toca, tu horario y tus tareas de cada celebración.
        </p>
      </header>

      {!member ? (
        <EmptyState
          icon={CalendarHeart}
          title="Tu perfil de staff aún no está vinculado"
          description={
            isBackofficeRole(user.role)
              ? "Tu cuenta es de administración: los eventos asignados al equipo se gestionan desde el panel de Operaciones."
              : "Pide a coordinación que vincule tu acceso con tu perfil del equipo para ver tus eventos."
          }
          action={
            isBackofficeRole(user.role) ? (
              <Link href="/admin/operations" className="text-olive text-sm font-medium underline-offset-4 hover:underline">
                Ir a Operaciones
              </Link>
            ) : undefined
          }
        />
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarHeart}
          title="Por ahora no tienes eventos próximos"
          description="Cuando te asignen a una celebración te avisaremos por correo o WhatsApp y aparecerá aquí."
        />
      ) : (
        <ul className="space-y-4" aria-label="Eventos próximos">
          {upcoming.map((e) => (
            <li key={e.id}>
              <EventCard e={e} />
            </li>
          ))}
        </ul>
      )}

      {member && past.length > 0 ? (
        <details className="group rounded-2xl border">
          <summary className="hover:bg-muted/40 flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 font-medium">
            Eventos pasados ({past.length})
            <ChevronRight className="text-muted-foreground size-4 transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <ul className="divide-y border-t">
            {past.map((e) => (
              <li key={e.id}>
                <Link href={`/staff/events/${e.id}`} className="hover:bg-muted/40 flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {formatShortDate(e.eventDate)} · {e.roles.map((r) => STAFF_FUNCTION_LABELS[r.function]).join(", ")}
                    </span>
                  </span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function EventCard({ e }: { e: MyEventCard }) {
  return (
    <Link
      href={`/staff/events/${e.id}`}
      className="bg-card focus-visible:ring-ring/50 block space-y-4 rounded-2xl border p-5 shadow-xs transition-colors outline-none hover:border-olive/40 focus-visible:ring-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="eyebrow">{whenLabel(e.eventDate)}</p>
          <h2 className="font-heading text-2xl leading-tight font-semibold">{e.title}</h2>
          <p className="text-muted-foreground text-sm">{ucfirst(formatLongDate(e.eventDate))}</p>
        </div>
        <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Clock className="text-olive size-4 shrink-0" aria-hidden />
          Evento {e.timeLabel}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="text-olive size-4 shrink-0" aria-hidden />
          {e.neighborhood ?? "Colonia por confirmar"}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Mi función y horario">
        {e.roles.map((r, i) => (
          <li key={i} className="bg-sage-soft text-olive rounded-full px-3 py-1 text-sm font-medium">
            {STAFF_FUNCTION_LABELS[r.function]} · {r.schedule}
            {!r.confirmed ? <span className="text-warning"> · por confirmar</span> : null}
          </li>
        ))}
      </ul>
      <div className="space-y-1">
        <p className="text-xs font-medium">
          Mis tareas {e.openTasks > 0 ? <span className="text-muted-foreground font-normal">· {e.openTasks} pendientes</span> : null}
        </p>
        {e.myTasks.total > 0 ? (
          <ProgressBar progress={e.myTasks} label={`Mis tareas de ${e.title}`} />
        ) : (
          <p className="text-muted-foreground text-xs">Sin tareas asignadas por ahora.</p>
        )}
      </div>
      <span className="text-olive inline-flex items-center gap-1 text-sm font-medium">
        Ver detalles y checklist
        <ChevronRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
