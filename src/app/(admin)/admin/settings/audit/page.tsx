import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination, parsePage } from "@/components/data/pagination";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { hasActiveFilters, parseAuditFilters } from "@/features/audit/domain/filters";
import { AUDIT_PAGE_SIZE, getAuditFilterOptions, listAuditLogs } from "@/features/audit/server/audit-queries";
import { AuditFiltersForm } from "@/features/audit/components/audit-filters";
import { AuditEntry } from "@/features/audit/components/audit-entry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auditoría · Configuración" };

const BASE = "/admin/settings/audit";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("audit:read", BASE);
  const sp = await searchParams;
  const filters = parseAuditFilters(sp);
  const page = parsePage(sp.page);
  const [{ items, total }, options] = await Promise.all([listAuditLogs(filters, page), getAuditFilterOptions()]);
  const filtered = hasActiveFilters(filters);

  return (
    <SettingsSection
      title="Auditoría"
      description="Bitácora de acciones sensibles: precios, descuentos, roles, pagos manuales, eliminaciones y cambios de configuración. Abre una entrada para ver qué cambió."
    >
      <AuditFiltersForm basePath={BASE} filters={filters} options={options} />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {total === 0 ? "Sin resultados" : `${total} registro${total === 1 ? "" : "s"}`}
        {filtered ? " con los filtros aplicados" : ""}
      </p>
      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "No hay registros con esos filtros" : "La bitácora está vacía"}
          description={
            filtered
              ? "Prueba con otro rango de fechas o quita algún filtro."
              : "Aquí aparecerán los cambios sensibles en cuanto el equipo empiece a operar."
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <AuditEntry key={row.id} row={row} />
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={AUDIT_PAGE_SIZE} total={total} basePath={BASE} searchParams={sp} />
    </SettingsSection>
  );
}
