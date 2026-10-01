"use client";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";

/** Pie de formulario con guardar / descartar cambios. */
export function FormFooter({
  pending,
  dirty,
  disabled,
  onReset,
  submitLabel = "Guardar cambios",
}: {
  pending: boolean;
  dirty: boolean;
  disabled?: boolean;
  onReset: () => void;
  submitLabel?: string;
}) {
  if (disabled) return null;
  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-2 border-t px-1 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
      <p className="text-muted-foreground mr-auto text-xs" aria-live="polite">
        {dirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
      </p>
      <Button type="button" variant="ghost" size="lg" onClick={onReset} disabled={!dirty || pending}>
        Descartar
      </Button>
      <SubmitButton size="lg" pending={pending} disabled={!dirty} className="px-5">
        {submitLabel}
      </SubmitButton>
    </div>
  );
}
