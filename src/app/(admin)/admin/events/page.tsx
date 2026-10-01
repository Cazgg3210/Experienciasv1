import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, PartyPopper, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination, parsePage } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  EVENT_PERIOD_LABELS,
  hasActiveFilters,
  parseEventFilters,
} from "@/features/events/domain/event-filters";
import { EVENTS_PAGE_SIZE, getEventFormOptions, listEvents } from "@/features/events/server/event-queries";
import { EventsFilters } from "@/features/events/components/events-filters";
import { EventsTable } from "@/features/events/components/events-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Eventos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Misma URL de filtros sin el parámetro de página. */
function firstPageHref(sp: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page" || v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/events?${qs}` : "/admin/events";
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("events:read_all", "/admin/events");
  const sp = await searchParams;
  const filters = parseEventFilters(sp);
  const page = parsePage(sp.page);
  const [{ rows, total }, options] = await Promise.all([listEvents(filters, page), getEventFormOptions()]);
  const canWrite = can(user.role, "events:write");
  const filtered = hasActiveFilters(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Eventos"
        description="Todas las celebraciones: fechas, clientas, invitadas confirmadas y saldos pendientes."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin/calendar">
                <CalendarDays aria-hidden />
                Calendario
              </Link>
            </Button>
            {canWrite ? (
              <Button asChild size="lg">
                <Link href="/admin/events/new">
                  <Plus aria-hidden />
                  Nuevo evento
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <EventsFilters
        filters={filters}
        experiences={options.experiences}
        serviceAreas={options.serviceAreas}
      />

      <section aria-labelledby="events-results" className="space-y-3">
        <h2 id="events-results" className="text-muted-foreground text-sm" aria-live="polite">
          {total === 1 ? "1 evento" : `${total} eventos`} ·{" "}
          {EVENT_PERIOD_LABELS[filters.period].toLowerCase()}
        </h2>
        {rows.length === 0 && total > 0 ? (
          <EmptyState
            icon={PartyPopper}
            title="Esta página ya no tiene eventos"
            description={`Hay ${total === 1 ? "1 evento" : `${total} eventos`} con estos filtros en páginas anteriores.`}
            action={
              <Button asChild variant="outline">
                <Link href={firstPageHref(sp)}>Ir a la primera página</Link>
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={PartyPopper}
              title="No hay eventos con estos filtros"
              description="Prueba con otro periodo, estado o término de búsqueda."
              action={
                <Button asChild variant="outline">
                  <Link href="/admin/events">Limpiar filtros</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PartyPopper}
              title="Aún no hay eventos próximos"
              description="Cuando una clienta pague su anticipo o registres un evento manual, aparecerá aquí."
              action={
                canWrite ? (
                  <Button asChild>
                    <Link href="/admin/events/new">
                      <Plus aria-hidden />
                      Registrar evento
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <EventsTable rows={rows} />
            <Pagination
              page={page}
              pageSize={EVENTS_PAGE_SIZE}
              total={total}
              basePath="/admin/events"
              searchParams={sp}
            />
          </>
        )}
      </section>
    </div>
  );
}
