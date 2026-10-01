"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Límite de error del sitio público: mensaje cálido, reintento y salida clara (sin detalles técnicos). */
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("public_site.render_error", { digest: error.digest });
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center" role="alert">
      <p className="eyebrow mb-3">Ups</p>
      <h1 className="font-heading text-charcoal max-w-xl text-4xl font-medium text-balance sm:text-5xl">
        Algo no salió como esperábamos
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md">
        Estamos acomodando la mesa. Intenta de nuevo en un momento o escríbenos y con gusto te ayudamos.
      </p>
      {error.digest ? <p className="text-muted-foreground mt-2 text-xs">Referencia: {error.digest}</p> : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="xl" onClick={() => reset()}>
          <RotateCcw aria-hidden />
          Intentar de nuevo
        </Button>
        <Button asChild size="xl" variant="ghost" className="rounded-full">
          <Link href="/contacto">Contáctanos</Link>
        </Button>
      </div>
    </div>
  );
}
