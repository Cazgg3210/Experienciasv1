"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="contenido" className="bg-ivory flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="bg-sand-soft text-taupe mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
          <CloudOff className="size-6" aria-hidden />
        </div>
        <h1 className="font-heading text-3xl font-semibold">No pudimos cargar tu evento</h1>
        <p className="text-muted-foreground mt-3">
          Puede ser tu conexión o un problema temporal de nuestro lado. Intenta de nuevo en un momento.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Referencia: <span className="bg-muted rounded px-1.5 py-0.5 font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button size="xl" onClick={reset}>
            Reintentar
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-full px-6 text-base">
            <Link href="/mi-evento">Pedir mi enlace de nuevo</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
