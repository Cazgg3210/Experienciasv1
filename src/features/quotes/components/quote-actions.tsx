"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, Copy, ExternalLink, FilePlus2, MessageCircle, PartyPopper, Printer, RefreshCcw, Send } from "lucide-react";
import { toast } from "sonner";
import type { QuoteStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { CopyButton } from "@/components/data/copy-button";
import { handleActionResult } from "@/components/forms/action-result";
import { createNewVersionAction, duplicateQuoteAction, markQuoteExpiredAction, sendQuoteAction } from "../server/actions";

export type QuoteActionsProps = {
  quoteId: string;
  status: QuoteStatus;
  code: string;
  publicUrl: string;
  whatsappHref: string | null;
  customerName: string;
  hasContact: boolean;
  hasEventDate: boolean;
  eventId: string | null;
  canWrite: boolean;
  canSend: boolean;
  validityText: string;
};

export function QuoteActions(p: QuoteActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const shareable = p.status !== "DRAFT";

  async function run<T>(
    fn: () => Promise<import("@/server/action").ActionResult<T>>,
    success: string,
    after?: (data: T) => void,
    navigates = false,
  ) {
    setBusy(true);
    try {
      const res = await fn();
      if (handleActionResult(res, { success })) {
        // Si el callback navega (duplicar), no refrescar: refresh() cancelaría la navegación.
        if (after) after(res.data);
        if (!navigates) router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const sendLabel = p.status === "EXPIRED" ? "Reactivar y reenviar" : "Enviar a la clienta";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Acciones de la cotización">
      {p.canSend && (p.status === "DRAFT" || p.status === "EXPIRED") ? (
        <ConfirmDialog
          trigger={
            <Button size="lg" disabled={busy}>
              <Send aria-hidden /> {sendLabel}
            </Button>
          }
          title={`¿Enviar la propuesta a ${p.customerName}?`}
          description={
            !p.hasEventDate
              ? "Antes de enviar agrega la fecha del evento en Datos de la propuesta."
              : p.hasContact
                ? `Le llegará por email y/o WhatsApp con el enlace para revisarla y aceptarla. ${p.validityText}`
                : `La clienta no tiene email ni teléfono registrados: la propuesta quedará como enviada y podrás compartir el enlace manualmente. ${p.validityText}`
          }
          confirmLabel="Enviar"
          onConfirm={() =>
            run(() => sendQuoteAction({ quoteId: p.quoteId }), "Propuesta enviada", (d) => {
              if (!d.notified) toast.info("Comparte el enlace por WhatsApp o cópialo: la clienta no tiene datos de contacto.");
            })
          }
        />
      ) : null}

      {shareable ? (
        <>
          <CopyButton value={p.publicUrl} label="Copiar link" toastMessage="Link de la propuesta copiado" size="lg" />
          {p.whatsappHref ? (
            <Button asChild variant="outline" size="lg">
              <a href={p.whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden /> Compartir por WhatsApp
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="lg">
            <a href={p.publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> Ver como clienta
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Button>
        </>
      ) : null}

      {p.status === "ACCEPTED" && p.eventId ? (
        <Button asChild size="lg">
          <Link href={`/admin/events/${p.eventId}`}>
            <PartyPopper aria-hidden /> Ver evento
          </Link>
        </Button>
      ) : null}

      {p.canWrite && p.status === "SENT" ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="lg" disabled={busy}>
              <CalendarX2 aria-hidden /> Marcar expirada
            </Button>
          }
          title="¿Marcar la propuesta como expirada?"
          description="La clienta ya no podrá aceptarla desde su enlace. Podrás reactivarla y reenviarla después."
          confirmLabel="Marcar expirada"
          destructive
          onConfirm={() => run(() => markQuoteExpiredAction({ quoteId: p.quoteId }), "Propuesta marcada como expirada")}
        />
      ) : null}

      {p.canWrite && (p.status === "SENT" || p.status === "EXPIRED" || p.status === "REJECTED") ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="lg" disabled={busy}>
              <RefreshCcw aria-hidden /> Crear nueva versión
            </Button>
          }
          title="¿Crear una nueva versión?"
          description="La propuesta regresa a borrador (versión siguiente) para editar conceptos y precios. El enlace de la clienta dejará de funcionar hasta que la vuelvas a enviar."
          confirmLabel="Crear versión"
          onConfirm={() => run(() => createNewVersionAction({ quoteId: p.quoteId }), "Nueva versión en borrador")}
        />
      ) : null}

      {p.canWrite ? (
        <Button
          variant="ghost"
          size="lg"
          disabled={busy}
          onClick={() =>
            run(
              () => duplicateQuoteAction({ quoteId: p.quoteId }),
              "Cotización duplicada",
              (d) => router.push(`/admin/quotes/${d.id}`),
              true,
            )
          }
        >
          <FilePlus2 aria-hidden /> Duplicar
        </Button>
      ) : null}

      <Button asChild variant="ghost" size="lg">
        <Link href={`/admin/quotes/${p.quoteId}/print`}>
          <Printer aria-hidden /> Vista para imprimir
        </Link>
      </Button>
      {!shareable ? (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Copy className="size-3.5" aria-hidden /> El enlace para la clienta se activa al enviar.
        </span>
      ) : null}
    </div>
  );
}
