import Link from "next/link";
import { CalendarX2, Plus } from "lucide-react";
import type { EventStatus } from "@prisma/client";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  type Tone,
} from "@/lib/labels";
import { localTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CalendarMonthData, CalendarEvent } from "../server/calendar-queries";
import { GRID_WEEKDAYS, dayCapacityBadge } from "../domain/calendar-month";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CHIP_TONES: Record<Tone, string> = {
  neutral: "bg-sand-soft text-charcoal border-sand hover:bg-sand",
  info: "bg-info/10 text-info border-info/25 hover:bg-info/15",
  success: "bg-success/10 text-success border-success/25 hover:bg-success/15",
  warning: "bg-warning/10 text-warning border-warning/30 hover:bg-warning/15",
  danger: "bg-destructive/10 text-destructive border-destructive/25 hover:bg-destructive/15",
  brand: "bg-sage-soft text-olive border-sage/40 hover:bg-sage/30",
  muted: "bg-muted text-muted-foreground border-border hover:bg-muted/70",
};

function chipClass(status: EventStatus) {
  return CHIP_TONES[EVENT_STATUS_TONES[status]];
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return format(new Date(y!, m! - 1, d!), "EEEE d 'de' MMMM", { locale: es });
}

function EventChip({ e, compact = false }: { e: CalendarEvent; compact?: boolean }) {
  return (
    <Link
      href={`/admin/events/${e.id}`}
      className={cn(
        "focus-visible:ring-ring/50 block rounded-md border px-1.5 py-1 text-xs leading-tight transition-colors outline-none focus-visible:ring-3",
        chipClass(e.status),
      )}
      title={`${e.title} · ${EVENT_STATUS_LABELS[e.status]} · ${e.customerName}`}
    >
      <span className="tabular font-semibold">{localTime(e.startsAt)}</span>{" "}
      <span className={cn(compact ? "line-clamp-1" : "line-clamp-2")}>{e.title}</span>
      <span className="sr-only">, {EVENT_STATUS_LABELS[e.status]}</span>
    </Link>
  );
}

