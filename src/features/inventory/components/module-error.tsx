"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Estado de error para las secciones de Inventario, Proveedores y Compras. */
export function ModuleError({
  error,
  reset,
  title = "No pudimos cargar esta sección",
  backHref,
  backLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  backHref?: string;
  backLabel?: string;
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
        Intenta de nuevo en un momento. Si continúa, comparte esta referencia:
        <span className="bg-muted ml-1 rounded px-1.5 py-0.5 font-mono text-xs">{error.digest ?? "sin-ref"}</span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Reintentar</Button>
        {backHref ? (
          <Button variant="outline" asChild>
            <Link href={backHref}>{backLabel ?? "Volver"}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
