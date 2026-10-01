import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/dates";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES, INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/session";
import { getInventoryConflicts, type InventoryConflict } from "@/features/inventory/server/queries";
import { capitalizeFirst } from "@/features/inventory/components/text";

export const metadata: Metadata = { title: "Conflictos de inventario" };
export const dynamic = "force-dynamic";

const RANGES = [30, 60, 90] as const;

export default async function InventoryConflictsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("inventory:read");
  const sp = await searchParams;
  const requested = Number(Array.isArray(sp.dias) ? sp.dias[0] : sp.dias);
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 60;
  const conflicts = await getInventoryConflicts({ days });

  const byDate = new Map<string, InventoryConflict[]>();
  for (const c of conflicts) {
    const list = byDate.get(c.date) ?? [];
    list.push(c);
    byDate.set(c.date, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/inventory", label: "Inventario" }}
        title="Conflictos de inventario"
        description="Fechas donde la suma de reservas de todos los eventos supera las piezas utilizables (total − mantenimiento)."
        actions={
          <nav aria-label="Rango de días" className="bg-muted inline-flex rounded-lg p-1">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin/inventory/conflicts?dias=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm",
                  r === days ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r} días
              </Link>
            ))}
          </nav>
        }
      />

      {byDate.size === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={`Sin conflictos en los próximos ${days} días`}
          description="Todas las reservas caben en el inventario disponible. Revisa de nuevo cuando se confirmen más eventos."
          action={
            <Button variant="outline" asChild>
              <Link href="/admin/inventory/events">Ver reservas por evento</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p role="status" className="text-destructive flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {byDate.size} fecha{byDate.size === 1 ? "" : "s"} con faltantes · {conflicts.length} artículo
            {conflicts.length === 1 ? "" : "s"} afectado{conflicts.length === 1 ? "" : "s"}
          </p>
          <ol className="space-y-5">
            {[...byDate.entries()].map(([date, items]) => (
              <li key={date} className="border-destructive/30 bg-card overflow-hidden rounded-xl border">
                <div className="bg-destructive/5 border-destructive/20 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <h2 className="flex items-center gap-2 font-medium">
                    <CalendarDays className="text-destructive size-4" aria-hidden />
                    {capitalizeFirst(formatLongDate(date))}
                  </h2>
                  <StatusBadge tone="danger">
                    {items.length} artículo{items.length === 1 ? "" : "s"} con faltante
                  </StatusBadge>
                </div>
                <ul className="divide-y">
                  {items.map((c) => (
                    <li key={c.item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.5fr)] md:items-center">
                      <div className="min-w-0">
                        <Link href={`/admin/inventory/${c.item.id}`} className="font-medium hover:underline">
                          {c.item.name}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          <span className="font-mono">{c.item.sku}</span> · {INVENTORY_CATEGORY_LABELS[c.item.category]}
                        </p>
                      </div>
                      <dl className="flex gap-4 text-center text-sm">
                        <div>
                          <dt className="text-muted-foreground text-[11px]">Requerido</dt>
                          <dd className="tabular font-semibold">{c.required}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-[11px]">Utilizable</dt>
                          <dd className="tabular font-semibold">{c.available}</dd>
                        </div>
                        <div>
                          <dt className="text-destructive text-[11px]">Faltan</dt>
                          <dd className="tabular text-destructive font-semibold">{c.shortBy}</dd>
                        </div>
                      </dl>
                      <ul className="space-y-1 text-sm" aria-label="Eventos involucrados">
                        {c.events.map((e) => (
                          <li key={e.id} className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/inventory/events/${e.id}`} className="font-medium hover:underline">
                              {e.title}
                            </Link>
                            <span className="text-muted-foreground tabular text-xs">
                              {e.quantity} {c.item.unit}
                            </span>
                            <StatusBadge tone={EVENT_STATUS_TONES[e.status]} className="h-5 text-[11px]">
                              {EVENT_STATUS_LABELS[e.status]}
                            </StatusBadge>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm">
            Para resolver: ajusta cantidades en las reservas del evento, renta piezas adicionales (registra una compra) o regresa
            piezas de mantenimiento.
          </p>
        </>
      )}
    </div>
  );
}
