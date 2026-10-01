import Link from "next/link";
import type { LeadStatus } from "@prisma/client";
import { LEAD_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { LEAD_PIPELINE } from "../domain/lead-status";
import { leadFiltersToSearchParams, toggleStatus, type LeadFilters } from "../domain/lead-filters";

const DOT: Record<LeadStatus, string> = {
  NEW: "bg-info",
  CONTACTED: "bg-olive",
  QUALIFIED: "bg-warning",
  QUOTED: "bg-taupe",
  WON: "bg-success",
  LOST: "bg-muted-foreground/50",
};

/** Franja de conteos por estado. Cada chip agrega/quita el estado del filtro. */
export function LeadStatusSummary({
  counts,
  filters,
  view,
}: {
  counts: Record<LeadStatus, number>;
  filters: LeadFilters;
  view: "table" | "kanban";
}) {
  const total = LEAD_PIPELINE.reduce((sum, s) => sum + counts[s], 0);
  const extra = { view: view === "kanban" ? "kanban" : null };
  const href = (f: LeadFilters) => {
    const qs = leadFiltersToSearchParams(f, extra).toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };
  const chip =
    "flex min-w-[7.5rem] shrink-0 flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-olive/40 focus-visible:outline-2";
  const noneSelected = filters.statuses.length === 0;

  return (
    <nav aria-label="Leads por estado" className="-mx-1 mb-4">
      <ul className="flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        <li className="snap-start">
          <Link
            href={href({ ...filters, statuses: [] })}
            aria-current={noneSelected ? "true" : undefined}
            className={cn(chip, noneSelected ? "bg-sage-soft border-olive/40" : "bg-card")}
          >
            <span className="text-muted-foreground text-xs">Todos</span>
            <span className="tabular text-xl font-semibold">{total}</span>
          </Link>
        </li>
        {LEAD_PIPELINE.map((s) => {
          const active = filters.statuses.includes(s);
          return (
            <li key={s} className="snap-start">
              <Link
                href={href(toggleStatus(filters, s))}
                aria-current={active ? "true" : undefined}
                title={active ? `Quitar filtro “${LEAD_STATUS_LABELS[s]}”` : `Filtrar por “${LEAD_STATUS_LABELS[s]}”`}
                className={cn(chip, active ? "bg-sage-soft border-olive/40" : "bg-card")}
              >
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <span className={cn("size-2 rounded-full", DOT[s])} aria-hidden />
                  {LEAD_STATUS_LABELS[s]}
                </span>
                <span className="tabular text-xl font-semibold">{counts[s]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
