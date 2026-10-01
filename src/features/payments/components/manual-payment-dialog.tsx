"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { MediaUploader } from "@/components/media/media-uploader";
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { MANUAL_PAYMENT_METHODS, PAYABLE_KINDS, manualPaymentSchema } from "../schemas";
import { recordManualPaymentAction } from "../server/actions";
import { PaymentsSelect } from "./native-select";

/** Registrar un pago recibido fuera de la pasarela (efectivo, transferencia, terminal). */
export function ManualPaymentDialog({
  eventId,
  maxAmountCents,
  depositDueCents,
  todayKey,
}: {
  eventId: string;
  maxAmountCents: number;
  depositDueCents: number;
  todayKey: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [receipt, setReceipt] = React.useState<{ id: string; mimeType: string } | null>(null);
  const defaultKind = depositDueCents > 0 ? "DEPOSIT" : "BALANCE";
  const defaults = React.useMemo(
    () => ({
      eventId,
      amountCents: depositDueCents > 0 ? depositDueCents : maxAmountCents,
      kind: defaultKind as (typeof PAYABLE_KINDS)[number],
      method: "TRANSFER" as (typeof MANUAL_PAYMENT_METHODS)[number],
      paidAt: todayKey,
      notes: "",
      receiptMediaId: "",
    }),
    [eventId, depositDueCents, maxAmountCents, defaultKind, todayKey],
  );
  const form = useForm({ resolver: zodResolver(manualPaymentSchema), defaultValues: defaults });
  const errors = form.formState.errors;

  function onOpenChange(next: boolean) {
    if (next) {
      form.reset(defaults);
      setReceipt(null);
    }
    setOpen(next);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.amountCents > maxAmountCents) {
      form.setError("amountCents", { message: `El monto excede el saldo pendiente (${formatMXN(maxAmountCents)}).` });
      return;
    }
    let res: Awaited<ReturnType<typeof recordManualPaymentAction>>;
    try {
      res = await recordManualPaymentAction(values);
    } catch {
      // Falla de red: el pago pudo haberse registrado. Revisar antes de repetir (evita duplicados).
      toast.error("No pudimos confirmar el registro. Revisa la lista de pagos antes de intentarlo de nuevo.");
      setOpen(false);
      router.refresh();
      return;
    }
    if (handleActionResult(res, { form })) {
      toast.success(res.data.confirmed ? "Pago registrado. ¡El evento quedó confirmado!" : "Pago registrado");
      setOpen(false);
      router.refresh();
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="size-4" aria-hidden />
          Registrar pago manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Registrar pago manual</DialogTitle>
          <DialogDescription>
            Para pagos recibidos por transferencia, efectivo o terminal. Queda registrado en la auditoría y, si cubre el
            anticipo, el evento se confirma automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" {...form.register("eventId")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Monto"
              required
              error={errors.amountCents?.message}
              description={`Saldo pendiente: ${formatMXN(maxAmountCents)}`}
            >
              {(props) => (
                <Controller
                  control={form.control}
                  name="amountCents"
                  render={({ field }) => (
                    <MoneyInput
                      {...props}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Fecha de pago" required error={errors.paidAt?.message}>
              {(props) => <Input type="date" max={todayKey} className="h-9" {...props} {...form.register("paidAt")} />}
            </Field>
            <Field label="Concepto" required error={errors.kind?.message}>
              {(props) => (
                <PaymentsSelect {...props} {...form.register("kind")}>
                  {PAYABLE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {PAYMENT_KIND_LABELS[k]}
                    </option>
                  ))}
                </PaymentsSelect>
              )}
            </Field>
            <Field label="Método" required error={errors.method?.message}>
              {(props) => (
                <PaymentsSelect {...props} {...form.register("method")}>
                  {MANUAL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </PaymentsSelect>
              )}
            </Field>
          </div>
          <Field
            label="Notas"
            error={errors.notes?.message}
            description="Referencia SPEI, banco, quién recibió el efectivo…"
          >
            {(props) => <Textarea rows={2} maxLength={500} {...props} {...form.register("notes")} />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium" id="receipt-label">
              Comprobante <span className="text-muted-foreground font-normal">(opcional)</span>
            </p>
            {receipt ? (
              <div className="bg-sage-soft/60 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <FileCheck2 className="text-olive size-4" aria-hidden />
                  Comprobante adjunto ({receipt.mimeType === "application/pdf" ? "PDF" : "imagen"})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReceipt(null);
                    form.setValue("receiptMediaId", "");
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                  Quitar
                </Button>
              </div>
            ) : (
              <MediaUploader
                fields={{ purpose: "RECEIPT", visibility: "PRIVATE", eventId }}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                label="Sube el comprobante"
                hint="JPG, PNG, WEBP o PDF · máx. 8 MB"
                onUploaded={(m) => {
                  setReceipt({ id: m.id, mimeType: m.mimeType });
                  form.setValue("receiptMediaId", m.id);
                }}
              />
            )}
            {errors.receiptMediaId?.message ? <FormError message={errors.receiptMediaId.message} /> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting} pendingText="Registrando…">
              Registrar pago
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
