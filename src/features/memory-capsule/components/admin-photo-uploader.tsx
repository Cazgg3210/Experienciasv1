"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { MediaUploader } from "@/components/media/media-uploader";

/** Subida de fotos del equipo (aprobadas por defecto) a la cápsula. */
export function AdminPhotoUploader({ eventId, capsuleId }: { eventId: string; capsuleId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <MediaUploader
      multiple
      label="Sube fotos del evento"
      hint="Arrastra o elige varias · JPG, PNG o WEBP · máx. 8 MB c/u · se publican aprobadas"
      fields={{ purpose: "MEMORY", eventId, memoryCapsuleId: capsuleId, visibility: "PRIVATE" }}
      onUploaded={() => {
        // Refresca una sola vez al terminar una ráfaga de subidas.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 400);
      }}
    />
  );
}
