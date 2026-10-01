"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botón con estado de carga accesible. */
export function SubmitButton({
  pending,
  children,
  pendingText = "Guardando…",
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean; pendingText?: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} {...props}>
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
