"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Eye, EyeOff, ImageIcon, Star, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteCapsuleMediaAction, setCoverAction, setMediaApprovalAction } from "../server/actions";

export type ModerationMedia = {
  id: string;
  url: string;
  alt: string;
  uploaderName: string | null;
  uploadedByTeam: boolean;
  consent: boolean;
  approved: boolean;
  isCover: boolean;
  createdAtLabel: string;
};

type Filter = "all" | "pending" | "approved";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Por revisar / ocultas" },
  { value: "approved", label: "Visibles" },
];

export function MediaModerationGrid({ capsuleId, media }: { capsuleId: string; media: ModerationMedia[] }) {
  const [filter, setFilter] = useState<Filter>(() => (media.some((m) => !m.approved) ? "pending" : "all"));
  const counts = useMemo(
    () => ({
      all: media.length,
      pending: media.filter((m) => !m.approved).length,
      approved: media.filter((m) => m.approved).length,
    }),
    [media],
  );
  const visible = media.filter((m) => (filter === "all" ? true : filter === "pending" ? !m.approved : m.approved));

  if (!media.length) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Aún no hay fotos"
        description="Sube las fotos del evento o espera las de las invitadas: aquí podrás aprobarlas, ocultarlas y elegir la portada."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filtrar fotos" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span className="tabular opacity-80">({counts[f.value]})</span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          {filter === "pending" ? "No hay fotos por revisar. ¡Todo al día!" : "No hay fotos en este filtro."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((m) => (
            <MediaCard key={m.id} capsuleId={capsuleId} media={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaCard({ capsuleId, media }: { capsuleId: string; media: ModerationMedia }) {
  const [pending, startTransition] = useTransition();

  function toggleApproval() {
    startTransition(async () => {
      const res = await setMediaApprovalAction({ capsuleId, mediaId: media.id, approved: !media.approved });
      handleActionResult(res, { success: media.approved ? "Foto oculta" : "Foto aprobada" });
    });
  }

  function makeCover() {
    startTransition(async () => {
      const res = await setCoverAction({ capsuleId, mediaId: media.isCover ? null : media.id });
      handleActionResult(res, { success: media.isCover ? "Portada quitada" : "Portada actualizada" });
    });
  }

  async function remove() {
    const res = await deleteCapsuleMediaAction({ capsuleId, mediaId: media.id });
    handleActionResult(res, { success: "Foto eliminada" });
  }

  return (
    <li
      className={cn(
        "bg-card flex flex-col overflow-hidden rounded-xl border",
        !media.approved && "border-warning/40",
        pending && "opacity-70",
      )}
      aria-busy={pending || undefined}
    >
      <div className="bg-sand-soft relative aspect-square">
        <Image
          src={media.url}
          alt={media.alt}
          fill
          unoptimized
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 50vw"
          className={cn("object-cover", !media.approved && "opacity-60 grayscale-[35%]")}
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {media.isCover ? (
            <StatusBadge tone="brand" className="bg-ivory/95">
              Portada
            </StatusBadge>
          ) : null}
          <StatusBadge tone={media.approved ? "success" : "warning"} className="bg-ivory/95">
            {media.approved ? "Visible" : "Oculta"}
          </StatusBadge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0 text-xs">
          <p className="truncate font-medium" title={media.uploaderName ?? undefined}>
            {media.uploaderName ?? "Sin nombre"}
            {media.uploadedByTeam ? <span className="text-muted-foreground font-normal"> · equipo</span> : null}
          </p>
          <p className="text-muted-foreground">{media.createdAtLabel}</p>
        </div>
        <StatusBadge tone={media.consent ? "brand" : "danger"} className="self-start">
          {media.consent ? "Con consentimiento" : "Sin consentimiento"}
        </StatusBadge>
        <div className="mt-auto flex flex-wrap gap-1">
          <Button
            type="button"
            size="xs"
            variant={media.approved ? "outline" : "default"}
            disabled={pending}
            onClick={toggleApproval}
            aria-label={`${media.approved ? "Ocultar" : "Aprobar"}: ${media.alt}`}
          >
            {media.approved ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {media.approved ? "Ocultar" : "Aprobar"}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={makeCover}
            aria-label={media.isCover ? `Quitar como portada: ${media.alt}` : `Usar como portada: ${media.alt}`}
          >
            <Star aria-hidden className={cn(media.isCover && "fill-current")} />
            {media.isCover ? "Quitar" : "Portada"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button type="button" size="icon-xs" variant="ghost" disabled={pending} aria-label={`Eliminar foto: ${media.alt}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title="¿Eliminar esta foto?"
            description="Se borrará de la cápsula y del almacenamiento. Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            destructive
            onConfirm={remove}
          />
        </div>
      </div>
    </li>
  );
}
