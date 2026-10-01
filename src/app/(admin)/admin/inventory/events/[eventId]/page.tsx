import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Boxes, ExternalLink, Info, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLongDate } from "@/lib/dates";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES, INVENTORY_CATEGORY_LABELS, INVENTORY_RESERVATION_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getEventReservations, listInventoryItemOptions } from "@/features/inventory/server/queries";
import {
  AddReservationDialog,
  CheckOutAllButton,
  CheckOutButton,
  EditQuantityDialog,
  RecalculateButton,
  ReleaseAllButton,
  ReleaseButton,
  ReturnDialog,
} from "@/features/inventory/components/reservation-controls";
import { RESERVATION_STATUS_TONES } from "@/features/inventory/components/tones";
import { capitalizeFirst } from "@/features/inventory/components/text";

export const metadata: Metadata = { title: "Reservas del evento" };
export const dynamic = "force-dynamic";

type Data = NonNullable<Awaited<ReturnType<typeof getEventReservations>>>;
type Row = Data["reservations"][number];

function RowActions({ r, canWrite, eventCancelled }: { r: Row; canWrite: boolean; eventCancelled: boolean }) {
  if (!canWrite) return null;
  const common = { reservationId: r.id, itemName: r.inventoryItem.name };
  if (r.status === "RESERVED") {
    return (
      <div className="flex items-center justify-end gap-1">
        {/* En un evento cancelado sólo tiene sentido liberar. */}
        {eventCancelled ? null : <EditQuantityDialog {...common} quantity={r.quantity} unit={r.inventoryItem.unit} />}
        {eventCancelled ? null : <CheckOutButton {...common} />}
        <ReleaseButton {...common} quantity={r.quantity} />
      </div>
    );
  }
  if (r.status === "CHECKED_OUT") {
    return (
      <div className="flex justify-end">
        <ReturnDialog {...common} quantity={r.quantity} unit={r.inventoryItem.unit} />
      </div>
    );
  }
  return null;
}

function ReturnInfo({ r }: { r: Row }) {
  if (r.status !== "RETURNED") return null;
  return (
    <span className="text-muted-foreground block text-xs">
      Regresaron {r.returnedQuantity ?? 0}
      {r.damagedQuantity ? <span className="text-destructive"> · {r.damagedQuantity} dañadas/perdidas</span> : null}
    </span>
  );
}

