"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { deleteCustomerAction } from "../server/actions";

/** Eliminar clienta (sólo sin cotizaciones, reservas ni eventos). */
export function CustomerDeleteButton({
  customerId,
  customerName,
  leadsCount,
}: {
  customerId: string;
  customerName: string;
  leadsCount: number;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      destructive
      title={`¿Eliminar a ${customerName}?`}
      description={
        leadsCount > 0
          ? `Se eliminará su ficha. ${leadsCount === 1 ? "Su lead se conserva" : `Sus ${leadsCount} leads se conservan`} sin clienta vinculada. Esta acción no se puede deshacer.`
          : "Se eliminará su ficha. Esta acción no se puede deshacer."
      }
      confirmLabel="Eliminar clienta"
      onConfirm={async () => {
        const res = await deleteCustomerAction({ customerId });
        if (handleActionResult(res, { success: "Clienta eliminada" })) {
          router.push("/admin/customers");
        }
      }}
      trigger={
        <Button variant="destructive" size="lg">
          <Trash2 aria-hidden />
          Eliminar
        </Button>
      }
    />
  );
}
