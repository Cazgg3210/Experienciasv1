"use client";

import * as React from "react";
import { ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UploadedMedia = { id: string; url: string; mimeType: string; sizeBytes: number };

/**
 * Subida de archivos (drag & drop o selector), con vista previa y estados.
 * Por defecto usa /api/media/upload (sesión del equipo). Para clientas/invitadas,
 * pasar el `endpoint` por token del módulo correspondiente.
 *
 * <MediaUploader fields={{ purpose: "EXPERIENCE", visibility: "PUBLIC" }} onUploaded={(m) => ...} />
 */
export function MediaUploader({
  endpoint = "/api/media/upload",
  fields = {},
  accept = "image/jpeg,image/png,image/webp",
  multiple = false,
  label = "Sube una foto",
  hint = "JPG, PNG o WEBP · máx. 8 MB",
  onUploaded,
  className,
  disabled,
}: {
  endpoint?: string;
  fields?: Record<string, string | undefined>;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  onUploaded?: (media: UploadedMedia) => void;
  className?: string;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputId = React.useId();

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        for (const [k, v] of Object.entries(fields)) if (v !== undefined) body.append(k, v);
        const res = await fetch(endpoint, { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as Partial<UploadedMedia> & { error?: string };
        if (!res.ok || !json.id) {
          toast.error(json.error ?? "No se pudo subir el archivo.");
          continue;
        }
        ok += 1;
        onUploaded?.(json as UploadedMedia);
      }
      if (ok > 0) toast.success(ok > 1 ? `${ok} archivos subidos` : "Archivo subido");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
        dragOver ? "border-olive bg-sage-soft/50" : "border-input bg-card/50",
        (disabled || busy) && "opacity-60",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled && !busy) void upload(e.dataTransfer.files);
      }}
    >
      {busy ? (
        <Loader2 className="text-olive size-6 animate-spin" aria-hidden />
      ) : multiple ? (
        <UploadCloud className="text-olive size-6" aria-hidden />
      ) : (
        <ImagePlus className="text-olive size-6" aria-hidden />
      )}
      <label htmlFor={inputId} className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
        {busy ? "Subiendo…" : label}
      </label>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || busy}
        className="sr-only"
        onChange={(e) => e.target.files && void upload(e.target.files)}
      />
    </div>
  );
}
