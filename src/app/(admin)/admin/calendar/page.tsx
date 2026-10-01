import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatLongDate, localDateKey } from "@/lib/dates";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { prisma } from "@/db";
import { getSettings } from "@/features/settings/server/settings-service";
import { monthLabel, parseMonthParam, shiftMonth } from "@/features/bookings/domain/calendar-month";
import { getCalendarMonth } from "@/features/bookings/server/calendar-queries";
import { getWeeklyRules, listExceptions } from "@/features/bookings/server/availability-admin-service";
import { CalendarLegend, CalendarMonthView } from "@/features/bookings/components/calendar-month-view";
import { WeeklyRulesForm } from "@/features/bookings/components/weekly-rules-form";
import { ExceptionsManager } from "@/features/bookings/components/exceptions-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendario" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("events:read_all", "/admin/calendar");
  const sp = await searchParams;
  const todayKey = localDateKey();
  const monthKey = parseMonthParam(sp.month, todayKey);
  const canManage = can(user.role, "availability:write");
  const canCreate = can(user.role, "events:write");

  const [data, rules, exceptions, availability, serviceAreas] = await Promise.all([
    getCalendarMonth(monthKey),
    canManage ? getWeeklyRules() : Promise.resolve([]),
    canManage ? listExceptions(todayKey) : Promise.resolve([]),
    getSettings("availability"),
    canManage
      ? prisma.serviceArea.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const prev = shiftMonth(monthKey, -1);
  const next = shiftMonth(monthKey, 1);
  const isCurrent = monthKey === todayKey.slice(0, 7);
  const navCls =
    "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Calendario"
        description="Eventos del mes y capacidad disponible por día."
        actions={
          canCreate ? (
            <Button asChild size="lg">
              <Link href="/admin/events/new">
                <Plus aria-hidden />
                Nuevo evento
              </Link>
            </Button>
          ) : null
        }
      />

      <section aria-labelledby="month-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="month-title" className="font-heading text-2xl font-semibold capitalize" aria-live="polite">
            {monthLabel(monthKey)}
          </h2>
          <nav aria-label="Cambiar de mes" className="flex items-center gap-2">
            <Link href={`/admin/calendar?month=${prev}`} className={navCls} rel="prev">
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Anterior</span>
              <span className="sr-only">: {monthLabel(prev)}</span>
            </Link>
            <Link href="/admin/calendar" className={navCls} aria-current={isCurrent ? "date" : undefined}>
              Hoy
            </Link>
            <Link href={`/admin/calendar?month=${next}`} className={navCls} rel="next">
              <span className="sr-only sm:not-sr-only">Siguiente</span>
              <span className="sr-only">: {monthLabel(next)}</span>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CalendarLegend />
          <p className="text-muted-foreground text-sm">
            {data.totals.events === 1 ? "1 evento" : `${data.totals.events} eventos`} en el mes
            {data.totals.cancelled
              ? ` · ${data.totals.cancelled} cancelado${data.totals.cancelled === 1 ? "" : "s"} (no se muestran)`
              : ""}
          </p>
        </div>
        <CalendarMonthView data={data} todayKey={todayKey} canCreate={canCreate} />
      </section>

      {canManage ? (
        <section aria-labelledby="availability-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="availability-title" className="font-heading text-2xl font-semibold">
                Disponibilidad
              </h2>
              <p className="text-muted-foreground text-sm">
                Buffer entre eventos: {availability.bufferMinutes} min · anticipación mínima:{" "}
                {availability.minLeadDays} días · reservas hasta {availability.maxAdvanceDays} días antes.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/settings">
                <Settings2 aria-hidden />
                Buffer y anticipación
              </Link>
            </Button>
          </div>
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="bg-card rounded-xl border p-4 shadow-xs sm:p-5">
              <WeeklyRulesForm rules={rules} />
            </div>
            <div className="bg-card rounded-xl border p-4 shadow-xs sm:p-5">
              <ExceptionsManager
                minDate={todayKey}
                serviceAreas={serviceAreas}
                exceptions={exceptions.map((e) => ({
                  id: e.id,
                  date: e.date,
                  dateLabel: formatLongDate(e.date),
                  type: e.type,
                  maxEvents: e.maxEvents,
                  reason: e.reason,
                  serviceAreaName: e.serviceAreaName,
                }))}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
