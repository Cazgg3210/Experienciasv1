"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selector numérico con botones grandes − / + y entrada editable. */
export function QuantityStepper({
  value,
  onChange,
  min,
  max,
  label,
  unit,
  size = "md",
  id,
  describedBy,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Nombre accesible del campo */
  label: string;
  unit?: string;
  size?: "md" | "lg";
  id?: string;
  describedBy?: string;
}) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(String(value));
  };

  const big = size === "lg";
  const btn = cn(
    "border-border bg-card text-charcoal hover:bg-sand-soft focus-visible:ring-ring/50 flex shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-40",
    big ? "size-14" : "size-9",
  );

  return (
    <div className={cn("flex items-center", big ? "gap-4" : "gap-2")}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`Quitar uno (${label})`}
        aria-controls={inputId}
      >
        <Minus className={big ? "size-5" : "size-4"} aria-hidden />
      </button>
      <div className="flex flex-col items-center">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          role="spinbutton"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-describedby={describedBy}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit((e.target as HTMLInputElement).value);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              onChange(clamp(value + 1));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onChange(clamp(value - 1));
            }
          }}
          className={cn(
            "focus-visible:ring-ring/50 focus-visible:border-input rounded-lg border border-transparent bg-transparent text-center font-semibold outline-none focus-visible:ring-3",
            big ? "font-heading h-16 w-24 text-5xl" : "tabular h-9 w-12 text-base",
          )}
        />
        {unit ? <span className="text-muted-foreground text-xs">{unit}</span> : null}
      </div>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`Agregar uno (${label})`}
        aria-controls={inputId}
      >
        <Plus className={big ? "size-5" : "size-4"} aria-hidden />
      </button>
    </div>
  );
}
