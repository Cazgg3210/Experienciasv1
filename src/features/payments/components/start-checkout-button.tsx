"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleActionResult } from "@/components/forms/action-result";
import { startCheckoutAction } from "../server/checkout-actions";

/**
 * Botón "Pagar" reutilizable (cotización aceptada o portal de la clienta).
 * Llama a startCheckoutAction y redirige a la pasarela. El pago se confirma SÓLO por webhook.
 *
 * <StartCheckoutButton token={quote.publicToken} tokenType="quote" kind="DEPOSIT">Pagar anticipo</StartCheckoutButton>
 */
export function StartCheckoutButton({
  token,
  tokenType,
  kind,
  children,
  pendingText = "Abriendo pago seguro…",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  token: string;
  tokenType: "quote" | "portal";
  kind: "DEPOSIT" | "BALANCE" | "FULL";
  pendingText?: string;
}) {
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      const res = await startCheckoutAction({ token, tokenType, kind });
      if (handleActionResult(res)) {
        window.location.assign(res.data.url);
        return; // mantener el estado de carga mientras navega
      }
    } catch {
      handleActionResult({ ok: false, error: "No pudimos abrir el pago. Revisa tu conexión e intenta de nuevo." });
    }
    setPending(false);
  }

  return (
    <Button
      type="button"
      size="xl"
      {...props}
      onClick={onClick}
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden />
          <span>{pendingText}</span>
        </>
      ) : (
        <>
          <Lock className="size-4" aria-hidden />
          <span>{children}</span>
        </>
      )}
    </Button>
  );
}