export default async function EventReservationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const user = await requirePagePermission("inventory:read");
  const canWrite = can(user.role, "inventory:write");
  const canPurchases = can(user.role, "purchases:read");
  const { eventId } = await params;
  if (!eventId || eventId.length > 64) notFound();
  const [data, itemOptions] = await Promise.all([getEventReservations(eventId), canWrite ? listInventoryItemOptions() : []]);
  if (!data) notFound();
  const { event, reservations, shortages, missingFromRules, counts } = data;
  const closed = event.status === "CANCELLED" || event.status === "COMPLETED";
  const visible = reservations.filter((r) => r.status !== "CANCELLED");
  const cancelled = reservations.filter((r) => r.status === "CANCELLED");

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/inventory/events", label: "Reservas por evento" }}
        eyebrow={<span className="font-mono normal-case">{event.code}</span>}
        title={event.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={EVENT_STATUS_TONES[event.status]}>{EVENT_STATUS_LABELS[event.status]}</StatusBadge>
            <span>{capitalizeFirst(formatLongDate(event.eventDate))}</span>
            <span>· {event.guestCount} invitadas</span>
            {event.experience ? <span>· {event.experience.name}</span> : null}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={`/admin/events/${event.id}`}>
                <ExternalLink className="size-4" aria-hidden /> Ver evento
              </Link>
            </Button>
            {canPurchases ? (
              <Button variant="outline" asChild>
                <Link href={`/admin/purchases?event=${event.id}`}>
                  <ShoppingBag className="size-4" aria-hidden /> Compras ({data.purchasesCount})
                </Link>
              </Button>
            ) : null}
            {canWrite && !closed ? <RecalculateButton eventId={event.id} /> : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reservados" value={counts.RESERVED} hint="Pendientes de salir" />
        <StatCard label="En evento" value={counts.CHECKED_OUT} hint="Fuera de bodega" />
        <StatCard label="Devueltos" value={counts.RETURNED} />
        <StatCard
          label="Con faltante"
          value={shortages.length}
          tone={shortages.length ? "danger" : "success"}
          hint={shortages.length ? "No alcanzan las piezas utilizables ese día" : "Todo cubierto"}
        />
      </div>

      {event.status === "CANCELLED" && (counts.RESERVED > 0 || counts.CHECKED_OUT > 0) ? (
        <div
          role="alert"
          className="border-warning/30 bg-warning/10 flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-foreground">
            {counts.RESERVED > 0
              ? "El evento está cancelado pero aún aparta piezas. Libéralas para que estén disponibles para otros eventos."
              : null}
            {counts.RESERVED > 0 && counts.CHECKED_OUT > 0 ? " " : null}
            {counts.CHECKED_OUT > 0 ? "Hay piezas fuera de bodega: registra su regreso." : null}
          </p>
          {canWrite ? <ReleaseAllButton eventId={event.id} pending={counts.RESERVED} /> : null}
        </div>
      ) : null}

      {(event.status === "INQUIRY" || event.status === "PENDING_PAYMENT") && counts.RESERVED + counts.CHECKED_OUT === 0 ? (
        <div className="bg-sand-soft/60 flex gap-3 rounded-xl border p-4 text-sm">
          <Info className="text-olive mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Este evento aún no está confirmado. Al confirmarse, sus piezas se reservan automáticamente; si necesitas
            apartarlas desde ahora, usa “Recalcular desde requerimientos”.
          </p>
        </div>
      ) : null}

      {shortages.length ? (
        <div role="alert" className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
          <p className="text-destructive flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {shortages.length === 1
              ? "No alcanza 1 artículo ese día"
              : `No alcanzan ${shortages.length} artículos ese día`}
          </p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {shortages.map((s) => (
              <li key={s.inventoryItemId}>
                <Link href={`/admin/inventory/${s.inventoryItemId}`} className="font-medium underline-offset-2 hover:underline">
                  {s.name}
                </Link>
                : se necesitan {s.required}, disponibles {s.available} — <strong className="text-destructive">faltan {s.shortBy}</strong>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            <Link href="/admin/inventory/conflicts" className="underline underline-offset-2">
              Ver todos los conflictos
            </Link>{" "}
            · Puedes ajustar cantidades, rentar piezas (registrar compra) o regresar piezas de mantenimiento.
          </p>
        </div>
      ) : null}

      {missingFromRules.length && !closed ? (
        <div className="bg-sage-soft/50 flex gap-3 rounded-xl border p-4 text-sm">
          <Info className="text-olive mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Según los requerimientos faltan por reservar:{" "}
            {missingFromRules.map((m, i) => (
              <span key={m.id}>
                {i > 0 ? ", " : ""}
                {m.name} ({m.required})
              </span>
            ))}
            . Usa “Recalcular desde requerimientos”.
          </p>
        </div>
      ) : null}

      {canWrite && !closed ? (
        <div className="flex flex-wrap gap-2">
          <AddReservationDialog eventId={event.id} items={itemOptions} />
          <CheckOutAllButton eventId={event.id} pending={counts.RESERVED} />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Este evento aún no tiene piezas reservadas"
          description="Calcula la reserva desde la experiencia y los add-ons contratados, o agrega artículos manualmente."
          action={canWrite && !closed ? <RecalculateButton eventId={event.id} /> : undefined}
        />
      ) : (
        <>
          <div className="bg-card hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Según reglas</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Disponible ese día</TableHead>
                  {canWrite ? <TableHead className="sr-only">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id} className={cn(r.shortage && "bg-destructive/5")}>
                    <TableCell className="min-w-56 whitespace-normal">
                      <Link href={`/admin/inventory/${r.inventoryItem.id}`} className="font-medium hover:underline">
                        {r.inventoryItem.name}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        <span className="font-mono">{r.inventoryItem.sku}</span> · {INVENTORY_CATEGORY_LABELS[r.inventoryItem.category]}
                      </span>
                      <ReturnInfo r={r} />
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground text-right">{r.requiredByRules || "—"}</TableCell>
                    <TableCell
                      className={cn(
                        "tabular text-right font-medium",
                        r.requiredByRules > 0 && r.quantity !== r.requiredByRules && r.status === "RESERVED" && "text-warning",
                      )}
                    >
                      {r.quantity} <span className="text-muted-foreground text-xs font-normal">{r.inventoryItem.unit}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={RESERVATION_STATUS_TONES[r.status]}>{INVENTORY_RESERVATION_LABELS[r.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {r.shortage ? (
                        <span className="text-destructive font-medium">
                          {r.shortage.available} · faltan {r.shortage.shortBy}
                        </span>
                      ) : r.status === "RESERVED" || r.status === "CHECKED_OUT" ? (
                        <span className="text-success">Cubierto</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canWrite ? (
                      <TableCell>
                        <RowActions r={r} canWrite={canWrite} eventCancelled={event.status === "CANCELLED"} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden" aria-label="Reservas del evento">
            {visible.map((r) => (
              <li key={r.id} className={cn("bg-card rounded-xl border p-4", r.shortage && "border-destructive/40")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/inventory/${r.inventoryItem.id}`} className="font-medium hover:underline">
                      {r.inventoryItem.name}
                    </Link>
                    <p className="text-muted-foreground font-mono text-xs">{r.inventoryItem.sku}</p>
                    <ReturnInfo r={r} />
                  </div>
                  <StatusBadge tone={RESERVATION_STATUS_TONES[r.status]}>{INVENTORY_RESERVATION_LABELS[r.status]}</StatusBadge>
                </div>
                <p className="mt-2 text-sm">
                  <span className="tabular font-semibold">
                    {r.quantity} {r.inventoryItem.unit}
                  </span>
                  {r.requiredByRules ? <span className="text-muted-foreground"> · reglas: {r.requiredByRules}</span> : null}
                </p>
                {r.shortage ? (
                  <p className="text-destructive mt-1 text-sm font-medium">
                    Disponibles {r.shortage.available} · faltan {r.shortage.shortBy}
                  </p>
                ) : null}
                {canWrite && (r.status === "RESERVED" || r.status === "CHECKED_OUT") ? (
                  <div className="mt-3 border-t pt-3">
                    <RowActions r={r} canWrite={canWrite} eventCancelled={event.status === "CANCELLED"} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {cancelled.length ? (
        <details className="bg-card rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">Reservas liberadas ({cancelled.length})</summary>
          <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
            {cancelled.map((r) => (
              <li key={r.id}>
                {r.inventoryItem.name} · {r.quantity} {r.inventoryItem.unit}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
