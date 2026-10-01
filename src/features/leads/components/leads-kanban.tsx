import Link from "next/link";
import { CalendarDays, UsersRound } from "lucide-react";
import { LEAD_STATUS_LABELS } from "@/lib/labels";
import { formatShortDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { occasionText } from "../domain/lead-export";
import { relativeTime } from "../domain/format";
import type { KanbanColumn } from "../server/lead-service";
import { LeadFlagBadges, LeadStatusBadge } from "./lead-badges";
import { LeadStatusMenu } from "./lead-status-menu";

/** Kanban por estado. Las tarjetas se mueven con "Mover" (respeta leadStatusMachine). */
export function LeadsKanban({
  columns,
  canWrite,
  now = new Date(),
}: {
  columns: KanbanColumn[];
  canWrite: boolean;
  now?: Date;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" role="region" aria-label="Tablero de leads por estado" tabIndex={0}>
      <div className="flex snap-x snap-mandatory gap-4">
        {columns.map((col) => (
          <section
            key={col.status}
            aria-labelledby={`col-${col.status}`}
            className="bg-sand-soft/60 flex w-[82vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl border sm:w-72"
          >
            <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
              <h2 id={`col-${col.status}`} className="font-sans text-sm font-semibold">
                <LeadStatusBadge status={col.status} />
              </h2>
              <span className="text-muted-foreground tabular text-xs">
                {col.items.length < col.total ? `${col.items.length} de ${col.total}` : col.total}
              </span>
            </header>
            <ul className="flex min-h-24 flex-col gap-2 px-2 pb-3">
              {col.items.length === 0 ? (
                <li className="text-muted-foreground rounded-xl border border-dashed px-3 py-6 text-center text-xs">
                  Sin leads en “{LEAD_STATUS_LABELS[col.status]}”
                </li>
              ) : (
                col.items.map((l) => (
                  <li key={l.id} className="bg-card rounded-xl border p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/admin/leads/${l.id}`} className="block truncate font-medium hover:underline">
                          {l.name}
                        </Link>
                        <p className="text-muted-foreground font-mono text-[11px]">{l.code}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[11px]">{relativeTime(l.createdAt, now)}</span>
                    </div>
                    <p className="mt-1.5 truncate text-xs">
                      {occasionText(l.occasion, l.occasionOther)}
                      {l.experience ? <span className="text-muted-foreground"> · {l.experience.name}</span> : null}
                    </p>
                    <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" aria-hidden />
                        {l.eventDate ? formatShortDate(l.eventDate) : "Sin fecha"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UsersRound className="size-3" aria-hidden />
                        {l.guestCount ?? "—"}
                      </span>
                      {l.budgetRange || l.estimatedTotalCents != null ? (
                        <span>{l.budgetRange?.label ?? `≈ ${formatMXN(l.estimatedTotalCents)}`}</span>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <LeadFlagBadges outOfArea={l.outOfArea} specialRequest={l.specialRequest} />
                    </div>
                    <div className={cn("mt-2 flex items-center justify-between gap-2 border-t pt-2")}>
                      <span className="text-muted-foreground truncate text-[11px]">{l.assignedTo?.name ?? "Sin asignar"}</span>
                      {canWrite ? <LeadStatusMenu leadId={l.id} leadName={l.name} status={l.status} /> : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
