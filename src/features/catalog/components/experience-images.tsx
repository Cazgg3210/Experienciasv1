"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { MediaUploader } from "@/components/media/media-uploader";
import { cn } from "@/lib/utils";
import { moveItem, publicMediaPath } from "../domain/catalog-rules";
import type { ExperienceImageItem } from "../server/queries";
import {
  addExperienceImageAction,
  removeExperienceImageAction,
  reorderExperienceImagesAction,
} from "../server/actions";
import { CatalogImage } from "./catalog-image";

/** Galería de la experiencia: subir, reordenar, quitar y usar como portada. Guarda al instante. */
export function ExperienceImages({
  experienceId,
  experienceName,
  images: initial,
  coverUrl,
  onUseAsCover,
  onRemoved,
  disabled,
}: {
  experienceId: string;
  experienceName: string;
  images: ExperienceImageItem[];
  coverUrl: string;
  onUseAsCover: (url: string) => void;
  /** Avisa al editor que se quitó una imagen (y si el servidor limpió la portada guardada). */
  onRemoved?: (url: string, coverCleared: boolean) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [images, setImages] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setImages(initial), [initial]);

  async function persistOrder(next: ExperienceImageItem[]) {
    const previous = images;
    setImages(next);
    setBusy(true);
    const res = await reorderExperienceImagesAction({ experienceId, orderedIds: next.map((i) => i.id) });
    setBusy(false);
    if (!res.ok) {
      setImages(previous);
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {images.length ? (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((img, i) => {
            const isCover = coverUrl === img.url;
            return (
              <li key={img.id} className="bg-background overflow-hidden rounded-xl border">
                <div className="relative aspect-[4/3]">
                  <CatalogImage
                    src={img.url}
                    alt={img.alt ?? `${experienceName} — imagen ${i + 1}`}
                    sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 50vw"
                  />
                  <span className="bg-background/90 tabular absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium">
                    {i + 1}
                  </span>
                  {isCover ? (
                    <span className="bg-olive absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white">
                      <Star className="size-3" aria-hidden /> Portada
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 p-1.5">
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || busy || i === 0}
                      onClick={() => persistOrder(moveItem(images, i, -1))}
                      aria-label={`Mover imagen ${i + 1} antes`}
                    >
                      <ArrowLeft aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || busy || i === images.length - 1}
                      onClick={() => persistOrder(moveItem(images, i, 1))}
                      aria-label={`Mover imagen ${i + 1} después`}
                    >
                      <ArrowRight aria-hidden />
                    </Button>
                  </div>
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || isCover}
                      onClick={() => {
                        onUseAsCover(img.url);
                        toast.info("Portada actualizada en el formulario. Guarda los cambios para publicarla.");
                      }}
                      aria-label={`Usar imagen ${i + 1} como portada`}
                      className={cn(isCover && "text-olive")}
                    >
                      <Star aria-hidden />
                    </Button>
                    <ConfirmDialog
                      destructive
                      title="¿Quitar esta imagen?"
                      description={
                        isCover
                          ? "Es la portada actual: se eliminará de la galería y la experiencia usará la siguiente foto como portada."
                          : "Se eliminará de la galería de la experiencia."
                      }
                      confirmLabel="Quitar"
                      onConfirm={async () => {
                        const res = await removeExperienceImageAction({ experienceId, imageId: img.id });
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        setImages((prev) => prev.filter((x) => x.id !== img.id));
                        onRemoved?.(img.url, res.data.coverCleared);
                        toast.success(res.data.coverCleared ? "Imagen quitada; la portada ahora es la primera foto" : "Imagen quitada");
                        router.refresh();
                      }}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled || busy}
                          aria-label={`Quitar imagen ${i + 1}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">
          Aún no hay fotos en la galería. La primera imagen se usa como portada si no defines una URL de portada.
        </p>
      )}
      <MediaUploader
        multiple
        disabled={disabled}
        fields={{ purpose: "EXPERIENCE", visibility: "PUBLIC", alt: experienceName.slice(0, 200) }}
        label="Sube fotos de la experiencia"
        hint="JPG, PNG o WEBP · máx. 8 MB · se publican en el sitio"
        onUploaded={async (media) => {
          const res = await addExperienceImageAction({ experienceId, mediaAssetId: media.id });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          setImages((prev) =>
            prev.some((p) => p.id === res.data.id)
              ? prev
              : [...prev, { id: res.data.id, mediaAssetId: media.id, url: publicMediaPath(media.id), alt: experienceName }],
          );
          router.refresh();
        }}
      />
    </div>
  );
}
