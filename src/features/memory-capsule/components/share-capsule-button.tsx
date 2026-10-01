"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Compartir la cápsula: Web Share API en móvil; si no existe, copia el enlace. */
export function ShareCapsuleButton({
  title,
  text,
  variant = "outline",
  size = "lg",
  className,
  label = "Compartir",
}: {
  title: string;
  text: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "lg" | "xl" | "default";
  className?: string;
  label?: string;
}) {
  async function onShare() {
    const url = window.location.href.split("#")[0]!;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return; // la persona canceló
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado. ¡Compártelo con quien celebró contigo!");
    } catch {
      toast.error("No pudimos copiar el enlace. Cópialo desde la barra de direcciones.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={onShare} className={cn(className)}>
      <Share2 className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
