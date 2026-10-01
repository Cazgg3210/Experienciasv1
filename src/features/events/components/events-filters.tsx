import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_STATUS_LABELS } from "@/lib/labels";
import {
  EVENT_PERIOD_LABELS,
  EVENT_STATUSES,
  hasActiveFilters,
  type EventFilters,
} from "../domain/event-filters";
import { inputSizeClass, nativeSelectClass } from "./form-styles";

type Option = { id: string; name: string; active: boolean };

/**
 * Filtros del listado como formulario GET (funciona sin JavaScript y conserva la URL compartible).
 * Búsqueda, periodo y estados siempre visibles; fechas, experiencia y zona en una sección plegable
 * (abierta si alguno está activo) para no empujar los resultados en móvil.
 */
export function EventsFilters({
  filters,
  experiences,
  serviceAreas,
}: {
  filters: EventFilters;
  experiences: Option[];
  serviceAreas: Option[];
}) {
  const active = hasActiveFilters(filters);
  const advancedActive = !!(filters.from || filters.to || filters.experienceId || filters.serviceAreaId);
  const labelCls = "text-sm font-medium";
  return (
    <form
      method="get"
      action="/admin/events"
      role="search"
      aria-label="Filtrar eventos"
      className="bg-card space-y-4 rounded-xl border p-4 shadow-xs"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-1.5">
          <label htmlFor="ev-q" className={labelCls}>
            Buscar
          </label>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="ev-q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder="Código, título o clienta"
              className={`${inputSizeClass} pl-8`}
              maxLength={80}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ev-period" className={labelCls}>
            Periodo
          </label>
          <select id="ev-period" name="period" defaultValue={filters.period} className={nativeSelectClass}>
            {(Object.keys(EVENT_PERIOD_LABELS) as Array<keyof typeof EVENT_PERIOD_LABELS>).map((p) => (
              <option key={p} value={p}>
                {EVENT_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className={`${labelCls} mb-2`}>Estado</legend>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {EVENT_STATUSES.map((s) => (
            <label
              key={s}
              className="has-[:checked]:border-olive/50 has-[:checked]:bg-sage-soft has-[:checked]:text-olive has-[:focus-visible]:ring-ring/50 inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm whitespace-nowrap transition-colors has-[:focus-visible]:ring-3"
            >
              <input
                type="checkbox"
                name="status"
                value={s}
                defaultChecked={filters.statuses.includes(s)}
                className="accent-olive size-4"
              />
              {EVENT_STATUS_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <details open={advancedActive} className="group rounded-lg border">
        <summary className="hover:bg-muted/60 focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden">
          <span>
            Fechas, experiencia y zona
            {advancedActive ? <span className="text-olive ml-2 text-xs">(activos)</span> : null}
          </span>
          <ChevronDown
            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <div className="grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="ev-from" className={labelCls}>
              Desde
            </label>
            <Input
              id="ev-from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className={inputSizeClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ev-to" className={labelCls}>
              Hasta
            </label>
            <Input
              id="ev-to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className={inputSizeClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ev-exp" className={labelCls}>
              Experiencia
            </label>
            <select
              id="ev-exp"
              name="experience"
              defaultValue={filters.experienceId ?? ""}
              className={nativeSelectClass}
            >
              <option value="">Todas</option>
              {experiences.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.active ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ev-zone" className={labelCls}>
              Zona
            </label>
            <select
              id="ev-zone"
              name="zone"
              defaultValue={filters.serviceAreaId ?? ""}
              className={nativeSelectClass}
            >
              <option value="">Todas</option>
              {serviceAreas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                  {z.active ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg">
          <SlidersHorizontal aria-hidden />
          Aplicar filtros
        </Button>
        {active ? (
          <Button asChild variant="ghost" size="lg">
            <Link href="/admin/events">Limpiar filtros</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
