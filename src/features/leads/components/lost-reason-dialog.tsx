"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

export const LOST_REASON_SUGGESTIONS = [
  "Eligió otra opción",
  "Fuera de presupuesto",
  "Fuera de zona de cobertura",
  "Fecha no disponible",
  "Ya no realizará el evento",
  "Sin respuesta",
];

/** Diálogo para capturar el motivo de pérdida (obligatorio para pasar a "Perdido"). */
export function LostReasonDialog({
  open,
  onOpenChange,
  leadName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(undefined);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = reason.trim();
    if (value.length < 2) {
      setError("Cuéntanos por qué se perdió");
      return;
    }
    setPending(true);
    try {
      const ok = await onConfirm(value);
      if (ok) onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Marcar como perdido</DialogTitle>
            <DialogDescription>
              ¿Por qué no avanzó {leadName}? Nos ayuda a entender el embudo y a reactivarla en el futuro.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5" aria-label="Motivos frecuentes">
            {LOST_REASON_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setReason(s);
                  setError(undefined);
                }}
                className="bg-sand-soft hover:bg-sand rounded-full border px-2.5 py-1 text-xs transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <Field label="Motivo" required error={error}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={reason}
                maxLength={500}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(undefined);
                }}
              />
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <SubmitButton pending={pending} pendingText="Guardando…" variant="destructive">
              Marcar como perdido
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
