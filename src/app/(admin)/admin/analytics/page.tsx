import type { Metadata } from "next";
import { BarChart3, Megaphone, PartyPopper, Sparkles, Ticket, WandSparkles } from "lucide-react";
import { PageHeader, Section } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { requirePagePermission } from "@/server/auth/session";
import { formatShortDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { ADDON_CATEGORY_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, OCCASION_LABELS } from "@/lib/labels";
import type { AddOnCategory } from "@prisma/client";
import {
  formatChange,
  formatPercentBps,
  parseRangeDays,
  toRankedRows,
} from "@/features/analytics/domain/metrics";
import {
  getAddOnRevenue,
  getAnalyticsOverview,
  getPopularExperiences,
} from "@/features/analytics/server/analytics-queries";
import { RangeTabs } from "@/features/analytics/components/range-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Analytics" };

const count = (n: number) => n.toLocaleString("es-MX");
const vsPrevious = (bps: number | null) =>
  bps == null ? "Sin actividad en el periodo previo" : `${formatChange(bps)} vs periodo previo`;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("analytics:read");
  const sp = await searchParams;
  const range = parseRangeDays(sp.range, 30);

  const [overview, experiences, addOns] = await Promise.all([
    getAnalyticsOverview(range),
    getPopularExperiences(range),
    getAddOnRevenue(),
  ]);
  const { funnel, counters, leads } = overview;
  const noFunnel = funnel.every((f) => f.count === 0);
  const experienceRows = experiences.filter((e) => e.views + e.leads + e.bookings > 0);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Inteligencia"
        title="Analytics"
        description={`Del ${formatShortDate(overview.from)} al ${formatShortDate(overview.to)}. Comparado contra los ${range} días anteriores.`}
        actions={<RangeTabs value={range} basePath="/admin/analytics" />}
      />

      <section aria-labelledby="analytics-kpis">
        <h2 id="analytics-kpis" className="sr-only">
          Indicadores del periodo
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Leads"
            icon={Megaphone}
            value={count(counters.leads.current)}
            hint={vsPrevious(counters.leads.changeBps)}
          />
          <StatCard
            label="Pagos exitosos"
            icon={Ticket}
            value={count(counters.payments.current)}
            hint={vsPrevious(counters.payments.changeBps)}
          />
          <StatCard
            label="RSVP recibidos"
            icon={PartyPopper}
            value={count(counters.rsvp.current)}
            hint={vsPrevious(counters.rsvp.changeBps)}
          />
          <StatCard
            label="Diseños con IA"
            icon={WandSparkles}
            value={count(counters.aiDesigns.current)}
            hint={vsPrevious(counters.aiDesigns.changeBps)}
          />
        </div>
      </section>

      <Section
        title="Embudo de conversión"
        description={`Recorridos únicos (visitas, solicitudes y cotizaciones), no clics repetidos.${
          overview.funnelOverallBps != null
            ? ` De cada 100 visitas a una experiencia, ${(overview.funnelOverallBps / 100).toFixed(1)} llegan a un pago exitoso.`
            : ""
        }`}
      >
        <div className="bg-card rounded-xl border p-4 sm:p-6">
          {noFunnel ? (
            <EmptyState
              icon={BarChart3}
              title="Sin actividad en este rango"
              description="Cuando las visitas recorran el sitio y el configurador, verás aquí el embudo."
              className="border-0"
            />
          ) : (
            <FunnelChart
              title={`Embudo de conversión, últimos ${range} días`}
              valueLabel="Únicos"
              data={funnel.map((f) => ({
                label: f.label,
                value: f.count,
                stepRate: f.stepRateBps != null ? formatPercentBps(f.stepRateBps, 1) : null,
                overallRate: f.overallRateBps != null ? formatPercentBps(f.overallRateBps, 1) : null,
              }))}
            />
          )}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Section title="Leads por origen" description={`${count(leads.total)} leads en el periodo.`}>
          <div className="bg-card rounded-xl border p-4 sm:p-5">
            <HorizontalBarChart
              title="Leads por origen"
              valueLabel="Leads"
              data={toRankedRows(leads.sources, LEAD_SOURCE_LABELS)}
              formatValue={count}
              emptyText="Sin leads en este rango."
            />
          </div>
        </Section>
        <Section title="Leads por estado" description="Estado actual de los leads creados en el periodo.">
          <div className="bg-card rounded-xl border p-4 sm:p-5">
            <HorizontalBarChart
              title="Leads por estado"
              valueLabel="Leads"
              data={toRankedRows(leads.statuses, LEAD_STATUS_LABELS)}
              formatValue={count}
              color="chart-3"
              emptyText="Sin leads en este rango."
            />
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
        <Section
          title="Experiencias populares"
          description="Vistas, leads y reservas en el periodo."
          className="lg:col-span-3"
        >
          {experienceRows.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Sin actividad por experiencia"
              description="Aún no hay vistas, leads ni reservas en este rango."
            />
          ) : (
            <div className="bg-card rounded-xl border">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Experiencia</TableHead>
                    <TableHead scope="col" className="text-right">
                      Vistas
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Leads
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Lead / vista
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Reservas
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Vendido
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experienceRows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.name}
                        {!e.active ? (
                          <span className="text-muted-foreground ml-1 text-xs">(inactiva)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular text-right">{count(e.views)}</TableCell>
                      <TableCell className="tabular text-right">{count(e.leads)}</TableCell>
                      <TableCell className="tabular text-right">
                        {formatPercentBps(e.leadRateBps, 1)}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold">{count(e.bookings)}</TableCell>
                      <TableCell className="tabular text-right">{formatMXN(e.bookedCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>

        <Section
          title="Mezcla de ocasiones"
          description="Qué celebran quienes nos escriben."
          className="lg:col-span-2"
        >
          <div className="bg-card rounded-xl border p-4 sm:p-5">
            <HorizontalBarChart
              title="Leads por ocasión"
              valueLabel="Leads"
              data={toRankedRows(leads.occasions, OCCASION_LABELS)}
              formatValue={count}
              color="chart-2"
              emptyText="Sin leads en este rango."
            />
          </div>
        </Section>
      </div>

      <Section
        title="Ingresos por add-ons"
        description="Precio × cantidad en eventos activos y completados (todas las fechas)."
      >
        {addOns.items.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Sin add-ons vendidos"
            description="Cuando se confirmen eventos con extras, verás aquí su aporte."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="bg-card self-start rounded-xl border p-4 sm:p-5 lg:col-span-2">
              <HorizontalBarChart
                title="Ingreso por add-on"
                valueLabel="Ingreso"
                data={addOns.items.slice(0, 8).map((a) => ({ label: a.name, value: a.revenueCents }))}
                formatValue={formatMXN}
              />
            </div>
            <div className="bg-card rounded-xl border lg:col-span-3">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Add-on</TableHead>
                    <TableHead scope="col" className="text-right">
                      Eventos
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Unidades
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Ingreso
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Margen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addOns.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {ADDON_CATEGORY_LABELS[a.category as AddOnCategory] ?? a.category}
                        </span>
                      </TableCell>
                      <TableCell className="tabular text-right">{count(a.events)}</TableCell>
                      <TableCell className="tabular text-right">{count(a.units)}</TableCell>
                      <TableCell className="tabular text-right">{formatMXN(a.revenueCents)}</TableCell>
                      <TableCell
                        className={
                          a.marginCents < 0 ? "tabular text-destructive text-right" : "tabular text-right"
                        }
                      >
                        {a.marginCents < 0 ? "−" : ""}
                        {formatMXN(Math.abs(a.marginCents))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(addOns.totalRevenueCents)}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(addOns.totalMarginCents)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
