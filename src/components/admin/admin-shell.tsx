"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, FlaskConical, ExternalLink } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./nav-config";
import { can, type AppRole } from "@/server/auth/permissions";
import { ROLE_LABELS } from "@/lib/labels";

type ShellUser = { name: string; email: string; role: AppRole };

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación del panel" className="space-y-6">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((i) => can(role, i.permission));
        if (!items.length) return null;
        return (
          <div key={group.group}>
            <p className="text-muted-foreground mb-2 px-3 text-[11px] font-medium tracking-[0.16em] uppercase">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  user,
  mockProviders,
  children,
}: {
  user: ShellUser;
  mockProviders: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="bg-background flex min-h-dvh">
      {/* Sidebar escritorio */}
      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex print:hidden">
        <div className="px-5 pt-6 pb-4">
          <Logo href="/admin" subtitle="Centro de experiencias" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavLinks role={user.role} />
        </div>
        <UserBlock user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-72 p-0">
              <SheetHeader className="px-5 pt-6">
                <SheetTitle asChild>
                  <div>
                    <Logo href="/admin" subtitle="Centro de experiencias" />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto px-3 pb-6">
                <NavLinks role={user.role} onNavigate={() => setOpen(false)} />
              </div>
              <UserBlock user={user} />
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <Logo href="/admin" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {mockProviders.length ? (
              <Link
                href="/admin/settings/integrations"
                className="bg-warning/10 text-warning border-warning/25 hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium sm:inline-flex"
                title={`Integraciones en modo demo: ${mockProviders.join(", ")}`}
              >
                <FlaskConical className="size-3.5" aria-hidden />
                Modo demo: {mockProviders.join(" · ")}
              </Link>
            ) : null}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                <span className="hidden sm:inline">Ver sitio</span>
              </Link>
            </Button>
          </div>
        </header>
        {mockProviders.length ? (
          <div className="bg-warning/10 text-warning border-warning/20 border-b px-4 py-1.5 text-center text-xs sm:hidden">
            Modo demo: {mockProviders.join(" · ")}
          </div>
        ) : null}
        <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function UserBlock({ user }: { user: ShellUser }) {
  return (
    <div className="border-sidebar-border flex items-center gap-3 border-t px-4 py-4">
      <div className="bg-sage-soft text-olive flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        {user.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-muted-foreground truncate text-xs">{ROLE_LABELS[user.role]}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
