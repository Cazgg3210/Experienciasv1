"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function QuoteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="contenido" className="bg-ivory flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center" role="alert">
        <p className="eyebrow mb-3">Un momento</p>
        <h1 className="font-heading text-4xl font-semibold">No pudimos mostrar tu propuesta</h1>
        <p className="text-muted-foreground mt-3">
          Intenta de nuevo en unos segundos. Si el problema continúa, escríbenos y te ayudamos.
          {error.digest ? <span className="mt-2 block font-mono text-xs">Ref. {error.digest}</span> : null}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset} className="rounded-full">
            Reintentar
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/contacto">Contáctanos</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
