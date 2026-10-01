import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeDollarSign, Download, HandCoins, Percent, PiggyBank, Wallet } from "lucide-react";
import { PageHeader, Section } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart } from "@/components/charts/bar-chart";
import { requirePagePermission } from "@/server/auth/session";
import { formatShortDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
} from "@/lib/labels";
import { monthLongLabel, monthOptions } from "@/features/analytics/domain/metrics";
import { parseFinanceFilters, type FinanceStatusFilter } from "@/features/financials/schemas";
import {
  FINANCE_ROW_LIMIT,
  financeTotals,
  getFinanceRows,
  getOutstandingBalances,
  getRecentPayments,
  getRevenueByMonth,
} from "@/features/financials/server/finance-queries";
import { FinanceFilters } from "@/features/financials/components/finance-filters";
import { MarginPct, Money } from "@/features/financials/components/figures";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Finanzas" };

const STATUS_FILTER_OPTIONS: Array<{ value: Exclude<FinanceStatusFilter, "ALL">; label: string }> = [
  { value: "OPEN", label: "Abiertos (sin cerrar)" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "PENDING_PAYMENT", label: EVENT_STATUS_LABELS.PENDING_PAYMENT },
  { value: "CONFIRMED", label: EVENT_STATUS_LABELS.CONFIRMED },
  { value: "PLANNING", label: EVENT_STATUS_LABELS.PLANNING },
  { value: "READY", label: EVENT_STATUS_LABELS.READY },
  { value: "IN_PROGRESS", label: EVENT_STATUS_LABELS.IN_PROGRESS },
  { value: "COMPLETED", label: EVENT_STATUS_LABELS.COMPLETED },
  { value: "CANCELLED", label: EVENT_STATUS_LABELS.CANCELLED },
];

