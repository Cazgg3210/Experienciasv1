"use client";

import { AlertTriangle, CalendarCheck2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvailabilityView = {
  status: string;
  reason: string;
  available: boolean;
  capacity: number;
  booked: number;
  remaining: number;
  overlaps: number;
};

/** Indicador en vivo de disponibilidad de la fecha/horario elegidos. */
export function AvailabilityHint({
  result,
  loading,
  className,
}: {
  result: AvailabilityView | null;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <p className={cn("text-muted-foreground flex items-center gap-2 text-sm", className)} role="status">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Revisando disponibilidad…
      </p>
    );
  }
  if (!result) return null;
  const ok = result.available;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        ok ? "border-success/25 bg-success/5 text-success" : "border-warning/30 bg-warning/10 text-warning",
        className,
      )}
    >
      {ok ? (
        <CalendarCheck2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <div>
        <p className="font-medium">{result.reason}</p>
        <p className="text-foreground/70 text-xs">
          {result.capacity > 0
            ? `Capacidad del día: ${result.booked} de ${result.capacity} ocupados.`
            : "Sin capacidad configurada para ese día."}
          {result.overlaps > 0 ? ` Se cruza con ${result.overlaps} evento(s) considerando el buffer.` : ""}
        </p>
      </div>
    </div>
  );
}
