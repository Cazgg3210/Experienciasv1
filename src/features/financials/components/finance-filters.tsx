"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectCls =
  "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 sm:w-52";

/**
 * Filtros de /admin/finance (mes y estado). Es un <form method="get">: funciona sin JS;
 * con JS aplica el filtro al cambiar la selección.
 */
export function FinanceFilters({
  months,
  statuses,
  month,
  status,
}: {
  months: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
  month?: string;
  status?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function apply(key: "month" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const hasFilters = !!month || !!status;

  return (
    <form
      method="get"
      action={pathname}
      role="search"
      aria-label="Filtrar eventos"
      aria-busy={pending || undefined}
      className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end", pending && "opacity-70")}
    >
      <div className="space-y-1.5">
        <Label htmlFor="finance-month">Mes del evento</Label>
        <select
          id="finance-month"
          name="month"
          defaultValue={month ?? ""}
          className={selectCls}
          onChange={(e) => apply("month", e.target.value)}
        >
          <option value="">Todos los meses</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="finance-status">Estado</Label>
        <select
          id="finance-status"
          name="status"
          defaultValue={status ?? ""}
          className={selectCls}
          onChange={(e) => apply("status", e.target.value)}
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <noscript>
        <Button type="submit" variant="outline" size="lg">
          Aplicar
        </Button>
      </noscript>
      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}
        >
          <X aria-hidden /> Limpiar filtros
        </Button>
      ) : null}
    </form>
  );
}
