"use client";

import { useId } from "react";
import { ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/data/copy-button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rotateShareTokenAction } from "../server/actions";

export function SharePanel({
  capsuleId,
  shareUrl,
  whatsappUrl,
  customerName,
  hasCustomerPhone,
  published,
}: {
  capsuleId: string;
  shareUrl: string;
  whatsappUrl: string;
  customerName: string;
  hasCustomerPhone: boolean;
  published: boolean;
}) {
  const inputId = useId();

  async function rotate() {
    const res = await rotateShareTokenAction({ capsuleId });
    handleActionResult(res, { success: "Nuevo enlace generado. El anterior ya no funciona." });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={inputId} className="text-sm font-medium">
          Enlace para compartir
        </Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            readOnly
            value={shareUrl}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton value={shareUrl} label="Copiar" toastMessage="Enlace copiado" aria-label="Copiar enlace de la cápsula" />
        </div>
        {!published ? (
          <p className="text-muted-foreground text-xs">
            Mientras no esté publicada, quien abra el enlace verá un aviso de “en preparación”.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" aria-hidden />
            Enviar a {customerName.split(" ")[0] || "la clienta"} por WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            Ver como invitada
          </a>
        </Button>
      </div>
      {!hasCustomerPhone ? (
        <p className="text-muted-foreground text-xs">
          La clienta no tiene teléfono registrado: WhatsApp te pedirá elegir el contacto.
        </p>
      ) : null}

      <div className="border-t pt-4">
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <RefreshCw className="size-3.5" aria-hidden />
              Generar nuevo enlace
            </Button>
          }
          title="¿Generar un nuevo enlace?"
          description="El enlace actual dejará de funcionar de inmediato. Úsalo si se compartió con alguien que no debía verlo; tendrás que reenviar el nuevo a la clienta."
          confirmLabel="Generar nuevo enlace"
          destructive
          onConfirm={rotate}
        />
      </div>
    </div>
  );
}
