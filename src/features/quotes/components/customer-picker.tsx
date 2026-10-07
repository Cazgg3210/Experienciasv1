"use client";

import * as React from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePaintedId } from "@/components/forms/use-painted-id";
import { cn } from "@/lib/utils";
import { searchCustomersAction } from "../server/actions";

export type PickedCustomer = { id: string; name: string; email: string | null; phone: string | null };

/** Buscador de clientas existentes (nombre, email o teléfono) con resultados accesibles. */
export function CustomerPicker({
  value,
  onChange,
  invalid,
  describedBy,
  inputId,
}: {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
  invalid?: boolean;
  describedBy?: string;
  inputId?: string;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<PickedCustomer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(-1);
  const reqId = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Adopta el id de la lista con que el servidor pintó el combobox (ver usePaintedId, EVT-005): la lista y sus
  // opciones se montan después, en el cliente, y aria-controls / aria-activedescendant deben apuntar a ellas.
  const listId = usePaintedId(React.useId(), inputRef, { attr: "aria-controls" });

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      reqId.current++;
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchCustomersAction({ q: term });
      if (id !== reqId.current) return;
      setLoading(false);
      if (res.ok) {
        setResults(res.data);
        setError(null);
        setActive(res.data.length ? 0 : -1);
      } else {
        setResults([]);
        setError(res.error);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="bg-sage-soft/50 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-sage-soft text-olive flex size-9 shrink-0 items-center justify-center rounded-full">
            <UserRound className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{value.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {[value.email, value.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label={`Cambiar clienta (${value.name})`}>
          <X aria-hidden /> Cambiar
        </Button>
      </div>
    );
  }

  const choose = (c: PickedCustomer) => {
    onChange(c);
    setQ("");
    setResults([]);
  };

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-[18px] left-2.5 size-4 -translate-y-1/2" aria-hidden />
      <Input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="h-9 pl-8"
        placeholder="Busca por nombre, email o teléfono"
        value={q}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(results[active]!);
          } else if (e.key === "Escape") {
            setResults([]);
          }
        }}
      />
      {loading ? (
        <Loader2 className="text-muted-foreground absolute top-[18px] right-2.5 size-4 -translate-y-1/2 animate-spin" aria-hidden />
      ) : null}
      <p className="sr-only" aria-live="polite">
        {q.trim().length >= 2 && !loading ? `${results.length} clientas encontradas` : ""}
      </p>
      {results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border p-1 shadow-lg"
        >
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("cursor-pointer rounded-lg px-3 py-2", i === active ? "bg-muted" : "hover:bg-muted")}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-muted-foreground text-xs">{[c.email, c.phone].filter(Boolean).join(" · ") || "Sin contacto"}</p>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !loading ? (
        <p className="text-muted-foreground mt-1.5 text-xs">
          {error ?? "Sin coincidencias. Puedes registrarla como clienta nueva."}
        </p>
      ) : null}
    </div>
  );
}
