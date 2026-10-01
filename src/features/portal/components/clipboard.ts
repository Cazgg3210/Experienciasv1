"use client";

import { toast } from "sonner";

/**
 * Copia texto al portapapeles con respaldo para navegadores sin Clipboard API
 * (iOS antiguos / contextos no seguros). Muestra toast de éxito o error.
 */
export async function copyText(text: string, successMessage = "Copiado"): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) throw new Error("copy_failed");
    }
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("No se pudo copiar. Mantén presionado el texto para copiarlo manualmente.");
    return false;
  }
}

/** Comparte con la hoja nativa del teléfono si existe; si no, copia. */
export async function shareOrCopy(data: { title?: string; text: string; url?: string }, copiedMessage: string) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: data.title, text: data.text });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
    }
  }
  return copyText(data.text, copiedMessage);
}
