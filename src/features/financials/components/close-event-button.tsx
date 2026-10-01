"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { closeEventAction } from "../server/actions";

/** Cierra el evento: congela la rentabilidad y envía agradecimiento + solicitud de reseña. */
export function CloseEventButton({ eventId, warnings }: { eventId: string; warnings: string[] }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      title="¿Cerrar el evento?"
      description="Se congelará la rentabilidad con los números actuales y le enviaremos a la clienta el agradecimiento y la solicitud de reseña. Esta acción no se puede deshacer."
      confirmLabel="Cerrar evento"
      trigger={
        <Button size="lg">
          <Lock aria-hidden /> Cerrar evento
        </Button>
      }
      onConfirm={async () => {
        const res = await closeEventAction({ eventId });
        if (handleActionResult(res, { success: "Evento cerrado. Enviamos el agradecimiento a la clienta." }))
          router.refresh();
      }}
    >
      {warnings.length > 0 ? (
        <div
          role="alert"
          className="border-warning/30 bg-warning/10 text-warning rounded-lg border p-3 text-sm"
        >
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4" aria-hidden /> Antes de cerrar, revisa:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Todo en orden: sin saldo pendiente ni compras por recibir.
        </p>
      )}
    </ConfirmDialog>
  );
}
