"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PagoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="bg-card rounded-3xl border px-6 py-12 text-center">
      <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="font-heading text-3xl font-semibold">No pudimos cargar tu pago</h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
        No te preocupes: no se realizó ningún cargo adicional. Intenta de nuevo y, si el problema continúa, escríbenos por
        WhatsApp con esta referencia:
        <span className="bg-muted ml-1 rounded px-1.5 py-0.5 font-mono text-xs">{error.digest ?? "sin-ref"}</span>
      </p>
      <Button size="xl" className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
