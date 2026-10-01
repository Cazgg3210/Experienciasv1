"use client";

import Image from "next/image";
import { Check, Clock, Gift } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ADDON_CATEGORY_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { diffDaysKey } from "../../domain/calendar";
import { PLACEHOLDER_IMAGES, canOptimizeImage, safeImageSrc } from "../../domain/images";
import { QuantityStepper } from "../quantity-stepper";
import type { StepProps } from "./types";

export function StepAddOns({
  draft,
  update,
  catalog,
  labelledBy,
  todayKey,
}: StepProps & { todayKey: string }) {
  const experience = catalog.experiences.find((e) => e.id === draft.experienceId);
  const addOns = experience ? catalog.addOns.filter((a) => experience.addOnIds.includes(a.id)) : [];
  const daysToEvent = draft.eventDate ? diffDaysKey(todayKey, draft.eventDate) : null;
  const selectedCount = Object.keys(draft.addOns).length;

  if (addOns.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title="Tu experiencia ya viene completa"
        description="Por ahora no hay extras para esta experiencia. Si sueñas con algo especial, cuéntanoslo en las notas."
      />
    );
  }

  const setQty = (id: string, qty: number | null) => {
    const next = { ...draft.addOns };
    if (qty == null || qty <= 0) delete next[id];
    else next[id] = qty;
    update({ addOns: next });
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {selectedCount === 0
          ? "Todos son opcionales: elige los que quieras o continúa sin extras."
          : `${selectedCount} ${selectedCount === 1 ? "extra elegido" : "extras elegidos"}.`}
      </p>
      <ul aria-labelledby={labelledBy} className="grid gap-3 sm:grid-cols-2">
        {addOns.map((a) => {
          const qty = draft.addOns[a.id] ?? 0;
          const selected = qty > 0;
          const src = safeImageSrc(a.imageUrl, PLACEHOLDER_IMAGES.addOn);
          const tight = daysToEvent != null && a.leadTimeDays > 0 && daysToEvent < a.leadTimeDays;
          return (
            <li
              key={a.id}
              className={cn(
                "bg-card flex flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow,background-color]",
                selected ? "border-olive bg-sage-soft/45 ring-olive/20 ring-2" : "hover:border-taupe/60",
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => setQty(a.id, selected ? null : 1)}
                className="focus-visible:ring-ring/50 flex flex-1 gap-3 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset"
              >
                <span className="bg-sand-soft relative size-16 shrink-0 overflow-hidden rounded-xl sm:size-20">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized={!canOptimizeImage(src)}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground block text-[0.7rem] font-medium tracking-[0.14em] uppercase">
                    {ADDON_CATEGORY_LABELS[a.category]}
                  </span>
                  <span className="font-heading block text-lg leading-tight font-semibold">{a.name}</span>
                  {a.description ? (
                    <span className="text-muted-foreground mt-1 line-clamp-3 block text-sm">
                      {a.description}
                    </span>
                  ) : null}
                  <span className="mt-2 block text-sm font-semibold">
                    {formatMXN(a.priceCents)}
                    {a.pricingType === "PER_GUEST" ? (
                      <span className="text-muted-foreground font-normal"> por persona</span>
                    ) : null}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                    selected ? "border-olive bg-olive text-ivory" : "border-input bg-card",
                  )}
                >
                  <Check className={cn("size-3.5", selected ? "opacity-100" : "opacity-0")} />
                </span>
              </button>
              {selected && a.maxQuantity > 1 ? (
                <div className="border-border/70 flex items-center justify-between gap-3 border-t px-4 py-2.5">
                  <span className="text-sm">Cantidad</span>
                  <QuantityStepper
                    value={qty}
                    onChange={(n) => setQty(a.id, n)}
                    min={1}
                    max={a.maxQuantity}
                    label={`Cantidad de ${a.name}`}
                  />
                </div>
              ) : null}
              {selected && tight ? (
                <p className="text-warning border-border/70 flex gap-2 border-t px-4 py-2 text-xs">
                  <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Requiere {a.leadTimeDays} días de anticipación; lo confirmamos contigo.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
