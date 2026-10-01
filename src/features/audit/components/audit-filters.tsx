import Link from "next/link";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/features/settings/components/native-select";
import { auditActionLabel, hasActiveFilters, type AuditFilters } from "../domain/filters";

/** Filtros por GET (funcionan sin JS y se conservan en la URL para compartir). */
export function AuditFiltersForm({
  basePath,
  filters,
  options,
}: {
  basePath: string;
  filters: AuditFilters;
  options: { actions: string[]; entityTypes: string[]; actors: Array<{ id: string; label: string }> };
}) {
  return (
    <form method="get" action={basePath} className="bg-card rounded-xl border p-4 shadow-xs" role="search" aria-label="Filtrar bitácora">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Acción</Label>
          <NativeSelect id="audit-action" name="action" defaultValue={filters.action ?? ""}>
            <option value="">Todas</option>
            {options.actions.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)}
                {auditActionLabel(a) !== a ? ` (${a})` : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-entity">Entidad</Label>
          <NativeSelect id="audit-entity" name="entityType" defaultValue={filters.entityType ?? ""}>
            <option value="">Todas</option>
            {options.entityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-actor">Persona</Label>
          <NativeSelect id="audit-actor" name="actor" defaultValue={filters.actor ?? ""}>
            <option value="">Todas</option>
            <option value="system">Sistema (automático)</option>
            {options.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-entity-id">ID de registro</Label>
          <Input id="audit-entity-id" name="entityId" defaultValue={filters.entityId ?? ""} placeholder="Ej. pricing o el id de una cotización" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">Desde</Label>
          <Input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">Hasta</Label>
          <Input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg">
          <Filter aria-hidden />
          Filtrar
        </Button>
        {hasActiveFilters(filters) ? (
          <Button asChild variant="ghost" size="lg">
            <Link href={basePath}>
              <X aria-hidden />
              Limpiar filtros
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