const compactMXN = (cents: number) => {
  const pesos = cents / 100;
  if (Math.abs(pesos) >= 1_000_000) return `$${(pesos / 1_000_000).toFixed(1)}M`;
  if (Math.abs(pesos) >= 1_000) return `$${Math.round(pesos / 1_000)}k`;
  return `$${Math.round(pesos)}`;
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("financials:read");
  const sp = await searchParams;
  const filters = parseFinanceFilters(sp);

  const [{ rows, truncated }, revenue, recentPayments, balances] = await Promise.all([
    getFinanceRows(filters),
    getRevenueByMonth(6),
    getRecentPayments(8),
    getOutstandingBalances(10),
  ]);
  const totals = financeTotals(rows);

  const exportParams = new URLSearchParams();
  if (filters.month) exportParams.set("month", filters.month);
  if (filters.status) exportParams.set("status", filters.status);
  const exportHref = `/admin/finance/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;
  const scopeLabel = [
    filters.month ? monthLongLabel(filters.month) : "Todos los meses",
    filters.status ? STATUS_FILTER_OPTIONS.find((o) => o.value === filters.status)?.label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Inteligencia"
        title="Finanzas"
        description="Venta, cobranza, costos y márgenes por evento. Los márgenes se calculan sobre el ingreso neto de IVA."
        actions={
          <Button asChild variant="outline" size="lg">
            <a href={exportHref} download>
              <Download aria-hidden /> Exportar CSV
            </a>
          </Button>
        }
      />

      <section aria-labelledby="finance-kpis" className="space-y-3">
        <h2 id="finance-kpis" className="text-muted-foreground text-sm">
          Resumen · {scopeLabel} · {totals.count} {totals.count === 1 ? "evento" : "eventos"}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Venta"
            icon={BadgeDollarSign}
            value={formatMXN(totals.saleCents)}
            hint="IVA incluido"
          />
          <StatCard
            label="Cobrado"
            icon={HandCoins}
            value={formatMXN(totals.collectedCents)}
            hint="Neto de reembolsos"
          />
          <StatCard
            label="Saldo por cobrar"
            icon={Wallet}
            value={formatMXN(totals.balanceCents)}
            tone={totals.balanceCents > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Margen estimado"
            icon={Percent}
            value={<MarginPct bps={totals.estimatedMarginBps} />}
            tone={totals.estimatedMarginBps != null && totals.estimatedMarginBps < 0 ? "danger" : "default"}
            hint={`Costo estimado ${formatMXN(totals.estimatedCostCents)}`}
          />
          <StatCard
            label="Margen real"
            icon={PiggyBank}
            value={<MarginPct bps={totals.actualMarginBps} />}
            tone={totals.actualMarginBps != null && totals.actualMarginBps < 0 ? "danger" : "default"}
            hint={
              totals.withFinalActuals > 0
                ? `${totals.withFinalActuals} evento(s) con costo definitivo`
                : "Se calcula al completar eventos"
            }
          />
        </div>
      </section>

      <Section
        title="Eventos"
        description="Negativos en rojo. Toca un evento para ver su rentabilidad completa."
      >
        <Suspense fallback={null}>
          <FinanceFilters
            key={`${filters.month ?? ""}|${filters.status ?? ""}`}
            months={monthOptions(12, 6)}
            statuses={STATUS_FILTER_OPTIONS}
            month={filters.month}
            status={filters.status}
          />
        </Suspense>
        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No hay eventos con estos filtros"
            description="Prueba con otro mes o estado. Aquí aparecen los eventos con cotización o reserva."
            action={
              <Button asChild variant="outline">
                <Link href="/admin/finance">Ver todos</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="space-y-3 md:hidden" aria-label="Eventos">
              {rows.map((r) => (
                <li key={r.id} className="bg-card rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/events/${r.id}/financials`}
                        className="block truncate font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {formatShortDate(r.eventDate)} · <span className="font-mono">{r.code}</span>
                      </p>
                    </div>
                    <StatusBadge tone={r.closed ? "neutral" : EVENT_STATUS_TONES[r.status]}>
                      {r.closed ? "Cerrado" : EVENT_STATUS_LABELS[r.status]}
                    </StatusBadge>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                    <MiniFigure label="Venta">{formatMXN(r.saleCents)}</MiniFigure>
                    <MiniFigure label="Cobrado">{formatMXN(r.collectedCents)}</MiniFigure>
                    <MiniFigure label="Saldo" warning={r.balanceCents > 0}>
                      {formatMXN(r.balanceCents)}
                    </MiniFigure>
                    <MiniFigure label="Costo est.">{formatMXN(r.estimatedCostCents)}</MiniFigure>
                    <MiniFigure label={r.actualIsFinal ? "Costo real" : "Costo real (parcial)"}>
                      {r.actualCostCents != null ? (
                        formatMXN(r.actualCostCents)
                      ) : (
                        <span className="text-muted-foreground text-xs italic">sin registrar</span>
                      )}
                    </MiniFigure>
                    <MiniFigure label="Margen est.">
                      <MarginPct bps={r.estimatedCostCents > 0 ? r.estimatedMarginBps : null} />
                    </MiniFigure>
                    <MiniFigure label={r.actualIsFinal ? "Margen real" : "Margen real (parcial)"}>
                      {r.actualCostCents != null ? (
                        <MarginPct
                          bps={r.actualMarginBps}
                          className={r.actualIsFinal ? undefined : "text-muted-foreground"}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs italic">sin registrar</span>
                      )}
                    </MiniFigure>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="bg-card hidden rounded-xl border md:block">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Fecha</TableHead>
                    <TableHead scope="col">Evento</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Venta
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Cobrado
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Saldo
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Costo est.
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Costo real
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Margen est.
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Margen real
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular whitespace-nowrap">
                        {formatShortDate(r.eventDate)}
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <Link
                          href={`/admin/events/${r.id}/financials`}
                          className="text-foreground block truncate font-medium hover:underline"
                        >
                          {r.title}
                        </Link>
                        <span className="text-muted-foreground font-mono text-xs">{r.code}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge tone={EVENT_STATUS_TONES[r.status]}>
                            {EVENT_STATUS_LABELS[r.status]}
                          </StatusBadge>
                          {r.closed ? (
                            <StatusBadge tone="neutral" dot={false}>
                              Cerrado
                            </StatusBadge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-right">{formatMXN(r.saleCents)}</TableCell>
                      <TableCell className="tabular text-right">{formatMXN(r.collectedCents)}</TableCell>
                      <TableCell
                        className={
                          r.balanceCents > 0
                            ? "tabular text-warning text-right font-medium"
                            : "tabular text-right"
                        }
                      >
                        {formatMXN(r.balanceCents)}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatMXN(r.estimatedCostCents)}</TableCell>
                      <TableCell className="text-right">
                        {r.actualCostCents != null ? (
                          <span className="tabular">{formatMXN(r.actualCostCents)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">sin registrar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <MarginPct bps={r.estimatedCostCents > 0 ? r.estimatedMarginBps : null} />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.actualCostCents == null ? (
                          <MarginPct bps={null} />
                        ) : r.actualIsFinal ? (
                          <MarginPct bps={r.actualMarginBps} />
                        ) : (
                          <span title="Costos reales parciales: el evento aún no se completa">
                            <MarginPct bps={r.actualMarginBps} className="text-muted-foreground" />
                            <span className="text-muted-foreground block text-[11px]">parcial</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Totales ({totals.count})
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(totals.saleCents)}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(totals.collectedCents)}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(totals.balanceCents)}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(totals.estimatedCostCents)}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {totals.withActuals > 0 ? formatMXN(totals.actualCostCents) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <MarginPct bps={totals.estimatedMarginBps} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <MarginPct bps={totals.actualMarginBps} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </>
        )}
        {truncated ? (
          <p className="text-muted-foreground text-xs">
            Mostrando los {FINANCE_ROW_LIMIT} eventos más recientes. Filtra por mes para ver el resto o
            exporta el CSV.
          </p>
        ) : null}
      </Section>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-5">
        <Section
          title="Vendido vs cobrado"
          description="Últimos 6 meses · ventas confirmadas por fecha de reserva y cobros por fecha de pago."
          className="xl:col-span-3"
        >
          <div className="bg-card rounded-xl border p-4 sm:p-5">
            {revenue.every((m) => m.soldCents === 0 && m.collectedCents === 0) ? (
              <EmptyState
                icon={BadgeDollarSign}
                title="Sin movimientos"
                description="Aún no hay ventas ni cobros en los últimos 6 meses."
                className="border-0"
              />
            ) : (
              <BarChart
                title="Vendido vs cobrado, últimos 6 meses"
                data={revenue.map((m) => ({ label: m.label, values: [m.soldCents, m.collectedCents] }))}
                series={[
                  { name: "Vendido", color: "chart-1" },
                  { name: "Cobrado", color: "chart-5" },
                ]}
                formatValue={formatMXN}
                formatAxis={compactMXN}
              />
            )}
          </div>
        </Section>

        <Section
          title="Saldos pendientes"
          description="Eventos activos con saldo por cobrar."
          className="xl:col-span-2"
        >
          {balances.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="Todo cobrado"
              description="No hay saldos pendientes en eventos activos."
            />
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {balances.map((b) => (
                <li key={b.eventId} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/events/${b.eventId}/financials`}
                      className="block truncate font-medium hover:underline"
                    >
                      {b.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {b.customerName} · evento {formatShortDate(b.eventDate)}
                      {b.balanceDueAt ? ` · vence ${formatShortDate(b.balanceDueAt)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular font-semibold">{formatMXN(b.balanceCents)}</p>
                    {b.depositPending ? (
                      <StatusBadge tone="warning">Anticipo pendiente</StatusBadge>
                    ) : (
                      <p className="text-muted-foreground tabular text-xs">de {formatMXN(b.totalCents)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Pagos recientes">
        {recentPayments.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Sin pagos todavía"
            description="Cuando entren anticipos y saldos aparecerán aquí."
          />
        ) : (
          <>
            <ul className="bg-card divide-y rounded-xl border md:hidden" aria-label="Pagos recientes">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/events/${p.booking.event.id}/financials`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {p.booking.event.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {p.paidAt ? formatShortDate(p.paidAt) : "—"} · {PAYMENT_KIND_LABELS[p.kind]} ·{" "}
                      {PAYMENT_METHOD_LABELS[p.method]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <Money
                      cents={p.kind === "REFUND" ? -p.amountCents : p.amountCents}
                      className="font-semibold"
                    />
                    <span className="text-muted-foreground block text-xs">
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="bg-card hidden rounded-xl border md:block">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Fecha</TableHead>
                    <TableHead scope="col">Evento</TableHead>
                    <TableHead scope="col">Concepto</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Monto
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Comisión
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular whitespace-nowrap">
                        {p.paidAt ? formatShortDate(p.paidAt) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <Link
                          href={`/admin/events/${p.booking.event.id}/financials`}
                          className="block truncate font-medium hover:underline"
                        >
                          {p.booking.event.title}
                        </Link>
                        <span className="text-muted-foreground text-xs">{p.booking.customer.name}</span>
                      </TableCell>
                      <TableCell>
                        {PAYMENT_KIND_LABELS[p.kind]}
                        <span className="text-muted-foreground block text-xs">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={PAYMENT_STATUS_TONES[p.status]}>
                          {PAYMENT_STATUS_LABELS[p.status]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money cents={p.kind === "REFUND" ? -p.amountCents : p.amountCents} />
                        {p.refundedCents > 0 ? (
                          <span className="text-muted-foreground block text-xs">
                            reemb. {formatMXN(p.refundedCents)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatMXN(p.feeCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function MiniFigure({
  label,
  warning,
  children,
}: {
  label: string;
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground truncate text-[11px]">{label}</dt>
      <dd className={warning ? "tabular text-warning font-medium" : "tabular font-medium"}>{children}</dd>
    </div>
  );
}
