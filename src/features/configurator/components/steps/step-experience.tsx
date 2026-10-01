"use client";

import Image from "next/image";
import { Clock, Sparkles, Users } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { EXPERIENCE_TYPE_LABELS, OCCASION_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import type { Occasion } from "@prisma/client";
import { PLACEHOLDER_IMAGES, canOptimizeImage, safeImageSrc } from "../../domain/images";
import { rankExperiences, type RankedExperience } from "../../domain/recommend";
import type { CatalogExperience } from "../../types";
import { ChoiceCard, ChoiceGroup, MetaPill, SoftBadge } from "../choice-cards";
import type { StepProps } from "./types";

function hours(minutes: number) {
  return `${(minutes / 60).toLocaleString("es-MX", { maximumFractionDigits: 1 })} h`;
}

export function StepExperience({
  draft,
  catalog,
  labelledBy,
  errorId,
  invalid,
  onSelectExperience,
}: StepProps & { onSelectExperience: (id: string) => void }) {
  if (catalog.experiences.length === 0) {
    return (
      <EmptyState
        title="Estamos preparando nuevas experiencias"
        description="Escríbenos por WhatsApp y armamos tu celebración a la medida."
      />
    );
  }

  const ranked = rankExperiences(catalog.experiences, {
    occasion: draft.occasion,
    styleId: draft.styleId,
    guestCount: draft.guestCount,
  });
  const recommended = ranked.filter((r) => r.recommended);
  const others = ranked.filter((r) => !r.recommended);
  const styleName = catalog.styles.find((s) => s.id === draft.styleId)?.name;

  const card = (r: RankedExperience<CatalogExperience>) => {
    const e = r.experience;
    const src = safeImageSrc(e.coverImageUrl, PLACEHOLDER_IMAGES.experience);
    return (
      <ChoiceCard
        key={e.id}
        value={e.id}
        horizontal
        title={e.name}
        badge={
          r.recommended ? (
            <SoftBadge>
              <Sparkles className="size-3" aria-hidden /> Recomendada
            </SoftBadge>
          ) : null
        }
        description={e.tagline ?? undefined}
        media={
          <Image
            src={src}
            alt={`Experiencia ${e.name}`}
            fill
            sizes="(min-width: 640px) 192px, 100vw"
            className="object-cover"
            unoptimized={!canOptimizeImage(src)}
          />
        }
        meta={
          <span className="flex flex-col gap-2">
            <span className="flex flex-wrap gap-1.5">
              <MetaPill className="bg-olive/10 text-olive">Desde {formatMXN(e.basePriceCents)}</MetaPill>
              <MetaPill>
                <Users className="size-3" aria-hidden /> {e.minGuests}–{e.maxGuests} personas
              </MetaPill>
              <MetaPill>
                <Clock className="size-3" aria-hidden /> {hours(e.durationMinutes)}
              </MetaPill>
              <MetaPill>{EXPERIENCE_TYPE_LABELS[e.type]}</MetaPill>
            </span>
            <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {r.match.occasion && draft.occasion ? (
                <span>✓ Ideal para {OCCASION_LABELS[draft.occasion as Occasion].toLowerCase()}</span>
              ) : null}
              {r.match.style && styleName ? <span>✓ Estilo {styleName.toLowerCase()}</span> : null}
              {r.match.guests === false ? (
                <span className="text-warning">
                  Pensada para {e.minGuests}–{e.maxGuests} personas (lo ajustamos contigo)
                </span>
              ) : null}
            </span>
          </span>
        }
      />
    );
  };

  return (
    <ChoiceGroup
      value={draft.experienceId}
      onValueChange={onSelectExperience}
      labelledBy={labelledBy}
      describedBy={invalid ? errorId : undefined}
      invalid={invalid}
      className="gap-8"
    >
      {recommended.length ? (
        <div className="space-y-3">
          <h3 className="eyebrow">Recomendadas para ti</h3>
          <div className="grid gap-3">{recommended.map(card)}</div>
        </div>
      ) : null}
      {others.length ? (
        <div className="space-y-3">
          <h3 className="eyebrow">{recommended.length ? "Otras experiencias" : "Nuestras experiencias"}</h3>
          <div className="grid gap-3">{others.map(card)}</div>
        </div>
      ) : null}
    </ChoiceGroup>
  );
}
