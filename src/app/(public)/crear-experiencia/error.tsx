"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfiguratorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-ivory">
      <div className="container-page flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center">
        <p className="eyebrow mb-3">Crea tu experiencia</p>
        <h1 className="font-heading max-w-xl text-4xl font-semibold text-balance">
          No pudimos cargar el configurador
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md">
          Fue un problema de nuestro lado. Intenta de nuevo en un momento; si continúa, escríbenos y armamos
          tu experiencia contigo.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-2 text-xs">Referencia: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="xl" onClick={reset}>
            <RotateCcw aria-hidden /> Reintentar
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href="/contacto">Contáctanos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
