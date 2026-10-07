"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "./use-hydrated";

/**
 * Botón con estado de carga accesible.
 *
 * `waitForHydration`: para formularios que se ven desde el HTML del servidor (públicos o por token). Hasta que la
 * página hidrata el botón queda deshabilitado y con `aria-busy` (carga), así que ni el clic ni Enter disparan el
 * envío nativo del navegador, que iría por GET a la URL actual con los datos personales en la query (historial,
 * logs, Referer). El `<form>` además lleva `method="post"` y un `<NoScriptNotice />`.
 */
export function SubmitButton({
  pending,
  children,
  pendingText = "Guardando…",
  disabled,
  waitForHydration = false,
  ...props
}: React.ComponentProps<typeof Button> & {
  pending?: boolean;
  pendingText?: string;
  waitForHydration?: boolean;
}) {
  const hydrated = useHydrated();
  const loading = waitForHydration && !hydrated;
  return (
    <Button
      type="submit"
      {...props}
      disabled={pending || loading || disabled}
      aria-busy={pending || loading || undefined}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>{pendingText}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
