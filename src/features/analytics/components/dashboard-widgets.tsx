import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { cn } from "@/lib/utils";
import { daysUntil, formatShortDate, localTime } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import {
  CHECKLIST_PHASE_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  OCCASION_LABELS,
} from "@/lib/labels";
import type {
  getCriticalPending,
  getIncompleteRsvp,
  getInventoryConflicts,
  getNextSevenDays,
  getPendingPayments,
} from "../server/dashboard-queries";
import { formatPercentBps } from "../domain/metrics";

/** Tarjeta contenedora de un widget del dashboard. */
export function Widget({
  title,
  icon: Icon,
  count,
  tone = "neutral",
  href,
  hrefLabel,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  count?: number;
  tone?: "neutral" | "warning" | "danger";
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `w-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn("bg-card flex min-w-0 flex-col rounded-2xl border p-4 shadow-xs sm:p-5", className)}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id={id} className="font-heading flex items-center gap-2 text-xl font-semibold">
          <span className="bg-sage-soft text-olive flex size-8 items-center justify-center rounded-full">
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
          {count != null && count > 0 ? (
            <span
              className={cn(
                "tabular rounded-full px-2 py-0.5 font-sans text-xs font-semibold",
                tone === "danger" && "bg-destructive/10 text-destructive",
                tone === "warning" && "bg-warning/10 text-warning",
                tone === "neutral" && "bg-muted text-muted-foreground",
              )}
            >
              {count}
              <span className="sr-only"> pendientes</span>
            </span>
          ) : null}
        </h2>
        {href ? (
          <Link
            href={href}
            className="text-olive inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline"
          >
            {hrefLabel ?? "Ver todo"} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function AllGood({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm">
      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Barra de progreso accesible (0-100 %). */
export function Meter({ label, bps, className }: { label: string; bps: number | null; className?: string }) {
  const value = bps == null ? 0 : Math.max(0, Math.min(100, bps / 100));
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-muted-foreground mb-1 flex justify-between gap-2 text-xs">
        <span>{label}</span>
        <span className="tabular text-foreground font-medium">
          {bps == null ? "—" : formatPercentBps(bps)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bps == null ? undefined : Math.round(value)}
        aria-valuetext={bps == null ? "Sin datos" : formatPercentBps(bps)}
        className="bg-muted h-1.5 overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full",
            value >= 80 ? "bg-chart-1" : value >= 40 ? "bg-chart-2" : "bg-chart-5",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function relativeDay(startsAt: Date, now: Date = new Date()): string {
  const d = daysUntil(startsAt, now);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d < 0) return `Hace ${Math.abs(d)} días`;
  return `En ${d} días`;
}

// ============================================================================
// Próximos 7 días
// ============================================================================

export function NextSevenDaysList({ events }: { events: Awaited<ReturnType<typeof getNextSevenDays>> }) {
  if (events.length === 0) return <AllGood>No hay eventos en los próximos 7 días.</AllGood>;
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="bg-ivory/60 rounded-xl border p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-olive text-xs font-semibold tracking-wide uppercase">
                {relativeDay(e.startsAt)} · {formatShortDate(e.eventDate)} · {localTime(e.startsAt)} h
              </p>
              <Link
                href={`/admin/events/${e.id}`}
                className="font-heading block truncate text-lg font-semibold hover:underline"
              >
                {e.title}
              </Link>
              <p className="text-muted-foreground text-xs">
                {e.customerName} · {e.guestCount} invitadas
                {e.staffCount === 0 ? (
                  <span className="text-destructive font-medium"> · sin staff asignado</span>
                ) : (
                  ` · ${e.staffCount} staff`
                )}
              </p>
            </div>
            <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Meter label={e.guestsInvited > 0 ? `RSVP (${e.guestsInvited})` : "RSVP"} bps={e.rsvpBps} />
            <Meter label="Checklist" bps={e.checklistBps} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Pendientes críticos
// ============================================================================

function Group({
  title,
  children,
  more = 0,
  moreHref,
}: {
  title: string;
  children: React.ReactNode;
  /** Elementos que no caben en la lista (se muestran como enlace "y N más") */
  more?: number;
  moreHref?: string;
}) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-1.5 font-sans text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <ul className="divide-y rounded-xl border">
        {children}
        {more > 0 ? (
          <li className="text-muted-foreground px-3 py-2 text-xs">
            {moreHref ? (
              <Link href={moreHref} className="hover:text-foreground underline-offset-2 hover:underline">
                y {more} más…
              </Link>
            ) : (
              `y ${more} más…`
            )}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Row({
  href,
  title,
  meta,
  right,
}: {
  href: string;
  title: string;
  meta: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <Link href={href} className="block truncate text-sm font-medium hover:underline">
          {title}
        </Link>
        <p className="text-muted-foreground truncate text-xs">{meta}</p>
      </div>
      {right ? <div className="shrink-0 text-right text-xs">{right}</div> : null}
    </li>
  );
}

export function CriticalPendingList({
  data,
  now = new Date(),
}: {
  data: Awaited<ReturnType<typeof getCriticalPending>>;
  now?: Date;
}) {
  if (data.total === 0) return <AllGood>Sin pendientes críticos. ¡Todo bajo control!</AllGood>;
  const hoursLeft = (d: Date | null) =>
    d ? Math.max(0, Math.round((d.getTime() - now.getTime()) / 3_600_000)) : 0;
  const hoursAgo = (d: Date) => Math.round((now.getTime() - d.getTime()) / 3_600_000);
  return (
    <div className="space-y-4">
      {data.overdueChecklist.count > 0 ? (
        <Group
          title={`Checklist vencido (${data.overdueChecklist.count})`}
          more={data.overdueChecklist.count - data.overdueChecklist.items.length}
          moreHref="/admin/operations"
        >
          {data.overdueChecklist.items.map((i) => (
            <Row
              key={i.id}
              href={`/admin/events/${i.event.id}`}
              title={i.title}
              meta={`${i.event.title} · ${CHECKLIST_PHASE_LABELS[i.phase]}`}
              right={
                <span className="text-destructive font-medium">
                  venció {i.dueAt ? formatShortDate(i.dueAt) : ""}
                </span>
              }
            />
          ))}
        </Group>
      ) : null}
      {data.expiringQuotes.count > 0 ? (
        <Group
          title={`Cotizaciones por vencer < 48 h (${data.expiringQuotes.count})`}
          more={data.expiringQuotes.count - data.expiringQuotes.items.length}
          moreHref="/admin/quotes"
        >
          {data.expiringQuotes.items.map((q) => (
            <Row
              key={q.id}
              href={`/admin/quotes/${q.id}`}
              title={`${q.code} · ${q.title}`}
              meta={`${q.customer.name} · ${formatMXN(q.totalCents)}`}
              right={<span className="text-warning font-medium">en {hoursLeft(q.validUntil)} h</span>}
            />
          ))}
        </Group>
      ) : null}
      {data.staleLeads.count > 0 ? (
        <Group
          title={`Leads nuevos sin contactar > 24 h (${data.staleLeads.count})`}
          more={data.staleLeads.count - data.staleLeads.items.length}
          moreHref="/admin/leads"
        >
          {data.staleLeads.items.map((l) => (
            <Row
              key={l.id}
              href={`/admin/leads/${l.id}`}
              title={l.name}
              meta={`${l.code} · ${OCCASION_LABELS[l.occasion]}`}
              right={<span className="text-warning font-medium">hace {hoursAgo(l.createdAt)} h</span>}
            />
          ))}
        </Group>
      ) : null}
      {data.unstaffedEvents.length > 0 ? (
        <Group title={`Eventos en < 7 días sin staff (${data.unstaffedEvents.length})`}>
          {data.unstaffedEvents.map((e) => (
            <Row
              key={e.id}
              href={`/admin/events/${e.id}`}
              title={e.title}
              meta={`${relativeDay(e.startsAt, now)} · ${localTime(e.startsAt)} h`}
              right={
                <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
              }
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

// ============================================================================
// Inventario en conflicto
// ============================================================================

export function InventoryConflictsList({
  conflicts,
}: {
  conflicts: Awaited<ReturnType<typeof getInventoryConflicts>>;
}) {
  if (conflicts.length === 0)
    return <AllGood>Sin sobre-reservas de inventario en los próximos 30 días.</AllGood>;
  return (
    <ul className="divide-y rounded-xl border">
      {conflicts.slice(0, 8).map((c) => (
        <li key={`${c.dateKey}-${c.itemId}`} className="space-y-0.5 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium" title={c.itemName}>
              {c.itemName}
            </p>
            <span className="bg-destructive/10 text-destructive shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
              Faltan {c.shortage}
            </span>
          </div>
          <p className="text-muted-foreground tabular text-xs">
            {formatShortDate(c.dateKey)} · {c.reserved} reservadas / {c.available} disponibles
          </p>
          <p className="text-muted-foreground text-xs">
            {c.events.map((e, i) => (
              <span key={e.id}>
                {i > 0 ? ", " : ""}
                <Link
                  href={`/admin/events/${e.id}`}
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  {e.title}
                </Link>{" "}
                ({e.quantity})
              </span>
            ))}
          </p>
        </li>
      ))}
      {conflicts.length > 8 ? (
        <li className="text-muted-foreground px-3 py-2 text-xs">
          y {conflicts.length - 8} conflicto(s) más…
        </li>
      ) : null}
    </ul>
  );
}

// ============================================================================
// Pagos pendientes
// ============================================================================

export function PendingPaymentsList({
  data,
  now = new Date(),
}: {
  data: Awaited<ReturnType<typeof getPendingPayments>>;
  now?: Date;
}) {
  if (data.deposits.length === 0 && data.balances.length === 0) {
    return <AllGood>Sin anticipos pendientes ni saldos por vencer esta semana.</AllGood>;
  }
  return (
    <div className="space-y-4">
      {data.deposits.length > 0 ? (
        <Group title={`Anticipo pendiente (${data.deposits.length})`}>
          {data.deposits.map((d) => (
            <Row
              key={d.id}
              href={`/admin/events/${d.id}/financials`}
              title={d.title}
              meta={`${d.customerName} · evento ${formatShortDate(d.eventDate)}`}
              right={<span className="tabular font-semibold">{formatMXN(d.pendingCents)}</span>}
            />
          ))}
        </Group>
      ) : null}
      {data.balances.length > 0 ? (
        <Group title={`Saldos que vencen en 7 días (${data.balances.length})`}>
          {data.balances.map((b) => (
            <Row
              key={b.id}
              href={`/admin/events/${b.id}/financials`}
              title={b.title}
              meta={`${b.customerName} · ${b.dueAt ? `vence ${formatShortDate(b.dueAt)}` : "sin fecha límite"}`}
              right={
                <>
                  <span className="tabular block font-semibold">{formatMXN(b.balanceCents)}</span>
                  {b.overdue ? (
                    <span className="text-destructive font-medium">vencido</span>
                  ) : b.dueAt ? (
                    <span className="text-muted-foreground">{relativeDay(b.dueAt, now).toLowerCase()}</span>
                  ) : null}
                </>
              }
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

// ============================================================================
// RSVP incompleto
// ============================================================================

export function IncompleteRsvpList({ events }: { events: Awaited<ReturnType<typeof getIncompleteRsvp>> }) {
  if (events.length === 0)
    return <AllGood>Las invitadas de los próximos 14 días ya están respondiendo.</AllGood>;
  return (
    <ul className="divide-y rounded-xl border">
      {events.map((e) => (
        <li key={e.id} className="px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/admin/events/${e.id}/guests`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {e.title}
              </Link>
              <p className="text-muted-foreground text-xs">
                {relativeDay(e.startsAt)} · {e.pending} de {e.invited} sin responder
              </p>
            </div>
            <span className="text-warning tabular shrink-0 text-sm font-semibold">
              {formatPercentBps(e.pendingBps)} pendiente
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
