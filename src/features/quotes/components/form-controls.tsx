"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Select nativo con el estilo del sistema (mejor UX en móvil y compatible con register()). */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input h-9 w-full min-w-0 rounded-lg border bg-transparent px-2.5 text-base outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Porcentaje visible (0–100, con 2 decimales) ↔ bps (entero) emitido. */
export function PercentInput({
  value,
  onValueChange,
  className,
  max = 100,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "max"> & {
  value: number | null | undefined;
  onValueChange: (bps: number) => void;
  max?: number;
}) {
  const toText = (bps: number | null | undefined) => (bps == null || Number.isNaN(bps) ? "" : String(bps / 100));
  const [text, setText] = React.useState(toText(value));
  const last = React.useRef(value);
  React.useEffect(() => {
    if (value !== last.current) {
      setText(toText(value));
      last.current = value;
    }
  }, [value]);
  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        inputMode="decimal"
        className="tabular pr-8"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
          setText(raw);
          const n = raw === "" ? 0 : Number(raw);
          if (Number.isFinite(n)) {
            const bps = Math.round(Math.min(Math.max(n, 0), max) * 100);
            last.current = bps;
            onValueChange(bps);
          }
        }}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">%</span>
    </div>
  );
}

/** Entero con botones − / + (cantidades), accesible con teclado. */
export function QuantityInput({
  value,
  onValueChange,
  min = 1,
  max = 999,
  label,
  className,
  disabled,
}: {
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.min(Math.max(Math.round(n), min), max);
  return (
    <div className={cn("inline-flex h-9 items-center rounded-lg border", className)} role="group" aria-label={label}>
      <button
        type="button"
        className="hover:bg-muted h-full w-8 rounded-l-lg text-lg leading-none disabled:opacity-40"
        onClick={() => onValueChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Disminuir ${label}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="tabular h-full w-12 border-x bg-transparent text-center text-sm outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-inner-spin-button]:appearance-none"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && e.target.value !== "") onValueChange(clamp(n));
        }}
      />
      <button
        type="button"
        className="hover:bg-muted h-full w-8 rounded-r-lg text-lg leading-none disabled:opacity-40"
        onClick={() => onValueChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Aumentar ${label}`}
      >
        +
      </button>
    </div>
  );
}
