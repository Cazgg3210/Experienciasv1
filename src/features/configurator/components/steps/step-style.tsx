"use client";

import Image from "next/image";
import { EmptyState } from "@/components/feedback/empty-state";
import { PLACEHOLDER_IMAGES, canOptimizeImage, safeImageSrc } from "../../domain/images";
import { ChoiceCard, ChoiceGroup } from "../choice-cards";
import type { StepProps } from "./types";

export function StepStyle({ draft, update, catalog, labelledBy, errorId, invalid }: StepProps) {
  if (catalog.styles.length === 0) {
    return (
      <EmptyState
        title="Estamos renovando nuestros estilos"
        description="Continúa y en las preferencias cuéntanos cómo te imaginas la mesa."
      />
    );
  }
  return (
    <ChoiceGroup
      value={draft.styleId}
      onValueChange={(v) => update({ styleId: v })}
      labelledBy={labelledBy}
      describedBy={invalid ? errorId : undefined}
      invalid={invalid}
      className="sm:grid-cols-2 xl:grid-cols-3"
    >
      {catalog.styles.map((s) => {
        const src = safeImageSrc(s.imageUrl, PLACEHOLDER_IMAGES.style);
        return (
          <ChoiceCard
            key={s.id}
            value={s.id}
            title={s.name}
            description={s.description ?? undefined}
            media={
              <Image
                src={src}
                alt={`Mesa de estilo ${s.name.toLowerCase()}`}
                fill
                sizes="(min-width: 1280px) 260px, (min-width: 640px) 45vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                unoptimized={!canOptimizeImage(src)}
              />
            }
            meta={
              s.palette.length ? (
                <span aria-hidden className="flex items-center gap-1.5">
                  {s.palette.slice(0, 6).map((c, i) => (
                    <span
                      key={`${c}-${i}`}
                      className="size-5 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: /^#[0-9a-f]{3,8}$/i.test(c) ? c : undefined }}
                    />
                  ))}
                </span>
              ) : undefined
            }
          />
        );
      })}
    </ChoiceGroup>
  );
}
