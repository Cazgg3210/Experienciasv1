"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export type CatalogFilterFormProps = {
  action?: string;
  tipo: { options: FilterOption[]; value: string };
  ocasion: { options: FilterOption[]; value: string };
  personas: { options: FilterOption[]; value: string };
  estilo: { options: FilterOption[]; value: string };
  hasActiveFilters: boolean;
};

type FilterName = "tipo" | "ocasion" | "personas" | "estilo";
type FilterValues = Record<FilterName, string>;

const FILTER_ORDER: FilterName[] = ["tipo", "ocasion", "personas", "estilo"];

const selectClass =
  "border-input bg-card text-foreground h-11 w-full appearance-none rounded-xl border pr-9 pl-3.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FilterSelect({
  id,
  name,
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  id: string;
  name: FilterName;
  label: string;
  placeholder: string;
  options: FilterOption[];
  value: string;
  onChange: (name: FilterName, value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          className={selectClass}
          onChange={(e) => onChange(name, e.currentTarget.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" aria-hidden />
      </div>
    </div>
  );
}

function toQuery(values: FilterValues): string {
  const qs = new URLSearchParams();
  for (const key of FILTER_ORDER) {
    const v = values[key].trim();
    if (v) qs.set(key, v);
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

/**
 * Filtros del catálogo. Formulario GET: funciona sin JavaScript; con JS navega sin recargar
 * al cambiar cualquier filtro (y omite parámetros vacíos para URLs limpias).
 * Los selects son controlados y NO se re-montan al navegar: quien usa teclado conserva el foco.
 */
export function CatalogFilterForm({ action = "/experiencias", tipo, ocasion, personas, estilo, hasActiveFilters }: CatalogFilterFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const fromProps: FilterValues = { tipo: tipo.value, ocasion: ocasion.value, personas: personas.value, estilo: estilo.value };
  const propsKey = FILTER_ORDER.map((k) => fromProps[k]).join("|");
  const [values, setValues] = useState<FilterValues>(fromProps);
  const [syncedKey, setSyncedKey] = useState(propsKey);
  // La URL cambió desde fuera (p. ej. "Limpiar" o atrás/adelante): sincronizar sin re-montar.
  if (syncedKey !== propsKey) {
    setSyncedKey(propsKey);
    setValues(fromProps);
  }

  function navigate(next: FilterValues) {
    startTransition(() => {
      router.push(`${action}${toQuery(next)}`, { scroll: false });
    });
  }

  function handleChange(name: FilterName, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    navigate(next);
  }

  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-label="Filtrar experiencias"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(values);
      }}
      className="bg-card border-border/70 rounded-3xl border p-4 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <FilterSelect id="f-tipo" name="tipo" label="Tipo" placeholder="Todos" options={tipo.options} value={values.tipo} onChange={handleChange} />
        <FilterSelect
          id="f-ocasion"
          name="ocasion"
          label="Ocasión"
          placeholder="Cualquiera"
          options={ocasion.options}
          value={values.ocasion}
          onChange={handleChange}
        />
        <FilterSelect
          id="f-personas"
          name="personas"
          label="Personas"
          placeholder="Cualquiera"
          options={personas.options}
          value={values.personas}
          onChange={handleChange}
        />
        <FilterSelect id="f-estilo" name="estilo" label="Estilo" placeholder="Todos" options={estilo.options} value={values.estilo} onChange={handleChange} />
        <div className="col-span-2 flex items-center gap-2 lg:col-span-1">
          <Button type="submit" className="h-11 flex-1 rounded-xl px-5 lg:flex-none" aria-busy={pending || undefined}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <SlidersHorizontal className="size-4" aria-hidden />}
            Filtrar
          </Button>
          {hasActiveFilters ? (
            <Button asChild variant="ghost" className={cn("h-11 rounded-xl px-4")}>
              <Link href={action} scroll={false}>
                Limpiar
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {pending ? "Actualizando resultados…" : ""}
      </p>
    </form>
  );
}
