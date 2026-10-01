"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type FilterField =
  | { type: "search"; name: string; label: string; placeholder?: string }
  | {
      type: "select";
      name: string;
      label: string;
      allLabel?: string;
      options: Array<{ value: string; label: string }>;
    }
  | { type: "date"; name: string; label: string }
  | { type: "toggle"; name: string; label: string };

const ALL = "__all__";

/**
 * Barra de filtros que sincroniza con searchParams (reinicia la paginación).
 * Funciona con teclado; los selects usan Radix con etiqueta visible.
 */
export function ListFilters({ fields, className }: { fields: FilterField[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const searchField = fields.find((f) => f.type === "search");
  const [q, setQ] = React.useState(searchField ? (params.get(searchField.name) ?? "") : "");
  const baseId = React.useId();

  const apply = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  // Búsqueda con debounce
  React.useEffect(() => {
    if (!searchField) return;
    const current = params.get(searchField.name) ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => apply({ [searchField.name]: q.trim() || null }), 400);
    return () => clearTimeout(t);
  }, [q, searchField, params, apply]);

  const activeCount = fields.filter((f) => params.get(f.name)).length;

  return (
    <div
      role="search"
      aria-label="Filtros"
      className={cn("bg-card flex flex-col gap-3 rounded-xl border p-3 sm:p-4 lg:flex-row lg:flex-wrap lg:items-end", className)}
    >
      {fields.map((f) => {
        const id = `${baseId}-${f.name}`;
        if (f.type === "search") {
          return (
            <form
              key={f.name}
              className="min-w-0 flex-1 space-y-1 lg:min-w-64"
              onSubmit={(e) => {
                e.preventDefault();
                apply({ [f.name]: q.trim() || null });
              }}
            >
              <Label htmlFor={id} className="text-muted-foreground text-xs">
                {f.label}
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
                <Input
                  id={id}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={f.placeholder}
                  className="h-9 pl-8"
                  autoComplete="off"
                />
              </div>
            </form>
          );
        }
        if (f.type === "select") {
          const value = params.get(f.name) ?? ALL;
          // Texto explícito para que el valor se vea desde el render del servidor (antes de hidratar).
          const selectedLabel =
            value === ALL ? (f.allLabel ?? "Todas") : (f.options.find((o) => o.value === value)?.label ?? "—");
          return (
            <div key={f.name} className="space-y-1 lg:w-48">
              <Label htmlFor={id} className="text-muted-foreground text-xs">
                {f.label}
              </Label>
              <Select value={value} onValueChange={(v) => apply({ [f.name]: v === ALL ? null : v })}>
                <SelectTrigger id={id} className="h-9 w-full">
                  <SelectValue>{selectedLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{f.allLabel ?? "Todas"}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        if (f.type === "date") {
          return (
            <div key={f.name} className="space-y-1 lg:w-40">
              <Label htmlFor={id} className="text-muted-foreground text-xs">
                {f.label}
              </Label>
              <Input
                id={id}
                type="date"
                className="h-9"
                value={params.get(f.name) ?? ""}
                onChange={(e) => apply({ [f.name]: e.target.value || null })}
              />
            </div>
          );
        }
        return (
          <div key={f.name} className="flex h-9 items-center gap-2 lg:self-end">
            <Switch
              id={id}
              checked={params.get(f.name) === "1"}
              onCheckedChange={(checked) => apply({ [f.name]: checked ? "1" : null })}
            />
            <Label htmlFor={id} className="text-sm">
              {f.label}
            </Label>
          </div>
        );
      })}
      <div className="flex items-center gap-2 lg:ml-auto lg:self-end">
        {pending ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" aria-live="polite">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Filtrando…
          </span>
        ) : null}
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname, { scroll: false }));
            }}
          >
            <X className="size-3.5" aria-hidden /> Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
}
