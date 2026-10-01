import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { can, type Permission } from "@/server/auth/permissions";
import { SubNav, type SubNavItem } from "@/features/settings/components/sub-nav";

export const metadata: Metadata = { title: "Configuración" };

const SECTIONS: Array<SubNavItem & { permission: Permission }> = [
  { href: "/admin/settings", label: "Negocio", icon: "business", exact: true, permission: "settings:read" },
  { href: "/admin/settings/pricing", label: "Precios y márgenes", icon: "pricing", permission: "settings:read" },
  { href: "/admin/settings/availability", label: "Disponibilidad", icon: "availability", permission: "settings:read" },
  { href: "/admin/settings/notifications", label: "Notificaciones", icon: "notifications", permission: "settings:read" },
  { href: "/admin/settings/flags", label: "Funciones", icon: "flags", permission: "settings:read" },
  { href: "/admin/settings/integrations", label: "Integraciones", icon: "integrations", permission: "settings:read" },
  { href: "/admin/settings/users", label: "Usuarios", icon: "users", permission: "users:manage" },
  { href: "/admin/settings/audit", label: "Auditoría", icon: "audit", permission: "audit:read" },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePagePermission("settings:read", "/admin/settings");
  const items = SECTIONS.filter((s) => can(user.role, s.permission)).map(({ permission: _p, ...item }) => item);
  return (
    <div>
      <PageHeader
        eyebrow="Centro de control"
        title="Configuración"
        description="Reglas del negocio, precios, disponibilidad, mensajes automáticos, equipo e integraciones."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <SubNav items={items} label="Secciones de configuración" />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
