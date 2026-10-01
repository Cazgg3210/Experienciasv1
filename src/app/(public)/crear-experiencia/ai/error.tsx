"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export default function AiDesignerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-ivory min-h-[60dvh]">
      <div className="container-page max-w-3xl py-14 sm:py-24">
        <h1 className="sr-only">Diseñador de experiencias con IA</h1>
        <EmptyState
          icon={TriangleAlert}
          title="No pudimos cargar el diseñador"
          description="Algo salió mal de nuestro lado. Intenta de nuevo o arma tu experiencia paso a paso."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" className="h-11 rounded-full px-5" onClick={reset}>
                <RotateCcw aria-hidden />
                Reintentar
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-5">
                <Link href="/crear-experiencia">Ir al configurador</Link>
              </Button>
            </div>
          }
        />
        {error.digest ? (
          <p className="text-muted-foreground mt-4 text-center text-xs">Referencia: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
