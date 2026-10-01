"use client";

import { Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUESTS_MAX, GUESTS_MIN } from "../../schemas";
import { QuantityStepper } from "../quantity-stepper";
import { SoftBadge } from "../choice-cards";
import type { StepProps } from "./types";

export function StepGuests({ draft, update, catalog, errorId, invalid }: StepProps) {
  const { minStandardGuests: min, maxStandardGuests: max } = catalog.settings;
  const quick = Array.from(new Set([min, 8, 10, max]))
    .filter((n) => n >= GUESTS_MIN && n <= GUESTS_MAX)
    .sort((a, b) => a - b);
  const special = draft.guestCount > max;
  const below = draft.guestCount < min;

  return (
    <div className="bg-card flex flex-col items-center gap-6 rounded-3xl border px-5 py-8 text-center sm:px-10 sm:py-10">
      <span
        aria-hidden
        className="bg-sage-soft text-olive flex size-12 items-center justify-center rounded-full"
      >
        <Users className="size-5" />
      </span>
      <QuantityStepper
        size="lg"
        value={draft.guestCount}
        onChange={(n) => update({ guestCount: n })}
        min={GUESTS_MIN}
        max={GUESTS_MAX}
        label="Número de personas (incluyéndote)"
        unit="personas"
        describedBy={["guests-hint", invalid ? errorId : null].filter(Boolean).join(" ")}
      />

      <div
        role="group"
        aria-label="Atajos de número de personas"
        className="flex flex-wrap justify-center gap-2"
      >
        {quick.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={draft.guestCount === n}
            onClick={() => update({ guestCount: n })}
            className={cn(
              "focus-visible:ring-ring/50 h-10 min-w-12 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
              draft.guestCount === n ? "border-olive bg-olive text-ivory" : "bg-card hover:bg-sand-soft",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <p id="guests-hint" className="text-muted-foreground max-w-md text-sm">
        Nuestras experiencias están pensadas para grupos de {min} a {max} personas, incluyéndote.
      </p>

      {special ? (
        <div
          role="note"
          className="border-warning/30 bg-warning/8 flex max-w-md flex-col items-center gap-2 rounded-2xl border p-4 text-sm"
        >
          <SoftBadge tone="warning">Consulta especial</SoftBadge>
          <p>
            Para grupos de más de {max} personas armamos una propuesta a la medida. Puedes continuar: tu
            estimado es de referencia y lo afinamos contigo.
          </p>
        </div>
      ) : null}
      {below ? (
        <p role="note" className="text-info flex max-w-md gap-2 text-left text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Para menos de {min} personas cotizamos el precio base de la experiencia; ¡igual la hacemos
            especial!
          </span>
        </p>
      ) : null}
    </div>
  );
}
