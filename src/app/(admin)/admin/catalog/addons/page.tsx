import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Gift, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { ADDON_CATEGORY_LABELS, ADDON_PRICING_LABELS } from "@/lib/labels";
import { formatBps, formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getEngineSettings, listAddOnsForAdmin } from "@/features/catalog/server/queries";
import { ActiveToggle } from "@/features/catalog/components/catalog-actions";
import { CatalogImage } from "@/features/catalog/components/catalog-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add-ons" };

export default async function CatalogAddOnsPage() {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/addons");
  const canWrite = can(user.role, "catalog:write");
  const [addOns, settings] = await Promise.all([listAddOnsForAdmin(), getEngineSettings()]);

  const newButton = canWrite ? (
    <Button asChild size="lg">
      <Link href="/admin/catalog/addons/new">
        <Plus aria-hidden />
        Nuevo add-on
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Add-ons"
        description="Extras que hacen única cada celebración: precio, costo, disponibilidad e inventario que apartan."
        actions={newButton}
      />
      {addOns.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {addOns.map((a) => {
            const margin = a.unitMarginBps;
            return (
              <li key={a.id} className={cn("bg-card flex flex-col overflow-hidden rounded-2xl border shadow-xs", !a.active && "opacity-80")}>
                <div className="flex gap-3 p-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border">
                    <CatalogImage src={a.imageUrl} alt="" sizes="80px" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-muted-foreground text-xs">{ADDON_CATEGORY_LABELS[a.category]}</p>
                    <h2 className="font-heading text-lg leading-tight font-semibold">
                      <Link
                        href={`/admin/catalog/addons/${a.id}`}
                        className="focus-visible:ring-ring/50 rounded outline-none hover:underline focus-visible:ring-3"
                      >
                        {a.name}
                      </Link>
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge tone="neutral" dot={false}>
                        {ADDON_PRICING_LABELS[a.pricingType]}
                      </StatusBadge>
                      {!a.active ? <StatusBadge tone="muted">No disponible</StatusBadge> : null}
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 border-t px-4 py-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Precio</dt>
                    <dd className="tabular font-medium">{formatMXN(a.priceCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Costo</dt>
                    <dd className="tabular font-medium">{formatMXN(a.costCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Margen</dt>
                    <dd
                      className={cn(
                        "tabular font-medium",
                        margin == null
                          ? "text-muted-foreground"
                          : margin < 0
                            ? "text-destructive"
                            : margin < settings.minMarginBps
                              ? "text-warning"
                              : "text-success",
                      )}
                    >
                      {margin == null ? "—" : formatBps(margin)}
                    </dd>
                  </div>
                </dl>
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs">
                  <span>Máx. {a.maxQuantity} por evento</span>
                  {a.leadTimeDays ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {a.leadTimeDays} días de anticipación
                    </span>
                  ) : null}
                  <span>
                    {a._count.experiences} {a._count.experiences === 1 ? "experiencia" : "experiencias"}
                  </span>
                  {a._count.inventoryReqs ? <span>{a._count.inventoryReqs} artículos de inventario</span> : null}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t px-4 py-3">
                  <ActiveToggle entity="addOn" id={a.id} name={a.name} active={a.active} disabled={!canWrite} />
                  <Button asChild variant="outline" size="lg">
                    <Link href={`/admin/catalog/addons/${a.id}`} aria-label={`${canWrite ? "Editar" : "Ver"} ${a.name}`}>
                      <Pencil aria-hidden />
                      {canWrite ? "Editar" : "Ver"}
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Gift}
          title="Aún no hay add-ons"
          description="Karaoke, globos, pastel personalizado, fotógrafa… agrega extras para que las clientas armen su celebración."
          action={newButton}
        />
      )}
    </>
  );
}
