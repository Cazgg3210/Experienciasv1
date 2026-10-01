"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { nextIndex, prevIndex } from "../domain/capsule";

export type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  uploaderName: string | null;
};

const FALLBACK_W = 1200;
const FALLBACK_H = 900;

/**
 * Galería tipo "masonry" (columnas CSS) con lightbox accesible:
 * diálogo modal con foco atrapado, Esc para cerrar, ← → para navegar y swipe en móvil.
 */
export function CapsuleGallery({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const touchStartX = useRef<number | null>(null);
  const lastIndex = useRef(0);

  const total = photos.length;
  const current = openIndex !== null ? photos[openIndex] : null;

  const go = useCallback(
    (dir: 1 | -1) => {
      setOpenIndex((i) => {
        if (i === null) return i;
        const n = dir === 1 ? nextIndex(i, total) : prevIndex(i, total);
        lastIndex.current = n;
        return n;
      });
    },
    [total],
  );

  function open(i: number) {
    lastIndex.current = i;
    setOpenIndex(i);
  }

  return (
    <>
      <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4" aria-label={`Fotos de ${title}`}>
        {photos.map((p, i) => (
          <li key={p.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              ref={(el) => {
                triggers.current[i] = el;
              }}
              type="button"
              onClick={() => open(i)}
              className="group focus-visible:ring-ring bg-sand-soft relative block w-full overflow-hidden rounded-2xl outline-none focus-visible:ring-3"
              aria-label={`Ver foto ${i + 1} de ${total}: ${p.alt}`}
            >
              <Image
                src={p.url}
                alt={p.alt}
                width={p.width ?? FALLBACK_W}
                height={p.height ?? FALLBACK_H}
                unoptimized
                loading={i < 4 ? "eager" : "lazy"}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              {p.uploaderName ? (
                <span className="bg-charcoal/55 text-ivory absolute right-2 bottom-2 left-2 truncate rounded-full px-2.5 py-1 text-left text-[11px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                  {p.uploaderName}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={openIndex !== null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <DialogContent
          showCloseButton={false}
          className="bg-charcoal/95 text-ivory flex max-h-[100dvh] w-full max-w-[calc(100%-1rem)] flex-col gap-3 border-0 p-3 ring-0 sm:max-w-5xl sm:p-5 motion-reduce:animate-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              go(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(-1);
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggers.current[lastIndex.current]?.focus();
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartX.current;
            const end = e.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start == null || end == null) return;
            const dx = end - start;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-ivory text-sm font-medium" aria-live="polite">
              Foto {openIndex !== null ? openIndex + 1 : 0} de {total}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpenIndex(null)}
              className="text-ivory hover:bg-ivory/10 hover:text-ivory"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden />
            </Button>
          </div>

          {current ? (
            <figure className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
              <Image
                key={current.id}
                src={current.url}
                alt={current.alt}
                width={current.width ?? FALLBACK_W}
                height={current.height ?? FALLBACK_H}
                unoptimized
                priority
                className="mx-auto h-auto max-h-[72dvh] w-auto max-w-full rounded-lg object-contain"
              />
              <figcaption className="text-ivory/80 text-center text-xs sm:text-sm">
                <DialogDescription className="text-ivory/80">
                  {current.alt}
                  {current.uploaderName ? ` · Foto de ${current.uploaderName}` : ""}
                </DialogDescription>
              </figcaption>
            </figure>
          ) : null}

          {total > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => go(-1)}
                className="border-ivory/30 text-ivory hover:bg-ivory/10 hover:text-ivory bg-transparent"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="size-5" aria-hidden />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => go(1)}
                className="border-ivory/30 text-ivory hover:bg-ivory/10 hover:text-ivory bg-transparent"
                aria-label="Foto siguiente"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
          ) : null}
          <p className="text-ivory/60 hidden text-center text-[11px] sm:block">
            Usa ← → para navegar · Esc para cerrar
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
