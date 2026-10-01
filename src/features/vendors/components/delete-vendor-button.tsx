"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { deleteVendorAction } from "../server/actions";

export function DeleteVendorButton({ id, name, purchases }: { id: string; name: string; purchases: number }) {
  const router = useRouter();
  if (purchases > 0) {
    return (
      <Button variant="ghost" disabled title="Tiene compras registradas: márcalo como inactivo o bloqueado">
        <Trash2 className="size-4" aria-hidden /> Eliminar
      </Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" className="text-destructive">
          <Trash2 className="size-4" aria-hidden /> Eliminar
        </Button>
      }
      title={`¿Eliminar a ${name}?`}
      description="Esta acción no se puede deshacer. Si sólo dejarás de trabajar con este proveedor, márcalo como inactivo."
      confirmLabel="Eliminar proveedor"
      destructive
      onConfirm={async () => {
        const res = await deleteVendorAction({ id });
        if (handleActionResult(res, { success: "Proveedor eliminado" })) {
          router.push("/admin/vendors");
          router.refresh();
        }
      }}
    />
  );
}
