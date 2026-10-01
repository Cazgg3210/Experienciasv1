"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StaffEventError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl font-semibold">No pudimos cargar el evento</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Revisa tu conexión e intenta de nuevo. Referencia:{" "}
        <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{error.digest ?? "sin-ref"}</span>
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button size="xl" onClick={reset}>
          Reintentar
        </Button>
        <Button size="xl" variant="outline" asChild>
          <Link href="/staff">Mis eventos</Link>
        </Button>
      </div>
    </div>
  );
}
