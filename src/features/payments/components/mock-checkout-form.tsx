"use client";

import * as React from "react";
import { CreditCard, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleActionResult } from "@/components/forms/action-result";
import { mockCheckoutAction } from "../server/mock-checkout-actions";

type Outcome = "success" | "failure" | "cancel";

/** Botones del checkout simulado (modo demo): pagar, simular rechazo o cancelar. */
export function MockCheckoutForm({
  checkoutId,
  from,
  amountLabel,
}: {
  checkoutId: string;
  from?: "quote" | "portal";
  amountLabel: string;
}) {
  const [pending, setPending] = React.useState<Outcome | null>(null);

  async function run(outcome: Outcome) {
    setPending(outcome);
    try {
      const res = await mockCheckoutAction({ checkoutId, outcome, from });
      if (handleActionResult(res)) {
        window.location.assign(res.data.redirectTo);
        return;
      }
    } catch {
      handleActionResult({ ok: false, error: "No pudimos procesar la simulación. Intenta de nuevo." });
    }
    setPending(null);
  }

  const busy = pending !== null;
  return (
    <div className="space-y-3" aria-busy={busy || undefined}>
      <Button size="xl" className="w-full" onClick={() => run("success")} disabled={busy}>
        {pending === "success" ? (
          <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden />
        ) : (
          <CreditCard className="size-5" aria-hidden />
        )}
        <span>{pending === "success" ? "Procesando pago…" : `Pagar ${amountLabel} (simulado)`}</span>
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" className="h-11 rounded-full" onClick={() => run("failure")} disabled={busy}>
          {pending === "failure" ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <XCircle className="size-4" aria-hidden />
          )}
          <span>Simular pago rechazado</span>
        </Button>
        <Button variant="ghost" className="h-11 rounded-full" onClick={() => run("cancel")} disabled={busy}>
          {pending === "cancel" ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <X className="size-4" aria-hidden />
          )}
          <span>Cancelar</span>
        </Button>
      </div>
    </div>
  );
}
