"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Estado de error reutilizable para las rutas de finanzas y analytics (error.tsx). */
export function RouteError({
  error,
  reset,
  title = "No pudimos cargar esta sección",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-lg py-16 text-center">
      <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Puede ser algo momentáneo. Intenta de nuevo; si continúa, comparte esta referencia con soporte:
        <span className="bg-muted ml-1 rounded px-1.5 py-0.5 font-mono text-xs">
          {error.digest ?? "sin-ref"}
        </span>
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw aria-hidden /> Reintentar
      </Button>
    </div>
  );
}
