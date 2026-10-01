"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Shell mobile-first para el staff: sólo sus eventos asignados y checklists. */
export function StaffShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Logo href="/staff" />
          <nav aria-label="Staff" className="ml-4 hidden sm:block">
            <Link
              href="/staff"
              aria-current={pathname === "/staff" ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                pathname === "/staff" ? "bg-sage-soft text-olive font-medium" : "text-muted-foreground",
              )}
            >
              <CalendarCheck className="size-4" aria-hidden />
              Mis eventos
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">Hola, {name.split(" ")[0]}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
