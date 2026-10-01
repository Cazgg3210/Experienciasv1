"use client";

import { Check } from "lucide-react";
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { WEEKDAY_ORDER } from "../domain/staff";

/** Selector de días como chips (botones con aria-pressed, navegables con teclado). */
export function WeekdayChips({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(value);
  function toggle(d: number) {
    const next = new Set(set);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    onChange([...next].sort((a, b) => a - b));
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Días disponibles">
      {WEEKDAY_ORDER.map((d) => {
        const on = set.has(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_LABELS[d]}
            disabled={disabled}
            onClick={() => toggle(d)}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-9 min-w-14 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 disabled:opacity-50",
              on ? "border-olive bg-sage-soft text-olive" : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {on ? <Check className="size-3.5" aria-hidden /> : null}
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}
