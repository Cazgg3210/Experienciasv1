import type { Metadata } from "next";
import { Link2, Users } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ROLE_LABELS, type Tone } from "@/lib/labels";
import { formatDateTime } from "@/lib/dates";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { assignableRoles, isTeamRole } from "@/features/users/domain/user-rules";
import { listLinkableStaff, listTeamUsers } from "@/features/users/server/user-service";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { UserRowActions } from "@/features/users/components/user-row-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usuarios · Configuración" };

const ROLE_TONES: Record<string, Tone> = { SUPER_ADMIN: "brand", OWNER: "info", STAFF: "neutral", CUSTOMER: "muted" };

export default async function UsersSettingsPage() {
  const me = await requirePagePermission("users:manage", "/admin/settings/users");
  const [users, linkableStaff] = await Promise.all([listTeamUsers(), listLinkableStaff()]);
  const roles = assignableRoles(me.role);
  const canTouchSuperAdmins = can(me.role, "roles:assign_super_admin");
  const activeCount = users.filter((u) => u.active).length;

  return (
    <SettingsSection
      title="Usuarios y roles"
      description={`${activeCount} cuenta${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"} del equipo. Cada cambio de rol, estado o contraseña queda en Auditoría.`}
      actions={<CreateUserDialog roles={roles} linkableStaff={linkableStaff} />}
    >
      {!canTouchSuperAdmins ? (
        <p className="bg-sand-soft text-charcoal rounded-lg border px-3 py-2 text-sm">
          Como fundadora puedes crear y administrar cuentas de fundadoras y staff. Las cuentas de super admin sólo las
          administra un super admin.
        </p>
      ) : null}

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay cuentas del equipo"
          description="Crea la primera cuenta para que tu equipo pueda entrar al panel o al portal de staff."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-xs" aria-label="Cuentas del equipo">
          {users.map((u) => {
            const isSelf = u.id === me.id;
            const role = isTeamRole(u.role) ? u.role : "STAFF";
            return (
              <li key={u.id} className="grid grid-cols-1 gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {u.name}
                      {isSelf ? <span className="text-muted-foreground font-normal"> (tú)</span> : null}
                    </p>
                    <StatusBadge tone={ROLE_TONES[u.role] ?? "neutral"}>{ROLE_LABELS[u.role]}</StatusBadge>
                    {!u.active ? <StatusBadge tone="muted">Desactivada</StatusBadge> : null}
                  </div>
                  <p className="text-muted-foreground truncate text-sm">{u.email}</p>
                </div>
                <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:flex sm:flex-wrap sm:gap-x-6">
                  <div>
                    <dt className="font-medium">Último acceso</dt>
                    <dd className="text-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Ficha de staff</dt>
                    <dd className="text-foreground flex items-center gap-1">
                      {u.staffMember ? (
                        <>
                          <Link2 className="size-3" aria-hidden />
                          {u.staffMember.name}
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="lg:justify-self-end">
                  <UserRowActions
                    user={{ id: u.id, name: u.name, email: u.email, role, active: u.active }}
                    isSelf={isSelf}
                    canManageTarget={u.role !== "SUPER_ADMIN" || canTouchSuperAdmins}
                    roles={roles}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsSection>
  );
}
