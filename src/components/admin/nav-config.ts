import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  Inbox,
  LayoutGrid,
  Megaphone,
  PartyPopper,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission };

/** Sidebar del "centro de control de experiencias". */
export const ADMIN_NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Negocio",
    items: [
      { href: "/admin", label: "Resumen", icon: Home, permission: "dashboard:view" },
      { href: "/admin/leads", label: "Leads", icon: Megaphone, permission: "leads:read" },
      { href: "/admin/customers", label: "Clientes", icon: UsersRound, permission: "customers:read" },
      { href: "/admin/catalog", label: "Experiencias", icon: Sparkles, permission: "catalog:read" },
      { href: "/admin/quotes", label: "Cotizaciones", icon: FileText, permission: "quotes:read" },
    ],
  },
  {
    group: "Operación",
    items: [
      { href: "/admin/events", label: "Eventos", icon: PartyPopper, permission: "events:read_all" },
      { href: "/admin/calendar", label: "Calendario", icon: CalendarDays, permission: "events:read_all" },
      { href: "/admin/operations", label: "Operaciones", icon: ClipboardList, permission: "operations:read" },
      { href: "/admin/inventory", label: "Inventario", icon: Boxes, permission: "inventory:read" },
      { href: "/admin/purchases", label: "Compras", icon: ShoppingBag, permission: "purchases:read" },
      { href: "/admin/vendors", label: "Proveedores", icon: Store, permission: "vendors:read" },
      { href: "/admin/staff", label: "Staff", icon: Users, permission: "staff:read" },
    ],
  },
  {
    group: "Inteligencia",
    items: [
      { href: "/admin/finance", label: "Finanzas", icon: Wallet, permission: "financials:read" },
      { href: "/admin/content", label: "Contenido", icon: LayoutGrid, permission: "content:write" },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:read" },
      { href: "/admin/notifications", label: "Bandeja (mock)", icon: Inbox, permission: "notifications:read" },
      { href: "/admin/settings", label: "Configuración", icon: Settings, permission: "settings:read" },
    ],
  },
];
