import { Star } from "lucide-react";
import type { VendorStatus } from "@prisma/client";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const VENDOR_STATUS_TONES: Record<VendorStatus, Tone> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  BLOCKED: "danger",
};

/** Calificación en estrellas (sólo lectura, accesible). */
export function RatingStars({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cn("text-muted-foreground text-xs", className)}>Sin calificar</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Calificación ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-3.5", n <= value ? "fill-warning text-warning" : "text-muted-foreground/40")}
          aria-hidden
        />
      ))}
    </span>
  );
}
