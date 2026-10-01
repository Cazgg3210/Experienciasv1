"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startCheckoutAction } from "@/features/payments/server/checkout-actions";

/** Inicia el checkout del anticipo (módulo Pagos) y redirige a la pasarela. */
export function PayDepositButton({ token, label }: { token: string; label: string }) {
  const [pending, setPending] = React.useState(false);
  async function pay() {
    setPending(true);
    try {
      const res = await startCheckoutAction({ token, tokenType: "quote", kind: "DEPOSIT" });
      if (res.ok && res.data?.url) {
        window.location.assign(res.data.url);
        return;
      }
      toast.error(res.ok ? "No pudimos iniciar el pago. Intenta de nuevo." : res.error);
      setPending(false);
    } catch {
      toast.error("No pudimos conectar con la pasarela. Revisa tu conexión e intenta de nuevo.");
      setPending(false);
    }
  }
  return (
    <Button size="xl" className="w-full sm:w-auto" onClick={pay} disabled={pending} aria-busy={pending || undefined}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
      {pending ? "Abriendo pago seguro…" : label}
    </Button>
  );
}
