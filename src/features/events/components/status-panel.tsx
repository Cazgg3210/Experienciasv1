"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, Ban } from "lucide-react";
import { toast } from "sonner";
import type { EventStatus } from "@prisma/client";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatusBadge } from "@/components/data/status-badge";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES } from "@/lib/labels";
import { cancelEventSchema, type CancelEventInput } from "../schemas";
import { cancelEventAction, transitionEventAction } from "../server/actions";
import type { StatusAction } from "../domain/status-actions";
import type { AvailabilityView } from "./availability-hint";
import { useReturnFocus } from "./use-return-focus";

type CancelValues = CancelEventInput;

export function StatusPanel({
  eventId,
  status,
  actions,
  canWrite,
  canCancel,
  meta,
}: {
  eventId: string;
  status: EventStatus;
  actions: StatusAction[];
  canWrite: boolean;
  canCancel: boolean;
  meta: { completedAt?: string | null; cancelledAt?: string | null; cancellationReason?: string | null };
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [conflict, setConflict] = React.useState<{ to: EventStatus; availability: AvailabilityView } | null>(
    null,
  );
  const [forcing, setForcing] = React.useState(false);

  async function transition(to: EventStatus, confirmUnavailable = false) {
    const res = await transitionEventAction({ eventId, to, confirmUnavailable });
    if (!handleActionResult(res)) return;
    if (res.data.status === "needs_confirmation") {
      setConflict({ to, availability: res.data.availability });
      return;
    }
    setConflict(null);
    toast.success(`Estado actualizado: ${EVENT_STATUS_LABELS[res.data.to]}`);
  }

  const forward = actions.filter((a) => a.to !== "CANCELLED");
  const cancelAction = actions.find((a) => a.to === "CANCELLED");

  return (
    <section
      aria-labelledby="status-title"
      className="bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="status-title" className="font-heading text-xl font-semibold">
          Estado
        </h2>
        <StatusBadge tone={EVENT_STATUS_TONES[status]}>{EVENT_STATUS_LABELS[status]}</StatusBadge>
      </div>

      {status === "CANCELLED" ? (
        <div className="border-destructive/25 bg-destructive/5 rounded-lg border p-3 text-sm">
          <p className="font-medium">Evento cancelado{meta.cancelledAt ? ` el ${meta.cancelledAt}` : ""}</p>
          {meta.cancellationReason ? (
            <p className="text-muted-foreground mt-1">Motivo: {meta.cancellationReason}</p>
          ) : null}
        </div>
      ) : null}
      {status === "COMPLETED" && meta.completedAt ? (
        <p className="text-muted-foreground text-sm">Completado el {meta.completedAt}.</p>
      ) : null}

      {!canWrite ? (
        <p className="text-muted-foreground text-sm">No tienes permiso para cambiar el estado.</p>
      ) : actions.length === 0 ? (
        <p className="text-muted-foreground text-sm">Este estado es final; no hay más transiciones.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Siguiente paso</p>
          <ul className="space-y-2">
            {forward.map((a) => (
              <li key={a.to}>
                <ConfirmDialog
                  title={`${a.label}`}
                  description={a.description}
                  confirmLabel={a.label}
                  onConfirm={() => transition(a.to)}
                  trigger={
                    <Button variant="outline" className="h-10 w-full justify-between">
                      <span>{a.label}</span>
                      <ArrowRight aria-hidden />
                    </Button>
                  }
                />
              </li>
            ))}
            {cancelAction && canCancel ? (
              <li>
                <Button
                  variant="destructive"
                  className="h-10 w-full justify-between"
                  onClick={() => setCancelOpen(true)}
                >
                  <span>{cancelAction.label}</span>
                  <Ban aria-hidden />
                </Button>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {conflict ? (
        <div role="alert" className="border-warning/40 bg-warning/10 space-y-3 rounded-lg border p-3 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
            {conflict.availability.reason}
            {conflict.availability.capacity > 0
              ? ` (${conflict.availability.booked} de ${conflict.availability.capacity} lugares ocupados)`
              : ""}
          </p>
          <p className="text-muted-foreground">
            ¿Quieres pasar a “{EVENT_STATUS_LABELS[conflict.to]}” de todos modos? Podrías tener dos eventos el
            mismo día.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={forcing}
              onClick={async () => {
                setForcing(true);
                try {
                  await transition(conflict.to, true);
                } finally {
                  setForcing(false);
                }
              }}
            >
              Confirmar de todos modos
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setConflict(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {canCancel && cancelAction ? (
        <CancelEventDialog eventId={eventId} open={cancelOpen} onOpenChange={setCancelOpen} />
      ) : null}
    </section>
  );
}

function CancelEventDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const form = useForm<CancelValues>({
    resolver: zodResolver(cancelEventSchema),
    defaultValues: { eventId, reason: "", notifyCustomer: false },
  });
  const { errors, isSubmitting } = form.formState;
  const notify = form.watch("notifyCustomer");

  async function onSubmit(values: CancelValues) {
    const res = await cancelEventAction(values);
    if (!handleActionResult(res, { form })) return;
    const released = res.data.releasedReservations;
    toast.success(
      `Evento cancelado${released ? ` · ${released} reserva(s) de inventario liberadas` : ""}${res.data.notified ? " · clienta notificada" : ""}`,
    );
    form.reset({ eventId, reason: "", notifyCustomer: false });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cancelar evento</DialogTitle>
            <DialogDescription>
              Se libera la fecha, se cancelan las reservas de inventario y queda registrado en la bitácora.
              Los reembolsos se gestionan desde el panel de pagos.
            </DialogDescription>
          </DialogHeader>
          <Field label="Motivo de la cancelación" required error={errors.reason?.message}>
            {(p) => <Textarea {...p} {...form.register("reason")} rows={3} autoFocus />}
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox
              id="cancel-notify"
              checked={notify}
              onCheckedChange={(v) => form.setValue("notifyCustomer", v === true)}
            />
            <label htmlFor="cancel-notify" className="text-sm leading-snug">
              Avisar a la clienta por correo y WhatsApp
              <span className="text-muted-foreground block text-xs">
                El motivo no se incluye en el mensaje.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Volver
            </Button>
            <SubmitButton variant="destructive" pending={isSubmitting} pendingText="Cancelando…">
              Cancelar evento
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
