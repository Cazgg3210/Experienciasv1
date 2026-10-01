"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { deleteStaffMemberAction } from "../server/actions";

/** Sólo se muestra cuando el integrante no tiene historial de asignaciones. */
export function DeleteStaffButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" className="text-destructive">
          <Trash2 className="size-4" aria-hidden />
          Eliminar integrante
        </Button>
      }
      title={`¿Eliminar a ${name}?`}
      description="No tiene eventos en su historial, así que puede eliminarse. Si tenía acceso al portal, también se desactiva."
      confirmLabel="Eliminar"
      destructive
      onConfirm={async () => {
        const res = await deleteStaffMemberAction({ id });
        if (handleActionResult(res, { success: "Integrante eliminado" })) router.push("/admin/staff");
      }}
    />
  );
}
