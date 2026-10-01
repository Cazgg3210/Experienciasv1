"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MESSAGES = [
  "Leyendo lo que nos contaste…",
  "Eligiendo la experiencia ideal…",
  "Combinando tu paleta de colores…",
  "Revisando el menú y las restricciones…",
  "Pensando en dinámicas para el grupo…",
  "Calculando con precios reales del catálogo…",
];

/** Estado de carga mientras se genera la propuesta (anunciado a lectores de pantalla). */
export function GeneratingState() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="border-border bg-card/80 rounded-3xl border px-6 py-12 text-center shadow-xs sm:px-10"
    >
      <div className="bg-sage-soft text-olive mx-auto mb-6 flex size-16 items-center justify-center rounded-full motion-safe:animate-pulse">
        <Sparkles aria-hidden className="size-7" />
      </div>
      <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Estamos diseñando tu experiencia</h2>
      <p className="text-muted-foreground mt-2 min-h-6 text-sm sm:text-base">{MESSAGES[i]}</p>
      <div className="mx-auto mt-8 max-w-md space-y-3" aria-hidden>
        <Skeleton className="mx-auto h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex justify-center gap-2 pt-2">
          {Array.from({ length: 5 }).map((_, k) => (
            <Skeleton key={k} className="size-10 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
