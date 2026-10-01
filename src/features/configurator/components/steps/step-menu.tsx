"use client";

import { Leaf, UtensilsCrossed } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { DIETARY_LABELS } from "@/lib/labels";
import { menuPriceLabel } from "../../domain/summary";
import { ChoiceCard, ChoiceGroup, SoftBadge } from "../choice-cards";
import type { StepProps } from "./types";

export function StepMenu({
  draft,
  update,
  catalog,
  labelledBy,
  errorId,
  invalid,
  onGoToStep,
}: StepProps & { onGoToStep: (step: 6) => void }) {
  const experience = catalog.experiences.find((e) => e.id === draft.experienceId);
  if (!experience) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Primero elige tu experiencia"
        description="Los menús dependen de la experiencia que elijas."
        action={
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onGoToStep(6)}>
            Elegir experiencia
          </Button>
        }
      />
    );
  }
  const menus = catalog.menus.filter((m) => experience.menuIds.includes(m.id));
  if (menus.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Menú de la casa"
        description={`${experience.name} incluye un menú de temporada que afinamos contigo. ¡Continúa!`}
      />
    );
  }

  return (
    <ChoiceGroup
      value={draft.menuId}
      onValueChange={(v) => update({ menuId: v })}
      labelledBy={labelledBy}
      describedBy={invalid ? errorId : undefined}
      invalid={invalid}
      className="sm:grid-cols-2"
    >
      {menus.map((m) => {
        const price = menuPriceLabel(m);
        const shown = m.items.slice(0, 4);
        const more = m.itemCount - shown.length;
        return (
          <ChoiceCard
            key={m.id}
            value={m.id}
            title={m.name}
            badge={<SoftBadge tone={m.pricingType === "INCLUDED" ? "info" : "brand"}>{price}</SoftBadge>}
            description={m.description ?? undefined}
            meta={
              <span className="flex flex-col gap-2.5">
                {shown.length ? (
                  <span className="text-charcoal/85 block text-xs leading-relaxed">
                    {shown.map((i) => i.name).join(" · ")}
                    {more > 0 ? ` · y ${more} más` : ""}
                  </span>
                ) : null}
                {m.dietaryTags.length || m.tags.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {m.dietaryTags.map((t) => (
                      <span
                        key={t}
                        className="bg-sage-soft text-olive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      >
                        <Leaf className="size-3" aria-hidden /> {DIETARY_LABELS[t]}
                      </span>
                    ))}
                    {m.tags.slice(0, 3).map((t) => (
                      <span key={t} className="bg-sand-soft text-charcoal rounded-full px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            }
          />
        );
      })}
    </ChoiceGroup>
  );
}
