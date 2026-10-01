import Link from "next/link";
import { Columns3, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { leadFiltersToSearchParams, type LeadFilters } from "../domain/lead-filters";

/** Alterna Tabla / Kanban conservando los filtros. */
export function LeadViewToggle({ view, filters }: { view: "table" | "kanban"; filters: LeadFilters }) {
  const tableQs = leadFiltersToSearchParams(filters).toString();
  const kanbanQs = leadFiltersToSearchParams(filters, { view: "kanban" }).toString();
  const item =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2";
  return (
    <nav aria-label="Vista de leads" className="bg-muted inline-flex rounded-lg p-0.5">
      <Link
        href={tableQs ? `/admin/leads?${tableQs}` : "/admin/leads"}
        aria-current={view === "table" ? "page" : undefined}
        className={cn(item, view === "table" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground")}
      >
        <Rows3 className="size-4" aria-hidden />
        Tabla
      </Link>
      <Link
        href={`/admin/leads?${kanbanQs}`}
        aria-current={view === "kanban" ? "page" : undefined}
        className={cn(item, view === "kanban" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground")}
      >
        <Columns3 className="size-4" aria-hidden />
        Kanban
      </Link>
    </nav>
  );
}
