import Link from "next/link";
import { AlertTriangle, ArrowDownUp, Pencil } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate } from "@/lib/dates";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { InventoryRow } from "../server/queries";
import { ItemFormDialog } from "./item-form-dialog";
import { StockAdjustDialog } from "./stock-adjust-dialog";

function Badges({ row }: { row: InventoryRow }) {
  return (
    <span className="flex flex-wrap gap-1">
      {!row.active ? <StatusBadge tone="muted">Inactivo</StatusBadge> : null}
      {row.lowStock ? <StatusBadge tone="warning">Stock bajo</StatusBadge> : null}
      {row.conflictDates.length ? (
        <StatusBadge tone="danger">
          Conflicto {row.conflictDates.length > 1 ? `(${row.conflictDates.length} fechas)` : formatShortDate(row.conflictDates[0]!)}
        </StatusBadge>
      ) : null}
    </span>
  );
}

function Actions({ row, canWrite, full }: { row: InventoryRow; canWrite: boolean; full?: boolean }) {
  if (!canWrite) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      <StockAdjustDialog
        item={{
          id: row.id,
          sku: row.sku,
          name: row.name,
          unit: row.unit,
          totalQuantity: row.totalQuantity,
          maintenanceQuantity: row.maintenanceQuantity,
        }}
        trigger={
          <Button variant="outline" size={full ? "sm" : "icon-sm"} aria-label={`Ajustar stock de ${row.name}`}>
            <ArrowDownUp className="size-3.5" aria-hidden />
            {full ? "Ajustar stock" : null}
          </Button>
        }
      />
      <ItemFormDialog
        item={{
          id: row.id,
          sku: row.sku,
          name: row.name,
          category: row.category,
          unit: row.unit,
          lowStockThreshold: row.lowStockThreshold,
          replacementCostCents: row.replacementCostCents,
          location: row.location,
          notes: row.notes,
          active: row.active,
        }}
        trigger={
          <Button variant="ghost" size={full ? "sm" : "icon-sm"} aria-label={`Editar ${row.name}`}>
            <Pencil className="size-3.5" aria-hidden />
            {full ? "Editar" : null}
          </Button>
        }
      />
    </div>
  );
}

/** Tabla responsive del inventario (tabla en desktop, tarjetas en móvil). */
export function InventoryTable({ rows, canWrite }: { rows: InventoryRow[]; canWrite: boolean }) {
  return (
    <>
      <div className="bg-card hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">SKU</TableHead>
              <TableHead>Artículo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Mant.</TableHead>
              <TableHead className="text-right" title="Máximo reservado en un mismo día (próximos 30 días)">
                Reservado <span className="text-muted-foreground font-normal">(30 d)</span>
              </TableHead>
              <TableHead className="text-right">Disp. hoy</TableHead>
              <TableHead className="text-right">Umbral</TableHead>
              <TableHead className="text-right">Reposición</TableHead>
              <TableHead>Ubicación</TableHead>
              {canWrite ? <TableHead className="sr-only">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={cn(!row.active && "opacity-60")}>
                <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                <TableCell className="max-w-72 min-w-48 whitespace-normal">
                  <Link href={`/admin/inventory/${row.id}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  <div className="mt-1">
                    <Badges row={row} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{INVENTORY_CATEGORY_LABELS[row.category]}</TableCell>
                <TableCell className="tabular text-right">{row.totalQuantity}</TableCell>
                <TableCell className={cn("tabular text-right", row.maintenanceQuantity > 0 && "text-warning")}>
                  {row.maintenanceQuantity}
                </TableCell>
                <TableCell className="tabular text-right">
                  {row.reservedPeak}
                  {row.reservedPeakDate ? (
                    <span className="text-muted-foreground block text-[11px]">{formatShortDate(row.reservedPeakDate)}</span>
                  ) : null}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular text-right font-medium",
                    row.availableToday <= row.lowStockThreshold && row.lowStockThreshold > 0 && "text-warning",
                    row.availableToday === 0 && "text-destructive",
                  )}
                >
                  {row.availableToday}
                </TableCell>
                <TableCell className="tabular text-muted-foreground text-right">{row.lowStockThreshold}</TableCell>
                <TableCell className="tabular text-right">{formatMXN(row.replacementCostCents)}</TableCell>
                <TableCell className="text-muted-foreground max-w-40 truncate" title={row.location ?? undefined}>
                  {row.location ?? "—"}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    <Actions row={row} canWrite={canWrite} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Artículos de inventario">
        {rows.map((row) => (
          <li key={row.id} className={cn("bg-card rounded-xl border p-4", !row.active && "opacity-70")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground font-mono text-xs">{row.sku}</p>
                <Link href={`/admin/inventory/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {INVENTORY_CATEGORY_LABELS[row.category]}
                  {row.location ? ` · ${row.location}` : ""}
                </p>
              </div>
              {row.conflictDates.length ? <AlertTriangle className="text-destructive size-4 shrink-0" aria-label="Con conflicto" /> : null}
            </div>
            <div className="mt-2">
              <Badges row={row} />
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                ["Total", row.totalQuantity],
                ["Mant.", row.maintenanceQuantity],
                ["Reserv.", row.reservedPeak],
                ["Hoy", row.availableToday],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-sand-soft/60 rounded-lg px-1 py-1.5">
                  <dt className="text-muted-foreground text-[11px]">{label}</dt>
                  <dd className="tabular text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
              <span>Umbral {row.lowStockThreshold}</span>
              <span>Reposición {formatMXN(row.replacementCostCents)}</span>
            </div>
            {canWrite ? (
              <div className="mt-3 border-t pt-3">
                <Actions row={row} canWrite={canWrite} full />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
