"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startCheckoutAction } from "@/features/payments/server/checkout-actions";
import { cn } from "@/lib/utils";

export type PayKind = "DEPOSIT" | "BALANCE";

/** Inicia el checkout del proveedor (anticipo o saldo) a partir del token del portal. */
export function usePortalCheckout(token: string) {
  const [pending, startTransition] = React.useTransition();
  const pay = React.useCallback(
    (kind: PayKind) =>
      startTransition(async () => {
        try {
          const res = await startCheckoutAction({ token, tokenType: "portal", kind });
          if (res.ok && res.data?.url) {
            window.location.assign(res.data.url);
            return;
          }
          toast.error(res.ok ? "No pudimos abrir el pago. Intenta de nuevo." : res.error);
        } catch {
          toast.error("No pudimos abrir el pago. Revisa tu conexión e intenta de nuevo.");
        }
      }),
    [token],
  );
  return { pay, pending };
}

export function PayButton({
  token,
  kind,
  label,
  className,
}: {
  token: string;
  kind: PayKind;
  label: string;
  className?: string;
}) {
  const { pay, pending } = usePortalCheckout(token);
  return (
    <Button
      type="button"
      size="xl"
      className={cn("w-full sm:w-auto", className)}
      onClick={() => pay(kind)}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
      {pending ? "Abriendo pago seguro…" : label}
    </Button>
  );
}
