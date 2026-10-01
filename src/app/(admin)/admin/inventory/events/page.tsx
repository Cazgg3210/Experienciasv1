import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarRange, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { formatShortDate } from "@/lib/dates";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES } from "@/lib/labels";
import { requirePagePermission } from "@/server/auth/session";
import { listInventoryEvents } from "@/features/inventory/server/queries";

export const metadata: Metadata = { title: "Reservas por evento" };
export const dynamic = "force-dynamic";

export default async function InventoryEventsPage() {
  await requirePagePermission("inventory:read");
  const events = await listInventoryEvents({ days: 60 });

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/inventory", label: "Inventario" }}
        title="Reservas por evento"
        description="Próximos 60 días y eventos recientes con piezas que aún no regresan."
      />
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No hay eventos próximos"
          description="Cuando se confirme un evento, sus piezas se reservan automáticamente desde la experiencia y los add-ons."
        />
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {events.map((e) => {
            const active = e.counts.RESERVED + e.counts.CHECKED_OUT;
            return (
              <li key={e.id}>
                <Link
                  href={`/admin/inventory/events/${e.id}`}
                  className="hover:bg-muted/50 focus-visible:bg-muted/50 flex items-center gap-4 px-4 py-3 outline-none"
                >
                  <div className="bg-sand-soft text-charcoal flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 text-center">
                    <span className="text-[11px] uppercase">{formatShortDate(e.eventDate).split(" ")[1]}</span>
                    <span className="font-heading text-xl leading-none font-semibold">{formatShortDate(e.eventDate).split(" ")[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      <span className="font-mono">{e.code}</span> · {e.guestCount} invitadas
                      {e.experienceName ? ` · ${e.experienceName}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
                      {active === 0 && e.counts.RETURNED === 0 ? (
                        <StatusBadge tone="warning">Sin reservas</StatusBadge>
                      ) : (
                        <StatusBadge tone="info">{active} {active === 1 ? "artículo reservado" : "artículos reservados"}</StatusBadge>
                      )}
                      {e.counts.CHECKED_OUT ? <StatusBadge tone="brand">{e.counts.CHECKED_OUT} fuera de bodega</StatusBadge> : null}
                      {e.conflictItems ? (
                        <StatusBadge tone="danger">
                          <AlertTriangle className="size-3" aria-hidden /> {e.conflictItems} con faltante
                        </StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
