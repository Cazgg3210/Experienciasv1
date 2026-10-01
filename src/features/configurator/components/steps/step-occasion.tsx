"use client";

import { Baby, Cake, Coffee, Gem, PartyPopper, Sparkles, Users, type LucideIcon } from "lucide-react";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { OCCASION_LABELS } from "@/lib/labels";
import type { ConfiguratorOccasion } from "../../schemas";
import { ChoiceCard, ChoiceGroup } from "../choice-cards";
import type { StepProps } from "./types";

const OPTIONS: Array<{ value: ConfiguratorOccasion; icon: LucideIcon; description: string }> = [
  { value: "BIRTHDAY", icon: Cake, description: "Una mesa tan especial como ella." },
  { value: "FRIENDS_BRUNCH", icon: Coffee, description: "Ponerse al día entre risas, café y pan dulce." },
  { value: "BACHELORETTE", icon: PartyPopper, description: "La última gran fiesta antes del “sí, acepto”." },
  { value: "BRIDAL", icon: Gem, description: "Celebrar a la novia rodeada de las que más la quieren." },
  { value: "BABY_BRUNCH", icon: Baby, description: "Dar la bienvenida al bebé con calma y cariño." },
  { value: "GATHERING", icon: Users, description: "Reunir a las tuyas, sin pretexto." },
  { value: "OTHER", icon: Sparkles, description: "¿Algo distinto? Cuéntanos qué tienes en mente." },
];

export function StepOccasion({ draft, update, labelledBy, errorId, invalid }: StepProps) {
  return (
    <div className="space-y-6">
      <ChoiceGroup
        value={draft.occasion}
        onValueChange={(v) => update({ occasion: v as ConfiguratorOccasion })}
        labelledBy={labelledBy}
        describedBy={invalid ? errorId : undefined}
        invalid={invalid}
        className="sm:grid-cols-2 xl:grid-cols-3"
      >
        {OPTIONS.map((o) => (
          <ChoiceCard
            key={o.value}
            value={o.value}
            title={o.value === "OTHER" ? "Otra" : OCCASION_LABELS[o.value]}
            description={o.description}
            icon={<o.icon className="size-5" />}
          />
        ))}
      </ChoiceGroup>

      {draft.occasion === "OTHER" ? (
        <Field
          label="¿Qué celebramos?"
          description="Por ejemplo: graduación, aniversario, reencuentro, despedida de una amiga que se muda…"
          required
          className="max-w-lg"
        >
          {(p) => (
            <Input
              {...p}
              value={draft.occasionOther}
              maxLength={80}
              onChange={(e) => update({ occasionOther: e.target.value })}
              placeholder="Cuéntanos en pocas palabras"
              className="bg-card h-11 text-base"
            />
          )}
        </Field>
      ) : null}
    </div>
  );
}
