import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowDownUp, Boxes, CalendarCheck2, History, Pencil, Wrench } from "lucide-react";
import { PageHeader, Section } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_MOVEMENT_LABELS,
  INVENTORY_RESERVATION_LABELS,
} from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getInventoryItemDetail } from "@/features/inventory/server/queries";
import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { StockAdjustDialog } from "@/features/inventory/components/stock-adjust-dialog";
import { MOVEMENT_TONES, RESERVATION_STATUS_TONES, movementQuantityLabel } from "@/features/inventory/components/tones";

export const metadata: Metadata = { title: "Artículo de inventario" };
export const dynamic = "force-dynamic";

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("inventory:read");
  const canWrite = can(user.role, "inventory:write");
  const { id } = await params;
  if (!id || id.length > 64) notFound();
  const detail = await getInventoryItemDetail(id);
  if (!detail) notFound();
  const { item, movements, movementCount, upcoming, conflicts, usedBy } = detail;

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/admin/inventory", label: "Inventario" }}
        eyebrow={
          <span className="font-mono normal-case">
            {item.sku} · {INVENTORY_CATEGORY_LABELS[item.category]}
          </span>
        }
        title={item.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {!item.active ? <StatusBadge tone="muted">Inactivo</StatusBadge> : null}
            {detail.lowStock ? <StatusBadge tone="warning">Stock bajo</StatusBadge> : null}
            {item.location ? <span>Ubicación: {item.location}</span> : null}
          </span>
        }
        actions={
          canWrite ? (
            <>
              <StockAdjustDialog
                item={{
                  id: item.id,
                  sku: item.sku,
                  name: item.name,
                  unit: item.unit,
                  totalQuantity: item.totalQuantity,
                  maintenanceQuantity: item.maintenanceQuantity,
                }}
                trigger={
                  <Button>
                    <ArrowDownUp className="size-4" aria-hidden /> Ajustar stock
                  </Button>
                }
              />
              <ItemFormDialog
                item={{
                  id: item.id,
                  sku: item.sku,
                  name: item.name,
                  category: item.category,
                  unit: item.unit,
                  lowStockThreshold: item.lowStockThreshold,
                  replacementCostCents: item.replacementCostCents,
                  location: item.location,
                  notes: item.notes,
                  active: item.active,
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Button>
                }
              />
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total" value={`${item.totalQuantity} ${item.unit}`} icon={Boxes} />
        <StatCard
          label="En mantenimiento"
          value={item.maintenanceQuantity}
          icon={Wrench}
          tone={item.maintenanceQuantity ? "warning" : "default"}
        />
        <StatCard label="Utilizable" value={detail.usable} hint={`Umbral bajo: ${item.lowStockThreshold}`} tone={detail.lowStock ? "warning" : "default"} />
        <StatCard
          label="Disponible hoy"
          value={detail.availableToday}
          icon={CalendarCheck2}
          tone={detail.availableToday === 0 ? "danger" : "default"}
        />
        <StatCard
          label="Reposición"
          value={formatMXN(item.replacementCostCents)}
          hint={`Valor total ${formatMXN(item.replacementCostCents * item.totalQuantity)}`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {conflicts.length ? (
        <div role="alert" className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
          <p className="text-destructive flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden /> Faltan piezas en {conflicts.length} fecha
            {conflicts.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {conflicts.map((c) => (
              <li key={c.date}>
                <strong>{formatShortDate(c.date)}</strong>: se requieren {c.required}, hay {c.available} utilizables (faltan{" "}
                {c.shortBy}) —{" "}
                {c.events.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 ? ", " : ""}
                    <Link className="underline underline-offset-2" href={`/admin/inventory/events/${e.id}`}>
                      {e.title}
                    </Link>{" "}
                    ({e.quantity})
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.notes ? (
        <div className="bg-sand-soft/50 rounded-xl border p-4 text-sm whitespace-pre-line">
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Notas</p>
          {item.notes}
        </div>
      ) : null}

      <Section title="Próximas reservas" description="Eventos con este artículo reservado o que siguen fuera de bodega.">
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="Sin reservas próximas" description="Ningún evento próximo tiene este artículo reservado." />
        ) : (
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Estado del evento</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Reserva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatShortDate(r.event.eventDate)}</TableCell>
                    <TableCell className="min-w-48 whitespace-normal">
                      <Link href={`/admin/inventory/events/${r.event.id}`} className="font-medium hover:underline">
                        {r.event.title}
                      </Link>
                      <span className="text-muted-foreground block font-mono text-xs">{r.event.code}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={EVENT_STATUS_TONES[r.event.status]}>{EVENT_STATUS_LABELS[r.event.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className="tabular text-right">{r.quantity}</TableCell>
                    <TableCell>
                      <StatusBadge tone={RESERVATION_STATUS_TONES[r.status]}>{INVENTORY_RESERVATION_LABELS[r.status]}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {usedBy.experiences.length || usedBy.addOns.length ? (
        <Section title="Se usa en" description="Requerimientos configurados en el catálogo.">
          <ul className="flex flex-wrap gap-2">
            {usedBy.experiences.map((r) => (
              <li key={`e-${r.experience.id}`} className="bg-sage-soft/60 rounded-full border px-3 py-1 text-sm">
                {r.experience.name} · {r.quantity}
                {r.perGuest ? " por invitada" : " por evento"}
              </li>
            ))}
            {usedBy.addOns.map((r) => (
              <li key={`a-${r.addOn.id}`} className="bg-sand-soft rounded-full border px-3 py-1 text-sm">
                Add-on {r.addOn.name} · {r.quantity}
                {r.perGuest ? " por invitada" : " por unidad"}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title="Movimientos"
        description={
          movementCount > movements.length
            ? `Últimos ${movements.length} de ${movementCount} movimientos.`
            : "Historial completo de entradas, salidas, reservas y ajustes."
        }
      >
        {movements.length === 0 ? (
          <EmptyState icon={History} title="Sin movimientos" description="Aquí verás cada entrada, salida, reserva y ajuste." />
        ) : (
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Registró</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const label = movementQuantityLabel(m.type, m.quantity);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={MOVEMENT_TONES[m.type]}>{INVENTORY_MOVEMENT_LABELS[m.type]}</StatusBadge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular text-right font-medium",
                          label.startsWith("+") && "text-success",
                          label.startsWith("−") && "text-destructive",
                        )}
                      >
                        {label}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {m.event ? (
                          <Link href={`/admin/inventory/events/${m.event.id}`} className="font-mono text-xs hover:underline">
                            {m.event.code}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-80 min-w-48 text-sm whitespace-normal">{m.reason ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{m.actor?.name ?? "Sistema"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
