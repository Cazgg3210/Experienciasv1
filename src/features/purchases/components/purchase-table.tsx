import Link from "next/link";
import type { CostCategory, PurchaseStatus } from "@prisma/client";
import { StatusBadge } from "@/components/data/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate } from "@/lib/dates";
import { COST_CATEGORY_LABELS, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_TONES } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { purchaseVariance } from "../domain/purchase-rules";

export type PurchaseTableRow = {
  id: string;
  concept: string;
  category: CostCategory;
  status: PurchaseStatus;
  expectedAmountCents: number;
  actualAmountCents: number | null;
  neededBy: Date | null;
  createdAt: Date;
  vendor?: { id: string; name: string } | null;
  event?: { id: string; code: string; title: string } | null;
};

export function VarianceText({ cents, className }: { cents: number | null; className?: string }) {
  if (cents == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  if (cents === 0) return <span className={cn("text-muted-foreground", className)}>$0</span>;
  return (
    <span className={cn(cents > 0 ? "text-destructive" : "text-success", "font-medium", className)}>
      {cents > 0 ? "+" : "−"}
      {formatMXN(Math.abs(cents))}
    </span>
  );
}

/** Tabla de compras (desktop) + tarjetas (móvil). */
export function PurchaseTable({
  rows,
  showVendor = true,
  showEvent = true,
}: {
  rows: PurchaseTableRow[];
  showVendor?: boolean;
  showEvent?: boolean;
}) {
  return (
    <>
      <div className="bg-card hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              {showEvent ? <TableHead>Evento</TableHead> : null}
              {showVendor ? <TableHead>Proveedor</TableHead> : null}
              <TableHead>Estado</TableHead>
              <TableHead>Necesario</TableHead>
              <TableHead className="text-right">Esperado</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Variación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className={cn(p.status === "CANCELLED" && "bg-muted/40")}>
                <TableCell className="max-w-80 min-w-56 whitespace-normal">
                  <Link href={`/admin/purchases/${p.id}`} className="font-medium hover:underline">
                    {p.concept}
                  </Link>
                  <span className="text-muted-foreground block text-xs">{COST_CATEGORY_LABELS[p.category]}</span>
                </TableCell>
                {showEvent ? (
                  <TableCell className="min-w-40 whitespace-normal">
                    {p.event ? (
                      <Link href={`/admin/purchases?event=${p.event.id}`} className="text-sm hover:underline">
                        {p.event.title}
                        <span className="text-muted-foreground block font-mono text-xs">{p.event.code}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">General</span>
                    )}
                  </TableCell>
                ) : null}
                {showVendor ? (
                  <TableCell className="min-w-36 whitespace-normal">
                    {p.vendor ? (
                      <Link href={`/admin/vendors/${p.vendor.id}`} className="text-sm hover:underline">
                        {p.vendor.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin proveedor</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell>
                  <StatusBadge tone={PURCHASE_STATUS_TONES[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {p.neededBy ? formatShortDate(p.neededBy) : "—"}
                </TableCell>
                <TableCell className="tabular text-right">{formatMXN(p.expectedAmountCents)}</TableCell>
                <TableCell className="tabular text-right">{formatMXN(p.actualAmountCents)}</TableCell>
                <TableCell className="tabular text-right">
                  <VarianceText cents={purchaseVariance(p)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Compras">
        {rows.map((p) => (
          <li key={p.id} className={cn("bg-card rounded-xl border p-4", p.status === "CANCELLED" && "bg-muted/50")}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/purchases/${p.id}`} className="min-w-0 font-medium hover:underline">
                {p.concept}
              </Link>
              <StatusBadge tone={PURCHASE_STATUS_TONES[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</StatusBadge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {COST_CATEGORY_LABELS[p.category]}
              {showEvent && p.event ? ` · ${p.event.title}` : ""}
              {showVendor && p.vendor ? ` · ${p.vendor.name}` : ""}
              {p.neededBy ? ` · para ${formatShortDate(p.neededBy)}` : ""}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-sand-soft/60 rounded-lg py-1.5">
                <dt className="text-muted-foreground text-[11px]">Esperado</dt>
                <dd className="tabular font-semibold">{formatMXN(p.expectedAmountCents)}</dd>
              </div>
              <div className="bg-sand-soft/60 rounded-lg py-1.5">
                <dt className="text-muted-foreground text-[11px]">Real</dt>
                <dd className="tabular font-semibold">{formatMXN(p.actualAmountCents)}</dd>
              </div>
              <div className="bg-sand-soft/60 rounded-lg py-1.5">
                <dt className="text-muted-foreground text-[11px]">Variación</dt>
                <dd className="tabular">
                  <VarianceText cents={purchaseVariance(p)} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