/** Cuadrícula mensual (desktop) + agenda (móvil). */
export function CalendarMonthView({
  data,
  todayKey,
  canCreate = false,
}: {
  data: CalendarMonthData;
  todayKey: string;
  canCreate?: boolean;
}) {
  const monthDays = data.weeks.flat().filter((c) => c.inMonth);
  const agendaDays = monthDays.filter((c) => {
    const events = data.eventsByDay[c.dateKey] ?? [];
    const st = data.availabilityByDay[c.dateKey]?.status;
    return events.length > 0 || st === "BLOCKED";
  });

  return (
    <>
      {/* Desktop: cuadrícula de 7 columnas */}
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Calendario de eventos y disponibilidad</caption>
          <thead>
            <tr className="bg-sand-soft/60">
              {GRID_WEEKDAYS.map((wd) => (
                <th
                  key={wd}
                  scope="col"
                  className="text-muted-foreground px-2 py-2 text-left text-xs font-semibold"
                >
                  <abbr title={WEEKDAY_LABELS[wd]} className="no-underline">
                    {WEEKDAY_SHORT[wd]}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((week) => (
              <tr key={week[0]!.dateKey} className="border-t">
                {week.map((cell) => {
                  const events = data.eventsByDay[cell.dateKey] ?? [];
                  const day = data.availabilityByDay[cell.dateKey];
                  const badge = cell.inMonth && day ? dayCapacityBadge(day) : null;
                  const isToday = cell.dateKey === todayKey;
                  const closed = day?.status === "CLOSED" || day?.status === "BLOCKED";
                  const canAdd = canCreate && cell.inMonth && !!day && day.status !== "PAST" && !closed;
                  return (
                    <td
                      key={cell.dateKey}
                      className={cn(
                        "h-32 border-l p-1.5 align-top first:border-l-0 lg:h-36",
                        !cell.inMonth && "bg-muted/30",
                        cell.inMonth &&
                          closed &&
                          "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_7px)]",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-1">
                        <span className="flex items-center gap-0.5">
                          <span
                            className={cn(
                              "tabular inline-flex size-7 items-center justify-center rounded-full text-sm",
                              !cell.inMonth && "text-muted-foreground/60",
                              isToday && "bg-olive font-semibold text-white",
                            )}
                          >
                            <span className="sr-only">{dayLabel(cell.dateKey)}</span>
                            <span aria-hidden>{cell.day}</span>
                          </span>
                          {canAdd ? (
                            <Link
                              href={`/admin/events/new?date=${cell.dateKey}`}
                              className="text-muted-foreground hover:bg-muted hover:text-olive focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3"
                              aria-label={`Nuevo evento el ${dayLabel(cell.dateKey)}`}
                              title="Nuevo evento este día"
                            >
                              <Plus className="size-3.5" aria-hidden />
                            </Link>
                          ) : null}
                        </span>
                        {badge ? (
                          <StatusBadge tone={badge.tone} dot={false} className="h-5 px-1.5 text-[11px]">
                            {badge.label}
                          </StatusBadge>
                        ) : null}
                      </div>
                      {events.length ? (
                        <ul className="mt-1 space-y-1">
                          {events.slice(0, 3).map((e) => (
                            <li key={e.id}>
                              <EventChip e={e} compact={events.length > 1} />
                            </li>
                          ))}
                          {events.length > 3 ? (
                            <li>
                              <Link
                                href={`/admin/events?period=all&from=${cell.dateKey}&to=${cell.dateKey}`}
                                className="text-muted-foreground hover:text-olive focus-visible:ring-ring/50 rounded px-1 text-xs underline-offset-2 outline-none hover:underline focus-visible:ring-3"
                              >
                                +{events.length - 3} más
                                <span className="sr-only"> el {dayLabel(cell.dateKey)}</span>
                              </Link>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: agenda */}
      <div className="md:hidden">
        {agendaDays.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Sin eventos este mes"
            description="Usa las flechas para ver otros meses o registra un evento nuevo."
          />
        ) : (
          <ol className="space-y-3" aria-label="Agenda del mes">
            {agendaDays.map((cell) => {
              const events = data.eventsByDay[cell.dateKey] ?? [];
              const day = data.availabilityByDay[cell.dateKey];
              const badge = day ? dayCapacityBadge(day) : null;
              return (
                <li key={cell.dateKey} className="bg-card rounded-xl border p-3 shadow-xs">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3
                      className={cn(
                        "text-sm font-semibold first-letter:uppercase",
                        cell.dateKey === todayKey && "text-olive",
                      )}
                    >
                      {dayLabel(cell.dateKey)}
                      {cell.dateKey === todayKey ? " · hoy" : ""}
                    </h3>
                    {badge ? (
                      <StatusBadge tone={badge.tone} dot={false}>
                        {badge.label}
                      </StatusBadge>
                    ) : null}
                  </div>
                  {events.length ? (
                    <ul className="space-y-2">
                      {events.map((e) => (
                        <li key={e.id}>
                          <Link
                            href={`/admin/events/${e.id}`}
                            className={cn(
                              "focus-visible:ring-ring/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3",
                              chipClass(e.status),
                            )}
                          >
                            <span className="min-w-0">
                              <span className="tabular font-semibold">{localTime(e.startsAt)}</span>{" "}
                              <span className="font-medium">{e.title}</span>
                              <span className="block truncate text-xs opacity-80">
                                {e.customerName} · {e.guestCount} invitadas
                                {e.zoneName ? ` · ${e.zoneName}` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-medium">
                              {EVENT_STATUS_LABELS[e.status]}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">{day?.reason ?? "Día bloqueado."}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}

/** Leyenda de colores por estado. */
export function CalendarLegend() {
  const shown: EventStatus[] = [
    "INQUIRY",
    "PENDING_PAYMENT",
    "CONFIRMED",
    "PLANNING",
    "READY",
    "IN_PROGRESS",
    "COMPLETED",
  ];
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Leyenda de estados">
      {shown.map((s) => (
        <li key={s}>
          <StatusBadge tone={EVENT_STATUS_TONES[s]}>{EVENT_STATUS_LABELS[s]}</StatusBadge>
        </li>
      ))}
    </ul>
  );
}
