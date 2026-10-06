import type { Metadata } from "next";
import { MapPin, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { countLabel } from "@/features/catalog/domain/catalog-rules";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { EMPTY_AREA, listAreasForAdmin, nextSortOrder } from "@/features/catalog/server/queries";
import { ActiveToggle, DeleteCatalogButton } from "@/features/catalog/components/catalog-actions";
import { AreaDialog } from "@/features/catalog/components/area-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Zonas de servicio" };

const PREVIEW_CODES = 8;

export default async function CatalogAreasPage() {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/areas");
  const canWrite = can(user.role, "catalog:write");
  const canPrice = can(user.role, "pricing:write");
  const [areas, sortOrder] = await Promise.all([listAreasForAdmin(), nextSortOrder("serviceArea")]);

  const newButton = canWrite ? (
    <AreaDialog
      mode="create"
      defaultValues={{ ...EMPTY_AREA, sortOrder }}
      canPrice={canPrice}
      trigger={
        <Button size="lg">
          <Plus aria-hidden />
          Nueva zona
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Zonas de servicio"
        description="Colonias y alcaldías a las que llegamos, con su tarifa y costo de logística."
        actions={newButton}
      />
      {areas.length ? (
        <ul className="space-y-3">
          {areas.map((a) => {
            const logisticsMargin = a.logisticsFeeCents - a.logisticsCostCents;
            return (
              <li key={a.id} className={cn("bg-card rounded-2xl border p-4 shadow-xs", !a.active && "bg-muted/50")}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-lg font-semibold">{a.name}</h2>
                      {!a.active ? <StatusBadge tone="muted">Inactiva</StatusBadge> : null}
                      {a.counts.events ? <StatusBadge tone="brand">{countLabel(a.counts.events, "evento", "eventos")}</StatusBadge> : null}
                    </div>
                    {a.description ? <p className="text-muted-foreground text-sm">{a.description}</p> : null}
                    {a.postalCodes.length ? (
                      <div>
                        <p className="sr-only">Códigos postales:</p>
                        <ul className="flex flex-wrap gap-1" aria-label={`${a.postalCodes.length} códigos postales`}>
                          {a.postalCodes.slice(0, PREVIEW_CODES).map((c) => (
                            <li key={c} className="bg-sand-soft tabular rounded-full px-2 py-0.5 font-mono text-xs">
                              {c}
                            </li>
                          ))}
                          {a.postalCodes.length > PREVIEW_CODES ? (
                            <li className="text-muted-foreground px-1 text-xs">+{a.postalCodes.length - PREVIEW_CODES} más</li>
                          ) : null}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-warning text-xs">Sin códigos postales: no se podrá detectar automáticamente.</p>
                    )}
                  </div>
                  <dl className="grid grid-cols-3 gap-4 text-sm lg:w-80">
                    <div>
                      <dt className="text-muted-foreground text-xs">Tarifa</dt>
                      <dd className="tabular font-medium">{a.logisticsFeeCents ? formatMXN(a.logisticsFeeCents) : "Sin cargo"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Costo</dt>
                      <dd className="tabular font-medium">{formatMXN(a.logisticsCostCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Diferencia</dt>
                      <dd className={cn("tabular font-medium", logisticsMargin < 0 ? "text-destructive" : "text-success")}>
                        {formatMXN(logisticsMargin)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
                    <ActiveToggle entity="serviceArea" id={a.id} name={a.name} active={a.active} disabled={!canWrite} />
                    {canWrite ? (
                      <div className="flex gap-1">
                        <AreaDialog
                          mode="edit"
                          areaId={a.id}
                          defaultValues={a.values}
                          canPrice={canPrice}
                          trigger={
                            <Button variant="outline" size="lg" aria-label={`Editar ${a.name}`}>
                              <Pencil aria-hidden />
                              Editar
                            </Button>
                          }
                        />
                        <DeleteCatalogButton entity="serviceArea" id={a.id} name={a.name} compact />
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={MapPin}
          title="Aún no hay zonas de servicio"
          description="Agrega las zonas a las que llegamos (con sus códigos postales) para cotizar la logística automáticamente."
          action={newButton}
        />
      )}
    </>
  );
}
