import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardCheck, ClipboardList, PackageX, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatLongDate, localTime } from "@/lib/dates";
import {
  CHECKLIST_AREA_LABELS,
  CHECKLIST_PHASE_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/session";
import { daysUntilDateOnly, ucfirst } from "@/features/operations/domain/production";
import { getOperationsOverview } from "@/features/operations/server/ops-queries";
import { ProgressBar } from "@/features/operations/components/progress-bar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operaciones" };

function whenLabel(eventDate: Date): string {
  const d = daysUntilDateOnly(eventDate);
  if (d <= 0) return "Hoy";
  if (d === 1) return "Mañana";
  return `En ${d} días`;
}

export default async function OperationsPage() {
  await requirePagePermission("operations:read", "/admin/operations");
  const now = new Date();
  const { board, overdueItems, overdueTotal, totals } = await getOperationsOverview(now);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operación"
        title="Operaciones"
        description="Los próximos 14 días de un vistazo: avance de checklists, tareas vencidas, staff e inventario."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/operations/templates">
              <ClipboardList className="size-4" aria-hidden />
              Plantillas de checklist
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Eventos próximos" value={totals.events} hint="Siguientes 14 días" icon={CalendarClock} />
        <StatCard
          label="Tareas vencidas"
          value={totals.overdue}
          hint="En todos los eventos no cancelados"
          icon={AlertTriangle}
          tone={totals.overdue > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Sin coordinación"
          value={totals.withoutCoordinator}
          hint="Eventos sin coordinadora asignada"
          icon={UserX}
          tone={totals.withoutCoordinator > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Con faltantes"
          value={totals.withShortages}
          hint="Inventario insuficiente ese día"
          icon={PackageX}
          tone={totals.withShortages > 0 ? "warning" : "default"}
        />
      </div>

      <section aria-labelledby="proximos" className="space-y-4">
        <h2 id="proximos" className="font-heading text-2xl font-semibold">
          Próximos eventos
        </h2>
        {board.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sin eventos en los próximos 14 días"
            description="Cuando se confirme una celebración aparecerá aquí con su checklist y staff."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/events">Ver todos los eventos</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {board.map((e) => (
              <li key={e.id}>
                <article
                  className={cn(
                    "bg-card flex h-full flex-col gap-4 rounded-2xl border p-5 shadow-xs",
                    (e.overdueCount > 0 || e.shortages.length > 0) && "border-warning/40",
                  )}
                >
                  <header className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="eyebrow">
                        {whenLabel(e.eventDate)} · {localTime(e.startsAt)}
                      </p>
                      <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
                    </div>
                    <h3 className="font-heading text-xl leading-tight font-semibold">
                      <Link href={`/admin/events/${e.id}/operations`} className="hover:underline">
                        {e.title}
                      </Link>
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {ucfirst(formatLongDate(e.eventDate))}
                      {e.neighborhood ? ` · ${e.neighborhood}` : ""}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {e.customerName} · {e.guestCount} invitadas{e.experienceName ? ` · ${e.experienceName}` : ""}
                    </p>
                  </header>

                  <div className="space-y-1">
                    <p className="text-xs font-medium">Preparación</p>
                    {e.progress.total > 0 ? (
                      <ProgressBar progress={e.progress} label={`Preparación de ${e.title}`} />
                    ) : (
                      <p className="text-muted-foreground text-xs">Sin checklist generado.</p>
                    )}
                  </div>

                  <ul className="flex flex-wrap gap-2 text-xs" aria-label="Alertas">
                    {e.overdueCount > 0 ? (
                      <li>
                        <StatusBadge tone="danger" dot={false}>
                          <AlertTriangle className="size-3" aria-hidden />
                          {e.overdueCount} vencida{e.overdueCount === 1 ? "" : "s"}
                        </StatusBadge>
                      </li>
                    ) : null}
                    <li>
                      <StatusBadge tone={e.staffCount > 0 ? "neutral" : "warning"} dot={false}>
                        {e.staffCount} en staff
                      </StatusBadge>
                    </li>
                    {!e.hasCoordinator ? (
                      <li>
                        <StatusBadge tone="warning" dot={false}>
                          <UserX className="size-3" aria-hidden />
                          Falta coordinación
                        </StatusBadge>
                      </li>
                    ) : null}
                    {e.shortages.length > 0 ? (
                      <li>
                        <StatusBadge tone="warning" dot={false}>
                          <PackageX className="size-3" aria-hidden />
                          Faltante de inventario
                        </StatusBadge>
                      </li>
                    ) : (
                      <li>
                        <StatusBadge tone="success" dot={false}>
                          Inventario OK
                        </StatusBadge>
                      </li>
                    )}
                  </ul>

                  {e.shortages.length > 0 ? (
                    <ul className="text-warning space-y-0.5 text-xs" aria-label="Artículos con faltante">
                      {e.shortages.slice(0, 4).map((s) => (
                        <li key={s.sku}>
                          {s.name}: {s.reserved} reservados ese día, {s.available} disponibles
                        </li>
                      ))}
                      {e.shortages.length > 4 ? <li>y {e.shortages.length - 4} más…</li> : null}
                    </ul>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/admin/events/${e.id}/operations`}>
                        <ClipboardCheck className="size-4" aria-hidden />
                        Orden de producción
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/events/${e.id}/operations#checklist`}>Checklist</Link>
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="vencidas" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="vencidas" className="font-heading text-2xl font-semibold">
              Tareas vencidas
            </h2>
            <p className="text-muted-foreground text-sm">
              Pendientes o en proceso cuya fecha límite ya pasó
              {overdueTotal > overdueItems.length ? ` (mostrando ${overdueItems.length} de ${overdueTotal})` : ""}.
            </p>
          </div>
        </div>
        {overdueItems.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Todo al día" description="No hay tareas vencidas en ningún evento. ¡Bien hecho, equipo!" />
        ) : (
          <div className="bg-card overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">Tareas vencidas en todos los eventos</caption>
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th scope="col" className="px-4 py-2 font-medium">Tarea</th>
                  <th scope="col" className="px-4 py-2 font-medium">Evento</th>
                  <th scope="col" className="hidden px-4 py-2 font-medium md:table-cell">Fase</th>
                  <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">Responsable</th>
                  <th scope="col" className="px-4 py-2 font-medium">Venció</th>
                </tr>
              </thead>
              <tbody>
                {overdueItems.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{i.title}</p>
                      <p className="text-muted-foreground text-xs">{CHECKLIST_AREA_LABELS[i.area]}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/events/${i.event.id}/operations#checklist`} className="hover:underline">
                        {i.event.title}
                      </Link>
                      <p className="text-muted-foreground font-mono text-xs">{i.event.code}</p>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">{CHECKLIST_PHASE_LABELS[i.phase]}</td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      {i.assignee?.name ?? <span className="text-warning">Sin responsable</span>}
                    </td>
                    <td className="text-destructive px-4 py-2.5 text-xs whitespace-nowrap">{i.dueAt ? formatDateTime(i.dueAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
