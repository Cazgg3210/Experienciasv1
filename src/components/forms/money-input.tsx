"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Input de dinero: la persona escribe pesos (con decimales), el valor emitido es en CENTAVOS (entero).
 * Usar con react-hook-form <Controller>:
 *   <Controller name="priceCents" control={form.control} render={({ field }) =>
 *     <MoneyInput value={field.value} onValueChange={field.onChange} {...fieldProps} />} />
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  allowNegative = false,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValueChange: (cents: number | null) => void;
  allowNegative?: boolean;
}) {
  const toText = (cents: number | null | undefined) =>
    cents == null || Number.isNaN(cents) ? "" : String(Math.round(cents) / 100);
  const [text, setText] = React.useState(toText(value));
  const lastEmitted = React.useRef<number | null | undefined>(value);

  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(toText(value));
      lastEmitted.current = value;
    }
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        $
      </span>
      <Input
        {...props}
        inputMode="decimal"
        className="tabular pl-7"
        value={text}
        onChange={(e) => {
          // Formato MX: coma = separador de miles, punto = decimales ("1,500.50" -> 1500.50)
          const raw = e.target.value.replace(/,/g, "").replace(/[^\d.-]/g, "");
          setText(raw);
          if (raw === "" || raw === "-") {
            lastEmitted.current = null;
            onValueChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && (allowNegative || n >= 0)) {
            const cents = Math.round(n * 100);
            lastEmitted.current = cents;
            onValueChange(cents);
          }
        }}
      />
    </div>
  );
}
