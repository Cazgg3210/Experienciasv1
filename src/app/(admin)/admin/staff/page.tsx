import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Search, UserPlus, Users } from "lucide-react";
import type { StaffFunction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { STAFF_FUNCTION_LABELS, toOptions } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { formatRate, formatWeekdays, initials } from "@/features/staff/domain/staff";
import { listStaff } from "@/features/staff/server/staff-queries";
import { NativeSelect } from "@/features/operations/components/native-select";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function StaffListPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePagePermission("staff:read", "/admin/staff");
  const sp = await searchParams;
  const q = (one(sp.q) ?? "").trim().slice(0, 80);
  const statusParam = one(sp.estado);
  const status = statusParam === "inactivos" ? "inactive" : statusParam === "todos" ? "all" : "active";
  const fnParam = one(sp.funcion);
  const fn = fnParam && fnParam in STAFF_FUNCTION_LABELS ? (fnParam as StaffFunction) : undefined;
  const members = await listStaff({ q: q || undefined, status, fn });
  const canWrite = can(user.role, "staff:write");
  const filtered = !!q || status !== "active" || !!fn;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Staff"
        description="El equipo que hace posible cada celebración: funciones, tarifas, disponibilidad y acceso al portal."
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/staff/new">
                <UserPlus className="size-4" aria-hidden />
                Nuevo integrante
              </Link>
            </Button>
          ) : null
        }
      />

      <form method="get" role="search" aria-label="Filtrar staff" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label htmlFor="staff-q" className="sr-only">
            Buscar por nombre, correo o teléfono
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input id="staff-q" name="q" defaultValue={q} placeholder="Buscar por nombre, correo o teléfono" className="pl-8" />
        </div>
        <div className="flex gap-2">
          <label htmlFor="staff-fn" className="sr-only">
            Función
          </label>
          <NativeSelect id="staff-fn" name="funcion" defaultValue={fn ?? ""} className="sm:w-48">
            <option value="">Todas las funciones</option>
            {toOptions(STAFF_FUNCTION_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <label htmlFor="staff-estado" className="sr-only">
            Estado
          </label>
          <NativeSelect id="staff-estado" name="estado" defaultValue={statusParam ?? "activos"} className="sm:w-36">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </NativeSelect>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </div>
      </form>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Nadie coincide con la búsqueda" : "Aún no hay integrantes en el equipo"}
          description={filtered ? "Prueba con otro nombre o quita los filtros." : "Agrega a coordinación, cocina, servicio y montaje para asignarlos a eventos."}
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/admin/staff">Quitar filtros</Link>
              </Button>
            ) : canWrite ? (
              <Button asChild>
                <Link href="/admin/staff/new">Agregar integrante</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="grid gap-3 md:hidden">
            {members.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/staff/${m.id}`} className="bg-card flex items-start gap-3 rounded-xl border p-4 shadow-xs">
                  <span className="bg-sage-soft text-olive flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold" aria-hidden>
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block font-medium">{m.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {STAFF_FUNCTION_LABELS[m.primaryFunction]} · {formatRate(m.rateCents, m.rateType)}
                    </span>
                    <span className="text-muted-foreground block text-xs">{formatWeekdays(m.availableWeekdays)}</span>
                    <span className="flex flex-wrap gap-1.5 pt-1">
                      {!m.active ? <StatusBadge tone="muted">Inactiva</StatusBadge> : null}
                      {m.user ? (
                        <StatusBadge tone={m.user.active ? "brand" : "muted"} dot={false}>
                          <KeyRound className="size-3" aria-hidden />
                          {m.user.active ? "Con acceso" : "Acceso desactivado"}
                        </StatusBadge>
                      ) : null}
                      {m.upcomingCount ? <StatusBadge tone="info">{m.upcomingCount} próximos</StatusBadge> : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Integrantes del equipo</caption>
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">Integrante</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Función</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contacto</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tarifa</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Días</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Próximos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/staff/${m.id}`} className="flex items-center gap-3 font-medium hover:underline">
                        <span className="bg-sage-soft text-olive flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold" aria-hidden>
                          {initials(m.name)}
                        </span>
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{STAFF_FUNCTION_LABELS[m.primaryFunction]}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.phone ? <a href={`tel:${m.phone}`} className="block hover:underline">{m.phone}</a> : null}
                      {m.email ? <span className="text-muted-foreground block break-all">{m.email}</span> : null}
                      {!m.phone && !m.email ? <span className="text-muted-foreground">—</span> : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatRate(m.rateCents, m.rateType)}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">{formatWeekdays(m.availableWeekdays)}</td>
                    <td className="px-4 py-3 tabular-nums">{m.upcomingCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge tone={m.active ? "success" : "muted"}>{m.active ? "Activa" : "Inactiva"}</StatusBadge>
                        {m.user ? (
                          <StatusBadge tone={m.user.active ? "brand" : "muted"} dot={false}>
                            <KeyRound className="size-3" aria-hidden />
                            {m.user.active ? "Con acceso" : "Acceso desactivado"}
                          </StatusBadge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
