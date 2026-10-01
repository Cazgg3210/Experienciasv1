import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, CalendarRange, PackageSearch, TriangleAlert, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { Button } from "@/components/ui/button";
import { INVENTORY_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { inventoryFiltersSchema } from "@/features/inventory/schemas";
import { listInventory } from "@/features/inventory/server/queries";
import { InventoryTable } from "@/features/inventory/components/inventory-table";
import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { ListFilters } from "@/features/inventory/components/list-filters";

export const metadata: Metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission("inventory:read");
  const canWrite = can(user.role, "inventory:write");
  const sp = await searchParams;
  const filters = inventoryFiltersSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    category: sp.category,
    conflict: sp.conflict,
    inactive: sp.inactive,
  });
  const { rows, stats } = await listInventory(filters);
  const hasFilters = Boolean(filters.q || filters.category || filters.conflict);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Inventario"
        description="Vajilla, cristalería, mantelería y equipo propio. Reservas por fecha, mantenimiento y reposición."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/inventory/events">
                <CalendarRange className="size-4" aria-hidden /> Reservas por evento
              </Link>
            </Button>
            <Button variant={stats.conflictDates ? "destructive" : "outline"} asChild>
              <Link href="/admin/inventory/conflicts">
                <AlertTriangle className="size-4" aria-hidden /> Conflictos
                {stats.conflictDates ? <span className="tabular">({stats.conflictDates})</span> : null}
              </Link>
            </Button>
            {canWrite ? <ItemFormDialog /> : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Artículos" value={stats.items} icon={Boxes} hint={`${stats.inMaintenance} piezas en mantenimiento`} />
        <StatCard
          label="Stock bajo"
          value={stats.lowStock}
          icon={TriangleAlert}
          tone={stats.lowStock ? "warning" : "default"}
          hint="Utilizable en o bajo el umbral"
        />
        <StatCard
          label="Con conflicto (60 días)"
          value={stats.inConflict}
          icon={AlertTriangle}
          tone={stats.inConflict ? "danger" : "success"}
          hint={stats.conflictDates ? `${stats.conflictDates} fecha(s) con faltantes` : "Sin faltantes próximos"}
        />
        <StatCard label="Valor de reposición" value={formatMXN(stats.replacementValueCents)} icon={Wallet} hint="Total × costo unitario" />
      </div>

      <ListFilters
        fields={[
          { type: "search", name: "q", label: "Buscar", placeholder: "Nombre, SKU o ubicación" },
          { type: "select", name: "category", label: "Categoría", options: toOptions(INVENTORY_CATEGORY_LABELS) },
          { type: "toggle", name: "conflict", label: "Sólo con conflicto" },
          { type: "toggle", name: "inactive", label: "Incluir inactivos" },
        ]}
      />

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={PackageSearch}
            title="Nada coincide con los filtros"
            description="Prueba con otra búsqueda o limpia los filtros para ver todo el inventario."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/inventory">Limpiar filtros</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Boxes}
            title="Aún no hay artículos"
            description="Da de alta la vajilla, cristalería y equipo para reservarlos por evento."
            action={canWrite ? <ItemFormDialog /> : undefined}
          />
        )
      ) : (
        <>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {rows.length} artículo{rows.length === 1 ? "" : "s"} · “Reservado” es el máximo comprometido en un mismo día de
            los próximos 30; “Disp. hoy” descuenta mantenimiento, eventos de hoy y piezas que siguen fuera.
          </p>
          <InventoryTable rows={rows} canWrite={canWrite} />
        </>
      )}
    </div>
  );
}
