"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { formatMXN } from "@/lib/money";
import { refundSchema } from "../schemas";
import { refundPaymentAction } from "../server/actions";

/** Reembolso parcial o total de un pago cobrado. En línea se procesa con la pasarela. */
export function RefundDialog({
  paymentId,
  maxCents,
  paymentLabel,
  online,
}: {
  paymentId: string;
  maxCents: number;
  paymentLabel: string;
  online: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const defaults = React.useMemo(() => ({ paymentId, amountCents: maxCents, reason: "" }), [paymentId, maxCents]);
  const form = useForm({ resolver: zodResolver(refundSchema), defaultValues: defaults });
  const errors = form.formState.errors;
  const amount = form.watch("amountCents");

  function onOpenChange(next: boolean) {
    if (next) form.reset(defaults);
    setOpen(next);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.amountCents > maxCents) {
      form.setError("amountCents", { message: `Máximo ${formatMXN(maxCents)}.` });
      return;
    }
    let res: Awaited<ReturnType<typeof refundPaymentAction>>;
    try {
      res = await refundPaymentAction(values);
    } catch {
      // Falla de red: el reembolso pudo haberse aplicado. Nunca invitar a repetirlo a ciegas.
      toast.error("No pudimos confirmar el resultado. Revisa la lista de pagos antes de intentarlo de nuevo.");
      setOpen(false);
      router.refresh();
      return;
    }
    if (handleActionResult(res, { form })) {
      toast.success(
        res.data.providerStatus === "pending"
          ? "Reembolso solicitado; la pasarela lo está procesando"
          : res.data.originalStatus === "REFUNDED"
            ? "Reembolso total registrado"
            : "Reembolso parcial registrado",
      );
      setOpen(false);
      router.refresh();
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Reembolsar ${paymentLabel}`}>
          <Undo2 className="size-3.5" aria-hidden />
          Reembolsar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Reembolsar pago</DialogTitle>
          <DialogDescription>
            {online
              ? `El reembolso de ${paymentLabel} se enviará a la clienta por la pasarela de pago. Esta acción no se puede deshacer.`
              : `Registra el reembolso de ${paymentLabel} que hiciste fuera de la plataforma (transferencia o efectivo).`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" {...form.register("paymentId")} />
          <Field
            label="Monto a reembolsar"
            required
            error={errors.amountCents?.message}
            description={`Disponible para reembolsar: ${formatMXN(maxCents)}`}
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
          <Field label="Motivo" required error={errors.reason?.message}>
            {(props) => (
              <Textarea
                rows={3}
                maxLength={300}
                placeholder="Ej. Cancelación con más de 15 días: 50% del anticipo según la política."
                {...props}
                {...form.register("reason")}
              />
            )}
          </Field>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton
              pending={form.formState.isSubmitting}
              pendingText="Procesando…"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Reembolsar {typeof amount === "number" && amount > 0 ? formatMXN(amount) : ""}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
