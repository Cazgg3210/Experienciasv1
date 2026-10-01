"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { rejectQuoteSchema, type RejectQuoteInput } from "../../schemas";
import { rejectQuoteAction } from "../../server/public-actions";

export function RejectQuoteButton({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<RejectQuoteInput>({ resolver: zodResolver(rejectQuoteSchema), defaultValues: { token, reason: "" } });

  async function onSubmit(values: RejectQuoteInput) {
    const res = await rejectQuoteAction(values);
    if (handleActionResult(res, { form, success: "Gracias por avisarnos" })) {
      setOpen(false);
      router.refresh();
    } else if (res.code === "CONFLICT" || res.code === "NOT_FOUND") {
      // Ya no admite cambios (expiró, se aceptó o se reemplazó): mostrar el estado vigente.
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="lg" className="text-muted-foreground">
          No por ahora
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">¿Rechazar la propuesta?</DialogTitle>
            <DialogDescription>
              No pasa nada. Si nos cuentas el motivo podemos proponerte otra opción (fecha, menú o presupuesto).
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" {...form.register("token")} />
          <Field label="Motivo (opcional)" error={form.formState.errors.reason?.message}>
            {(p) => <Textarea {...p} rows={3} maxLength={500} placeholder="Ej. cambiamos la fecha, buscamos algo más sencillo…" {...form.register("reason")} />}
          </Field>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <SubmitButton pending={form.formState.isSubmitting} pendingText="Enviando…" variant="destructive" size="lg">
              Rechazar propuesta
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
