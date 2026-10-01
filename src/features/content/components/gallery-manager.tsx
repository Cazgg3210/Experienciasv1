"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Images } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { MediaUploader } from "@/components/media/media-uploader";
import { handleActionResult } from "@/components/forms/action-result";
import { cn } from "@/lib/utils";
import {
  deleteGalleryItemAction,
  finalizeGalleryUploadAction,
  moveGalleryItemAction,
  setGalleryFeaturedAction,
  updateGalleryAltAction,
} from "../server/actions";
import { DeleteButton, OrderButtons, ToggleSwitch } from "./content-controls";

export type GalleryCardItem = {
  id: string;
  alt: string | null;
  featured: boolean;
  url: string;
};

function AltEditor({ item }: { item: GalleryCardItem }) {
  const router = useRouter();
  const [value, setValue] = useState(item.alt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = `alt-${item.id}`;
  const errId = `${inputId}-err`;
  const dirty = value.trim() !== (item.alt ?? "");
  return (
    <form
      className="space-y-1.5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const alt = value.trim();
        if (alt.length < 3) {
          setError("Describe la imagen (mínimo 3 caracteres).");
          return;
        }
        setError(null);
        startTransition(async () => {
          const res = await updateGalleryAltAction({ id: item.id, alt });
          if (!res.ok) setError(res.fieldErrors?.alt?.[0] ?? res.error);
          if (handleActionResult(res, { success: "Texto alternativo guardado" })) router.refresh();
        });
      }}
    >
      <label htmlFor={inputId} className="text-xs font-medium">
        Texto alternativo <span className="text-destructive" aria-hidden>*</span>
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ej. Mesa de brunch con flores blancas"
          maxLength={200}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          aria-required
        />
        <Button type="submit" variant="outline" size="icon" disabled={pending || !dirty} aria-label="Guardar texto alternativo">
          <Check aria-hidden />
        </Button>
      </div>
      {error ? (
        <p id={errId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function GalleryManager({ items }: { items: GalleryCardItem[] }) {
  const router = useRouter();
  const missingAlt = items.filter((i) => !i.alt?.trim()).length;

  return (
    <section aria-labelledby="gallery-title" className="space-y-4">
      <div>
        <h2 id="gallery-title" className="font-heading text-2xl font-semibold">
          Galería
        </h2>
        <p className="text-muted-foreground text-sm">
          {items.length} imagen{items.length === 1 ? "" : "es"}. Las destacadas aparecen en la portada; todas necesitan texto
          alternativo para ser accesibles.
        </p>
      </div>

      <MediaUploader
        fields={{ purpose: "GALLERY", visibility: "PUBLIC" }}
        multiple
        label="Sube fotos a la galería"
        hint="Arrastra o elige varias · JPG, PNG o WEBP · máx. 8 MB c/u"
        onUploaded={async (media) => {
          const res = await finalizeGalleryUploadAction({ id: media.id });
          if (!res.ok) toast.error(res.error);
          router.refresh();
        }}
      />

      {missingAlt > 0 ? (
        <p role="note" className="border-warning/30 bg-warning/10 text-warning flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {missingAlt} imagen{missingAlt === 1 ? "" : "es"} sin texto alternativo. Agrégalo para que el sitio sea accesible.
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Images}
          title="La galería está vacía"
          description="Sube fotos de tus montajes favoritos: mesas, flores, detalles. Se verán en el sitio público."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => {
            const local = item.url.startsWith("/images/");
            return (
              <li key={item.id} className="bg-card flex flex-col overflow-hidden rounded-xl border shadow-xs">
                <div className="bg-sand-soft relative aspect-[4/3]">
                  <Image
                    src={item.url}
                    alt={item.alt ?? ""}
                    fill
                    sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                    className="object-cover"
                    unoptimized={!local}
                    priority={i < 2}
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className="bg-card/90 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">#{i + 1}</span>
                    {item.featured ? <StatusBadge tone="brand" className="bg-card/90">Destacada</StatusBadge> : null}
                  </div>
                  {!item.alt?.trim() ? (
                    <span className="bg-warning text-warning-foreground absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs font-medium">
                      Falta texto alternativo
                    </span>
                  ) : null}
                </div>
                <div className={cn("flex flex-1 flex-col gap-3 p-4")}>
                  <AltEditor key={`${item.id}:${item.alt ?? ""}`} item={item} />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <ToggleSwitch
                      id={`featured-${item.id}`}
                      label="Destacada"
                      checked={item.featured}
                      onToggle={(featured) => setGalleryFeaturedAction({ id: item.id, featured })}
                      successOn="Imagen destacada"
                      successOff="Imagen ya no destacada"
                    />
                    <div className="flex items-center gap-2">
                      <OrderButtons
                        label={`imagen ${i + 1}`}
                        isFirst={i === 0}
                        isLast={i === items.length - 1}
                        onMove={(direction) => moveGalleryItemAction({ id: item.id, direction })}
                      />
                      <DeleteButton
                        title="¿Eliminar esta imagen?"
                        description="Se borrará de la galería y del almacenamiento. Esta acción no se puede deshacer."
                        onDelete={() => deleteGalleryItemAction({ id: item.id })}
                        success="Imagen eliminada"
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
