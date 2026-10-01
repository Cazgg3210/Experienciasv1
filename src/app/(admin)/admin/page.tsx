import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertOctagon,
  BadgeDollarSign,
  Boxes,
  CalendarClock,
  CalendarDays,
  HandCoins,
  Megaphone,
  Percent,
  PiggyBank,
  Receipt,
  Target,
  UsersRound,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts/sparkline";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { formatLongDate, localDateKey, localTime } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { formatChange, formatPercentBps } from "@/features/analytics/domain/metrics";
import {
  getCriticalPending,
  getDashboardKpis,
  getIncompleteRsvp,
  getInventoryConflicts,
  getNextSevenDays,
  getPendingPayments,
} from "@/features/analytics/server/dashboard-queries";
import { getRevenueByMonth } from "@/features/financials/server/finance-queries";
import {
  CriticalPendingList,
  IncompleteRsvpList,
  InventoryConflictsList,
  NextSevenDaysList,
  PendingPaymentsList,
  Widget,
} from "@/features/analytics/components/dashboard-widgets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Resumen" };

function greetingFor(now: Date): string {
  const hour = Number(localTime(now).slice(0, 2));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function AdminHomePage() {
  const user = await requirePagePermission("dashboard:view");
  const now = new Date();
  const showFinance = can(user.role, "financials:read");

  const [kpis, nextSeven, critical, conflicts, payments, rsvp, revenue] = await Promise.all([
    getDashboardKpis(now),
    getNextSevenDays(now),
    getCriticalPending(now),
    getInventoryConflicts(now),
    getPendingPayments(now),
    getIncompleteRsvp(now),
    showFinance ? getRevenueByMonth(6, now) : Promise.resolve([]),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || "equipo";
  const today = formatLongDate(localDateKey(now));
  // Misma suma que los contadores de los widgets (incluye saldos que vencen en 7 días o vencidos).
  const attention =
    critical.total + conflicts.length + payments.deposits.length + payments.balances.length + rsvp.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<span className="first-letter:uppercase">{today}</span>}
        title={`Hola, ${firstName}`}
        description={
          attention > 0
            ? `${greetingFor(now)}. Hay ${attention} ${attention === 1 ? "asunto que necesita" : "asuntos que necesitan"} tu atención hoy; aquí tienes el pulso del negocio.`
            : `${greetingFor(now)}. Todo está en orden: aquí tienes el pulso del negocio.`
        }
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin/leads">
                <Megaphone aria-hidden /> Leads
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/admin/events">
                <CalendarDays aria-hidden /> Eventos
              </Link>
            </Button>
          </>
        }
      />

      <section aria-labelledby="kpis-heading" className="space-y-3">
        <h2 id="kpis-heading" className="sr-only">
          Indicadores clave
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Leads · 30 días"
            icon={Megaphone}
            value={kpis.leads.current}
            tone={kpis.leads.changeBps != null && kpis.leads.changeBps < 0 ? "warning" : "default"}
            hint={`${formatChange(kpis.leads.changeBps)} vs 30 días previos (${kpis.leads.previous})`}
          />
          <StatCard
            label="Conversión"
            icon={Target}
            value={formatPercentBps(kpis.conversion.rateBps)}
            hint={
              kpis.conversion.won + kpis.conversion.lost > 0
                ? `${kpis.conversion.won} ganados de ${kpis.conversion.won + kpis.conversion.lost} cerrados · 90 días`
                : "Sin leads cerrados en 90 días"
            }
          />
          <StatCard
            label="Próximos eventos · 30 días"
            icon={CalendarClock}
            value={kpis.upcoming.count}
            hint={`${kpis.upcoming.guests} invitadas en total`}
          />
          <StatCard
            label={`Ventas confirmadas · ${kpis.revenueMonth.label}`}
            icon={BadgeDollarSign}
            value={formatMXN(kpis.revenueMonth.soldCents)}
            hint={
              <span className="flex items-center justify-between gap-2">
                <span>Cobrado del mes: {formatMXN(kpis.revenueMonth.collectedCents)}</span>
                {revenue.length > 1 ? (
                  <Sparkline
                    values={revenue.map((m) => m.collectedCents)}
                    label="Cobrado, últimos 6 meses"
                    formatValue={formatMXN}
                    className="h-6 w-20"
                  />
                ) : null}
              </span>
            }
          />
          <StatCard
            label="Ticket promedio"
            icon={Receipt}
            value={kpis.avgTicket.cents != null ? formatMXN(kpis.avgTicket.cents) : "—"}
            hint={
              kpis.avgTicket.count > 0
                ? `${kpis.avgTicket.count} reservas confirmadas · 90 días`
                : "Sin reservas en 90 días"
            }
          />
          <StatCard
            label="Margen estimado promedio"
            icon={Percent}
            value={formatPercentBps(kpis.estimatedMargin.bps, 1)}
            tone={kpis.estimatedMargin.bps != null && kpis.estimatedMargin.bps < 0 ? "danger" : "default"}
            hint={`Ponderado · ${kpis.estimatedMargin.count} eventos (±90 días)`}
          />
          <StatCard
            label="Margen real promedio"
            icon={PiggyBank}
            value={formatPercentBps(kpis.actualMargin.bps, 1)}
            tone={
              kpis.actualMargin.bps != null && kpis.actualMargin.bps < 0
                ? "danger"
                : kpis.actualMargin.bps != null
                  ? "success"
                  : "default"
            }
            hint={
              kpis.actualMargin.count > 0
                ? `${kpis.actualMargin.count} evento(s) cerrado(s) · 12 meses`
                : "Aún no hay eventos cerrados"
            }
          />
          <StatCard
            label="Saldos pendientes"
            icon={Wallet}
            value={formatMXN(kpis.pendingBalances.cents)}
            tone={kpis.pendingBalances.cents > 0 ? "warning" : "default"}
            hint={
              showFinance ? (
                <Link
                  href="/admin/finance"
                  className="hover:text-foreground underline-offset-4 hover:underline"
                >
                  {kpis.pendingBalances.count} evento(s) activos · ver finanzas
                </Link>
              ) : (
                `${kpis.pendingBalances.count} evento(s) activos`
              )
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Widget
          title="Próximos 7 días"
          icon={CalendarDays}
          count={nextSeven.length}
          href="/admin/calendar"
          hrefLabel="Calendario"
          className="lg:col-span-3"
        >
          <NextSevenDaysList events={nextSeven} />
        </Widget>
        <Widget
          title="Pendientes críticos"
          icon={AlertOctagon}
          count={critical.total}
          tone="danger"
          className="lg:col-span-2"
        >
          <CriticalPendingList data={critical} now={now} />
        </Widget>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Widget
          title="Pagos pendientes"
          icon={HandCoins}
          count={payments.deposits.length + payments.balances.length}
          tone="warning"
          href={showFinance ? "/admin/finance" : undefined}
          hrefLabel="Finanzas"
        >
          <PendingPaymentsList data={payments} now={now} />
        </Widget>
        <Widget
          title="Inventario en conflicto"
          icon={Boxes}
          count={conflicts.length}
          tone="danger"
          href="/admin/inventory"
          hrefLabel="Inventario"
        >
          <InventoryConflictsList conflicts={conflicts} />
        </Widget>
        <Widget title="RSVP incompleto" icon={UsersRound} count={rsvp.length} tone="warning">
          <IncompleteRsvpList events={rsvp} />
        </Widget>
      </div>
    </div>
  );
}
