import { Link2, MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/data/copy-button";
import { Button } from "@/components/ui/button";

/** Link del portal de la clienta (donde paga anticipo/saldo) + mensaje listo para WhatsApp. */
export function PaymentLinkCard({
  portalUrl,
  message,
  whatsappHref,
  hasPhone,
}: {
  portalUrl: string;
  message: string;
  whatsappHref: string;
  hasPhone: boolean;
}) {
  return (
    <div className="bg-sand-soft/60 rounded-2xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="bg-card text-olive flex size-9 shrink-0 items-center justify-center rounded-full border">
          <Link2 className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-heading text-lg font-semibold">Link de pago para la clienta</h3>
          <p className="text-muted-foreground text-sm">
            Desde su portal puede pagar el anticipo o el saldo en línea de forma segura.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <label className="sr-only" htmlFor="portal-url">
          Enlace del portal
        </label>
        <input
          id="portal-url"
          readOnly
          value={portalUrl}
          className="bg-card text-muted-foreground h-9 w-full min-w-0 truncate rounded-lg border px-3 font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <CopyButton value={portalUrl} label="Copiar link" toastMessage="Link del portal copiado" size="sm" />
          <CopyButton value={message} label="Copiar mensaje" toastMessage="Mensaje copiado" size="sm" />
          <Button asChild size="sm" variant="outline">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-3.5" aria-hidden />
              {hasPhone ? "Enviar por WhatsApp" : "Compartir por WhatsApp"}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
