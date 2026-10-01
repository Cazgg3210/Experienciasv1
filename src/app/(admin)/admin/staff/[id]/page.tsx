import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Clock, ListTodo, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatLongDate, formatShortDate, localTime } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES, STAFF_FUNCTION_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { ucfirst } from "@/features/operations/domain/production";
import { formatRate, formatWeekdays } from "@/features/staff/domain/staff";
import { getStaffDetail } from "@/features/staff/server/staff-queries";
import { StaffForm } from "@/features/staff/components/staff-form";
import { StaffAccessCard } from "@/features/staff/components/staff-access-card";
import { DeleteStaffButton } from "@/features/staff/components/delete-staff-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integrante" };

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("staff:read", `/admin/staff/${id}`);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const detail = await getStaffDetail(id);
  if (!detail) notFound();
  const { member, upcoming, history, totals, openTasks } = detail;
  const canWrite = can(user.role, "staff:write");
  const canManageUsers = can(user.role, "users:manage");
  const canSeeEvents = can(user.role, "operations:read");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Staff · ${STAFF_FUNCTION_LABELS[member.primaryFunction]}`}
        title={member.name}
        description={`${formatRate(member.rateCents, member.rateType)} · ${formatWeekdays(member.availableWeekdays)}`}
        back={{ href: "/admin/staff", label: "Staff" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={member.active ? "success" : "muted"}>{member.active ? "Activa" : "Inactiva"}</StatusBadge>
            {canWrite && member.assignments.length === 0 ? <DeleteStaffButton id={member.id} name={member.name} /> : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Próximos eventos" value={upcoming.length} icon={CalendarClock} />
        <StatCard label="Tareas abiertas" value={openTasks} icon={ListTodo} />
        <StatCard label="Total asignado" value={formatMXN(totals.total)} hint={`${totals.count} asignaciones`} icon={Wallet} />
        <StatCard label="Pagado" value={formatMXN(totals.paid)} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Pendiente de pago"
          value={formatMXN(totals.pending)}
          icon={Clock}
          tone={totals.pending > 0 ? "warning" : "default"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="space-y-8">
          <section aria-labelledby="proximas" className="space-y-3">
            <h2 id="proximas" className="font-heading text-2xl font-semibold">
              Próximas asignaciones
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Sin eventos próximos" description="Asígnala desde la orden de producción de un evento." />
            ) : (
              <ul className="divide-y rounded-xl border">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {canSeeEvents ? (
                        <Link href={`/admin/events/${a.event.id}/operations#staff`} className="font-medium hover:underline">
                          {a.event.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{a.event.title}</p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        {ucfirst(formatLongDate(a.event.eventDate))} · {localTime(a.startsAt)}–{localTime(a.endsAt)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {STAFF_FUNCTION_LABELS[a.function]}
                        {a.event.neighborhood ? ` · ${a.event.neighborhood}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm tabular-nums">{formatMXN(a.amountCents)}</span>
                      <StatusBadge tone={a.confirmed ? "success" : "warning"}>{a.confirmed ? "Confirmada" : "Por confirmar"}</StatusBadge>
                      <StatusBadge tone={a.paid ? "success" : "muted"}>{a.paid ? "Pagada" : "Sin pagar"}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="historial" className="space-y-3">
            <h2 id="historial" className="font-heading text-2xl font-semibold">
              Historial
            </h2>
            {history.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">Todavía no tiene eventos pasados.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Historial de eventos y pagos</caption>
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                      <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                      <th scope="col" className="px-4 py-2 font-medium">Evento</th>
                      <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">Función</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Monto</th>
                      <th scope="col" className="px-4 py-2 font-medium">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5 whitespace-nowrap">{formatShortDate(a.event.eventDate)}</td>
                        <td className="px-4 py-2.5">
                          {canSeeEvents ? (
                            <Link href={`/admin/events/${a.event.id}/operations`} className="hover:underline">
                              {a.event.title}
                            </Link>
                          ) : (
                            a.event.title
                          )}
                          {a.event.status !== "COMPLETED" ? (
                            <StatusBadge tone={EVENT_STATUS_TONES[a.event.status]} className="ml-2">
                              {EVENT_STATUS_LABELS[a.event.status]}
                            </StatusBadge>
                          ) : null}
                        </td>
                        <td className="hidden px-4 py-2.5 sm:table-cell">{STAFF_FUNCTION_LABELS[a.function]}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {a.event.status === "CANCELLED" ? <s className="text-muted-foreground">{formatMXN(a.amountCents)}</s> : formatMXN(a.amountCents)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge tone={a.paid ? "success" : "warning"}>{a.paid ? "Pagada" : "Pendiente"}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="acceso" className="bg-card rounded-2xl border p-5 shadow-xs">
            <h2 id="acceso" className="font-heading mb-3 text-xl font-semibold">
              Acceso al portal
            </h2>
            <StaffAccessCard
              staffMemberId={member.id}
              staffName={member.name}
              defaultEmail={member.email}
              canManage={canManageUsers}
              loginUrl={appUrl("/login")}
              access={
                member.user
                  ? {
                      email: member.user.email,
                      active: member.user.active,
                      lastLoginLabel: member.user.lastLoginAt ? formatDateTime(member.user.lastLoginAt) : null,
                    }
                  : null
              }
            />
          </section>
        </div>
      </div>

      <section aria-labelledby="datos" className="bg-card max-w-3xl rounded-2xl border p-5 shadow-xs sm:p-6">
        <h2 id="datos" className="font-heading mb-4 text-xl font-semibold">
          Datos del integrante
        </h2>
        <StaffForm
          canWrite={canWrite}
          initial={{
            id: member.id,
            name: member.name,
            primaryFunction: member.primaryFunction,
            phone: member.phone,
            email: member.email,
            rateCents: member.rateCents,
            rateType: member.rateType,
            availableWeekdays: member.availableWeekdays,
            availabilityNotes: member.availabilityNotes,
            active: member.active,
          }}
        />
      </section>
    </div>
  );
}
