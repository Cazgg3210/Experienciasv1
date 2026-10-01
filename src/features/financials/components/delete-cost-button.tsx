"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { deleteEventCostAction } from "../server/actions";

export function DeleteCostButton({
  costId,
  description,
  amount,
}: {
  costId: string;
  description: string;
  amount: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      destructive
      title="¿Eliminar este costo?"
      description={`Se eliminará “${description}” (${amount}) del costo real del evento. Quedará registro en la auditoría.`}
      confirmLabel="Eliminar"
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Eliminar costo: ${description}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      onConfirm={async () => {
        const res = await deleteEventCostAction({ costId });
        if (handleActionResult(res, { success: "Costo eliminado" })) router.refresh();
      }}
    />
  );
}
