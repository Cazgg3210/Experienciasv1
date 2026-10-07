"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePaintedId } from "@/components/forms/use-painted-id";
import { cn } from "@/lib/utils";
import { moveItem, splitListInput } from "../domain/catalog-rules";

/** Tarjeta de sección del editor con ancla para la navegación lateral. */
export function SectionCard({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("bg-card scroll-mt-24 rounded-2xl border p-4 shadow-xs sm:p-6", className)}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id={headingId} className="font-heading text-xl font-semibold">
            {title}
          </h2>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Grupo de controles (fieldset + legend) con error accesible. */
export function FieldGroup({
  legend,
  description,
  error,
  children,
  className,
}: {
  legend: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const descRef = React.useRef<HTMLParagraphElement>(null);
  // Adopta el id con que el servidor pintó la descripción (ver usePaintedId, EVT-005): al aparecer el error, el
  // aria-describedby se reescribe y debe seguir apuntando a ella.
  const id = usePaintedId(React.useId(), descRef, { suffix: "-d" });
  return (
    <fieldset
      className={cn("space-y-2", className)}
      aria-describedby={[description ? `${id}-d` : null, error ? `${id}-e` : null].filter(Boolean).join(" ") || undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {description ? (
        <p ref={descRef} id={`${id}-d`} className="text-muted-foreground -mt-1 text-xs">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-e`} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export type ChipOption<T extends string = string> = { value: T; label: string; inactive?: boolean; hint?: string };

/** Selección múltiple como chips (botones con aria-pressed). */
export function ToggleChips<T extends string>({
  options,
  value,
  onChange,
  disabled,
  emptyText = "No hay opciones disponibles.",
}: {
  options: ReadonlyArray<ChipOption<T>>;
  value: readonly T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  emptyText?: string;
}) {
  if (!options.length) return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  const selected = new Set(value);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            title={o.hint}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60",
              on
                ? "border-olive bg-sage-soft text-olive font-medium"
                : "border-border bg-background hover:bg-muted text-foreground/80",
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", on ? "bg-olive" : "bg-muted-foreground/40")}
            />
            {o.label}
            {o.inactive ? <span className="text-muted-foreground text-xs">(inactivo)</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Entrada de chips: Enter o coma agrega; pegar listas separadas por comas/saltos agrega varias. */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder = "Escribe y presiona Enter",
  normalize = (s) => s.trim(),
  validate,
  max = 50,
  disabled,
  inputMode,
  chipLabel = "elemento",
  splitOnSpaces = false,
  ...aria
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  normalize?: (s: string) => string;
  validate?: (s: string) => string | null;
  max?: number;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  chipLabel?: string;
  /** Separa también por espacios (útil para códigos postales). */
  splitOnSpaces?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const errId = React.useId();

  function add(raw: string) {
    const parts = splitOnSpaces
      ? splitListInput(raw)
          .flatMap((p) => p.split(/\s+/))
          .filter(Boolean)
      : splitListInput(raw);
    if (!parts.length) return;
    const next = [...value];
    const rejected: string[] = [];
    for (const p of parts) {
      const v = normalize(p);
      if (!v) continue;
      const problem = validate?.(v) ?? null;
      if (problem) {
        rejected.push(v);
        setError(problem);
        continue;
      }
      if (next.some((x) => x.toLowerCase() === v.toLowerCase())) continue;
      if (next.length >= max) {
        setError(`Máximo ${max} elementos.`);
        break;
      }
      next.push(v);
    }
    if (!rejected.length) setError(null);
    onChange(next);
    setDraft(rejected.join(", "));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={aria["aria-invalid"] || !!error || undefined}
          aria-describedby={[aria["aria-describedby"], error ? errId : null].filter(Boolean).join(" ") || undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if ((splitOnSpaces ? /[,;\s]/ : /[,;\n\t]/).test(text.trim())) {
              e.preventDefault();
              add(text);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
        <Button type="button" variant="outline" size="lg" disabled={disabled || !draft.trim()} onClick={() => add(draft)}>
          <Plus aria-hidden />
          <span className="sr-only sm:not-sr-only">Agregar</span>
        </Button>
      </div>
      {error ? (
        <p id={errId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Elementos agregados">
          {value.map((v) => (
            <li
              key={v}
              className="bg-sand-soft text-charcoal inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
            >
              {v}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="hover:bg-background focus-visible:ring-ring/50 rounded-full p-0.5 outline-none focus-visible:ring-2"
                aria-label={`Quitar ${chipLabel} ${v}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Botones de reordenamiento accesibles. */
export function OrderButtons({
  index,
  count,
  onMove,
  label,
  disabled,
}: {
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Subir ${label}`}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
        aria-label={`Bajar ${label}`}
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  );
}

/** Interruptor con etiqueta y descripción. */
export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id?: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const autoId = React.useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border px-3 py-2.5">
      <div className="space-y-0.5">
        <Label htmlFor={switchId} className="text-sm font-medium">
          {label}
        </Label>
        {description ? (
          <p id={`${switchId}-d`} className="text-muted-foreground text-xs">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${switchId}-d` : undefined}
        className="mt-0.5"
      />
    </div>
  );
}

/** Editor de lista ordenada de textos ("Incluye"). */
export function ListEditor({
  value,
  onChange,
  disabled,
  placeholder = "Ej. Montaje y desmontaje de la mesa",
  itemLabel = "elemento",
  max = 30,
  errors,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  itemLabel?: string;
  max?: number;
  errors?: Array<string | undefined>;
}) {
  const [draft, setDraft] = React.useState("");
  const addId = React.useId();
  const add = () => {
    const v = draft.trim();
    if (!v || value.length >= max) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="space-y-3">
      {value.length ? (
        <ol className="space-y-2">
          {value.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground tabular mt-2 w-5 shrink-0 text-right text-xs">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <Input
                  value={item}
                  disabled={disabled}
                  aria-label={`${itemLabel} ${i + 1}`}
                  aria-invalid={errors?.[i] ? true : undefined}
                  onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
                />
                {errors?.[i] ? (
                  <p role="alert" className="text-destructive mt-1 text-xs font-medium">
                    {errors[i]}
                  </p>
                ) : null}
              </div>
              <OrderButtons
                index={i}
                count={value.length}
                disabled={disabled}
                label={`${itemLabel} ${i + 1}`}
                onMove={(d) => onChange(moveItem(value, i, d))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={`Quitar ${itemLabel} ${i + 1}`}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">Aún no hay elementos.</p>
      )}
      <div className="flex gap-2">
        <label htmlFor={addId} className="sr-only">
          Nuevo {itemLabel}
        </label>
        <Input
          id={addId}
          value={draft}
          disabled={disabled || value.length >= max}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="lg" disabled={disabled || !draft.trim()} onClick={add}>
          <Plus aria-hidden />
          Agregar
        </Button>
      </div>
    </div>
  );
}

/** Aviso inline para campos bloqueados por falta de permiso de precios. */
export function PricingLockNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="bg-sand-soft text-charcoal rounded-lg px-3 py-2 text-xs">
      Los precios y costos sólo pueden cambiarlos personas con permiso de precios.
    </p>
  );
}
