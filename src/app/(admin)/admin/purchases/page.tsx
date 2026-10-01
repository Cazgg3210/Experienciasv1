import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, ExternalLink, Plus, ReceiptText, SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { Pagination, parsePage } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/dates";
import { COST_CATEGORY_LABELS, PURCHASE_STATUS_LABELS, toOptions } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { purchaseFiltersSchema } from "@/features/purchases/schemas";
import { getEventBrief, getPurchaseFilterOptions, listPurchases } from "@/features/purchases/server/queries";
import { PurchaseTable, VarianceText } from "@/features/purchases/components/purchase-table";
import { ListFilters } from "@/features/inventory/components/list-filters";

export const metadata: Metadata = { title: "Compras" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission("purchases:read");
  const canWrite = can(user.role, "purchases:write");
  const sp = await searchParams;
  // Alias de otros módulos (p. ej. finanzas enlaza con ?eventId=): se normaliza a los filtros del listado
  // para que los selects y "Limpiar filtros" funcionen sobre un solo parámetro.
  if (sp.eventId !== undefined || sp.vendorId !== undefined) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "eventId" || key === "vendorId" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
    }
    const eventAlias = first(sp.eventId);
    const vendorAlias = first(sp.vendorId);
    if (eventAlias && !next.has("event")) next.set("event", eventAlias.slice(0, 64));
    if (vendorAlias && !next.has("vendor")) next.set("vendor", vendorAlias.slice(0, 64));
    const qs = next.toString();
    redirect(qs ? `/admin/purchases?${qs}` : "/admin/purchases");
  }
  const filters = purchaseFiltersSchema.parse({
    q: first(sp.q),
    status: first(sp.status),
    category: first(sp.category),
    event: first(sp.event),
    vendor: first(sp.vendor),
    from: first(sp.from),
    to: first(sp.to),
  });
  const page = parsePage(sp.page);
  const eventFilter = filters.event && filters.event !== "none" ? filters.event : null;
  const [{ rows, total, totals }, filterOptions, event] = await Promise.all([
    listPurchases(filters, { page, pageSize: PAGE_SIZE }),
    getPurchaseFilterOptions(),
    eventFilter ? getEventBrief(eventFilter) : null,
  ]);
  const hasFilters = Object.values(filters).some(Boolean);
  const newHref = event ? `/admin/purchases/new?eventId=${event.id}` : "/admin/purchases/new";
  const eventOptions = [{ value: "none", label: "Compras generales (sin evento)" }, ...filterOptions.events];
  if (event && !eventOptions.some((o) => o.value === event.id)) {
    eventOptions.push({ value: event.id, label: `${event.title} · ${event.code}` });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={event ? "Compras del evento" : "Operación"}
        title={event ? event.title : "Compras"}
        description={
          event
            ? `${event.code} · ${formatShortDate(event.eventDate)}. Lo recibido alimenta el costo real del evento.`
            : "Solicitudes, pedidos y recepciones. Lo recibido alimenta el costo real de cada evento."
        }
        back={event ? { href: "/admin/purchases", label: "Todas las compras" } : undefined}
        actions={
          <>
            {event ? (
              <>
                <Button variant="ghost" asChild>
                  <Link href={`/admin/events/${event.id}`}>
                    <ExternalLink className="size-4" aria-hidden /> Ver evento
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/admin/inventory/events/${event.id}`}>
                    <Boxes className="size-4" aria-hidden /> Inventario del evento
                  </Link>
                </Button>
              </>
            ) : null}
            {canWrite ? (
              <Button asChild>
                <Link href={newHref}>
                  <Plus className="size-4" aria-hidden /> Nueva compra
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Esperado" value={formatMXN(totals.expectedCents)} hint={`${totals.count - totals.byStatus.CANCELLED} compras activas`} />
        <StatCard label="Real (recibidas)" value={formatMXN(totals.actualCents)} hint={`${totals.byStatus.RECEIVED} recibidas`} />
        <StatCard
          label="Variación"
          value={<VarianceText cents={totals.byStatus.RECEIVED ? totals.varianceCents : null} />}
          tone={totals.varianceCents > 0 ? "danger" : "default"}
          hint={`vs. esperado de recibidas ${formatMXN(totals.receivedExpectedCents)}`}
        />
        <StatCard
          label="Por recibir"
          value={formatMXN(totals.pendingCents)}
          tone={totals.pendingCents ? "warning" : "default"}
          hint={`${totals.byStatus.REQUESTED} solicitadas · ${totals.byStatus.ORDERED} ordenadas`}
        />
      </div>

      <ListFilters
        fields={[
          { type: "search", name: "q", label: "Buscar", placeholder: "Concepto, nota o proveedor" },
          { type: "select", name: "status", label: "Estado", allLabel: "Todos", options: toOptions(PURCHASE_STATUS_LABELS) },
          { type: "select", name: "event", label: "Evento", allLabel: "Todos", options: eventOptions },
          {
            type: "select",
            name: "vendor",
            label: "Proveedor",
            allLabel: "Todos",
            options: [{ value: "none", label: "Sin proveedor" }, ...filterOptions.vendors],
          },
          { type: "select", name: "category", label: "Categoría", options: toOptions(COST_CATEGORY_LABELS) },
          { type: "date", name: "from", label: "Desde" },
          { type: "date", name: "to", label: "Hasta" },
        ]}
      />
      <p className="text-muted-foreground -mt-3 text-xs">
        El rango de fechas usa “necesario para” (o la fecha de registro si no tiene).
      </p>

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title={event ? "Este evento aún no tiene compras" : "Ninguna compra coincide"}
            description={event ? "Registra flores, pastel, rentas o insumos para controlar el costo real." : "Ajusta los filtros o límpialos."}
            action={
              canWrite && event ? (
                <Button asChild>
                  <Link href={newHref}>Registrar compra</Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/admin/purchases">Limpiar filtros</Link>
                </Button>
              )
            }
          />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Aún no hay compras"
            description="Registra cada compra para comparar lo esperado contra lo real en cada evento."
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/admin/purchases/new">Registrar compra</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <PurchaseTable rows={rows} showEvent={!event} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/purchases" searchParams={sp} />
        </>
      )}
    </div>
  );
}
