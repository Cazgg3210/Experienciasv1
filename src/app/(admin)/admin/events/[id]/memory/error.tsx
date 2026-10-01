"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MemoryAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h2 className="font-heading text-2xl font-semibold">No pudimos cargar la Memory Capsule</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Intenta de nuevo. Si el problema continúa, comparte esta referencia:
        <span className="bg-muted ml-1 rounded px-1.5 py-0.5 font-mono text-xs">{error.digest ?? "sin-ref"}</span>
      </p>
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
