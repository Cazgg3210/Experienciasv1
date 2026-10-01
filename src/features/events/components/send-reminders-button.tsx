"use client";

import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { sendRsvpRemindersAction } from "../server/actions";

/** Envía RSVP_REMINDER (correo/WhatsApp) a las invitadas pendientes con contacto. Máximo 1 por día por invitada. */
export function SendRemindersButton({
  eventId,
  pendingWithContact,
  disabledReason,
}: {
  eventId: string;
  pendingWithContact: number;
  disabledReason?: string | null;
}) {
  async function send() {
    const res = await sendRsvpRemindersAction({ eventId });
    if (!handleActionResult(res)) return;
    const { sent, failed, alreadySentToday, withoutContact } = res.data;
    const parts = [
      sent
        ? `${sent} recordatorio${sent === 1 ? "" : "s"} enviado${sent === 1 ? "" : "s"}`
        : "No se envió ningún recordatorio nuevo",
      failed
        ? `${failed} ${failed === 1 ? "no se pudo" : "no se pudieron"} enviar (revisa el teléfono o los canales activos)`
        : null,
      alreadySentToday ? `${alreadySentToday} ya lo recibió hoy` : null,
      withoutContact ? `${withoutContact} sin teléfono ni correo` : null,
    ].filter(Boolean);
    if (sent && !failed) toast.success(parts.join(" · "));
    else if (failed) toast.warning(parts.join(" · "));
    else toast.info(parts.join(" · "));
  }

  const disabled = !!disabledReason || pendingWithContact === 0;
  return (
    <div className="flex flex-col items-start gap-1">
      <ConfirmDialog
        title="¿Enviar recordatorio a pendientes?"
        description={`Se enviará un recordatorio por correo y/o WhatsApp a ${pendingWithContact} invitada${pendingWithContact === 1 ? "" : "s"} pendiente${pendingWithContact === 1 ? "" : "s"} con su link personal. Sólo se envía uno por día a cada invitada.`}
        confirmLabel="Enviar recordatorios"
        onConfirm={send}
        trigger={
          <Button variant="outline" size="lg" disabled={disabled}>
            <BellRing aria-hidden />
            Enviar recordatorio a pendientes
          </Button>
        }
      />
      {disabledReason ? (
        <p className="text-muted-foreground text-xs">{disabledReason}</p>
      ) : pendingWithContact === 0 ? (
        <p className="text-muted-foreground text-xs">No hay pendientes con teléfono o correo.</p>
      ) : null}
    </div>
  );
}
