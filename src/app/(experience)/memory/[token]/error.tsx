"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MemoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="contenido" className="bg-ivory flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="size-5" aria-hidden />
        </div>
        <h1 className="font-heading text-3xl font-semibold">No pudimos abrir la cápsula</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Fue un problema de nuestro lado. Intenta de nuevo en un momento.
          {error.digest ? (
            <span className="bg-muted ml-1 rounded px-1.5 py-0.5 font-mono text-xs">ref {error.digest}</span>
          ) : null}
        </p>
        <Button className="mt-6 rounded-full" size="lg" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </main>
  );
}
