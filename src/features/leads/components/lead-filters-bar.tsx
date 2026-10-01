import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, toOptions } from "@/lib/labels";
import { LEAD_PIPELINE } from "../domain/lead-status";
import {
  LEAD_DATE_FIELD_LABELS,
  LEAD_FLAG_LABELS,
  LEAD_FLAG_VALUES,
  LEAD_SORT_LABELS,
  UNASSIGNED,
  activeFilterCount,
  type LeadFilters,
} from "../domain/lead-filters";
import { NativeSelect } from "./native-select";

const chip =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-muted has-[:checked]:border-olive/50 has-[:checked]:bg-sage-soft has-[:checked]:text-olive has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

/**
 * Filtros por searchParams (formulario GET: funciona sin JS y deja la URL compartible).
 */
export function LeadFiltersBar({
  filters,
  view,
  assignees,
}: {
  filters: LeadFilters;
  view: "table" | "kanban";
  assignees: Array<{ id: string; name: string }>;
}) {
  const count = activeFilterCount(filters);
  const clearHref = view === "kanban" ? "/admin/leads?view=kanban" : "/admin/leads";
  return (
    <form method="get" action="/admin/leads" role="search" aria-label="Buscar y filtrar leads" className="mb-5 space-y-3">
      {view === "kanban" ? <input type="hidden" name="view" value="kanban" /> : null}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="leads-q" className="sr-only">
            Buscar leads
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input
            id="leads-q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Nombre, email, teléfono o código"
            className="h-9 pl-8"
            maxLength={100}
          />
        </div>
        <Button type="submit" size="lg">
          Buscar
        </Button>
      </div>

      <details open={count > 0} className="group bg-card rounded-xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {count ? (
              <span className="bg-olive text-ivory tabular rounded-full px-2 py-0.5 text-xs">
                {count}
                <span className="sr-only"> activos</span>
              </span>
            ) : null}
          </span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="grid gap-5 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset className="sm:col-span-2 lg:col-span-4">
            <legend className="mb-2 text-sm font-medium">Estado</legend>
            <div className="flex flex-wrap gap-2">
              {LEAD_PIPELINE.map((s) => (
                <label key={s} className={chip}>
                  <input
                    type="checkbox"
                    name="status"
                    value={s}
                    defaultChecked={filters.statuses.includes(s)}
                    className="accent-olive size-3.5"
                  />
                  {LEAD_STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="leads-source" className="text-sm font-medium">
              Origen
            </label>
            <NativeSelect id="leads-source" name="source" defaultValue={filters.source ?? ""}>
              <option value="">Todos</option>
              {toOptions(LEAD_SOURCE_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="leads-assigned" className="text-sm font-medium">
              Asignada a
            </label>
            <NativeSelect id="leads-assigned" name="assignedTo" defaultValue={filters.assignedTo ?? ""}>
              <option value="">Todo el equipo</option>
              <option value={UNASSIGNED}>Sin asignar</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="leads-sort" className="text-sm font-medium">
              Orden
            </label>
            <NativeSelect id="leads-sort" name="sort" defaultValue={filters.sort}>
              {Object.entries(LEAD_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">Señales</legend>
            <div className="flex flex-wrap gap-2">
              {LEAD_FLAG_VALUES.map((f) => (
                <label key={f} className={chip}>
                  <input
                    type="checkbox"
                    name="flag"
                    value={f}
                    defaultChecked={filters.flags.includes(f)}
                    className="accent-olive size-3.5"
                  />
                  {LEAD_FLAG_LABELS[f]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3 lg:col-span-4">
            <legend className="mb-1.5 text-sm font-medium">Rango de fechas</legend>
            <div className="space-y-1.5">
              <label htmlFor="leads-date-field" className="text-muted-foreground text-xs">
                Aplicar a
              </label>
              <NativeSelect id="leads-date-field" name="dateField" defaultValue={filters.dateField}>
                {Object.entries(LEAD_DATE_FIELD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="leads-from" className="text-muted-foreground text-xs">
                Desde
              </label>
              <Input id="leads-from" name="from" type="date" defaultValue={filters.from ?? ""} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="leads-to" className="text-muted-foreground text-xs">
                Hasta
              </label>
              <Input id="leads-to" name="to" type="date" defaultValue={filters.to ?? ""} className="h-9" />
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost" size="lg">
            <Link href={clearHref}>Limpiar filtros</Link>
          </Button>
          <Button type="submit" size="lg">
            Aplicar filtros
          </Button>
        </div>
      </details>
    </form>
  );
}
