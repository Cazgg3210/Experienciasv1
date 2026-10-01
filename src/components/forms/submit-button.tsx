"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botón con estado de carga accesible. */
export function SubmitButton({
  pending,
  children,
  pendingText = "Guardando…",
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean; pendingText?: string }) {
  return (
    <Button type="submit" {...props} disabled={pending || disabled} aria-busy={pending || undefined}>
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
