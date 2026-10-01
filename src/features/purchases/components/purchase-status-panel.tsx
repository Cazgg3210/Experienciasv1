"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Ban, CheckCircle2, FileText, Paperclip, PencilLine, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { MediaUploader, type UploadedMedia } from "@/components/media/media-uploader";
import { formatMXN } from "@/lib/money";
import type { PurchaseStatus } from "../domain/purchase-status";
import { moneyHint } from "./money-hint";
import {
  actualAmountSchema,
  cancelPurchaseSchema,
  receivePurchaseSchema,
  type ActualAmountInput,
  type CancelPurchaseInput,
  type ReceivePurchaseInput,
} from "../schemas";
import {
  attachReceiptAction,
  cancelPurchaseAction,
  markPurchaseOrderedAction,
  receivePurchaseAction,
  reopenPurchaseAction,
  updateActualAmountAction,
} from "../server/actions";

const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const RECEIPT_HINT = "Foto o PDF del ticket/factura · máx. 8 MB";

type PanelProps = {
  purchase: {
    id: string;
    status: PurchaseStatus;
    expectedAmountCents: number;
    actualAmountCents: number | null;
    eventId: string | null;
  };
  receipt: { id: string; url: string; mimeType: string } | null;
};

function ReceiveDialog({ purchase }: Pick<PanelProps, "purchase">) {
  const [open, setOpen] = React.useState(false);
  const [uploaded, setUploaded] = React.useState<UploadedMedia | null>(null);
  const router = useRouter();
  const form = useForm<ReceivePurchaseInput>({
    resolver: zodResolver(receivePurchaseSchema),
    defaultValues: { id: purchase.id, actualAmountCents: purchase.expectedAmountCents, receiptMediaId: null },
  });
  React.useEffect(() => {
    if (open) {
      setUploaded(null);
      form.reset({ id: purchase.id, actualAmountCents: purchase.expectedAmountCents, receiptMediaId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const actual = form.watch("actualAmountCents");
  const variance = Number.isFinite(actual) ? actual - purchase.expectedAmountCents : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <CheckCircle2 className="size-4" aria-hidden /> Marcar como recibida
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Registrar recepción</DialogTitle>
          <DialogDescription>
            El monto real alimenta el costo del evento. Esperado: {formatMXN(purchase.expectedAmountCents)}.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await receivePurchaseAction({ ...values, receiptMediaId: uploaded?.id ?? null });
            if (handleActionResult(res, { form, success: "Compra recibida" })) {
              setOpen(false);
              router.refresh();
            }
          })}
        >
          <Field
            label="Monto real pagado"
            required
            error={form.formState.errors.actualAmountCents?.message}
            description={`${moneyHint(actual)} ${
              !Number.isFinite(actual)
                ? ""
                : variance === 0
                  ? "Igual a lo esperado."
                  : variance > 0
                    ? `${formatMXN(variance)} por encima de lo esperado.`
                    : `${formatMXN(-variance)} por debajo de lo esperado.`
            }`}
          >
            {(p) => (
              <Controller
                control={form.control}
                name="actualAmountCents"
                render={({ field }) => (
                  <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v ?? undefined)} onBlur={field.onBlur} />
                )}
              />
            )}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Comprobante (opcional)</p>
            {uploaded ? (
              <div className="bg-sage-soft/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <a href={uploaded.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline">
                  <FileText className="size-4" aria-hidden /> Comprobante adjunto
                </a>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar comprobante" onClick={() => setUploaded(null)}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <MediaUploader
                fields={{ purpose: "RECEIPT", eventId: purchase.eventId ?? undefined }}
                accept={RECEIPT_ACCEPT}
                label="Sube el ticket o factura"
                hint={RECEIPT_HINT}
                onUploaded={setUploaded}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Confirmar recepción</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ purchaseId }: { purchaseId: string }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<CancelPurchaseInput>({
    resolver: zodResolver(cancelPurchaseSchema),
    defaultValues: { id: purchaseId, reason: "" },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-destructive w-full sm:w-auto">
          <Ban className="size-4" aria-hidden /> Cancelar compra
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Cancelar compra</DialogTitle>
          <DialogDescription>El motivo queda en las notas y en el historial. Podrás reabrirla después.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await cancelPurchaseAction(values);
            if (handleActionResult(res, { form, success: "Compra cancelada" })) {
              setOpen(false);
              form.reset({ id: purchaseId, reason: "" });
              router.refresh();
            }
          })}
        >
          <Field label="Motivo" required error={form.formState.errors.reason?.message}>
            {(p) => <Textarea {...p} rows={3} placeholder="Ej. La terraza es techada; ya no se requiere." {...form.register("reason")} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <SubmitButton pending={form.formState.isSubmitting} variant="destructive">
              Cancelar compra
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActualAmountDialog({ purchase }: Pick<PanelProps, "purchase">) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<ActualAmountInput>({
    resolver: zodResolver(actualAmountSchema),
    defaultValues: { id: purchase.id, actualAmountCents: purchase.actualAmountCents ?? 0, reason: "" },
  });
  React.useEffect(() => {
    if (open) form.reset({ id: purchase.id, actualAmountCents: purchase.actualAmountCents ?? 0, reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <PencilLine className="size-4" aria-hidden /> Corregir monto real
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Corregir monto real</DialogTitle>
          <DialogDescription>
            Cambia el costo real del evento. El cambio queda auditado con tu nombre y el motivo.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const res = await updateActualAmountAction(values);
            if (handleActionResult(res, { form, success: "Monto real actualizado" })) {
              setOpen(false);
              router.refresh();
            }
          })}
        >
          <Field
            label="Monto real"
            required
            error={form.formState.errors.actualAmountCents?.message}
            description={moneyHint(form.watch("actualAmountCents"))}
          >
            {(p) => (
              <Controller
                control={form.control}
                name="actualAmountCents"
                render={({ field }) => (
                  <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v ?? undefined)} onBlur={field.onBlur} />
                )}
              />
            )}
          </Field>
          <Field label="Motivo del cambio" required error={form.formState.errors.reason?.message}>
            {(p) => <Textarea {...p} rows={2} placeholder="Ej. Llegó la factura con el monto final." {...form.register("reason")} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Guardar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptSection({ purchase, receipt }: PanelProps) {
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  async function attach(media: UploadedMedia | null) {
    const res = await attachReceiptAction({ id: purchase.id, receiptMediaId: media?.id ?? null });
    if (handleActionResult(res, { success: media ? "Comprobante adjunto" : "Comprobante quitado" })) router.refresh();
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Comprobante</p>
      {receipt ? (
        <div className="bg-sand-soft/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <a href={receipt.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline">
            <Paperclip className="size-4" aria-hidden />
            {receipt.mimeType === "application/pdf" ? "Ver PDF" : "Ver imagen"}
          </a>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" disabled={busy}>
                Quitar
              </Button>
            }
            title="¿Quitar el comprobante?"
            description="El archivo sigue guardado, pero deja de estar ligado a esta compra."
            confirmLabel="Quitar"
            onConfirm={() => startTransition(() => attach(null))}
          />
        </div>
      ) : (
        <MediaUploader
          fields={{ purpose: "RECEIPT", eventId: purchase.eventId ?? undefined }}
          accept={RECEIPT_ACCEPT}
          label="Adjuntar ticket o factura"
          hint={RECEIPT_HINT}
          disabled={busy}
          onUploaded={(m) => startTransition(() => attach(m))}
        />
      )}
    </div>
  );
}

/** Acciones de estado de una compra según purchaseStatusMachine. */
export function PurchaseStatusPanel({
  purchase,
  receipt,
  canWrite,
  eventClosed = false,
}: PanelProps & { canWrite: boolean; eventClosed?: boolean }) {
  const router = useRouter();
  if (!canWrite) return null;
  const s = purchase.status;
  return (
    <div className="space-y-4">
      {eventClosed ? (
        <p className="bg-sand-soft/60 text-muted-foreground rounded-lg border px-3 py-2 text-sm">
          El evento ya está cerrado: sus costos quedaron congelados, así que no puedes recibir esta compra ni corregir su
          monto real.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {s === "REQUESTED" ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="w-full sm:w-auto">
                <Send className="size-4" aria-hidden /> Marcar como ordenada
              </Button>
            }
            title="¿Marcar como ordenada?"
            description="Registra que ya se hizo el pedido al proveedor."
            confirmLabel="Marcar ordenada"
            onConfirm={async () => {
              const res = await markPurchaseOrderedAction({ id: purchase.id });
              if (handleActionResult(res, { success: "Compra ordenada" })) router.refresh();
            }}
          />
        ) : null}
        {(s === "REQUESTED" || s === "ORDERED") && !eventClosed ? <ReceiveDialog purchase={purchase} /> : null}
        {s === "ORDERED" ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="w-full sm:w-auto">
                <RotateCcw className="size-4" aria-hidden /> Volver a solicitada
              </Button>
            }
            title="¿Regresar a solicitada?"
            description="Se borra la fecha de orden. Úsalo si el pedido no se concretó."
            confirmLabel="Regresar"
            onConfirm={async () => {
              const res = await reopenPurchaseAction({ id: purchase.id });
              if (handleActionResult(res, { success: "Compra regresada a solicitada" })) router.refresh();
            }}
          />
        ) : null}
        {s === "REQUESTED" || s === "ORDERED" ? <CancelDialog purchaseId={purchase.id} /> : null}
        {s === "CANCELLED" ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="w-full sm:w-auto">
                <RotateCcw className="size-4" aria-hidden /> Reabrir compra
              </Button>
            }
            title="¿Reabrir esta compra?"
            description="Vuelve a quedar como solicitada."
            confirmLabel="Reabrir"
            onConfirm={async () => {
              const res = await reopenPurchaseAction({ id: purchase.id });
              if (handleActionResult(res, { success: false })) {
                toast.success("Compra reabierta");
                router.refresh();
              }
            }}
          />
        ) : null}
        {s === "RECEIVED" && !eventClosed ? <ActualAmountDialog purchase={purchase} /> : null}
      </div>
      {s !== "CANCELLED" ? <ReceiptSection purchase={purchase} receipt={receipt} /> : null}
    </div>
  );
}
